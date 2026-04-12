'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, startOfISOWeek, endOfISOWeek, addDays, subWeeks, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Sparkles, Plus, X, Check, Trash2 } from 'lucide-react'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useActivities } from '@/hooks/useActivities'
import { useToast } from '@/components/shared/Toast'
import { ProgressBar } from '@/components/shared/ProgressBar'
import type { Activity, ScheduledBlock } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIBlock {
  date: string
  activity_name: string
  start_time: string
  end_time: string
  duration_minutes: number
  notes: string | null
}

interface AddModalState {
  date: string
  time?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_ABBREVS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function endTime(startTime: string, durationMinutes: number): string {
  const [h, mi] = startTime.split(':').map(Number)
  const total = h * 60 + mi + durationMinutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ─── Draggable Block ─────────────────────────────────────────────────────────

function DraggableBlock({
  block,
  onEdit,
}: {
  block: ScheduledBlock
  onEdit: (block: ScheduledBlock) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: 0.5 }
    : {}

  const st = block.start_time.substring(0, 5)
  const et = endTime(block.start_time, block.duration_minutes)
  const color = block.activity?.color ?? '#6366f1'

  return (
    <div
      ref={setNodeRef}
      style={{
        borderLeftColor: color,
        backgroundColor: color + '1a',
        opacity: block.is_completed ? 0.4 : isDragging ? 0.4 : 1,
        ...style,
      }}
      className={`border-l-[3px] rounded-md p-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity select-none ${
        block.is_tentative ? 'border-dashed' : ''
      }`}
      {...listeners}
      {...attributes}
      onClick={() => onEdit(block)}
    >
      <p className={`text-xs font-semibold text-[#f1f5f9] leading-tight ${block.is_completed ? 'line-through opacity-60' : ''}`}>
        {block.activity?.name ?? '—'}
      </p>
      <p className="text-xs text-[#94a3b8] mt-0.5">{st}–{et}</p>
    </div>
  )
}

// ─── Droppable Day Column ─────────────────────────────────────────────────────

function DroppableDay({
  dateStr,
  children,
}: {
  dateStr: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] flex flex-col pt-2 transition-colors rounded-md ${
        isOver ? 'ring-1 ring-[#6366f1]/40 bg-[#6366f1]/5' : ''
      }`}
    >
      {children}
    </div>
  )
}

// ─── Add / Edit Block Modal ───────────────────────────────────────────────────

const DURATION_PILLS = [
  { label: '30min', mins: 30 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
  { label: '2h', mins: 120 },
]

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
  onSave: (data: { activity_id: string; scheduled_date: string; start_time: string; duration_minutes: number; notes: string }) => Promise<void>
  onDelete?: () => Promise<void>
  onComplete?: () => Promise<void>
}) {
  const [activityId, setActivityId] = useState(initial.block?.activity_id ?? activities[0]?.id ?? '')
  const [date, setDate] = useState(initial.block?.scheduled_date ?? initial.date)
  const [startTime, setStartTime] = useState(initial.block?.start_time?.substring(0, 5) ?? initial.time ?? '09:00')
  const [selectedMins, setSelectedMins] = useState(initial.block?.duration_minutes ?? 60)
  const [useCustom, setUseCustom] = useState(
    initial.block ? !DURATION_PILLS.some(p => p.mins === initial.block!.duration_minutes) : false
  )
  const [customMins, setCustomMins] = useState(String(initial.block?.duration_minutes ?? ''))
  const [notes, setNotes] = useState(initial.block?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const finalMins = useCustom ? (parseInt(customMins) || 60) : selectedMins

  async function handleSave() {
    setSaving(true)
    await onSave({ activity_id: activityId, scheduled_date: date, start_time: startTime, duration_minutes: finalMins, notes })
    setSaving(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-[#111111] border border-[#1f1f1f] rounded-t-2xl md:rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#f1f5f9]">
            {mode === 'add' ? 'Añadir bloque' : 'Editar bloque'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#1a1a1a]">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        {/* Activity */}
        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Actividad</label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {activities.map(a => (
              <button
                key={a.id}
                onClick={() => setActivityId(a.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  activityId === a.id ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-sm font-medium text-[#f1f5f9]">{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>

        {/* Start time */}
        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Hora inicio</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
          />
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Duración</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PILLS.map(p => (
              <button
                key={p.mins}
                onClick={() => { setSelectedMins(p.mins); setUseCustom(false) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  !useCustom && selectedMins === p.mins
                    ? 'bg-[#6366f1] border-[#6366f1] text-white'
                    : 'border-[#1f1f1f] text-[#94a3b8] hover:border-[#6366f1]/50'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useCustom ? 'bg-[#6366f1] border-[#6366f1] text-white' : 'border-[#1f1f1f] text-[#94a3b8] hover:border-[#6366f1]/50'
              }`}
            >
              Personalizado
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
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]"
            />
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-xs text-[#94a3b8] font-medium">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-[#1f1f1f] rounded-xl text-sm font-medium text-[#94a3b8] hover:bg-[#1a1a1a] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !activityId || !date || !startTime}
            className="flex-1 py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : mode === 'add' ? 'Guardar bloque' : 'Guardar cambios'}
          </button>
        </div>

        {mode === 'edit' && (
          <div className="flex gap-3 pt-1">
            {onComplete && (
              <button
                onClick={onComplete}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl text-sm font-medium text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors"
              >
                <Check size={15} /> Marcar completado
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
              >
                <Trash2 size={15} /> {deleting ? 'Eliminando…' : 'Eliminar'}
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

  async function handleApply() {
    setApplying(true)
    await onApply()
    setApplying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 space-y-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-[#f1f5f9]">Propuesta de Claude</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-[#1a1a1a]">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {futureBlocks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#ef4444] uppercase mb-2">Se eliminan ({futureBlocks.length})</p>
              <div className="space-y-1">
                {futureBlocks.map(b => (
                  <div key={b.id} className="flex items-center gap-2 px-3 py-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.activity?.color ?? '#ef4444' }} />
                    <span className="text-xs text-[#f1f5f9]">{b.scheduled_date} · {b.activity?.name}</span>
                    <span className="text-xs text-[#94a3b8] ml-auto">{b.start_time.substring(0, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#22c55e] uppercase mb-2">Se añaden ({newBlocks.length})</p>
            <div className="space-y-1">
              {newBlocks.map((b, i) => {
                const act = activities.find(a => a.name === b.activity_name)
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: act?.color ?? '#22c55e' }} />
                    <span className="text-xs text-[#f1f5f9]">{b.date} · {b.activity_name}</span>
                    <span className="text-xs text-[#94a3b8] ml-auto">{b.start_time} · {b.duration_minutes}min</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-[#1f1f1f] rounded-xl text-sm font-medium text-[#94a3b8] hover:bg-[#1a1a1a] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex-1 py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-colors"
          >
            {applying ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeekPage() {
  const [view, setView] = useState<'week' | 'day'>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfISOWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [blocks, setBlocks] = useState<ScheduledBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addModal, setAddModal] = useState<AddModalState | null>(null)
  const [editBlock, setEditBlock] = useState<ScheduledBlock | null>(null)
  const [reorganizing, setReorganizing] = useState(false)
  const [diffData, setDiffData] = useState<AIBlock[] | null>(null)
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false)
  const [currentMinute, setCurrentMinute] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes()
  })

  const timelineRef = useRef<HTMLDivElement>(null)
  const { activities } = useActivities()
  const { toast } = useToast()

  const weekStart = startOfISOWeek(currentWeekStart)
  const weekEnd = endOfISOWeek(currentWeekStart)
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Current time indicator
  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date()
      setCurrentMinute(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  // Fetch blocks
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

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const blockId = String(active.id)
    const targetDate = String(over.id)
    const block = blocks.find(b => b.id === blockId)
    if (!block || block.scheduled_date === targetDate) return

    // Optimistic update
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, scheduled_date: targetDate } : b))

    const res = await fetch(`/api/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_date: targetDate }),
    })

    if (!res.ok) {
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, scheduled_date: block.scheduled_date } : b))
      toast('Error al mover el bloque', 'error')
    }
  }

  // Block operations
  async function handleAddBlock(data: { activity_id: string; scheduled_date: string; start_time: string; duration_minutes: number; notes: string }) {
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const newBlock: ScheduledBlock = await res.json()
      setBlocks(prev => [...prev, newBlock].sort((a, b) =>
        a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time)
      ))
      setAddModal(null)
      toast('Bloque añadido', 'success')
    } else {
      toast('Error al guardar el bloque', 'error')
    }
  }

  async function handleEditBlock(data: { activity_id: string; scheduled_date: string; start_time: string; duration_minutes: number; notes: string }) {
    if (!editBlock) return
    const res = await fetch(`/api/blocks/${editBlock.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated: ScheduledBlock = await res.json()
      setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
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
      setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
      setEditBlock(null)
    }
  }

  // AI Reorganize
  async function handleReorganize() {
    setReorganizing(true)
    try {
      const res = await fetch('/api/scheduling/reorganize', { method: 'POST' })
      if (!res.ok) throw new Error()
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
    // Delete future blocks in this week
    const futureBlocks = blocks.filter(b => b.scheduled_date >= today)
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
          notes: aiBlock.notes,
          is_tentative: true,
        }),
      })
    }
    setDiffData(null)
    await fetchBlocks(weekStartStr, weekEndStr)
    toast('Semana reorganizada', 'success')
  }

  // Timeline click
  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMinutes = Math.max(0, Math.floor(y))
    const hour = Math.floor(totalMinutes / 60)
    const minute = Math.floor((totalMinutes % 60) / 15) * 15
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    setAddModal({ date: format(selectedDay, 'yyyy-MM-dd'), time: timeStr })
  }

  // Week summary data
  const blocksByActivity: Record<string, number> = {}
  for (const b of blocks) {
    blocksByActivity[b.activity_id] = (blocksByActivity[b.activity_id] ?? 0) + b.duration_minutes * 60
  }
  const totalWeekMins = blocks.reduce((acc, b) => acc + b.duration_minutes, 0)

  const activeBlock = blocks.find(b => b.id === activeId)

  const isCurrentWeek = weekStartStr === format(startOfISOWeek(new Date()), 'yyyy-MM-dd')

  const navDateLabel = view === 'week'
    ? `Semana del ${format(weekStart, 'd')}–${format(weekEnd, 'd MMM', { locale: es })}`
    : (() => {
        const raw = format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })
        return raw.charAt(0).toUpperCase() + raw.slice(1)
      })()

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 animate-fade-in">

      {/* ─── View toggle ─── */}
      <div className="flex items-center gap-1 bg-[#111111] border border-[#1f1f1f] rounded-xl p-1 w-fit">
        {(['week', 'day'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v
                ? 'bg-[#6366f1] text-white'
                : 'text-[#94a3b8] hover:bg-[#1a1a1a]'
            }`}
          >
            {v === 'week' ? 'Semana' : 'Día'}
          </button>
        ))}
      </div>

      {/* ─── Navigation ─── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (view === 'week') setCurrentWeekStart(d => subWeeks(d, 1))
            else setSelectedDay(d => addDays(d, -1))
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1a1a1a] transition-colors"
        >
          <ChevronLeft size={18} className="text-[#94a3b8]" />
        </button>
        <span className="flex-1 text-sm font-semibold text-[#f1f5f9] text-center">{navDateLabel}</span>
        <button
          onClick={() => {
            if (view === 'week') setCurrentWeekStart(d => addWeeks(d, 1))
            else setSelectedDay(d => addDays(d, 1))
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1a1a1a] transition-colors"
        >
          <ChevronRight size={18} className="text-[#94a3b8]" />
        </button>
        <button
          onClick={() => {
            const now = new Date()
            setCurrentWeekStart(startOfISOWeek(now))
            setSelectedDay(now)
          }}
          className="px-3 py-1.5 text-xs font-medium text-[#6366f1] border border-[#6366f1]/30 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* ─── Main content + sidebar ─── */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">

          {/* ─── WEEK VIEW ─── */}
          {view === 'week' && (
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-2 min-w-max md:min-w-0 md:grid md:grid-cols-7">
                  {days.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isToday = dateStr === today
                    const dayBlocks = blocks.filter(b => b.scheduled_date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time))

                    return (
                      <div key={dateStr} className="min-w-[130px] flex flex-col">
                        {/* Column header */}
                        <div className={`pb-2 ${isToday ? 'border-b-2 border-[#6366f1]' : 'border-b border-[#1f1f1f]'}`}>
                          <p className={`text-xs font-medium ${isToday ? 'text-[#6366f1]' : 'text-[#94a3b8]'}`}>
                            {DAY_ABBREVS[i]}
                          </p>
                          <p className={`text-lg font-bold ${isToday ? 'text-[#6366f1]' : 'text-[#f1f5f9]'}`}>
                            {format(day, 'd')}
                          </p>
                        </div>

                        {/* Droppable area */}
                        <DroppableDay dateStr={dateStr}>
                          {dayBlocks.map(block => (
                            <DraggableBlock
                              key={block.id}
                              block={block}
                              onEdit={setEditBlock}
                            />
                          ))}
                          <button
                            onClick={() => setAddModal({ date: dateStr })}
                            className="mt-auto pt-2 w-full text-xs text-[#475569] hover:text-[#94a3b8] transition-colors py-2 text-center"
                          >
                            <Plus size={14} className="inline mr-1" />
                          </button>
                        </DroppableDay>
                      </div>
                    )
                  })}
                </div>
              </div>

              <DragOverlay>
                {activeId && activeBlock && (
                  <div
                    className="border-l-[3px] rounded-md p-2 shadow-xl opacity-90 w-[130px]"
                    style={{
                      borderLeftColor: activeBlock.activity?.color ?? '#6366f1',
                      backgroundColor: (activeBlock.activity?.color ?? '#6366f1') + '2a',
                    }}
                  >
                    <p className="text-xs font-semibold text-[#f1f5f9]">{activeBlock.activity?.name}</p>
                    <p className="text-xs text-[#94a3b8]">{activeBlock.start_time.substring(0, 5)}</p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* ─── DAY VIEW ─── */}
          {view === 'day' && (
            <div
              className="relative overflow-y-auto border border-[#1f1f1f] rounded-xl"
              style={{ height: '70vh' }}
            >
              <div
                ref={timelineRef}
                className="relative"
                style={{ height: 1440, minWidth: 0 }}
                onClick={handleTimelineClick}
              >
                {/* Hour labels + lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute left-0 right-0" style={{ top: h * 60 }}>
                    <div className="flex items-start">
                      <span className="text-xs text-[#475569] w-10 text-right pr-2 -mt-2 select-none flex-shrink-0">
                        {String(h).padStart(2, '0')}
                      </span>
                      <div className="flex-1 border-t border-[#1f1f1f]" />
                    </div>
                  </div>
                ))}

                {/* Current time indicator */}
                {format(selectedDay, 'yyyy-MM-dd') === today && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentMinute }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#ef4444] ml-10 flex-shrink-0" />
                      <div className="flex-1 h-[2px] bg-[#ef4444]" />
                    </div>
                  </div>
                )}

                {/* Blocks */}
                {blocks
                  .filter(b => b.scheduled_date === format(selectedDay, 'yyyy-MM-dd'))
                  .map(block => {
                    const [h, m] = block.start_time.split(':').map(Number)
                    const top = h * 60 + m
                    const height = Math.max(block.duration_minutes, 30)
                    const color = block.activity?.color ?? '#6366f1'
                    return (
                      <div
                        key={block.id}
                        className="absolute rounded-md p-1.5 cursor-pointer overflow-hidden border-l-[3px] text-xs hover:opacity-80 transition-opacity"
                        style={{
                          top,
                          height,
                          left: 44,
                          right: 4,
                          borderLeftColor: color,
                          backgroundColor: color + '2a',
                        }}
                        onClick={e => { e.stopPropagation(); setEditBlock(block) }}
                      >
                        <p className="font-semibold text-[#f1f5f9] leading-tight truncate">
                          {block.activity?.name}
                        </p>
                        <p className="text-[#94a3b8] mt-0.5">
                          {block.start_time.substring(0, 5)} · {fmtMins(block.duration_minutes)}
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Desktop week summary ─── */}
        <div className="hidden md:flex flex-col gap-4 w-[260px] flex-shrink-0">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[#f1f5f9]">Resumen de la semana</h3>
            <p className="text-xs text-[#94a3b8]">Total planificado: <span className="text-[#f1f5f9] font-semibold">{fmtMins(totalWeekMins)}</span></p>
            <div className="space-y-3">
              {activities
                .filter(a => blocksByActivity[a.id] > 0 || (a.weekly_goal_hours && a.weekly_goal_hours > 0))
                .map(a => {
                  const secs = blocksByActivity[a.id] ?? 0
                  const goalSecs = (a.weekly_goal_hours ?? 0) * 3600
                  const pct = goalSecs > 0 ? Math.min((secs / goalSecs) * 100, 100) : (secs > 0 ? 100 : 0)
                  return (
                    <div key={a.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                          <span className="text-xs text-[#f1f5f9] truncate max-w-[120px]">{a.name}</span>
                        </div>
                        <span className="text-xs text-[#94a3b8]">
                          {fmtMins(Math.round(secs / 60))}
                          {a.weekly_goal_hours ? ` / ${a.weekly_goal_hours}h` : ''}
                        </span>
                      </div>
                      {goalSecs > 0 && <ProgressBar value={pct} max={100} color={a.color} height={4} />}
                    </div>
                  )
                })}
            </div>

            <button
              onClick={handleReorganize}
              disabled={reorganizing || !isCurrentWeek}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-colors"
            >
              <Sparkles size={16} />
              {reorganizing ? 'Analizando…' : 'Reorganizar con IA'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile summary bar ─── */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[#111111] border-t border-[#1f1f1f] px-4 py-2 flex items-center justify-between z-30">
        <span className="text-sm text-[#94a3b8]">
          Total: <span className="text-[#f1f5f9] font-semibold">{fmtMins(totalWeekMins)}</span>
        </span>
        <button
          onClick={() => setWeekSummaryOpen(true)}
          className="text-xs text-[#6366f1] font-medium"
        >
          Ver resumen
        </button>
      </div>

      {/* ─── Mobile summary sheet ─── */}
      {weekSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setWeekSummaryOpen(false)} />
          <div className="relative w-full bg-[#111111] border-t border-[#1f1f1f] rounded-t-2xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#f1f5f9]">Resumen de la semana</h3>
              <button onClick={() => setWeekSummaryOpen(false)}><X size={18} className="text-[#94a3b8]" /></button>
            </div>
            {activities.filter(a => blocksByActivity[a.id] > 0).map(a => {
              const secs = blocksByActivity[a.id] ?? 0
              const goalSecs = (a.weekly_goal_hours ?? 0) * 3600
              const pct = goalSecs > 0 ? Math.min((secs / goalSecs) * 100, 100) : 100
              return (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-sm text-[#f1f5f9]">{a.name}</span>
                    </div>
                    <span className="text-xs text-[#94a3b8]">{fmtMins(Math.round(secs / 60))}{a.weekly_goal_hours ? ` / ${a.weekly_goal_hours}h` : ''}</span>
                  </div>
                  {goalSecs > 0 && <ProgressBar value={pct} max={100} color={a.color} height={4} />}
                </div>
              )
            })}
            <button
              onClick={() => { setWeekSummaryOpen(false); handleReorganize() }}
              disabled={reorganizing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366f1] rounded-xl text-sm font-semibold text-white"
            >
              <Sparkles size={16} />
              {reorganizing ? 'Analizando…' : 'Reorganizar con IA'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Add Block Modal ─── */}
      {addModal && (
        <BlockModal
          mode="add"
          initial={{ date: addModal.date, time: addModal.time }}
          activities={activities}
          onClose={() => setAddModal(null)}
          onSave={handleAddBlock}
        />
      )}

      {/* ─── Edit Block Modal ─── */}
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

      {/* ─── AI Reorganize loading overlay ─── */}
      {reorganizing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl px-8 py-6 text-center space-y-3">
            <Sparkles size={32} className="text-[#6366f1] mx-auto animate-pulse" />
            <p className="text-sm font-semibold text-[#f1f5f9]">Claude está analizando tu semana…</p>
          </div>
        </div>
      )}

      {/* ─── Diff Modal ─── */}
      {diffData && (
        <DiffModal
          currentBlocks={blocks}
          newBlocks={diffData}
          activities={activities}
          todayStr={today}
          onApply={handleApplyDiff}
          onCancel={() => setDiffData(null)}
        />
      )}
    </div>
  )
}
