"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import type { ProjectProgressResponse } from "@/lib/progress/types"

interface ProjectRecordingProgressSummaryProps {
  projectId: string
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

export function ProjectRecordingProgressSummary({ projectId }: ProjectRecordingProgressSummaryProps) {
  const [data, setData] = useState<ProjectProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProgress() {
      setLoading(true)
      setHasError(false)

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/progress`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = (await response.json()) as ProjectProgressResponse
        setData(payload)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed loading recording progress summary:", error)
          setHasError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProgress()

    return () => {
      controller.abort()
    }
  }, [projectId])

  const percentLabel = useMemo(() => formatPercent(data?.percentRecorded ?? 0), [data?.percentRecorded])

  if (loading) {
    return (
      <Card className="p-4 text-right" dir="rtl">
        <p className="text-sm text-muted-foreground">טוען התקדמות הקלטה...</p>
      </Card>
    )
  }

  if (hasError || !data) {
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
