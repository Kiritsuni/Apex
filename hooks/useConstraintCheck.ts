'use client';

import { useMemo } from 'react';
import type { Activity, Session } from '@/types/database';

export type ViolationType = 'daily_required' | 'daily_min' | 'weekly_behind';

export interface ConstraintViolation {
  activity: Activity;
  type: ViolationType;
  label: string;
  requiredSeconds: number;
  doneSeconds: number;
  /** Positive number: how many seconds short of the requirement */
  deficitSeconds: number;
}

interface UseConstraintCheckInput {
  activities: Activity[];
  /** Sessions for today only */
  todaySessions: Session[];
  /** Sessions for the entire current week */
  weekSessions: Session[];
}

export interface UseConstraintCheckReturn {
  violations: ConstraintViolation[];
  /** is_hard_daily_constraint violations — highest urgency */
  hardViolations: ConstraintViolation[];
  /** daily_min and weekly_behind violations */
  softViolations: ConstraintViolation[];
  hasViolations: boolean;
}

export function useConstraintCheck({
  activities,
  todaySessions,
  weekSessions,
}: UseConstraintCheckInput): UseConstraintCheckReturn {
  const dayOfWeek = new Date().getDay(); // 0=Sun … 6=Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const violations = useMemo<ConstraintViolation[]>(() => {
    const result: ConstraintViolation[] = [];

    // Aggregate today's seconds per activity
    const todayBy: Record<string, number> = {};
    for (const s of todaySessions) {
      todayBy[s.activity_id] = (todayBy[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    }

    // Aggregate this week's seconds per activity
    const weekBy: Record<string, number> = {};
    for (const s of weekSessions) {
      weekBy[s.activity_id] = (weekBy[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    }

    // Days elapsed in the week (Mon=1…Sun=7 for pace calculation)
    const daysElapsed = dayOfWeek === 0 ? 7 : dayOfWeek;

    for (const activity of activities) {
      const todayDone = todayBy[activity.id] ?? 0;
      const weekDone = weekBy[activity.id] ?? 0;

      // ── Hard daily constraint (weekdays only) ────────────────────────────
      if (activity.is_hard_daily_constraint && isWeekday) {
        const required = (activity.daily_min_hours ?? 1) * 3600;
        if (todayDone < required) {
          result.push({
            activity,
            type: 'daily_required',
            label: `${activity.name} required today`,
            requiredSeconds: required,
            doneSeconds: todayDone,
            deficitSeconds: required - todayDone,
          });
        }
        // Don't double-report as daily_min
        continue;
      }

      // ── Soft daily minimum (weekdays only) ────────────────────────────────
      if (activity.daily_min_hours && isWeekday) {
        const required = activity.daily_min_hours * 3600;
        if (todayDone < required) {
          result.push({
            activity,
            type: 'daily_min',
            label: `${activity.name} below daily minimum`,
            requiredSeconds: required,
            doneSeconds: todayDone,
            deficitSeconds: required - todayDone,
          });
        }
      }

      // ── Weekly goal pace ──────────────────────────────────────────────────
      if (activity.weekly_goal_hours) {
        const weekGoalSeconds = activity.weekly_goal_hours * 3600;
        const expectedByNow = weekGoalSeconds * (daysElapsed / 7);
        const deficit = expectedByNow - weekDone;
        // Only flag if more than 30 min behind pace
        if (deficit > 1800) {
          result.push({
            activity,
            type: 'weekly_behind',
            label: `${activity.name} behind weekly pace`,
            requiredSeconds: weekGoalSeconds,
            doneSeconds: weekDone,
            deficitSeconds: Math.round(deficit),
          });
        }
      }
    }

    return result;
  }, [activities, todaySessions, weekSessions, isWeekday]);

  const hardViolations = useMemo(
    () => violations.filter((v) => v.type === 'daily_required'),
    [violations],
  );
  const softViolations = useMemo(
    () => violations.filter((v) => v.type !== 'daily_required'),
    [violations],
  );

  return {
    violations,
    hardViolations,
    softViolations,
    hasViolations: violations.length > 0,
  };
}
