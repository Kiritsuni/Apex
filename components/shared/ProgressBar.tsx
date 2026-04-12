interface ProgressBarProps {
  value: number
  max: number
  color?: string
  height?: number
  showGradient?: boolean
}

export function ProgressBar({ value, max, color, height = 6, showGradient = false }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div
      className="w-full rounded-full bg-[#1f1f1f] overflow-hidden"
      style={{ height }}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${showGradient ? 'progress-gradient' : ''}`}
        style={{
          width: `${pct}%`,
          backgroundColor: showGradient ? undefined : (color || '#6366f1'),
        }}
      />
    </div>
  )
}
