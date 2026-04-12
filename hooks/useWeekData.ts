'use client';

import { useMemo } from 'react';
import { format, startOfISOWeek, endOfISOWeek, addDays, subWeeks } from 'date-fns';
import { useSessions } from './useSessions';
import { useActivities } from './useActivities';
import type { Activity, Session } from '@/types/database';

export interface DayStats {
  date: string;
  dayName: string;
  totalSeconds: number;
  sessions: number;
  byActivity: Record<string, number>;
}

export interface ActivityStats {
  activity: Activity;
  totalSeconds: number;
  sessionCount: number;
  goalSeconds: number | null;
  goalPct: number | null;
}

export interface UseWeekDataReturn {
  // Date context
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  weekEndStr: string;
  days: Date[];
  today: string;
  isCurrentWeek: boolean;
  // Raw data
  sessions: Session[];
  activities: Activity[];
  loading: boolean;
  // Aggregated
  weekTotal: number;
  statsByActivity: ActivityStats[];
  statsByDay: DayStats[];
  // Actions
  refetch: () => void;
  createSession: ReturnType<typeof useSessions>['createSession'];
  updateSession: ReturnType<typeof useSessions>['updateSession'];
  deleteSession: ReturnType<typeof useSessions>['deleteSession'];
}

export function useWeekData(weekOffset = 0): UseWeekDataReturn {
  const referenceDate = weekOffset > 0 ? subWeeks(new Date(), weekOffset) : new Date();
  const weekStart = startOfISOWeek(referenceDate);
  const weekEnd = endOfISOWeek(referenceDate);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const isCurrentWeek = weekStartStr === format(startOfISOWeek(new Date()), 'yyyy-MM-dd');

  const {
    sessions,
    loading: sessionsLoading,
    refetch,
    createSession,
    updateSession,
    deleteSession,
  } = useSessions({ from: weekStartStr, to: weekEndStr });

  const { activities, loading: activitiesLoading } = useActivities();

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    // weekStart is a Date — use the stable string as dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekStartStr],
  );

  const weekTotal = useMemo(
    () => sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0),
    [sessions],
  );

  // Per-activity aggregated stats, sorted by total seconds desc
  const statsByActivity = useMemo<ActivityStats[]>(() => {
    const raw: Record<string, { totalSeconds: number; sessionCount: number }> = {};
    for (const s of sessions) {
      if (!raw[s.activity_id]) raw[s.activity_id] = { totalSeconds: 0, sessionCount: 0 };
      raw[s.activity_id].totalSeconds += s.duration_seconds ?? 0;
      raw[s.activity_id].sessionCount += 1;
    }
    return activities
      .filter((a) => raw[a.id] !== undefined)
      .map((a) => {
        const { totalSeconds, sessionCount } = raw[a.id];
        const goalSeconds = a.weekly_goal_hours ? a.weekly_goal_hours * 3600 : null;
        const goalPct = goalSeconds ? Math.min(Math.round((totalSeconds / goalSeconds) * 100), 999) : null;
        return { activity: a, totalSeconds, sessionCount, goalSeconds, goalPct };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [sessions, activities]);

  // Per-day stats across the 7-day window
  const statsByDay = useMemo<DayStats[]>(() => {
    const raw: Record<string, DayStats> = {};
    for (const d of Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))) {
      const ds = format(d, 'yyyy-MM-dd');
      raw[ds] = { date: ds, dayName: format(d, 'EEEE'), totalSeconds: 0, sessions: 0, byActivity: {} };
    }
    for (const s of sessions) {
      if (!raw[s.date]) continue;
      raw[s.date].totalSeconds += s.duration_seconds ?? 0;
      raw[s.date].sessions += 1;
      raw[s.date].byActivity[s.activity_id] = (raw[s.date].byActivity[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    }
    return Object.values(raw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, weekStartStr]);

  return {
    weekStart,
    weekEnd,
    weekStartStr,
    weekEndStr,
    days,
    today,
    isCurrentWeek,
    sessions,
    activities,
    loading: sessionsLoading || activitiesLoading,
    weekTotal,
    statsByActivity,
    statsByDay,
    refetch,
    createSession,
    updateSession,
    deleteSession,
  };
}
