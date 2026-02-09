"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Users,
  AlertTriangle,
  Merge,
  Trash2,
  Search,
  ChevronDown,
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Link,
  Unlink,
} from "lucide-react"
import type { ParsedScriptBundle, ExtractedCharacter } from "@/lib/parser"
import { applyUserEdits, convertToDbFormat, type UserEdit } from "@/lib/parser"
import { useToast } from "@/hooks/use-toast"
import { applyParsedRoles, saveScriptRecord } from "@/lib/actions/script-actions"

interface ScriptPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parseResult: ParsedScriptBundle
  projectId: string
  onApplied: () => void
  /** Info about the files that were parsed, for saving the script record */
  fileInfo?: { name: string; type: string; size: number }[]
}

export function ScriptPreviewDialog({
  open,
  onOpenChange,
  parseResult,
  projectId,
  onApplied,
  fileInfo,
}: ScriptPreviewDialogProps) {
  const { toast } = useToast()
  const [editedResult, setEditedResult] = useState(parseResult)
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [showWarnings, setShowWarnings] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let chars = editedResult.parseResult.characters
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      chars = chars.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.normalizedName.toLowerCase().includes(query)
      )
    }
    
    return chars
  }, [editedResult, searchQuery])

  // Group warnings by type
  const warningsByType = useMemo(() => {
    const groups = {
      interaction: editedResult.parseResult.warnings.filter(w => w.type === "interaction"),
      duplicate: editedResult.parseResult.warnings.filter(w => w.type === "possible_duplicate"),
      group: editedResult.parseResult.warnings.filter(w => w.type === "possible_group"),
    }
    return groups
  }, [editedResult])

  // Stats
  const stats = useMemo(() => ({
    totalCharacters: editedResult.parseResult.characters.length,
    totalReplicas: editedResult.parseResult.metadata.totalReplicas,
    groups: editedResult.characterGroups.filter(g => g.members.length > 1).length,
    conflicts: warningsByType.interaction.length,
  }), [editedResult, warningsByType])

  const toggleCharacterSelection = (name: string) => {
    setSelectedCharacters(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedCharacters(new Set(filteredCharacters.map(c => c.normalizedName)))
  }

  const clearSelection = () => {
    setSelectedCharacters(new Set())
  }

  const handleMergeSelected = () => {
    if (selectedCharacters.size < 2) return

    const selected = Array.from(selectedCharacters)
    // Find the character with most replicas to be the primary
    const primary = editedResult.parseResult.characters
      .filter(c => selected.includes(c.normalizedName))
      .sort((a, b) => b.replicaCount - a.replicaCount)[0]

    const edit: UserEdit = {
      type: "merge",
      characters: selected,
      newName: primary.name
    }

    setEditedResult(applyUserEdits(editedResult, [edit]))
    setSelectedCharacters(new Set())

    toast({
      title: "התפקידים אוחדו",
      description: `${selected.length} תפקידים אוחדו ל-"${primary.name}"`,
    })
  }

  const handleDeleteSelected = () => {
    if (selectedCharacters.size === 0) return

    const edits: UserEdit[] = Array.from(selectedCharacters).map(char => ({
      type: "delete",
      character: char
    }))

    setEditedResult(applyUserEdits(editedResult, edits))
    setSelectedCharacters(new Set())

    toast({
      title: "התפקידים נמחקו",
      description: `${edits.length} תפקידים נמחקו`,
    })
  }

  const handleDeleteCharacter = (name: string) => {
    const edit: UserEdit = { type: "delete", character: name }
    setEditedResult(applyUserEdits(editedResult, [edit]))
  }

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const handleApply = async () => {
    setIsApplying(true)

    try {
      const { roles, conflicts } = convertToDbFormat(editedResult)
      
      const result = await applyParsedRoles(projectId, roles, conflicts)

      if (result.success) {
        // Save script record(s) to project_scripts table
        if (fileInfo && fileInfo.length > 0) {
          for (const file of fileInfo) {
            await saveScriptRecord(
              projectId,
              file.name,
              file.type,
              file.size
            )
          }
        }

        toast({
          title: "התפקידים נוספו בהצלחה",
          description: `${result.rolesCreated} תפקידים ו-${result.conflictsCreated} קונפליקטים נוספו לפרויקט`,
        })
        onApplied()
      } else {
        toast({
          title: "שגיאה",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Apply error:", error)
      toast({
        title: "שגיאה בהחלת התפקידים",
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const getCharacterBadges = (char: ExtractedCharacter) => {
    const badges = []
    
    if (char.possibleGroup) {
      badges.push(
        <Badge key="group" variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
          קבוצה
        </Badge>
      )
    }
    
    if (char.parentName) {
      badges.push(
        <Badge key="variant" variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
          וריאנט
        </Badge>
      )
    }
    
    return badges
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            תצוגה מקדימה - תפקידים שזוהו
          </DialogTitle>
          <DialogDescription>
            בדוק את התפקידים שזוהו, מזג או מחק לפי הצורך, ואז אשר להוספה לפרויקט.
          </DialogDescription>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 p-3 bg-muted rounded-lg text-sm">
          <div>
            <span className="text-muted-foreground">תפקידים:</span>{" "}
            <span className="font-semibold">{stats.totalCharacters}</span>
          </div>
          <div>
            <span className="text-muted-foreground">רפליקות:</span>{" "}
            <span className="font-semibold">{stats.totalReplicas.toLocaleString()}</span>
          </div>
          {stats.conflicts > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{stats.conflicts} קונפליקטים</span>
            </div>
          )}
        </div>

        {/* Warnings Section */}
        {showWarnings && (warningsByType.duplicate.length > 0 || warningsByType.group.length > 0) && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">
                    {warningsByType.duplicate.length + warningsByType.group.length} אזהרות
                  </span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                {warningsByType.duplicate.slice(0, 5).map((warning, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Link className="h-3 w-3 text-amber-600" />
                    <span className="text-amber-800 dark:text-amber-200">{warning.message}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        setSelectedCharacters(new Set(warning.characters))
                      }}
                    >
                      בחר לאיחוד
                    </Button>
                  </div>
                ))}
                {warningsByType.duplicate.length > 5 && (
                  <p className="text-xs text-amber-600">
                    +{warningsByType.duplicate.length - 5} אזהרות נוספות
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Search and Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש תפקיד..."
              className="pr-10"
            />
          </div>
          
          {selectedCharacters.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCharacters.size} נבחרו
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMergeSelected}
                      disabled={selectedCharacters.size < 2}
                    >
                      <Merge className="h-4 w-4 ml-1" />
                      אחד
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>אחד את התפקידים הנבחרים לתפקיד אחד</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 ml-1" />
                מחק
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                בטל בחירה
              </Button>
            </div>
          )}
        </div>

        {/* Characters Table */}
        <ScrollArea className="flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedCharacters.size === filteredCharacters.length && filteredCharacters.length > 0}
                    onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                  />
                </TableHead>
                <TableHead className="text-right">שם תפקיד</TableHead>
                <TableHead className="text-right">רפליקות</TableHead>
                <TableHead className="text-right">וריאנטים</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCharacters.map((char) => {
                const isSelected = selectedCharacters.has(char.normalizedName)
                const hasConflict = warningsByType.interaction.some(
                  w => w.characters.includes(char.normalizedName)
                )
                
                return (
                  <TableRow
                    key={char.normalizedName}
                    className={isSelected ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleCharacterSelection(char.normalizedName)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{char.name}</span>
                        {hasConflict && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                תפקיד זה מופיע עם תפקידים אחרים - לא ניתן לשבץ אותם לאותו שחקן
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {char.parentName && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-blue-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                וריאנט של: {char.parentName}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{char.replicaCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {char.variants.length > 1 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline">{char.variants.length}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                {char.variants.join(", ")}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">1</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getCharacterBadges(char)}
                        {getCharacterBadges(char).length === 0 && (
                          <span className="text-muted-foreground text-sm">רגיל</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCharacter(char.normalizedName)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Conflicts Summary */}
        {warningsByType.interaction.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Unlink className="h-4 w-4" />
                  <span>{warningsByType.interaction.length} קונפליקטים (תפקידים שמופיעים יחד)</span>
                </div>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ScrollArea className="h-[150px]">
                <div className="space-y-1 text-sm">
                  {warningsByType.interaction.slice(0, 20).map((warning, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <Unlink className="h-3 w-3 text-muted-foreground" />
                      <span>
                        <strong>{warning.characters[0]}</strong>
                        {" "}ו-{" "}
                        <strong>{warning.characters[1]}</strong>
                      </span>
                    </div>
                  ))}
                  {warningsByType.interaction.length > 20 && (
                    <p className="text-muted-foreground p-2">
                      +{warningsByType.interaction.length - 20} קונפליקטים נוספים
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleApply} disabled={isApplying || stats.totalCharacters === 0}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מחיל...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 ml-2" />
                אשר והוסף {stats.totalCharacters} תפקידים
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
