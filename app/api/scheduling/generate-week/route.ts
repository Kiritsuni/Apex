import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfISOWeek, endOfISOWeek, addDays, subWeeks } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  let targetDate = new Date();
  if (body.date) targetDate = new Date(body.date);
  else if (typeof body.weekOffset === 'number' && body.weekOffset > 0)
    targetDate = subWeeks(new Date(), body.weekOffset);

  const weekStart = startOfISOWeek(targetDate);
  const weekEnd = endOfISOWeek(targetDate);
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
      .gte('exam_date', weekStartStr)
      .lte('exam_date', weekEndStr),
  ]);

  const activities = activitiesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const exams = examsRes.data ?? [];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const dow = d.getDay();
    const isMonTue = dow === 1 || dow === 2;
    const isWedFri = dow >= 3 && dow <= 5;
    const isWeekend = dow === 0 || dow === 6;
    let availableFrom: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
    if (isMonTue) availableFrom = USER_SCHEDULE.MON_TUE.earliestAvailable;
    else if (isWedFri) availableFrom = USER_SCHEDULE.WED_FRI.earliestAvailable;
    return {
      date: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'EEEE'),
      availableFrom,
      cutoff: USER_SCHEDULE.defaultCutoff,
      isWeekend,
      hasMarket: !isWeekend,
    };
  });

  const activitiesText = activities.map((a) => {
    const parts: string[] = [`- ${a.name} (${a.category})`];
    if (a.weekly_goal_hours) parts.push(`goal: ${a.weekly_goal_hours}h/wk`);
    if (a.weekly_goal_sessions) parts.push(`goal: ${a.weekly_goal_sessions}×${a.session_duration_hours ?? 1}h sessions`);
    if (a.daily_min_hours) parts.push(`daily min: ${a.daily_min_hours}h`);
    if (a.is_hard_daily_constraint) parts.push('[DAILY REQUIRED]');
    if (a.market_aware) parts.push('[MARKET HOURS ONLY]');
    return parts.join(', ');
  }).join('\n');

  const prompt = `You are a scheduling assistant. Generate a full weekly plan. Return JSON only — no prose.

Week: ${weekStartStr} to ${weekEndStr}

Daily constraints:
${days.map((d) =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}` +
  (d.hasMarket ? `, market ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : ', no market')
).join('\n')}

Activities to schedule:
${activitiesText}

Exams this week:
${exams.length ? exams.map((e) => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

Already tracked this week:
${sessions.length ? sessions.map((s) => `- ${s.activity?.name}: ${Math.round((s.duration_seconds ?? 0) / 60)}min on ${s.date}`).join('\n') : 'Nothing yet'}

Rules:
1. Market-aware activities ONLY during ${MARKET_HOURS.open}–${MARKET_HOURS.close} on weekdays
2. Never schedule past cutoff ${USER_SCHEDULE.defaultCutoff}
3. Put [DAILY REQUIRED] activities on every weekday
4. 15-min buffer between sessions
5. Leave 2h before any exam free
6. Subtract already-tracked time from weekly goals

Return exactly:
{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "string", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "optional string or null" }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a scheduling assistant. Return only valid JSON, no markdown, no explanation.',
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(match ? JSON.parse(match[0]) : { blocks: [] });
  } catch (err) {
    console.error('generate-week error:', err);
    return NextResponse.json({ blocks: [] });
  }
}
