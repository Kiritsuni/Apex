'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Activity } from '@/types/database';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch('/api/activities');
      if (!res.ok) throw new Error('Failed to fetch activities');
      setActivities(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const createActivity = useCallback(async (body: Partial<Activity>): Promise<Activity> => {
    const res = await window.fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to create activity');
    const data = await res.json() as Activity;
    setActivities((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
    return data;
  }, []);

  const updateActivity = useCallback(async (id: string, body: Partial<Activity>): Promise<Activity> => {
    const res = await window.fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update activity');
    const data = await res.json() as Activity;
    setActivities((prev) => prev.map((a) => (a.id === id ? data : a)));
    return data;
  }, []);

  const deleteActivity = useCallback(async (id: string): Promise<void> => {
    const res = await window.fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete activity');
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /**
   * Reorder activities atomically: applies an optimistic sort immediately then
   * fires parallel PATCHes. On any error the local state reverts.
   *
   * @param orderedIds Activity IDs in the desired new order (all must be present)
   */
  const reorderActivities = useCallback(async (orderedIds: string[]): Promise<void> => {
    const prev = activities;

    // Build new sort_order values (1-based)
    const updates = orderedIds.map((id, i) => ({ id, sort_order: i + 1 }));

    // Optimistic update
    setActivities((current) => {
      const byId = Object.fromEntries(current.map((a) => [a.id, a]));
      return updates
        .map(({ id, sort_order }) => byId[id] ? { ...byId[id], sort_order } : null)
        .filter((a): a is Activity => a !== null);
    });

    try {
      await Promise.all(
        updates.map(({ id, sort_order }) =>
          window.fetch(`/api/activities/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order }),
          }).then((r) => { if (!r.ok) throw new Error(`Failed to update ${id}`); }),
        ),
      );
    } catch (err) {
      // Revert to the state before the reorder
      setActivities(prev);
      throw err;
    }
  }, [activities]);

  return {
    activities,
    loading,
    error,
    refetch,
    createActivity,
    updateActivity,
    deleteActivity,
    reorderActivities,
  };
}
