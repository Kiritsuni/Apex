import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={cn('bg-[#111111] border border-[#1f1f1f] rounded-xl', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f]">
          {title && <h3 className="text-base font-semibold text-[#f1f5f9]">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
