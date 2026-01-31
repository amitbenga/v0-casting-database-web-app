import { createBrowserClient } from "@/lib/supabase/client"
import type {
  ProjectRoleWithCasting,
  GetProjectRolesResponse,
  AssignActorResponse,
  ApplyParsedScriptResponse,
  CastingConflictError,
  RoleCasting,
  CastingStatus,
  ActorBasic,
} from "./types"

// ===================================
// API Configuration
// ===================================

const USE_MOCKS = true // Toggle this when backend is ready

// ===================================
// Mock Data
// ===================================

const MOCK_ACTORS: ActorBasic[] = [
  { id: "a1", name: "יוסי כהן", image_url: "/placeholder-user.jpg", voice_sample_url: "" },
  { id: "a2", name: "דנה לוי", image_url: "/placeholder-user.jpg", voice_sample_url: "" },
  { id: "a3", name: "משה ישראלי", image_url: "/placeholder-user.jpg", voice_sample_url: "" },
  { id: "a4", name: "רונית שמש", image_url: "/placeholder-user.jpg", voice_sample_url: "" },
]

const generateMockRoles = (projectId: string): ProjectRoleWithCasting[] => {
  return [
    {
      id: "role-1",
      project_id: projectId,
      role_name: "PADDINGTON",
      parent_role_id: null,
      replicas_count: 300,
      created_at: new Date().toISOString(),
      casting: null,
      children: [
        {
          id: "role-1a",
          project_id: projectId,
          role_name: "PADDINGTON - צעיר",
          parent_role_id: "role-1",
          replicas_count: 120,
          created_at: new Date().toISOString(),
          casting: {
            id: "c1",
            role_id: "role-1a",
            actor: MOCK_ACTORS[0],
            status: "מלוהק",
            replicas_planned: 120,
            replicas_final: null,
            notes: "",
            created_at: new Date().toISOString(),
          },
        },
        {
          id: "role-1b",
          project_id: projectId,
          role_name: "PADDINGTON - מבוגר",
          parent_role_id: "role-1",
          replicas_count: 180,
          created_at: new Date().toISOString(),
          casting: null,
        },
      ],
    },
    {
      id: "role-2",
      project_id: projectId,
      role_name: "MR. BROWN",
      parent_role_id: null,
      replicas_count: 150,
      created_at: new Date().toISOString(),
      casting: {
        id: "c2",
        role_id: "role-2",
        actor: MOCK_ACTORS[1],
        status: "בליהוק",
        replicas_planned: 150,
        replicas_final: null,
        notes: "בודקים אלטרנטיבות",
        created_at: new Date().toISOString(),
      },
    },
    {
      id: "role-3",
      project_id: projectId,
      role_name: "MRS. BROWN",
      parent_role_id: null,
      replicas_count: 120,
      created_at: new Date().toISOString(),
      casting: null,
    },
    {
      id: "role-4",
      project_id: projectId,
      role_name: "JUDY",
      parent_role_id: null,
      replicas_count: 80,
      created_at: new Date().toISOString(),
      casting: {
        id: "c3",
        role_id: "role-4",
        actor: MOCK_ACTORS[2],
        status: "באודישן",
        replicas_planned: 80,
        replicas_final: null,
        notes: "",
        created_at: new Date().toISOString(),
      },
    },
  ]
}

// Track mock castings state (for demo purposes)
let mockCastingsState: Map<string, RoleCasting | null> = new Map()

// ===================================
// API Functions
// ===================================

/**
 * Get all roles for a project with their casting information
 */
