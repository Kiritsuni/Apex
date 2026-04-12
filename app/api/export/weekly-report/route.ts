import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfISOWeek, endOfISOWeek, addDays, subWeeks } from 'date-fns';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekOffset = Math.max(0, parseInt(searchParams.get('weekOffset') ?? '0', 10) || 0);
  const includeAI = searchParams.get('ai') === 'true';

  const referenceDate = weekOffset > 0 ? subWeeks(new Date(), weekOffset) : new Date();
  const weekStart = startOfISOWeek(referenceDate);
  const weekEnd = endOfISOWeek(referenceDate);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const [sessionsRes, activitiesRes, examsRes, goalsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('*, activity:activities(name, color, category, weekly_goal_hours, weekly_goal_sessions)')
      .eq('user_id', user.id)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .not('duration_seconds', 'is', null)
      .order('started_at', { ascending: true }),
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('exams').select('*').eq('user_id', user.id).gte('exam_date', weekStartStr).lte('exam_date', weekEndStr),
    supabase.from('goals').select('*, activity:activities(name, color)').eq('user_id', user.id),
  ]);

  const sessions = sessionsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const exams = examsRes.data ?? [];
  const goals = goalsRes.data ?? [];

  // ── Per-activity stats ─────────────────────────────────────────────────────
  const activityMap: Record<string, {
    activity_id: string;
    name: string;
    color: string;
    category: string;
    total_seconds: number;
    sessions: number;
    goal_hours: number | null;
    goal_sessions: number | null;
  }> = {};

  for (const s of sessions) {
    const aid = s.activity_id;
    if (!activityMap[aid]) {
      const a = activities.find((act) => act.id === aid);
      activityMap[aid] = {
        activity_id: aid,
        name: s.activity?.name ?? a?.name ?? 'Unknown',
        color: s.activity?.color ?? a?.color ?? '#888',
        category: s.activity?.category ?? a?.category ?? 'other',
        total_seconds: 0,
        sessions: 0,
        goal_hours: a?.weekly_goal_hours ?? null,
        goal_sessions: a?.weekly_goal_sessions ?? null,
      };
    }
    activityMap[aid].total_seconds += s.duration_seconds ?? 0;
    activityMap[aid].sessions += 1;
  }

  const byActivity = Object.values(activityMap)
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .map((a) => {
      const goalPct = a.goal_hours
        ? Math.round((a.total_seconds / (a.goal_hours * 3600)) * 100)
        : a.goal_sessions
          ? Math.round((a.sessions / a.goal_sessions) * 100)
          : null;
      return { ...a, total_hours: (a.total_seconds / 3600).toFixed(2), goal_pct: goalPct };
    });

  // ── Per-day stats ──────────────────────────────────────────────────────────
  const dayMap: Record<string, { date: string; day_name: string; total_seconds: number; sessions: number }> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const ds = format(d, 'yyyy-MM-dd');
    dayMap[ds] = { date: ds, day_name: format(d, 'EEEE'), total_seconds: 0, sessions: 0 };
  }
  for (const s of sessions) {
    if (dayMap[s.date]) {
      dayMap[s.date].total_seconds += s.duration_seconds ?? 0;
      dayMap[s.date].sessions += 1;
    }
  }
  const byDay = Object.values(dayMap);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  // ── Optional AI review ────────────────────────────────────────────────────
  let review: string | null = null;
  if (includeAI) {
    try {
      const statsText = byActivity.map((a) => {
        const goal = a.goal_hours ? ` (goal: ${a.goal_hours}h/wk)` : '';
        return `- ${a.name}: ${a.total_hours}h across ${a.sessions} session(s)${goal}`;
      }).join('\n') || 'No sessions logged';

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: 'You are a concise performance coach. No filler. Just honest analysis.',
        messages: [{
          role: 'user',
          content: `Review week ${weekStartStr} to ${weekEndStr}.\n\nTime tracked:\n${statsText}\n\nExams: ${exams.length ? exams.map((e) => `${e.subject} on ${e.exam_date}`).join(', ') : 'None'}\n\nWrite a brief review: Performance Summary (2-3 sentences), Wins (bullets), Areas to Improve (bullets), Next Week Priorities (3 items).`,
        }],
      });
      review = message.content[0].type === 'text' ? message.content[0].text : null;
    } catch (err) {
      console.error('weekly-report AI error:', err);
    }
  }

  // ── Assemble report ────────────────────────────────────────────────────────
  const report = {
    generated_at: new Date().toISOString(),
    week: { start: weekStartStr, end: weekEndStr },
    summary: {
      total_seconds: totalSeconds,
      total_hours: (totalSeconds / 3600).toFixed(2),
      total_sessions: sessions.length,
    },
    by_activity: byActivity,
    by_day: byDay,
    exams: exams.map(({ user_id: _uid, ...e }) => e),
    goals: goals.map(({ user_id: _uid, ...g }) => g),
    review,
  };

  const filename = `APEX_Report_${weekStartStr}_${weekEndStr}.json`;
  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
