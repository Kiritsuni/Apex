import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { activity_id } = body;
  if (!activity_id) return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });

  // Verify the activity belongs to this user
  const { data: activity, error: actErr } = await supabase
    .from('activities')
    .select('id, name, color')
    .eq('id', activity_id)
    .eq('user_id', user.id)
    .single();

  if (actErr || !activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

  const started_at = new Date().toISOString();
  const date = format(new Date(), 'yyyy-MM-dd');

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      activity_id,
      started_at,
      ended_at: null,
      duration_seconds: null,
      date,
      notes: null,
    })
    .select('*, activity:activities(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session }, { status: 201 });
}