export async function getProjectRolesWithCasting(projectId: string): Promise<GetProjectRolesResponse> {
  if (USE_MOCKS) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300))
    
    const roles = generateMockRoles(projectId)
    
    // Apply any mock state changes
    const applyMockState = (role: ProjectRoleWithCasting): ProjectRoleWithCasting => {
      const updatedCasting = mockCastingsState.has(role.id) 
        ? mockCastingsState.get(role.id) 
        : role.casting
      
      return {
        ...role,
        casting: updatedCasting ?? null,
        children: role.children?.map(applyMockState),
      }
    }
    
    return { roles: roles.map(applyMockState) }
  }

  // Real implementation
  const supabase = createBrowserClient()

  const { data: roles, error } = await supabase
    .from("project_roles")
    .select(`
      *,
      role_castings (
        id,
        status,
        replicas_planned,
        replicas_final,
        notes,
        created_at,
        actors (
          id,
          full_name,
          image_url,
          voice_sample_url
        )
      )
    `)
    .eq("project_id", projectId)
    .order("replicas_count", { ascending: false })

  if (error) throw error

  // Transform to expected format
  const transformedRoles = roles?.map((role: any) => ({
    ...role,
    casting: role.role_castings?.[0]
      ? {
          id: role.role_castings[0].id,
          role_id: role.id,
          actor: {
            id: role.role_castings[0].actors.id,
            name: role.role_castings[0].actors.full_name,
            image_url: role.role_castings[0].actors.image_url,
            voice_sample_url: role.role_castings[0].actors.voice_sample_url,
          },
          status: role.role_castings[0].status,
          replicas_planned: role.role_castings[0].replicas_planned,
          replicas_final: role.role_castings[0].replicas_final,
          notes: role.role_castings[0].notes,
          created_at: role.role_castings[0].created_at,
        }
      : null,
  })) || []

  // Build hierarchy
  const rootRoles = transformedRoles.filter((r: any) => !r.parent_role_id)
  const childRolesMap = transformedRoles.reduce((acc: any, role: any) => {
    if (role.parent_role_id) {
      if (!acc[role.parent_role_id]) acc[role.parent_role_id] = []
      acc[role.parent_role_id].push(role)
    }
    return acc
  }, {})

  const rolesWithChildren = rootRoles.map((role: any) => ({
    ...role,
    children: childRolesMap[role.id] || [],
  }))

  return { roles: rolesWithChildren }
}

/**
 * Assign an actor to a role
 */
export async function assignActorToRole(
  roleId: string,
  actorId: string
): Promise<AssignActorResponse | CastingConflictError> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Simulate conflict for demo (e.g., if actor a1 tries to take role-3)
    if (actorId === "a1" && roleId === "role-3") {
      return {
        code: "CASTING_CONFLICT",
        message_he: "אי אפשר לשבץ את השחקן לתפקיד הזה כי הוא כבר משויך לתפקיד מתנגש",
      }
    }

    const actor = MOCK_ACTORS.find((a) => a.id === actorId) || {
      id: actorId,
      name: "שחקן חדש",
      image_url: "/placeholder-user.jpg",
    }

    const newCasting: RoleCasting = {
      id: `casting-${Date.now()}`,
      role_id: roleId,
      actor,
      status: "באודישן",
      replicas_planned: undefined,
      replicas_final: undefined,
      notes: "",
      created_at: new Date().toISOString(),
    }

    mockCastingsState.set(roleId, newCasting)

    return { success: true, casting: newCasting }
  }

  // Real implementation
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from("role_castings")
    .insert({
      role_id: roleId,
      actor_id: actorId,
      status: "באודישן",
    })
    .select(`
      *,
      actors (
        id,
        full_name,
        image_url,
        voice_sample_url
      )
    `)
    .single()

  if (error) {
    // Check if it's a conflict error
    if (error.code === "23505" || error.message.includes("conflict")) {
      return {
        code: "CASTING_CONFLICT",
        message_he: "אי אפשר לשבץ את השחקן לתפקיד הזה כי הוא כבר משויך לתפקיד מתנגש",
      }
    }
    throw error
  }

  return {
    success: true,
    casting: {
      id: data.id,
      role_id: data.role_id,
      actor: {
        id: data.actors.id,
        name: data.actors.full_name,
        image_url: data.actors.image_url,
        voice_sample_url: data.actors.voice_sample_url,
      },
      status: data.status,
      replicas_planned: data.replicas_planned,
      replicas_final: data.replicas_final,
      notes: data.notes,
      created_at: data.created_at,
    },
  }
}

/**
 * Unassign an actor from a role
 */
export async function unassignActorFromRole(roleId: string): Promise<{ ok: true }> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    mockCastingsState.set(roleId, null)
    return { ok: true }
  }

  const supabase = createBrowserClient()

  const { error } = await supabase.from("role_castings").delete().eq("role_id", roleId)

  if (error) throw error

  return { ok: true }
}

/**
 * Update casting details (status, notes, replicas)
 */
