"use client"

import { Plus, MoreVertical } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Actor {
  id: string
  name: string
  image: string
  status: string
}

interface Role {
  id: string
  name: string
  description: string
  ageRange: string
  gender: string
  requirements: string[]
  actors: Actor[]
}

interface ProjectRoleCardProps {
  role: Role
  onAddActor: () => void
}

export function ProjectRoleCard({ role, onAddActor }: ProjectRoleCardProps) {
  const getActorStatusColor = (status: string) => {
    switch (status) {
      case "shortlisted":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "callback":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "submitted":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "booked":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Role Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{role.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{role.description}</p>

            <div className="flex items-center gap-4 mt-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Age:</span> <span className="font-medium">{role.ageRange}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Gender:</span>{" "}
                <span className="font-medium">{role.gender}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {role.requirements.map((req) => (
                <Badge key={req} variant="outline" className="text-xs">
                  {req}
                </Badge>
              ))}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit Role</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete Role</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actors Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Submitted Actors <span className="text-muted-foreground">({role.actors.length})</span>
            </h4>
            <Button size="sm" variant="outline" onClick={onAddActor}>
              <Plus className="h-4 w-4 mr-2" />
              Add Actor
            </Button>
          </div>

          {role.actors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {role.actors.map((actor) => (
                <Link key={actor.id} href={`/actors/${actor.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      <img
                        src={actor.image || "/placeholder.svg"}
                        alt={actor.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="font-medium text-sm">{actor.name}</p>
                      <Badge variant="outline" className={`text-xs ${getActorStatusColor(actor.status)}`}>
                        {actor.status}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">No actors added to this role yet</p>
              <Button size="sm" variant="link" onClick={onAddActor}>
                Add your first actor
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
