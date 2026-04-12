'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useExams } from '@/hooks/useExams'
import { useActivities } from '@/hooks/useActivities'
import { useTimerStore } from '@/lib/timer/store'
import { useToast } from '@/components/shared/Toast'
import { DaysRemaining } from '@/components/shared/DaysRemaining'
import { DifficultyDots } from '@/components/shared/DifficultyDots'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { SUBJECTS } from '@/lib/constants'
import type { Exam } from '@/types/database'

const DIFF_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#6366f1',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
}
const DIFF_LABELS: Record<number, string> = {
  1: 'Fácil',
  2: 'Normal',
  3: 'Difícil',
  4: 'Muy difícil',
  5: 'Brutal',
}

interface ExamFull extends Exam {
  difficulty?: number
  estimated_prep_hours?: number
  hours_logged?: number
}

function DifficultySelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="w-8 h-8 rounded-full cursor-pointer transition-all"
            style={{ backgroundColor: i <= value ? DIFF_COLORS[i] : '#1f1f1f' }}
          />
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs font-medium" style={{ color: DIFF_COLORS[value] }}>
          {DIFF_LABELS[value]}
        </p>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  title: '',
  subject: '',
  customSubject: '',
  dueDate: '',
  difficulty: 3,
  prepHours: 2,
  notes: '',
}

