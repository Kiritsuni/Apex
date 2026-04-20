import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, subDays } from 'date-fns';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const [activitiesRes, goalsRes, sessionsRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('goals').select('*').eq('user_id', user.id).eq('completed', false),
    supabase.from('sessions').select('activity_id, duration_seconds, date').eq('user_id', user.id).gte('date', thirtyDaysAgo).lte('date', today).not('duration_seconds', 'is', null),
  ]);

  const activities = activitiesRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const totals: Record<string, number> = {};
  for (const s of sessions) {
    totals[s.activity_id] = (totals[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const activitiesText = activities
    .map(a => {
      const h = ((totals[a.id] ?? 0) / 3600).toFixed(1);
      const parts: string[] = [`- ${a.name}: ${h}h tracked in last 30 days`];
      if (a.weekly_goal_hours) parts.push(`weekly target: ${a.weekly_goal_hours}h`);
      if (a.weekly_goal_sessions) parts.push(`weekly target: ${a.weekly_goal_sessions} sessions`);
      return parts.join(', ');
    })
    .join('\n');

  const goalsText = goals.length
    ? goals.map(g => `- ${g.title}`).join('\n')
    : 'None yet';

  const systemPrompt = `You generate weekly action items that move the user's long-term goals forward. Output strictly 5–7 actions, each one: specific, measurable, completable within one week.

RULES:
- Never output vague actions like "study more", "review portfolio", "work out more", "look at the market", "do homework"
- Every action must be something the user can check off as done/not done at the end of the week
- Actions must be concrete enough that success is unambiguous

GOOD EXAMPLES:
- "Complete 2 Cambridge C1 Writing mock essays (Part 1 and Part 2) and self-score using the rubric"
- "Read 1 annual report from the watchlist (MU, GOOGL, or SU) and write a 10-bullet summary"
- "Bench press 3×5 at 72.5kg this week, log RPE per set"
- "Complete all Economía problem sets for the current tema, review errors"
- "Run 8km below 5:15/km pace at least once"
- "Log 4 gym sessions this week (Tuesday, Thursday, Saturday, Sunday)"

BAD EXAMPLES (never output these):
- "Study English" (vague)
- "Work out more" (not measurable)
- "Look at the market" (no deliverable)
- "Do homework" (not specific)

OUTPUT FORMAT — valid JSON only, no markdown:
{
  "suggestions": [
    {
      "title": "specific, measurable, checkable action",
      "description": "optional extra context or null",
      "target_value": 1,
      "current_value": 0,
      "unit": "task",
      "activity_name": "matching activity name or null"
    }
  ]
}

If no long-term goals exist, generate actions tied directly to the user's tracked activity weekly targets instead (e.g. "Log 4 gym sessions this week").`;

  const userPrompt = `USER'S TRACKED ACTIVITIES AND WEEKLY TARGETS:
${activitiesText}

LONG-TERM GOALS (active):
${goalsText}

Generate 5–7 specific, measurable, checkable weekly actions. Prioritize actions that move long-term goals forward.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { suggestions: [] };

    const suggestions = (parsed.suggestions ?? []).map((s: {
      title: string;
      description: string | null;
      target_value: number;
      current_value: number;
      unit: string;
      activity_name: string | null;
    }) => {
      const activity = activities.find(a => a.name === s.activity_name);
      const { activity_name, ...rest } = s;
      return { ...rest, activity_id: activity?.id ?? null };
    });

    if (suggestions.length === 0) {
      const fallback = activities
        .filter(a => a.weekly_goal_sessions || a.weekly_goal_hours)
        .slice(0, 5)
        .map(a => ({
          title: a.weekly_goal_sessions
            ? `Log ${a.weekly_goal_sessions} ${a.name} sessions this week`
            : `Log ${a.weekly_goal_hours}h of ${a.name} this week`,
          description: null,
          target_value: 1,
          current_value: 0,
          unit: 'task',
          activity_id: a.id,
        }));
      return NextResponse.json({ suggestions: fallback });
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('goals/generate error:', err);
    return NextResponse.json({ suggestions: [] });
  }
}
