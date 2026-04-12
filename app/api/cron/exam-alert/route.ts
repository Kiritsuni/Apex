import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import webpush from 'web-push';
import { format, addDays } from 'date-fns';

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
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

// Alert thresholds: notify on these days-before counts only.
// Running daily prevents repeat alerts — only exact day matches fire.
const ALERT_DAYS_BEFORE = [1, 3, 7] as const;

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

  // Compute the set of alert dates (today + N for each threshold)
  const alertDates = ALERT_DAYS_BEFORE.map((n) => format(addDays(today, n), 'yyyy-MM-dd'));

  // ── Fetch upcoming exams on any alert date ────────────────────────────────
  const { data: exams, error: examsErr } = await supabase
    .from('exams')
    .select('id, user_id, subject, topic, exam_date, exam_time')
    .in('exam_date', alertDates)
    .eq('status', 'upcoming');

  if (examsErr) {
    console.error('cron/exam-alert exams error:', examsErr);
    return NextResponse.json({ error: examsErr.message }, { status: 500 });
  }
  if (!exams?.length) return NextResponse.json({ sent: 0, skipped: 0, errors: 0 });

  // ── Fetch push subscriptions for those users ──────────────────────────────
  const userIds = [...new Set(exams.map((e) => e.user_id))];

  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, push_subscription')
    .in('user_id', userIds)
    .eq('notifications_enabled', true)
    .not('push_subscription', 'is', null);

  const subscriptionByUser: Record<string, string> = {};
  for (const s of settings ?? []) {
    if (s.push_subscription) subscriptionByUser[s.user_id] = s.push_subscription;
  }

  // ── Send one notification per exam ───────────────────────────────────────
  let sent = 0;
  let errors = 0;
  let skipped = 0;

  for (const exam of exams) {
    const pushSub = subscriptionByUser[exam.user_id];
    if (!pushSub) { skipped++; continue; }

    const daysAway = ALERT_DAYS_BEFORE.find(
      (n) => format(addDays(today, n), 'yyyy-MM-dd') === exam.exam_date,
    );
    if (daysAway === undefined) { skipped++; continue; }

    const label =
      daysAway === 1 ? 'tomorrow'
      : daysAway === 3 ? 'in 3 days'
      : `in ${daysAway} days`;

    const timeStr = exam.exam_time ? ` at ${exam.exam_time.slice(0, 5)}` : '';
    const topicStr = exam.topic ? ` — ${exam.topic}` : '';

    const payload = JSON.stringify({
      title: `Exam ${label}: ${exam.subject}`,
      body: `${exam.subject}${topicStr}${timeStr} on ${exam.exam_date}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `exam-${exam.id}`,          // prevents duplicate banners if SW batches
      data: { url: '/exams' },
    });

    try {
      await webpush.sendNotification(JSON.parse(pushSub), payload, { urgency: 'high' });
      sent++;
    } catch (err) {
      console.error(`cron/exam-alert push error exam ${exam.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ sent, errors, skipped });
}
