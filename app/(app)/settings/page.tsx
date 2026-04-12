'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Bell, Clock, Shield, Key, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useUser } from '@/hooks/useUser';
import { useSettings } from '@/hooks/useSettings';
import { createClient } from '@/lib/supabase/client';
import { USER_SCHEDULE, MARKET_HOURS } from '@/lib/constants';

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

async function subscribeToPush(reg: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
    });
  } catch {
    return null;
  }
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();
  const { settings, loading: settingsLoading, update } = useSettings();

  useEffect(() => { registerServiceWorker(); }, []);

  const loading = userLoading || settingsLoading;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';
  const userInitial = displayName[0]?.toUpperCase() ?? '?';

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleNotificationToggle = async () => {
    if (settingsLoading || !settings) return;
    const enabling = !settings.notifications_enabled;

    if (enabling) {
      if (!('Notification' in window)) {
        toast({ title: 'Notifications not supported', variant: 'destructive' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Enable notifications in your browser settings',
          variant: 'destructive',
        });
        return;
      }
      const reg = await registerServiceWorker();
      if (reg && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        const subscription = await subscribeToPush(reg);
        if (subscription) {
          try {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subscription),
            });
          } catch {}
        }
      }
      try {
        await update({ notifications_enabled: true });
        toast({ title: 'Notifications enabled', variant: 'success' });
      } catch {
        toast({ title: 'Error saving settings', variant: 'destructive' });
      }
    } else {
      try {
        await fetch('/api/push/subscribe', { method: 'DELETE' });
        await update({ notifications_enabled: false });
        toast({ title: 'Notifications disabled' });
      } catch {
        toast({ title: 'Error saving settings', variant: 'destructive' });
      }
    }
  };

  const handleTestNotification = async () => {
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'APEX Test', message: 'Notifications are working!' }),
      });
      if (res.ok) {
        toast({ title: 'Test notification sent', variant: 'success' });
      } else {
        const err = await res.json();
        toast({ title: err.error ?? 'Failed to send', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-secondary)] text-sm">Account and preferences</p>
      </div>

      {/* ── Profile ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-[var(--text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Profile</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-lg font-bold select-none">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-[var(--text-primary)]">{displayName}</p>
              <p className="text-sm text-[var(--text-muted)] truncate">{user?.email}</p>
            </div>
          </div>
        )}

        <Separator />

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 -mx-1 px-3"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </Button>
      </Card>

      {/* ── Notifications ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 text-[var(--text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Notifications</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Push notifications</p>
            <p className="text-xs text-[var(--text-muted)]">Reminders for scheduled activities</p>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-11 rounded-full" />
          ) : (
            <Switch
              checked={settings?.notifications_enabled ?? false}
              onCheckedChange={handleNotificationToggle}
            />
          )}
        </div>

        {settings?.notifications_enabled && (
          <Button variant="secondary" size="sm" onClick={handleTestNotification} className="text-xs">
            Send test notification
          </Button>
        )}

        {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
          <div className="rounded-[6px] bg-[var(--warning)]/10 border border-[var(--warning)]/30 p-3 flex items-start gap-2">
            <Key className="h-3.5 w-3.5 text-[var(--warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--warning)]">
              VAPID keys not configured — push notifications unavailable.{' '}
              Run <code className="font-mono">npx web-push generate-vapid-keys</code> and add to{' '}
              <code className="font-mono">.env.local</code>.
            </p>
          </div>
        )}
      </Card>

      {/* ── Schedule ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-[var(--text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Schedule</h2>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Mon – Tue</p>
              <Row label="Wake" value={USER_SCHEDULE.MON_TUE.wakeTime} />
              <Row label="Home" value={USER_SCHEDULE.MON_TUE.homeArrival} />
              <Row label="Available" value={USER_SCHEDULE.MON_TUE.earliestAvailable} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Wed – Fri</p>
              <Row label="Wake" value={USER_SCHEDULE.WED_FRI.wakeTime} />
              <Row label="Home" value={USER_SCHEDULE.WED_FRI.homeArrival} />
              <Row label="Available" value={USER_SCHEDULE.WED_FRI.earliestAvailable} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Row label="Weekend available from" value={USER_SCHEDULE.WEEKEND.earliestAvailable} />
            <Row label="Daily cutoff" value={USER_SCHEDULE.defaultCutoff} />
            <Row label="Hard cutoff" value={USER_SCHEDULE.hardCutoff} />
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">US Market (CET)</p>
            <Row label="Open – Close" value={`${MARKET_HOURS.open} – ${MARKET_HOURS.close}`} />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Edit in <code className="font-mono">lib/constants.ts</code> — used by the AI scheduler.
        </p>
      </Card>

      {/* ── About ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-[var(--text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">About</h2>
        </div>
        <div className="space-y-2">
          <Row label="App" value="APEX Performance System" />
          <Row label="Version" value="0.1.0" />
          <Row label="Runtime" value="Next.js 16 · Turbopack" />
        </div>
      </Card>
    </div>
  );
}
