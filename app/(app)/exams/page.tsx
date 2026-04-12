'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, CheckCircle2, Clock, MapPin, Edit2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useExams } from '@/hooks/useExams';
import { useToast } from '@/components/ui/toast';
import { SUBJECTS } from '@/lib/constants';
import type { Exam } from '@/types/database';

const STATUS_LABELS: Record<Exam['status'], string> = {
  upcoming: 'Upcoming',
  done: 'Done',
  cancelled: 'Cancelled',
};

const EMPTY_FORM = { subject: '', topic: '', exam_date: '', exam_time: '', location: '', notes: '' };

export default function ExamsPage() {
  const { exams, loading, createExam, updateExam, deleteExam } = useExams();
  const { toast } = useToast();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = exams.filter((e) => e.status === 'upcoming');
  const past = exams.filter((e) => e.status !== 'upcoming' || e.exam_date < today);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.subject || !createForm.exam_date) return;
    setCreateSubmitting(true);
    try {
      await createExam({
        subject: createForm.subject,
        topic: createForm.topic || null,
        exam_date: createForm.exam_date,
        exam_time: createForm.exam_time || null,
        location: createForm.location || null,
        notes: createForm.notes || null,
      });
      toast({ title: 'Exam added', variant: 'success' });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    } catch {
      toast({ title: 'Error adding exam', variant: 'destructive' });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setEditForm({
      subject: exam.subject,
      topic: exam.topic ?? '',
      exam_date: exam.exam_date,
      exam_time: exam.exam_time ?? '',
      location: exam.location ?? '',
      notes: exam.notes ?? '',
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam || !editForm.subject || !editForm.exam_date) return;
    setEditSubmitting(true);
    try {
      await updateExam(editingExam.id, {
        subject: editForm.subject,
        topic: editForm.topic || null,
        exam_date: editForm.exam_date,
        exam_time: editForm.exam_time || null,
        location: editForm.location || null,
        notes: editForm.notes || null,
      });
      toast({ title: 'Exam updated', variant: 'success' });
      setEditOpen(false);
      setEditingExam(null);
    } catch {
      toast({ title: 'Error updating exam', variant: 'destructive' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleMarkDone = async (exam: Exam) => {
    try {
      await updateExam(exam.id, { status: 'done' });
      toast({ title: 'Marked as done', variant: 'success' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExam(id);
      toast({ title: 'Exam removed' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  function ExamForm({
    form,
    setForm,
    onSubmit,
    submitting,
    onCancel,
    isCreate,
  }: {
    form: typeof EMPTY_FORM;
    setForm: (fn: (f: typeof EMPTY_FORM) => typeof EMPTY_FORM) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitting: boolean;
    onCancel: () => void;
    isCreate: boolean;
  }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Subject *</Label>
          <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Topic / Chapter</Label>
          <Input
            placeholder="e.g. Unit 3 — Vocabulary"
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={form.exam_date}
              onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={form.exam_time}
              onChange={(e) => setForm((f) => ({ ...f, exam_time: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            placeholder="e.g. Classroom 3B"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !form.subject || !form.exam_date} className="flex-1">
            {submitting ? 'Saving…' : isCreate ? 'Add Exam' : 'Save Changes'}
          </Button>
        </div>
      </form>
    );
  }

  function ExamCard({ exam }: { exam: Exam }) {
    const daysUntil = Math.ceil((new Date(exam.exam_date).getTime() - new Date(today).getTime()) / 86400000);
    const isUrgent = daysUntil <= 2 && exam.status === 'upcoming';
    const isWarning = daysUntil <= 5 && daysUntil > 2 && exam.status === 'upcoming';

    return (
      <Card className={`p-4 space-y-2 ${isUrgent ? 'border-[var(--danger)]/50' : isWarning ? 'border-[var(--warning)]/50' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{exam.subject}</span>
              <Badge
                variant={exam.status === 'done' ? 'secondary' : exam.status === 'cancelled' ? 'secondary' : 'default'}
                className={exam.status === 'upcoming' && isUrgent ? 'bg-[var(--danger)] text-white' : ''}
              >
                {STATUS_LABELS[exam.status]}
              </Badge>
            </div>
            {exam.topic && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{exam.topic}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => openEdit(exam)}
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              title="Edit exam"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {exam.status === 'upcoming' && (
              <button
                onClick={() => handleMarkDone(exam)}
                className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--success)]/10 transition-colors"
                title="Mark done"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleDelete(exam.id)}
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>{format(new Date(exam.exam_date + 'T12:00:00'), 'EEE, d MMM yyyy')}</span>
          {exam.exam_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {exam.exam_time}
            </span>
          )}
          {exam.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {exam.location}
            </span>
          )}
          {exam.status === 'upcoming' && (
            <span style={{ color: isUrgent ? 'var(--danger)' : isWarning ? 'var(--warning)' : undefined }}>
              {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : daysUntil > 0 ? `${daysUntil}d` : 'Past'}
            </span>
          )}
        </div>
        {exam.notes && <p className="text-xs text-[var(--text-muted)] italic">{exam.notes}</p>}
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Exams</h1>
          <p className="text-[var(--text-secondary)] text-sm">{upcoming.length} upcoming</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Upcoming</h2>
              {upcoming.sort((a, b) => a.exam_date.localeCompare(b.exam_date)).map((e) => (
                <ExamCard key={e.id} exam={e} />
              ))}
            </div>
          )}
          {upcoming.length === 0 && past.length === 0 && (
            <Card className="p-8 text-center text-[var(--text-muted)]">
              <p className="text-sm">No exams scheduled</p>
              <p className="text-xs mt-1">Add your first exam to get started</p>
            </Card>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Past</h2>
              {past.sort((a, b) => b.exam_date.localeCompare(a.exam_date)).map((e) => (
                <ExamCard key={e.id} exam={e} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exam</DialogTitle>
          </DialogHeader>
          <ExamForm
            form={createForm}
            setForm={setCreateForm}
            onSubmit={handleCreate}
            submitting={createSubmitting}
            onCancel={() => setCreateOpen(false)}
            isCreate
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditingExam(null); } }}>
        <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
          </DialogHeader>
          <ExamForm
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleEdit}
            submitting={editSubmitting}
            onCancel={() => { setEditOpen(false); setEditingExam(null); }}
            isCreate={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
