import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const activityId = searchParams.get('activity_id');

  let query = supabase
    .from('sessions')
    .select('*, activity:activities(*)')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (activityId) query = query.eq('activity_id', activityId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { activity_id, started_at, ended_at, duration_seconds, notes } = body;

  const date = format(new Date(started_at), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      activity_id,
      started_at,
      ended_at: ended_at ?? null,
      duration_seconds: duration_seconds ?? null,
      date,
      notes: notes ?? null,
    })
    .select('*, activity:activities(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
