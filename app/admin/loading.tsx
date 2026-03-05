export default function Loading() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header skeleton */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-7 w-24 bg-muted animate-pulse rounded" />
              <div className="h-5 w-5 bg-muted animate-pulse rounded" />
              <div className="h-6 w-28 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tabs skeleton */}
        <div className="h-10 w-full bg-muted animate-pulse rounded-md mb-6" />

        {/* Submission cards skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="flex gap-6">
                <div className="h-24 w-24 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-36 bg-muted animate-pulse rounded" />
                  <div className="flex gap-4">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-14 bg-muted animate-pulse rounded-full" />
                    <div className="h-6 w-14 bg-muted animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
