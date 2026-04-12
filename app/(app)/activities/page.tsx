'use client';

import { useState, useRef } from 'react';
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useActivities } from '@/hooks/useActivities';
import { useSessions } from '@/hooks/useSessions';
import { useToast } from '@/components/ui/toast';
import type { Activity } from '@/types/database';

const ICONS = ['BookOpen', 'TrendingUp', 'Dumbbell', 'Activity', 'GraduationCap', 'Code', 'Music', 'Heart', 'Star', 'Zap'];
const CATEGORIES = ['study', 'finance', 'fitness', 'wellness', 'hobby', 'work', 'other'];
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#f97316', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#84cc16'];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ActivitiesPage() {
  const { activities, loading, createActivity, updateActivity, deleteActivity } = useActivities();
  const weekStart = format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
  const weekEnd = format(endOfISOWeek(new Date()), 'yyyy-MM-dd');
  const { sessions } = useSessions({ from: weekStart, to: weekEnd });
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    color: COLORS[0],
    icon: ICONS[0],
    category: 'study',
    weekly_goal_hours: '',
    daily_min_hours: '',
    is_hard_daily_constraint: false,
    weekly_goal_sessions: '',
    session_duration_hours: '',
    market_aware: false,
  });

  // Drag-and-drop state
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const resetForm = () => setForm({
    name: '', color: COLORS[0], icon: ICONS[0], category: 'study',
    weekly_goal_hours: '', daily_min_hours: '', is_hard_daily_constraint: false,
    weekly_goal_sessions: '', session_duration_hours: '', market_aware: false,
  });

  const openCreate = () => { resetForm(); setEditActivity(null); setOpen(true); };
  const openEdit = (a: Activity) => {
    setEditActivity(a);
    setForm({
      name: a.name,
      color: a.color,
      icon: a.icon,
      category: a.category,
      weekly_goal_hours: a.weekly_goal_hours ? String(a.weekly_goal_hours) : '',
      daily_min_hours: a.daily_min_hours ? String(a.daily_min_hours) : '',
      is_hard_daily_constraint: a.is_hard_daily_constraint ?? false,
      weekly_goal_sessions: a.weekly_goal_sessions ? String(a.weekly_goal_sessions) : '',
      session_duration_hours: a.session_duration_hours ? String(a.session_duration_hours) : '',
      market_aware: a.market_aware ?? false,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSubmitting(true);
    try {
      const body: Partial<Activity> = {
        name: form.name,
        color: form.color,
        icon: form.icon,
        category: form.category,
        weekly_goal_hours: form.weekly_goal_hours ? parseFloat(form.weekly_goal_hours) : undefined,
        daily_min_hours: form.daily_min_hours ? parseFloat(form.daily_min_hours) : undefined,
        is_hard_daily_constraint: form.is_hard_daily_constraint,
        weekly_goal_sessions: form.weekly_goal_sessions ? parseInt(form.weekly_goal_sessions) : undefined,
        session_duration_hours: form.session_duration_hours ? parseFloat(form.session_duration_hours) : undefined,
        market_aware: form.market_aware,
        sort_order: editActivity?.sort_order ?? (activities.length + 1),
      };
      if (editActivity) {
        await updateActivity(editActivity.id, body);
        toast({ title: 'Activity updated', variant: 'success' });
      } else {
        await createActivity(body);
        toast({ title: 'Activity created', variant: 'success' });
      }
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteActivity(id);
      toast({ title: 'Activity removed' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // DnD handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent image to suppress default drag ghost for cleaner look
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragId.current) setDragOverId(id);
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const sourceIdx = activities.findIndex((a) => a.id === sourceId);
    const targetIdx = activities.findIndex((a) => a.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    // Build new order
    const reordered = [...activities];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    // Assign new sort_orders
    const updates = reordered.map((a, i) => ({ id: a.id, sort_order: i + 1 }));

    setReordering(true);
    try {
      await Promise.all(updates.map(({ id, sort_order }) => updateActivity(id, { sort_order })));
    } catch {
      toast({ title: 'Error reordering', variant: 'destructive' });
    } finally {
      setReordering(false);
    }
  };

  // Weekly stats per activity
  const weekStats: Record<string, number> = {};
  for (const s of sessions) {
    weekStats[s.activity_id] = (weekStats[s.activity_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Activities</h1>
          <p className="text-[var(--text-secondary)] text-sm">{activities.length} tracked</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      ) : activities.length === 0 ? (
        <Card className="p-8 text-center text-[var(--text-muted)]">
          <p className="text-sm">No activities yet</p>
          <p className="text-xs mt-1">Add activities to start tracking your time</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const weekSecs = weekStats[activity.id] ?? 0;
            const goalSecs = (activity.weekly_goal_hours ?? 0) * 3600;
            const pct = goalSecs > 0 ? Math.min(weekSecs / goalSecs, 1) : null;
            const isDragTarget = dragOverId === activity.id;

            return (
              <Card
                key={activity.id}
                className={`p-4 transition-all ${isDragTarget ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''} ${reordering ? 'opacity-60' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, activity.id)}
                onDragOver={(e) => handleDragOver(e, activity.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, activity.id)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical
                    className="h-4 w-4 text-[var(--text-muted)] shrink-0 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activity.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{activity.name}</span>
                      <Badge variant="secondary" className="text-xs">{activity.category}</Badge>
                      {activity.market_aware && <Badge variant="secondary" className="text-xs">Market</Badge>}
                      {activity.is_hard_daily_constraint && <Badge variant="secondary" className="text-xs">Daily</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                      <span>This week: {formatDuration(weekSecs)}</span>
                      {activity.weekly_goal_hours && (
                        <span>/ {activity.weekly_goal_hours}h goal</span>
                      )}
                      {pct !== null && (
                        <span style={{ color: pct >= 1 ? 'var(--success)' : activity.color }}>
                          {Math.round(pct * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(activity)}
                      className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          <p className="text-xs text-[var(--text-muted)] text-center pt-1">Drag to reorder</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editActivity ? 'Edit Activity' : 'New Activity'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. English C1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Weekly Goal (hours)</Label>
                <Input
                  type="number" min="0" step="0.5"
                  placeholder="e.g. 10"
                  value={form.weekly_goal_hours}
                  onChange={(e) => setForm((f) => ({ ...f, weekly_goal_hours: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Min (hours)</Label>
                <Input
                  type="number" min="0" step="0.5"
                  placeholder="e.g. 1"
                  value={form.daily_min_hours}
                  onChange={(e) => setForm((f) => ({ ...f, daily_min_hours: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Weekly Sessions</Label>
                <Input
                  type="number" min="0"
                  placeholder="e.g. 4"
                  value={form.weekly_goal_sessions}
                  onChange={(e) => setForm((f) => ({ ...f, weekly_goal_sessions: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Session Length (h)</Label>
                <Input
                  type="number" min="0" step="0.5"
                  placeholder="e.g. 1.5"
                  value={form.session_duration_hours}
                  onChange={(e) => setForm((f) => ({ ...f, session_duration_hours: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_hard_daily_constraint}
                  onChange={(e) => setForm((f) => ({ ...f, is_hard_daily_constraint: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[var(--text-secondary)]">Required daily</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.market_aware}
                  onChange={(e) => setForm((f) => ({ ...f, market_aware: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[var(--text-secondary)]">Market hours only</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting || !form.name} className="flex-1">
                {submitting ? 'Saving…' : editActivity ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
