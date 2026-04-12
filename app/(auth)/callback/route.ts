import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if user has settings (i.e., onboarded)
      const { data: settings } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();

      if (!settings) {
        // New user - seed data
        try {
          await fetch(`${origin}/api/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {}
        return NextResponse.redirect(`${origin}/dashboard?onboarding=true`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
