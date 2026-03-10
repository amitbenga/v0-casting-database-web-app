export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Project header skeleton */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 bg-muted animate-pulse rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Sidebar skeleton */}
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div className="h-5 w-28 bg-muted animate-pulse rounded" />
              <div className="h-px bg-border" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                    <div className="space-y-1 flex-1">
                      <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content skeleton */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs skeleton */}
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            {/* Tab content skeleton */}
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
                  </div>
                  <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
