'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@/types/database';

interface FetchOptions {
  from?: string;
  to?: string;
  activityId?: string;
}

export function useSessions(options: FetchOptions = {}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (opts: FetchOptions = options) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.from) params.set('from', opts.from);
      if (opts.to) params.set('to', opts.to);
      if (opts.activityId) params.set('activity_id', opts.activityId);

      const res = await window.fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.from, options.to, options.activityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createSession = useCallback(async (body: {
    activity_id: string;
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    notes?: string;
  }) => {
    const res = await window.fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    setSessions((prev) => [data, ...prev]);
    return data as Session;
  }, []);

  const updateSession = useCallback(async (id: string, body: Partial<Session>) => {
    const res = await window.fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update session');
    const data = await res.json();
    setSessions((prev) => prev.map((s) => (s.id === id ? data : s)));
    return data as Session;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    const res = await window.fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete session');
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  return { sessions, loading, error, totalSeconds, refetch: fetch, createSession, updateSession, deleteSession };
}
