"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Heart, Play, Pause, Bookmark, MoreVertical, Music, GraduationCap, User, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { type Actor, VAT_STATUS_LABELS } from "@/lib/types"

interface ActorCardProps {
  actor: Actor
  isSelected: boolean
  isFavorited: boolean
  onToggleFavorite: (id: string) => void
  onToggleSelect: (id: string) => void
  onAddToProject?: (actor: Actor) => void
  onAddToFolder?: (actor: Actor) => void
  onDelete?: (id: string) => void
  onEdit?: (actor: Actor) => void
}

export function ActorCard({
  actor,
  isSelected,
  isFavorited,
  onToggleFavorite,
  onToggleSelect,
  onAddToProject,
  onAddToFolder,
  onDelete,
  onEdit,
}: ActorCardProps) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  const currentYear = new Date().getFullYear()
  const age = currentYear - actor.birth_year

  const handleNavigateToProfile = () => {
    router.push(`/actors/${actor.id}`)
  }

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!actor.voice_sample_url) {
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(actor.voice_sample_url)
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false)
      })
      audioRef.current.addEventListener("error", () => {
        setIsPlaying(false)
      })
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    }
  }

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAddToProject) {
      onAddToProject(actor)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/actors/${actor.id}`)
  }

  const handleAddToProject = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAddToProject) {
      onAddToProject(actor)
    }
  }

  const handleAddToFolder = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAddToFolder) {
      onAddToFolder(actor)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onEdit) {
      onEdit(actor)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete) {
      onDelete(actor.id)
    }
  }

  const handleExport = async (e: React.MouseEvent, format: "pdf" | "excel") => {
    e.preventDefault()
    e.stopPropagation()
    const { exportActor } = await import("@/lib/export-utils")
    exportActor(actor, format)
  }

  return (
    <Card
      className="group relative overflow-hidden transition-all hover:shadow-lg"
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted cursor-pointer" onClick={handleNavigateToProfile}>
        {actor.image_url ? (
          <img
            src={actor.image_url || "/placeholder.svg"}
            alt={actor.full_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <div className="text-center">
              <User
                className={`h-20 w-20 md:h-24 md:w-24 mx-auto mb-2 ${actor.gender === "male" ? "text-blue-400" : "text-pink-400"}`}
              />
              <p className="text-xs text-muted-foreground">{actor.gender === "male" ? "זכר" : "נקבה"}</p>
            </div>
          </div>
        )}

        {showOverlay && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-between p-3 md:p-4">
            {/* Top actions */}
            <div className="flex items-start justify-between">
              <div className="flex gap-1 md:gap-2 flex-wrap">
                {actor.is_singer && (
                  <Badge variant="secondary" className="bg-amber-400 text-amber-950 text-[8px] md:text-[10px] px-1 md:px-1.5 py-0 font-bold shadow-md ring-1 ring-amber-300/50 backdrop-blur-sm">
                    <Music className="h-2 w-2 md:h-2.5 md:w-2.5 ml-0.5" />
                    זמר/ת
                  </Badge>
                )}
                {actor.is_course_grad && (
                  <Badge variant="secondary" className="bg-emerald-400 text-emerald-950 text-[8px] md:text-[10px] px-1 md:px-1.5 py-0 font-bold shadow-md ring-1 ring-emerald-300/50 backdrop-blur-sm">
                    <GraduationCap className="h-2 w-2 md:h-2.5 md:w-2.5 ml-0.5" />
                    בוגר/ת
                  </Badge>
                )}
              </div>
            </div>

            {/* Bottom details */}
            <div className="space-y-2 md:space-y-3">
              <div className="space-y-1 text-white">
                <div className="flex items-center justify-between text-xs md:text-sm">
                  <span>{age} שנים</span>
                  <span className="text-yellow-400 font-medium">גיל</span>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm">
                  <span>{actor.gender === "male" ? "זכר" : "נקבה"}</span>
                  <span className="text-yellow-400 font-medium">מין</span>
                </div>
                <div className="flex items-center justify-between text-[10px] md:text-sm">
                  <span className="text-[10px] md:text-xs">{VAT_STATUS_LABELS[actor.vat_status]}</span>
                  <span className="text-yellow-400 font-medium">מע״מ</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 md:gap-1.5">
                {actor.skills.slice(0, 2).map((skill) => (
                  <Badge
                    key={skill.id}
                    variant="secondary"
                    className="bg-background/90 text-foreground text-[9px] md:text-xs px-1 md:px-2 py-0 md:py-0.5"
                  >
                    {skill.label}
                  </Badge>
                ))}
                {actor.languages.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/90 text-white text-[9px] md:text-xs px-1 md:px-2 py-0 md:py-0.5"
                  >
                    {actor.languages[0].label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="p-2 md:p-3 space-y-2 md:space-y-3">
        {/* Action buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 md:h-8 md:w-8 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(actor.id)
            }}
          >
            <Heart className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isFavorited ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 md:h-8 md:w-8 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            onClick={handlePlayAudio}
            disabled={!actor.voice_sample_url}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 md:h-4 md:w-4" />
            ) : (
              <Play className="h-3.5 w-3.5 md:h-4 md:w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 md:h-8 md:w-8 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            onClick={handleBookmark}
          >
            <Bookmark className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
        </div>

        {/* Name and checkbox */}
        <div className="flex items-center gap-2 md:gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(actor.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
          />
          <span
            className="font-medium text-xs md:text-sm flex-1 line-clamp-1 cursor-pointer hover:text-primary transition-colors"
            onClick={handleNavigateToProfile}
          >
            {actor.full_name}
          </span>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-primary/10 hover:text-primary transition-all duration-200"
              >
                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleViewDetails(e as any)
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                פרטים מלאים
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleAddToProject(e as any)
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                הוסף לפרויקט
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleAddToFolder(e as any)
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                הוסף לתיקייה
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleEdit(e as any)
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                ערוך
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleExport(e as any, "pdf")
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <Download className="h-4 w-4 ml-2" />
                ייצוא PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleExport(e as any, "excel")
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <Download className="h-4 w-4 ml-2" />
                ייצוא Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleDelete(e as any)
                }}
                className="cursor-pointer text-destructive hover:bg-destructive/20 hover:text-destructive focus:bg-destructive/20 focus:text-destructive transition-colors"
              >
                מחיקה
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
