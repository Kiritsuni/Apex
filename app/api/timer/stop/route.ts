import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { session_id, duration_seconds, notes } = body;

  if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  if (typeof duration_seconds !== 'number' || duration_seconds < 0)
    return NextResponse.json({ error: 'duration_seconds must be a non-negative number' }, { status: 400 });

  // Verify the session belongs to this user and is still open
  const { data: existing, error: fetchErr } = await supabase
    .from('sessions')
    .select('id, ended_at')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (existing.ended_at) return NextResponse.json({ error: 'Session already stopped' }, { status: 409 });

  const ended_at = new Date().toISOString();

  const { data: session, error } = await supabase
    .from('sessions')
    .update({
      ended_at,
      duration_seconds: Math.round(duration_seconds),
      notes: notes ?? null,
    })
    .eq('id', session_id)
    .select('*, activity:activities(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session });
}
