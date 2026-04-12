import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-[8px]" />
        <Skeleton className="h-24 rounded-[8px]" />
      </div>
      <Skeleton className="h-16 rounded-[8px]" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 rounded-[8px]" />
        <Skeleton className="h-20 rounded-[8px]" />
        <Skeleton className="h-20 rounded-[8px]" />
      </div>
    </div>
  );
}
