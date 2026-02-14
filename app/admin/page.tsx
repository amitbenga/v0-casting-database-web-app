"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Check,
  X,
  User,
  Calendar,
  Phone,
  Mail,
  Music,
  GraduationCap,
  FileText,
  Clock,
  AlertTriangle,
  Link2,
  Trash2,
  Merge,
  UserPlus,
  CheckSquare,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { mergeSubmissionIntoActor, softDeleteSubmissions, type MergeFieldChoices } from "@/lib/actions/submission-actions"

interface ExistingActor {
  id: string
  full_name: string
  email?: string
  phone?: string
}

interface DuplicateMatch {
  actor: ExistingActor
  matchType: "email" | "phone" | "both"
}

const ACCENT_LABELS: Record<string, string> = {
  french: "צרפתי",
  italian: "איטלקי",
  spanish: "ספרדי",
  german: "גרמני",
}

interface ActorSubmission {
  id: string
  full_name: string
  gender: string // "זכר" או "נקבה" בעברית
  birth_year: number
  phone?: string
  email?: string
  normalized_email?: string
  normalized_phone?: string
  image_url?: string
  voice_sample_url?: string
  singing_sample_url?: string
  is_singer?: boolean
  is_course_graduate?: boolean
  vat_status?: string
  skills?: string[]
  skills_other?: string
  languages?: string[]
  languages_other?: string
  accents?: string[]
  notes?: string
  review_status: "pending" | "approved" | "rejected"
  match_status?: string
  matched_actor_id?: string
  merge_report?: any
  raw_payload?: any
  deleted_at?: string | null
  created_at: string
}

