export const USER_SCHEDULE = {
  MON_TUE: {
    wakeTime: '09:30',
    homeArrival: '14:50',
    earliestAvailable: '15:00',
  },
  WED_FRI: {
    wakeTime: '08:30',
    homeArrival: '13:50',
    earliestAvailable: '14:30',
  },
  WEEKEND: {
    earliestAvailable: '10:00',
  },
  defaultCutoff: '23:30',
  hardCutoff: '00:00',
} as const;

export const MARKET_HOURS = {
  open: '15:30',
  close: '22:00',
  closedDays: [0, 6], // Sunday = 0, Saturday = 6
} as const;

export const DEFAULT_ACTIVITIES = [
  {
    name: 'English C1',
    color: '#6366f1',
    icon: 'BookOpen',
    category: 'study',
    weekly_goal_hours: 10,
    daily_min_hours: 1,
    is_hard_daily_constraint: true,
    sort_order: 1,
  },
  {
    name: 'Investments',
    color: '#22c55e',
    icon: 'TrendingUp',
    category: 'finance',
    weekly_goal_hours: 5,
    market_aware: true,
    sort_order: 2,
  },
  {
    name: 'Gym',
    color: '#f59e0b',
    icon: 'Dumbbell',
    category: 'fitness',
    weekly_goal_sessions: 4,
    session_duration_hours: 3,
    sort_order: 3,
  },
  {
    name: 'Running / MTB',
    color: '#f97316',
    icon: 'Activity',
    category: 'fitness',
    weekly_goal_sessions: 1,
    session_duration_hours: 1,
    sort_order: 4,
  },
  {
    name: 'School Work',
    color: '#ec4899',
    icon: 'GraduationCap',
    category: 'study',
    sort_order: 5,
  },
] as const;

export const ENGLISH_ROTATION = [
  'Reading',
  'Listening',
  'Writing',
  'Speaking',
  'Grammar',
  'Vocabulary',
  'Mock exam'
] as const

// Day 1=Mon, 2=Tue... 7=Sun (ISO)
export function getEnglishSuggestionForDay(isoDay: number): string {
  return ENGLISH_ROTATION[(isoDay - 1) % ENGLISH_ROTATION.length]
}

export const MOTIVATIONAL_PHRASES = [
  "La disciplina es elegir entre lo que quieres ahora y lo que más quieres.",
  "El éxito no es un accidente, es trabajo duro cada día.",
  "Pequeños progresos diarios generan grandes resultados.",
  "La constancia supera al talento cuando el talento no trabaja.",
  "Hoy es otro día para ser mejor que ayer."
] as const

export const ABSENCE_TYPES = [
  { value: 'work_full', label: 'Trabajo jornada completa' },
  { value: 'work_half', label: 'Trabajo media jornada' },
  { value: 'social', label: 'Salida social' },
  { value: 'travel', label: 'Viaje' },
  { value: 'medical', label: 'Médico' },
  { value: 'other', label: 'Otro' },
] as const

export const SUBJECTS = [
  'Anglès', 'Economia', 'Empresa', 'Màrqueting',
  'Venda', 'Atenció al Client', 'Gestió Administrativa', 'Otro'
] as const
