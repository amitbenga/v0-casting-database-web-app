export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton with back button */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 bg-muted animate-pulse rounded-md" />
            <div className="h-6 w-36 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Search + add button skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
          <div className="h-10 w-28 bg-muted animate-pulse rounded-md" />
        </div>

        {/* Actor list skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-8 w-8 bg-muted animate-pulse rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
