interface DaysRemainingProps {
  days: number
}

export function DaysRemaining({ days }: DaysRemainingProps) {
  const color = days <= 3
    ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
    : days <= 7
    ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
    : 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${color}`}>
      {days <= 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`}
      {days <= 3 && ' ⚠'}
    </span>
  )
}
