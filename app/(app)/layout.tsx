'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTimerStore } from '@/lib/timer/store'
import { ToastProvider } from '@/components/shared/Toast'
import {
  LayoutDashboard, Calendar, Timer, BookOpen, Target,
  BarChart2, Settings2, FileText, Settings, Menu,
  X, LogOut, ChevronRight, Play, Pause, Square
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/week', icon: Calendar, label: 'Semana' },
  { href: '/timer', icon: Timer, label: 'Temporizador' },
  { href: '/exams', icon: BookOpen, label: 'Exámenes' },
  { href: '/goals', icon: Target, label: 'Objetivos' },
  { href: '/stats', icon: BarChart2, label: 'Estadísticas' },
  { href: '/activities', icon: Settings2, label: 'Actividades' },
  { href: '/review', icon: FileText, label: 'Review' },
  { href: '/settings', icon: Settings, label: 'Ajustes' },
]

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
      <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-[220px] bg-[#111111] border-r border-[#1f1f1f] h-screen fixed left-0 top-0 z-30">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-[#1f1f1f]">
            <span className="text-xl font-bold text-[#f1f5f9] tracking-tight">APEX</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                    active
                      ? 'bg-[#6366f1]/10 text-[#6366f1]'
                      : 'text-[#94a3b8] hover:bg-[#1a1a1a] hover:text-[#f1f5f9]'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-[#1f1f1f]">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-sm font-semibold">
                  {firstName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#f1f5f9] truncate">{firstName}</p>
                <p className="text-xs text-[#475569] truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 mt-1 rounded-lg text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/5 transition-all text-sm"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ml-[220px] flex flex-col h-screen overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#1f1f1f] z-40 h-16">
          <div className="flex items-center justify-around h-full px-2">
            {mobileNavItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                    active ? 'text-[#6366f1]' : 'text-[#475569]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              )
            })}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-[#475569] min-w-[60px]"
            >
              <Menu size={20} />
              <span className="text-[10px] font-medium">Más</span>
            </button>
          </div>
        </nav>

        {/* Mobile menu sheet */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-[#111111] border-t border-[#1f1f1f] rounded-t-2xl slide-up">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
                <span className="text-base font-semibold text-[#f1f5f9]">Menú</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-[#1a1a1a]">
                  <X size={18} className="text-[#94a3b8]" />
                </button>
              </div>
              <div className="px-3 py-3 space-y-1">
                {navItems.slice(4).map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1a1a] text-[#f1f5f9] text-sm font-medium transition-colors"
                  >
                    <Icon size={18} className="text-[#94a3b8]" />
                    {label}
                    <ChevronRight size={14} className="text-[#475569] ml-auto" />
                  </Link>
                ))}
              </div>
              <div className="px-3 pb-8">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/5 text-sm font-medium transition-colors"
                >
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating timer widget */}
        {isActive && (
          <div className={`fixed z-50 bg-[#111111] border border-[#6366f1]/50 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3
            md:bottom-6 md:right-6
            bottom-20 left-4 right-4 md:left-auto md:w-auto`}
          >
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: activityColor || '#6366f1' }} />
            <span className="text-sm font-medium text-[#f1f5f9] flex-1 truncate">{activityName}</span>
            <span className="timer-display text-sm font-bold text-[#6366f1]">{formatTime(elapsed)}</span>
            <button
              onClick={() => isPaused ? resumeTimer() : pauseTimer()}
              className="p-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors"
            >
              {isPaused
                ? <Play size={14} className="text-[#22c55e]" />
                : <Pause size={14} className="text-[#94a3b8]" />
              }
            </button>
            <Link href="/timer">
              <button className="p-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors">
                <Square size={14} className="text-[#94a3b8]" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
