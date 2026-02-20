"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
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
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

import { ProtectedRoute } from "@/components/ProtectedRoute"

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
  youtube_link?: string
  singing_styles?: string[]
  singing_level?: string
  is_singer?: boolean
  is_course_graduate?: boolean
  vat_status?: string
  skills?: string[]
  skills_other?: string
  languages?: string[]
  languages_other?: string
  notes?: string
  review_status: "pending" | "approved" | "rejected"
  match_status?: string
  matched_actor_id?: string
  merge_report?: any
  raw_payload?: any
  created_at: string
}

const normalizeEmail = (email?: string) => email?.toLowerCase().trim() || ""
const normalizePhone = (phone?: string) => phone?.replace(/\D/g, "") || ""

/** Convert plain Hebrew skill strings from submissions to {id, key, label} objects for actors table */
function convertSkillStringsToObjects(skills: string[]): Array<{id: string, key: string, label: string}> {
  return skills.map((label, index) => ({
    id: String(index + 1),
    key: label,
    label: label,
  }))
}

/** Convert plain Hebrew language strings from submissions to {id, key, label} objects for actors table */
function convertLanguageStringsToObjects(languages: string[]): Array<{id: string, key: string, label: string}> {
  return languages.map((label, index) => ({
    id: String(index + 1),
    key: label,
    label: label,
  }))
}

