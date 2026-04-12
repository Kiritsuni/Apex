import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const date = searchParams.get('date')

  let query = supabase
    .from('scheduled_blocks')
    .select('*, activity:activities(*)')
    .eq('user_id', user.id)
    .order('scheduled_date')
    .order('start_time')

  if (from) query = query.gte('scheduled_date', from)
  if (to) query = query.lte('scheduled_date', to)
  if (date) query = query.eq('scheduled_date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { activity_id, scheduled_date, start_time, duration_minutes, notes, is_tentative, ai_reasoning } = body

  if (!activity_id || !scheduled_date || !start_time) {
    return NextResponse.json({ error: 'activity_id, scheduled_date, start_time required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_blocks')
    .insert({
      user_id: user.id,
      activity_id,
      scheduled_date,
      start_time,
      duration_minutes: duration_minutes ?? 60,
      notes: notes ?? null,
      is_tentative: is_tentative ?? false,
      ai_reasoning: ai_reasoning ?? null,
    })
    .select('*, activity:activities(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('scheduled_blocks')
    .delete()
    .eq('user_id', user.id)
    .eq('is_completed', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
