'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTimerStore } from '@/lib/timer/store'
import { ToastProvider } from '@/components/shared/Toast'
import {
  LayoutDashboard, Calendar, Timer, BookOpen, Target,
  BarChart3, Settings, FileText, Activity, Menu,
  X, LogOut, ChevronRight, Play, Pause, Square
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/week', icon: Calendar, label: 'Semana' },
  { href: '/timer', icon: Timer, label: 'Temporizador' },
  { href: '/exams', icon: BookOpen, label: 'Exámenes' },
  { href: '/goals', icon: Target, label: 'Objetivos' },
  { href: '/stats', icon: BarChart3, label: 'Estadísticas' },
  { href: '/activities', icon: Activity, label: 'Actividades' },
  { href: '/review', icon: FileText, label: 'Review' },
  { href: '/settings', icon: Settings, label: 'Ajustes' },
]

// Mobile shows first 4 + "Más" button
const mobileNavItems = navItems.slice(0, 4)

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const { isActive, isPaused, activityName, activityColor, pauseTimer, resumeTimer, getElapsedSeconds } = useTimerStore()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
    })
  }, [])

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => setElapsed(getElapsedSeconds()), 1000)
    return () => clearInterval(interval)
  }, [isActive, getElapsedSeconds])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario'
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[var(--bg)] overflow-hidden">

        {/* ─── Desktop Sidebar (≥1024px) ─── */}
        <aside className="hidden lg:flex flex-col w-[240px] bg-[var(--surface-1)] border-r border-[var(--border)] h-screen fixed left-0 top-0 z-30">
          {/* Wordmark */}
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <span
              className="text-[18px] font-[600] text-[var(--text-primary)]"
              style={{ letterSpacing: '-0.02em' }}
            >
              APEX
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[14px] font-[500] relative ${
                    active
                      ? 'bg-[rgba(99,102,241,0.12)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] border-l-2 border-transparent'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[13px] font-[600] flex-shrink-0">
                  {firstName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-[500] text-[var(--text-primary)] truncate">{firstName}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[rgba(239,68,68,0.08)] transition-all"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="flex-1 lg:ml-60 flex flex-col h-screen overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            {children}
          </div>
        </main>

        {/* ─── Mobile bottom nav (<1024px) ─── */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border)] z-40"
          style={{ height: '60px', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-around h-full px-2">
            {mobileNavItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-[500]">{label}</span>
                </Link>
              )
            })}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[var(--text-muted)] min-w-[56px]"
            >
              <Menu size={20} />
              <span className="text-[10px] font-[500]">Más</span>
            </button>
          </div>
        </nav>

        {/* ─── Mobile full-screen sheet ─── */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border)] rounded-t-2xl slide-up">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <span className="text-[15px] font-[600] text-[var(--text-primary)]">Menú</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--surface-2)]"
                >
                  <X size={18} className="text-[var(--text-secondary)]" />
                </button>
              </div>
              <div className="px-3 py-3 space-y-0.5">
                {navItems.slice(4).map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-primary)] text-[14px] font-[500] transition-colors"
                  >
                    <Icon size={18} className="text-[var(--text-secondary)]" />
                    {label}
                    <ChevronRight size={14} className="text-[var(--text-muted)] ml-auto" />
                  </Link>
                ))}
              </div>
              <div className="px-3 pb-8">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[var(--danger)] hover:bg-[rgba(239,68,68,0.08)] text-[14px] font-[500] transition-colors"
                >
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Floating timer widget ─── */}
        {isActive && (
          <div className={`fixed z-50 bg-[var(--surface-1)] border border-[rgba(99,102,241,0.4)] rounded-xl px-4 py-3 flex items-center gap-3
            lg:bottom-6 lg:right-6
            bottom-[76px] left-4 right-4 lg:left-auto lg:w-auto`}
          >
            <div
              className="w-2 h-2 rounded-full pulse-dot flex-shrink-0"
              style={{ backgroundColor: activityColor || '#6366F1' }}
            />
            <span className="text-[13px] font-[500] text-[var(--text-primary)] flex-1 truncate">{activityName}</span>
            <span className="timer-display text-[13px] font-[700] text-[var(--accent)]">{formatTime(elapsed)}</span>
            <button
              onClick={() => isPaused ? resumeTimer() : pauseTimer()}
              className="p-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors"
            >
              {isPaused
                ? <Play size={14} className="text-[var(--success)]" />
                : <Pause size={14} className="text-[var(--text-secondary)]" />
              }
            </button>
            <Link href="/timer">
              <button className="p-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors">
                <Square size={14} className="text-[var(--text-secondary)]" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
