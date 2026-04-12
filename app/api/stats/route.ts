import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format, subDays, startOfISOWeek } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get('days') ?? '91'), 365);

  const from = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
  const to = format(new Date(), 'yyyy-MM-dd');

  const [sessionsRes, activitiesRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, activity_id, date, duration_seconds, started_at')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .not('duration_seconds', 'is', null)
      .order('date', { ascending: true }),
    supabase
      .from('activities')
      .select('id, name, color, category, weekly_goal_hours')
      .eq('user_id', user.id)
      .order('sort_order'),
  ]);

  const sessions = sessionsRes.data ?? [];
  const activities = activitiesRes.data ?? [];

  // Daily totals map
  const dailyMap: Record<string, number> = {};
  for (const s of sessions) {
    dailyMap[s.date] = (dailyMap[s.date] ?? 0) + (s.duration_seconds ?? 0);
  }

  // Per-activity totals
  const activityMap: Record<string, number> = {};
  for (const s of sessions) {
    activityMap[s.activity_id] = (activityMap[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  // Weekly totals
  const weeklyMap: Record<string, number> = {};
  for (const s of sessions) {
    const weekStart = format(startOfISOWeek(new Date(s.date + 'T12:00:00')), 'yyyy-MM-dd');
    weeklyMap[weekStart] = (weeklyMap[weekStart] ?? 0) + (s.duration_seconds ?? 0);
  }

  // Streak calculation (consecutive days with any tracked time)
  const today = new Date();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let lastHadActivity = false;

  for (let i = 0; i < days; i++) {
    const d = format(subDays(today, i), 'yyyy-MM-dd');
    const hasActivity = (dailyMap[d] ?? 0) > 0;
    if (hasActivity) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      if (i === 0 || lastHadActivity) currentStreak = tempStreak;
    } else {
      if (i === 0) {
        // today has no activity — streak might still be running from yesterday
      } else {
        if (lastHadActivity) {
          tempStreak = 0;
        }
      }
    }
    lastHadActivity = hasActivity;
  }

  // Best week
  const bestWeekSeconds = Math.max(0, ...Object.values(weeklyMap));

  // Total
  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  return NextResponse.json({
    total_seconds: totalSeconds,
    total_sessions: sessions.length,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    best_week_seconds: bestWeekSeconds,
    daily: Object.entries(dailyMap).map(([date, seconds]) => ({ date, seconds })),
    weekly: Object.entries(weeklyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, seconds]) => ({ week_start, seconds })),
    by_activity: activities.map((a) => ({
      activity_id: a.id,
      name: a.name,
      color: a.color,
      category: a.category,
      weekly_goal_hours: a.weekly_goal_hours,
      seconds: activityMap[a.id] ?? 0,
    })).filter((a) => a.seconds > 0),
  });
}
