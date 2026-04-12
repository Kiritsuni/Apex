'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Goal } from '@/types/database';

export interface GoalSuggestion {
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  activity_id: string | null;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch('/api/goals');
      if (!res.ok) throw new Error('Failed to fetch goals');
      setGoals(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const createGoal = useCallback(async (body: Partial<Goal>): Promise<Goal> => {
    const res = await window.fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to create goal');
    const data = await res.json() as Goal;
    setGoals((prev) => [data, ...prev]);
    return data;
  }, []);

  const updateGoal = useCallback(async (id: string, body: Partial<Goal>): Promise<Goal> => {
    const res = await window.fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update goal');
    const data = await res.json() as Goal;
    setGoals((prev) => prev.map((g) => (g.id === id ? data : g)));
    return data;
  }, []);

  const deleteGoal = useCallback(async (id: string): Promise<void> => {
    const res = await window.fetch(`/api/goals/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete goal');
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  /** Ask Claude to suggest new goals based on current activity tracking patterns. */
  const generateSuggestions = useCallback(async (): Promise<GoalSuggestion[]> => {
    setGeneratingSuggestions(true);
    setSuggestions([]);
    try {
      const res = await window.fetch('/api/goals/generate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate suggestions');
      const data = await res.json() as { suggestions: GoalSuggestion[] };
      setSuggestions(data.suggestions ?? []);
      return data.suggestions ?? [];
    } finally {
      setGeneratingSuggestions(false);
    }
  }, []);

  /**
   * Accept a suggestion by creating a goal from it and removing it from the
   * suggestions list.
   */
  const acceptSuggestion = useCallback(async (suggestion: GoalSuggestion): Promise<Goal> => {
    const goal = await createGoal(suggestion);
    setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
    return goal;
  }, [createGoal]);

  const dismissSuggestion = useCallback((title: string) => {
    setSuggestions((prev) => prev.filter((s) => s.title !== title));
  }, []);

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  return {
    goals,
    active,
    completed,
    loading,
    error,
    refetch,
    createGoal,
    updateGoal,
    deleteGoal,
    // AI suggestions
    suggestions,
    generatingSuggestions,
    generateSuggestions,
    acceptSuggestion,
    dismissSuggestion,
  };
}
