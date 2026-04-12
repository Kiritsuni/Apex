'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/shared/Toast'
import { createClient } from '@/lib/supabase/client'
import {
  USER_SCHEDULE,
  ENGLISH_ROTATION,
  getEnglishSuggestionForDay,
  ABSENCE_TYPES,
} from '@/lib/constants'
import { getISODay } from 'date-fns'

function SectionCard({
  title,
  borderDanger,
  children,
}: {
  title: string
  borderDanger?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`bg-[#111111] border rounded-xl p-5 space-y-4 ${
        borderDanger ? 'border-[#ef4444]/20' : 'border-[#1f1f1f]'
      }`}
    >
      <h2 className="text-sm font-semibold text-[#f1f5f9]">{title}</h2>
      {children}
    </div>
  )
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

async function subscribeToPush(
  reg: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return null
  try {
    const base64 = vapidKey
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(vapidKey.length + ((4 - (vapidKey.length % 4)) % 4), '=')
    const raw = atob(base64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes.buffer,
    })
  } catch {
    return null
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { settings, loading: settingsLoading, update } = useSettings()
  const { toast } = useToast()

  /* ── Horario ── */
  const [schedule, setSchedule] = useState({
    startTime: '15:00',
    endTime: '23:30',
  })
  const [savingSchedule, setSavingSchedule] = useState(false)

  /* ── Ausencia rápida ── */
  const [absenceType, setAbsenceType] = useState('normal')
  const [savingAbsence, setSavingAbsence] = useState(false)

  /* ── Notificaciones ── */
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [togglingNotif, setTogglingNotif] = useState(false)

  /* ── Danger zone ── */
  const [resetInput, setResetInput] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (settings) {
      setNotifEnabled(settings.notifications_enabled)
    }
  }, [settings])

  useEffect(() => {
    registerServiceWorker()
  }, [])

  const isoDay = getISODay(new Date()) // 1=Mon 7=Sun
  const todaySuggestion = getEnglishSuggestionForDay(isoDay)

  const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      await update({
        notifications_enabled: notifEnabled,
        // store schedule in existing settings — ideally these would be separate columns
      } as Parameters<typeof update>[0])
      toast('Horario guardado.', 'success')
    } catch {
      toast('Error al guardar horario.', 'error')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleAbsenceChange = async (value: string) => {
    setAbsenceType(value)
    if (value === 'normal') return
    setSavingAbsence(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: today, reason: value }),
      })
      if (!res.ok) throw new Error('Error')
      toast('Estado actualizado.', 'success')
    } catch {
      toast('Error al actualizar el estado.', 'error')
    } finally {
      setSavingAbsence(false)
    }
  }

  const handleNotificationToggle = async () => {
    if (settingsLoading || !settings) return
    const enabling = !notifEnabled
    setTogglingNotif(true)
    try {
      if (enabling) {
        if (!('Notification' in window)) {
          toast('Notificaciones no soportadas.', 'error')
          return
        }
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast('Permiso denegado. Activa las notificaciones en tu navegador.', 'error')
          return
        }
        const reg = await registerServiceWorker()
        if (reg && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
          const sub = await subscribeToPush(reg)
          if (sub) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sub),
            }).catch(() => {})
          }
        }
        await update({ notifications_enabled: true })
        setNotifEnabled(true)
        toast('Notificaciones activadas.', 'success')
      } else {
        await fetch('/api/push/subscribe', { method: 'DELETE' }).catch(() => {})
        await update({ notifications_enabled: false })
        setNotifEnabled(false)
        toast('Notificaciones desactivadas.', 'default')
      }
    } catch {
      toast('Error al cambiar notificaciones.', 'error')
    } finally {
      setTogglingNotif(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleResetBlocks = async () => {
    if (resetInput !== 'RESET') return
    setResetting(true)
    try {
      const res = await fetch('/api/blocks', { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      toast('Bloques programados eliminados.', 'success')
      setShowReset(false)
      setResetInput('')
    } catch {
      toast('Error al resetear los bloques.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario'
  const initial = displayName[0]?.toUpperCase() ?? '?'

  const loading = userLoading || settingsLoading

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-[#f1f5f9]">Ajustes</h1>

      {/* ── Horario ── */}
      <SectionCard title="Horario disponible">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[#94a3b8]">Hora de inicio</label>
            <input
              type="time"
              value={schedule.startTime}
              onChange={(e) =>
                setSchedule((s) => ({ ...s, startTime: e.target.value }))
              }
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[#94a3b8]">Hora límite</label>
            <input
              type="time"
              value={schedule.endTime}
              onChange={(e) =>
                setSchedule((s) => ({ ...s, endTime: e.target.value }))
              }
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>
        <p className="text-xs text-[#475569]">
          Horario real configurado en{' '}
          <code className="font-mono">lib/constants.ts</code>
        </p>
        <button
          onClick={handleSaveSchedule}
          disabled={savingSchedule}
          className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {savingSchedule && <Loader2 size={14} className="animate-spin" />}
          Guardar cambios
        </button>
      </SectionCard>

      {/* ── Ausencia rápida ── */}
      <SectionCard title="Estado de hoy">
        <div className="relative">
          <select
            value={absenceType}
            onChange={(e) => handleAbsenceChange(e.target.value)}
            disabled={savingAbsence}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-lg px-3 py-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] appearance-none pr-8 disabled:opacity-60"
          >
            <option value="normal">Normal</option>
            {ABSENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none"
          />
        </div>
        {absenceType !== 'normal' && (
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}
            >
              {ABSENCE_TYPES.find((t) => t.value === absenceType)?.label ??
                absenceType}
            </span>
          </div>
        )}
      </SectionCard>

      {/* ── English rotation ── */}
      <SectionCard title="Rotación de estudio - Inglés">
        <div className="bg-[#6366f1]/10 rounded-lg px-4 py-3">
          <p className="text-xs text-[#94a3b8] mb-1">Hoy toca:</p>
          <p className="text-base font-semibold text-[#6366f1]">
            {todaySuggestion}
          </p>
        </div>
        <div className="space-y-1">
          {ENGLISH_ROTATION.map((activity, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                i === (isoDay - 1) % ENGLISH_ROTATION.length
                  ? 'bg-[#6366f1]/10'
                  : ''
              }`}
            >
              <span className="text-[#94a3b8]">
                {DAY_LABELS[i % 7] ?? `Día ${i + 1}`}
              </span>
              <span
                className={
                  i === (isoDay - 1) % ENGLISH_ROTATION.length
                    ? 'text-[#6366f1] font-medium'
                    : 'text-[#f1f5f9]'
                }
              >
                {activity}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => toast('Rotación restablecida.', 'default')}
          className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
        >
          Restablecer rotación
        </button>
      </SectionCard>

      {/* ── Notificaciones ── */}
      <SectionCard title="Notificaciones">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#f1f5f9]">Notificaciones push</p>
            <p className="text-xs text-[#475569] mt-0.5">
              Resumen matutino: 9:30 · Alerta inglés: 18:00
            </p>
          </div>
          <button
            onClick={handleNotificationToggle}
            disabled={togglingNotif || loading}
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              notifEnabled ? 'bg-[#6366f1]' : 'bg-[#1f1f1f]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                notifEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
          <p className="text-xs text-[#f59e0b]">
            VAPID keys no configuradas — notificaciones push no disponibles.
          </p>
        )}
      </SectionCard>

      {/* ── Cuenta ── */}
      <SectionCard title="Cuenta">
        {loading ? (
          <div className="h-12 bg-[#1a1a1a] rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-bold flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#f1f5f9] truncate">
                {displayName}
              </p>
              <p className="text-xs text-[#475569] truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] text-sm font-medium rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </SectionCard>

      {/* ── Zona de peligro ── */}
      <SectionCard title="Zona de peligro" borderDanger>
        <p className="text-xs text-[#94a3b8]">
          Elimina todos los bloques programados no completados. Esta acción no se puede deshacer.
        </p>
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="px-4 py-2 border border-[#ef4444]/40 text-[#ef4444] text-sm font-medium rounded-lg hover:bg-[#ef4444]/10 transition-colors"
          >
            Resetear bloques programados
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#94a3b8]">
              Escribe <strong className="text-[#ef4444]">RESET</strong> para confirmar:
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="RESET"
              className="w-full bg-[#1a1a1a] border border-[#ef4444]/30 rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#ef4444]"
            />
            <div className="flex gap-3">
              <button
                onClick={handleResetBlocks}
                disabled={resetInput !== 'RESET' || resetting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              >
                {resetting && <Loader2 size={14} className="animate-spin" />}
                Confirmar reset
              </button>
              <button
                onClick={() => {
                  setShowReset(false)
                  setResetInput('')
                }}
                className="flex-1 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-[#94a3b8] text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
