import Anthropic from '@anthropic-ai/sdk';
import { format, addDays } from 'date-fns';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';
import type { Activity, Session, Exam } from '@/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ScheduleBlock {
  date: string;
  activity_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string | null;
}

export interface SchedulerContext {
  activities: Activity[];
  /** Sessions already logged this week */
  sessions: Session[];
  exams: Exam[];
  weekStart: Date;
  weekEnd: Date;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function dayConstraints(d: Date) {
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
}

function activityLine(a: Activity): string {
  const parts: string[] = [`- ${a.name} (${a.category})`];
  if (a.weekly_goal_hours) parts.push(`goal: ${a.weekly_goal_hours}h/wk`);
  if (a.weekly_goal_sessions) parts.push(`goal: ${a.weekly_goal_sessions}×${a.session_duration_hours ?? 1}h sessions`);
  if (a.daily_min_hours) parts.push(`daily min: ${a.daily_min_hours}h`);
  if (a.is_hard_daily_constraint) parts.push('[DAILY REQUIRED]');
  if (a.market_aware) parts.push('[MARKET HOURS ONLY]');
  return parts.join(', ');
}

function parseBlocks(text: string): ScheduleBlock[] {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    return parsed?.blocks ?? [];
  } catch {
    return [];
  }
}

const BLOCK_SCHEMA = `{
  "blocks": [
    { "date": "YYYY-MM-DD", "activity_name": "string", "start_time": "HH:MM", "end_time": "HH:MM", "duration_minutes": number, "notes": "string or null" }
  ]
}`;

const SCHEDULING_RULES = (marketOpen: string, marketClose: string, cutoff: string) =>
  `Rules:
1. Market-aware activities ONLY during ${marketOpen}–${marketClose} on weekdays
2. Never schedule past ${cutoff}
3. Put [DAILY REQUIRED] activities on every weekday in scope
4. 15-min buffer between sessions
5. Leave 2h before any exam free`;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a full Mon–Sun schedule for the given week.
 * Subtracts already-tracked session time from weekly goals.
 */
export async function generateWeekSchedule(ctx: SchedulerContext): Promise<ScheduleBlock[]> {
  const { activities, sessions, exams, weekStart, weekEnd } = ctx;
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const days = Array.from({ length: 7 }, (_, i) => dayConstraints(addDays(weekStart, i)));

  const trackedText = sessions.length
    ? sessions.map((s) => {
        const name = (s.activity as { name?: string } | null | undefined)?.name ?? s.activity_id;
        return `- ${name}: ${Math.round((s.duration_seconds ?? 0) / 60)}min on ${s.date}`;
      }).join('\n')
    : 'Nothing yet';

  const prompt = `You are a scheduling assistant. Generate a full weekly plan. Return JSON only.

Week: ${weekStartStr} to ${weekEndStr}

Daily constraints:
${days.map((d) =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}` +
  (d.hasMarket ? `, market ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : ', no market')
).join('\n')}

Activities:
${activities.map(activityLine).join('\n')}

Exams this week:
${exams.length ? exams.map((e) => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

Already tracked:
${trackedText}

${SCHEDULING_RULES(MARKET_HOURS.open, MARKET_HOURS.close, USER_SCHEDULE.defaultCutoff)}
6. Subtract already-tracked time from weekly goals before scheduling

Return: ${BLOCK_SCHEMA}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: 'You are a scheduling assistant. Return only valid JSON, no markdown.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseBlocks(text);
}

/**
 * Mid-week reorganization: schedule only the remaining days (today onwards).
 * Shows goal progress so Claude knows what's still needed.
 */
export async function reorganizeWeek(ctx: SchedulerContext): Promise<ScheduleBlock[]> {
  const { activities, sessions, exams, weekEnd } = ctx;
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  // Sessions so far this week → per-activity totals
  const doneSeconds: Record<string, number> = {};
  const doneSessions: Record<string, number> = {};
  for (const s of sessions) {
    doneSeconds[s.activity_id] = (doneSeconds[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
    doneSessions[s.activity_id] = (doneSessions[s.activity_id] ?? 0) + 1;
  }

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Days from today through end of week
  const remainingDays = Array.from({ length: 7 }, (_, i) => addDays(ctx.weekStart, i))
    .filter((d) => format(d, 'yyyy-MM-dd') >= todayStr)
    .map((d) => {
      const c = dayConstraints(d);
      const isToday = c.date === todayStr;
      return {
        ...c,
        availableFrom: isToday && nowHHMM > c.availableFrom ? nowHHMM : c.availableFrom,
      };
    });

  if (remainingDays.length === 0) return [];

  const progressText = activities.map((a) => {
    const doneH = ((doneSeconds[a.id] ?? 0) / 3600).toFixed(1);
    const doneSess = doneSessions[a.id] ?? 0;
    const flags = [a.is_hard_daily_constraint ? '[DAILY REQUIRED]' : '', a.market_aware ? '[MARKET HOURS ONLY]' : ''].filter(Boolean).join(' ');
    if (a.weekly_goal_hours) {
      const rem = Math.max(0, a.weekly_goal_hours - (doneSeconds[a.id] ?? 0) / 3600).toFixed(1);
      return `- ${a.name}: ${doneH}h done / ${a.weekly_goal_hours}h goal → ${rem}h remaining ${flags}`;
    }
    if (a.weekly_goal_sessions) {
      const rem = Math.max(0, a.weekly_goal_sessions - doneSess);
      return `- ${a.name}: ${doneSess} sessions done / ${a.weekly_goal_sessions} goal → ${rem} remaining ${flags}`;
    }
    return `- ${a.name}: ${doneH}h tracked ${flags}`;
  }).join('\n');

  const prompt = `You are a scheduling assistant doing a MID-WEEK reorganization. Only output blocks for the remaining days listed. Return JSON only.

Today: ${todayStr} (${format(now, 'EEEE HH:mm')})
Week ends: ${weekEndStr}

Remaining days:
${remainingDays.map((d) =>
  `- ${d.dayName} (${d.date}): available from ${d.availableFrom}, cutoff ${d.cutoff}` +
  (d.hasMarket ? `, market ${MARKET_HOURS.open}–${MARKET_HOURS.close}` : '')
).join('\n')}

Activity progress (remaining to hit goals):
${progressText}

Exams remaining this week:
${exams.length ? exams.map((e) => `- ${e.subject} on ${e.exam_date}${e.exam_time ? ` at ${e.exam_time}` : ''}`).join('\n') : 'None'}

${SCHEDULING_RULES(MARKET_HOURS.open, MARKET_HOURS.close, USER_SCHEDULE.defaultCutoff)}
6. Only output blocks for the listed remaining days

Return: ${BLOCK_SCHEMA}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: 'You are a scheduling assistant doing a mid-week reorganization. Return only valid JSON, no markdown.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseBlocks(text);
}
