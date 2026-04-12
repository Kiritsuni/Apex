import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch upcoming exams — optionally filtered to a single one
  let examsQuery = supabase
    .from('exams')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'upcoming')
    .gte('exam_date', todayStr)
    .order('exam_date', { ascending: true });

  if (body.examId) examsQuery = examsQuery.eq('id', body.examId);

  const { data: exams, error: examsErr } = await examsQuery;
  if (examsErr) return NextResponse.json({ error: examsErr.message }, { status: 500 });
  if (!exams?.length) return NextResponse.json({ blocks: [] });

  // Fetch existing sessions for the exam subjects to gauge prep already done
  const { data: sessions } = await supabase
    .from('sessions')
    .select('date, duration_seconds, activity:activities(name)')
    .eq('user_id', user.id)
    .gte('date', todayStr);

  const existingPrep: Record<string, number> = {};
  for (const s of sessions ?? []) {
    const name = (s.activity as unknown as { name: string } | null)?.name ?? '';
    existingPrep[name] = (existingPrep[name] ?? 0) + (s.duration_seconds ?? 0);
  }

  // Build a schedule window: today through the latest exam date
  const lastExamDate = exams[exams.length - 1].exam_date;
  const today = new Date();
  const lastExam = new Date(lastExamDate + 'T12:00:00');
  const totalDays = Math.ceil((lastExam.getTime() - today.getTime()) / 86400000) + 1;

  const daysUntilExam = exams.map((e) => {
    const examDate = new Date(e.exam_date + 'T12:00:00');
    return Math.ceil((examDate.getTime() - today.getTime()) / 86400000);
  });

  const availableDays = Array.from({ length: Math.max(1, totalDays) }, (_, i) => {
    const d = addDays(today, i);
    const ds = format(d, 'yyyy-MM-dd');
    const dow = d.getDay();
    const isMonTue = dow === 1 || dow === 2;
    const isWedFri = dow >= 3 && dow <= 5;
    const isWeekend = dow === 0 || dow === 6;
    let availableFrom: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
    if (isMonTue) availableFrom = USER_SCHEDULE.MON_TUE.earliestAvailable;
    else if (isWedFri) availableFrom = USER_SCHEDULE.WED_FRI.earliestAvailable;
    return { date: ds, dayName: format(d, 'EEEE'), availableFrom, cutoff: USER_SCHEDULE.defaultCutoff, isWeekend };
  });

  const examsText = exams.map((e, i) => {
    const already = existingPrep[e.subject] ?? 0;
    const alreadyH = (already / 3600).toFixed(1);
    return `- ${e.subject}${e.topic ? ` (${e.topic})` : ''}: exam on ${e.exam_date} (${daysUntilExam[i]} days away)` +
      (e.notes ? `, notes: ${e.notes}` : '') +
      (already > 0 ? `, already studied: ${alreadyH}h` : '');
  }).join('\n');

  const prompt = `You are an exam preparation scheduler. Distribute study sessions for the following exams across the available days. Return JSON only.

Today: ${todayStr}

Upcoming exams:
${examsText}

Available days (${availableDays.length}):
${availableDays.map((d) => `- ${d.dayName} (${d.date}): available ${d.availableFrom}–${d.cutoff}`).join('\n')}

Rules:
1. Distribute prep sessions evenly — avoid cramming everything the day before
2. Increase intensity closer to the exam (more time in the final 2 days)
3. Leave the morning of the exam free (no prep sessions on exam day itself)
4. Keep sessions 1–2 hours max — diminishing returns beyond that
5. Don't schedule other exams' prep on the day of an exam
6. Account for already-studied time when sizing remaining sessions

Return exactly:
{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "string (exam subject)", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "what to focus on" }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an exam preparation scheduler. Return only valid JSON, no markdown.',
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(match ? JSON.parse(match[0]) : { blocks: [] });
  } catch (err) {
    console.error('distribute-prep error:', err);
    return NextResponse.json({ blocks: [] });
  }
}
