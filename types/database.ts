export interface Activity {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  category: string;
  weekly_goal_hours?: number;
  daily_min_hours?: number;
  is_hard_daily_constraint?: boolean;
  weekly_goal_sessions?: number;
  session_duration_hours?: number;
  market_aware?: boolean;
  sort_order: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  activity_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  date: string;
  notes: string | null;
  created_at: string;
  activity?: Activity;
}

export interface Exam {
  id: string;
  user_id: string;
  subject: string;
  topic: string | null;
  exam_date: string;
  exam_time: string | null;
  location: string | null;
  notes: string | null;
  status: 'upcoming' | 'done' | 'cancelled';
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  activity_id: string | null;
  completed: boolean;
  created_at: string;
  activity?: Activity;
}

export interface UserSettings {
  id: string;
  user_id: string;
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  push_subscription: string | null;
  created_at: string;
}

export interface WeeklyStats {
  activity_id: string;
  activity_name: string;
  activity_color: string;
  total_seconds: number;
  session_count: number;
}
