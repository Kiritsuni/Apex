import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfISOWeek, endOfISOWeek, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const weekStart = startOfISOWeek(now);
  const weekEnd = endOfISOWeek(now);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const [activitiesRes, sessionsRes, examsRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase
      .from('sessions')
      .select('*, activity:activities(name)')
      .eq('user_id', user.id)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr),
    supabase
      .from('exams')
      .select('*')
      .eq('user_id', user.id)
      .gte('exam_date', todayStr)
      .lte('exam_date', weekEndStr),
  ]);

  const activities = activitiesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const exams = examsRes.data ?? [];

  // Aggregate progress per activity so far this week
  const doneSeconds: Record<string, number> = {};
  const doneSessions: Record<string, number> = {};
  for (const s of sessions) {
    doneSeconds[s.activity_id] = (doneSeconds[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    doneSessions[s.activity_id] = (doneSessions[s.activity_id] ?? 0) + 1;
  }

  // Remaining days from today (inclusive) through end of week
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const remainingDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter((d) => format(d, 'yyyy-MM-dd') >= todayStr)
    .map((d) => {
      const ds = format(d, 'yyyy-MM-dd');
      const dow = d.getDay();
      const isMonTue = dow === 1 || dow === 2;
      const isWedFri = dow >= 3 && dow <= 5;
      const isWeekend = dow === 0 || dow === 6;
      let scheduleStart: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
      if (isMonTue) scheduleStart = USER_SCHEDULE.MON_TUE.earliestAvailable;
      else if (isWedFri) scheduleStart = USER_SCHEDULE.WED_FRI.earliestAvailable;
      // For today, start from now if later than the normal schedule start
      const availableFrom = ds === todayStr && nowHHMM > scheduleStart ? nowHHMM : scheduleStart;
      return {
        date: ds,
        dayName: format(d, 'EEEE'),
        availableFrom,
        cutoff: USER_SCHEDULE.defaultCutoff,
        isWeekend,
        hasMarket: !isWeekend,
      };
    });

  if (remainingDays.length === 0) {
    return NextResponse.json({ blocks: [] });
  }

  const progressText = activities.map((a) => {
    const done = doneSeconds[a.id] ?? 0;
    const doneH = (done / 3600).toFixed(1);
    const doneSess = doneSessions[a.id] ?? 0;
    const flags = [
      a.is_hard_daily_constraint ? '[DAILY REQUIRED]' : '',
      a.market_aware ? '[MARKET HOURS ONLY]' : '',
    ].filter(Boolean).join(' ');

    if (a.weekly_goal_hours) {
      const remaining = Math.max(0, a.weekly_goal_hours - done / 3600).toFixed(1);
      return `- ${a.name}: ${doneH}h done / ${a.weekly_goal_hours}h goal → ${remaining}h still needed ${flags}`;
    }
    if (a.weekly_goal_sessions) {
      const remaining = Math.max(0, a.weekly_goal_sessions - doneSess);
      return `- ${a.name}: ${doneSess} sessions done / ${a.weekly_goal_sessions} goal → ${remaining} sessions still needed (${a.session_duration_hours ?? 1}h each) ${flags}`;
    }
    return `- ${a.name}: ${doneH}h tracked so far ${flags}`;
  }).join('\n');

  const prompt = `You are a scheduling assistant doing a MID-WEEK reorganization. Only schedule the remaining days below. Return JSON only.

Today: ${todayStr} (${format(now, 'EEEE HH:mm')})
Week ends: ${weekEndStr}

Remaining days to schedule:
${remainingDays.map((d) =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}` +
  (d.hasMarket ? `, market ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : '')
).join('\n')}

Activity progress this week (remaining to hit goals):
${progressText}

Exams remaining this week:
${exams.length ? exams.map((e) => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

Rules:
1. Only output blocks for the listed remaining days
2. Focus on activities with remaining goal hours/sessions
3. Market-aware activities ONLY during ${MARKET_HOURS.open}–${MARKET_HOURS.close} on weekdays
4. Never schedule past ${USER_SCHEDULE.defaultCutoff}
5. Keep [DAILY REQUIRED] on every remaining weekday
6. 15-min buffer between sessions
7. Leave 2h before any exam free

Return exactly:
{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "string", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "optional string or null" }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a scheduling assistant doing a mid-week reorganization. Return only valid JSON, no markdown.',
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(match ? JSON.parse(match[0]) : { blocks: [] });
  } catch (err) {
    console.error('reorganize error:', err);
    return NextResponse.json({ blocks: [] });
  }
}
