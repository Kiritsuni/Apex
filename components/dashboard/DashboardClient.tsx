'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Plus, X, Check, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { EmptyState } from '@/components/shared/EmptyState'
import { ActivityBadge } from '@/components/shared/ActivityBadge'
import { DaysRemaining } from '@/components/shared/DaysRemaining'
import { useToast } from '@/components/shared/Toast'
import { useTimerStore } from '@/lib/timer/store'
import { MOTIVATIONAL_PHRASES, ABSENCE_TYPES } from '@/lib/constants'
import type { Activity, Exam, Goal, ScheduledBlock } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function blockEndTime(startTime: string, durationMinutes: number): string {
  const [h, mi] = startTime.split(':').map(Number)
  const total = h * 60 + mi + durationMinutes
  const eh = Math.floor(total / 60) % 24
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

function ringColor(pct: number): string {
  if (pct >= 100) return '#22c55e'
  if (pct >= 50) return '#6366f1'
  if (pct >= 25) return '#f59e0b'
  return '#ef4444'
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  activities: Activity[]
  todayBlocks: ScheduledBlock[]
  todayByActivity: Record<string, number>
  weekByActivity: Record<string, number>
  nextExam: Exam | null
  progressiveGoals: Goal[]
  englishStreak: number
  englishActivityId: string | null
  isoDay: number
  userId: string
  userName: string
}

// ─── Quick Log Sheet ──────────────────────────────────────────────────────────

const DURATION_PILLS = [
  { label: '15min', mins: 15 },
  { label: '30min', mins: 30 },
  { label: '45min', mins: 45 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
  { label: '2h', mins: 120 },
]

function QuickLogSheet({
  activities,
  onClose,
  onSaved,
}: {
  activities: Activity[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [activityId, setActivityId] = useState(activities[0]?.id ?? '')
  const [selectedMins, setSelectedMins] = useState(60)
  const [customMins, setCustomMins] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const finalMins = useCustom ? (parseInt(customMins) || 0) : selectedMins

  async function handleSave() {
    if (!activityId || finalMins <= 0) return
    setSaving(true)
    try {
      const startedAt = new Date(`${date}T10:00:00`).toISOString()
      const endedAt = new Date(`${date}T10:00:00`)
      endedAt.setSeconds(endedAt.getSeconds() + finalMins * 60)
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activityId,
          started_at: startedAt,
          ended_at: endedAt.toISOString(),
          duration_seconds: finalMins * 60,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast('Registro guardado', 'success')
      onSaved()
      onClose()
    } catch {
      toast('Error al guardar el registro', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-[#111111] border border-[#1f1f1f] rounded-t-2xl md:rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#f1f5f9]">Registro rápido</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#1a1a1a]">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Actividad</label>
          <div className="space-y-1.5">
            {activities.map(a => (
              <button
                key={a.id}
                onClick={() => setActivityId(a.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  activityId === a.id ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-sm font-medium text-[#f1f5f9]">{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Duración</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PILLS.map(pill => (
              <button
                key={pill.mins}
                onClick={() => { setSelectedMins(pill.mins); setUseCustom(false) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  !useCustom && selectedMins === pill.mins
                    ? 'bg-[#6366f1] border-[#6366f1] text-white'
                    : 'border-[#1f1f1f] text-[#94a3b8] hover:border-[#6366f1]/50'
                }`}
              >
                {pill.label}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useCustom ? 'bg-[#6366f1] border-[#6366f1] text-white' : 'border-[#1f1f1f] text-[#94a3b8] hover:border-[#6366f1]/50'
              }`}
            >
              Personalizado
            </button>
          </div>
          {useCustom && (
            <input
              type="number"
              min={1}
              max={600}
              placeholder="Minutos"
              value={customMins}
              onChange={e => setCustomMins(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Fecha</label>
          <input
            type="date"
            value={date}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="¿Qué trabajaste?"
            rows={2}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !activityId || finalMins <= 0}
          className="w-full bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </div>
    </div>
  )
}

// ─── Absence Sheet ────────────────────────────────────────────────────────────

const MOTIVO_PILLS = [
  { value: 'work', label: 'Trabajo' },
  { value: 'social', label: 'Salida social' },
  { value: 'travel', label: 'Viaje' },
  { value: 'medical', label: 'Médico' },
  { value: 'other', label: 'Otro' },
]

function AbsenceSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [reason, setReason] = useState('other')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: date, reason, start_time: startTime || null, end_time: endTime || null, notes: notes || null }),
      })
      if (!res.ok) throw new Error()
      toast('Ausencia registrada. Tu semana será reorganizada.', 'success')
      onClose()
    } catch {
      toast('Error al guardar la ausencia', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-[#111111] border border-[#1f1f1f] rounded-t-2xl md:rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#f1f5f9]">Añadir ausencia</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#1a1a1a]">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Motivo</label>
          <div className="flex flex-wrap gap-2">
            {MOTIVO_PILLS.map(p => (
              <button
                key={p.value}
                onClick={() => setReason(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  reason === p.value ? 'bg-[#6366f1] border-[#6366f1] text-white' : 'border-[#1f1f1f] text-[#94a3b8] hover:border-[#6366f1]/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-[#94a3b8] font-medium">Hora inicio</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[#94a3b8] font-medium">Hora de vuelta</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              placeholder="¿Cuándo vuelves?"
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !date}
          className="w-full bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar ausencia'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardClient({
  activities,
  todayBlocks,
  todayByActivity,
  weekByActivity,
  nextExam,
  progressiveGoals,
  englishStreak,
  englishActivityId,
  isoDay,
  userId: _userId,
  userName,
}: DashboardClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { startTimer } = useTimerStore()

  const [showEnglishWarning, setShowEnglishWarning] = useState(false)
  const [showFABSheet, setShowFABSheet] = useState(false)
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showAbsence, setShowAbsence] = useState(false)
  const [startingBlock, setStartingBlock] = useState<string | null>(null)
  const [reorganizing, setReorganizing] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    const englishToday = englishActivityId ? (todayByActivity[englishActivityId] ?? 0) : 0
    setShowEnglishWarning(hour >= 18 && englishToday < 3600)
  }, [englishActivityId, todayByActivity])

  // Date display
  const rawDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  const dateDisplay = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)

  // Greeting
  const hour = new Date().getHours()
  const timeOfDay = hour >= 6 && hour < 12 ? 'días' : hour >= 12 && hour < 20 ? 'tardes' : 'noches'

  // Motivational phrase
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const phrase = MOTIVATIONAL_PHRASES[dayOfYear % MOTIVATIONAL_PHRASES.length]

  // English
  const streakColor = englishStreak >= 7 ? '#22c55e' : englishStreak >= 3 ? '#f59e0b' : '#ef4444'
  const englishToday = englishActivityId ? (todayByActivity[englishActivityId] ?? 0) : 0
  const englishPct = Math.min((englishToday / 3600) * 100, 100)

  // Exam
  const nextExamDays = nextExam
    ? Math.max(0, Math.ceil(
        (new Date(nextExam.exam_date + 'T12:00:00').getTime() - new Date(format(new Date(), 'yyyy-MM-dd') + 'T12:00:00').getTime()) / 86400000
      ))
    : null

  // Activities for today progress
  const todayProgressActivities = activities.filter(
    a => (a.daily_min_hours && a.daily_min_hours > 0) || (todayByActivity[a.id] ?? 0) > 0
  )

  // Activities for weekly progress
  const weekProgressActivities = activities.filter(
    a => (a.weekly_goal_hours && a.weekly_goal_hours > 0) || (a.weekly_goal_sessions && a.weekly_goal_sessions > 0)
  )

  async function handleStartBlock(block: ScheduledBlock) {
    if (!block.activity) return
    setStartingBlock(block.id)
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: block.activity_id }),
      })
      if (!res.ok) throw new Error()
      const { session } = await res.json()
      startTimer(block.activity_id, block.activity.name, block.activity.color, session.id)
      router.push('/timer')
    } catch {
      toast('Error al iniciar el temporizador', 'error')
      setStartingBlock(null)
    }
  }

  async function handleReorganize() {
    setReorganizing(true)
    setShowFABSheet(false)
    try {
      const res = await fetch('/api/scheduling/reorganize', { method: 'POST' })
      if (!res.ok) throw new Error()
      toast('Semana reorganizada por IA', 'success')
      router.push('/week')
    } catch {
      toast('Error al reorganizar la semana', 'error')
    } finally {
      setReorganizing(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-24 animate-fade-in">

      {/* ─── Header ─── */}
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">
          Buenos {timeOfDay}, {userName}
        </h1>
        <p className="text-sm text-[#94a3b8] mt-0.5">{dateDisplay}</p>
        <p className="text-xs text-[#475569] italic mt-1">{phrase}</p>
      </div>

      {/* ─── English Streak Banner ─── */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            {englishStreak === 0 ? (
              <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                Inicia tu racha hoy 🔥
              </span>
            ) : (
              <span className="text-sm font-semibold" style={{ color: streakColor }}>
                {englishStreak} {englishStreak === 1 ? 'día consecutivo' : 'días consecutivos'}
                <span className="text-[#94a3b8] font-normal"> · Inglés C1</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[#475569]">{fmtSecs(englishToday)} / 1h</span>
            <div className="w-20">
              <ProgressBar value={englishPct} max={100} color={streakColor} height={4} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── English Constraint Warning ─── */}
      {showEnglishWarning && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#ef4444] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-[#f1f5f9] font-medium">Aún no has completado tu hora de inglés</p>
            <p className="text-xs text-[#94a3b8] mt-0.5">Son las {new Date().getHours()}:00 — el día se acaba</p>
          </div>
          <button
            onClick={() => router.push('/timer')}
            className="text-xs font-semibold text-[#ef4444] hover:underline flex-shrink-0"
          >
            Empezar ahora
          </button>
        </div>
      )}

      {/* ─── Exam Countdown ─── */}
      {nextExam && nextExamDays !== null && nextExamDays <= 14 && (
        <div className="bg-[#111111] border border-[#f59e0b]/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📚</span>
              <div>
                <p className="text-sm font-semibold text-[#f1f5f9]">{nextExam.subject}</p>
                {nextExam.topic && <p className="text-xs text-[#94a3b8]">{nextExam.topic}</p>}
              </div>
            </div>
            <DaysRemaining days={nextExamDays} />
          </div>
        </div>
      )}

      {/* ─── Bloques de hoy ─── */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#f1f5f9]">Plan de hoy</h2>

        {todayBlocks.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No hay bloques para hoy"
            action={
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => router.push('/week')}
                  className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-xl hover:bg-[#5254cc] transition-colors"
                >
                  Generar semana
                </button>
                <button
                  onClick={() => router.push('/week')}
                  className="px-4 py-2 border border-[#1f1f1f] text-[#94a3b8] text-sm font-medium rounded-xl hover:border-[#6366f1]/50 transition-colors"
                >
                  + Añadir bloque
                </button>
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            {todayBlocks.map(block => {
              const activity = block.activity
              const startTime = block.start_time.substring(0, 5)
              const endTime = blockEndTime(block.start_time, block.duration_minutes)
              const isStarting = startingBlock === block.id

              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-[#1f1f1f] transition-opacity ${
                    block.is_completed ? 'opacity-50' : ''
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activity?.color ?? '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-[#f1f5f9] ${block.is_completed ? 'line-through' : ''}`}>
                      {activity?.name ?? 'Actividad'}
                    </p>
                    <p className="text-xs text-[#94a3b8]">{startTime} – {endTime}</p>
                  </div>
                  <span className="text-xs text-[#475569] flex-shrink-0 hidden sm:block">
                    {fmtMins(block.duration_minutes)}
                  </span>
                  {block.is_completed ? (
                    <span className="flex items-center gap-1 text-xs text-[#22c55e] flex-shrink-0">
                      <Check size={14} /> Hecho
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartBlock(block)}
                      disabled={isStarting}
                      className="flex items-center gap-1 text-xs font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      ▶ {isStarting ? 'Iniciando…' : 'Empezar'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {todayBlocks.length > 0 && (
          <button
            onClick={() => router.push('/week')}
            className="w-full text-xs text-[#475569] hover:text-[#94a3b8] transition-colors py-1"
          >
            + Añadir bloque manual
          </button>
        )}
      </div>

      {/* ─── Progreso de hoy ─── */}
      {todayProgressActivities.length > 0 && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[#f1f5f9]">Progreso de hoy</h2>
          <div className="space-y-3">
            {todayProgressActivities.map(a => {
              const doneSecs = todayByActivity[a.id] ?? 0
              const goalSecs = (a.daily_min_hours ?? 0) * 3600
              const pct = goalSecs > 0 ? (doneSecs / goalSecs) * 100 : 100
              const barColor = goalSecs > 0 && doneSecs < goalSecs ? '#ef4444' : a.color

              return (
                <div key={a.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <ActivityBadge name={a.name} color={a.color} size="sm" />
                    <span className="text-xs text-[#94a3b8]">
                      {fmtSecs(doneSecs)}
                      {goalSecs > 0 && ` / ${a.daily_min_hours}h mín`}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(pct, 100)} max={100} color={barColor} height={6} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Progreso semanal ─── */}
      {weekProgressActivities.length > 0 && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[#f1f5f9]">Esta semana</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {weekProgressActivities.map(a => {
              const doneSecs = weekByActivity[a.id] ?? 0
              let pct = 0
              let label = ''

              if (a.weekly_goal_hours && a.weekly_goal_hours > 0) {
                const goalSecs = a.weekly_goal_hours * 3600
                pct = Math.round((doneSecs / goalSecs) * 100)
                label = `${fmtSecs(doneSecs)} / ${a.weekly_goal_hours}h`
              } else if (a.weekly_goal_sessions && a.weekly_goal_sessions > 0) {
                const doneSessionsEst = Math.floor(doneSecs / ((a.session_duration_hours ?? 1) * 3600))
                pct = Math.round((doneSessionsEst / a.weekly_goal_sessions) * 100)
                label = `${doneSessionsEst} / ${a.weekly_goal_sessions} ses.`
              }

              const color = ringColor(pct)

              return (
                <div key={a.id} className="flex flex-col items-center gap-2">
                  <ProgressRing progress={Math.min(pct, 100)} size={80} color={color}>
                    <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                  </ProgressRing>
                  <div className="text-center">
                    <p className="text-xs font-medium text-[#f1f5f9] truncate max-w-[90px]">{a.name}</p>
                    <p className="text-xs text-[#94a3b8]">{label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Objetivos semanales ─── */}
      {progressiveGoals.length > 0 && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#f1f5f9]">Objetivos esta semana</h2>
              <span className="text-[10px] bg-[#6366f1]/20 text-[#6366f1] px-2 py-0.5 rounded-full font-semibold">IA</span>
            </div>
            <Link href="/goals" className="text-xs text-[#6366f1] hover:underline flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {progressiveGoals.slice(0, 5).map(goal => (
              <div key={goal.id} className="flex items-start gap-3">
                <div className="w-4 h-4 rounded border border-[#2a2a2a] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#f1f5f9]">{goal.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FAB (mobile) ─── */}
      <button
        onClick={() => setShowFABSheet(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-[#6366f1] rounded-full shadow-xl flex items-center justify-center hover:bg-[#5254cc] transition-colors"
        aria-label="Acciones rápidas"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* ─── FAB Action Sheet ─── */}
      {showFABSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFABSheet(false)} />
          <div className="relative w-full bg-[#111111] border-t border-[#1f1f1f] rounded-t-2xl pb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
              <span className="text-sm font-semibold text-[#f1f5f9]">Acciones rápidas</span>
              <button onClick={() => setShowFABSheet(false)} className="p-1.5 rounded-lg hover:bg-[#1a1a1a]">
                <X size={18} className="text-[#94a3b8]" />
              </button>
            </div>
            <div className="px-3 py-2 space-y-1">
              {[
                { icon: '▶', label: 'Iniciar Temporizador', action: () => { setShowFABSheet(false); router.push('/timer') } },
                { icon: '⚡', label: 'Registro rápido', action: () => { setShowFABSheet(false); setShowQuickLog(true) } },
                { icon: '📅', label: 'Añadir ausencia', action: () => { setShowFABSheet(false); setShowAbsence(true) } },
                { icon: '🤖', label: 'Reorganizar semana', action: handleReorganize },
                { icon: '➕', label: 'Añadir examen', action: () => { setShowFABSheet(false); router.push('/exams') } },
                { icon: '🎯', label: 'Añadir objetivo', action: () => { setShowFABSheet(false); router.push('/goals') } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.label === 'Reorganizar semana' && reorganizing}
                  className="flex items-center gap-4 w-full px-4 py-3 min-h-[48px] rounded-xl hover:bg-[#1a1a1a] transition-colors text-left"
                >
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span className="text-sm font-medium text-[#f1f5f9]">
                    {item.label === 'Reorganizar semana' && reorganizing ? 'Reorganizando…' : item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Quick Log Sheet ─── */}
      {showQuickLog && (
        <QuickLogSheet
          activities={activities}
          onClose={() => setShowQuickLog(false)}
          onSaved={() => {}}
        />
      )}

      {/* ─── Absence Sheet ─── */}
      {showAbsence && (
        <AbsenceSheet onClose={() => setShowAbsence(false)} />
      )}
    </div>
  )
}
