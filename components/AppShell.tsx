'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Calendar,
  Timer,
  BookCheck,
  Target,
  Zap,
  FileText,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Week', href: '/week', icon: Calendar },
  { label: 'Timer', href: '/timer', icon: Timer },
  { label: 'Exams', href: '/exams', icon: BookCheck },
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Activities', href: '/activities', icon: Zap },
  { label: 'Stats', href: '/stats', icon: BarChart2 },
  { label: 'Review', href: '/review', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Items shown in the mobile bottom bar (first 4 + Menu)
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4);
// Items shown in the mobile "More" sheet
const MOBILE_MORE_ITEMS = NAV_ITEMS.slice(4);

interface AppShellProps {
  user: User;
  children: React.ReactNode;
}

function NavLink({
  item,
  active,
  onClick,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
        compact && 'justify-center gap-0 px-2'
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!compact && <span>{item.label}</span>}
    </Link>
  );
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const userInitial = (
    user.user_metadata?.full_name?.[0] ||
    user.user_metadata?.name?.[0] ||
    user.email?.[0] ||
    '?'
  ).toUpperCase();

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User';

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] flex-col bg-[var(--surface)] border-r border-[var(--border)] z-30">
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-[var(--border)] shrink-0">
          <span className="text-xl font-black tracking-tighter text-white">APEX</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-[var(--border)] p-3 shrink-0">
          <div className="flex items-center gap-3 px-1 py-1 mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-sm font-semibold select-none">
              {userInitial}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
              {displayName}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 h-16 bg-[var(--surface)] border-t border-[var(--border)] z-30 flex items-center justify-around px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 flex-1 py-1 text-[10px] font-medium transition-colors',
                active
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)]'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More button — opens sheet */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center gap-1 flex-1 py-1 text-[10px] font-medium transition-colors',
                MOBILE_MORE_ITEMS.some(
                  (item) =>
                    pathname === item.href || pathname.startsWith(item.href + '/')
                )
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)]'
              )}
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8 pt-6 px-4 rounded-t-[12px]">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base">More</SheetTitle>
            </SheetHeader>
            <div className="space-y-1">
              {MOBILE_MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </Link>
                );
              })}
            </div>

            {/* User info + sign out in sheet */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-3 px-4 py-2 mb-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-sm font-semibold select-none">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* ── Main content ── */}
      <main className="md:pl-[220px] pb-16 md:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