export async function updateRoleCasting(
  roleId: string,
  updates: Partial<Pick<RoleCasting, "status" | "notes" | "replicas_planned" | "replicas_final">>
): Promise<{ ok: true; casting: RoleCasting }> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    
    const current = mockCastingsState.get(roleId)
    if (current) {
      const updated = { ...current, ...updates }
      mockCastingsState.set(roleId, updated)
      return { ok: true, casting: updated }
    }
    throw new Error("Casting not found")
  }

  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from("role_castings")
    .update(updates)
    .eq("role_id", roleId)
    .select(`
      *,
      actors (
        id,
        full_name,
        image_url,
        voice_sample_url
      )
    `)
    .single()

  if (error) throw error

  return {
    ok: true,
    casting: {
      id: data.id,
      role_id: data.role_id,
      actor: {
        id: data.actors.id,
        name: data.actors.full_name,
        image_url: data.actors.image_url,
        voice_sample_url: data.actors.voice_sample_url,
      },
      status: data.status,
      replicas_planned: data.replicas_planned,
      replicas_final: data.replicas_final,
      notes: data.notes,
      created_at: data.created_at,
    },
  }
}

/**
 * Apply parsed script to project - creates roles and conflicts
 */
export async function applyParsedScript(scriptId: string): Promise<ApplyParsedScriptResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      success: true,
      roles_created: 12,
      conflicts_created: 3,
    }
  }

  const supabase = createBrowserClient()

  // Call edge function or stored procedure
  const { data, error } = await supabase.rpc("apply_parsed_script", {
    script_id: scriptId,
  })

  if (error) throw error

  return data
}

/**
 * Search actors for autocomplete
 */
export async function searchActors(query: string): Promise<ActorBasic[]> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    
    if (!query) return MOCK_ACTORS
    
    const lowerQuery = query.toLowerCase()
    return MOCK_ACTORS.filter(
      (a) => a.name.toLowerCase().includes(lowerQuery) || a.id.includes(lowerQuery)
    )
  }

  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from("actors")
    .select("id, full_name, image_url, voice_sample_url")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(10)

  if (error) throw error

  return (
    data?.map((actor) => ({
      id: actor.id,
      name: actor.full_name,
      image_url: actor.image_url,
      voice_sample_url: actor.voice_sample_url,
    })) || []
  )
}

/**
 * Get all castings for a project (for "All Actors" tab)
 */
export async function getProjectCastings(projectId: string): Promise<
  Array<{
    actor: ActorBasic
    roles: Array<{
      role_id: string
      role_name: string
      status: CastingStatus
      replicas_planned?: number
      replicas_final?: number
    }>
  }>
> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    
    // Group by actor from mock data
    const roles = generateMockRoles(projectId)
    const actorMap = new Map<
      string,
      {
        actor: ActorBasic
        roles: Array<{
          role_id: string
          role_name: string
          status: CastingStatus
          replicas_planned?: number
          replicas_final?: number
        }>
      }
    >()

    const processRole = (role: ProjectRoleWithCasting) => {
      if (role.casting) {
        const actorId = role.casting.actor.id
        if (!actorMap.has(actorId)) {
          actorMap.set(actorId, { actor: role.casting.actor, roles: [] })
        }
        actorMap.get(actorId)!.roles.push({
          role_id: role.id,
          role_name: role.role_name,
          status: role.casting.status,
          replicas_planned: role.casting.replicas_planned,
          replicas_final: role.casting.replicas_final,
        })
      }
      role.children?.forEach(processRole)
    }

    roles.forEach(processRole)

    return Array.from(actorMap.values())
  }

  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from("role_castings")
    .select(`
      *,
      project_roles!inner (
        id,
        role_name,
        project_id
      ),
      actors (
        id,
        full_name,
        image_url,
        voice_sample_url
      )
    `)
    .eq("project_roles.project_id", projectId)

  if (error) throw error

  // Group by actor
  const actorMap = new Map<string, any>()

  data?.forEach((casting: any) => {
    const actorId = casting.actors.id
    if (!actorMap.has(actorId)) {
      actorMap.set(actorId, {
        actor: {
          id: casting.actors.id,
          name: casting.actors.full_name,
          image_url: casting.actors.image_url,
          voice_sample_url: casting.actors.voice_sample_url,
        },
        roles: [],
      })
    }
    actorMap.get(actorId).roles.push({
      role_id: casting.project_roles.id,
      role_name: casting.project_roles.role_name,
      status: casting.status,
      replicas_planned: casting.replicas_planned,
      replicas_final: casting.replicas_final,
    })
  })

  return Array.from(actorMap.values())
}

// ===================================
// Export API Object
// ===================================

export const projectApi = {
  // Projects
  getProject,
  deleteProject,
  
  // Roles
  getRoles,
  createRole,
  deleteRole,
  
  // Castings
  getCastings,
  assignActor,
  updateCastingStatus,
  removeCasting,
  
  // Scripts
  getScripts,
  getExtractedRoles,
  applyExtractedRoles,
  
  // Actors
  searchActors,
  getProjectActors,
}
