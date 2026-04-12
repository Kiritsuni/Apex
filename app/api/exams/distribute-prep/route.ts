import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, addDays } from 'date-fns';
import { USER_SCHEDULE } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    title?: string;
    subject?: string;
    due_date?: string;
    difficulty?: number;
    estimated_prep_hours?: number;
    notes?: string;
    // Legacy: examId to distribute for an existing exam
    examId?: string;
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  let examRecord: { id: string; subject: string; topic: string | null; exam_date: string; notes: string | null } | null = null;

  // ── Mode 1: Create new exam from form data ────────────────────────────────
  if (body.title && body.subject && body.due_date) {
    const { data: inserted, error: insertErr } = await supabase
      .from('exams')
      .insert({
        user_id: user.id,
        subject: body.subject,
        topic: body.title,
        exam_date: body.due_date,
        notes: body.notes ?? null,
        status: 'upcoming',
      })
      .select('id, subject, topic, exam_date, notes')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    examRecord = inserted;
  }

  // ── Mode 2: Distribute for existing exams (legacy) ─────────────────────────
  let examsQuery = supabase
    .from('exams')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'upcoming')
    .gte('exam_date', todayStr)
    .order('exam_date', { ascending: true });

  if (examRecord) {
    examsQuery = examsQuery.eq('id', examRecord.id);
  } else if (body.examId) {
    examsQuery = examsQuery.eq('id', body.examId);
  }

  const { data: exams, error: examsErr } = await examsQuery;
  if (examsErr) return NextResponse.json({ error: examsErr.message }, { status: 500 });
  if (!exams?.length) {
    return NextResponse.json({
      exam: examRecord,
      blocks: [],
    });
  }

  // Build schedule window
  const lastExamDate = exams[exams.length - 1].exam_date;
  const today = new Date();
  const lastExam = new Date(lastExamDate + 'T12:00:00');
  const totalDays = Math.max(1, Math.ceil((lastExam.getTime() - today.getTime()) / 86400000) + 1);

  const availableDays = Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(today, i);
    const ds = format(d, 'yyyy-MM-dd');
    const dow = d.getDay();
    const isMonTue = dow === 1 || dow === 2;
    const isWedFri = dow >= 3 && dow <= 5;
    let availableFrom: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
    if (isMonTue) availableFrom = USER_SCHEDULE.MON_TUE.earliestAvailable;
    else if (isWedFri) availableFrom = USER_SCHEDULE.WED_FRI.earliestAvailable;
    return { date: ds, dayName: format(d, 'EEEE'), availableFrom, cutoff: USER_SCHEDULE.defaultCutoff };
  });

  const estimatedPrepHours = body.estimated_prep_hours ?? 5;
  const difficulty = body.difficulty ?? 3;

  const examsText = exams.map((e) => {
    const daysUntil = Math.ceil(
      (new Date(e.exam_date + 'T12:00:00').getTime() - today.getTime()) / 86400000
    );
    return `- ${e.subject}${e.topic ? ` "${e.topic}"` : ''}: exam on ${e.exam_date} (${daysUntil} days away), estimated prep: ${estimatedPrepHours}h, difficulty: ${difficulty}/5`;
  }).join('\n');

  const prompt = `You are an exam preparation scheduler. Distribute study sessions for the following exams across the available days. Return JSON only.

Today: ${todayStr}

Exams:
${examsText}

Available days:
${availableDays.map((d) => `- ${d.dayName} (${d.date}): available ${d.availableFrom}–${d.cutoff}`).join('\n')}

Rules:
1. Distribute prep sessions evenly — avoid cramming the day before
2. Increase intensity closer to exam (more time in final 2 days)
3. Keep sessions 1–2h max
4. Leave exam day itself free
5. Total prep hours across all sessions should approximate the estimated prep hours

Return exactly:
{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "string", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "focus topic" }
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
    const parsed = match ? JSON.parse(match[0]) : { blocks: [] };

    // Optionally create scheduled_blocks in DB (best effort)
    const blocksToCreate = (parsed.blocks ?? []) as Array<{
      date: string;
      activity_name: string;
      start_time: string;
      duration_minutes: number;
      notes: string | null;
    }>;

    // Find or skip activity lookup — just return the blocks for now
    return NextResponse.json({
      exam: examRecord ?? exams[0],
      blocks: blocksToCreate,
    });
  } catch (err) {
    console.error('distribute-prep error:', err);
    return NextResponse.json({
      exam: examRecord ?? (exams[0] ?? null),
      blocks: [],
    });
  }
}
