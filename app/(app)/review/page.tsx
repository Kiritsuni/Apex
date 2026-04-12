'use client'

import { useState, useCallback } from 'react'
import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  subWeeks,
  addDays,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useSessions } from '@/hooks/useSessions'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ActivityBadge } from '@/components/shared/ActivityBadge'
import { EmptyState } from '@/components/shared/EmptyState'

function fmtH(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-[#f1f5f9]">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

function ReviewText({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (trimmed === '') {
      nodes.push(<div key={i} className="h-1.5" />)
      continue
    }
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*[:\s]*$/)
    if (headerMatch) {
      nodes.push(
        <p
          key={i}
          className="text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8] mt-4 first:mt-0"
        >
          {headerMatch[1]}
        </p>
      )
      continue
    }
    const actionMatch = trimmed.match(/^(ACCIÓN\s*\d+:)\s*(.+)/i)
    if (actionMatch) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 mt-1">
          <div className="w-4 h-4 rounded border border-[#6366f1] flex-shrink-0 mt-0.5" />
          <span className="text-sm text-[#f1f5f9] leading-relaxed">
            <span className="font-semibold text-[#6366f1]">{actionMatch[1]}</span>{' '}
            {renderInline(actionMatch[2])}
          </span>
        </div>
      )
      continue
    }
    if (/^[-•]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•]\s+/, '')
      nodes.push(
        <div key={i} className="flex items-start gap-2">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#6366f1] flex-shrink-0" />
          <span className="text-sm text-[#94a3b8] leading-relaxed">
            {renderInline(content)}
          </span>
        </div>
      )
      continue
    }
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      nodes.push(
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs font-bold text-[#6366f1] flex-shrink-0 w-4 text-right mt-0.5">
            {numMatch[1]}.
          </span>
          <span className="text-sm text-[#94a3b8] leading-relaxed">
            {renderInline(numMatch[2])}
          </span>
        </div>
      )
      continue
    }
    nodes.push(
      <p key={i} className="text-sm text-[#94a3b8] leading-relaxed">
        {renderInline(trimmed)}
      </p>
    )
  }
  return <div className="space-y-1">{nodes}</div>
}

