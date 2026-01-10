"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Folder, MoreVertical, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { CreateFolderDialog } from "@/components/create-folder-dialog"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase/client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function FoldersPage() {
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadFolders()
  }, [])

  async function loadFolders() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("folders")
        .select("*, folder_actors(count)")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading folders:", error)
        return
      }

      if (data) {
        setFolders(data)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredFolders = folders.filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      green: "bg-green-500/10 text-green-500 border-green-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      pink: "bg-pink-500/10 text-pink-500 border-pink-500/20",
      orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      red: "bg-red-500/10 text-red-500 border-red-500/20",
    }
    return colors[color] || colors.blue
  }

  const handleDeleteFolder = async (id: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק תיקייה זו?")) {
      try {
        const supabase = createClient()
        const { error } = await supabase.from("folders").delete().eq("id", id)

        if (error) {
          console.error("[v0] Error deleting folder:", error)
          return
        }

        await loadFolders()
      } catch (error) {
        console.error("[v0] Error:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">טוען תיקיות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Search Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="חיפוש תיקיות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="md:size-default">
              <Plus className="h-4 w-4 ml-2" />
              <span className="hidden md:inline">תיקייה חדשה</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Folders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredFolders.map((folder) => (
            <Card key={folder.id} className="p-4 md:p-6 hover:shadow-lg transition-shadow group">
              <div className="space-y-3 md:space-y-4">
                {/* Folder Icon and Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`p-2 md:p-3 rounded-lg ${getColorClass("blue")} group-hover:scale-110 transition-transform`}
                    >
                      <Folder className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/folders/${folder.id}`}>
                        <h3 className="font-semibold text-base md:text-lg hover:text-primary transition-colors truncate">
                          {folder.name}
                        </h3>
                      </Link>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-all">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" dir="rtl">
                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-accent focus:bg-accent">
                        <Link href={`/folders/${folder.id}`} className="w-full">צפייה בתיקייה</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent">עריכת תיקייה</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent">שכפול</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          handleDeleteFolder(folder.id)
                        }}
                      >
                        מחיקה
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 text-xs md:text-sm pt-3 border-t">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{folder.folder_actors.count} שחקנים</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  נוצר {new Date(folder.created_at).toLocaleDateString("he-IL")}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredFolders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">לא נמצאו תיקיות התואמות לחיפוש.</p>
          </div>
        )}
      </div>

      <CreateFolderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onFolderCreated={loadFolders} />
    </div>
  )
}
