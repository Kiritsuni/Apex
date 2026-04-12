'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Activity } from '@/types/database'

const PRESET_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#8b5cf6',
]

const CATEGORIES = ['Estudio', 'Finanzas', 'Fitness', 'Otro'] as const
type Category = (typeof CATEGORIES)[number]
const CAT_MAP: Record<Category, string> = {
  Estudio: 'study',
  Finanzas: 'finance',
  Fitness: 'fitness',
  Otro: 'other',
}
const CAT_LABEL: Record<string, string> = {
  study: 'Estudio',
  finance: 'Finanzas',
  fitness: 'Fitness',
  other: 'Otro',
}

function ActivityForm({
  form,
  setForm,
  onSubmit,
  submitting,
  onCancel,
  isEdit,
}: {
  form: {
    name: string
    color: string
    category: string
    weeklyGoalHours: string
    weeklyGoalSessions: string
    dailyMinHours: string
    isHardDaily: boolean
  }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  onCancel: () => void
  isEdit: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm text-[#94a3b8]">Nombre</label>
        <input
          required
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#94a3b8]">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              className="w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                outline: form.color === c ? `2px solid white` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#94a3b8]">Categoría</label>
        <select
          value={
            Object.entries(CAT_MAP).find(([, v]) => v === form.category)?.[0] ??
            'Otro'
          }
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              category: CAT_MAP[e.target.value as Category] ?? 'other',
            }))
          }
          className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm text-[#94a3b8]">
            Objetivo semanal (horas)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.weeklyGoalHours}
            onChange={(e) =>
              setForm((f) => ({ ...f, weeklyGoalHours: e.target.value }))
            }
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-[#94a3b8]">
            Objetivo semanal (sesiones)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.weeklyGoalSessions}
            onChange={(e) =>
              setForm((f) => ({ ...f, weeklyGoalSessions: e.target.value }))
            }
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#94a3b8]">Mínimo diario (horas)</label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={form.dailyMinHours}
          onChange={(e) =>
            setForm((f) => ({ ...f, dailyMinHours: e.target.value }))
          }
          className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setForm((f) => ({ ...f, isHardDaily: !f.isHardDaily }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            form.isHardDaily ? 'bg-[#6366f1]' : 'bg-[#1f1f1f]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              form.isHardDaily ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
        <span className="text-sm text-[#94a3b8]">
          Restricción diaria obligatoria
        </span>
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Guardar actividad'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#94a3b8] font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

const EMPTY_FORM = {
  name: '',
  color: PRESET_COLORS[0],
  category: 'study',
  weeklyGoalHours: '',
  weeklyGoalSessions: '',
  dailyMinHours: '',
  isHardDaily: false,
}

export default function ActivitiesPage() {
  const { activities, loading, createActivity, updateActivity, deleteActivity } =
    useActivities()
  const { toast } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addSubmitting, setAddSubmitting] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.name) return
    setAddSubmitting(true)
    try {
      await createActivity({
        name: addForm.name,
        color: addForm.color,
        icon: 'BookOpen',
        category: addForm.category,
        weekly_goal_hours: addForm.weeklyGoalHours
          ? parseFloat(addForm.weeklyGoalHours)
          : undefined,
        weekly_goal_sessions: addForm.weeklyGoalSessions
          ? parseInt(addForm.weeklyGoalSessions)
          : undefined,
        daily_min_hours: addForm.dailyMinHours
          ? parseFloat(addForm.dailyMinHours)
          : undefined,
        is_hard_daily_constraint: addForm.isHardDaily,
        sort_order: activities.length + 1,
      })
      toast('Actividad creada.', 'success')
      setAddOpen(false)
      setAddForm(EMPTY_FORM)
    } catch {
      toast('Error al crear actividad.', 'error')
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEdit = (a: Activity) => {
    setEditId(a.id)
    setEditForm({
      name: a.name,
      color: a.color,
      category: a.category,
      weeklyGoalHours: a.weekly_goal_hours ? String(a.weekly_goal_hours) : '',
      weeklyGoalSessions: a.weekly_goal_sessions
        ? String(a.weekly_goal_sessions)
        : '',
      dailyMinHours: a.daily_min_hours ? String(a.daily_min_hours) : '',
      isHardDaily: a.is_hard_daily_constraint ?? false,
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    setEditSubmitting(true)
    try {
      await updateActivity(editId, {
        name: editForm.name,
        color: editForm.color,
        category: editForm.category,
        weekly_goal_hours: editForm.weeklyGoalHours
          ? parseFloat(editForm.weeklyGoalHours)
          : undefined,
        weekly_goal_sessions: editForm.weeklyGoalSessions
          ? parseInt(editForm.weeklyGoalSessions)
          : undefined,
        daily_min_hours: editForm.dailyMinHours
          ? parseFloat(editForm.dailyMinHours)
          : undefined,
        is_hard_daily_constraint: editForm.isHardDaily,
      })
      toast('Actividad actualizada.', 'success')
      setEditId(null)
    } catch {
      toast('Error al actualizar actividad.', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteActivity(id)
      toast('Actividad eliminada.', 'default')
    } catch {
      toast('Error al eliminar actividad.', 'error')
    }
  }

  const handleToggleActive = async (a: Activity) => {
    // No `is_active` column in current schema, skip
    toast('Función no disponible en esta versión.', 'default')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Actividades</h1>
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nueva actividad
        </button>
      </div>

      {/* ── Add form ── */}
      {addOpen && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <ActivityForm
            form={addForm}
            setForm={setAddForm}
            onSubmit={handleAdd}
            submitting={addSubmitting}
            onCancel={() => setAddOpen(false)}
            isEdit={false}
          />
        </div>
      )}

      {/* ── Activity list ── */}
      {loading ? (
        <p className="text-sm text-[#94a3b8]">Cargando...</p>
      ) : activities.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="Sin actividades"
          description="Añade tu primera actividad para empezar a hacer seguimiento"
        />
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id}>
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#f1f5f9] text-sm">
                        {a.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#1a1a1a] text-[#94a3b8]">
                        {CAT_LABEL[a.category] ?? a.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {a.weekly_goal_hours
                        ? `${a.weekly_goal_hours}h/semana`
                        : a.weekly_goal_sessions
                        ? `${a.weekly_goal_sessions} sesiones/semana`
                        : 'Sin objetivo semanal'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() =>
                        editId === a.id ? setEditId(null) : openEdit(a)
                      }
                      className="px-3 py-1.5 text-[#94a3b8] text-xs rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="px-3 py-1.5 text-[#ef4444]/70 text-xs rounded-lg hover:bg-[#ef4444]/10 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline edit form */}
              {editId === a.id && (
                <div className="bg-[#111111] border border-[#6366f1]/30 rounded-xl p-5 mt-1">
                  <ActivityForm
                    form={editForm}
                    setForm={setEditForm}
                    onSubmit={handleEdit}
                    submitting={editSubmitting}
                    onCancel={() => setEditId(null)}
                    isEdit={true}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
