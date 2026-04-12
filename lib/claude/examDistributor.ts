import Anthropic from '@anthropic-ai/sdk';
import { USER_SCHEDULE } from '@/lib/constants';
import type { Exam } from '@/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PrepBlock {
  date: string;
  activity_name: string; // the exam subject
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string | null;
}

export interface AvailableDay {
  date: string;
  dayName: string;
  availableFrom: string;
  cutoff: string;
}

export interface ExamDistributorContext {
  exams: Exam[];
  /** Seconds of prep already done per exam subject (subject → seconds) */
  existingPrepSeconds: Record<string, number>;
  availableDays: AvailableDay[];
  today: string; // 'YYYY-MM-DD'
}

function parseBlocks(text: string): PrepBlock[] {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    return parsed?.blocks ?? [];
  } catch {
    return [];
  }
}

/**
 * Distribute exam preparation sessions across the available days before each exam.
 * Returns schedule blocks ordered chronologically.
 */
export async function distributeExamPrep(ctx: ExamDistributorContext): Promise<PrepBlock[]> {
  const { exams, existingPrepSeconds, availableDays, today } = ctx;

  if (!exams.length || !availableDays.length) return [];

  const examsText = exams.map((e) => {
    const alreadyH = ((existingPrepSeconds[e.subject] ?? 0) / 3600).toFixed(1);
    const daysAway = Math.ceil(
      (new Date(e.exam_date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000,
    );
    return (
      `- ${e.subject}${e.topic ? ` (${e.topic})` : ''}: exam on ${e.exam_date} (${daysAway} days away)` +
      (e.notes ? `, notes: ${e.notes}` : '') +
      (parseFloat(alreadyH) > 0 ? `, already studied: ${alreadyH}h` : '')
    );
  }).join('\n');

  const prompt = `You are an exam preparation scheduler. Distribute study sessions for the following exams across the available days. Return JSON only.

Today: ${today}

Upcoming exams:
${examsText}

Available days (${availableDays.length}):
${availableDays.map((d) => `- ${d.dayName} (${d.date}): available ${d.availableFrom}–${d.cutoff}`).join('\n')}

Rules:
1. Spread sessions evenly — no cramming the day before
2. Ramp up intensity in the final 2 days (longer sessions)
3. No prep sessions on the exam day itself
4. Keep individual sessions 1–2 hours maximum
5. Don't schedule two exams' prep on the same exam day
6. Account for already-studied time when sizing remaining sessions
7. Daily cutoff is ${USER_SCHEDULE.defaultCutoff}

Return:
{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "exam subject string", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "what to focus on" }
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: 'You are an exam preparation scheduler. Return only valid JSON, no markdown.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseBlocks(text);
}
