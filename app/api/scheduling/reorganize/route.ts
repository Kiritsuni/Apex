import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Zod schema ───────────────────────────────────────────────────────────────

const BlockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  activity_name: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'start_time must be HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'end_time must be HH:MM'),
  duration_minutes: z.number().int().positive(),
  notes: z.string().nullable().optional(),
});

const AIResponseSchema = z.object({
  blocks: z.array(BlockSchema),
  reasoning: z.string().optional(),
});

type AIBlock = z.infer<typeof BlockSchema>;

// ─── Helper: call Claude ──────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userPrompt: string): Promise<AIBlock[] | null> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const parsed = AIResponseSchema.safeParse(JSON.parse(match[0]));
  if (!parsed.success) {
    console.error('Zod parse error:', parsed.error.message, '\nRaw:', text.substring(0, 500));
    return null;
  }

  return parsed.data.blocks;
}

// ─── Helper: semantic validation (±10%) ──────────────────────────────────────

function validateSemantics(
  blocks: AIBlock[],
  activities: Array<{ id: string; name: string; weekly_goal_hours?: number | null; weekly_goal_sessions?: number | null; session_duration_hours?: number | null }>,
  doneSeconds: Record<string, number>,
  doneSessions: Record<string, number>,
): { valid: boolean; feedback: string } {
  const issues: string[] = [];

  for (const activity of activities) {
    if (activity.weekly_goal_hours) {
      const targetMins = activity.weekly_goal_hours * 60;
      const doneMins = (doneSeconds[activity.id] ?? 0) / 60;
      const remainingTarget = Math.max(0, targetMins - doneMins);
      if (remainingTarget === 0) continue;

      const scheduledMins = blocks
        .filter(b => b.activity_name === activity.name)
        .reduce((sum, b) => sum + b.duration_minutes, 0);

      const diff = Math.abs(scheduledMins - remainingTarget);
      const tolerance = remainingTarget * 0.10;

      if (diff > tolerance) {
        issues.push(
          `${activity.name}: scheduled ${scheduledMins}min but needs ${Math.round(remainingTarget)}min remaining (±10% = ${Math.round(tolerance)}min allowed)`
        );
      }
    } else if (activity.weekly_goal_sessions) {
      const doneS = doneSessions[activity.id] ?? 0;
      const remainingSessions = Math.max(0, activity.weekly_goal_sessions - doneS);
      if (remainingSessions === 0) continue;

      const scheduledCount = blocks.filter(b => b.activity_name === activity.name).length;
      if (scheduledCount < remainingSessions) {
        issues.push(
          `${activity.name}: scheduled ${scheduledCount} sessions but needs ${remainingSessions} more sessions this week`
        );
      }
    }
  }

  if (issues.length === 0) return { valid: true, feedback: '' };
  return {
    valid: false,
    feedback:
      'The following activities are not meeting their weekly targets:\n' +
      issues.map(i => `- ${i}`).join('\n') +
      '\n\nPlease adjust the schedule to fix these imbalances.',
  };
}

// ─── Hard constraint validation ───────────────────────────────────────────────

