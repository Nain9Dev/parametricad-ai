interface SkeletonProps {
  className?: string
}

/**
 * A placeholder shaped like the content it stands in for.
 *
 * Marked `aria-hidden` because a skeleton carries no information; the live
 * region that announces "generating" is what a screen reader should hear.
 */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded bg-line ${className}`}
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}
