import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { event_date, reason, start_time, end_time, notes } = body

  if (!event_date) return NextResponse.json({ error: 'event_date required' }, { status: 400 })

  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      event_date,
      reason: reason ?? null,
      start_time: start_time || null,
      end_time: end_time || null,
      notes: notes ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
