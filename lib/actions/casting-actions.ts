"use server"

import { createServerClient } from "@/lib/supabase/server"
import type { 
  ProjectRoleWithCasting, 
  RoleCasting, 
  CastingActionResult,
  CastingStatus,
  RoleConflict 
} from "@/lib/types"

// ===================================
// Get Project Roles with Casting
// ===================================

export async function getProjectRolesWithCasting(
  projectId: string
): Promise<{ roles: ProjectRoleWithCasting[]; conflicts: RoleConflict[] }> {
  const supabase = await createServerClient()

  // Get all roles for the project
  const { data: roles, error: rolesError } = await supabase
    .from("project_roles")
    .select("*")
    .eq("project_id", projectId)
    .order("role_name")

  if (rolesError) {
    console.error("[v0] Error fetching roles:", rolesError)
    return { roles: [], conflicts: [] }
  }

  // Get all castings for these roles
  const roleIds = roles?.map((r) => r.id) || []
  const { data: castings, error: castingsError } = await supabase
    .from("role_castings")
    .select(`
      *,
      actors:actor_id (
        id,
        full_name,
        image_url,
        voice_sample_url
      )
    `)
    .in("role_id", roleIds)

  if (castingsError) {
    console.error("[v0] Error fetching castings:", castingsError)
  }

  // Get role conflicts
  const { data: conflicts, error: conflictsError } = await supabase
    .from("role_conflicts")
    .select("*")
    .eq("project_id", projectId)

  if (conflictsError) {
    console.error("[v0] Error fetching conflicts:", conflictsError)
  }

  // Map castings by role_id
  const castingsByRoleId: Record<string, RoleCasting> = {}
  for (const casting of castings || []) {
    if (casting.actors) {
      castingsByRoleId[casting.role_id] = {
        id: casting.id,
        role_id: casting.role_id,
        actor: {
          id: casting.actors.id,
          name: casting.actors.full_name,
          image_url: casting.actors.image_url,
          voice_sample_url: casting.actors.voice_sample_url,
        },
        status: casting.status || "באודישן",
        replicas_planned: casting.replicas_planned,
        replicas_final: casting.replicas_final,
        notes: casting.notes,
        created_at: casting.created_at,
      }
    }
  }

  // Build roles with casting
  const rolesWithCasting: ProjectRoleWithCasting[] = (roles || []).map((role) => ({
    id: role.id,
    project_id: role.project_id,
    role_name: role.role_name,
    parent_role_id: role.parent_role_id,
    replicas_count: role.replicas_count || role.replicas_needed || 0,
    source: role.source || "manual",
    created_at: role.created_at,
    casting: castingsByRoleId[role.id] || null,
    children: [],
  }))

  // Build hierarchy
  const rootRoles: ProjectRoleWithCasting[] = []
  const roleMap = new Map<string, ProjectRoleWithCasting>()

  for (const role of rolesWithCasting) {
    roleMap.set(role.id, role)
  }

  for (const role of rolesWithCasting) {
    if (role.parent_role_id && roleMap.has(role.parent_role_id)) {
      const parent = roleMap.get(role.parent_role_id)!
      if (!parent.children) parent.children = []
      parent.children.push(role)
    } else {
      rootRoles.push(role)
    }
  }

  return { roles: rootRoles, conflicts: conflicts || [] }
}

// ===================================
// Assign Actor to Role
// ===================================

