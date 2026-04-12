interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && <span className="text-4xl mb-3">{icon}</span>}
      <p className="text-sm font-medium text-[#f1f5f9] mb-1">{title}</p>
      {description && <p className="text-xs text-[#475569] mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
