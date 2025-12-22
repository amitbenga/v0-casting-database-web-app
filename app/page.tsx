"use client"

import { useState, useEffect } from "react"
import { ActorCard } from "@/components/actor-card"
import { FilterPanel } from "@/components/filter-panel"
import { Search, SlidersHorizontal, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Actor } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AppHeader } from "@/components/app-header"
import type { FilterState } from "@/lib/types"

export default function ActorsDatabase() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedActors, setSelectedActors] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
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
  })

  useEffect(() => {
    async function loadActors() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("actors").select("*").order("full_name")

        if (error) {
          console.error("[v0] Error loading actors:", error)
          return
        }

        if (data) {
          const mappedActors: Actor[] = data.map((actor: any) => ({
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
          }))
          setActors(mappedActors)
        }
      } catch (error) {
        console.error("[v0] Error:", error)
      } finally {
        setLoading(false)
      }
    }

    loadActors()
  }, [])

  const handleToggleFavorite = (actorId: string) => {
    setFavorites((prev) => (prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]))
  }

  const handleToggleSelect = (actorId: string) => {
    setSelectedActors((prev) => (prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]))
  }

  const filteredActors = actors
    .filter((actor) => {
      const currentYear = new Date().getFullYear()
      const actorAge = currentYear - actor.birth_year

      // חיפוש טקסט
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

      // סינון מין
      if (filters.gender.length > 0 && !filters.gender.includes(actor.gender)) {
        return false
      }

      // סינון גיל
      if (actorAge < filters.ageMin || actorAge > filters.ageMax) {
        return false
      }

      // סינון זמר
      if (filters.isSinger !== null && actor.is_singer !== filters.isSinger) {
        return false
      }

      // סינון בוגר קורס
      if (filters.isCourseGrad !== null && actor.is_course_grad !== filters.isCourseGrad) {
        return false
      }

      // סינון כישורים
      if (filters.skills.length > 0) {
        const actorSkills = actor.skills.map((s) => s.key)
        const hasSkill = filters.skills.some((skill) => actorSkills.includes(skill))
        if (!hasSkill) return false
      }

      // סינון שפות
      if (filters.languages.length > 0) {
        const actorLangs = actor.languages.map((l) => l.key)
        const hasLang = filters.languages.some((lang) => actorLangs.includes(lang))
        if (!hasLang) return false
      }

      // סינון מעמד במע"מ
      if (filters.vatStatus.length > 0 && !filters.vatStatus.includes(actor.vat_status)) {
        return false
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען שחקנים...</p>
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
              <div className="text-sm text-muted-foreground">{selectedActors.length} נבחרו</div>
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {filteredActors.map((actor) => (
                <Link key={actor.id} href={`/actors/${actor.id}`}>
                  <ActorCard
                    actor={actor}
                    isSelected={selectedActors.includes(actor.id)}
                    isFavorited={favorites.includes(actor.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleSelect={handleToggleSelect}
                  />
                </Link>
              ))}
            </div>

            {filteredActors.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">לא נמצאו שחקנים התואמים את החיפוש.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
