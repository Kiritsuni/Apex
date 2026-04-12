'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { Play, Pause, Square, Clock, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useActivities } from '@/hooks/useActivities';
import { useTimerStore } from '@/lib/timer/store';
import { useToast } from '@/components/ui/toast';
import type { Session } from '@/types/database';

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export default function TimerPage() {
  const { activities, loading: actLoading } = useActivities();
  const { isActive, isPaused, activityId, activityName, activityColor, sessionId, startTime,
    startTimer, pauseTimer, resumeTimer, stopTimer, getElapsedSeconds } = useTimerStore();
  const { toast } = useToast();

  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [elapsed, setElapsed] = useState(0);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
  const weekEnd = format(endOfISOWeek(new Date()), 'yyyy-MM-dd');

  const fetchRecent = useCallback(async () => {
    const res = await fetch(`/api/sessions?from=${weekStart}&to=${weekEnd}`);
    if (res.ok) setRecentSessions(await res.json());
  }, [weekStart, weekEnd]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    setElapsed(getElapsedSeconds());
    const interval = setInterval(() => setElapsed(getElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, [isActive, isPaused, getElapsedSeconds]);

  // Pre-select if timer already running
  useEffect(() => {
    if (activityId) setSelectedActivityId(activityId);
    else if (activities.length > 0 && !selectedActivityId) setSelectedActivityId(activities[0].id);
  }, [activityId, activities, selectedActivityId]);

  const handleStart = async () => {
    const activity = activities.find((a) => a.id === selectedActivityId);
    if (!activity) return;

    const started_at = new Date().toISOString();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: activity.id, started_at }),
    });
    if (!res.ok) { toast({ title: 'Error', description: 'Could not start session', variant: 'destructive' }); return; }
    const session = await res.json();
    startTimer(activity.id, activity.name, activity.color, session.id);
  };

  const saveStop = async (notes: string) => {
    if (!sessionId || !startTime) return;
    setSaving(true);
    const ended_at = new Date().toISOString();
    const duration_seconds = getElapsedSeconds();

    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ended_at, duration_seconds, notes: notes || null }),
    });

    stopTimer();
    setStopDialogOpen(false);
    setSessionNotes('');
    setSaving(false);

    if (res.ok) {
      toast({ title: 'Session saved', description: `${formatDuration(duration_seconds)} tracked`, variant: 'success' });
      fetchRecent();
    } else {
      toast({ title: 'Error', description: 'Could not save session', variant: 'destructive' });
    }
  };

  const handleDeleteSession = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRecentSessions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: 'Session deleted' });
    } else {
      toast({ title: 'Error deleting session', variant: 'destructive' });
    }
  };

  const selectedActivity = activities.find((a) => a.id === (activityId ?? selectedActivityId));
  const ringColor = selectedActivity?.color ?? '#6366f1';

  const targetSeconds = (selectedActivity?.daily_min_hours ?? 1) * 3600;
  const pct = Math.min(elapsed / targetSeconds, 1);
  const size = 200;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const todayForActivity = recentSessions
    .filter((s) => s.activity_id === (activityId ?? selectedActivityId) && s.date === today)
    .reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Timer</h1>
        <p className="text-[var(--text-secondary)] text-sm">{format(new Date(), 'EEEE, d MMMM')}</p>
      </div>

      {/* Activity selector */}
      {!isActive && (
        <div className="grid grid-cols-1 gap-2">
          {actLoading ? (
            <p className="text-[var(--text-muted)] text-sm">Loading activities…</p>
          ) : (
            activities.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedActivityId(a.id)}
                className={`flex items-center gap-3 p-3 rounded-[8px] border text-left transition-colors ${
                  selectedActivityId === a.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-sm font-medium text-[var(--text-primary)]">{a.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Timer ring */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={ringColor} strokeWidth={10}
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              className="progress-ring-circle"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isActive && (
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">{activityName}</p>
            )}
            <p className="timer-display text-4xl font-bold text-[var(--text-primary)]">
              {formatElapsed(elapsed)}
            </p>
            {isActive && isPaused && (
              <p className="text-xs text-[var(--warning)] mt-1">Paused</p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isActive ? (
            <Button
              onClick={handleStart}
              disabled={!selectedActivityId}
              className="h-14 px-10 text-base font-semibold rounded-full"
              style={{ backgroundColor: ringColor }}
            >
              <Play className="h-5 w-5 mr-2" fill="currentColor" />
              Start
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={isPaused ? resumeTimer : pauseTimer}
                className="h-12 w-12 rounded-full p-0"
              >
                {isPaused ? <Play className="h-5 w-5" fill="currentColor" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button
                onClick={() => setStopDialogOpen(true)}
                variant="destructive"
                className="h-12 px-8 rounded-full font-semibold"
              >
                <Square className="h-4 w-4 mr-2" fill="currentColor" />
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Today's total */}
        {todayForActivity > 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            Today: <span className="font-semibold text-[var(--text-primary)]">{formatDuration(todayForActivity)}</span> total
          </p>
        )}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">This week</h2>
          <div className="space-y-2">
            {recentSessions.slice(0, 10).map((s) => (
              <Card key={s.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.activity?.color ?? '#888' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{s.activity?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{format(new Date(s.started_at), 'EEE d MMM · HH:mm')}</p>
                    {s.notes && <p className="text-xs text-[var(--text-secondary)] italic mt-0.5 truncate">{s.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">{formatDuration(s.duration_seconds ?? 0)}</span>
                  </div>
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
        </div>
      )}

      {/* Stop session dialog */}
      <Dialog open={stopDialogOpen} onOpenChange={(o) => { if (!o && !saving) { setStopDialogOpen(false); setSessionNotes(''); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Save Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{formatElapsed(elapsed)}</span> tracked for <span className="font-medium">{activityName}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Notes <span className="text-[var(--text-muted)] font-normal">(optional)</span></Label>
            <Textarea
              placeholder="What did you work on?"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => saveStop('')}
              disabled={saving}
              className="flex-1"
            >
              Skip
            </Button>
            <Button
              onClick={() => saveStop(sessionNotes)}
              disabled={saving}
              className="flex-1"
            >
              {saving ? 'Saving…' : 'Save Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
