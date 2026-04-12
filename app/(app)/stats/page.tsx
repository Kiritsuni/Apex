'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfISOWeek, addDays, parseISO } from 'date-fns';
import { TrendingUp, Flame, Calendar, Clock, BarChart2, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface DayStat { date: string; seconds: number }
interface WeekStat { week_start: string; seconds: number }
interface ActivityStat {
  activity_id: string;
  name: string;
  color: string;
  category: string;
  weekly_goal_hours?: number;
  seconds: number;
}
interface StatsData {
  total_seconds: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  best_week_seconds: number;
  daily: DayStat[];
  weekly: WeekStat[];
  by_activity: ActivityStat[];
}

function formatDuration(s: number, compact = false): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (compact) return h > 0 ? `${h}h` : `${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function ActivityHeatmap({ daily }: { daily: DayStat[] }) {
  const WEEKS = 16;
  const CELL = 13;
  const GAP = 2;
  const STEP = CELL + GAP;

  const today = new Date();
  const dailyMap: Record<string, number> = {};
  for (const d of daily) dailyMap[d.date] = d.seconds;

  // max for colour scaling
  const maxSecs = Math.max(...Object.values(dailyMap), 1);

  // Build grid: columns = weeks (oldest left), rows = Mon-Sun
  const gridStart = startOfISOWeek(subDays(today, (WEEKS - 1) * 7));
  const cells: { x: number; y: number; date: string; seconds: number }[] = [];

  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      if (date > today) continue;
      const dateStr = format(date, 'yyyy-MM-dd');
      cells.push({ x: w * STEP, y: d * STEP, date: dateStr, seconds: dailyMap[dateStr] ?? 0 });
    }
  }

  // Month labels
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const d = addDays(gridStart, w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ x: w * STEP, label: format(d, 'MMM') });
      lastMonth = m;
    }
  }

  const W = WEEKS * STEP;
  const H = 7 * STEP + 20; // extra for month labels

  function intensityColor(seconds: number): string {
    if (seconds === 0) return 'var(--surface-2)';
    const ratio = Math.min(seconds / Math.max(maxSecs * 0.8, 3600), 1);
    const opacity = 0.2 + ratio * 0.8;
    return `rgba(99, 102, 241, ${opacity})`;
  }

  const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  return (
    <div className="overflow-x-auto">
      <svg width={W + 32} height={H} className="block">
        {/* Day labels */}
        {DAY_LABELS.map((label, i) => label && (
          <text
            key={i}
            x={28}
            y={20 + i * STEP + CELL / 2 + 1}
            textAnchor="end"
            fontSize="9"
            fill="var(--text-muted)"
            dominantBaseline="middle"
          >
            {label}
          </text>
        ))}
        {/* Month labels */}
        {monthLabels.map((ml) => (
          <text
            key={ml.label + ml.x}
            x={32 + ml.x}
            y={10}
            fontSize="9"
            fill="var(--text-muted)"
          >
            {ml.label}
          </text>
        ))}
        {/* Cells */}
        {cells.map((cell) => (
          <rect
            key={cell.date}
            x={32 + cell.x}
            y={20 + cell.y}
            width={CELL}
            height={CELL}
            rx={2}
            fill={intensityColor(cell.seconds)}
            aria-label={`${cell.date}: ${formatDuration(cell.seconds)}`}
          >
            <title>{cell.date}: {formatDuration(cell.seconds)}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────
function WeeklyBarChart({ weekly }: { weekly: WeekStat[] }) {
  const last8 = weekly.slice(-8);
  if (last8.length === 0) return <p className="text-xs text-[var(--text-muted)]">No data</p>;

  const maxSecs = Math.max(...last8.map((w) => w.seconds), 1);
  const BAR_W = 28;
  const GAP = 8;
  const H = 100;
  const TOTAL_W = last8.length * (BAR_W + GAP);

  return (
    <div className="overflow-x-auto">
      <svg width={TOTAL_W} height={H + 30} className="block">
        {last8.map((w, i) => {
          const barH = Math.max(2, (w.seconds / maxSecs) * H);
          const x = i * (BAR_W + GAP);
          const label = format(parseISO(w.week_start), 'M/d');
          return (
            <g key={w.week_start}>
              <rect
                x={x}
                y={H - barH}
                width={BAR_W}
                height={barH}
                rx={3}
                fill="var(--accent)"
                opacity={i === last8.length - 1 ? 1 : 0.6}
              >
                <title>{w.week_start}: {formatDuration(w.seconds)}</title>
              </rect>
              <text
                x={x + BAR_W / 2}
                y={H + 14}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-muted)"
              >
                {label}
              </text>
              {w.seconds > 0 && (
                <text
                  x={x + BAR_W / 2}
                  y={H - barH - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--text-secondary)"
                >
                  {formatDuration(w.seconds, true)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function ActivityDonut({ byActivity }: { byActivity: ActivityStat[] }) {
  const total = byActivity.reduce((acc, a) => acc + a.seconds, 0);
  if (total === 0) return <p className="text-xs text-[var(--text-muted)]">No data</p>;

  const SIZE = 120;
  const R = 48;
  const STROKE = 16;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const circ = 2 * Math.PI * R;

  let offset = 0;
  const segments = byActivity.map((a) => {
    const pct = a.seconds / total;
    const seg = { ...a, pct, offset, dash: pct * circ };
    offset += pct * circ;
    return seg;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={SIZE} height={SIZE} className="shrink-0">
        {segments.map((seg) => (
          <circle
            key={seg.activity_id}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE}
            strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
            strokeDashoffset={circ / 4 - seg.offset}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          >
            <title>{seg.name}: {formatDuration(seg.seconds)}</title>
          </circle>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fill="var(--text-muted)" dominantBaseline="middle">
          Total
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="12" fill="var(--text-primary)" fontWeight="600" dominantBaseline="middle">
          {formatDuration(total)}
        </text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {byActivity.map((a) => (
          <div key={a.activity_id} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">{a.name}</span>
            <span className="text-xs font-medium text-[var(--text-primary)] shrink-0">{formatDuration(a.seconds)}</span>
            <span className="text-xs text-[var(--text-muted)] w-9 text-right shrink-0">
              {Math.round((a.seconds / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'28' | '91' | '365'>('91');

  const load = useCallback(async (days: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?days=${days}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const summaryCards = [
    {
      label: 'Total Time',
      value: stats ? formatDuration(stats.total_seconds) : '—',
      icon: Clock,
      color: 'var(--accent)',
    },
    {
      label: 'Sessions',
      value: stats ? String(stats.total_sessions) : '—',
      icon: Zap,
      color: 'var(--success)',
    },
    {
      label: 'Current Streak',
      value: stats ? `${stats.current_streak}d` : '—',
      icon: Flame,
      color: '#f97316',
    },
    {
      label: 'Best Week',
      value: stats ? formatDuration(stats.best_week_seconds) : '—',
      icon: TrendingUp,
      color: 'var(--warning)',
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Statistics</h1>
          <p className="text-[var(--text-secondary)] text-sm">Your performance over time</p>
        </div>
        <div className="flex rounded-[6px] overflow-hidden border border-[var(--border)]">
          {(['28', '91', '365'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {r === '28' ? '4w' : r === '91' ? '13w' : '1y'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: card.color }} />
                <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{card.label}</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="heatmap">
        <TabsList className="w-full">
          <TabsTrigger value="heatmap" className="flex-1 gap-1.5">
            <Calendar className="h-3.5 w-3.5" />Activity
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" />Weekly
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="flex-1 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4">
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Activity Heatmap — last {range === '28' ? '4' : range === '91' ? '13' : '52'} weeks
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4" />)}
              </div>
            ) : (
              <ActivityHeatmap daily={stats?.daily ?? []} />
            )}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-[var(--text-muted)]">Less</span>
              {[0, 0.2, 0.4, 0.7, 1].map((o) => (
                <div
                  key={o}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: o === 0 ? 'var(--surface-2)' : `rgba(99,102,241,${o})` }}
                />
              ))}
              <span className="text-[10px] text-[var(--text-muted)]">More</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Hours per week
            </h2>
            {loading ? (
              <Skeleton className="h-32" />
            ) : (
              <WeeklyBarChart weekly={stats?.weekly ?? []} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4">
              Time by activity
            </h2>
            {loading ? (
              <Skeleton className="h-32" />
            ) : (
              <ActivityDonut byActivity={stats?.by_activity ?? []} />
            )}
          </Card>

          {/* Per-activity goal progress */}
          {!loading && (stats?.by_activity ?? []).length > 0 && (
            <Card className="p-4 mt-3 space-y-3">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                Weekly goal pace
              </h2>
              {(stats?.by_activity ?? [])
                .filter((a) => a.weekly_goal_hours)
                .map((a) => {
                  const weeksInRange = range === '28' ? 4 : range === '91' ? 13 : 52;
                  const goalTotal = (a.weekly_goal_hours ?? 0) * weeksInRange * 3600;
                  const pct = goalTotal > 0 ? Math.min(a.seconds / goalTotal, 1) : 0;
                  return (
                    <div key={a.activity_id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        <span className="text-xs text-[var(--text-secondary)] flex-1">{a.name}</span>
                        <span className="text-xs font-medium" style={{ color: pct >= 1 ? 'var(--success)' : a.color }}>
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct * 100}%`, backgroundColor: a.color }}
                        />
                      </div>
                    </div>
                  );
                })}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Streak info */}
      {!loading && stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Flame className="h-4 w-4" style={{ color: '#f97316' }} />
              <span className="text-xs font-medium uppercase tracking-wide">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.current_streak} <span className="text-sm font-normal text-[var(--text-secondary)]">days</span></p>
          </Card>
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <TrendingUp className="h-4 w-4" style={{ color: 'var(--warning)' }} />
              <span className="text-xs font-medium uppercase tracking-wide">Best Streak</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.longest_streak} <span className="text-sm font-normal text-[var(--text-secondary)]">days</span></p>
          </Card>
        </div>
      )}
    </div>
  );
}
