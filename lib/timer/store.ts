'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  sessionId: string | null;
  subLabel: string | null;
  startTime: string | null;
  pausedAt: string | null;
  totalPausedSeconds: number;
  startTimer: (activityId: string, activityName: string, activityColor: string, sessionId: string, subLabel?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  getElapsedSeconds: () => number;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      activityId: null,
      activityName: null,
      activityColor: null,
      sessionId: null,
      subLabel: null,
      startTime: null,
      pausedAt: null,
      totalPausedSeconds: 0,
      startTimer: (activityId, activityName, activityColor, sessionId, subLabel) => set({
        isActive: true, isPaused: false, activityId, activityName, activityColor,
        sessionId, subLabel: subLabel ?? null, startTime: new Date().toISOString(), pausedAt: null, totalPausedSeconds: 0,
      }),
      pauseTimer: () => set({ isPaused: true, pausedAt: new Date().toISOString() }),
      resumeTimer: () => {
        const { pausedAt, totalPausedSeconds } = get();
        if (!pausedAt) return;
        const pausedSeconds = Math.floor((Date.now() - new Date(pausedAt).getTime()) / 1000);
        set({ isPaused: false, pausedAt: null, totalPausedSeconds: totalPausedSeconds + pausedSeconds });
      },
      stopTimer: () => set({
        isActive: false, isPaused: false, activityId: null, activityName: null,
        activityColor: null, sessionId: null, subLabel: null, startTime: null, pausedAt: null, totalPausedSeconds: 0,
      }),
      getElapsedSeconds: () => {
        const { startTime, totalPausedSeconds, isPaused, pausedAt } = get();
        if (!startTime) return 0;
        const now = isPaused && pausedAt ? new Date(pausedAt) : new Date();
        return Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000) - totalPausedSeconds;
      },
    }),
    { name: 'apex-timer' }
  )
);
