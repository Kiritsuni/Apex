import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfISOWeek, endOfISOWeek, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetDate = body.date ? new Date(body.date) : new Date();

  const weekStart = startOfISOWeek(targetDate);
  const weekEnd = endOfISOWeek(targetDate);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  // Fetch activities and existing sessions for context
  const [activitiesRes, sessionsRes, examsRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('sessions').select('*, activity:activities(name)').eq('user_id', user.id).gte('date', weekStartStr).lte('date', weekEndStr),
    supabase.from('exams').select('*').eq('user_id', user.id).gte('exam_date', weekStartStr).lte('exam_date', weekEndStr),
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
    let availableFrom = '10:00';
    if (isMonTue) availableFrom = USER_SCHEDULE.MON_TUE.earliestAvailable;
    if (isWedFri) availableFrom = USER_SCHEDULE.WED_FRI.earliestAvailable;
    return {
      date: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'EEEE'),
      availableFrom,
      cutoff: USER_SCHEDULE.defaultCutoff,
      isWeekend,
      hasMarket: !isWeekend,
      marketOpen: MARKET_HOURS.open,
      marketClose: MARKET_HOURS.close,
    };
  });

  const prompt = `You are a scheduling assistant creating a weekly plan. Return a JSON object only — no prose.

Week: ${weekStartStr} to ${weekEndStr}

Daily schedule constraints:
${days.map((d) => `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}${d.hasMarket ? `, market ${d.marketOpen}-${d.marketClose}` : ', no market'}`).join('\n')}

Activities to schedule:
${activities.map((a) => {
  let goal = '';
  if (a.weekly_goal_hours) goal = `, goal: ${a.weekly_goal_hours}h/week`;
  if (a.weekly_goal_sessions) goal = `, goal: ${a.weekly_goal_sessions} sessions of ${a.session_duration_hours}h`;
  if (a.daily_min_hours) goal += `, daily min: ${a.daily_min_hours}h`;
  if (a.is_hard_daily_constraint) goal += ' [DAILY REQUIRED]';
  if (a.market_aware) goal += ' [MARKET HOURS ONLY]';
  return `- ${a.name} (${a.category})${goal}`;
}).join('\n')}

Exams this week:
${exams.length ? exams.map((e) => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

Already tracked this week:
${sessions.length ? sessions.map((s) => `- ${s.activity?.name}: ${Math.round((s.duration_seconds ?? 0) / 60)}min on ${s.date}`).join('\n') : 'Nothing yet'}

Rules:
1. Schedule market-aware activities ONLY during market hours (${MARKET_HOURS.open}-${MARKET_HOURS.close}) on weekdays
2. Never schedule past the daily cutoff (${USER_SCHEDULE.defaultCutoff})
3. Prioritize hard daily constraints first
4. Leave some buffer time between sessions
5. Don't schedule on exam mornings (leave 2h before exam free)
6. Account for already-tracked time toward weekly goals

Return this exact JSON structure:
{
  "blocks": [
    {
      "date": "YYYY-MM-DD",
      "activity_name": "string",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "duration_minutes": number,
      "notes": "optional note"
    }
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const schedule = jsonMatch ? JSON.parse(jsonMatch[0]) : { blocks: [] };

    return NextResponse.json(schedule);
  } catch (err) {
    console.error('schedule AI error:', err);
    return NextResponse.json({ blocks: [] });
  }
}
