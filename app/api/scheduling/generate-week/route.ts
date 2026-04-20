import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfWeek, endOfWeek, addDays, subWeeks } from 'date-fns';
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

  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

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
    let availableFrom: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
    if (isMonTue) availableFrom = USER_SCHEDULE.MON_TUE.earliestAvailable;
    else if (isWedFri) availableFrom = USER_SCHEDULE.WED_FRI.earliestAvailable;
    return { date: format(d, 'yyyy-MM-dd'), dayName: format(d, 'EEEE'), availableFrom, cutoff: '23:30', isWeekend };
  });

  const activitiesText = activities.map((a) => {
    const parts: string[] = [`- ${a.name}`];
    if (a.weekly_goal_hours) parts.push(`goal: ${a.weekly_goal_hours}h/week`);
    if (a.weekly_goal_sessions) parts.push(`goal: ${a.weekly_goal_sessions} sessions of ${a.session_duration_hours ?? 1}h each`);
    if (a.daily_min_hours) parts.push(`daily min: ${a.daily_min_hours}h`);
    if (a.is_hard_daily_constraint) parts.push('[DAILY REQUIRED — every day]');
    if (a.market_aware) parts.push('[INVESTMENTS — weekdays 15:30–22:00 only]');
    return parts.join(', ');
  }).join('\n');

  const systemPrompt = `You are a schedule optimizer for a Spanish student named Adrià, 18 years old, in Girona (Europe/Madrid timezone). Generate a complete weekly schedule as a JSON array of time blocks.

STRICT HARD RULES — violations are rejected:
1. Block duration: minimum 45 minutes, maximum 2.5 hours continuous. Gym sessions are EXACTLY 3h.
2. 15-minute break between consecutive blocks of different activities.
3. NEVER schedule between 14:00–15:00 (lunch) on weekdays, except Gym (3h block).
4. NEVER schedule after 23:30.
5. Investments on WEEKDAYS: ONLY 15:30–22:00 CET. On weekends: any available time.
6. Gym: EXACTLY 3h per session, 4 sessions/week. NEVER same day as Running/MTB.
7. English C1: EVERY day minimum 1h, prefer 1.5h blocks. This is a hard daily requirement.
8. Running/MTB: 1 session, prefer Saturday or Sunday morning.
9. Sunday: lighter day, max 4h total scheduled.
10. Distribute English across ALL 7 days — never skip a day.

OUTPUT FORMAT — valid JSON only, no markdown fences:
{
  "blocks": [
    {
      "activity_name": "string matching activity names exactly",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "duration_minutes": number,
      "notes": "optional context or null"
    }
  ],
  "reasoning": "2-3 sentences explaining distribution strategy"
}`;

  const prompt = `Week: ${weekStartStr} to ${weekEndStr}

Daily availability:
${days.map(d =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff 23:30` +
  (!d.isWeekend ? `, Investments window ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : ', no market constraint')
).join('\n')}

Activities to schedule:
${activitiesText}

Already tracked this week (do not re-schedule):
${sessions.length ? sessions.map(s => `- ${s.activity?.name}: ${Math.round((s.duration_seconds ?? 0) / 60)}min on ${s.date}`).join('\n') : 'Nothing yet'}

Exams this week (leave 2h free before each):
${exams.length ? exams.map(e => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(match ? JSON.parse(match[0]) : { blocks: [] });
  } catch (err) {
    console.error('generate-week error:', err);
    return NextResponse.json({ blocks: [] });
  }
}