function validateHardConstraints(
  blocks: AIBlock[],
  activities: Array<{ id: string; name: string; market_aware?: boolean | null }>,
): { valid: boolean; feedback: string } {
  const issues: string[] = [];

  for (const b of blocks) {
    const date = new Date(b.date + 'T12:00:00');
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;

    // No block ends after 23:30
    const [endH, endM] = b.end_time.split(':').map(Number);
    if (endH > 23 || (endH === 23 && endM > 30)) {
      issues.push(`Block for ${b.activity_name} on ${b.date} ends at ${b.end_time} — past 23:30 cutoff`);
    }

    // Investments: ONLY 15:30–22:00 on weekdays
    if (b.activity_name === 'Investments' && !isWeekend) {
      const [startH, startM] = b.start_time.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      if (startTotal < 15 * 60 + 30 || endTotal > 22 * 60) {
        issues.push(`Investments block on ${b.date} is ${b.start_time}–${b.end_time} — must be 15:30–22:00 on weekdays`);
      }
    }

    // No block during lunch 14:00–15:00 on weekdays (except Gym)
    if (!isWeekend && b.activity_name !== 'Gym') {
      const [startH, startM] = b.start_time.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      const lunchStart = 14 * 60;
      const lunchEnd = 15 * 60;
      if (startTotal < lunchEnd && endTotal > lunchStart) {
        issues.push(`Block for ${b.activity_name} on ${b.date} overlaps lunch window 14:00–15:00`);
      }
    }
  }

  if (issues.length === 0) return { valid: true, feedback: '' };
  return {
    valid: false,
    feedback: 'Hard constraint violations:\n' + issues.map(i => `- ${i}`).join('\n') + '\n\nFix these violations.',
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const [activitiesRes, sessionsRes, examsRes, absencesRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('sessions').select('*, activity:activities(name)').eq('user_id', user.id).gte('date', weekStartStr).lte('date', weekEndStr),
    supabase.from('exams').select('*').eq('user_id', user.id).gte('exam_date', todayStr).lte('exam_date', weekEndStr),
    supabase.from('events').select('*').eq('user_id', user.id).gte('event_date', todayStr).lte('event_date', weekEndStr),
  ]);

  const activities = activitiesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const exams = examsRes.data ?? [];
  const absences = absencesRes.data ?? [];

  const doneSeconds: Record<string, number> = {};
  const doneSessions: Record<string, number> = {};
  for (const s of sessions) {
    doneSeconds[s.activity_id] = (doneSeconds[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    doneSessions[s.activity_id] = (doneSessions[s.activity_id] ?? 0) + 1;
  }

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const remainingDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(d => format(d, 'yyyy-MM-dd') >= todayStr)
    .map(d => {
      const ds = format(d, 'yyyy-MM-dd');
      const dow = d.getDay();
      const isMonTue = dow === 1 || dow === 2;
      const isWedFri = dow >= 3 && dow <= 5;
      let scheduleStart: string = USER_SCHEDULE.WEEKEND.earliestAvailable;
      if (isMonTue) scheduleStart = USER_SCHEDULE.MON_TUE.earliestAvailable;
      else if (isWedFri) scheduleStart = USER_SCHEDULE.WED_FRI.earliestAvailable;
      const availableFrom = ds === todayStr && nowHHMM > scheduleStart ? nowHHMM : scheduleStart;
      const isWeekend = dow === 0 || dow === 6;
      const absenceNote = absences
        .filter(a => a.event_date === ds)
        .map(a => `(absence: ${a.reason}${a.start_time ? ` ${a.start_time}–${a.end_time ?? '?'}` : ''})`)
        .join(', ');
      return { date: ds, dayName: format(d, 'EEEE'), availableFrom, cutoff: '23:30', isWeekend, absenceNote };
    });

  if (remainingDays.length === 0) return NextResponse.json({ blocks: [] });

  const progressText = activities.map(a => {
    const done = doneSeconds[a.id] ?? 0;
    const doneH = (done / 3600).toFixed(1);
    const doneSess = doneSessions[a.id] ?? 0;
    const flags = [
      a.is_hard_daily_constraint ? '[DAILY REQUIRED — every remaining day]' : '',
      a.market_aware ? '[INVESTMENTS — weekdays 15:30–22:00 CET only, weekends anytime]' : '',
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

  const systemPrompt = `You are a schedule optimizer for a Spanish student named Adrià, 18 years old, in Girona (Europe/Madrid timezone). Do a MID-WEEK reorganization — only schedule the remaining days listed.

STRICT HARD RULES — violations will be rejected:
1. Block duration: minimum 45 minutes, maximum 2.5 hours continuous (Gym is exactly 3h — no more, no less).
2. 15-minute break between consecutive blocks of different activities.
3. NEVER schedule anything between 14:00–15:00 (lunch) on weekdays (except Gym which is a 3h session).
4. NEVER schedule after 23:30.
5. Investments on WEEKDAYS: ONLY between 15:30–22:00 CET (NYSE market hours). HARD constraint, no exceptions. On weekends: any available time.
6. Gym: each session is EXACTLY 3h. NEVER on same day as Running/MTB. Max 3 consecutive gym days then rest.
7. English C1 (is_hard_daily_constraint): schedule EVERY remaining day, minimum 1h per day, prefer 1.5h blocks.
8. Running/MTB: prefer Saturday or Sunday morning. Never same day as Gym.
9. Never schedule during listed absence windows.

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

  const buildPrompt = (feedbackNote = '') => `Today: ${todayStr} (${format(now, 'EEEE HH:mm')})
Week ends: ${weekEndStr}

Remaining days to schedule:
${remainingDays.map(d =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff 23:30` +
  (!d.isWeekend ? `, Investments window 15:30–22:00` : '') +
  (d.absenceNote ? ` ${d.absenceNote}` : '')
).join('\n')}

Activity progress this week:
${progressText}

Upcoming exams:
${exams.length ? exams.map(e => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''} — leave 2h free before exam`).join('\n') : 'None'}
${feedbackNote ? `\nFEEDBACK FROM VALIDATION (fix these issues):\n${feedbackNote}` : ''}`;

  try {
    const blocks = await callClaude(systemPrompt, buildPrompt());

    if (!blocks) {
      return NextResponse.json({ error: 'AI returned invalid structure' }, { status: 500 });
    }

    const hardValidation = validateHardConstraints(blocks, activities);
    const semValidation = validateSemantics(blocks, activities, doneSeconds, doneSessions);

    const allValid = hardValidation.valid && semValidation.valid;
    if (allValid) return NextResponse.json({ blocks });

    const combinedFeedback = [
      !hardValidation.valid ? hardValidation.feedback : '',
      !semValidation.valid ? semValidation.feedback : '',
    ].filter(Boolean).join('\n\n');

    console.warn('reorganize: validation failed, retrying…\n', combinedFeedback);

    const retryBlocks = await callClaude(systemPrompt, buildPrompt(combinedFeedback));

    if (!retryBlocks) {
      return NextResponse.json({ error: 'AI returned invalid structure on retry' }, { status: 500 });
    }

    const retryHard = validateHardConstraints(retryBlocks, activities);
    const retrySem = validateSemantics(retryBlocks, activities, doneSeconds, doneSessions);

    if (!retryHard.valid || !retrySem.valid) {
      const details = [retryHard.feedback, retrySem.feedback].filter(Boolean).join('\n');
      console.error('reorganize: validation still failing after retry\n', details);
      return NextResponse.json({ error: 'Schedule still violates constraints after retry', details }, { status: 500 });
    }

    return NextResponse.json({ blocks: retryBlocks });
  } catch (err) {
    console.error('reorganize error:', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