export async function assignActorToRole(
  roleId: string,
  actorId: string
): Promise<CastingActionResult> {
  const supabase = await createServerClient()

  // Get the role to find project_id
  const { data: role, error: roleError } = await supabase
    .from("project_roles")
    .select("id, project_id, role_name")
    .eq("id", roleId)
    .single()

  if (roleError || !role) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message_he: "התפקיד לא נמצא",
      },
    }
  }

  // Check for conflicts - get all roles this actor is cast in for this project
  const { data: existingCastings } = await supabase
    .from("role_castings")
    .select(`
      role_id,
      project_roles!inner (
        id,
        project_id,
        role_name
      )
    `)
    .eq("actor_id", actorId)
    .eq("project_roles.project_id", role.project_id)

  if (existingCastings && existingCastings.length > 0) {
    // Check if any of these roles conflict with the target role
    const existingRoleIds = existingCastings.map((c) => c.role_id)

    const { data: conflicts } = await supabase
      .from("role_conflicts")
      .select("*")
      .eq("project_id", role.project_id)
      .or(
        `and(role_1_id.eq.${roleId},role_2_id.in.(${existingRoleIds.join(",")})),and(role_2_id.eq.${roleId},role_1_id.in.(${existingRoleIds.join(",")}))`
      )

    if (conflicts && conflicts.length > 0) {
      const conflictingRole = existingCastings.find(
        (c) =>
          conflicts.some(
            (conf) =>
              (conf.role_1_id === roleId && conf.role_2_id === c.role_id) ||
              (conf.role_2_id === roleId && conf.role_1_id === c.role_id)
          )
      )

      return {
        success: false,
        error: {
          code: "CASTING_CONFLICT",
          message_he: `אי אפשר לשבץ את השחקן לתפקיד הזה כי הוא כבר משויך לתפקיד מתנגש (${(conflictingRole as any)?.project_roles?.role_name || "תפקיד אחר"})`,
        },
      }
    }
  }

  // Check if there's already a casting for this role
  const { data: existingCasting } = await supabase
    .from("role_castings")
    .select("id")
    .eq("role_id", roleId)
    .single()

  let result
  if (existingCasting) {
    // Update existing
    result = await supabase
      .from("role_castings")
      .update({
        actor_id: actorId,
        status: "באודישן",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingCasting.id)
      .select(`
        *,
        actors:actor_id (
          id,
          full_name,
          image_url,
          voice_sample_url
        )
      `)
      .single()
  } else {
    // Insert new
    result = await supabase
      .from("role_castings")
      .insert({
        role_id: roleId,
        actor_id: actorId,
        status: "באודישן",
      })
      .select(`
        *,
        actors:actor_id (
          id,
          full_name,
          image_url,
          voice_sample_url
        )
      `)
      .single()
  }

  if (result.error) {
    console.error("[v0] Error assigning actor:", result.error)
    return {
      success: false,
      error: {
        code: "UNKNOWN",
        message_he: "שגיאה בשיבוץ השחקן",
      },
    }
  }

  return {
    success: true,
    data: {
      id: result.data.id,
      role_id: result.data.role_id,
      actor: {
        id: result.data.actors.id,
        name: result.data.actors.full_name,
        image_url: result.data.actors.image_url,
        voice_sample_url: result.data.actors.voice_sample_url,
      },
      status: result.data.status,
      replicas_planned: result.data.replicas_planned,
      replicas_final: result.data.replicas_final,
      notes: result.data.notes,
      created_at: result.data.created_at,
    },
  }
}

// ===================================
// Unassign Actor from Role
// ===================================

export async function unassignActorFromRole(
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("role_castings")
    .delete()
    .eq("role_id", roleId)

  if (error) {
    console.error("[v0] Error unassigning actor:", error)
    return { success: false, error: "שגיאה בהסרת השיבוץ" }
  }

  return { success: true }
}

// ===================================
// Update Casting Status
// ===================================

