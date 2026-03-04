export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-7 w-40 bg-muted animate-pulse rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-9 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar skeleton */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="aspect-[3/4] bg-muted animate-pulse" />
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-px bg-border" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    <div className="space-y-1 flex-1">
                      <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content skeleton */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-2 mb-4">
              <div className="h-9 w-16 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-16 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="rounded-lg border bg-card p-6 space-y-3">
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
            <div className="rounded-lg border bg-card p-6 space-y-3">
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 w-16 bg-muted animate-pulse rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