function AdminPageContent() {
  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [existingActors, setExistingActors] = useState<ExistingActor[]>([])
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, DuplicateMatch[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<ActorSubmission | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null)

  const [isPlaying, setIsPlaying] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  // Merge flow state
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<ExistingActor | null>(null)
  const [mergeFieldChoices, setMergeFieldChoices] = useState<MergeFieldChoices>({})
  const [isMerging, setIsMerging] = useState(false)

  // Bulk delete state
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadSubmissions()
  }, [])

  async function loadSubmissions() {
    try {
      const supabase = createBrowserClient()

      // טען submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("actor_submissions")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (submissionsError) throw submissionsError

      // טען שחקנים קיימים לבדיקת כפילויות
      const { data: actorsData, error: actorsError } = await supabase
        .from("actors")
        .select("id, full_name, email, phone")

      if (actorsError) throw actorsError

      setSubmissions(submissionsData || [])
      setExistingActors(actorsData || [])

      // בדוק כפילויות
      const duplicates: Record<string, DuplicateMatch[]> = {}
      
      for (const submission of submissionsData || []) {
        const matches: DuplicateMatch[] = []
        
        for (const actor of actorsData || []) {
          const normalizedSubmissionEmail = submission.normalized_email || submission.email?.toLowerCase().trim()
          const normalizedSubmissionPhone = submission.normalized_phone || submission.phone?.replace(/\D/g, "")
          
          const normalizedActorEmail = actor.email?.toLowerCase().trim()
          const normalizedActorPhone = actor.phone?.replace(/\D/g, "")
          
          const emailMatch = normalizedSubmissionEmail && normalizedActorEmail && 
                           normalizedSubmissionEmail === normalizedActorEmail
          const phoneMatch = normalizedSubmissionPhone && normalizedActorPhone && 
                           normalizedSubmissionPhone === normalizedActorPhone

          if (emailMatch && phoneMatch) {
            matches.push({ actor, matchType: "both" })
          } else if (emailMatch) {
            matches.push({ actor, matchType: "email" })
          } else if (phoneMatch) {
            matches.push({ actor, matchType: "phone" })
          }
        }
        
        if (matches.length > 0) {
          duplicates[submission.id] = matches
        }
      }
      
      setDuplicatesMap(duplicates)
    } catch (error) {
      console.error("[v0] Error loading submissions:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(submission: ActorSubmission) {
    try {
      const supabase = createBrowserClient()

      const genderInEnglish = submission.gender === "זכר" ? "male" : "female"

      // שינוי is_course_graduate ל-is_course_grad בהתאמה לשם השדה בטבלת actors
      const { error: insertError } = await supabase.from("actors").insert({
        full_name: submission.full_name,
        gender: genderInEnglish,
        birth_year: submission.birth_year,
        phone: submission.phone,
        email: submission.email,
        image_url: submission.image_url,
        voice_sample_url: submission.voice_sample_url,
        singing_sample_url: submission.singing_sample_url || "",
        is_singer: submission.is_singer || false,
        is_course_grad: submission.is_course_graduate || false,
        vat_status: submission.vat_status || "exempt",
        skills: submission.skills || [],
        languages: submission.languages || [],
        accents: submission.accents || [],
        notes: submission.notes,
      })

      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from("actor_submissions")
        .update({
          review_status: "approved",
        })
        .eq("id", submission.id)

      if (updateError) throw updateError

      await loadSubmissions()
      setIsReviewDialogOpen(false)
      setSelectedSubmission(null)
    } catch (error) {
      console.error("[v0] Error approving submission:", error)
      alert("שגיאה באישור הבקשה")
    }
  }

  async function handleReject(submission: ActorSubmission) {
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from("actor_submissions")
        .update({
          review_status: "rejected",
        })
        .eq("id", submission.id)

      if (error) throw error

      await loadSubmissions()
      setIsReviewDialogOpen(false)
      setSelectedSubmission(null)
    } catch (error) {
      console.error("[v0] Error rejecting submission:", error)
      alert("שגיאה בדחיית הבקשה")
    }
  }

  // Merge flow: open merge dialog with a specific target actor
  function handleStartMerge(submission: ActorSubmission, targetActor: ExistingActor) {
    setSelectedSubmission(submission)
    setMergeTarget(targetActor)
    setMergeFieldChoices({})
    setShowMergeDialog(true)
  }

  async function handleConfirmMerge() {
    if (!selectedSubmission || !mergeTarget) return
    setIsMerging(true)
    try {
      const result = await mergeSubmissionIntoActor(
        selectedSubmission.id,
        mergeTarget.id,
        mergeFieldChoices
      )
      if (!result.success) {
        alert(result.error || "שגיאה במיזוג")
        return
      }
      await loadSubmissions()
      setShowMergeDialog(false)
      setSelectedSubmission(null)
      setMergeTarget(null)
    } catch (error) {
      console.error("Merge error:", error)
      alert("שגיאה במיזוג")
    } finally {
      setIsMerging(false)
    }
  }

  // Bulk delete for rejected submissions
  function toggleSelectForDelete(id: string) {
    setSelectedForDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAllRejected() {
    if (selectedForDelete.size === rejectedSubmissions.length) {
      setSelectedForDelete(new Set())
    } else {
      setSelectedForDelete(new Set(rejectedSubmissions.map(s => s.id)))
    }
  }

  async function handleBulkDelete() {
    if (selectedForDelete.size === 0) return
    if (!confirm(`האם למחוק ${selectedForDelete.size} בקשות?`)) return

    setIsDeleting(true)
    try {
      const result = await softDeleteSubmissions(Array.from(selectedForDelete))
      if (!result.success) {
        alert(result.error || "שגיאה במחיקה")
        return
      }
      await loadSubmissions()
      setSelectedForDelete(new Set())
    } catch (error) {
      console.error("Bulk delete error:", error)
      alert("שגיאה במחיקה")
    } finally {
      setIsDeleting(false)
    }
  }

  function handlePlayAudio(url: string, id: string, e: React.MouseEvent) {
    e.stopPropagation()

    if (isPlaying === id) {
      audio?.pause()
      setIsPlaying(null)
      return
    }

    if (audio) {
      audio.pause()
    }

    const newAudio = new Audio(url)
    newAudio.play()
    setIsPlaying(id)
    setAudio(newAudio)

    newAudio.onended = () => {
      setIsPlaying(null)
    }
  }

  const pendingSubmissions = submissions.filter((s) => s.review_status === "pending")
  const approvedSubmissions = submissions.filter((s) => s.review_status === "approved")
  const rejectedSubmissions = submissions.filter((s) => s.review_status === "rejected")

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען בקשות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold text-primary">
                Soprodub
              </Link>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">ניהול בקשות</h1>
            </div>
            <Link href="/">
              <Button variant="outline">חזרה לדף הראשי</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pending" className="relative">
              ממתינות לאישור
              {pendingSubmissions.length > 0 && (
                <Badge variant="destructive" className="mr-2 h-5 min-w-5 px-1.5">
                  {pendingSubmissions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">אושרו ({approvedSubmissions.length})</TabsTrigger>
            <TabsTrigger value="rejected">נדחו ({rejectedSubmissions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingSubmissions.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">אין בקשות ממתינות</p>
              </Card>
            ) : (
              pendingSubmissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  duplicates={duplicatesMap[submission.id]}
                  onReview={(action) => {
                    setSelectedSubmission(submission)
                    setReviewAction(action)
                    setIsReviewDialogOpen(true)
                  }}
                  onPlayAudio={handlePlayAudio}
                  isPlaying={isPlaying === submission.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedSubmissions.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">אין בקשות מאושרות</p>
              </Card>
            ) : (
              approvedSubmissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onPlayAudio={handlePlayAudio}
                  isPlaying={isPlaying === submission.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedSubmissions.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">אין בקשות שנדחו</p>
              </Card>
            ) : (
              <>
                {/* Bulk actions bar */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedForDelete.size === rejectedSubmissions.length && rejectedSubmissions.length > 0}
                      onCheckedChange={toggleSelectAllRejected}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedForDelete.size > 0
                        ? `נבחרו ${selectedForDelete.size} בקשות`
                        : "בחר הכל"}
                    </span>
                  </div>
                  {selectedForDelete.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      {isDeleting ? "מוחק..." : `מחק ${selectedForDelete.size} נבחרות`}
                    </Button>
                  )}
                </div>

                {rejectedSubmissions.map((submission) => (
                  <div key={submission.id} className="flex items-start gap-3">
                    <div className="pt-6">
                      <Checkbox
                        checked={selectedForDelete.has(submission.id)}
                        onCheckedChange={() => toggleSelectForDelete(submission.id)}
                      />
                    </div>
                    <div className="flex-1">
                      <SubmissionCard
                        submission={submission}
                        onPlayAudio={handlePlayAudio}
                        isPlaying={isPlaying === submission.id}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Review Dialog - now with 3 options when duplicates exist */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "אישור בקשה" : "דחיית בקשה"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reviewAction === "approve" && selectedSubmission && duplicatesMap[selectedSubmission.id]?.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  נמצאו התאמות אפשריות ל-{selectedSubmission.full_name}. בחר פעולה:
                </p>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => {
                      handleReject(selectedSubmission)
                    }}
                  >
                    <X className="h-5 w-5 text-red-500" />
                    <div className="text-right">
                      <p className="font-medium">דחה את הבקשה</p>
                      <p className="text-xs text-muted-foreground">הבקשה תידחה</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => {
                      handleApprove(selectedSubmission)
                    }}
                  >
                    <UserPlus className="h-5 w-5 text-green-500" />
                    <div className="text-right">
                      <p className="font-medium">צור שחקן חדש</p>
                      <p className="text-xs text-muted-foreground">ייצור רשומה נפרדת במאגר</p>
                    </div>
                  </Button>
                  {duplicatesMap[selectedSubmission.id].map((match) => (
                    <Button
                      key={match.actor.id}
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                      onClick={() => handleStartMerge(selectedSubmission, match.actor)}
                    >
                      <Merge className="h-5 w-5 text-blue-500" />
                      <div className="text-right">
                        <p className="font-medium">מזג עם {match.actor.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          עדכן שדות חסרים בשחקן הקיים
                          ({match.matchType === "both" ? "התאמת אימייל וטלפון" : match.matchType === "email" ? "התאמת אימייל" : "התאמת טלפון"})
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {reviewAction === "approve"
                  ? `האם אתה בטוח שברצונך לאשר את הבקשה של ${selectedSubmission?.full_name}?`
                  : `האם אתה בטוח שברצונך לדחות את הבקשה של ${selectedSubmission?.full_name}?`}
              </p>
            )}
          </div>
          {/* Only show simple approve/reject buttons when no duplicates */}
          {!(reviewAction === "approve" && selectedSubmission && duplicatesMap[selectedSubmission.id]?.length > 0) && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission) {
                    if (reviewAction === "approve") {
                      handleApprove(selectedSubmission)
                    } else {
                      handleReject(selectedSubmission)
                    }
                  }
                }}
                variant={reviewAction === "approve" ? "default" : "destructive"}
              >
                {reviewAction === "approve" ? "אשר" : "דחה"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Dialog - field-by-field choice */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>מיזוג עם {mergeTarget?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedSubmission && mergeTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                שדות חסרים ימולאו אוטומטית. לשדות סותרים, בחר איזה ערך לשמור:
              </p>
              <MergeFieldSelector
                submission={selectedSubmission}
                targetActorId={mergeTarget.id}
                fieldChoices={mergeFieldChoices}
                onFieldChoiceChange={(field, choice) => {
                  setMergeFieldChoices(prev => ({ ...prev, [field]: choice }))
                }}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleConfirmMerge} disabled={isMerging}>
              {isMerging ? "ממזג..." : "אשר מיזוג"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubmissionCard({
  submission,
  duplicates,
  onReview,
  onPlayAudio,
  isPlaying,
}: {
  submission: ActorSubmission
  duplicates?: DuplicateMatch[]
  onReview?: (action: "approve" | "reject") => void
  onPlayAudio: (url: string, id: string, e: React.MouseEvent) => void
  isPlaying: boolean
}) {
  const age = new Date().getFullYear() - submission.birth_year

  return (
    <Card className="p-6">
      <div className="flex gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {submission.image_url ? (
            <img
              src={submission.image_url || "/placeholder.svg"}
              alt={submission.full_name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold">{submission.full_name}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {submission.gender}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {age} שנים
                </span>
                {submission.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {submission.phone}
                  </span>
                )}
                {submission.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {submission.email}
                  </span>
                )}
              </div>
            </div>
            <Badge
              variant={
                submission.review_status === "pending"
                  ? "default"
                  : submission.review_status === "approved"
                    ? "success"
                    : "destructive"
              }
            >
              {submission.review_status === "pending" && "ממתין"}
              {submission.review_status === "approved" && "אושר"}
              {submission.review_status === "rejected" && "נדחה"}
            </Badge>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              {submission.is_singer && (
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <span>זמר/ת</span>
                </div>
              )}
              {submission.is_course_graduate && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>בוגר קורס</span>
                </div>
              )}
              {submission.vat_status && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>{submission.vat_status}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {submission.skills && submission.skills.length > 0 && (
                <div>
                  <p className="font-medium mb-1">כישורים:</p>
                  <div className="flex flex-wrap gap-1">
                    {submission.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {submission.languages && submission.languages.length > 0 && (
                <div>
                  <p className="font-medium mb-1">שפות:</p>
                  <div className="flex flex-wrap gap-1">
                    {submission.languages.map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {submission.accents && submission.accents.length > 0 && (
                <div>
                  <p className="font-medium mb-1">מבטאים:</p>
                  <div className="flex flex-wrap gap-1">
                    {submission.accents.map((accent) => (
                      <Badge key={accent} variant="secondary" className="text-xs">
                        {ACCENT_LABELS[accent] || accent}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duplicate Warning */}
          {duplicates && duplicates.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    זוהו התאמות אפשריות במערכת
                  </p>
                  {duplicates.map((match, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300">
                        <strong>{match.actor.full_name}</strong>
                        {" - "}
                        {match.matchType === "both" && "התאמת אימייל וטלפון"}
                        {match.matchType === "email" && "התאמת אימייל"}
                        {match.matchType === "phone" && "התאמת טלפון"}
                      </span>
                      <a
                        href={`/actors/${match.actor.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        (צפה בפרופיל)
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {submission.notes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{submission.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {submission.voice_sample_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => onPlayAudio(submission.voice_sample_url!, submission.id + "-voice", e)}
              >
                <Music className="h-4 w-4 ml-2" />
                {isPlaying ? "עצור" : "השמע דיבור"}
              </Button>
            )}
            {submission.singing_sample_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => onPlayAudio(submission.singing_sample_url!, submission.id + "-singing", e)}
              >
                <Music className="h-4 w-4 ml-2" />
                השמע שירה
              </Button>
            )}
            {submission.review_status === "pending" && onReview && (
              <>
                <Button size="sm" onClick={() => onReview("approve")} className="bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 ml-2" />
                  אשר
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onReview("reject")}>
                  <X className="h-4 w-4 ml-2" />
                  דחה
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * MergeFieldSelector - shows conflicting fields between submission and existing actor
 * For each conflict, user picks which value to keep
 */
function MergeFieldSelector({
  submission,
  targetActorId,
  fieldChoices,
  onFieldChoiceChange,
}: {
  submission: ActorSubmission
  targetActorId: string
  fieldChoices: MergeFieldChoices
  onFieldChoiceChange: (field: string, choice: "submission" | "existing") => void
}) {
  const [actor, setActor] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadActor() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("actors")
        .select("*")
        .eq("id", targetActorId)
        .single()
      setActor(data)
      setLoading(false)
    }
    loadActor()
  }, [targetActorId])

  if (loading || !actor) {
    return <p className="text-sm text-muted-foreground">טוען נתוני שחקן...</p>
  }

  const FIELD_LABELS: Record<string, string> = {
    full_name: "שם מלא",
    gender: "מין",
    birth_year: "שנת לידה",
    phone: "טלפון",
    email: "אימייל",
    image_url: "תמונה",
    voice_sample_url: "דוגמת דיבור",
    singing_sample_url: "דוגמת שירה",
    is_singer: "זמר/ת",
    vat_status: 'סטטוס מע"מ',
    notes: "הערות",
  }

  // Map submission fields to actor fields
  const fieldMapping: Record<string, { subKey: string; actorKey: string }> = {
    full_name: { subKey: "full_name", actorKey: "full_name" },
    gender: { subKey: "gender", actorKey: "gender" },
    birth_year: { subKey: "birth_year", actorKey: "birth_year" },
    phone: { subKey: "phone", actorKey: "phone" },
    email: { subKey: "email", actorKey: "email" },
    image_url: { subKey: "image_url", actorKey: "image_url" },
    voice_sample_url: { subKey: "voice_sample_url", actorKey: "voice_sample_url" },
    singing_sample_url: { subKey: "singing_sample_url", actorKey: "singing_sample_url" },
    is_singer: { subKey: "is_singer", actorKey: "is_singer" },
    vat_status: { subKey: "vat_status", actorKey: "vat_status" },
    notes: { subKey: "notes", actorKey: "notes" },
  }

  const conflicts: { field: string; subValue: any; actorValue: any }[] = []
  const autoFills: { field: string; value: any }[] = []

  for (const [fieldName, mapping] of Object.entries(fieldMapping)) {
    const subValue = (submission as any)[mapping.subKey]
    const actorValue = actor[mapping.actorKey]

    if (subValue == null || subValue === "" || subValue === false) continue

    if (actorValue == null || actorValue === "" || actorValue === false) {
      autoFills.push({ field: fieldName, value: subValue })
    } else if (String(subValue) !== String(actorValue)) {
      conflicts.push({ field: fieldName, subValue, actorValue })
    }
  }

  return (
    <div className="space-y-4">
      {autoFills.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            שדות שימולאו אוטומטית ({autoFills.length})
          </p>
          <div className="space-y-1">
            {autoFills.map((af) => (
              <div key={af.field} className="flex items-center gap-2 text-sm">
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-muted-foreground">{FIELD_LABELS[af.field] || af.field}:</span>
                <span className="font-medium">{String(af.value).slice(0, 50)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">שדות סותרים ({conflicts.length}) - בחר איזה ערך לשמור:</p>
          {conflicts.map((conflict) => (
            <div key={conflict.field} className="p-3 border rounded-lg space-y-2">
              <p className="text-sm font-medium">{FIELD_LABELS[conflict.field] || conflict.field}</p>
              <RadioGroup
                value={fieldChoices[conflict.field] || "existing"}
                onValueChange={(v) => onFieldChoiceChange(conflict.field, v as "submission" | "existing")}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id={`${conflict.field}-existing`} />
                  <Label htmlFor={`${conflict.field}-existing`} className="text-sm">
                    שמור קיים: <span className="font-medium">{String(conflict.actorValue).slice(0, 60)}</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="submission" id={`${conflict.field}-submission`} />
                  <Label htmlFor={`${conflict.field}-submission`} className="text-sm">
                    מהגשה: <span className="font-medium">{String(conflict.subValue).slice(0, 60)}</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </div>
      )}

      {conflicts.length === 0 && autoFills.length === 0 && (
        <p className="text-sm text-muted-foreground">אין שדות למזג. ההגשה תסומן כמאושרת.</p>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminPageContent />
    </ProtectedRoute>
  )
}
