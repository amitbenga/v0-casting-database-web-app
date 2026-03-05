"use client"

import { SWRConfig } from "swr"

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 30000, // 30s — don't re-fetch the same key within 30s
        errorRetryCount: 2,
        keepPreviousData: true, // Show stale data while revalidating
      }}
    >
      {children}
    </SWRConfig>
  )
}
