export interface RecordingProgressTotals {
  total: number
  recorded: number
  optional: number
  notRecorded: number
  pending: number
  unmatched: number
}

export interface ProjectProgressResponse {
  projectId: string
  totals: RecordingProgressTotals
  percentRecorded: number
}

export interface RoleProgressResponseItem {
  roleId: string | null
  roleName: string
  totals: RecordingProgressTotals
  percentRecorded: number
}

export type RolesProgressResponse = RoleProgressResponseItem[]

export interface ActorProgressResponseItem {
  actorId: string
  actorName: string
  totals: RecordingProgressTotals
  percentRecorded: number
}

export type ActorsProgressResponse = ActorProgressResponseItem[]
