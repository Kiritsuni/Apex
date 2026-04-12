import Anthropic from '@anthropic-ai/sdk';
import type { Activity, Goal } from '@/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GoalSuggestion {
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  /** Resolved to the matching activity's UUID, or null if none matched */
  activity_id: string | null;
}

export interface GoalGeneratorContext {
  activities: Activity[];
  existingGoals: Goal[];
  /** Total seconds tracked per activity_id over the past 30 days */
  activityTotals: Record<string, number>;
}

/**
 * Generate 4–5 goal suggestions tailored to the user's tracked activities.
 * Avoids duplicating titles that already exist in `existingGoals`.
 */
export async function generateGoalSuggestions(ctx: GoalGeneratorContext): Promise<GoalSuggestion[]> {
  const { activities, existingGoals, activityTotals } = ctx;

  const activitiesText = activities.map((a) => {
    const h = ((activityTotals[a.id] ?? 0) / 3600).toFixed(1);
    const parts: string[] = [`- ${a.name} (${a.category}): ${h}h in last 30 days`];
    if (a.weekly_goal_hours) parts.push(`weekly goal: ${a.weekly_goal_hours}h`);
    if (a.weekly_goal_sessions) parts.push(`weekly goal: ${a.weekly_goal_sessions} sessions`);
    return parts.join(', ');
  }).join('\n');

  const existingText = existingGoals.length
    ? existingGoals.map((g) => `- ${g.title} (${g.completed ? 'completed' : 'active'})`).join('\n')
    : 'None';

  const prompt = `You are a performance coach generating goal suggestions. Return JSON only.

User's activities and recent tracking (last 30 days):
${activitiesText}

Existing goals (avoid exact duplicates):
${existingText}

Generate 4 to 5 goal suggestions that are:
- Specific and measurable (numeric target)
- Achievable based on current tracking pace
- Varied in time horizon (some short-term, some medium-term)
- Linked to the user's actual activities where relevant

Return:
{
  "suggestions": [
    {
      "title": "string",
      "description": "string or null",
      "target_value": number,
      "current_value": 0,
      "unit": "hours | sessions | km | pages | etc.",
      "activity_name": "exact activity name from the list above, or null"
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a goal-setting assistant. Return only valid JSON, no markdown.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  let raw: Array<{
    title: string;
    description: string | null;
    target_value: number;
    current_value: number;
    unit: string;
    activity_name: string | null;
  }> = [];

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    raw = parsed?.suggestions ?? [];
  } catch {
    return [];
  }

  // Resolve activity_name → activity_id
  return raw.map(({ activity_name, ...rest }) => ({
    ...rest,
    activity_id: activities.find((a) => a.name === activity_name)?.id ?? null,
  }));
}
