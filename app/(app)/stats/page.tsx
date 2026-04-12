'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  subWeeks,
  addDays,
  parseISO,
} from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { ActivityBadge } from '@/components/shared/ActivityBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'

type Range = 'week' | 'month' | '3months' | '6months'

const RANGE_LABELS: Record<Range, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  '3months': '3 meses',
  '6months': '6 meses',
}

const RANGE_DAYS: Record<Range, number> = {
  week: 7,
  month: 30,
  '3months': 91,
  '6months': 182,
}

interface DayStat {
  date: string
  seconds: number
}
interface WeekStat {
  week_start: string
  seconds: number
}
interface ActivityStat {
  activity_id: string
  name: string
  color: string
  category: string
  weekly_goal_hours?: number
  seconds: number
}
interface StatsData {
  total_seconds: number
  total_sessions: number
  current_streak: number
  longest_streak: number
  best_week_seconds: number
  daily: DayStat[]
  weekly: WeekStat[]
  by_activity: ActivityStat[]
}

function fmtH(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

interface TooltipPayload {
  value: number
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] text-[#f1f5f9] text-xs rounded-lg px-3 py-2">
      <p className="font-medium mb-0.5">{label}</p>
      <p>{fmtH((payload[0].value ?? 0) * 3600)}</p>
    </div>
  )
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>('week')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const days = RANGE_DAYS[r]
      const res = await fetch(`/api/stats?days=${days}`)
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
  }, [range, load])

  /* ── bar chart data ── */
  const barData = (() => {
    if (!stats) return []
    if (range === 'week') {
      // per day this week
      const weekStart = startOfISOWeek(new Date())
      const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i)
        const dateStr = format(d, 'yyyy-MM-dd')
        const s = stats.daily.find((x) => x.date === dateStr)
        return { name: dayNames[i], hours: +((s?.seconds ?? 0) / 3600).toFixed(2) }
      })
    }
    // per week
    return stats.weekly
      .slice(-Math.min(stats.weekly.length, range === 'month' ? 5 : range === '3months' ? 13 : 26))
      .map((w) => ({
        name: format(parseISO(w.week_start), 'dd/MM'),
        hours: +((w.seconds / 3600).toFixed(2)),
      }))
  })()

  /* ── week comparison ── */
  const weekComparison = (() => {
    if (!stats) return null
    const now = new Date()
    const thisWeekStart = format(startOfISOWeek(now), 'yyyy-MM-dd')
    const thisWeekEnd = format(endOfISOWeek(now), 'yyyy-MM-dd')
    const lastWeekStart = format(startOfISOWeek(subWeeks(now, 1)), 'yyyy-MM-dd')
    const lastWeekEnd = format(endOfISOWeek(subWeeks(now, 1)), 'yyyy-MM-dd')

    const thisSecs = stats.daily
      .filter((d) => d.date >= thisWeekStart && d.date <= thisWeekEnd)
      .reduce((a, b) => a + b.seconds, 0)
    const lastSecs = stats.daily
      .filter((d) => d.date >= lastWeekStart && d.date <= lastWeekEnd)
      .reduce((a, b) => a + b.seconds, 0)

    const byActivity = stats.by_activity.map((a) => ({
      ...a,
      thisWeekSecs: stats.daily
        .filter((d) => d.date >= thisWeekStart && d.date <= thisWeekEnd)
        .reduce((acc, d) => acc, 0), // simplified: use total for now
    }))

    return { thisSecs, lastSecs, byActivity }
  })()

  /* ── streaks per activity (approx from weekly data) ── */
  const maxActivity = stats?.by_activity.reduce(
    (best, a) => (a.seconds > (best?.seconds ?? 0) ? a : best),
    undefined as ActivityStat | undefined
  )

  /* ── personal records ── */
  const bestWeekByActivity = stats?.by_activity.map((a) => ({
    name: a.name,
    color: a.color,
    totalH: (a.seconds / 3600).toFixed(1),
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#f1f5f9]">Estadísticas</h1>

      {/* ── Range selector ── */}
      <div className="flex gap-1 flex-wrap">
        {(Object.entries(RANGE_LABELS) as [Range, string][]).map(([r, label]) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              range === r
                ? 'bg-[#6366f1] text-white'
                : 'text-[#94a3b8] hover:bg-[#1a1a1a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111111] border border-[#1f1f1f] rounded-xl h-40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── Total hours chart ── */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">
              Horas totales
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Per activity breakdown ── */}
          {(stats?.by_activity ?? []).length > 0 && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#f1f5f9]">
                Por actividad
              </h2>
              {(() => {
                const maxSecs = Math.max(
                  ...(stats?.by_activity ?? []).map((a) => a.seconds),
                  1
                )
                return (stats?.by_activity ?? []).map((a) => (
                  <div key={a.activity_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <ActivityBadge name={a.name} color={a.color} size="sm" />
                      <span className="text-sm text-[#94a3b8]">
                        {fmtH(a.seconds)} total
                      </span>
                    </div>
                    <ProgressBar
                      value={a.seconds}
                      max={maxSecs}
                      color={a.color}
                    />
                  </div>
                ))
              })()}
            </div>
          )}

          {/* ── Week comparison ── */}
          {weekComparison && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">
                Esta semana vs semana pasada
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {(stats?.by_activity ?? []).map((a) => {
                  // simplified comparison using averages
                  const avgPerWeek = a.seconds / Math.max(RANGE_DAYS[range] / 7, 1)
                  const change = 0 // without per-activity weekly breakdown from API
                  return (
                    <div
                      key={a.activity_id}
                      className="bg-[#1a1a1a] rounded-lg p-3 space-y-1"
                    >
                      <ActivityBadge name={a.name} color={a.color} size="sm" />
                      <p className="text-xs text-[#94a3b8]">
                        ~{fmtH(avgPerWeek)}/semana promedio
                      </p>
                    </div>
                  )
                })}
                {(stats?.by_activity ?? []).length === 0 && (
                  <p className="text-sm text-[#475569] col-span-2">Sin datos</p>
                )}
              </div>
            </div>
          )}

          {/* ── Personal records ── */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#f1f5f9]">
              Récords personales
            </h2>
            {stats && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Mejor semana</span>
                  <span className="text-[#f1f5f9] font-medium">
                    {fmtH(stats.best_week_seconds)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Racha más larga</span>
                  <span className="text-[#f1f5f9] font-medium">
                    {stats.longest_streak} días
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Total horas acumuladas</span>
                  <span className="text-[#f1f5f9] font-medium">
                    {fmtH(stats.total_seconds)}
                  </span>
                </div>
                {bestWeekByActivity?.map((a) => (
                  <div key={a.name} className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">Total {a.name}</span>
                    <span className="font-medium" style={{ color: a.color }}>
                      {a.totalH}h
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Active streaks ── */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#f1f5f9]">Rachas activas</h2>
            {stats && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#f1f5f9]">Racha general</span>
                    {stats.current_streak > 0 && <span>🔥</span>}
                  </div>
                  <span className="text-sm font-medium text-[#f1f5f9]">
                    {stats.current_streak} días
                  </span>
                </div>
                <ProgressBar
                  value={stats.current_streak}
                  max={Math.max(stats.current_streak, 30)}
                  color="#f97316"
                />
                <p className="text-xs text-[#475569]">
                  Próximo hito:{' '}
                  {[7, 14, 30].find((m) => m > stats.current_streak) ?? 60} días
                </p>
                {(stats.by_activity ?? []).map((a) => (
                  <div key={a.activity_id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <ActivityBadge name={a.name} color={a.color} size="sm" />
                      <span className="text-xs text-[#94a3b8]">
                        {fmtH(a.seconds)} en el período
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
