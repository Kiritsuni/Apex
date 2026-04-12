'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { TrendingUp, Clock, Target, BookCheck, Zap, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useActivities } from '@/hooks/useActivities';
import { useExams } from '@/hooks/useExams';
import { useTimerStore } from '@/lib/timer/store';
import { isMarketOpen } from '@/lib/scheduling/marketHours';
import type { Session } from '@/types/database';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        className="progress-ring-circle"
      />
    </svg>
  );
}

const ONBOARDING_STEPS = [
  { icon: Clock, title: 'Track your time', desc: 'Start the timer for any activity. Sessions are saved automatically.' },
  { icon: Zap, title: 'Manage activities', desc: 'Set weekly goals and daily minimums for each activity.' },
  { icon: Sparkles, title: 'Get AI insights', desc: 'Generate a weekly review or let AI schedule your week.' },
  { icon: Target, title: 'Set goals', desc: 'Track numeric goals and link them to your activities.' },
];

function OnboardingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to APEX</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--text-secondary)]">
          Your personal performance system is ready. Here's what you can do:
        </p>
        <div className="space-y-3 mt-2">
          {ONBOARDING_STEPS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 rounded-[8px] bg-[var(--surface-2)]">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full mt-2">
          Get started
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activities } = useActivities();
  const { upcoming: upcomingExams } = useExams();
  const { isActive, activityName, activityColor, getElapsedSeconds } = useTimerStore();
  const [weekSessions, setWeekSessions] = useState<Session[]>([]);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const marketOpen = isMarketOpen();

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
  const weekEnd = format(endOfISOWeek(new Date()), 'yyyy-MM-dd');

  // Show onboarding dialog once if redirected with ?onboarding=true
  useEffect(() => {
    if (searchParams.get('onboarding') === 'true') {
      setOnboardingOpen(true);
      // Clean up URL without triggering a navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      router.replace(url.pathname + (url.search || ''), { scroll: false });
    }
  }, [searchParams, router]);

  const fetchSessions = useCallback(async () => {
    const [weekRes, todayRes] = await Promise.all([
      fetch(`/api/sessions?from=${weekStart}&to=${weekEnd}`),
      fetch(`/api/sessions?from=${today}&to=${today}`),
    ]);
    if (weekRes.ok) setWeekSessions(await weekRes.json());
    if (todayRes.ok) setTodaySessions(await todayRes.json());
  }, [weekStart, weekEnd, today]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setElapsed(getElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, [isActive, getElapsedSeconds]);

  const weekStatsByActivity: Record<string, number> = {};
  for (const s of weekSessions) {
    weekStatsByActivity[s.activity_id] = (weekStatsByActivity[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const todayTotal = todaySessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
  const weekTotal = weekSessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const nearExams = upcomingExams.slice(0, 3);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in">
      <OnboardingDialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Header */}
      <div>
        <p className="text-[var(--text-muted)] text-sm">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
      </div>

      {/* Active timer banner */}
      {isActive && (
        <Link href="/timer">
          <Card className="p-4 border-[var(--accent)] bg-[var(--accent)]/10 cursor-pointer hover:bg-[var(--accent)]/15 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activityColor ?? '#6366f1' }} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{activityName}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Timer running</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="timer-display text-lg font-bold text-[var(--accent)]">
                  {format(new Date(elapsed * 1000), 'HH:mm:ss').replace(/^00:/, '')}
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
            </div>
          </Card>
        </Link>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Today</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{formatDuration(todayTotal)}</p>
          <p className="text-xs text-[var(--text-secondary)]">{todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">This week</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{formatDuration(weekTotal)}</p>
          <p className="text-xs text-[var(--text-secondary)]">{weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''}</p>
        </Card>
      </div>

      {/* Market status */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">US Market</p>
            <p className="text-xs text-[var(--text-secondary)]">NYSE / NASDAQ · 15:30–22:00</p>
          </div>
        </div>
        <Badge variant={marketOpen ? 'default' : 'secondary'} className={marketOpen ? 'bg-[var(--success)] text-white' : ''}>
          {marketOpen ? 'Open' : 'Closed'}
        </Badge>
      </Card>

      {/* Activity progress this week */}
      {activities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Weekly Progress</h2>
            <Link href="/activities" className="text-xs text-[var(--accent)] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {activities.map((activity) => {
              const done = weekStatsByActivity[activity.id] ?? 0;
              const goalSeconds = (activity.weekly_goal_hours ?? 0) * 3600;
              const pct = goalSeconds > 0 ? done / goalSeconds : 0;
              return (
                <Card key={activity.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <ProgressRing pct={pct} color={activity.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{activity.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {formatDuration(done)}
                        {activity.weekly_goal_hours ? ` / ${activity.weekly_goal_hours}h goal` : ''}
                      </p>
                    </div>
                    {goalSeconds > 0 && (
                      <span className="text-xs font-semibold" style={{ color: pct >= 1 ? 'var(--success)' : activity.color }}>
                        {Math.round(pct * 100)}%
                      </span>
                    )}
                  </div>
                  {goalSeconds > 0 && (
                    <div className="mt-2">
                      <Progress value={Math.min(pct * 100, 100)} className="h-1" style={{ '--progress-color': activity.color } as React.CSSProperties} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming exams */}
      {nearExams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Upcoming Exams</h2>
            <Link href="/exams" className="text-xs text-[var(--accent)] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {nearExams.map((exam) => {
              const daysUntil = Math.ceil((new Date(exam.exam_date).getTime() - new Date(today).getTime()) / 86400000);
              return (
                <Card key={exam.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookCheck className="h-4 w-4 text-[var(--text-secondary)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{exam.subject}</p>
                      {exam.topic && <p className="text-xs text-[var(--text-secondary)]">{exam.topic}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[var(--text-primary)]">{format(new Date(exam.exam_date + 'T12:00:00'), 'MMM d')}</p>
                    <p className="text-xs" style={{ color: daysUntil <= 2 ? 'var(--danger)' : daysUntil <= 5 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Link href="/timer">
          <Card className="p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
            <Clock className="h-5 w-5 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Start Timer</span>
          </Card>
        </Link>
        <Link href="/goals">
          <Card className="p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
            <Target className="h-5 w-5 text-[var(--success)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Goals</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
