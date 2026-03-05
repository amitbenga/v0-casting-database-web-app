export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-2xl">
        {/* Title skeleton */}
        <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded mb-8" />

        {/* Form card skeleton */}
        <div className="rounded-lg border bg-card p-6 space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
            </div>
          ))}
          <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}
