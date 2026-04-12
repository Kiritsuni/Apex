'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Exam } from '@/types/database';

export function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch('/api/exams');
      if (!res.ok) throw new Error('Failed to fetch exams');
      const data = await res.json();
      setExams(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createExam = useCallback(async (body: Partial<Exam>) => {
    const res = await window.fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to create exam');
    const data = await res.json();
    setExams((prev) => [...prev, data].sort((a, b) => a.exam_date.localeCompare(b.exam_date)));
    return data as Exam;
  }, []);

  const updateExam = useCallback(async (id: string, body: Partial<Exam>) => {
    const res = await window.fetch(`/api/exams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update exam');
    const data = await res.json();
    setExams((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data as Exam;
  }, []);

  const deleteExam = useCallback(async (id: string) => {
    const res = await window.fetch(`/api/exams/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete exam');
    setExams((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const upcoming = exams.filter((e) => e.status === 'upcoming' && e.exam_date >= new Date().toISOString().split('T')[0]);

  return { exams, upcoming, loading, error, refetch: fetch, createExam, updateExam, deleteExam };
}
