import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { format, startOfISOWeek, endOfISOWeek, subWeeks } from 'date-fns';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const weekOffset = body.weekOffset ?? 0; // 0 = current week, 1 = last week

  const referenceDate = weekOffset > 0 ? subWeeks(new Date(), weekOffset) : new Date();
  const weekStart = format(startOfISOWeek(referenceDate), 'yyyy-MM-dd');
  const weekEnd = format(endOfISOWeek(referenceDate), 'yyyy-MM-dd');

  // Fetch sessions for the week
  const [sessionsRes, activitiesRes, examsRes, goalsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('*, activity:activities(name, color, category, weekly_goal_hours, weekly_goal_sessions)')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('exams').select('*').eq('user_id', user.id).gte('exam_date', weekStart).lte('exam_date', weekEnd),
    supabase.from('goals').select('*').eq('user_id', user.id).eq('completed', false),
  ]);

  const sessions = sessionsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const exams = examsRes.data ?? [];
  const goals = goalsRes.data ?? [];

  // Aggregate stats
  const stats: Record<string, { name: string; color: string; totalSeconds: number; sessions: number; goalHours?: number; goalSessions?: number }> = {};
  for (const s of sessions) {
    const aid = s.activity_id;
    if (!stats[aid]) {
      stats[aid] = {
        name: s.activity?.name ?? 'Unknown',
        color: s.activity?.color ?? '#888',
        totalSeconds: 0,
        sessions: 0,
        goalHours: s.activity?.weekly_goal_hours,
        goalSessions: s.activity?.weekly_goal_sessions,
      };
    }
    stats[aid].totalSeconds += s.duration_seconds ?? 0;
    stats[aid].sessions += 1;
  }

  const statsText = Object.values(stats).map((s) => {
    const hours = (s.totalSeconds / 3600).toFixed(1);
    let goal = '';
    if (s.goalHours) goal = ` (goal: ${s.goalHours}h/week)`;
    if (s.goalSessions) goal = ` (goal: ${s.goalSessions} sessions/week)`;
    return `- ${s.name}: ${hours}h across ${s.sessions} session(s)${goal}`;
  }).join('\n');

  const examsText = exams.length
    ? exams.map((e) => `- ${e.subject}${e.topic ? ` — ${e.topic}` : ''} on ${e.exam_date}`).join('\n')
    : 'None this week';

  const goalsText = goals.length
    ? goals.map((g) => `- ${g.title}: ${g.current_value}/${g.target_value} ${g.unit ?? ''}`).join('\n')
    : 'No active goals';

  const prompt = `You are a personal performance coach reviewing a student/trader's week. Be concise, honest, and actionable.

Week: ${weekStart} to ${weekEnd}

Time tracked this week:
${statsText || 'No sessions logged'}

Exams this week:
${examsText}

Active goals:
${goalsText}

All tracked activities (for context):
${activities.map((a) => `- ${a.name} (${a.category})`).join('\n')}

Write a brief weekly review with:
1. **Performance Summary** (2-3 sentences on overall output)
2. **Wins** (bullet points — what went well)
3. **Areas to Improve** (bullet points — what needs work)
4. **Next Week Priorities** (3 specific, actionable items)

Keep each section tight. No fluff.`;

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a concise, direct performance coach. No filler, no praise-padding. Just honest analysis.',
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
