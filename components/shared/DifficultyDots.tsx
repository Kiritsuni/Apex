interface DifficultyDotsProps {
  difficulty: number
}

export function DifficultyDots({ difficulty }: DifficultyDotsProps) {
  const color = difficulty >= 5 ? '#ef4444' : difficulty >= 4 ? '#f97316' : difficulty >= 3 ? '#f59e0b' : difficulty >= 2 ? '#6366f1' : '#22c55e'

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ backgroundColor: i < difficulty ? color : '#1f1f1f' }}
        />
      ))}
    </div>
  )
}
