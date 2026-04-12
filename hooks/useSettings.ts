'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserSettings {
  id?: string;
  user_id?: string;
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  push_subscription: string | null;
  created_at?: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();
    setSettings(data);
    return data as UserSettings;
  }, []);

  return { settings, loading, refetch, update };
}
