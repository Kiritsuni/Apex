import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import webpush from 'web-push';

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:apex@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const title: string = body.title ?? 'APEX';
  const message: string = body.message ?? 'Time to focus!';
  const url: string | undefined = body.url;
  const urgency: 'very-low' | 'low' | 'normal' | 'high' = body.urgency ?? 'normal';

  const { data: settings } = await supabase
    .from('user_settings')
    .select('push_subscription')
    .eq('user_id', user.id)
    .single();

  if (!settings?.push_subscription) {
    return NextResponse.json({ error: 'No push subscription found' }, { status: 400 });
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    ...(url ? { data: { url } } : {}),
  });

  try {
    const subscription = JSON.parse(settings.push_subscription);
    await webpush.sendNotification(subscription, payload, { urgency });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('webpush send error:', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