export async function updateCastingStatus(
  roleId: string,
  status: CastingStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("role_castings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("role_id", roleId)

  if (error) {
    console.error("[v0] Error updating status:", error)
    return { success: false, error: "שגיאה בעדכון הסטטוס" }
  }

  return { success: true }
}

// ===================================
// Update Casting Details
// ===================================

export async function updateCastingDetails(
  roleId: string,
  updates: {
    replicas_planned?: number
    replicas_final?: number
    notes?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("role_castings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("role_id", roleId)

  if (error) {
    console.error("[v0] Error updating casting details:", error)
    return { success: false, error: "שגיאה בעדכון הפרטים" }
  }

  return { success: true }
}

// ===================================
// Apply Parsed Script
// ===================================

export async function applyParsedScript(
  scriptId: string
): Promise<{ success: boolean; rolesCreated: number; conflictsCreated: number; error?: string }> {
  const supabase = await createServerClient()

  // Get the script and its extracted roles
  const { data: script, error: scriptError } = await supabase
    .from("project_scripts")
    .select("id, project_id, processing_status")
    .eq("id", scriptId)
    .single()

  if (scriptError || !script) {
    return { success: false, rolesCreated: 0, conflictsCreated: 0, error: "התסריט לא נמצא" }
  }

  if (script.processing_status !== "completed") {
    return { success: false, rolesCreated: 0, conflictsCreated: 0, error: "התסריט עדיין לא עובד" }
  }

  // Get extracted roles
  const { data: extractedRoles, error: extractedError } = await supabase
    .from("script_extracted_roles")
    .select("*")
    .eq("script_id", scriptId)

  if (extractedError) {
    return { success: false, rolesCreated: 0, conflictsCreated: 0, error: "שגיאה בטעינת התפקידים" }
  }

  // Get existing roles for this project to avoid duplicates
  const { data: existingRoles } = await supabase
    .from("project_roles")
    .select("role_name")
    .eq("project_id", script.project_id)

  const existingRoleNames = new Set(existingRoles?.map((r) => r.role_name.toLowerCase()) || [])

  // Insert new roles
  const newRoles = (extractedRoles || [])
    .filter((r) => !existingRoleNames.has(r.role_name.toLowerCase()))
    .map((r) => ({
      project_id: script.project_id,
      role_name: r.role_name,
      replicas_count: r.replicas_count || 0,
      source: "script",
    }))

  let rolesCreated = 0
  if (newRoles.length > 0) {
    const { data: insertedRoles, error: insertError } = await supabase
      .from("project_roles")
      .insert(newRoles)
      .select()

    if (insertError) {
      console.error("[v0] Error inserting roles:", insertError)
    } else {
      rolesCreated = insertedRoles?.length || 0
    }
  }

  // Get casting warnings and create conflicts
  const { data: warnings } = await supabase
    .from("script_casting_warnings")
    .select("*")
    .eq("project_id", script.project_id)

  let conflictsCreated = 0
  if (warnings && warnings.length > 0) {
    // Get all roles to map names to IDs
    const { data: allRoles } = await supabase
      .from("project_roles")
      .select("id, role_name")
      .eq("project_id", script.project_id)

    const roleNameToId = new Map(allRoles?.map((r) => [r.role_name.toLowerCase(), r.id]) || [])

    const conflicts = warnings
      .map((w) => ({
        project_id: script.project_id,
        role_1_id: roleNameToId.get(w.role_1_name.toLowerCase()),
        role_2_id: roleNameToId.get(w.role_2_name.toLowerCase()),
        role_1_name: w.role_1_name,
        role_2_name: w.role_2_name,
        scene_reference: w.scene_reference,
        notes: w.notes,
      }))
      .filter((c) => c.role_1_id && c.role_2_id)

    if (conflicts.length > 0) {
      const { data: insertedConflicts, error: conflictError } = await supabase
        .from("role_conflicts")
        .insert(conflicts)
        .select()

      if (conflictError) {
        console.error("[v0] Error inserting conflicts:", conflictError)
      } else {
        conflictsCreated = insertedConflicts?.length || 0
      }
    }
  }

  return { success: true, rolesCreated, conflictsCreated }
}

// ===================================
// Search Actors
// ===================================

export async function searchActors(
  query: string
): Promise<{ id: string; name: string; image_url?: string }[]> {
  if (!query || query.length < 2) return []

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("actors")
    .select("id, full_name, image_url")
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

  if (error) {
    console.error("[v0] Error searching actors:", error)
    return []
  }

  return (data || []).map((a) => ({
    id: a.id,
    name: a.full_name,
    image_url: a.image_url,
  }))
}

// ===================================
// Get All Project Actors (from role_castings)
// ===================================

export async function getProjectActorsFromCastings(projectId: string): Promise<
  {
    actor: { id: string; name: string; image_url?: string }
    roles: { role_id: string; role_name: string; status: CastingStatus; replicas_planned?: number }[]
  }[]
> {
  const supabase = await createServerClient()

  const { data: castings, error } = await supabase
    .from("role_castings")
    .select(`
      *,
      actors:actor_id (
        id,
        full_name,
        image_url
      ),
      project_roles!inner (
        id,
        project_id,
        role_name
      )
    `)
    .eq("project_roles.project_id", projectId)

  if (error) {
    console.error("[v0] Error fetching project actors:", error)
    return []
  }

  // Group by actor
  const actorMap = new Map<
    string,
    {
      actor: { id: string; name: string; image_url?: string }
      roles: { role_id: string; role_name: string; status: CastingStatus; replicas_planned?: number }[]
    }
  >()

  for (const casting of castings || []) {
    if (!casting.actors) continue

    const actorId = casting.actors.id
    if (!actorMap.has(actorId)) {
      actorMap.set(actorId, {
        actor: {
          id: casting.actors.id,
          name: casting.actors.full_name,
          image_url: casting.actors.image_url,
        },
        roles: [],
      })
    }

    actorMap.get(actorId)!.roles.push({
      role_id: casting.role_id,
      role_name: (casting.project_roles as any).role_name,
      status: casting.status,
      replicas_planned: casting.replicas_planned,
    })
  }

  return Array.from(actorMap.values())
}

// ===================================
// Create Manual Role
// ===================================

export async function createManualRole(
  projectId: string,
  roleName: string,
  parentRoleId?: string,
  replicasCount?: number
): Promise<{ success: boolean; role?: ProjectRoleWithCasting; error?: string }> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("project_roles")
    .insert({
      project_id: projectId,
      role_name: roleName,
      parent_role_id: parentRoleId || null,
      replicas_count: replicasCount || 0,
      source: "manual",
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating role:", error)
    return { success: false, error: "שגיאה ביצירת התפקיד" }
  }

  return {
    success: true,
    role: {
      ...data,
      casting: null,
      children: [],
    },
  }
}

// ===================================
// Delete Role
// ===================================

export async function deleteRole(
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  // First delete any castings
  await supabase.from("role_castings").delete().eq("role_id", roleId)

  // Then delete the role
  const { error } = await supabase
    .from("project_roles")
    .delete()
    .eq("id", roleId)

  if (error) {
    console.error("[v0] Error deleting role:", error)
    return { success: false, error: "שגיאה במחיקת התפקיד" }
  }

  return { success: true }
}