function AdminPageContent() {
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState<ActorSubmission[]>([])
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, DuplicateMatch[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<ActorSubmission | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null)

  const [isPlaying, setIsPlaying] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

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
        .order("created_at", { ascending: false })

      if (submissionsError) throw submissionsError

      // טען שחקנים קיימים לבדיקת כפילויות
      const { data: actorsData, error: actorsError } = await supabase
        .from("actors")
        .select("id, full_name, email, phone")

      if (actorsError) throw actorsError

      setSubmissions(submissionsData || [])

      // בדוק כפילויות עם אינדקסים כדי להימנע מלולאה כפולה מלאה
      const duplicates: Record<string, DuplicateMatch[]> = {}
      const actorsByEmail = new Map<string, ExistingActor[]>()
      const actorsByPhone = new Map<string, ExistingActor[]>()

      for (const actor of actorsData || []) {
        const email = normalizeEmail(actor.email)
        const phone = normalizePhone(actor.phone)

        if (email) {
          const byEmail = actorsByEmail.get(email)
          if (byEmail) {
            byEmail.push(actor)
          } else {
            actorsByEmail.set(email, [actor])
          }
        }

        if (phone) {
          const byPhone = actorsByPhone.get(phone)
          if (byPhone) {
            byPhone.push(actor)
          } else {
            actorsByPhone.set(phone, [actor])
          }
        }
      }

      for (const submission of submissionsData || []) {
        const normalizedSubmissionEmail = submission.normalized_email || normalizeEmail(submission.email)
        const normalizedSubmissionPhone = submission.normalized_phone || normalizePhone(submission.phone)
        const matchesByActorId = new Map<string, DuplicateMatch>()

        if (normalizedSubmissionEmail) {
          const emailMatches = actorsByEmail.get(normalizedSubmissionEmail) || []
          for (const actor of emailMatches) {
            matchesByActorId.set(actor.id, { actor, matchType: "email" })
          }
        }

        if (normalizedSubmissionPhone) {
          const phoneMatches = actorsByPhone.get(normalizedSubmissionPhone) || []
          for (const actor of phoneMatches) {
            const existingMatch = matchesByActorId.get(actor.id)
            if (!existingMatch) {
              matchesByActorId.set(actor.id, { actor, matchType: "phone" })
            } else if (existingMatch.matchType !== "both") {
              matchesByActorId.set(actor.id, { actor, matchType: "both" })
            }
          }
        }

        if (matchesByActorId.size > 0) {
          duplicates[submission.id] = Array.from(matchesByActorId.values())
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
    console.log("[v0] handleApprove called for:", submission.full_name)
    try {
      const supabase = createBrowserClient()

      const genderInEnglish = submission.gender === "זכר" ? "male" : "female"

      console.log("[v0] Inserting actor into database:", { full_name: submission.full_name, gender: genderInEnglish })

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
        youtube_link: submission.youtube_link || "",
        singing_styles: submission.singing_styles || [],
        singing_level: submission.singing_level || "",
        is_singer: submission.is_singer || false,
        is_course_grad: submission.is_course_graduate || false,
        vat_status: submission.vat_status || "ptor",
        skills: convertSkillStringsToObjects(submission.skills || []),
        languages: convertLanguageStringsToObjects(submission.languages || []),
        city: submission.raw_payload?.city || "",
        dubbing_experience_years: submission.raw_payload?.dubbing_experience_years || 0,
        notes: submission.notes,
      })

      if (insertError) {
        console.error("[v0] Insert error:", insertError)
        throw insertError
      }

      console.log("[v0] Actor inserted successfully, updating submission status")

      const { error: updateError } = await supabase
        .from("actor_submissions")
        .update({
          review_status: "approved",
        })
        .eq("id", submission.id)

      if (updateError) {
        console.error("[v0] Update error:", updateError)
        throw updateError
      }

      console.log("[v0] Submission approved successfully")
      toast({ title: "הצלחה", description: `הבקשה של ${submission.full_name} אושרה בהצלחה` })
      
      await loadSubmissions()
      setIsReviewDialogOpen(false)
      setSelectedSubmission(null)
    } catch (error) {
      console.error("[v0] Error approving submission:", error)
      toast({ 
        title: "שגיאה", 
        description: error instanceof Error ? error.message : "שגיאה באישור הבקשה", 
        variant: "destructive" 
      })
    }
  }

  async function handleReject(submission: ActorSubmission) {
    console.log("[v0] handleReject called for:", submission.full_name)
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from("actor_submissions")
        .update({
          review_status: "rejected",
        })
        .eq("id", submission.id)

      if (error) {
        console.error("[v0] Reject error:", error)
        throw error
      }

      console.log("[v0] Submission rejected successfully")
      toast({ title: "הצלחה", description: `הבקשה של ${submission.full_name} נדחתה` })

      await loadSubmissions()
      setIsReviewDialogOpen(false)
      setSelectedSubmission(null)
    } catch (error) {
      console.error("[v0] Error rejecting submission:", error)
      toast({ 
        title: "שגיאה", 
        description: error instanceof Error ? error.message : "שגיאה בדחיית הבקשה", 
        variant: "destructive" 
      })
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

  const [pendingSubmissions, approvedSubmissions, rejectedSubmissions] = useMemo(() => {
    const pending: ActorSubmission[] = []
    const approved: ActorSubmission[] = []
    const rejected: ActorSubmission[] = []

    for (const submission of submissions) {
      if (submission.review_status === "pending") pending.push(submission)
      else if (submission.review_status === "approved") approved.push(submission)
      else if (submission.review_status === "rejected") rejected.push(submission)
    }

    return [pending, approved, rejected]
  }, [submissions])

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
              rejectedSubmissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onPlayAudio={handlePlayAudio}
                  isPlaying={isPlaying === submission.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reviewAction === "approve" ? "אישור בקשה" : "דחיית בקשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reviewAction === "approve"
                ? `האם אתה בטוח שברצונך לאשר את הבקשה של ${selectedSubmission?.full_name}?`
                : `האם אתה בטוח שברצונך לדחות את הבקשה של ${selectedSubmission?.full_name}?`}
            </p>

          </div>
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
                    ? "secondary"
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
                  {submission.singing_level && (
                    <Badge variant="outline" className="text-xs">{submission.singing_level}</Badge>
                  )}
                </div>
              )}
              {submission.singing_styles && submission.singing_styles.length > 0 && (
                <div>
                  <p className="font-medium mb-1">סגנונות שירה:</p>
                  <div className="flex flex-wrap gap-1">
                    {submission.singing_styles.map((style) => (
                      <Badge key={style} variant="secondary" className="text-xs">{style}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {submission.youtube_link && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <a href={submission.youtube_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate max-w-[200px]">לינק ליוטיוב</a>
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
                onClick={(e) => onPlayAudio(submission.voice_sample_url!, submission.id, e)}
              >
                <Music className="h-4 w-4 ml-2" />
                {isPlaying ? "עצור" : "השמע דוגמה"}
              </Button>
            )}
            {submission.singing_sample_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => onPlayAudio(submission.singing_sample_url!, `${submission.id}-singing`, e)}
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

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminPageContent />
    </ProtectedRoute>
  )
}
