import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { format, startOfISOWeek, endOfISOWeek, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Zod schema for the AI response ──────────────────────────────────────────

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
});

type AIBlock = z.infer<typeof BlockSchema>;

// ─── Helper: call Claude and parse ───────────────────────────────────────────

async function callClaude(prompt: string): Promise<AIBlock[] | null> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system:
      'You are a scheduling assistant doing a mid-week reorganization. Respond with valid JSON only, no prose, no markdown code fences.',
    messages: [{ role: 'user', content: prompt }],
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

// ─── Helper: semantic validation ─────────────────────────────────────────────

function validateSemantics(
  blocks: AIBlock[],
  activities: Array<{ id: string; name: string; weekly_goal_hours?: number | null }>,
  doneSeconds: Record<string, number>,
): { valid: boolean; feedback: string } {
  const issues: string[] = [];

  for (const activity of activities) {
    if (!activity.weekly_goal_hours) continue;

    const targetMins = activity.weekly_goal_hours * 60;
    const doneMins = (doneSeconds[activity.id] ?? 0) / 60;
    const remainingTarget = Math.max(0, targetMins - doneMins);

    if (remainingTarget === 0) continue; // already met

    const scheduledMins = blocks
      .filter(b => b.activity_name === activity.name)
      .reduce((sum, b) => sum + b.duration_minutes, 0);

    const diff = Math.abs(scheduledMins - remainingTarget);
    const tolerance = remainingTarget * 0.15;

    if (diff > tolerance) {
      issues.push(
        `${activity.name}: scheduled ${scheduledMins}min but needs ${Math.round(remainingTarget)}min remaining (±15% = ${Math.round(tolerance)}min allowed)`
      );
    }
  }

  if (issues.length === 0) return { valid: true, feedback: '' };

  return {
    valid: false,
    feedback:
      'The following activities are not within ±15% of their remaining weekly targets:\n' +
      issues.map(i => `- ${i}`).join('\n') +
      '\n\nPlease adjust the schedule to fix these imbalances.',
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const weekStart = startOfISOWeek(now);
  const weekEnd = endOfISOWeek(now);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const [activitiesRes, sessionsRes, examsRes, absencesRes] = await Promise.all([
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
    supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('event_date', todayStr)
      .lte('event_date', weekEndStr),
  ]);

  const activities = activitiesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const exams = examsRes.data ?? [];
  const absences = absencesRes.data ?? [];

  // Aggregate progress per activity this week
  const doneSeconds: Record<string, number> = {};
  const doneSessions: Record<string, number> = {};
  for (const s of sessions) {
    doneSeconds[s.activity_id] = (doneSeconds[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    doneSessions[s.activity_id] = (doneSessions[s.activity_id] ?? 0) + 1;
  }

  // Remaining days from today (inclusive)
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
      const availableFrom =
        ds === todayStr && nowHHMM > scheduleStart ? nowHHMM : scheduleStart;
      const isWeekend = dow === 0 || dow === 6;
      const absenceNote = absences
        .filter(a => a.event_date === ds)
        .map(a => `(absence: ${a.reason}${a.start_time ? ` ${a.start_time}–${a.end_time ?? '?'}` : ''})`)
        .join(', ');
      return {
        date: ds,
        dayName: format(d, 'EEEE'),
        availableFrom,
        cutoff: USER_SCHEDULE.defaultCutoff,
        isWeekend,
        hasMarket: !isWeekend,
        absenceNote,
      };
    });

  if (remainingDays.length === 0) {
    return NextResponse.json({ blocks: [] });
  }

  const progressText = activities
    .map(a => {
      const done = doneSeconds[a.id] ?? 0;
      const doneH = (done / 3600).toFixed(1);
      const doneSess = doneSessions[a.id] ?? 0;
      const flags = [
        a.is_hard_daily_constraint ? '[DAILY REQUIRED]' : '',
        a.market_aware ? '[MARKET HOURS ONLY]' : '',
      ]
        .filter(Boolean)
        .join(' ');

      if (a.weekly_goal_hours) {
        const remaining = Math.max(0, a.weekly_goal_hours - done / 3600).toFixed(1);
        return `- ${a.name}: ${doneH}h done / ${a.weekly_goal_hours}h goal → ${remaining}h still needed ${flags}`;
      }
      if (a.weekly_goal_sessions) {
        const remaining = Math.max(0, a.weekly_goal_sessions - doneSess);
        return `- ${a.name}: ${doneSess} sessions done / ${a.weekly_goal_sessions} goal → ${remaining} sessions still needed (${a.session_duration_hours ?? 1}h each) ${flags}`;
      }
      return `- ${a.name}: ${doneH}h tracked so far ${flags}`;
    })
    .join('\n');

  const buildPrompt = (feedbackNote = '') => `You are a scheduling assistant doing a MID-WEEK reorganization. Only schedule the remaining days listed.

Respond with valid JSON only, no prose, no markdown code fences.
Schema: { "blocks": [{ "activity_name": string, "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": string|null }] }

Today: ${todayStr} (${format(now, 'EEEE HH:mm')})
Week ends: ${weekEndStr}

Remaining days to schedule:
${remainingDays
  .map(
    d =>
      `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}` +
      (d.hasMarket ? `, market ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : '') +
      (d.absenceNote ? ` ${d.absenceNote}` : '')
  )
  .join('\n')}

Activity progress this week (remaining to hit goals):
${progressText}

Exams remaining this week:
${exams.length ? exams.map(e => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

Rules:
1. Only output blocks for the listed remaining days
2. Focus on activities with remaining goal hours/sessions
3. Market-aware activities ONLY during ${MARKET_HOURS.open}–${MARKET_HOURS.close} on weekdays
4. Never schedule past ${USER_SCHEDULE.defaultCutoff}
5. Keep [DAILY REQUIRED] activities on every remaining weekday
6. 15-minute buffer between sessions
7. Leave 2h before any exam free
8. Respect any absence windows listed above
${feedbackNote ? `\nFEEDBACK FROM VALIDATION (please fix):\n${feedbackNote}` : ''}`;

  try {
    // First attempt
    const prompt = buildPrompt();
    const blocks = await callClaude(prompt);

    if (!blocks) {
      console.error('reorganize: Zod parse failed on first attempt');
      return NextResponse.json(
        { error: 'AI returned invalid structure', raw: 'Zod parse failed' },
        { status: 500 }
      );
    }

    // Semantic validation (±15% check)
    const validation = validateSemantics(blocks, activities, doneSeconds);

    if (validation.valid) {
      return NextResponse.json({ blocks });
    }

    console.warn('reorganize: semantic validation failed, retrying…\n', validation.feedback);

    // One retry with feedback
    const retryBlocks = await callClaude(buildPrompt(validation.feedback));

    if (!retryBlocks) {
      return NextResponse.json(
        { error: 'AI returned invalid structure on retry', raw: 'Zod parse failed' },
        { status: 500 }
      );
    }

    const retryValidation = validateSemantics(retryBlocks, activities, doneSeconds);
    if (!retryValidation.valid) {
      console.error(
        'reorganize: semantic validation failed after retry\n',
        retryValidation.feedback
      );
      return NextResponse.json(
        {
          error: 'AI schedule still violates weekly targets after retry',
          details: retryValidation.feedback,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ blocks: retryBlocks });
  } catch (err) {
    console.error('reorganize error:', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
