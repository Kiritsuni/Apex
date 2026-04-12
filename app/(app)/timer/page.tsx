'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfISOWeek, endOfISOWeek, subDays, getISODay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pause, Play, Square, X } from 'lucide-react'
import { useActivities } from '@/hooks/useActivities'
import { useTimerStore } from '@/lib/timer/store'
import { useToast } from '@/components/shared/Toast'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { getEnglishSuggestionForDay } from '@/lib/constants'
import type { Activity, Session } from '@/types/database'

// ─── Lucide icon map ──────────────────────────────────────────────────────────
import {
  BookOpen, TrendingUp, Dumbbell, Activity as RunIcon,
  GraduationCap, Zap, Timer, Target, Star, Globe,
  Music, Briefcase, Heart, Code, Pen, Camera, type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, TrendingUp, Dumbbell, Activity: RunIcon, GraduationCap,
  Zap, Timer, Target, Star, Globe, Music, Briefcase, Heart, Code, Pen, Camera,
}

function ActivityIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name] ?? Zap
  return <Icon size={size} style={{ color }} />
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function fmtElapsed(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0 && m > 0) return `${h} hora${h > 1 ? 's' : ''} ${m} minuto${m !== 1 ? 's' : ''}`
  if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`
  return `${m} minuto${m !== 1 ? 's' : ''}`
}

function fmtShort(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function getDateLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return 'Hoy'
  if (date === yesterday) return 'Ayer'
  const raw = format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: es })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Sub Label Sheet ──────────────────────────────────────────────────────────

function SubLabelSheet({
  activity,
  isoDay,
  onClose,
  onStart,
}: {
  activity: Activity
  isoDay: number
  onClose: () => void
  onStart: (label: string) => void
}) {
  const [label, setLabel] = useState('')
  const isEnglish = activity.name === 'English C1'
  const suggestion = isEnglish ? getEnglishSuggestionForDay(isoDay) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-[#111111] border border-[#1f1f1f] rounded-t-2xl md:rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#f1f5f9]">¿Qué vas a estudiar?</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#1a1a1a]">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        {suggestion && (
          <p className="text-xs text-[#94a3b8] bg-[#1a1a1a] rounded-xl px-3 py-2">
            💡 Sugerencia de hoy: <span className="font-semibold text-[#6366f1]">{suggestion}</span>
          </p>
        )}

        <input
          autoFocus
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onStart(label.trim()) }}
          placeholder="Ej: Economía Tema 3, Inglés Writing…"
          className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1]"
        />

        <div className="flex gap-3">
          <button
            onClick={() => onStart('')}
            className="flex-1 py-3 border border-[#1f1f1f] rounded-xl text-sm font-medium text-[#94a3b8] hover:bg-[#1a1a1a] transition-colors"
          >
            Empezar sin etiqueta
          </button>
          <button
            onClick={() => onStart(label.trim())}
            className="flex-1 py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white hover:bg-[#5254cc] transition-colors"
          >
            Empezar →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stop Modal ───────────────────────────────────────────────────────────────

function StopModal({
  elapsed,
  activityName,
  subLabel,
  weeklySeconds,
  weeklyGoalHours,
  onSave,
  onDiscard,
}: {
  elapsed: number
  activityName: string
  subLabel: string | null
  weeklySeconds: number
  weeklyGoalHours?: number
  onSave: (notes: string) => void
  onDiscard: () => void
}) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(notes)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-sm space-y-5">
        <h3 className="text-base font-semibold text-[#f1f5f9]">Resumen de sesión</h3>

        <div>
          <p className="text-2xl font-bold text-[#f1f5f9]">{fmtDuration(elapsed)}</p>
          {subLabel && <p className="text-sm text-[#94a3b8] mt-1">{subLabel}</p>}
        </div>

        {weeklyGoalHours && (
          <p className="text-sm text-[#94a3b8]">
            Esta semana llevas {fmtShort(weeklySeconds)} de {activityName} · objetivo: {weeklyGoalHours}h
          </p>
        )}

        <textarea
          value={notes}
          onChange={e => { if (e.target.value.length <= 200) setNotes(e.target.value) }}
          placeholder="¿Qué trabajaste? (opcional)"
          rows={3}
          className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] resize-none"
        />
        {notes.length > 0 && (
          <p className="text-xs text-[#475569] -mt-3">{notes.length}/200</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar sesión'}
        </button>
        <button
          onClick={onDiscard}
          className="w-full py-2 text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimerPage() {
  const router = useRouter()
  const { activities, loading: actLoading } = useActivities()
  const { toast } = useToast()
  const store = useTimerStore()

  const [elapsed, setElapsed] = useState(0)
  const [showSubLabel, setShowSubLabel] = useState(false)
  const [pendingActivity, setPendingActivity] = useState<Activity | null>(null)
  const [showStopModal, setShowStopModal] = useState(false)
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [weeklySeconds, setWeeklySeconds] = useState(0)

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const isoDay = getISODay(new Date())

  // Fetch recent sessions
  const fetchRecent = useCallback(async () => {
    const from = format(subDays(new Date(), 14), 'yyyy-MM-dd')
    const res = await fetch(`/api/sessions?from=${from}&to=${today}`)
    if (res.ok) setRecentSessions(await res.json())
  }, [today])

  useEffect(() => { fetchRecent() }, [fetchRecent])

  // Fetch weekly sessions for active activity
  useEffect(() => {
    if (!store.activityId) return
    const weekStart = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
    const weekEnd = format(endOfISOWeek(new Date()), 'yyyy-MM-dd')
    fetch(`/api/sessions?from=${weekStart}&to=${weekEnd}&activity_id=${store.activityId}`)
      .then(r => r.json())
      .then((data: Session[]) => {
        const total = data.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
        setWeeklySeconds(total)
      })
      .catch(() => {})
  }, [store.activityId])

  // Timer tick
  useEffect(() => {
    if (!store.isActive) { setElapsed(0); return }
    setElapsed(store.getElapsedSeconds())
    const iv = setInterval(() => setElapsed(store.getElapsedSeconds()), 1000)
    return () => clearInterval(iv)
  }, [store.isActive, store.isPaused, store.getElapsedSeconds])

  // Start timer for an activity
  async function startSession(activity: Activity, subLabel: string) {
    setShowSubLabel(false)
    setPendingActivity(null)
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activity.id }),
      })
      if (!res.ok) throw new Error()
      const { session } = await res.json()
      store.startTimer(activity.id, activity.name, activity.color, session.id, subLabel || null)
    } catch {
      toast('Error al iniciar el temporizador', 'error')
    }
  }

  function handleActivityClick(activity: Activity) {
    if (store.isActive) return
    if (activity.name === 'School Work') {
      setPendingActivity(activity)
      setShowSubLabel(true)
    } else {
      startSession(activity, '')
    }
  }

  async function handleSaveStop(notes: string) {
    if (!store.sessionId) return
    const duration_seconds = store.getElapsedSeconds()
    try {
      const res = await fetch('/api/timer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: store.sessionId, duration_seconds, notes: notes || null }),
      })
      if (!res.ok) throw new Error()
      store.stopTimer()
      setShowStopModal(false)
      toast(`Sesión guardada · ${fmtShort(duration_seconds)}`, 'success')
      fetchRecent()
    } catch {
      toast('Error al guardar la sesión', 'error')
    }
  }

  function handleDiscard() {
    store.stopTimer()
    setShowStopModal(false)
  }

  // Current activity data
  const currentActivity = activities.find(a => a.id === store.activityId)
  const ringColor = currentActivity?.color ?? '#6366f1'
  const plannedSeconds = currentActivity?.session_duration_hours
    ? currentActivity.session_duration_hours * 3600
    : 0
  const ringProgress = plannedSeconds > 0
    ? Math.min((elapsed / plannedSeconds) * 100, 100)
    : ((elapsed % 1800) / 1800) * 100

  // Session history grouped by date
  const groupedSessions: [string, Session[]][] = []
  const seenDates = new Set<string>()
  for (const s of recentSessions.slice(0, 14)) {
    if (!seenDates.has(s.date)) {
      seenDates.add(s.date)
      groupedSessions.push([s.date, recentSessions.filter(r => r.date === s.date)])
    }
  }

  // ── Render: Active state ──
  if (store.isActive) {
    return (
      <div className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center gap-6 px-4 py-8 animate-fade-in">

        {/* Activity info */}
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: ringColor }}>
            {store.activityName}
          </p>
          {store.subLabel && (
            <p className="text-sm text-[#94a3b8] mt-1">{store.subLabel}</p>
          )}
        </div>

        {/* Ring + Timer */}
        <ProgressRing progress={ringProgress} size={280} strokeWidth={8} color={ringColor}>
          <div className="flex flex-col items-center gap-1">
            <span className="timer-display text-[64px] md:text-[72px] font-bold text-[#f1f5f9] leading-none tabular-nums">
              {fmtElapsed(elapsed)}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${store.isPaused ? 'bg-[#94a3b8]' : 'bg-[#22c55e] pulse-dot'}`}
              />
              <span className={`text-xs font-semibold ${store.isPaused ? 'text-[#94a3b8]' : 'text-[#22c55e]'}`}>
                {store.isPaused ? 'EN PAUSA' : 'ACTIVO'}
              </span>
            </div>
          </div>
        </ProgressRing>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => store.isPaused ? store.resumeTimer() : store.pauseTimer()}
            className="flex items-center gap-2 px-6 py-3 min-h-[48px] bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl text-sm font-semibold text-[#f1f5f9] hover:bg-[#222] transition-colors"
          >
            {store.isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}
            {store.isPaused ? 'Reanudar' : 'Pausa'}
          </button>

          <button
            onClick={() => setShowStopModal(true)}
            className="flex items-center gap-2 px-6 py-3 min-h-[48px] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl text-sm font-semibold text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
          >
            <Square size={18} fill="currentColor" />
            Detener y guardar
          </button>
        </div>

        <button
          onClick={() => { store.stopTimer(); router.push('/timer') }}
          className="text-xs text-[#475569] hover:text-[#94a3b8] transition-colors"
        >
          Cambiar actividad
        </button>

        {/* Stop Modal */}
        {showStopModal && (
          <StopModal
            elapsed={elapsed}
            activityName={store.activityName ?? ''}
            subLabel={store.subLabel}
            weeklySeconds={weeklySeconds}
            weeklyGoalHours={currentActivity?.weekly_goal_hours ?? undefined}
            onSave={handleSaveStop}
            onDiscard={handleDiscard}
          />
        )}
      </div>
    )
  }

  // ── Render: Idle state ──
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 pb-24 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Temporizador</h1>
        <p className="text-sm text-[#94a3b8]">¿En qué vas a trabajar?</p>
      </div>

      {/* Activity grid */}
      {actLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-[#111111] border border-[#1f1f1f] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activities.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={() => handleActivityClick(activity)}
            />
          ))}
        </div>
      )}

      {/* Session history */}
      {recentSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">Sesiones recientes</h2>
          <div className="space-y-4">
            {groupedSessions.map(([date, sessions]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-[#475569] uppercase mb-2">
                  {getDateLabel(date, today, yesterday)}
                </p>
                <div className="space-y-1.5">
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 bg-[#111111] border border-[#1f1f1f] rounded-xl"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.activity?.color ?? '#888' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#f1f5f9] truncate">{s.activity?.name ?? 'Actividad'}</p>
                        {s.notes && (
                          <p className="text-xs text-[#475569] truncate">{s.notes}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#f1f5f9]">{fmtShort(s.duration_seconds ?? 0)}</p>
                        <p className="text-xs text-[#475569]">
                          {format(new Date(s.started_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub label sheet */}
      {showSubLabel && pendingActivity && (
        <SubLabelSheet
          activity={pendingActivity}
          isoDay={isoDay}
          onClose={() => { setShowSubLabel(false); setPendingActivity(null) }}
          onStart={label => startSession(pendingActivity, label)}
        />
      )}
    </div>
  )
}

// ─── Activity Card (inner component) ─────────────────────────────────────────

function ActivityCard({ activity, onClick }: { activity: Activity; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 p-5 bg-[#111111] border border-[#1f1f1f] rounded-xl cursor-pointer hover:border-[#6366f1]/50 hover:bg-[#1a1a1a] transition-all duration-200 text-left w-full"
    >
      <ActivityIcon name={activity.icon} size={32} color={activity.color} />
      <div className="flex-1">
        <p className="text-base font-semibold text-[#f1f5f9] leading-tight">{activity.name}</p>
        {activity.weekly_goal_hours && (
          <p className="text-sm text-[#94a3b8] mt-0.5">
            Objetivo: {activity.weekly_goal_hours}h / semana
          </p>
        )}
      </div>
      {activity.weekly_goal_hours && (
        <div className="w-full h-1 bg-[#1f1f1f] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ backgroundColor: activity.color, width: '0%' }}
          />
        </div>
      )}
    </button>
  )
}
