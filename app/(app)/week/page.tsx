'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Sparkles, Plus, X, Check, Trash2 } from 'lucide-react'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import type { Activity, ScheduledBlock } from '@/types/database'

// ─── Timeline constants ───────────────────────────────────────────────────────

const HOUR_START = 8   // 08:00
const HOUR_END = 24    // 00:00 (midnight)
const HOUR_HEIGHT = 56 // px per hour
const TIMELINE_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT // 896px

const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const DAY_ABBREVS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

interface AIBlock {
  date: string
  activity_name: string
  start_time: string
  end_time: string
  duration_minutes: number
  notes: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToTopPx(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return Math.max(0, ((h * 60 + m - HOUR_START * 60) / 60) * HOUR_HEIGHT)
}

function durationToHeightPx(minutes: number): number {
  return Math.max((minutes / 60) * HOUR_HEIGHT, 20)
}

function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + durationMinutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

// ─── Duration presets ─────────────────────────────────────────────────────────

const DURATION_PILLS = [
  { label: '30min', mins: 30 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
  { label: '2h', mins: 120 },
]

// ─── Block Modal (add / edit) ─────────────────────────────────────────────────

function BlockModal({
  mode,
  initial,
  activities,
  onClose,
  onSave,
  onDelete,
  onComplete,
}: {
  mode: 'add' | 'edit'
  initial: { date: string; time?: string; block?: ScheduledBlock }
  activities: Activity[]
  onClose: () => void
  onSave: (data: {
    activity_id: string
    scheduled_date: string
    start_time: string
    duration_minutes: number
    notes: string
  }) => Promise<void>
  onDelete?: () => Promise<void>
  onComplete?: () => Promise<void>
}) {
  const [activityId, setActivityId] = useState(
    initial.block?.activity_id ?? activities[0]?.id ?? ''
  )
  const [date, setDate] = useState(initial.block?.scheduled_date ?? initial.date)
  const [startTime, setStartTime] = useState(
    initial.block?.start_time?.substring(0, 5) ?? initial.time ?? '09:00'
  )
  const [selectedMins, setSelectedMins] = useState(initial.block?.duration_minutes ?? 60)
  const [useCustom, setUseCustom] = useState(
    initial.block
      ? !DURATION_PILLS.some(p => p.mins === initial.block!.duration_minutes)
      : false
  )
  const [customMins, setCustomMins] = useState(String(initial.block?.duration_minutes ?? ''))
  const [notes, setNotes] = useState(initial.block?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const finalMins = useCustom ? (parseInt(customMins) || 60) : selectedMins

  async function handleSave() {
    setSaving(true)
    await onSave({
      activity_id: activityId,
      scheduled_date: date,
      start_time: startTime,
      duration_minutes: finalMins,
      notes,
    })
    setSaving(false)
  }

  return (
    /* Bottom sheet on mobile, right drawer on desktop */
    <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full lg:w-[400px] lg:h-full bg-[var(--surface-1)] border border-[var(--border)] rounded-t-2xl lg:rounded-none lg:border-l lg:border-t-0 lg:border-r-0 lg:border-b-0 p-6 space-y-5 max-h-[90vh] lg:max-h-full overflow-y-auto">

        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-[600] text-[var(--text-primary)]" style={{ letterSpacing: '-0.01em' }}>
            {mode === 'add' ? 'Añadir bloque' : 'Editar bloque'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]">
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Activity selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-[500] text-[var(--text-muted)] uppercase tracking-wider">
            Actividad
          </label>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {activities.map(a => (
              <button
                key={a.id}
                onClick={() => setActivityId(a.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-left transition-colors ${
                  activityId === a.id
                    ? 'border-[var(--accent)] bg-[rgba(99,102,241,0.12)]'
                    : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <span className="text-[14px] font-[500] text-[var(--text-primary)]">{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date + start time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-[500] text-[var(--text-muted)]">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-[500] text-[var(--text-muted)]">Hora inicio</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-[11px] font-[500] text-[var(--text-muted)] uppercase tracking-wider">
            Duración
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PILLS.map(p => (
              <button
                key={p.mins}
                onClick={() => { setSelectedMins(p.mins); setUseCustom(false) }}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-[500] border transition-colors ${
                  !useCustom && selectedMins === p.mins
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[rgba(99,102,241,0.5)]'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-[500] border transition-colors ${
                useCustom
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[rgba(99,102,241,0.5)]'
              }`}
            >
              Custom
            </button>
          </div>
          {useCustom && (
            <input
              type="number"
              min={5}
              max={600}
              placeholder="Minutos"
              value={customMins}
              onChange={e => setCustomMins(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-[500] text-[var(--text-muted)]">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>

        {/* Primary actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-[var(--border)] rounded-[10px] text-[13px] font-[500] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !activityId || !date || !startTime}
            className="flex-1 py-3 bg-[var(--accent)] rounded-[10px] text-[13px] font-[600] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : mode === 'add' ? 'Guardar bloque' : 'Guardar cambios'}
          </button>
        </div>

        {/* Secondary (edit-only) actions */}
        {mode === 'edit' && (
          <div className="flex gap-3">
            {onComplete && (
              <button
                onClick={onComplete}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] rounded-[10px] text-[12px] font-[500] text-[var(--success)] hover:bg-[rgba(16,185,129,0.15)] transition-colors"
              >
                <Check size={14} /> Completado
              </button>
            )}
            {onDelete && (
              <button
                onClick={async () => { setDeleting(true); await onDelete?.(); setDeleting(false) }}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[10px] text-[12px] font-[500] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
              >
                <Trash2 size={14} />
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Diff Modal ───────────────────────────────────────────────────────────────

function DiffModal({
  currentBlocks,
  newBlocks,
  activities,
  todayStr,
  onApply,
  onCancel,
}: {
  currentBlocks: ScheduledBlock[]
  newBlocks: AIBlock[]
  activities: Activity[]
  todayStr: string
  onApply: () => Promise<void>
  onCancel: () => void
}) {
  const [applying, setApplying] = useState(false)
  const futureBlocks = currentBlocks.filter(b => b.scheduled_date >= todayStr)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 space-y-5 max-h-[80vh] flex flex-col">

        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="text-[16px] font-[600] text-[var(--text-primary)]">Propuesta de Claude</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]">
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {futureBlocks.length > 0 && (
            <div>
              <p className="text-[11px] font-[600] text-[var(--danger)] uppercase tracking-wider mb-2">
                Se eliminan ({futureBlocks.length})
              </p>
              <div className="space-y-1">
                {futureBlocks.map(b => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-2 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] rounded-[10px]"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.activity?.color ?? '#EF4444' }}
                    />
                    <span className="text-[12px] text-[var(--text-primary)]">
                      {b.scheduled_date} · {b.activity?.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] ml-auto">
                      {b.start_time.substring(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-[600] text-[var(--success)] uppercase tracking-wider mb-2">
              Se añaden ({newBlocks.length})
            </p>
            <div className="space-y-1">
              {newBlocks.map((b, i) => {
                const act = activities.find(a => a.name === b.activity_name)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.15)] rounded-[10px]"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: act?.color ?? '#10B981' }}
                    />
                    <span className="text-[12px] text-[var(--text-primary)]">
                      {b.date} · {b.activity_name}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] ml-auto">
                      {b.start_time} · {fmtMins(b.duration_minutes)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-[var(--border)] rounded-[10px] text-[13px] font-[500] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={async () => { setApplying(true); await onApply(); setApplying(false) }}
            disabled={applying}
            className="flex-1 py-3 bg-[var(--accent)] rounded-[10px] text-[13px] font-[600] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {applying ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Block ───────────────────────────────────────────────────────────

function TimelineBlock({
  block,
  onClick,
}: {
  block: ScheduledBlock
  onClick: () => void
}) {
  const color = block.activity?.color ?? '#6366F1'
  const top = timeToTopPx(block.start_time)
  const height = durationToHeightPx(block.duration_minutes)
  const st = block.start_time.substring(0, 5)
  const et = endTime(block.start_time, block.duration_minutes)

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded-[6px] overflow-hidden cursor-pointer hover:brightness-110 transition-all select-none ${
        block.is_completed ? 'opacity-40' : ''
      } ${block.is_tentative ? 'opacity-70' : ''}`}
      style={{
        top: top + 'px',
        height: height + 'px',
        backgroundColor: color + '1f', // ~12% opacity
        borderLeft: `2px solid ${color}`,
      }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <div className="px-1.5 pt-0.5">
        <p
          className={`text-[12px] font-[500] text-white leading-tight truncate ${
            block.is_completed ? 'line-through' : ''
          }`}
        >
          {block.activity?.name ?? '—'}
        </p>
        {height >= 38 && (
          <p className="text-[11px] text-[var(--text-secondary)] leading-none mt-0.5">
            {st}–{et}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeekPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [blocks, setBlocks] = useState<ScheduledBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState<{ date: string; time?: string } | null>(null)
  const [editBlock, setEditBlock] = useState<ScheduledBlock | null>(null)
  const [reorganizing, setReorganizing] = useState(false)
  const [diffData, setDiffData] = useState<AIBlock[] | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const touchStartX = useRef<number | null>(null)

  const { activities } = useActivities()
  const { toast } = useToast()

  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const isCurrentWeek = weekStartStr === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Current time tick
  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(iv)
  }, [])

  // Fetch blocks for the week
  const fetchBlocks = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/blocks?from=${from}&to=${to}`)
      if (res.ok) setBlocks(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBlocks(weekStartStr, weekEndStr)
  }, [weekStartStr, weekEndStr, fetchBlocks])

  // Navigate weeks
  function prevWeek() {
    setCurrentWeekStart(d => subWeeks(d, 1))
    setSelectedDay(d => addDays(d, -7))
  }
  function nextWeek() {
    setCurrentWeekStart(d => addWeeks(d, 1))
    setSelectedDay(d => addDays(d, 7))
  }
  function goToday() {
    const now = new Date()
    setCurrentWeekStart(startOfWeek(now, { weekStartsOn: 1 }))
    setSelectedDay(now)
  }

  // Block CRUD
  async function handleAddBlock(data: {
    activity_id: string
    scheduled_date: string
    start_time: string
    duration_minutes: number
    notes: string
  }) {
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const newBlock: ScheduledBlock = await res.json()
      setBlocks(prev =>
        [...prev, newBlock].sort(
          (a, b) =>
            a.scheduled_date.localeCompare(b.scheduled_date) ||
            a.start_time.localeCompare(b.start_time)
        )
      )
      setAddModal(null)
      toast('Bloque añadido', 'success')
    } else {
      toast('Error al guardar el bloque', 'error')
    }
  }

  async function handleEditBlock(data: {
    activity_id: string
    scheduled_date: string
    start_time: string
    duration_minutes: number
    notes: string
  }) {
    if (!editBlock) return
    const res = await fetch(`/api/blocks/${editBlock.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated: ScheduledBlock = await res.json()
      setBlocks(prev => prev.map(b => (b.id === updated.id ? updated : b)))
      setEditBlock(null)
      toast('Bloque actualizado', 'success')
    } else {
      toast('Error al actualizar el bloque', 'error')
    }
  }

  async function handleDeleteBlock() {
    if (!editBlock) return
    const res = await fetch(`/api/blocks/${editBlock.id}`, { method: 'DELETE' })
    if (res.ok) {
      setBlocks(prev => prev.filter(b => b.id !== editBlock.id))
      setEditBlock(null)
      toast('Bloque eliminado', 'success')
    } else {
      toast('Error al eliminar el bloque', 'error')
    }
  }

  async function handleCompleteBlock() {
    if (!editBlock) return
    const res = await fetch(`/api/blocks/${editBlock.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !editBlock.is_completed }),
    })
    if (res.ok) {
      const updated: ScheduledBlock = await res.json()
      setBlocks(prev => prev.map(b => (b.id === updated.id ? updated : b)))
      setEditBlock(null)
    }
  }

  // AI Reorganize
  async function handleReorganize() {
    setReorganizing(true)
    try {
      const res = await fetch('/api/scheduling/reorganize', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body.error ?? 'Error al reorganizar con IA', 'error')
        return
      }
      const { blocks: aiBlocks } = await res.json()
      setDiffData(aiBlocks ?? [])
    } catch {
      toast('Error al reorganizar con IA', 'error')
    } finally {
      setReorganizing(false)
    }
  }

  async function handleApplyDiff() {
    if (!diffData) return
    // Delete future non-completed blocks
    const futureBlocks = blocks.filter(b => b.scheduled_date >= todayStr && !b.is_completed)
    for (const b of futureBlocks) {
      await fetch(`/api/blocks/${b.id}`, { method: 'DELETE' })
    }
    // Create new AI blocks
    for (const aiBlock of diffData) {
      const activity = activities.find(a => a.name === aiBlock.activity_name)
      if (!activity) continue
      await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          scheduled_date: aiBlock.date,
          start_time: aiBlock.start_time,
          duration_minutes: aiBlock.duration_minutes,
          notes: aiBlock.notes ?? null,
          is_tentative: true,
        }),
      })
    }
    setDiffData(null)
    await fetchBlocks(weekStartStr, weekEndStr)
    toast('Semana reorganizada', 'success')
  }

  // Click on timeline to add a block
  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutesFromStart = Math.floor((y / HOUR_HEIGHT) * 60)
    const totalMins = HOUR_START * 60 + minutesFromStart
    const snappedMins = Math.floor(totalMins / 15) * 15
    const hour = Math.floor(snappedMins / 60)
    const minute = snappedMins % 60
    setAddModal({
      date: dateStr,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    })
  }

  // Mobile swipe to change day
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      setSelectedDay(d => addDays(d, dx < 0 ? 1 : -1))
    }
    touchStartX.current = null
  }

  // Stats
  const totalWeekMins = blocks.reduce((acc, b) => acc + b.duration_minutes, 0)
  const blocksByActivity: Record<string, number> = {}
  for (const b of blocks) {
    blocksByActivity[b.activity_id] = (blocksByActivity[b.activity_id] ?? 0) + b.duration_minutes * 60
  }

  // Current time position
  const ctHH = String(currentTime.getHours()).padStart(2, '0')
  const ctMM = String(currentTime.getMinutes()).padStart(2, '0')
  const currentTimeTop = timeToTopPx(`${ctHH}:${ctMM}`)

  // Week header label
  const weekLabel = `${format(weekStart, 'd')}–${format(weekEnd, 'd MMM', { locale: es })}`

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

      {/* ─── Top navigation bar ─── */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-3 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
        <button
          onClick={prevWeek}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
        </button>

        <span className="flex-1 text-[14px] font-[600] text-[var(--text-primary)] text-center">
          {weekLabel}
        </span>

        <button
          onClick={nextWeek}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronRight size={16} className="text-[var(--text-secondary)]" />
        </button>

        <button
          onClick={goToday}
          className="px-3 py-1.5 text-[12px] font-[500] text-[var(--accent)] border border-[rgba(99,102,241,0.3)] rounded-lg hover:bg-[rgba(99,102,241,0.08)] transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* ─── DESKTOP: 7-column timeline (≥1024px) ─── */}
      <div className="hidden lg:flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Column headers */}
        <div className="flex-shrink-0 flex bg-[var(--surface-1)] border-b border-[var(--border)]">
          {/* Time rail spacer */}
          <div className="flex-shrink-0 w-12" />
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isToday = dateStr === todayStr
            return (
              <div
                key={dateStr}
                className="flex-1 py-3 text-center border-l border-[var(--border)]"
              >
                <p className="text-[11px] font-[500] text-[var(--text-muted)] uppercase tracking-wider">
                  {DAY_ABBREVS[i]}
                </p>
                <p
                  className="text-[16px] font-[500] mt-0.5"
                  style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  {format(day, 'd')}
                </p>
                {isToday && (
                  <div className="mx-auto mt-1 w-6 h-[2px] rounded-full bg-[var(--accent)]" />
                )}
              </div>
            )
          })}
        </div>

        {/* Scrollable timeline body */}
        <div className="flex flex-1 overflow-y-auto" style={{ minHeight: 0 }}>

          {/* Time rail */}
          <div
            className="flex-shrink-0 w-12 relative select-none"
            style={{ height: TIMELINE_HEIGHT }}
          >
            {HOURS.filter((_, i) => i % 2 === 0 && i < HOURS.length - 1).map(h => (
              <div
                key={h}
                className="absolute right-0 pr-2 flex items-center"
                style={{ top: (h - HOUR_START) * HOUR_HEIGHT - 8 }}
              >
                <span className="text-[11px] text-[var(--text-muted)]">
                  {String(h % 24).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, _i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isToday = dateStr === todayStr
            const dayBlocks = blocks.filter(b => b.scheduled_date === dateStr)

            return (
              <div
                key={dateStr}
                className="flex-1 relative border-l border-[var(--border)] cursor-crosshair"
                style={{ height: TIMELINE_HEIGHT }}
                onClick={e => handleColumnClick(e, dateStr)}
              >
                {/* Hour dividers */}
                {HOURS.slice(1).map(h => (
                  <div
                    key={h}
                    className={`absolute left-0 right-0 ${
                      h % 2 === 0 ? 'timeline-hour-line-major' : 'timeline-hour-line'
                    }`}
                    style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Blocks */}
                {dayBlocks.map(block => (
                  <TimelineBlock
                    key={block.id}
                    block={block}
                    onClick={() => setEditBlock(block)}
                  />
                ))}

                {/* Current time indicator */}
                {isToday && currentTimeTop >= 0 && currentTimeTop <= TIMELINE_HEIGHT && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[var(--danger)] -ml-1 flex-shrink-0" />
                      <div className="flex-1 h-[1px] bg-[var(--danger)]" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── MOBILE: single-day timeline (<1024px) ─── */}
      <div className="lg:hidden flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Sticky day tabs */}
        <div className="flex-shrink-0 flex overflow-x-auto hide-scrollbar bg-[var(--surface-1)] border-b border-[var(--border)]">
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isSelected = format(selectedDay, 'yyyy-MM-dd') === dateStr
            const isToday = dateStr === todayStr
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 px-4 py-2.5 text-center transition-colors ${
                  isSelected
                    ? 'border-b-2 border-[var(--accent)]'
                    : 'border-b-2 border-transparent'
                }`}
              >
                <p
                  className={`text-[10px] font-[500] uppercase tracking-wider ${
                    isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {DAY_ABBREVS[i]}
                </p>
                <p
                  className="text-[14px] font-[500] mt-0.5"
                  style={{
                    color: isToday
                      ? 'var(--accent)'
                      : isSelected
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  }}
                >
                  {format(day, 'd')}
                </p>
              </button>
            )
          })}
        </div>

        {/* Single-day timeline */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ minHeight: 0 }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex" style={{ height: TIMELINE_HEIGHT }}>
            {/* Time rail */}
            <div
              className="flex-shrink-0 w-12 relative select-none"
              style={{ height: TIMELINE_HEIGHT }}
            >
              {HOURS.filter((_, i) => i % 2 === 0 && i < HOURS.length - 1).map(h => (
                <div
                  key={h}
                  className="absolute right-0 pr-2 flex items-center"
                  style={{ top: (h - HOUR_START) * HOUR_HEIGHT - 8 }}
                >
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {String(h % 24).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day column */}
            {(() => {
              const dateStr = format(selectedDay, 'yyyy-MM-dd')
              const isToday = dateStr === todayStr
              const dayBlocks = blocks.filter(b => b.scheduled_date === dateStr)
              return (
                <div
                  className="flex-1 relative border-l border-[var(--border)] cursor-crosshair"
                  style={{ height: TIMELINE_HEIGHT }}
                  onClick={e => handleColumnClick(e, dateStr)}
                >
                  {HOURS.slice(1).map(h => (
                    <div
                      key={h}
                      className={`absolute left-0 right-0 ${
                        h % 2 === 0 ? 'timeline-hour-line-major' : 'timeline-hour-line'
                      }`}
                      style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}
                    />
                  ))}
                  {dayBlocks.map(block => (
                    <TimelineBlock
                      key={block.id}
                      block={block}
                      onClick={() => setEditBlock(block)}
                    />
                  ))}
                  {isToday && currentTimeTop >= 0 && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: currentTimeTop }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[var(--danger)] -ml-1 flex-shrink-0" />
                        <div className="flex-1 h-[1px] bg-[var(--danger)]" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ─── Sticky footer ─── */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-1)] flex items-center justify-between">
        <span className="text-[13px] text-[var(--text-secondary)]">
          Total:{' '}
          <span className="text-[var(--text-primary)] font-[600]">
            {fmtMins(totalWeekMins)} planificados
          </span>
        </span>
        <button
          onClick={handleReorganize}
          disabled={reorganizing || !isCurrentWeek}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-[13px] font-[600] text-white disabled:opacity-50 transition-colors"
        >
          <Sparkles size={14} />
          {reorganizing
            ? 'Analizando…'
            : blocks.length === 0
            ? 'Generar semana con IA'
            : 'Reorganizar con IA'}
        </button>
      </div>

      {/* ─── Loading overlay ─── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg)]/50">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ─── AI loading overlay ─── */}
      {reorganizing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl px-8 py-6 text-center space-y-3">
            <Sparkles size={28} className="text-[var(--accent)] mx-auto animate-pulse" />
            <p className="text-[14px] font-[600] text-[var(--text-primary)]">
              Claude está analizando tu semana…
            </p>
          </div>
        </div>
      )}

      {/* ─── Add block modal ─── */}
      {addModal && (
        <BlockModal
          mode="add"
          initial={{ date: addModal.date, time: addModal.time }}
          activities={activities}
          onClose={() => setAddModal(null)}
          onSave={handleAddBlock}
        />
      )}

      {/* ─── Edit block modal ─── */}
      {editBlock && (
        <BlockModal
          mode="edit"
          initial={{ date: editBlock.scheduled_date, block: editBlock }}
          activities={activities}
          onClose={() => setEditBlock(null)}
          onSave={handleEditBlock}
          onDelete={handleDeleteBlock}
          onComplete={handleCompleteBlock}
        />
      )}

      {/* ─── AI diff modal ─── */}
      {diffData && (
        <DiffModal
          currentBlocks={blocks}
          newBlocks={diffData}
          activities={activities}
          todayStr={todayStr}
          onApply={handleApplyDiff}
          onCancel={() => setDiffData(null)}
        />
      )}
    </div>
  )
}
