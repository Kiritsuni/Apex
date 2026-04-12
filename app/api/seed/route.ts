import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ACTIVITIES } from '@/lib/constants';
import { format, subDays, setHours, setMinutes, addMinutes } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const demo = body.demo === true;

    // ── 1. Insert default activities (skip if already exist) ──────────────────
    const { error: actErr } = await supabase
      .from('activities')
      .insert(DEFAULT_ACTIVITIES.map((a) => ({ ...a, user_id: user.id })));

    if (actErr && actErr.code !== '23505') {
      console.error('seed activities error:', actErr);
    }

    // ── 2. Mark onboarding complete ───────────────────────────────────────────
    const { error: settErr } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, onboarding_completed: true, notifications_enabled: false }, { onConflict: 'user_id' });

    if (settErr) console.error('seed settings error:', settErr);

    // ── 3. Optionally seed demo sessions ─────────────────────────────────────
    if (demo) {
      // Don't overwrite if the user already has data
      const { count } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!count || count === 0) {
        // Fetch the freshly-inserted activities to get their UUIDs
        const { data: activities } = await supabase
          .from('activities')
          .select('id, name')
          .eq('user_id', user.id);

        if (activities?.length) {
          const byName = Object.fromEntries(activities.map((a) => [a.name, a.id]));
          const today = new Date();

          // Session patterns: { activityName, daysAgo[], startHour, startMinute, durationMinutes }
          // Times are local (Madrid, CET/CEST ≈ UTC+1/+2) but stored as-is via ISO string.
          // Using simple UTC offsets to approximate CET behaviour for demo data.
          const patterns: Array<{
            activityName: string;
            daysAgo: number[];
            startHour: number;
            startMinute: number;
            durationMinutes: number;
          }> = [
            // English C1 — most weekdays, afternoon/evening
            { activityName: 'English C1', daysAgo: [1, 2, 3, 5, 6, 8, 9, 10, 12, 13], startHour: 15, startMinute: 30, durationMinutes: 90 },
            // Investments — weekdays during market hours
            { activityName: 'Investments', daysAgo: [1, 3, 5, 8, 10, 12], startHour: 16, startMinute: 0, durationMinutes: 90 },
            // Gym — ~3×/wk
            { activityName: 'Gym', daysAgo: [2, 5, 7, 9, 12, 14], startHour: 18, startMinute: 0, durationMinutes: 120 },
            // Running/MTB — ~1×/wk
            { activityName: 'Running / MTB', daysAgo: [4, 11], startHour: 10, startMinute: 0, durationMinutes: 60 },
            // School Work — a few times per week
            { activityName: 'School Work', daysAgo: [2, 6, 9, 13], startHour: 14, startMinute: 30, durationMinutes: 75 },
          ];

          const sessionRows = patterns.flatMap(({ activityName, daysAgo, startHour, startMinute, durationMinutes }) => {
            const activityId = byName[activityName];
            if (!activityId) return [];
            return daysAgo.map((n) => {
              const base = subDays(today, n);
              const started = setMinutes(setHours(base, startHour), startMinute);
              const ended = addMinutes(started, durationMinutes);
              return {
                user_id: user.id,
                activity_id: activityId,
                started_at: started.toISOString(),
                ended_at: ended.toISOString(),
                duration_seconds: durationMinutes * 60,
                date: format(base, 'yyyy-MM-dd'),
                notes: null,
              };
            });
          });

          if (sessionRows.length) {
            const { error: sessErr } = await supabase.from('sessions').insert(sessionRows);
            if (sessErr) console.error('seed sessions error:', sessErr);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('seed error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
