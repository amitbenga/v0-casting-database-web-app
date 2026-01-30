"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Loader2 } from "lucide-react"
import { searchActors } from "@/lib/actions/casting-actions"

interface ActorBasic {
  id: string
  name: string
  image_url?: string
}

interface ActorSearchAutocompleteProps {
  onSelect: (actor: ActorBasic) => void
  placeholder?: string
  disabled?: boolean
}

export function ActorSearchAutocomplete({
  onSelect,
  placeholder = "חיפוש שחקן...",
  disabled = false,
}: ActorSearchAutocompleteProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ActorBasic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const searchDebounced = async () => {
      if (query.length < 1) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const actors = await searchActors(query)
        setResults(actors)
        setIsOpen(true)
      } catch (error) {
        console.error("Error searching actors:", error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(searchDebounced, 200)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (actor: ActorBasic) => {
    onSelect(actor)
    setQuery("")
    setResults([])
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((actor) => (
            <button
              key={actor.id}
              type="button"
              onClick={() => handleSelect(actor)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-right transition-colors"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={actor.image_url} alt={actor.name} />
                <AvatarFallback>{actor.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{actor.name}</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && !isLoading && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">לא נמצאו תוצאות</p>
        </div>
      )}
    </div>
  )
}
