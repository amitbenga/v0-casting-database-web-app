"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, User, ArrowLeftRight } from "lucide-react"
import { mergeSubmissionIntoActor } from "@/lib/actions/submission-actions"
import type { MergeFieldChoices } from "@/lib/actions/submission-actions"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ActorSubmission {
  id: string
  full_name: string
  gender: string
  birth_year: number
  phone?: string
  email?: string
  image_url?: string
  voice_sample_url?: string
  singing_sample_url?: string
  youtube_link?: string
  singing_styles?: string[]
  singing_level?: string
  is_singer?: boolean
  is_course_graduate?: boolean
  vat_status?: string
  skills?: string[]
  languages?: string[]
  notes?: string
  raw_payload?: any
}

interface ExistingActor {
  id: string
  full_name: string
  email?: string
  phone?: string
  gender?: string
  birth_year?: number
  image_url?: string
  voice_sample_url?: string
  singing_sample_url?: string
  youtube_link?: string
  singing_styles?: any[]
  singing_level?: string
  is_singer?: boolean
  is_course_grad?: boolean
  vat_status?: string
  skills?: any[]
  languages?: any[]
  notes?: string
  city?: string
  dubbing_experience_years?: number
}

interface DuplicateMatch {
  actor: ExistingActor
  matchType: "email" | "phone" | "both"
}

interface MergeActorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: ActorSubmission
  duplicates: DuplicateMatch[]
  onMergeComplete: () => void
}

/** Fields that can conflict between submission and existing actor */
const MERGE_FIELDS: {
  key: string
  label: string
  getSubmissionValue: (s: ActorSubmission) => string | undefined
  getActorValue: (a: ExistingActor) => string | undefined
}[] = [
  {
    key: "full_name",
    label: "שם מלא",
    getSubmissionValue: (s) => s.full_name,
    getActorValue: (a) => a.full_name,
  },
  {
    key: "gender",
    label: "מגדר",
    getSubmissionValue: (s) => s.gender,
    getActorValue: (a) => a.gender,
  },
  {
    key: "birth_year",
    label: "שנת לידה",
    getSubmissionValue: (s) => s.birth_year?.toString(),
    getActorValue: (a) => a.birth_year?.toString(),
  },
  {
    key: "phone",
    label: "טלפון",
    getSubmissionValue: (s) => s.phone,
    getActorValue: (a) => a.phone,
  },
  {
    key: "email",
    label: "אימייל",
    getSubmissionValue: (s) => s.email,
    getActorValue: (a) => a.email,
  },
  {
    key: "image_url",
    label: "תמונה",
    getSubmissionValue: (s) => s.image_url ? "יש תמונה" : undefined,
    getActorValue: (a) => a.image_url ? "יש תמונה" : undefined,
  },
  {
    key: "voice_sample_url",
    label: "דוגמת קול",
    getSubmissionValue: (s) => s.voice_sample_url ? "יש קובץ" : undefined,
    getActorValue: (a) => a.voice_sample_url ? "יש קובץ" : undefined,
  },
  {
    key: "singing_sample_url",
    label: "דוגמת שירה",
    getSubmissionValue: (s) => s.singing_sample_url ? "יש קובץ" : undefined,
    getActorValue: (a) => a.singing_sample_url ? "יש קובץ" : undefined,
  },
  {
    key: "singing_level",
    label: "רמת שירה",
    getSubmissionValue: (s) => s.singing_level,
    getActorValue: (a) => a.singing_level,
  },
  {
    key: "vat_status",
    label: "סטטוס מע\"מ",
    getSubmissionValue: (s) => s.vat_status,
    getActorValue: (a) => a.vat_status,
  },
  {
    key: "notes",
    label: "הערות",
    getSubmissionValue: (s) => s.notes,
    getActorValue: (a) => a.notes,
  },
]