function parseScore(text: string): number | null {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*\/\s*10\b/)
  if (match) return Math.min(10, Math.max(0, parseFloat(match[1])))
  return null
}

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444'
  const r = 32
  const circ = 2 * Math.PI * r
  const dash = (score / 10) * circ
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg width="80" height="80" className="block -rotate-90">
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke="#1f1f1f"
          strokeWidth={8}
        />
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[#f1f5f9]">{score.toFixed(1)}</span>
        <span className="text-[10px] text-[#475569]">/10</span>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [review, setReview] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const { toast } = useToast()

  const referenceDate =
    weekOffset > 0 ? subWeeks(new Date(), weekOffset) : new Date()
  const weekStart = startOfISOWeek(referenceDate)
  const weekEnd = endOfISOWeek(referenceDate)
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
  const isCurrentWeek = weekOffset === 0

  const { sessions, loading: sessionsLoading } = useSessions({
    from: weekStartStr,
    to: weekEndStr,
  })
  const { activities, loading: activitiesLoading } = useActivities()
  const isLoading = sessionsLoading || activitiesLoading

  /* ── aggregate stats ── */
  const byActivity: Record<
    string,
    { name: string; color: string; secs: number; sessions: number; goalHours?: number }
  > = {}
  for (const s of sessions) {
    const a = activities.find((x) => x.id === s.activity_id)
    if (!byActivity[s.activity_id]) {
      byActivity[s.activity_id] = {
        name: a?.name ?? 'Desconocida',
        color: a?.color ?? '#888',
        secs: 0,
        sessions: 0,
        goalHours: a?.weekly_goal_hours,
      }
    }
    byActivity[s.activity_id].secs += s.duration_seconds ?? 0
    byActivity[s.activity_id].sessions += 1
  }
  const sortedActivity = Object.values(byActivity).sort((a, b) => b.secs - a.secs)
  const totalSecs = sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)

  /* ── english compliance ── */
  const englishActivity = activities.find(
    (a) => a.name.toLowerCase().includes('english') || a.name.toLowerCase().includes('inglés')
  )
  const HOUR_IN_S = 3600
  const englishDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const isFuture = d > new Date()
    const daySecs = sessions
      .filter(
        (s) =>
          s.date === dateStr &&
          s.activity_id === englishActivity?.id
      )
      .reduce((a, s) => a + (s.duration_seconds ?? 0), 0)
    return { dateStr, isFuture, met: !isFuture && daySecs >= HOUR_IN_S }
  })
  const englishMetDays = englishDays.filter((d) => d.met).length

  /* ── score ── */
  const localScore = (() => {
    const withGoals = sortedActivity.filter((a) => a.goalHours)
    if (withGoals.length === 0) return null
    const avg =
      withGoals.reduce(
        (acc, a) =>
          acc + Math.min((a.secs / (a.goalHours! * HOUR_IN_S)) * 10, 10),
        0
      ) / withGoals.length
    return +avg.toFixed(1)
  })()

  const parsedScore = review ? parseScore(review) : null
  const score = parsedScore ?? localScore

  /* ── gym sessions ── */
  const gymActivity = activities.find((a) => a.name.toLowerCase().includes('gym'))
  const gymSessions = sessions.filter((s) => s.activity_id === gymActivity?.id).length

  /* ── stat cards ── */
  const statCards = [
    { label: 'Total horas', value: fmtH(totalSecs) },
    { label: 'Racha inglés', value: `${englishMetDays}/7 días` },
    { label: 'Sesiones gym', value: String(gymSessions) },
    { label: 'Sesiones total', value: String(sessions.length) },
  ]

  const generateReview = useCallback(async () => {
    setGenerating(true)
    setReview('')
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekOffset }),
      })
      if (!res.ok || !res.body) {
        toast('Error al generar review.', 'error')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setReview(text)
      }
      setGeneratedAt(new Date())
    } catch {
      toast('Error al generar review.', 'error')
    } finally {
      setGenerating(false)
    }
  }, [weekOffset, toast])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* ── Header + week nav ── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Review semanal</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setWeekOffset((o) => o + 1)
              setReview('')
            }}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#94a3b8] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#94a3b8] whitespace-nowrap">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')}
          </span>
          <button
            onClick={() => {
              setWeekOffset((o) => Math.max(0, o - 1))
              setReview('')
            }}
            disabled={isCurrentWeek}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#94a3b8] transition-colors disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Generate button ── */}
      {!review && !generating && (
        <EmptyState
          icon="📊"
          title="No hay review para esta semana"
          description="Genera tu review semanal para ver tu análisis"
          action={
            <button
              onClick={generateReview}
              className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Generar review
            </button>
          }
        />
      )}

      {(generating || review || !isLoading) && (
        <>
          {/* ── Stats grid ── */}
          {!isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCards.map((c) => (
                <div
                  key={c.label}
                  className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 text-center"
                >
                  <p className="text-2xl font-bold text-[#f1f5f9]">{c.value}</p>
                  <p className="text-xs text-[#94a3b8] mt-1">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Per activity performance ── */}
          {!isLoading && sortedActivity.length > 0 && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#f1f5f9]">
                Rendimiento por actividad
              </h2>
              {sortedActivity.map((a) => {
                const pct = a.goalHours
                  ? Math.min(a.secs / (a.goalHours * HOUR_IN_S), 1)
                  : null
                const pctColor =
                  pct === null
                    ? '#6366f1'
                    : pct >= 1
                    ? '#22c55e'
                    : pct >= 0.5
                    ? '#6366f1'
                    : pct >= 0.25
                    ? '#f59e0b'
                    : '#ef4444'
                return (
                  <div key={a.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <ActivityBadge name={a.name} color={a.color} size="sm" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#94a3b8]">
                          {fmtH(a.secs)}
                          {a.goalHours ? ` / ${a.goalHours}h objetivo` : ''}
                        </span>
                        {pct !== null && (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{ color: pctColor, backgroundColor: pctColor + '20' }}
                          >
                            {Math.round(pct * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {pct !== null && (
                      <ProgressBar
                        value={a.secs}
                        max={a.goalHours! * HOUR_IN_S}
                        color={pctColor}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── English compliance ── */}
          {!isLoading && englishActivity && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#f1f5f9] mb-3">
                Cumplimiento de inglés
              </h2>
              <p className="text-sm text-[#94a3b8] mb-3">
                {englishMetDays}/7 días cumpliste el mínimo de 1 hora de inglés
              </p>
              <div className="flex gap-2">
                {englishDays.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{
                        backgroundColor: d.isFuture
                          ? '#1f1f1f'
                          : d.met
                          ? '#22c55e'
                          : '#ef4444',
                      }}
                    />
                    <span className="text-[10px] text-[#475569]">
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Analysis card ── */}
          {(review || generating) && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
              {generating && !review ? (
                <div className="flex items-center gap-3 text-sm text-[#94a3b8]">
                  <Loader2 size={16} className="animate-spin" />
                  Generando análisis...
                </div>
              ) : (
                <>
                  {score !== null && (
                    <div className="flex items-center gap-4 mb-4">
                      <ScoreCircle score={score} />
                      <div>
                        <p className="text-sm font-semibold text-[#f1f5f9]">
                          Puntuación semanal
                        </p>
                        <p className="text-xs text-[#475569]">
                          {score >= 8
                            ? 'Semana excelente'
                            : score >= 5
                            ? 'Semana correcta'
                            : 'Semana por mejorar'}
                        </p>
                      </div>
                    </div>
                  )}
                  <ReviewText text={review} />
                  {generatedAt && (
                    <p className="text-xs text-[#475569] mt-4">
                      Generado el{' '}
                      {generatedAt.toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Generate / regenerate button ── */}
      {(review || generating || (!isLoading && sessions.length > 0)) && (
        <button
          onClick={generateReview}
          disabled={generating || isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generando...
            </>
          ) : review ? (
            'Regenerar review'
          ) : (
            'Generar review'
          )}
        </button>
      )}
    </div>
  )
}
