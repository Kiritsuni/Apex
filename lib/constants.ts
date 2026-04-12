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

export const SUBJECTS = [
  'Anglès', 'Economia', 'Empresa', 'Màrqueting',
  'Venda', 'Atenció al Client', 'Gestió Administrativa', 'Other'
];
