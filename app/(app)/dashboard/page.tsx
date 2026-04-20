import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { startOfWeek, endOfWeek, format, getISODay } from 'date-fns'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { Activity, ScheduledBlock, Exam, Goal } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    activitiesResult,
    todayBlocksResult,
    todaySessionsResult,
    weekSessionsResult,
    nextExamResult,
    goalsResult,
  ] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('scheduled_blocks').select('*, activity:activities(*)').eq('user_id', user.id).eq('scheduled_date', todayStr).order('start_time'),
    supabase.from('sessions').select('activity_id, duration_seconds').eq('user_id', user.id).eq('date', todayStr).not('duration_seconds', 'is', null),
    supabase.from('sessions').select('activity_id, duration_seconds').eq('user_id', user.id).gte('date', weekStart).lte('date', weekEnd).not('duration_seconds', 'is', null),
    supabase.from('exams').select('*').eq('user_id', user.id).eq('status', 'upcoming').gte('exam_date', todayStr).order('exam_date').limit(1).single(),
    supabase.from('goals').select('*').eq('user_id', user.id).eq('completed', false),
  ])

  const activities = (activitiesResult.data ?? []) as Activity[]
  const todayBlocks = (todayBlocksResult.data ?? []) as ScheduledBlock[]
  const progressiveGoals = (goalsResult.data ?? []) as Goal[]
  const nextExam = (nextExamResult.data ?? null) as Exam | null

  // Calculate English streak
  const englishActivity = activities.find(a => a.name === 'English C1')
  let englishStreak = 0
  if (englishActivity) {
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('date, duration_seconds')
      .eq('user_id', user.id)
      .eq('activity_id', englishActivity.id)
      .order('date', { ascending: false })
      .limit(30)

    const checkDate = new Date(today)
    checkDate.setHours(0, 0, 0, 0)
    for (let i = 0; i < 30; i++) {
      const dateStr = format(checkDate, 'yyyy-MM-dd')
      const dayTotal = (recentSessions ?? [])
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
      if (dayTotal >= 3600) {
        englishStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Aggregate sessions by activity
  const todayByActivity = (todaySessionsResult.data ?? []).reduce((acc, s) => {
    acc[s.activity_id] = (acc[s.activity_id] || 0) + (s.duration_seconds || 0)
    return acc
  }, {} as Record<string, number>)

  const weekByActivity = (weekSessionsResult.data ?? []).reduce((acc, s) => {
    acc[s.activity_id] = (acc[s.activity_id] || 0) + (s.duration_seconds || 0)
    return acc
  }, {} as Record<string, number>)

  const weekCountByActivity = (weekSessionsResult.data ?? []).reduce((acc, s) => {
    acc[s.activity_id] = (acc[s.activity_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const isoDay = getISODay(today)

  return (
    <DashboardClient
      activities={activities}
      todayBlocks={todayBlocks}
      todayByActivity={todayByActivity}
      weekByActivity={weekByActivity}
      weekCountByActivity={weekCountByActivity}
      nextExam={nextExam}
      progressiveGoals={progressiveGoals}
      englishStreak={englishStreak}
      englishActivityId={englishActivity?.id ?? null}
      isoDay={isoDay}
      userId={user.id}
      userName={
        user.user_metadata?.full_name?.split(' ')[0] ||
        user.email?.split('@')[0] ||
        'Usuario'
      }
    />
  )
}
