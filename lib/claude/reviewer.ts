import Anthropic from '@anthropic-ai/sdk';
import type { Activity, Session, Exam, Goal } from '@/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReviewContext {
  sessions: Session[];
  activities: Activity[];
  exams: Exam[];
  goals: Goal[];
  weekStart: string; // 'YYYY-MM-DD'
  weekEnd: string;   // 'YYYY-MM-DD'
}

function buildReviewPrompt(ctx: ReviewContext): string {
  const { sessions, activities, exams, goals, weekStart, weekEnd } = ctx;

  // Per-activity aggregation
  const stats: Record<string, {
    name: string;
    totalSeconds: number;
    sessions: number;
    goalHours?: number;
    goalSessions?: number;
  }> = {};

  for (const s of sessions) {
    const aid = s.activity_id;
    if (!stats[aid]) {
      const a = activities.find((act) => act.id === aid);
      stats[aid] = {
        name: (s.activity as { name?: string } | null | undefined)?.name ?? a?.name ?? 'Unknown',
        totalSeconds: 0,
        sessions: 0,
        goalHours: a?.weekly_goal_hours,
        goalSessions: a?.weekly_goal_sessions,
      };
    }
    stats[aid].totalSeconds += s.duration_seconds ?? 0;
    stats[aid].sessions += 1;
  }

  const statsText = Object.values(stats).map((s) => {
    const hours = (s.totalSeconds / 3600).toFixed(1);
    const goal = s.goalHours
      ? ` (goal: ${s.goalHours}h/wk)`
      : s.goalSessions ? ` (goal: ${s.goalSessions} sessions/wk)` : '';
    return `- ${s.name}: ${hours}h across ${s.sessions} session(s)${goal}`;
  }).join('\n') || 'No sessions logged';

  const examsText = exams.length
    ? exams.map((e) => `- ${e.subject}${e.topic ? ` — ${e.topic}` : ''} on ${e.exam_date}`).join('\n')
    : 'None this week';

  const goalsText = goals.length
    ? goals.map((g) => `- ${g.title}: ${g.current_value}/${g.target_value} ${g.unit ?? ''}`).join('\n')
    : 'No active goals';

  return `You are a personal performance coach reviewing a student/trader's week. Be concise, honest, and actionable.

Week: ${weekStart} to ${weekEnd}

Time tracked:
${statsText}

Exams this week:
${examsText}

Active goals:
${goalsText}

All tracked activities (context):
${activities.map((a) => `- ${a.name} (${a.category})`).join('\n')}

Write a brief weekly review with:
1. **Performance Summary** (2-3 sentences on overall output)
2. **Wins** (bullet points — what went well)
3. **Areas to Improve** (bullet points — what needs work)
4. **Next Week Priorities** (3 specific, actionable items)

Keep each section tight. No fluff.`;
}

/**
 * Returns an Anthropic MessageStream. The caller (API route) is responsible
 * for reading the stream and forwarding chunks to the HTTP response.
 *
 * @example
 * const stream = createReviewStream(ctx);
 * const readable = new ReadableStream({
 *   async start(controller) {
 *     for await (const chunk of stream) {
 *       if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
 *         controller.enqueue(encoder.encode(chunk.delta.text));
 *       }
 *     }
 *     controller.close();
 *   },
 * });
 */
export function createReviewStream(ctx: ReviewContext): ReturnType<typeof anthropic.messages.stream> {
  return anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a concise, direct performance coach. No filler, no praise-padding. Just honest analysis.',
    messages: [{ role: 'user', content: buildReviewPrompt(ctx) }],
  });
}

/**
 * Convenience wrapper that accumulates the full review text (non-streaming).
 * Suitable for JSON export endpoints where you need the complete text at once.
 */
export async function generateReviewText(ctx: ReviewContext): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a concise, direct performance coach. No filler, no praise-padding. Just honest analysis.',
    messages: [{ role: 'user', content: buildReviewPrompt(ctx) }],
  });
  return message.content[0].type === 'text' ? message.content[0].text : '';
}
