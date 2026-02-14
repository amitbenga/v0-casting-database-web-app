"use client"

import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react"
import useSWRInfinite from "swr/infinite"
import { ActorCard } from "@/components/actor-card"
import { FilterPanel } from "@/components/filter-panel"
import { Search, SlidersHorizontal, UserPlus, MoreVertical, FolderPlus, Film, Heart, Trash2, X, Download, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Actor, FilterState } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AppHeader } from "@/components/app-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SelectFolderDialog } from "@/components/select-folder-dialog"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/contexts/AuthContext"
import { exportActors } from "@/lib/export-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const PAGE_SIZE = 20

// Mapper function to convert DB record to Actor type
function mapActor(actor: any): Actor {
  return {
    id: actor.id,
    full_name: actor.full_name,
    gender: actor.gender,
    birth_year: actor.birth_year,
    phone: actor.phone,
    email: actor.email || "",
    is_singer: actor.is_singer || false,
    is_course_grad: actor.is_course_grad || false,
    vat_status: actor.vat_status,
    image_url: actor.image_url || "",
    voice_sample_url: actor.voice_sample_url || "",
    notes: actor.notes || "",
    city: actor.city || "",
    skills: Array.isArray(actor.skills) ? actor.skills : [],
    languages: Array.isArray(actor.languages) ? actor.languages : [],
    other_lang_text: actor.other_lang_text || "",
    created_at: actor.created_at,
    updated_at: actor.updated_at,
    // שדות חדשים - דיבוב ושירה
    dubbing_experience_years: actor.dubbing_experience_years || 0,
    singing_styles: Array.isArray(actor.singing_styles) ? actor.singing_styles : [],
    singing_styles_other: Array.isArray(actor.singing_styles_other) ? actor.singing_styles_other : [],
  }
}

