"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

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
    content: "Good fit, let's book him",
    timestamp: "06-23-2025, 3:39 pm (PST)",
  },
]

export function ActorComments({ actorId }: { actorId: string }) {
  const [comments, setComments] = useState<Comment[]>(mockComments)
  const [newComment, setNewComment] = useState("")

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: Date.now().toString(),
      author: "You",
      authorInitials: "YO",
      content: newComment,
      timestamp: new Date().toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }),
    }

    setComments([...comments, comment])
    setNewComment("")
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Comments</h3>

      <div className="space-y-6">
        {/* Add Comment Form */}
        <div className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
              Add Comment
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
                  <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
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
