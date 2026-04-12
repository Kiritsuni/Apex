'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTimerStore } from '@/lib/timer/store';
import type { Activity, Session } from '@/types/database';

export interface UseTimerReturn {
  // State
  isActive: boolean;
  isPaused: boolean;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  sessionId: string | null;
  elapsed: number; // seconds
  // Loading
  starting: boolean;
  stopping: boolean;
  // Actions
  start: (activity: Activity) => Promise<Session | undefined>;
  pause: () => void;
  resume: () => void;
  stop: (notes?: string) => Promise<Session | undefined>;
}

export function useTimer(): UseTimerReturn {
  const store = useTimerStore();
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Tick every second while the timer is running
  useEffect(() => {
    if (!store.isActive) {
      setElapsed(0);
      return;
    }
    setElapsed(store.getElapsedSeconds());
    const interval = setInterval(() => setElapsed(store.getElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, [store.isActive, store.isPaused, store.getElapsedSeconds]);

  const start = useCallback(async (activity: Activity): Promise<Session | undefined> => {
    if (store.isActive) return;
    setStarting(true);
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activity.id }),
      });
      if (!res.ok) throw new Error('Failed to start session');
      const { session } = await res.json() as { session: Session };
      store.startTimer(activity.id, activity.name, activity.color, session.id);
      return session;
    } finally {
      setStarting(false);
    }
  }, [store]);

  const stop = useCallback(async (notes?: string): Promise<Session | undefined> => {
    if (!store.sessionId) return;
    setStopping(true);
    const duration_seconds = store.getElapsedSeconds();
    try {
      const res = await fetch('/api/timer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: store.sessionId, duration_seconds, notes: notes ?? null }),
      });
      if (!res.ok) throw new Error('Failed to stop session');
      const { session } = await res.json() as { session: Session };
      store.stopTimer();
      return session;
    } finally {
      setStopping(false);
    }
  }, [store]);

  return {
    isActive: store.isActive,
    isPaused: store.isPaused,
    activityId: store.activityId,
    activityName: store.activityName,
    activityColor: store.activityColor,
    sessionId: store.sessionId,
    elapsed,
    starting,
    stopping,
    start,
    pause: store.pauseTimer,
    resume: store.resumeTimer,
    stop,
  };
}
