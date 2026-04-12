import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import webpush from 'web-push';
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns';

// Initialise VAPID once at module load
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:apex@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  // Service-role client bypasses RLS — never expose to the browser
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

// Called by Vercel Cron (or any scheduler) with Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  const supabase = getAdminClient();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const dayName = format(today, 'EEEE');
  const weekStartStr = format(startOfISOWeek(today), 'yyyy-MM-dd');
  const weekEndStr = format(endOfISOWeek(today), 'yyyy-MM-dd');

  // ── 1. All users with active push subscriptions ───────────────────────────
  const { data: subscribers, error: subErr } = await supabase
    .from('user_settings')
    .select('user_id, push_subscription')
    .eq('notifications_enabled', true)
    .not('push_subscription', 'is', null);

  if (subErr) {
    console.error('cron/daily fetch subscribers error:', subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }
  if (!subscribers?.length) return NextResponse.json({ sent: 0, skipped: 0, errors: 0 });

  const userIds = subscribers.map((s) => s.user_id);

  // ── 2. Today's exams across all users ─────────────────────────────────────
  const { data: todayExams } = await supabase
    .from('exams')
    .select('user_id, subject, exam_time')
    .in('user_id', userIds)
    .eq('exam_date', todayStr)
    .eq('status', 'upcoming');

  const examsByUser: Record<string, { subject: string; exam_time: string | null }[]> = {};
  for (const e of todayExams ?? []) {
    if (!examsByUser[e.user_id]) examsByUser[e.user_id] = [];
    examsByUser[e.user_id].push({ subject: e.subject, exam_time: e.exam_time });
  }

  // ── 3. This week's session totals across all users ────────────────────────
  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('user_id, duration_seconds')
    .in('user_id', userIds)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr)
    .not('duration_seconds', 'is', null);

  const weekTotalsByUser: Record<string, number> = {};
  for (const s of weekSessions ?? []) {
    weekTotalsByUser[s.user_id] = (weekTotalsByUser[s.user_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  // ── 4. Send a notification per user ──────────────────────────────────────
  let sent = 0;
  let errors = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    if (!sub.push_subscription) { skipped++; continue; }

    const exams = examsByUser[sub.user_id] ?? [];
    const weekHours = ((weekTotalsByUser[sub.user_id] ?? 0) / 3600).toFixed(1);

    let title: string;
    let body: string;

    if (exams.length > 0) {
      // Exam day — highest urgency
      const examList = exams.map((e) => e.subject + (e.exam_time ? ` at ${e.exam_time}` : '')).join(', ');
      title = `Exam day — ${dayName}`;
      body = `Today: ${examList}. ${weekHours}h tracked this week.`;
    } else {
      title = `APEX · ${dayName}`;
      body = `${weekHours}h tracked this week. Stay on target.`;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: '/dashboard' },
    });

    try {
      await webpush.sendNotification(JSON.parse(sub.push_subscription), payload);
      sent++;
    } catch (err) {
      console.error(`cron/daily push error for user ${sub.user_id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ sent, errors, skipped });
}
