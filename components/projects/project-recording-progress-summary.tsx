"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Card } from "@/components/ui/card"
import type { ProjectProgressResponse } from "@/lib/progress/types"
import { swrKeys } from "@/lib/swr-keys"

interface ProjectRecordingProgressSummaryProps {
  projectId: string
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

async function fetchProgress(url: string): Promise<ProjectProgressResponse> {
  const response = await fetch(url, { method: "GET" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export function ProjectRecordingProgressSummary({ projectId }: ProjectRecordingProgressSummaryProps) {
  const { data, isLoading: loading, error } = useSWR(
    swrKeys.projects.progress(projectId),
    () => fetchProgress(`/api/projects/${encodeURIComponent(projectId)}/progress`),
  )

  const percentLabel = useMemo(() => formatPercent(data?.percentRecorded ?? 0), [data?.percentRecorded])

  if (loading) {
    return (
      <Card className="p-4 text-right" dir="rtl">
        <p className="text-sm text-muted-foreground">טוען התקדמות הקלטה...</p>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-4 text-right" dir="rtl">
        <p className="text-sm text-destructive">לא ניתן לטעון את התקדמות ההקלטה כרגע</p>
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-2 text-right" dir="rtl">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">התקדמות הקלטה</p>
        <p className="text-2xl font-bold text-primary">{percentLabel}%</p>
      </div>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">הוקלט:</span>{" "}
          <span className="font-medium text-foreground">
            {data.totals.recorded} / {data.totals.total}
          </span>
        </p>
        {data.totals.total === 0 && (
          <p className="text-muted-foreground italic">{"אין שורות בתסריט — העלה תסריט קודם"}</p>
        )}
        {data.totals.unmatched > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <span className="text-muted-foreground">לא משויך:</span> {data.totals.unmatched}
          </p>
        )}
      </div>
    </Card>
  )
}
