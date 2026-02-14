"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Mail, Phone, Calendar, Edit, Download, Share2, MoreVertical, Music, GraduationCap, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ActorComments } from "@/components/actor-comments"
import { ActorEditForm } from "@/components/actor-edit-form"
import { createClient } from "@/lib/supabase/client"
import { VAT_STATUS_LABELS, SINGING_STYLE_LEVEL_LABELS, SINGING_STYLES_LIST, type Actor, type SingingStyleOther, type SingingStyleWithLevel } from "@/lib/types"
import { AppHeader } from "@/components/app-header"
import { exportActor } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

export default function ActorProfile() {
  const params = useParams()
  const { toast } = useToast()
  const actorId = params?.id as string

  const [isEditing, setIsEditing] = useState(false)
  const [actor, setActor] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(true)

  const handleShare = async () => {
    if (!actor) return
    
    const url = window.location.href
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: actor.full_name,
          text: `פרופיל שחקן: ${actor.full_name}`,
          url: url,
        })
      } catch (err) {
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        toast({ title: "הועתק", description: "הקישור הועתק ללוח" })
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleDownload = (format: "pdf" | "excel") => {
    if (!actor) return
    exportActor(actor, format)
  }

  useEffect(() => {
    if (!actorId) return

    async function loadActor() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("actors").select("*").eq("id", actorId).single()

        if (error) {
          console.error("[v0] Error loading actor:", error)
          return
        }

        if (data) {
          const mappedActor: Actor = {
            id: data.id,
            full_name: data.full_name,
            gender: data.gender,
            birth_year: data.birth_year,
            phone: data.phone,
            email: data.email || "",
            is_singer: data.is_singer || false,
            is_course_grad: data.is_course_grad || false,
            vat_status: data.vat_status,
            image_url: data.image_url || "",
            voice_sample_url: data.voice_sample_url || "",
            notes: data.notes || "",
            city: data.city || "",
            skills: Array.isArray(data.skills) ? data.skills : [],
            languages: Array.isArray(data.languages) ? data.languages : [],
            other_lang_text: data.other_lang_text || "",
            created_at: data.created_at,
            updated_at: data.updated_at,
            // שדות חדשים - דיבוב ושירה
            dubbing_experience_years: data.dubbing_experience_years || 0,
            singing_styles: Array.isArray(data.singing_styles) ? data.singing_styles : [],
            singing_styles_other: Array.isArray(data.singing_styles_other) ? data.singing_styles_other : [],
          }
          setActor(mappedActor)
        }
      } catch (error) {
        console.error("[v0] Error:", error)
      } finally {
        setLoading(false)
      }
    }

    loadActor()
  }, [actorId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    )
  }

  if (!actor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">שחקן לא נמצא</p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const age = currentYear - actor.birth_year

  const handleSave = async (updatedActor: Actor) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("actors")
        .update({
          full_name: updatedActor.full_name,
          gender: updatedActor.gender,
          birth_year: updatedActor.birth_year,
          phone: updatedActor.phone,
          email: updatedActor.email,
          is_singer: updatedActor.is_singer,
          is_course_grad: updatedActor.is_course_grad,
          vat_status: updatedActor.vat_status,
          image_url: updatedActor.image_url,
          voice_sample_url: updatedActor.voice_sample_url,
          notes: updatedActor.notes,
          city: updatedActor.city,
          skills: updatedActor.skills,
          languages: updatedActor.languages,
          other_lang_text: updatedActor.other_lang_text,
          updated_at: new Date().toISOString(),
        })
        .eq("id", actor.id)

      if (error) {
        console.error("[v0] Error updating actor:", error)
        toast({ title: "שגיאה", description: "שגיאה בשמירת הנתונים", variant: "destructive" })
        return
      }

      setActor(updatedActor)
      setIsEditing(false)
    } catch (error) {
      console.error("[v0] Error:", error)
      toast({ title: "שגיאה", description: "שגיאה בשמירת הנתונים", variant: "destructive" })
    }
  }

  if (isEditing) {
    return <ActorEditForm actor={actor} onSave={handleSave} onCancel={() => setIsEditing(false)} />
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-semibold">{actor.full_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {actor.is_singer && (
                  <Badge variant="secondary" className="text-xs">
                    <Music className="h-3 w-3 ml-1" />
                    זמר/ת
                  </Badge>
                )}
                {actor.is_course_grad && (
                  <Badge variant="secondary" className="text-xs">
                    <GraduationCap className="h-3 w-3 ml-1" />
                    בוגר/ת קורס
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Button variant="outline" onClick={() => setIsEditing(true)} size="sm" className="flex-1 md:flex-none">
                <Edit className="h-4 w-4 ml-2" />
                <span className="md:inline">ערוך</span>
              </Button>
              <Button variant="outline" size="icon" className="hidden md:flex bg-transparent" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="hidden md:flex bg-transparent">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                    הורד PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload("excel")}>
                    הורד Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>הוסף לפרויקט</DropdownMenuItem>
                  <DropdownMenuItem>הוסף לתיקייה</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                    <Download className="h-4 w-4 ml-2" />
                    ייצוא PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload("excel")}>
                    <Download className="h-4 w-4 ml-2" />
                    ייצוא Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">מחק שחקן</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Sidebar */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-[3/4] overflow-hidden bg-muted">
                {actor.image_url ? (
                  <img
                    src={actor.image_url || "/placeholder.svg"}
                    alt={actor.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <div className="text-center p-8">
                      <div
                        className={`h-32 w-32 mx-auto mb-4 rounded-full flex items-center justify-center ${actor.gender === "male" ? "bg-blue-100" : "bg-pink-100"}`}
                      >
                        <span className={`text-6xl ${actor.gender === "male" ? "text-blue-500" : "text-pink-500"}`}>
                          {actor.gender === "male" ? "♂" : "♀"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">אין תמונה</p>
                      <p className="text-xs text-muted-foreground mt-1">{actor.gender === "male" ? "זכר" : "נקבה"}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">מידע מהיר</h3>
              <Separator />

              <div className="space-y-2">
                {actor.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">טלפון</p>
                      <p className="text-sm text-muted-foreground">{actor.phone}</p>
                    </div>
                  </div>
                )}

                {actor.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">אימייל</p>
                      <p className="text-sm text-muted-foreground">{actor.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">שנת לידה</p>
                    <p className="text-sm text-muted-foreground">
                      {actor.birth_year} (גיל {age})
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">מין</p>
                    <p className="text-sm text-muted-foreground">{actor.gender === "male" ? "זכר" : "נקבה"}</p>
                  </div>
                </div>

                {actor.city && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">עיר</p>
                      <p className="text-sm text-muted-foreground">{actor.city}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">מעמד במע״מ</p>
                    <p className="text-sm text-muted-foreground">{VAT_STATUS_LABELS[actor.vat_status]}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">פרטים</TabsTrigger>
                <TabsTrigger value="voice">קובץ קול</TabsTrigger>
                <TabsTrigger value="comments">הערות</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {actor.notes && (
                  <Card className="p-4 md:p-6">
                    <h3 className="font-semibold mb-4">הערות</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{actor.notes}</p>
                  </Card>
                )}

                <Card className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">ניסיון בדיבוב</h3>
                  <p className="text-sm">
                    {actor.dubbing_experience_years && actor.dubbing_experience_years > 0 
                      ? `${actor.dubbing_experience_years} שנים` 
                      : "לא צוין"}
                  </p>
                </Card>

                <Card className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">סגנונות שירה</h3>
                  <div className="space-y-4">
                    {actor.singing_styles && actor.singing_styles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {(actor.singing_styles as SingingStyleWithLevel[]).map((item, index) => {
                          const styleInfo = SINGING_STYLES_LIST.find(s => s.key === item.style)
                          return styleInfo ? (
                            <Badge key={index} variant="outline">
                              {styleInfo.label} ({SINGING_STYLE_LEVEL_LABELS[item.level]})
                            </Badge>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">לא צוינו סגנונות שירה</p>
                    )}

                    {actor.singing_styles_other && actor.singing_styles_other.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">סגנונות נוספים</p>
                        <div className="flex flex-wrap gap-2">
                          {actor.singing_styles_other.map((item: SingingStyleOther, index: number) => (
                            <Badge key={index} variant="secondary">
                              {item.name} ({SINGING_STYLE_LEVEL_LABELS[item.level]})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">כישורים</h3>
                  <div className="flex flex-wrap gap-2">
                    {actor.skills.length > 0 ? (
                      actor.skills.map((skill) => (
                        <Badge key={skill.id} variant="outline">
                          {skill.label}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">לא צוינו כישורים</p>
                    )}
                  </div>
                </Card>

                <Card className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">שפות</h3>
                  <div className="flex flex-wrap gap-2">
                    {actor.languages.length > 0 ? (
                      actor.languages.map((language) => (
                        <Badge key={language.id} variant="outline">
                          {language.label}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">לא צוינו שפות</p>
                    )}
                  </div>
                  {actor.other_lang_text && (
                    <p className="text-sm text-muted-foreground mt-3">
                      <span className="font-medium">שפות נוספות:</span> {actor.other_lang_text}
                    </p>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="voice">
                <Card className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">קובץ קול</h3>
                  {actor.voice_sample_url ? (
                    <audio controls className="w-full">
                      <source src={actor.voice_sample_url} type="audio/mpeg" />
                      הדפדפן שלך לא תומך בהשמעת קבצי שמע.
                    </audio>
                  ) : (
                    <p className="text-sm text-muted-foreground">לא הועלה קובץ קול</p>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="comments">
                <ActorComments actorId={actor.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
