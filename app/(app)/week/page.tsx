'use client';

import { useState, useCallback } from 'react';
import { format, startOfISOWeek, endOfISOWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Clock, Trash2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSessions } from '@/hooks/useSessions';
import { useActivities } from '@/hooks/useActivities';
import { useToast } from '@/components/ui/toast';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

interface ScheduleBlock {
  date: string;
  activity_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string;
}

export default function WeekPage() {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logForm, setLogForm] = useState({
    activity_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_time: '',
    notes: '',
  });

  const weekStart = startOfISOWeek(referenceDate);
  const weekEnd = endOfISOWeek(referenceDate);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const isCurrentWeek = weekStartStr === format(startOfISOWeek(new Date()), 'yyyy-MM-dd');

  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useSessions({ from: weekStartStr, to: weekEndStr });
  const { activities } = useActivities();
  const { toast } = useToast();

  const prevWeek = () => setReferenceDate((d) => subWeeks(d, 1));
  const nextWeek = () => setReferenceDate((d) => addWeeks(d, 1));

  const generateSchedule = useCallback(async () => {
    setGeneratingSchedule(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: weekStartStr }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.blocks ?? []);
      }
    } finally {
      setGeneratingSchedule(false);
    }
  }, [weekStartStr]);

  const handleDeleteSession = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      refetchSessions();
      toast({ title: 'Session deleted' });
    } else {
      toast({ title: 'Error deleting session', variant: 'destructive' });
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.activity_id || !logForm.date || !logForm.start_time || !logForm.end_time) return;
    setLogSubmitting(true);

    try {
      const started_at = new Date(`${logForm.date}T${logForm.start_time}:00`).toISOString();
      const ended_at = new Date(`${logForm.date}T${logForm.end_time}:00`).toISOString();
      const duration_seconds = Math.max(0, Math.floor((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000));

      if (duration_seconds <= 0) {
        toast({ title: 'End time must be after start time', variant: 'destructive' });
        setLogSubmitting(false);
        return;
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: logForm.activity_id,
          started_at,
          ended_at,
          duration_seconds,
          notes: logForm.notes || null,
        }),
      });

      if (res.ok) {
        toast({ title: 'Session logged', description: formatDuration(duration_seconds), variant: 'success' });
        setLogOpen(false);
        setLogForm({ activity_id: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_time: '', notes: '' });
        refetchSessions();
      } else {
        toast({ title: 'Error logging session', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setLogSubmitting(false);
    }
  };

  // Stats by day and activity
  const statsByDay: Record<string, Record<string, number>> = {};
  for (const s of sessions) {
    if (!statsByDay[s.date]) statsByDay[s.date] = {};
    statsByDay[s.date][s.activity_id] = (statsByDay[s.date][s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const statsByActivity: Record<string, number> = {};
  for (const s of sessions) {
    statsByActivity[s.activity_id] = (statsByActivity[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const weekTotal = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = format(new Date(), 'yyyy-MM-dd');

  // Schedule blocks by day
  const scheduleByDay: Record<string, ScheduleBlock[]> = {};
  for (const b of schedule) {
    if (!scheduleByDay[b.date]) scheduleByDay[b.date] = [];
    scheduleByDay[b.date].push(b);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Header + week nav */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Week</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
            {isCurrentWeek && <span className="ml-2 text-[var(--accent)]">· Current</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setLogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Log
          </Button>
          <button onClick={prevWeek} className="p-2 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextWeek} className="p-2 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Week summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Total: {formatDuration(weekTotal)}</span>
          </div>
          {isCurrentWeek && (
            <Button
              onClick={generateSchedule}
              disabled={generatingSchedule}
              size="sm"
              variant="secondary"
              className="gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generatingSchedule ? 'Generating…' : 'AI Schedule'}
            </Button>
          )}
        </div>

        {/* Activity breakdown */}
        <div className="space-y-1.5">
          {activities
            .filter((a) => statsByActivity[a.id] > 0)
            .sort((a, b) => (statsByActivity[b.id] ?? 0) - (statsByActivity[a.id] ?? 0))
            .map((a) => {
              const secs = statsByActivity[a.id] ?? 0;
              const goalSecs = (a.weekly_goal_hours ?? 0) * 3600;
              const pct = goalSecs > 0 ? Math.min(secs / goalSecs, 1) : null;
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="text-xs text-[var(--text-secondary)] flex-1">{a.name}</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{formatDuration(secs)}</span>
                  {pct !== null && (
                    <span className="text-xs w-10 text-right" style={{ color: pct >= 1 ? 'var(--success)' : a.color }}>
                      {Math.round(pct * 100)}%
                    </span>
                  )}
                </div>
              );
            })}
          {Object.keys(statsByActivity).length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">No sessions tracked this week</p>
          )}
        </div>
      </Card>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = dateStr === today;
          const dayStats = statsByDay[dateStr] ?? {};
          const dayTotal = Object.values(dayStats).reduce((a, b) => a + b, 0);

          return (
            <div key={dateStr} className="flex flex-col gap-1">
              <div className={`text-center py-1.5 rounded-[6px] ${isToday ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)]'}`}>
                <p className="text-[10px] font-medium">{DAY_LABELS[i]}</p>
                <p className="text-xs font-bold">{format(day, 'd')}</p>
              </div>
              {dayTotal > 0 && (
                <div className="space-y-0.5">
                  {activities
                    .filter((a) => dayStats[a.id] > 0)
                    .map((a) => (
                      <div
                        key={a.id}
                        className="h-1.5 rounded-full"
                        style={{ backgroundColor: a.color, opacity: 0.8 }}
                        title={`${a.name}: ${formatDuration(dayStats[a.id])}`}
                      />
                    ))}
                  <p className="text-[9px] text-[var(--text-muted)] text-center mt-0.5">
                    {formatDuration(dayTotal)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Schedule blocks */}
      {schedule.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">AI Schedule</h2>
          </div>
          <div className="space-y-3">
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const blocks = scheduleByDay[dateStr];
              if (!blocks?.length) return null;
              return (
                <div key={dateStr}>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1.5">
                    {format(day, 'EEEE, d MMM')}
                  </p>
                  <div className="space-y-1.5">
                    {blocks
                      .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      .map((block, idx) => {
                        const activity = activities.find((a) => a.name === block.activity_name);
                        return (
                          <Card key={idx} className="p-3 flex items-center gap-3">
                            <div
                              className="w-1 self-stretch rounded-full shrink-0"
                              style={{ backgroundColor: activity?.color ?? '#6366f1' }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)]">{block.activity_name}</p>
                              {block.notes && <p className="text-xs text-[var(--text-muted)]">{block.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-medium text-[var(--text-primary)]">{block.start_time} – {block.end_time}</p>
                              <p className="text-xs text-[var(--text-muted)]">{block.duration_minutes}m</p>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session list */}
      {!sessionsLoading && sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Sessions</h2>
          <div className="space-y-2">
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const daySessions = sessions.filter((s) => s.date === dateStr);
              if (!daySessions.length) return null;
              return (
                <div key={dateStr}>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1.5">
                    {format(day, 'EEEE, d MMM')}
                  </p>
                  {daySessions.map((s) => (
                    <Card key={s.id} className="p-3 flex items-center gap-3 mb-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.activity?.color ?? '#888' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{s.activity?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{format(new Date(s.started_at), 'HH:mm')}</p>
                        {s.notes && <p className="text-xs text-[var(--text-secondary)] italic mt-0.5 truncate">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                          {formatDuration(s.duration_seconds ?? 0)}
                        </span>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                          title="Delete session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual log dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Log Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Activity *</Label>
              <Select value={logForm.activity_id} onValueChange={(v) => setLogForm((f) => ({ ...f, activity_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity" />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={logForm.date}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start time *</Label>
                <Input
                  type="time"
                  value={logForm.start_time}
                  onChange={(e) => setLogForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End time *</Label>
                <Input
                  type="time"
                  value={logForm.end_time}
                  onChange={(e) => setLogForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-[var(--text-muted)] font-normal">(optional)</span></Label>
              <Textarea
                placeholder="What did you work on?"
                value={logForm.notes}
                onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => setLogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={logSubmitting || !logForm.activity_id || !logForm.date || !logForm.start_time || !logForm.end_time}
                className="flex-1"
              >
                {logSubmitting ? 'Saving…' : 'Log Session'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