export default function ExamsPage() {
  const { exams, loading, refetch, updateExam } = useExams()
  const { activities } = useActivities()
  const { startTimer } = useTimerStore()
  const { toast } = useToast()

  const today = format(new Date(), 'yyyy-MM-dd')

  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [editOpen, setEditOpen] = useState(false)
  const [editExam, setEditExam] = useState<ExamFull | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    subject: '',
    customSubject: '',
    dueDate: '',
    difficulty: 3,
    notes: '',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)

  const activeExams = (exams as ExamFull[]).filter(
    (e) => e.status === 'upcoming' && e.exam_date >= today
  )
  const completedExams = (exams as ExamFull[]).filter((e) => e.status === 'done')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalSubject = form.subject === 'Otro' ? form.customSubject : form.subject
    if (!form.title || !finalSubject || !form.dueDate) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/exams/distribute-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subject: finalSubject,
          due_date: form.dueDate,
          difficulty: form.difficulty,
          estimated_prep_hours: form.prepHours,
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Error al añadir examen')
      }
      toast('Examen añadido. Sesiones de preparación distribuidas.', 'success')
      setForm(EMPTY_FORM)
      refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error desconocido', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkComplete = async (exam: ExamFull) => {
    try {
      await updateExam(exam.id, { status: 'done' })
      toast('Examen marcado como completado.', 'success')
    } catch {
      toast('Error al actualizar el examen.', 'error')
    }
  }

  const handleStartSession = async (exam: ExamFull) => {
    const schoolWork = activities.find((a) => a.name === 'School Work')
    if (!schoolWork) {
      toast('Actividad "School Work" no encontrada.', 'error')
      return
    }
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: schoolWork.id }),
      })
      if (!res.ok) throw new Error('Error al iniciar sesión')
      const data = await res.json() as { session: { id: string } }
      startTimer(
        schoolWork.id,
        schoolWork.name,
        schoolWork.color,
        data.session.id,
        exam.topic ?? exam.subject
      )
      toast('Sesión iniciada.', 'success')
    } catch {
      toast('Error al iniciar la sesión.', 'error')
    }
  }

  const openEdit = (exam: ExamFull) => {
    setEditExam(exam)
    setEditForm({
      title: exam.topic ?? exam.subject,
      subject: exam.subject,
      customSubject: '',
      dueDate: exam.exam_date,
      difficulty: exam.difficulty ?? 3,
      notes: exam.notes ?? '',
    })
    setEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExam) return
    setEditSubmitting(true)
    try {
      const finalSubject =
        editForm.subject === 'Otro' ? editForm.customSubject : editForm.subject
      await updateExam(editExam.id, {
        topic: editForm.title,
        subject: finalSubject,
        exam_date: editForm.dueDate,
        notes: editForm.notes,
      })
      toast('Examen actualizado.', 'success')
      setEditOpen(false)
    } catch {
      toast('Error al actualizar el examen.', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const getDaysRemaining = (examDate: string) =>
    Math.ceil(
      (new Date(examDate + 'T12:00:00').getTime() - Date.now()) / 86400000
    )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ── Add exam form ── */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
        <h2 className="text-base font-semibold text-[#f1f5f9] mb-4">
          Añadir examen / tarea
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">Título</label>
            <input
              type="text"
              required
              placeholder="Ej: Examen Economía Tema 3"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">Asignatura</label>
            <select
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              <option value="">Selecciona asignatura</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {form.subject === 'Otro' && (
            <div className="space-y-1.5">
              <label className="text-sm text-[#94a3b8]">Asignatura personalizada</label>
              <input
                type="text"
                placeholder="Escribe la asignatura"
                value={form.customSubject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customSubject: e.target.value }))
                }
                className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1]"
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">Fecha límite</label>
            <input
              type="date"
              required
              min={today}
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">Dificultad</label>
            <DifficultySelector
              value={form.difficulty}
              onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
            />
          </div>

          {/* Prep hours */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">
              Horas de preparación estimadas
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    prepHours: Math.max(0.5, +(f.prepHours - 0.5).toFixed(1)),
                  }))
                }
                className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#1f1f1f] text-[#f1f5f9] hover:bg-[#222] transition-colors flex items-center justify-center text-xl font-light"
              >
                −
              </button>
              <span className="text-base font-semibold text-[#f1f5f9] min-w-[3rem] text-center">
                {form.prepHours}h
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    prepHours: Math.min(50, +(f.prepHours + 0.5).toFixed(1)),
                  }))
                }
                className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#1f1f1f] text-[#f1f5f9] hover:bg-[#222] transition-colors flex items-center justify-center text-xl font-light"
              >
                +
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#94a3b8]">Notas</label>
            <textarea
              rows={3}
              placeholder="Notas adicionales..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 text-sm"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Añadiendo...
              </>
            ) : (
              'Añadir examen'
            )}
          </button>
        </form>
      </div>

      {/* ── Active exams ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#f1f5f9]">Próximos exámenes</h2>
          <span className="bg-[#6366f1]/20 text-[#6366f1] rounded-full px-2 py-0.5 text-xs font-medium">
            {activeExams.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-[#94a3b8]">Cargando...</p>
        ) : activeExams.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No tienes exámenes próximos"
            description="Añade tu primer examen arriba"
          />
        ) : (
          [...activeExams]
            .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
            .map((exam) => {
              const diff = exam.difficulty ?? 2
              const borderColor = DIFF_COLORS[diff] ?? '#6366f1'
              const days = getDaysRemaining(exam.exam_date)
              const prepHours = exam.estimated_prep_hours ?? 0
              const hoursLogged = exam.hours_logged ?? 0

              return (
                <div
                  key={exam.id}
                  className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5"
                  style={{ borderLeft: `4px solid ${borderColor}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#f1f5f9]">
                      {exam.topic ?? exam.subject}
                    </span>
                    <DaysRemaining days={days} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#94a3b8]">{exam.subject}</span>
                    <DifficultyDots difficulty={diff} />
                  </div>
                  {prepHours > 0 && (
                    <div className="mb-3 space-y-1">
                      <span className="text-xs text-[#94a3b8]">
                        {hoursLogged}h preparadas / {prepHours}h estimadas
                      </span>
                      <ProgressBar
                        value={hoursLogged}
                        max={prepHours}
                        color={borderColor}
                      />
                    </div>
                  )}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => handleStartSession(exam)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-[#1f1f1f] text-[#f1f5f9] text-sm rounded-lg hover:bg-[#222] transition-colors"
                    >
                      📚 Registrar sesión
                    </button>
                    <button
                      onClick={() => handleMarkComplete(exam)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[#94a3b8] text-sm rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      ✓ Completado
                    </button>
                    <button
                      onClick={() => openEdit(exam)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[#94a3b8] text-sm rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      ✏ Editar
                    </button>
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* ── Completed exams ── */}
      {completedExams.length > 0 && (
        <div>
          <button
            onClick={() => setCompletedOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-medium text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
          >
            {completedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Completados ({completedExams.length})
          </button>
          {completedOpen && (
            <div className="mt-3 space-y-2">
              {completedExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 opacity-60"
                >
                  <span className="text-sm text-[#94a3b8] line-through">
                    {exam.topic ?? exam.subject}
                  </span>
                  <span className="text-xs text-[#475569] ml-2">{exam.subject}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editOpen && editExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditOpen(false)}
          />
          <div className="relative bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-[#f1f5f9] mb-4">
              Editar examen
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Título</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Asignatura</label>
                <select
                  value={editForm.subject}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {editForm.subject === 'Otro' && (
                <div className="space-y-1.5">
                  <label className="text-sm text-[#94a3b8]">
                    Asignatura personalizada
                  </label>
                  <input
                    type="text"
                    value={editForm.customSubject}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, customSubject: e.target.value }))
                    }
                    className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Fecha límite</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Dificultad</label>
                <DifficultySelector
                  value={editForm.difficulty}
                  onChange={(v) => setEditForm((f) => ({ ...f, difficulty: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-[#94a3b8]">Notas</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {editSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
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
