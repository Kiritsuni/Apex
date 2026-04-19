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
    supabase.from('goals').select('*').eq('user_id', user.id),
    supabase
      .from('sessions')
      .select('activity_id, duration_seconds, date')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo)
      .lte('date', today)
      .not('duration_seconds', 'is', null),
  ]);

  const activities = activitiesRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  // Aggregate past-30-day totals per activity
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    totals[s.activity_id] = (totals[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const activitiesText = activities
    .map(a => {
      const h = ((totals[a.id] ?? 0) / 3600).toFixed(1);
      const parts: string[] = [`- ${a.name} (${a.category}): ${h}h tracked in last 30 days`];
      if (a.weekly_goal_hours) parts.push(`weekly target: ${a.weekly_goal_hours}h`);
      if (a.weekly_goal_sessions) parts.push(`weekly target: ${a.weekly_goal_sessions} sessions`);
      return parts.join(', ');
    })
    .join('\n');

  const existingGoalsText = goals.length
    ? goals.map(g => `- ${g.title} (${g.completed ? 'completed' : 'active'})`).join('\n')
    : 'None yet';

  const prompt = `You are a performance coach generating weekly action suggestions for a user. Return JSON only.

User's activities and recent tracking (last 30 days):
${activitiesText}

Existing goals (avoid duplicates):
${existingGoalsText}

Generate 3 to 5 SPECIFIC WEEKLY ACTIONS that are:
- Discrete and checkable (can be marked done by end of week)
- Outcome-oriented: progress toward a real skill, achievement, or milestone
- Concrete enough to know when completed
- Related to the activities they track

IMPORTANT:
- Do NOT generate hour targets (e.g. "Do 10h of English")
- Do NOT generate scheduling goals (e.g. "Study 5 days this week")
- DO generate discrete tasks like:
  - "Complete 2 Cambridge C1 mock writing tasks"
  - "Read 1 annual report from watchlist"
  - "Log a run below 5:00/km pace"
  - "Finish 3 chapters of grammar workbook"
  - "Solve 5 practice exam questions under timed conditions"

Return exactly:
{
  "suggestions": [
    {
      "title": "string — discrete, checkable action",
      "description": "string or null — optional context",
      "target_value": 1,
      "current_value": 0,
      "unit": "task",
      "activity_name": "string matching an activity above, or null"
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
      system:
        'You are a performance coach. Generate discrete weekly actions, not hour targets. Return only valid JSON, no markdown.',
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { suggestions: [] };

    // Resolve activity_name → activity_id
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

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('goals/generate error:', err);
    return NextResponse.json({ suggestions: [] });
  }
}
