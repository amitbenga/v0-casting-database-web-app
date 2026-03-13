"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { formatDateHe } from "@/lib/format-date"

interface Comment {
  id: string
  author: string
  authorInitials: string
  content: string
  timestamp: string
}

const mockComments: Comment[] = [
  {
    id: "1",
    author: "Michaela S.",
    authorInitials: "MS",
    content: "מתאים, בואו נקבע",
    timestamp: "2025-06-23T15:39:00Z",
  },
]

export function ActorComments({ actorId }: { actorId: string }) {
  const [comments, setComments] = useState<Comment[]>(mockComments)
  const [newComment, setNewComment] = useState("")

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: Date.now().toString(),
      author: "את/ה",
      authorInitials: "ME",
      content: newComment,
      timestamp: new Date().toISOString(),
    }

    setComments([...comments, comment])
    setNewComment("")
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">הערות</h3>

      <div className="space-y-6">
        {/* Add Comment Form */}
        <div className="space-y-3">
          <Textarea
            placeholder="הוסף הערה..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
              הוסף הערה
            </Button>
          </div>
        </div>

        {comments.length > 0 && <Separator />}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{comment.authorInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">{formatDateHe(comment.timestamp)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