// Fetcher for SWR Infinite - cursor-based pagination
async function fetchActorsPage(cursor: string | null): Promise<{ actors: Actor[]; nextCursor: string | null }> {
  const supabase = createClient()
  
  let query = supabase
    .from("actors")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE)
  
  if (cursor) {
    // Parse cursor: "created_at|id"
    const [cursorDate, cursorId] = cursor.split("|")
    query = query.or(`created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("[v0] Error fetching actors:", error)
    throw error
  }
  
  const actors = (data || []).map(mapActor)
  
  // Generate next cursor from last item
  const lastActor = actors[actors.length - 1]
  const nextCursor = actors.length === PAGE_SIZE && lastActor 
    ? `${lastActor.created_at}|${lastActor.id}` 
    : null
  
  return { actors, nextCursor }
}

function ActorsDatabaseContent() {
  const { user } = useAuth() // Get authenticated user
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedActors, setSelectedActors] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all")
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [selectedActorForFolder, setSelectedActorForFolder] = useState<Actor | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    gender: [],
    ageMin: 18,
    ageMax: 80,
    isSinger: null,
    isCourseGrad: null,
    skills: [],
    languages: [],
    vatStatus: [],
    sortBy: "newest",
    dubbingExperience: [],
    singingStyles: [],
  })
  const [bulkFolderDialogOpen, setBulkFolderDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false) // Declare the loading variable
  
  // Infinite scroll observer ref
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // SWR Infinite for cursor-based pagination
  const getKey = (pageIndex: number, previousPageData: { actors: Actor[]; nextCursor: string | null } | null) => {
    // First page - no cursor
    if (pageIndex === 0) return ["actors", null]
    // No more pages
    if (previousPageData && !previousPageData.nextCursor) return null
    // Return cursor for next page
    return ["actors", previousPageData?.nextCursor]
  }
  
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    getKey,
    ([, cursor]) => fetchActorsPage(cursor as string | null),
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      dedupingInterval: 60000, // 1 minute cache
    }
  )
  
  // Flatten all pages into single actors array
  const actors = data ? data.flatMap(page => page.actors) : []
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined")
  const isEmpty = data?.[0]?.actors.length === 0
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.nextCursor === null)
  
  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isReachingEnd) {
          setSize(size + 1)
        }
      },
      { threshold: 0.1 }
    )
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }
    
    return () => observer.disconnect()
  }, [isLoadingMore, isReachingEnd, size, setSize])
  
  // Load favorites
  useEffect(() => {
    async function loadFavorites() {
      if (!user?.id) return
      
      const supabase = createClient()
      const { data: favoritesData, error: favoritesError } = await supabase
        .from("favorites")
        .select("actor_id")
        .eq("user_id", user.id)
      
      if (favoritesError) {
        console.error("[v0] Error loading favorites:", favoritesError)
      } else if (favoritesData) {
        setFavorites(favoritesData.map((fav) => fav.actor_id))
      }
    }
    
    loadFavorites()
  }, [user])

  const handleToggleFavorite = async (actorId: string) => {
    const supabase = createClient()
    const isFavorited = favorites.includes(actorId)

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user?.id)
          .eq("actor_id", actorId)

        if (error) {
          console.error("[v0] Error removing from favorites:", error)
          return
        }

        setFavorites((prev) => prev.filter((id) => id !== actorId))
      } else {
        const { error } = await supabase.from("favorites").insert({ user_id: user?.id, actor_id: actorId })

        if (error) {
          console.error("[v0] Error adding to favorites:", error)
          return
        }

        setFavorites((prev) => [...prev, actorId])
      }
    } catch (error) {
      console.error("[v0] Error toggling favorite:", error)
    }
  }

  const handleToggleSelect = (actorId: string) => {
    setSelectedActors((prev) => (prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]))
  }

  const handleAddToProject = (actor: Actor) => {
    console.log("[v0] Add to project:", actor.full_name)
    // TODO: פתיחת דיאלוג לבחירת פרויקט
    alert(`הוסף את ${actor.full_name} לפרויקט (בקרוב)`)
  }

  const handleAddToFolder = (actor: Actor) => {
    console.log("[v0] Add to folder:", actor.full_name)
    setSelectedActorForFolder(actor)
    setFolderDialogOpen(true)
  }

  const handleEdit = (actor: Actor) => {
    console.log("[v0] Edit actor:", actor.full_name)
    // Navigate to edit page
    window.location.href = `/actors/${actor.id}`
  }

  const handleDelete = async (id: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("actors").delete().eq("id", id)

      if (error) {
        console.error("[v0] Error deleting actor:", error)
        alert("שגיאה במחיקת השחקן")
        return
      }

      // Optimistically update cache - remove actor from all pages
      mutate(
        (currentData) => currentData?.map(page => ({
          ...page,
          actors: page.actors.filter(actor => actor.id !== id)
        })),
        false
      )
      setFavorites((prev) => prev.filter((favId) => favId !== id))
      setSelectedActors((prev) => prev.filter((actorId) => actorId !== id))
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("שגיאה במחיקת השחקן")
    }
  }

  const handleBulkAddToFavorites = async () => {
    const supabase = createClient()
    for (const actorId of selectedActors) {
      if (!favorites.includes(actorId)) {
        await supabase.from("favorites").insert({ user_id: user?.id, actor_id: actorId })
      }
    }
    setFavorites((prev) => [...new Set([...prev, ...selectedActors])])
    setSelectedActors([])
  }

  const handleBulkAddToFolder = () => {
    setBulkFolderDialogOpen(true)
  }

  const handleBulkAddToProject = () => {
    alert(`הוספת ${selectedActors.length} שחקנים לפרויקט (בקרוב)`)
    setSelectedActors([])
  }

  const handleBulkDelete = async () => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedActors.length} שחקנים?`)) {
      return
    }
    const supabase = createClient()
    for (const actorId of selectedActors) {
      await supabase.from("actors").delete().eq("id", actorId)
    }
    mutate((prevData) => {
      if (!prevData) return prevData
      return prevData.map((page) => ({
        ...page,
        actors: page.actors.filter((actor) => !selectedActors.includes(actor.id)),
      }))
    })
    setFavorites((prev) => prev.filter((id) => !selectedActors.includes(id)))
    setSelectedActors([])
  }

  const handleClearSelection = () => {
    setSelectedActors([])
  }

  const handleBulkExport = (format: "pdf" | "excel") => {
    const selectedActorObjects = actors.filter((actor) => selectedActors.includes(actor.id))
    if (selectedActorObjects.length === 0) {
      alert("אין שחקנים נבחרים")
      return
    }
    exportActors(selectedActorObjects, format, "selected_actors")
  }

  // Stable shuffle seed - created once per mount so cards don't jump on pagination
  const [shuffleSeed] = useState(() => Math.random())

  // Shuffle actors with stable seed (Fisher-Yates with seeded PRNG)
  const shuffledActors = useMemo(() => {
    const arr = [...actors]
    // Simple seeded PRNG (mulberry32)
    let s = Math.floor(shuffleSeed * 2147483647)
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [actors, shuffleSeed])

  const displayedActors = activeTab === "favorites" ? shuffledActors.filter((actor) => favorites.includes(actor.id)) : shuffledActors

  const filteredActors = displayedActors
    .filter((actor) => {
      const currentYear = new Date().getFullYear()
      const actorAge = currentYear - actor.birth_year

      const query = searchQuery.toLowerCase()
      const matchesSearch =
        actor.full_name.toLowerCase().includes(query) ||
        actor.phone.toLowerCase().includes(query) ||
        actor.email.toLowerCase().includes(query) ||
        actor.notes.toLowerCase().includes(query) ||
        actor.skills.some((skill) => skill.label.toLowerCase().includes(query)) ||
        actor.languages.some((lang) => lang.label.toLowerCase().includes(query)) ||
        (actor.other_lang_text?.toLowerCase().includes(query) ?? false) ||
        (actor.city?.toLowerCase().includes(query) ?? false)

      if (!matchesSearch) return false

      if (filters.gender.length > 0 && !filters.gender.includes(actor.gender)) {
        return false
      }

      if (actorAge < filters.ageMin || actorAge > filters.ageMax) {
        return false
      }

      if (filters.isSinger !== null && actor.is_singer !== filters.isSinger) {
        return false
      }

      if (filters.isCourseGrad !== null && actor.is_course_grad !== filters.isCourseGrad) {
        return false
      }

      if (filters.skills.length > 0) {
        const actorSkills = actor.skills.map((s) => s.key)
        const hasSkill = filters.skills.some((skill) => actorSkills.includes(skill))
        if (!hasSkill) return false
      }

      if (filters.languages.length > 0) {
        const actorLangs = actor.languages.map((l) => l.key)
        const hasLang = filters.languages.some((lang) => actorLangs.includes(lang))
        if (!hasLang) return false
      }

      if (filters.vatStatus.length > 0 && !filters.vatStatus.includes(actor.vat_status)) {
        return false
      }

      // סינון לפי ניסיון בדיבוב
      if (filters.dubbingExperience && filters.dubbingExperience.length > 0) {
        const actorYears = actor.dubbing_experience_years || 0
        const matchesRange = filters.dubbingExperience.some((range) => {
          if (range === "0-1") return actorYears >= 0 && actorYears <= 1
          if (range === "2-4") return actorYears >= 2 && actorYears <= 4
          if (range === "5+") return actorYears >= 5
          return false
        })
        if (!matchesRange) return false
      }

      // סינון לפי סגנונות שירה
      if (filters.singingStyles && filters.singingStyles.length > 0) {
        const actorStyles = (actor.singing_styles || []) as { style: string; level: string }[]
        const actorStyleKeys = actorStyles.map(s => s.style)
        const hasMatchingStyle = filters.singingStyles.some(style => actorStyleKeys.includes(style))
        if (!hasMatchingStyle) return false
      }

      return true
    })
    .sort((a, b) => {
      const currentYear = new Date().getFullYear()

      switch (filters.sortBy) {
        case "alphabetical":
          return a.full_name.localeCompare(b.full_name, "he")
        case "age-asc":
          return currentYear - b.birth_year - (currentYear - a.birth_year)
        case "age-desc":
          return currentYear - a.birth_year - (currentYear - b.birth_year)
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">טוען שחקנים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="border-b bg-card">
        <div className="container mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 text-sm"
              />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant={showFilters ? "default" : "outline"} size="icon" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[350px]">
                <SheetHeader>
                  <SheetTitle>סינון</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterPanel onFilterChange={setFilters} />
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant={showFilters ? "default" : "outline"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="hidden md:flex"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>

            {selectedActors.length > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium">{selectedActors.length} נבחרו</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkAddToFavorites()
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <Heart className="h-4 w-4 ml-2" />
                      הוסף למועדפים
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkAddToProject()
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <Film className="h-4 w-4 ml-2" />
                      הוסף לפרויקט
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkAddToFolder()
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <FolderPlus className="h-4 w-4 ml-2" />
                      הוסף לתיקייה
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkExport("pdf")
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <Download className="h-4 w-4 ml-2" />
                      ייצוא PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkExport("excel")
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <Download className="h-4 w-4 ml-2" />
                      ייצוא Excel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleBulkDelete()
                      }}
                      className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      מחיקה
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-primary/20"
                  onClick={handleClearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button asChild size="sm" className="md:size-default">
              <Link href="/intake">
                <UserPlus className="h-4 w-4 ml-2" />
                <span className="hidden sm:inline">הוסף שחקן</span>
                <span className="sm:hidden">הוסף</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="flex gap-4 md:gap-6">
          {showFilters && (
            <aside className="hidden md:block w-64 flex-shrink-0">
              <FilterPanel onFilterChange={setFilters} />
            </aside>
          )}

          <div className="flex-1">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "all" | "favorites")}
              className="w-full"
            >
              <TabsList className="mb-6">
                <TabsTrigger value="all">כל השחקנים ({actors.length})</TabsTrigger>
                <TabsTrigger value="favorites">מועדפים ({favorites.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                  {filteredActors.map((actor) => (
                    <ActorCard
                      key={actor.id}
                      actor={actor}
                      isSelected={selectedActors.includes(actor.id)}
                      isFavorited={favorites.includes(actor.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSelect={handleToggleSelect}
                      onAddToProject={handleAddToProject}
                      onAddToFolder={handleAddToFolder}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>

                {filteredActors.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">לא נמצאו שחקנים התואמים את החיפוש.</p>
                  </div>
                )}
                
                {/* Infinite scroll trigger */}
                <div ref={loadMoreRef} className="w-full py-8 flex justify-center">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <p className="text-muted-foreground text-sm">טוען עוד שחקנים...</p>
                    </div>
                  )}
                  {isReachingEnd && actors.length > 0 && (
                    <p className="text-muted-foreground text-sm">הצגת כל {actors.length} השחקנים</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="favorites" className="mt-0">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                  {filteredActors.map((actor) => (
                    <ActorCard
                      key={actor.id}
                      actor={actor}
                      isSelected={selectedActors.includes(actor.id)}
                      isFavorited={favorites.includes(actor.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSelect={handleToggleSelect}
                      onAddToProject={handleAddToProject}
                      onAddToFolder={handleAddToFolder}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>

                {filteredActors.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      {favorites.length === 0
                        ? "עדיין לא הוספת שחקנים למועדפים."
                        : "לא נמצאו שחקנים מועדפים התואמים את החיפוש."}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {selectedActorForFolder && (
        <SelectFolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          actorIds={[selectedActorForFolder.id]}
          actorNames={[selectedActorForFolder.full_name]}
        />
      )}

      {selectedActors.length > 0 && (
        <SelectFolderDialog
          open={bulkFolderDialogOpen}
          onOpenChange={setBulkFolderDialogOpen}
          actorIds={selectedActors}
          actorNames={actors.filter((a) => selectedActors.includes(a.id)).map((a) => a.full_name)}
          onSuccess={() => setSelectedActors([])}
        />
      )}
    </div>
  )
}

export default function ActorsDatabase() {
  return (
    <ProtectedRoute>
      <ActorsDatabaseContent />
    </ProtectedRoute>
  )
}
