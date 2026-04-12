'use client'

import { useState } from 'react'
import { Loader2, Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useGoals } from '@/hooks/useGoals'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ActivityBadge } from '@/components/shared/ActivityBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Goal } from '@/types/database'

export default function GoalsPage() {
  const {
    active,
    completed,
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    suggestions,
    generatingSuggestions,
    generateSuggestions,
    acceptSuggestion,
    dismissSuggestion,
  } = useGoals()
  const { activities } = useActivities()
  const { toast } = useToast()

  /* ── Add goal form ── */
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    targetDate: '',
    targetValue: '',
    unit: '',
    activityId: '',
  })
  const [addSubmitting, setAddSubmitting] = useState(false)

  /* ── Update progress modal ── */
  const [updateGoalId, setUpdateGoalId] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const updateTargetGoal = active.find((g) => g.id === updateGoalId)

  /* ── Edit goal modal ── */
  const [editGoalItem, setEditGoalItem] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    targetDate: '',
    targetValue: '',
    unit: '',
    activityId: '',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  /* ── AI suggestions editable state ── */
  const [editableSuggestions, setEditableSuggestions] = useState<
    Array<{
      title: string
      target_value: number
      unit: string
      description: string | null
      activity_id: string | null
      accepted: boolean
    }>
  >([])

  const openEdit = (g: Goal) => {
    setEditGoalItem(g)
    setEditForm({
      title: g.title,
      description: g.description ?? '',
      targetDate: g.deadline ?? '',
      targetValue: String(g.target_value),
      unit: g.unit ?? '',
      activityId: g.activity_id ?? '',
    })
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.title || !addForm.targetValue) return
    setAddSubmitting(true)
    try {
      await createGoal({
        title: addForm.title,
        description: addForm.description || null,
        target_value: parseFloat(addForm.targetValue),
        current_value: 0,
        unit: addForm.unit || null,
        deadline: addForm.targetDate || null,
        activity_id: addForm.activityId || null,
        completed: false,
      })
      toast('Objetivo creado.', 'success')
      setAddOpen(false)
      setAddForm({
        title: '',
        description: '',
        targetDate: '',
        targetValue: '',
        unit: '',
        activityId: '',
      })
    } catch {
      toast('Error al crear el objetivo.', 'error')
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGoalItem) return
    setEditSubmitting(true)
    try {
      await updateGoal(editGoalItem.id, {
        title: editForm.title,
        description: editForm.description || null,
        target_value: parseFloat(editForm.targetValue),
        unit: editForm.unit || null,
        deadline: editForm.targetDate || null,
        activity_id: editForm.activityId || null,
      })
      toast('Objetivo actualizado.', 'success')
      setEditGoalItem(null)
    } catch {
      toast('Error al actualizar el objetivo.', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id)
      toast('Objetivo eliminado.', 'default')
    } catch {
      toast('Error al eliminar el objetivo.', 'error')
    }
  }

  const handleUpdateProgress = async () => {
    if (!updateTargetGoal || !newValue) return
    try {
      await updateGoal(updateTargetGoal.id, {
        current_value: parseFloat(newValue),
      })
      toast('Progreso actualizado.', 'success')
      setUpdateGoalId(null)
      setNewValue('')
    } catch {
      toast('Error al actualizar el progreso.', 'error')
    }
  }

  const handleGenerateSuggestions = async () => {
    try {
      const sug = await generateSuggestions()
      setEditableSuggestions(
        sug.map((s) => ({
          title: s.title,
          target_value: s.target_value,
          unit: s.unit,
          description: s.description,
          activity_id: s.activity_id,
          accepted: false,
        }))
      )
    } catch {
      toast('Error al generar objetivos.', 'error')
    }
  }

  const handleAcceptSuggestion = async (idx: number) => {
    const s = editableSuggestions[idx]
    if (!s || s.accepted) return
    try {
      await acceptSuggestion({
        title: s.title,
        target_value: s.target_value,
        current_value: 0,
        unit: s.unit,
        description: s.description,
        activity_id: s.activity_id,
      })
      setEditableSuggestions((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, accepted: true } : item))
      )
      toast('Objetivo aceptado.', 'success')
    } catch {
      toast('Error al aceptar el objetivo.', 'error')
    }
  }

  const handleDiscardSuggestion = (idx: number) => {
    const s = editableSuggestions[idx]
    if (s) dismissSuggestion(s.title)
    setEditableSuggestions((prev) => prev.filter((_, i) => i !== idx))
  }

  const getDaysRemaining = (deadline: string) =>
    Math.ceil(
      (new Date(deadline + 'T12:00:00').getTime() - Date.now()) / 86400000
    )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#f1f5f9]">Objetivos</h1>

      {/* ── Long-term goals ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">
            Objetivos a largo plazo
          </h2>
          <button
            onClick={() => setAddOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} />
            Añadir objetivo
          </button>
        </div>

        {/* Add form */}
        {addOpen && (
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Título</label>
                <input
                  required
                  type="text"
                  value={addForm.title}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Descripción</label>
                <textarea
                  rows={2}
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Fecha objetivo</label>
                <input
                  type="date"
                  value={addForm.targetDate}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, targetDate: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-[#94a3b8]">Valor objetivo</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={addForm.targetValue}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, targetValue: e.target.value }))
                    }
                    className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-[#94a3b8]">Unidad</label>
                  <input
                    type="text"
                    placeholder="libros, horas, kg..."
                    value={addForm.unit}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">
                  Vincular a actividad
                </label>
                <select
                  value={addForm.activityId}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, activityId: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                >
                  <option value="">Sin vincular</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Guardar objetivo
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#94a3b8] font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Goal cards */}
        {loading ? (
          <p className="text-sm text-[#94a3b8]">Cargando...</p>
        ) : active.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Sin objetivos activos"
            description="Añade tu primer objetivo arriba"
          />
        ) : (
          active.map((goal) => {
            const pct =
              goal.target_value > 0
                ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                : 0
            const activity = activities.find((a) => a.id === goal.activity_id)
            const near14Days =
              goal.deadline && getDaysRemaining(goal.deadline) <= 14

            return (
              <div
                key={goal.id}
                className={`bg-[#111111] border rounded-xl p-5 mb-3 ${
                  near14Days ? 'border-[#f59e0b]' : 'border-[#1f1f1f]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-[#f1f5f9]">
                      {goal.title}
                    </span>
                  </div>
                </div>
                {goal.description && (
                  <p className="text-sm text-[#94a3b8] mb-2">{goal.description}</p>
                )}
                {activity && (
                  <div className="mb-2">
                    <ActivityBadge
                      name={activity.name}
                      color={activity.color}
                      size="sm"
                    />
                  </div>
                )}
                <div className="space-y-1.5 mb-3">
                  <ProgressBar
                    value={goal.current_value}
                    max={goal.target_value}
                    color={activity?.color ?? '#6366f1'}
                  />
                  <span className="text-xs text-[#94a3b8]">
                    {goal.current_value} / {goal.target_value}{' '}
                    {goal.unit ?? ''}
                  </span>
                </div>
                {goal.deadline && (
                  <p className="text-xs text-[#475569] mb-3">
                    Fecha límite:{' '}
                    {new Date(goal.deadline + 'T12:00:00').toLocaleDateString(
                      'es-ES',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                    {near14Days && (
                      <span className="ml-2 text-[#f59e0b]">
                        ({getDaysRemaining(goal.deadline)}d restantes)
                      </span>
                    )}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setUpdateGoalId(goal.id)
                      setNewValue(String(goal.current_value))
                    }}
                    className="px-3 py-1.5 bg-[#1a1a1a] border border-[#1f1f1f] text-[#f1f5f9] text-xs rounded-lg hover:bg-[#222] transition-colors"
                  >
                    Actualizar progreso
                  </button>
                  <button
                    onClick={() => openEdit(goal)}
                    className="px-3 py-1.5 text-[#94a3b8] text-xs rounded-lg hover:bg-[#1a1a1a] transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="px-3 py-1.5 text-[#ef4444]/70 text-xs rounded-lg hover:bg-[#ef4444]/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Completed goals */}
        {completed.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-[#475569] mb-2">
              Completados ({completed.length})
            </p>
            {completed.map((goal) => (
              <div
                key={goal.id}
                className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 mb-2 opacity-60"
              >
                <span className="text-sm text-[#94a3b8] line-through">
                  {goal.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── AI weekly goals ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">
            Objetivos de esta semana
          </h2>
          <span className="bg-[#6366f1]/20 text-[#6366f1] text-xs rounded px-2 py-0.5 font-medium">
            IA
          </span>
        </div>

        <button
          onClick={handleGenerateSuggestions}
          disabled={generatingSuggestions}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {generatingSuggestions ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generando objetivos...
            </>
          ) : (
            <>🤖 Generar objetivos para esta semana</>
          )}
        </button>

        {/* Editable AI suggestions */}
        {editableSuggestions.map((s, idx) =>
          s.accepted ? (
            <div
              key={idx}
              className="bg-[#111111] border border-[#22c55e]/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#22c55e] text-sm">✓</span>
                <span className="text-sm text-[#f1f5f9]">{s.title}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1">
                Meta: {s.target_value} {s.unit}
              </p>
            </div>
          ) : (
            <div
              key={idx}
              className="bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl p-4"
            >
              <input
                type="text"
                value={s.title}
                onChange={(e) =>
                  setEditableSuggestions((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, title: e.target.value } : item
                    )
                  )
                }
                className="w-full bg-transparent text-sm text-[#f1f5f9] border-b border-[#1f1f1f] focus:border-[#6366f1] focus:outline-none pb-1 mb-2"
              />
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[#94a3b8]">Meta:</span>
                <input
                  type="number"
                  value={s.target_value}
                  onChange={(e) =>
                    setEditableSuggestions((prev) =>
                      prev.map((item, i) =>
                        i === idx
                          ? { ...item, target_value: parseFloat(e.target.value) || 0 }
                          : item
                      )
                    )
                  }
                  className="w-20 bg-transparent text-sm text-[#f1f5f9] border-b border-[#1f1f1f] focus:border-[#6366f1] focus:outline-none text-center"
                />
                <span className="text-xs text-[#94a3b8]">{s.unit}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptSuggestion(idx)}
                  className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-medium rounded-lg py-2 transition-colors"
                >
                  Aceptar ✓
                </button>
                <button
                  onClick={() => handleDiscardSuggestion(idx)}
                  className="px-3 py-2 text-[#94a3b8] text-xs rounded-lg hover:bg-[#111111] transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          )
        )}

        {/* Also show raw suggestions from hook if no editable ones */}
        {editableSuggestions.length === 0 &&
          suggestions.length > 0 &&
          suggestions.map((s, idx) => (
            <div
              key={idx}
              className="bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl p-4"
            >
              <p className="text-sm text-[#f1f5f9]">{s.title}</p>
              <p className="text-xs text-[#94a3b8] mt-1">
                Meta: {s.target_value} {s.unit}
              </p>
            </div>
          ))}
      </section>

      {/* ── Update progress modal ── */}
      {updateGoalId && updateTargetGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setUpdateGoalId(null)}
          />
          <div className="relative bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-[#f1f5f9] mb-1">
              Actualizar progreso
            </h2>
            <p className="text-sm text-[#94a3b8] mb-4">{updateTargetGoal.title}</p>
            <p className="text-xs text-[#475569] mb-2">
              Valor actual: {updateTargetGoal.current_value}{' '}
              {updateTargetGoal.unit ?? ''}
            </p>
            <input
              type="number"
              min="0"
              step="any"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleUpdateProgress}
                className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => setUpdateGoalId(null)}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#94a3b8] font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit goal modal ── */}
      {editGoalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditGoalItem(null)}
          />
          <div className="relative bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-[#f1f5f9] mb-4">
              Editar objetivo
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Título</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Descripción</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-[#94a3b8]">Valor objetivo</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editForm.targetValue}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, targetValue: e.target.value }))
                    }
                    className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-[#94a3b8]">Unidad</label>
                  <input
                    type="text"
                    value={editForm.unit}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Fecha objetivo</label>
                <input
                  type="date"
                  value={editForm.targetDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, targetDate: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Vincular a actividad</label>
                <select
                  value={editForm.activityId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, activityId: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                >
                  <option value="">Sin vincular</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {editSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditGoalItem(null)}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#94a3b8] font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
