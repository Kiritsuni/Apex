'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Target, Trophy, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoals } from '@/hooks/useGoals';
import { useActivities } from '@/hooks/useActivities';
import { useToast } from '@/components/ui/toast';
import type { Goal } from '@/types/database';

export default function GoalsPage() {
  const { active, completed, loading, createGoal, updateGoal, deleteGoal } = useGoals();
  const { activities } = useActivities();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_value: '',
    current_value: '0',
    unit: '',
    deadline: '',
    activity_id: '',
  });

  const resetForm = () => setForm({ title: '', description: '', target_value: '', current_value: '0', unit: '', deadline: '', activity_id: '' });

  const openCreate = () => { resetForm(); setEditGoal(null); setOpen(true); };
  const openEdit = (g: Goal) => {
    setEditGoal(g);
    setForm({
      title: g.title,
      description: g.description ?? '',
      target_value: String(g.target_value),
      current_value: String(g.current_value),
      unit: g.unit ?? '',
      deadline: g.deadline ?? '',
      activity_id: g.activity_id ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.target_value) return;
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        description: form.description || null,
        target_value: parseFloat(form.target_value),
        current_value: parseFloat(form.current_value) || 0,
        unit: form.unit || null,
        deadline: form.deadline || null,
        activity_id: form.activity_id || null,
      };
      if (editGoal) {
        await updateGoal(editGoal.id, body);
        toast({ title: 'Goal updated', variant: 'success' });
      } else {
        await createGoal(body);
        toast({ title: 'Goal created', variant: 'success' });
      }
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (goal: Goal) => {
    try {
      await updateGoal(goal.id, { completed: true });
      toast({ title: 'Goal completed!', variant: 'success' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleQuickUpdate = async (goal: Goal, delta: number) => {
    const newValue = Math.max(0, goal.current_value + delta);
    try {
      await updateGoal(goal.id, { current_value: newValue });
    } catch {
      toast({ title: 'Error updating goal', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      toast({ title: 'Goal removed' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  function GoalCard({ goal }: { goal: Goal }) {
    const pct = goal.target_value > 0 ? Math.min((goal.current_value / goal.target_value) * 100, 100) : 0;
    const activity = activities.find((a) => a.id === goal.activity_id);

    return (
      <Card className="p-4 space-y-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors" onClick={() => openEdit(goal)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {activity && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activity.color }} />}
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{goal.title}</p>
            </div>
            {goal.description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{goal.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {!goal.completed && (
              <button
                onClick={() => handleComplete(goal)}
                className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--success)]/10 transition-colors"
                title="Mark complete"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleDelete(goal.id)}
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>
              {goal.current_value} / {goal.target_value} {goal.unit ?? ''}
            </span>
            <span className="font-medium" style={{ color: pct >= 100 ? 'var(--success)' : undefined }}>
              {Math.round(pct)}%
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        {!goal.completed && (
          <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleQuickUpdate(goal, -1)}
              disabled={goal.current_value <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-[4px] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs text-[var(--text-muted)] flex-1 text-center">
              {goal.unit ? `+1 ${goal.unit}` : 'Quick update'}
            </span>
            <button
              onClick={() => handleQuickUpdate(goal, 1)}
              className="w-7 h-7 flex items-center justify-center rounded-[4px] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
        {goal.deadline && (
          <p className="text-xs text-[var(--text-muted)]">
            Deadline: {new Date(goal.deadline + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Goals</h1>
          <p className="text-[var(--text-secondary)] text-sm">{active.length} active</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              <Target className="h-3.5 w-3.5 mr-1.5" /> Active ({active.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              <Trophy className="h-3.5 w-3.5 mr-1.5" /> Completed ({completed.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="space-y-2 mt-4">
            {active.length === 0 ? (
              <Card className="p-8 text-center text-[var(--text-muted)]">
                <p className="text-sm">No active goals</p>
                <p className="text-xs mt-1">Set a goal to track your progress</p>
              </Card>
            ) : (
              active.map((g) => <GoalCard key={g.id} goal={g} />)
            )}
          </TabsContent>
          <TabsContent value="completed" className="space-y-2 mt-4">
            {completed.length === 0 ? (
              <Card className="p-8 text-center text-[var(--text-muted)]">
                <p className="text-sm">No completed goals yet</p>
              </Card>
            ) : (
              completed.map((g) => <GoalCard key={g.id} goal={g} />)
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editGoal ? 'Edit Goal' : 'New Goal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Read 10 books this year"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target *</Label>
                <Input
                  type="number" min="0" step="any"
                  placeholder="100"
                  value={form.target_value}
                  onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Current</Label>
                <Input
                  type="number" min="0" step="any"
                  value={form.current_value}
                  onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input
                placeholder="e.g. hours, km, books"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Linked Activity</Label>
              <Select value={form.activity_id} onValueChange={(v) => setForm((f) => ({ ...f, activity_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting || !form.title || !form.target_value} className="flex-1">
                {submitting ? 'Saving…' : editGoal ? 'Save Changes' : 'Create Goal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
