'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  bestWeekSeconds: number;
  todayTracked: boolean;
  totalSeconds: number;
  totalSessions: number;
}

export interface UseStreakReturn extends StreakData {
  loading: boolean;
  refetch: () => void;
}

const DEFAULT: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  bestWeekSeconds: 0,
  todayTracked: false,
  totalSeconds: 0,
  totalSessions: 0,
};

export function useStreak(days = 30): UseStreakReturn {
  const [data, setData] = useState<StreakData>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?days=${days}`);
      if (!res.ok) return;
      const stats = await res.json();

      const today = format(new Date(), 'yyyy-MM-dd');
      const todayTracked = (stats.daily ?? []).some(
        (d: { date: string; seconds: number }) => d.date === today && d.seconds > 0,
      );

      setData({
        currentStreak: stats.current_streak ?? 0,
        longestStreak: stats.longest_streak ?? 0,
        bestWeekSeconds: stats.best_week_seconds ?? 0,
        todayTracked,
        totalSeconds: stats.total_seconds ?? 0,
        totalSessions: stats.total_sessions ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { refetch(); }, [refetch]);

  return { ...data, loading, refetch };
}
