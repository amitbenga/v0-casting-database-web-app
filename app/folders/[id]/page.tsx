"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Search, MoreVertical, Folder, Trash2, Play, Pause, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AddActorToFolderDialog } from "@/components/add-actor-to-folder-dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import Link from "next/link"
import { exportActors } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

export default function FolderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [folder, setFolder] = useState<any>(null)
  const [actors, setActors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddActorDialog, setShowAddActorDialog] = useState(false)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadFolder()
    loadFolderActors()
  }, [params.id])

  async function loadFolder() {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase.from("folders").select("*").eq("id", params.id).single()

      if (error) throw error

      setFolder(data)
    } catch (error) {
      console.error("[v0] Error loading folder:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadFolderActors() {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("folder_actors")
        .select(
          `
          *,
          actors (*)
        `,
        )
        .eq("folder_id", params.id)

      if (error) throw error

      setActors(data?.map((fa) => fa.actors) || [])
    } catch (error) {
      console.error("[v0] Error loading folder actors:", error)
    }
  }

  async function removeActorFromFolder(actorId: string) {
    if (!confirm("האם להסיר שחקן זה מהתיקייה?")) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("folder_actors").delete().eq("folder_id", params.id).eq("actor_id", actorId)

      if (error) throw error

      setActors((prev) => prev.filter((a) => a.id !== actorId))
    } catch (error) {
      console.error("[v0] Error removing actor from folder:", error)
        toast({ title: "שגיאה", description: "שגיאה בהסרת שחקן", variant: "destructive" })
    }
  }

  async function deleteFolder() {
    if (!confirm("האם אתה בטוח שברצונך למחוק את התיקייה? פעולה זו בלתי הפיכה.")) return

    try {
      const supabase = createBrowserClient()

      // מחיקת כל השחקנים מהתיקייה תחילה
      await supabase.from("folder_actors").delete().eq("folder_id", params.id)

      // מחיקת התיקייה
      const { error } = await supabase.from("folders").delete().eq("id", params.id)

      if (error) throw error

      router.push("/folders")
    } catch (error) {
      console.error("[v0] Error deleting folder:", error)
        toast({ title: "שגיאה", description: "שגיאה במחיקת תיקייה", variant: "destructive" })
    }
  }

  function handleExportFolder(format: "pdf" | "excel") {
    if (actors.length === 0) {
      toast({ title: "ריק", description: "אין שחקנים בתיקייה לייצוא" })
      return
    }
    const filename = `folder_${folder.name.replace(/\s+/g, "_")}`
    exportActors(actors, format, filename)
  }

  const filteredActors = actors.filter(
    (actor) =>
      actor.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      actor.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      actor.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handlePlayAudio = (e: React.MouseEvent, actorId: string, voiceUrl: string | null) => {
    e.preventDefault()
    e.stopPropagation()

    if (!voiceUrl) {
        toast({ title: "לא זמין", description: "אין קובץ קול לשחקן זה" })
      return
    }

    if (playingAudioId === actorId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setPlayingAudioId(null)
    } else {
      // Start playing
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audio = new Audio(voiceUrl)
      audioRef.current = audio
      audio.play().catch((error) => {
        console.error("[v0] Error playing audio:", error)
        toast({ title: "שגיאה", description: "שגיאה בהשמעת הקול", variant: "destructive" })
      })
      audio.onended = () => setPlayingAudioId(null)
      setPlayingAudioId(actorId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">טוען תיקייה...</p>
        </div>
      </div>
    )
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl">תיקייה לא נמצאה</p>
          <Button onClick={() => router.push("/folders")}>חזרה לתיקיות</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => router.push("/folders")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-semibold truncate">{folder.name}</h1>
                  {folder.description && <p className="text-sm text-muted-foreground">{folder.description}</p>}
                  <p className="text-sm text-muted-foreground">{actors.length} שחקנים</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>שכפל תיקייה</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportFolder("pdf")}>
                    <Download className="h-4 w-4 ml-2" />
                    ייצוא PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportFolder("excel")}>
                    <Download className="h-4 w-4 ml-2" />
                    ייצוא Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={deleteFolder}>
                    מחק תיקייה
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <p className="text-sm text-muted-foreground">{filteredActors.length} שחקנים בתיקייה</p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="חפש שחקנים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
                dir="rtl"
              />
            </div>

            <Button onClick={() => setShowAddActorDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              הוסף
            </Button>
          </div>
        </div>

        {/* Actors Grid */}
        {filteredActors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredActors.map((actor) => {
              const currentAge = actor.birth_year ? new Date().getFullYear() - actor.birth_year : null

              return (
                <Card key={actor.id} className="group relative overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/actors/${actor.id}`}>
                    <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                      {actor.image_url ? (
                        <img
                          src={actor.image_url || "/placeholder.svg"}
                          alt={actor.full_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center text-6xl ${
                            actor.gender === "male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                          }`}
                        >
                          {actor.gender === "male" ? "♂" : "♀"}
                        </div>
                      )}
                    </div>
                  </Link>

                  {actor.voice_sample_url && (
                    <button
                      onClick={(e) => handlePlayAudio(e, actor.id, actor.voice_sample_url)}
                      className="absolute top-3 left-3 p-2 rounded-full bg-white/90 hover:bg-white text-primary shadow-md transition-all duration-200 hover:scale-110"
                      title={playingAudioId === actor.id ? "עצור נגינה" : "השמע דוגמית קול"}
                    >
                      {playingAudioId === actor.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}

                  <div className="p-4">
                    <Link href={`/actors/${actor.id}`}>
                      <h3 className="font-semibold mb-1 hover:underline">{actor.full_name}</h3>
                    </Link>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        {actor.gender === "male" ? "זכר" : "נקבה"}
                        {currentAge && ` • גיל ${currentAge}`}
                      </p>
                      {actor.phone && (
                        <p className="truncate" dir="ltr">
                          {actor.phone}
                        </p>
                      )}
                    </div>

                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive bg-transparent"
                        onClick={() => removeActorFromFolder(actor.id)}
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        הסר מתיקייה
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary">
                <Folder className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">אין עדיין שחקנים בתיקייה</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? "לא נמצאו שחקנים התואמים לחיפוש." : "הוסף שחקנים לארגן את מאגר השחקנים שלך."}
                </p>
              </div>
              {!searchQuery && (
                <Button onClick={() => setShowAddActorDialog(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף שחקנים
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>

      <AddActorToFolderDialog
        open={showAddActorDialog}
        onOpenChange={setShowAddActorDialog}
        folderId={params.id}
        onActorsAdded={loadFolderActors}
      />
    </div>
  )
}
