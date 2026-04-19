'use client'

import { useState } from 'react'
import {
  Loader2,
  Plus,
  X,
  Target,
  MoreHorizontal,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react'
import { useGoals } from '@/hooks/useGoals'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import { ProgressBar } from '@/components/shared/ProgressBar'
import type { Goal } from '@/types/database'

// ─── Templates ───────────────────────────────────────────────────────────────

const GOAL_TEMPLATES = [
  'Aprobar el C1 de Cambridge antes del 30 de octubre de 2026',
  'Cartera en 15.000 € antes del 31 de diciembre de 2026',
  'Press banca 90 kg × 5 reps antes de septiembre 2026',
  'Media final del curso ≥ 8.5',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysRemaining(deadline: string): number {
  return Math.ceil(
    (new Date(deadline + 'T12:00:00').getTime() - Date.now()) / 86400000
  )
}

function formatDeadline(deadline: string): string {
  return new Date(deadline + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Goal Add Form ────────────────────────────────────────────────────────────

function AddGoalForm({
  activities,
  onSave,
  onCancel,
}: {
  activities: { id: string; name: string; color: string }[]
  onSave: (data: Partial<Goal>) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [unit, setUnit] = useState('')
  const [activityId, setActivityId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      target_value: targetValue ? parseFloat(targetValue) : 1,
      current_value: 0,
      unit: unit.trim() || null,
      deadline: targetDate || null,
      activity_id: activityId || null,
      completed: false,
    })
    setSaving(false)
  }

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[12px] p-5">
      {/* Templates */}
      <div className="mb-4">
        <p className="text-[11px] font-[500] text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Ejemplos de objetivos
        </p>
        <div className="flex flex-col gap-1.5">
          {GOAL_TEMPLATES.map(t => (
            <button
              key={t}
              onClick={() => setTitle(t)}
              className="text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-[500] text-[var(--text-secondary)]">
              Objetivo (resultado concreto)
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="p.ej. Aprobar el C1 de Cambridge antes de octubre"
              className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-[500] text-[var(--text-secondary)]">
              Descripción (opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-[500] text-[var(--text-secondary)]">Fecha límite</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-[500] text-[var(--text-secondary)]">
                Vincular actividad
              </label>
              <select
                value={activityId}
                onChange={e => setActivityId(e.target.value)}
                className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Sin vincular</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional numeric target */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-[500] text-[var(--text-secondary)]">
                Valor objetivo (opcional)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="p.ej. 8.5"
                className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-[500] text-[var(--text-secondary)]">Unidad</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="puntos, kg, €..."
                className="w-full bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 border border-[var(--border)] rounded-[10px] text-[13px] font-[500] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-[600] rounded-[10px] text-[13px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Guardar objetivo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  activityColor,
  onUpdateProgress,
  onDelete,
  onMarkComplete,
}: {
  goal: Goal
  activityColor?: string
  onUpdateProgress: () => void
  onDelete: () => void
  onMarkComplete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const daysLeft = goal.deadline ? getDaysRemaining(goal.deadline) : null
  const isUrgent = daysLeft !== null && daysLeft <= 14
  const hasNumericTarget = goal.target_value && goal.target_value > 1
  const pct = hasNumericTarget
    ? Math.min(((goal.current_value ?? 0) / goal.target_value) * 100, 100)
    : 0

  return (
    <div
      className={`bg-[var(--surface-1)] border rounded-[12px] p-5 relative ${
        isUrgent ? 'border-[rgba(245,158,11,0.4)]' : 'border-[var(--border)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: activityColor ?? 'var(--accent)' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-[500] text-[var(--text-primary)] leading-snug">
            {goal.title}
          </p>
          {goal.description && (
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{goal.description}</p>
          )}
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] py-1 w-44 shadow-lg">
                <button
                  onClick={() => { setMenuOpen(false); onUpdateProgress() }}
                  className="w-full px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Actualizar progreso
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onMarkComplete() }}
                  className="w-full px-3 py-2 text-left text-[13px] text-[var(--success)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Marcar completado
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Numeric progress */}
      {hasNumericTarget && (
        <div className="mb-3 space-y-1.5">
          <ProgressBar
            value={pct}
            max={100}
            color={activityColor ?? 'var(--accent)'}
            height={3}
          />
          <div className="flex justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              {goal.current_value ?? 0} / {goal.target_value} {goal.unit ?? ''}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-[500]">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      )}

      {/* Deadline */}
      {goal.deadline && (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-[var(--text-muted)]">
            {formatDeadline(goal.deadline)}
          </span>
          {daysLeft !== null && (
            <span
              className={`text-[11px] font-[500] ${
                daysLeft <= 0
                  ? 'text-[var(--danger)]'
                  : daysLeft <= 14
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              · {daysLeft <= 0 ? 'Vencido' : `En ${daysLeft} días`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Update Progress Modal ────────────────────────────────────────────────────

function UpdateProgressModal({
  goal,
  onSave,
  onClose,
}: {
  goal: Goal
  onSave: (value: number) => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState(String(goal.current_value ?? 0))
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-[600] text-[var(--text-primary)]">
            Actualizar progreso
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-2)]">
            <X size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">{goal.title}</p>
        <div className="space-y-1.5">
          <label className="text-[12px] font-[500] text-[var(--text-muted)]">
            Valor actual ({goal.unit ?? 'progreso'})
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[var(--border)] rounded-[10px] text-[13px] font-[500] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              setSaving(true)
              await onSave(parseFloat(value) || 0)
              setSaving(false)
            }}
            disabled={saving}
            className="flex-1 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-[600] rounded-[10px] text-[13px] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  const [addOpen, setAddOpen] = useState(false)
  const [updateGoalId, setUpdateGoalId] = useState<string | null>(null)
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

  const updateTarget = active.find(g => g.id === updateGoalId) ?? null

  async function handleAdd(data: Partial<Goal>) {
    try {
      await createGoal(data)
      toast('Objetivo creado.', 'success')
      setAddOpen(false)
    } catch {
      toast('Error al crear el objetivo.', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGoal(id)
      toast('Objetivo eliminado.', 'default')
    } catch {
      toast('Error al eliminar el objetivo.', 'error')
    }
  }

  async function handleMarkComplete(id: string) {
    try {
      await updateGoal(id, { completed: true })
      toast('¡Objetivo completado!', 'success')
    } catch {
      toast('Error al actualizar.', 'error')
    }
  }

  async function handleUpdateProgress(id: string, value: number) {
    try {
      await updateGoal(id, { current_value: value })
      toast('Progreso actualizado.', 'success')
      setUpdateGoalId(null)
    } catch {
      toast('Error al actualizar el progreso.', 'error')
    }
  }

  async function handleGenerateSuggestions() {
    try {
      const sug = await generateSuggestions()
      setEditableSuggestions(
        sug.map(s => ({
          title: s.title,
          target_value: s.target_value,
          unit: s.unit,
          description: s.description,
          activity_id: s.activity_id,
          accepted: false,
        }))
      )
    } catch {
      toast('Error al generar acciones.', 'error')
    }
  }

  async function handleAcceptAction(idx: number) {
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
      setEditableSuggestions(prev =>
        prev.map((item, i) => (i === idx ? { ...item, accepted: true } : item))
      )
      toast('Acción guardada como objetivo.', 'success')
    } catch {
      toast('Error al aceptar la acción.', 'error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8 pb-24">

      {/* ─── Long-term goals ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-[20px] font-[600] text-[var(--text-primary)]"
              style={{ letterSpacing: '-0.01em' }}
            >
              Objetivos a largo plazo
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Resultados concretos que quieres conseguir
            </p>
          </div>
          <button
            onClick={() => setAddOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-[500] rounded-lg transition-colors"
          >
            <Plus size={14} />
            Añadir
          </button>
        </div>

        {/* Add form */}
        {addOpen && (
          <div className="mb-4">
            <AddGoalForm
              activities={activities}
              onSave={handleAdd}
              onCancel={() => setAddOpen(false)}
            />
          </div>
        )}

        {/* Goal list */}
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[14px]">Cargando...</span>
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Target size={28} className="text-[var(--text-muted)]" />
            <p className="text-[14px] text-[var(--text-secondary)] text-center">
              Sin objetivos activos. Añade tu primer resultado concreto.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-[500] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              Añadir objetivo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(goal => {
              const activity = activities.find(a => a.id === goal.activity_id)
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  activityColor={activity?.color}
                  onUpdateProgress={() => setUpdateGoalId(goal.id)}
                  onDelete={() => handleDelete(goal.id)}
                  onMarkComplete={() => handleMarkComplete(goal.id)}
                />
              )
            })}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-[500] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Completados ({completed.length})
            </p>
            <div className="space-y-2">
              {completed.map(goal => (
                <div
                  key={goal.id}
                  className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px] px-4 py-3 opacity-50"
                >
                  <span className="text-[13px] text-[var(--text-secondary)] line-through">
                    {goal.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-[var(--border)]" />

      {/* ─── Weekly actions (AI) ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-[18px] font-[600] text-[var(--text-primary)]"
              style={{ letterSpacing: '-0.01em' }}
            >
              Acciones de esta semana
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Tareas concretas y comprobables para esta semana
            </p>
          </div>
          {editableSuggestions.length > 0 && (
            <button
              onClick={handleGenerateSuggestions}
              disabled={generatingSuggestions}
              className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw size={13} className={generatingSuggestions ? 'animate-spin' : ''} />
              Regenerar
            </button>
          )}
        </div>

        {/* Generate button — shown if no suggestions yet */}
        {editableSuggestions.length === 0 && suggestions.length === 0 && (
          <button
            onClick={handleGenerateSuggestions}
            disabled={generatingSuggestions}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-primary)] text-[13px] font-[500] rounded-[10px] transition-colors disabled:opacity-60 w-full justify-center"
          >
            {generatingSuggestions ? (
              <>
                <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                Generando acciones…
              </>
            ) : (
              <>
                <RefreshCw size={14} className="text-[var(--accent)]" />
                Generar acciones con IA
              </>
            )}
          </button>
        )}

        {/* Editable suggestions */}
        {editableSuggestions.length > 0 && (
          <div className="space-y-2">
            {editableSuggestions.map((s, idx) =>
              s.accepted ? (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[rgba(16,185,129,0.2)] rounded-[10px]"
                >
                  <CheckSquare size={16} className="text-[var(--success)] flex-shrink-0" />
                  <span className="text-[13px] text-[var(--text-secondary)] line-through">
                    {s.title}
                  </span>
                </div>
              ) : (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px]"
                >
                  <Square size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="flex-1 text-[14px] text-[var(--text-primary)]">{s.title}</span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptAction(idx)}
                      className="text-[12px] font-[500] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        dismissSuggestion(s.title)
                        setEditableSuggestions(prev => prev.filter((_, i) => i !== idx))
                      }}
                      className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Regenerate after seeing list */}
            {editableSuggestions.every(s => s.accepted) && (
              <button
                onClick={handleGenerateSuggestions}
                disabled={generatingSuggestions}
                className="w-full py-2.5 border border-[var(--border)] rounded-[10px] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Regenerar acciones
              </button>
            )}
          </div>
        )}

        {/* Raw suggestions from hook (fallback) */}
        {editableSuggestions.length === 0 && suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[var(--border)] rounded-[10px]"
              >
                <Square size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                <span className="text-[14px] text-[var(--text-primary)]">{s.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Update progress modal ─── */}
      {updateGoalId && updateTarget && (
        <UpdateProgressModal
          goal={updateTarget}
          onSave={value => handleUpdateProgress(updateGoalId, value)}
          onClose={() => setUpdateGoalId(null)}
        />
      )}
    </div>
  )
}