export function MergeActorDialog({
  open,
  onOpenChange,
  submission,
  duplicates,
  onMergeComplete,
}: MergeActorDialogProps) {
  const { toast } = useToast()
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [selectedActor, setSelectedActor] = useState<ExistingActor | null>(null)
  const [fieldChoices, setFieldChoices] = useState<MergeFieldChoices>({})
  const [isMerging, setIsMerging] = useState(false)
  const [loadingActor, setLoadingActor] = useState(false)

  // Auto-select first duplicate if only one
  useEffect(() => {
    if (open && duplicates.length === 1) {
      setSelectedActorId(duplicates[0].actor.id)
    } else if (!open) {
      setSelectedActorId(null)
      setSelectedActor(null)
      setFieldChoices({})
    }
  }, [open, duplicates])

  // Load full actor details when selected
  useEffect(() => {
    if (!selectedActorId) {
      setSelectedActor(null)
      setFieldChoices({})
      return
    }

    async function loadActor() {
      setLoadingActor(true)
      try {
        const supabase = createBrowserClient()
        const { data, error } = await supabase
          .from("actors")
          .select("id,full_name,email,phone,gender,birth_year,image_url,voice_sample_url,singing_sample_url,youtube_link,singing_styles,singing_level,is_singer,is_course_grad,vat_status,skills,languages,notes,city,dubbing_experience_years")
          .eq("id", selectedActorId)
          .single()

        if (error) throw error
        setSelectedActor(data)
      } catch (err) {
        console.error("Error loading actor for merge:", err)
        toast({ title: "שגיאה", description: "שגיאה בטעינת פרטי השחקן", variant: "destructive" })
      } finally {
        setLoadingActor(false)
      }
    }

    loadActor()
  }, [selectedActorId, toast])

  // Compute conflicting fields (both have different non-empty values)
  const conflictingFields = useMemo(() => {
    if (!selectedActor) return []

    return MERGE_FIELDS.filter((field) => {
      const subVal = field.getSubmissionValue(submission)
      const actVal = field.getActorValue(selectedActor)
      // Both have non-empty values and they differ
      return subVal && actVal && subVal !== actVal
    })
  }, [submission, selectedActor])

  // Fields that will be auto-filled (actor missing, submission has)
  const autoFillFields = useMemo(() => {
    if (!selectedActor) return []

    return MERGE_FIELDS.filter((field) => {
      const subVal = field.getSubmissionValue(submission)
      const actVal = field.getActorValue(selectedActor)
      return subVal && !actVal
    })
  }, [submission, selectedActor])

  const handleMerge = async () => {
    if (!selectedActorId) return

    setIsMerging(true)
    try {
      const result = await mergeSubmissionIntoActor(submission.id, selectedActorId, fieldChoices)

      if (!result.success) {
        toast({ title: "שגיאה", description: result.error || "שגיאה במיזוג", variant: "destructive" })
        return
      }

      toast({ title: "מוזג בהצלחה", description: `הבקשה של ${submission.full_name} מוזגה עם השחקן הקיים` })
      onOpenChange(false)
      onMergeComplete()
    } catch (err) {
      console.error("Merge error:", err)
      toast({ title: "שגיאה", description: "שגיאה לא צפויה במיזוג", variant: "destructive" })
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            מיזוג בקשה עם שחקן קיים
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* Step 1: Select target actor */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">בחר שחקן למיזוג:</h3>
              <div className="space-y-2">
                {duplicates.map((match) => (
                  <button
                    key={match.actor.id}
                    type="button"
                    onClick={() => setSelectedActorId(match.actor.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-right ${
                      selectedActorId === match.actor.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{match.actor.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {match.actor.email && `${match.actor.email} `}
                        {match.actor.phone && `| ${match.actor.phone}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {match.matchType === "both" && "אימייל + טלפון"}
                      {match.matchType === "email" && "אימייל"}
                      {match.matchType === "phone" && "טלפון"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading actor details */}
            {loadingActor && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Step 2: Side-by-side comparison */}
            {selectedActor && !loadingActor && (
              <>
                {/* Auto-fill fields */}
                {autoFillFields.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">שדות שיתמלאו אוטומטית (חסרים בשחקן):</h3>
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {autoFillFields.map((field) => (
                          <div key={field.key} className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {field.label}
                            </Badge>
                            <span className="text-green-700 dark:text-green-300 truncate">
                              {field.getSubmissionValue(submission)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conflicting fields */}
                {conflictingFields.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">שדות מתנגשים — בחר מקור:</h3>
                    <div className="border rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/50 p-3 text-sm font-medium">
                        <span>שדה</span>
                        <span>מהבקשה</span>
                        <span>מהשחקן הקיים</span>
                      </div>
                      {/* Rows */}
                      {conflictingFields.map((field) => {
                        const choice = fieldChoices[field.key] || "existing"
                        return (
                          <div
                            key={field.key}
                            className="grid grid-cols-[1fr_1fr_1fr] p-3 border-t items-center"
                          >
                            <span className="text-sm font-medium">{field.label}</span>
                            <RadioGroup
                              value={choice}
                              onValueChange={(val) =>
                                setFieldChoices((prev) => ({
                                  ...prev,
                                  [field.key]: val as "submission" | "existing",
                                }))
                              }
                              className="contents"
                            >
                              <label
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                                  choice === "submission"
                                    ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                                    : "hover:bg-muted/50"
                                }`}
                              >
                                <RadioGroupItem value="submission" />
                                <span className="truncate">
                                  {field.getSubmissionValue(submission)}
                                </span>
                              </label>
                              <label
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                                  choice === "existing"
                                    ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                                    : "hover:bg-muted/50"
                                }`}
                              >
                                <RadioGroupItem value="existing" />
                                <span className="truncate">
                                  {field.getActorValue(selectedActor)}
                                </span>
                              </label>
                            </RadioGroup>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* No conflicts message */}
                {conflictingFields.length === 0 && autoFillFields.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    אין שדות להשוואה — הנתונים זהים או שהבקשה לא מכילה מידע חדש.
                  </div>
                )}

                {/* Array fields note */}
                <p className="text-xs text-muted-foreground">
                  כישורים, שפות וסגנונות שירה ימוזגו אוטומטית (איחוד רשימות).
                </p>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            ביטול
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedActorId || loadingActor || isMerging}
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ממזג...
              </>
            ) : (
              "מזג בקשה"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
