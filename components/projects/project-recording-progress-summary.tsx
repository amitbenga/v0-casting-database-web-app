"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Card } from "@/components/ui/card"
import type { ProjectProgressResponse } from "@/lib/progress/types"

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
    `/api/projects/${encodeURIComponent(projectId)}/progress`,
    fetchProgress,
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
      <p className="text-base font-semibold">התקדמות הקלטה: {percentLabel}%</p>
      <p className="text-sm text-muted-foreground">
        מוקלט: {data.totals.recorded} / {data.totals.total}
      </p>
      {data.totals.unmatched > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">לא משויך לתפקיד: {data.totals.unmatched}</p>
      )}
    </Card>
  )
}
