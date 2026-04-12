interface ActivityBadgeProps {
  name: string
  color: string
  size?: 'sm' | 'md'
}

export function ActivityBadge({ name, color, size = 'md' }: ActivityBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-full flex-shrink-0"
        style={{ backgroundColor: color, width: size === 'sm' ? 6 : 8, height: size === 'sm' ? 6 : 8 }}
      />
      <span className={`font-medium text-[#f1f5f9] ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{name}</span>
    </div>
  )
}
