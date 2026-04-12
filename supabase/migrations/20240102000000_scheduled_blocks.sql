-- scheduled_blocks: AI-generated and manually created schedule entries
create table if not exists scheduled_blocks (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  activity_id      uuid not null references activities(id) on delete cascade,
  scheduled_date   date not null,
  start_time       time not null,
  duration_minutes integer not null default 60,
  notes            text,
  is_completed     boolean not null default false,
  is_tentative     boolean not null default false,
  ai_reasoning     text,
  created_at       timestamptz not null default now()
);

alter table scheduled_blocks enable row level security;

create policy "users can manage their own scheduled_blocks"
  on scheduled_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index scheduled_blocks_user_date_idx on scheduled_blocks(user_id, scheduled_date);

-- events: absences and other events that affect scheduling
create table if not exists events (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  reason     text,
  start_time time,
  end_time   time,
  notes      text,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "users can manage their own events"
  on events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index events_user_date_idx on events(user_id, event_date);
