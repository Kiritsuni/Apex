-- APEX Performance System — Initial Schema
-- Run this in your Supabase SQL editor or via `supabase db push`

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Activities ─────────────────────────────────────────────────────────────
create table if not exists activities (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  color                   text not null default '#6366f1',
  icon                    text not null default 'Zap',
  category                text not null default 'other',
  weekly_goal_hours       numeric,
  daily_min_hours         numeric,
  is_hard_daily_constraint boolean default false,
  weekly_goal_sessions    integer,
  session_duration_hours  numeric,
  market_aware            boolean default false,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now()
);

alter table activities enable row level security;

create policy "users can manage their own activities"
  on activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index activities_user_id_idx on activities(user_id);
create index activities_sort_order_idx on activities(user_id, sort_order);

-- ─── Sessions ────────────────────────────────────────────────────────────────
create table if not exists sessions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  activity_id      uuid not null references activities(id) on delete cascade,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  duration_seconds integer,
  date             date not null,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "users can manage their own sessions"
  on sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index sessions_user_id_idx on sessions(user_id);
create index sessions_date_idx on sessions(user_id, date);
create index sessions_activity_idx on sessions(user_id, activity_id);

-- ─── Exams ───────────────────────────────────────────────────────────────────
create table if not exists exams (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject    text not null,
  topic      text,
  exam_date  date not null,
  exam_time  time,
  location   text,
  notes      text,
  status     text not null default 'upcoming' check (status in ('upcoming', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table exams enable row level security;

create policy "users can manage their own exams"
  on exams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index exams_user_id_idx on exams(user_id);
create index exams_date_idx on exams(user_id, exam_date);

-- ─── Goals ───────────────────────────────────────────────────────────────────
create table if not exists goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  target_value  numeric not null default 100,
  current_value numeric not null default 0,
  unit          text,
  deadline      date,
  activity_id   uuid references activities(id) on delete set null,
  completed     boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table goals enable row level security;

create policy "users can manage their own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index goals_user_id_idx on goals(user_id);

-- ─── User Settings ───────────────────────────────────────────────────────────
create table if not exists user_settings (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null unique references auth.users(id) on delete cascade,
  onboarding_completed    boolean not null default false,
  notifications_enabled   boolean not null default false,
  push_subscription       text,
  created_at              timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "users can manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
