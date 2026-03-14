"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { 
  ProjectRoleWithCasting, 
  CastingActionResult,
  CastingStatus,
  RoleConflict 
} from "@/lib/types"
import { backfillScriptLinesRoleIds } from "@/lib/actions/script-line-role-linking"

function normalizeRoleKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

/**
 * Applies a parsed script to the project.
 * Maps raw extracted roles to project_roles and warnings to role_conflicts.
 */
export async function applyParsedScript(projectId: string, scriptId: string): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    // 1. Get raw extracted roles
    const { data: rawRoles, error: rolesError } = await supabase
      .from("script_extracted_roles")
      .select("role_name, replicas_count")
      .eq("script_id", scriptId)

    if (rolesError) throw rolesError

    const existingRolesByNormalizedName = new Map<string, string>()

    // 2. Load existing roles once and then upsert to project_roles
    if ((rawRoles || []).length > 0) {
      const { data: existingRoles, error: existingRolesError } = await supabase
        .from("project_roles")
        .select("id, role_name, role_name_normalized")
        .eq("project_id", projectId)

      if (existingRolesError) throw existingRolesError
      for (const existingRole of existingRoles || []) {
        const normalizedExisting = normalizeRoleKey(existingRole.role_name_normalized || existingRole.role_name)
        if (normalizedExisting) {
          existingRolesByNormalizedName.set(normalizedExisting, existingRole.id)
        }
      }
    }

    for (const rawRole of rawRoles || []) {
      const normalizedName = normalizeRoleKey(rawRole.role_name)
      if (!normalizedName) continue

      const existingRoleId = existingRolesByNormalizedName.get(normalizedName)
      if (existingRoleId) {
        // Update existing role - replicas_count is primary, keep replicas_needed in sync
        const { error: updateRoleError } = await supabase
          .from("project_roles")
          .update({
            role_name_normalized: normalizedName,
            replicas_count: rawRole.replicas_count ?? 0,
            replicas_needed: rawRole.replicas_count ?? 0,
            source: "script"
          })
          .eq("id", existingRoleId)

        if (updateRoleError) throw updateRoleError
      } else {
        // Create new role - replicas_count is primary, keep replicas_needed in sync
        const { data: createdRole, error: createRoleError } = await supabase
          .from("project_roles")
          .insert({
            project_id: projectId,
            role_name: rawRole.role_name.trim(),
            role_name_normalized: normalizedName,
            replicas_count: rawRole.replicas_count ?? 0,
            replicas_needed: rawRole.replicas_count ?? 0,
            source: "script"
          })
          .select("id")
          .single()

        if (createRoleError) throw createRoleError
        if (createdRole) {
          existingRolesByNormalizedName.set(normalizedName, createdRole.id)
        }
      }
    }

    // 3. Map warnings to role_conflicts
    const { data: rawWarnings, error: warningsError } = await supabase
      .from("script_casting_warnings")
      .select("role_1_name, role_2_name, warning_type, scene_reference")
      .eq("project_id", projectId)

    if (warningsError) throw warningsError

    // Get all roles for this project to map normalized names to IDs
    const { data: projectRoles } = await supabase
      .from("project_roles")
      .select("id, role_name, role_name_normalized")
      .eq("project_id", projectId)

    const roleMap = new Map<string, string>()
    for (const role of projectRoles || []) {
      const normalized = normalizeRoleKey(role.role_name_normalized || role.role_name)
      if (!normalized || roleMap.has(normalized)) continue
      roleMap.set(normalized, role.id)
    }

    const warningUpserts: {
      project_id: string
      role_id_a: string
      role_id_b: string
      warning_type: string
      scene_reference: string | null
    }[] = []

    for (const warning of rawWarnings || []) {
      const roleIdA = roleMap.get(normalizeRoleKey(warning.role_1_name))
      const roleIdB = roleMap.get(normalizeRoleKey(warning.role_2_name))

      if (roleIdA && roleIdB) {
        // Ensure roleIdA < roleIdB
        const [id1, id2] = roleIdA < roleIdB ? [roleIdA, roleIdB] : [roleIdB, roleIdA]

        warningUpserts.push({
          project_id: projectId,
          role_id_a: id1,
          role_id_b: id2,
          warning_type: warning.warning_type,
          scene_reference: warning.scene_reference ?? null,
        })
      }
    }

    if (warningUpserts.length > 0) {
      const dedupedWarnings = new Map<string, (typeof warningUpserts)[number]>()
      for (const warning of warningUpserts) {
        dedupedWarnings.set(`${warning.role_id_a}:${warning.role_id_b}`, warning)
      }

      const { error: warningsUpsertError } = await supabase
        .from("role_conflicts")
        .upsert(Array.from(dedupedWarnings.values()), {
          onConflict: "project_id, role_id_a, role_id_b",
        })

      if (warningsUpsertError) throw warningsUpsertError
    }

    // 4. Link script_lines rows to stable role IDs for progress + assignment sync
    await backfillScriptLinesRoleIds(projectId)

    // 5. Mark script as applied
    const { error: applyMarkError } = await supabase
      .from("project_scripts")
      .update({
        applied_at: new Date().toISOString()
      })
      .eq("id", scriptId)

    if (applyMarkError) throw applyMarkError

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error applying script:", error)
    return { success: false, error: error.message || "שגיאה בהחלת התסריט" }
  }
}

/**
 * Assigns an actor to a role, checking for conflicts.
 */
export async function assignActorToRole(roleId: string, actorId: string): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    // Get role to find project_id
    const { data: role, error: roleError } = await supabase
      .from("project_roles")
      .select("project_id")
      .eq("id", roleId)
      .single()
    
    if (roleError || !role) throw new Error("Role not found")
    const projectId = role.project_id

    // Fetch role IDs for this project (do not rely on role_castings.project_id)
    const { data: projectRoles, error: projectRolesError } = await supabase
      .from("project_roles")
      .select("id")
      .eq("project_id", projectId)

    if (projectRolesError) throw projectRolesError
    const projectRoleIds = (projectRoles || []).map((projectRole) => projectRole.id)
    if (projectRoleIds.length === 0) {
      return { success: false, error: "לא נמצאו תפקידים בפרויקט" }
    }

    // 1. Check for conflicts
    // Get all roles this actor is already assigned to in this project
    const { data: currentAssignments, error: currentAssignmentsError } = await supabase
      .from("role_castings")
      .select("role_id")
      .eq("actor_id", actorId)
      .in("role_id", projectRoleIds)

    if (currentAssignmentsError) throw currentAssignmentsError

    if (currentAssignments && currentAssignments.length > 0) {
      const assignedRoleIds = currentAssignments.map(a => a.role_id)

      // Check if any of these roles conflict with the new roleId
      const { data: conflicts } = await supabase
        .from("role_conflicts")
        .select("*")
        .or(`and(role_id_a.eq.${roleId},role_id_b.in.(${assignedRoleIds.join(',')})),and(role_id_b.eq.${roleId},role_id_a.in.(${assignedRoleIds.join(',')}))`)

      if (conflicts && conflicts.length > 0) {
        // Find the name of the conflicting role for a better error message
        const conflictingId = conflicts[0].role_id_a === roleId ? conflicts[0].role_id_b : conflicts[0].role_id_a
        const { data: conflictingRole } = await supabase
          .from("project_roles")
          .select("role_name")
          .eq("id", conflictingId)
          .single()

        return { 
          success: false, 
          error: `השחקן כבר משובץ לתפקיד "${conflictingRole?.role_name}" שמתנגש עם תפקיד זה.`,
          message_he: `השחקן כבר משובץ לתפקיד "${conflictingRole?.role_name}" שמתנגש עם תפקיד זה.`
        }
      }
    }

    // 2. Determine default status — only one actor should remain "מלוהק" by default
    const { data: existingCasted, error: existingCastedError } = await supabase
      .from("role_castings")
      .select("id, actor_id")
      .eq("role_id", roleId)
      .eq("status", "מלוהק")
      .neq("actor_id", actorId)

    if (existingCastedError) throw existingCastedError
    const defaultStatus = existingCasted && existingCasted.length > 0 ? "באודישן" : "מלוהק"

    // 3. Perform upsert
    const { error } = await supabase
      .from("role_castings")
      .upsert({
        role_id: roleId,
        actor_id: actorId,
        status: defaultStatus,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "role_id,actor_id"
      })

    if (error) throw error

    // Keep script line assignments synced to stable role identity
    const { error: scriptLineAssignError } = await supabase
      .from("script_lines")
      .update({ actor_id: actorId })
      .eq("project_id", projectId)
      .eq("role_id", roleId)

    if (scriptLineAssignError) throw scriptLineAssignError

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error assigning actor:", error)
    return { success: false, error: error.message || "שגיאה בשיבוץ שחקן" }
  }
}

/**
 * Unassigns the actor from a role.
 * Provide actorId to unassign a specific actor (required when multiple actors share a role).
 * If the casting was "מלוהק", also clears script_lines assignments for that role.
 */
export async function unassignActorFromRole(roleId: string, actorId: string): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { data: role } = await supabase
      .from("project_roles")
      .select("project_id")
      .eq("id", roleId)
      .single()

    // Fetch casting to check if it was "מלוהק" before deleting
    const { data: casting } = await supabase
      .from("role_castings")
      .select("status")
      .eq("role_id", roleId)
      .eq("actor_id", actorId)
      .maybeSingle()

    if (!casting) {
      return { success: true }
    }

    const { error } = await supabase
      .from("role_castings")
      .delete()
      .eq("role_id", roleId)
      .eq("actor_id", actorId)

    if (error) throw error

    // If actor was "מלוהק", clear their script_lines assignments
    if (role && casting.status === "מלוהק") {
      const { error: clearLinesError } = await supabase
        .from("script_lines")
        .update({ actor_id: null })
        .eq("project_id", role.project_id)
        .eq("role_id", roleId)
        .eq("actor_id", actorId)
      if (clearLinesError) throw clearLinesError
    }

    if (role) revalidatePath(`/projects/${role.project_id}`)
    return { success: true }
  } catch (error: unknown) {
    console.error("Error unassigning actor:", error)
    return { success: false, error: error instanceof Error ? error.message : "שגיאה בהסרת שיבוץ" }
  }
}

/**
 * Updates casting status for a role.
 * Side-effect: when status becomes "מלוהק", auto-assigns all script_lines for
 * that role to this actor. When status moves away from "מלוהק", clears those
 * assignments. Enforces max one "מלוהק" actor per role.
 */
export async function updateCastingStatus(roleId: string, actorId: string, status: CastingStatus): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    // Fetch current casting row for this role + actor
    const { data: casting, error: castingFetchErr } = await supabase
      .from("role_castings")
      .select("id, status")
      .eq("role_id", roleId)
      .eq("actor_id", actorId)
      .maybeSingle()

    if (castingFetchErr) throw castingFetchErr
    if (!casting) throw new Error("לא נמצא שיבוץ")

    const { data: role, error: roleFetchErr } = await supabase
      .from("project_roles")
      .select("project_id")
      .eq("id", roleId)
      .single()

    if (roleFetchErr || !role) throw new Error("לא נמצא תפקיד")

    // Guard: only one "מלוהק" per role
    if (status === "מלוהק") {
      const { data: existingCasted, error: existingCastedError } = await supabase
        .from("role_castings")
        .select("id, actor_id")
        .eq("role_id", roleId)
        .eq("status", "מלוהק")
        .neq("actor_id", actorId)

      if (existingCastedError) throw existingCastedError
      if (existingCasted && existingCasted.length > 0) {
        return {
          success: false,
          error: "לתפקיד הזה כבר יש שחקן מלוהק. בטל קודם את השיבוץ הקיים.",
        }
      }
    }

    // Update the casting status (use casting.id to target this specific casting record)
    const { error } = await supabase
      .from("role_castings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", casting.id)

    if (error) throw error

    // Sync script_lines assignments
    if (status === "מלוהק") {
      // Assign all script_lines for this role to this actor
      const { error: assignLinesError } = await supabase
        .from("script_lines")
        .update({ actor_id: actorId })
        .eq("project_id", role.project_id)
        .eq("role_id", roleId)
      if (assignLinesError) throw assignLinesError
    } else if (casting.status === "מלוהק") {
      // Moving away from "מלוהק" — clear this actor's assignments for the role
      const { error: clearLinesError } = await supabase
        .from("script_lines")
        .update({ actor_id: null })
        .eq("project_id", role.project_id)
        .eq("role_id", roleId)
        .eq("actor_id", actorId)
      if (clearLinesError) throw clearLinesError
    }

    // No revalidatePath — status changes are handled optimistically client-side;
    // structural revalidation happens only on assign/delete
    return { success: true }
  } catch (error: unknown) {
    console.error("Error updating status:", error)
    return { success: false, error: error instanceof Error ? error.message : "שגיאה בעדכון סטטוס" }
  }
}

/**
 * Updates casting details.
 */
export async function updateCastingDetails(
  roleId: string,
  actorId: string,
  details: { notes?: string, replicas_planned?: number, replicas_final?: number }
): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("role_castings")
      .update({
        ...details,
        updated_at: new Date().toISOString()
      })
      .eq("role_id", roleId)
      .eq("actor_id", actorId)

    if (error) throw error

    // No revalidatePath — detail edits don't change structure; client updates optimistically
    return { success: true }
  } catch (error: any) {
    console.error("Error updating details:", error)
    return { success: false, error: error.message || "שגיאה בעדכון פרטים" }
  }
}

/**
 * Deletes a role. First removes related castings and conflicts to avoid FK violations.
 */
export async function deleteRole(roleId: string): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { data: role, error: roleError } = await supabase.from("project_roles").select("project_id").eq("id", roleId).single()
    if (roleError || !role) throw new Error("תפקיד לא נמצא")

    // 1. Delete related castings first
    const { error: deleteCastingsError } = await supabase
      .from("role_castings")
      .delete()
      .eq("role_id", roleId)
    if (deleteCastingsError) throw deleteCastingsError

    // 2. Delete related conflicts
    const { error: deleteConflictsError } = await supabase
      .from("role_conflicts")
      .delete()
      .or(`role_id_a.eq.${roleId},role_id_b.eq.${roleId}`)
    if (deleteConflictsError) throw deleteConflictsError

    // 3. Delete child roles (if this is a parent)
    const { data: children } = await supabase
      .from("project_roles")
      .select("id")
      .eq("parent_role_id", roleId)

    if (children && children.length > 0) {
      const childRoleIds = children.map((child) => child.id)

      const { error: deleteChildCastingsError } = await supabase
        .from("role_castings")
        .delete()
        .in("role_id", childRoleIds)
      if (deleteChildCastingsError) throw deleteChildCastingsError

      const [{ error: deleteChildConflictsAError }, { error: deleteChildConflictsBError }] = await Promise.all([
        supabase.from("role_conflicts").delete().in("role_id_a", childRoleIds),
        supabase.from("role_conflicts").delete().in("role_id_b", childRoleIds),
      ])
      if (deleteChildConflictsAError) throw deleteChildConflictsAError
      if (deleteChildConflictsBError) throw deleteChildConflictsBError

      const { error: deleteChildRolesError } = await supabase
        .from("project_roles")
        .delete()
        .in("id", childRoleIds)
      if (deleteChildRolesError) throw deleteChildRolesError
    }

    // 4. Delete the role itself
    const { error } = await supabase
      .from("project_roles")
      .delete()
      .eq("id", roleId)

    if (error) throw error

    if (role) revalidatePath(`/projects/${role.project_id}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting role:", error)
    return { success: false, error: error.message || "שגיאה במחיקת תפקיד" }
  }
}

/**
 * Gets project roles with their casting information.
 */
export async function getProjectRolesWithCasting(
  projectId: string
): Promise<{ success: boolean; roles: ProjectRoleWithCasting[]; conflicts: RoleConflict[]; error?: string }> {
  const supabase = await createClient()

  try {
    // Fetch roles + conflicts in parallel — saves one round-trip
    const [rolesResult, conflictsResult] = await Promise.all([
      supabase
        .from("project_roles")
        .select(`
          id, project_id, role_name, role_name_normalized, parent_role_id, description, replicas_count, replicas_needed, source, created_at,
          role_castings (
            id,
            actor_id,
            status,
            notes,
            replicas_planned,
            replicas_final,
            actors (
              id,
              full_name,
              image_url,
              gender,
              voice_sample_url
            )
          )
        `)
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("role_conflicts")
        .select("*")
        .eq("project_id", projectId),
    ])

    if (rolesResult.error) throw rolesResult.error
    if (conflictsResult.error) throw conflictsResult.error

    const roles = rolesResult.data
    const conflicts = conflictsResult.data

    // Map role names for conflict visualization
    const roleIdToName = new Map(roles.map(r => [r.id, r.role_name]));

    // Transform roles to handle children and legacy casting naming
    const transformedRoles = roles.map(role => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const castings = (role.role_castings || []).map((rc: any) => ({
        ...rc,
        actor: rc.actors as any,
        name: rc.actors?.full_name,
      }))
      const casting = castings.length > 0 ? castings[0] : null

      return {
        ...role,
        casting,
        castings,
        // Source of truth: replicas_count is primary, fall back to replicas_needed for legacy data
        replicas_count: role.replicas_count ?? role.replicas_needed ?? 0
      }
    });

    // Enhance conflicts with role names for UI
    const enhancedConflicts = conflicts.map(c => ({
      ...c,
      role_a_name: roleIdToName.get(c.role_id_a),
      role_b_name: roleIdToName.get(c.role_id_b)
    }));

    // Group children under parents
    const parentRoles = transformedRoles.filter(r => !r.parent_role_id);
    const resultRoles = parentRoles.map(parent => ({
      ...parent,
      children: transformedRoles.filter(r => r.parent_role_id === parent.id)
    }));

    return { 
      success: true, 
      roles: resultRoles as ProjectRoleWithCasting[], 
      conflicts: enhancedConflicts as RoleConflict[] 
    }
  } catch (error: any) {
    console.error("Error fetching roles with casting:", error)
    return { success: false, error: error.message || "שגיאה בטעינת תפקידים", roles: [], conflicts: [] }
  }
}

/**
 * Creates a role manually.
 * Uses replicas_count as the primary field (source of truth).
 */
export async function createManualRole(
  projectId: string, 
  roleName: string, 
  description?: string, 
  replicasCount: number = 0
): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("project_roles")
      .insert({
        project_id: projectId,
        role_name: roleName,
        role_name_normalized: roleName.trim().toLowerCase(),
        description,
        replicas_count: replicasCount,
        replicas_needed: replicasCount, // Keep in sync for backward compat
        source: "manual"
      })

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error creating role:", error)
    return { success: false, error: error.message || "שגיאה ביצירת תפקיד" }
  }
}

/**
 * Compute total replicas for a project (sum of replicas_count across all roles).
 */
export async function getProjectTotalReplicas(projectId: string): Promise<number> {
  const supabase = await createClient()
  const { data: roles } = await supabase
    .from("project_roles")
    .select("replicas_count, replicas_needed")
    .eq("project_id", projectId)
  
  if (!roles) return 0
  return roles.reduce((sum, r) => sum + (r.replicas_count ?? r.replicas_needed ?? 0), 0)
}

/**
 * Compute total replicas per actor within a project.
 * Returns array of { actor_id, total_replicas } for UI consumption.
 */
export async function getActorReplicasInProject(
  projectId: string
): Promise<{ actor_id: string; total_replicas: number }[]> {
  const supabase = await createClient()
  
  // Get all roles for this project
  const { data: roles } = await supabase
    .from("project_roles")
    .select("id, replicas_count, replicas_needed")
    .eq("project_id", projectId)
  
  if (!roles || roles.length === 0) return []
  
  const roleIds = roles.map(r => r.id)
  const roleReplicasMap = new Map(roles.map(r => [r.id, r.replicas_count ?? r.replicas_needed ?? 0]))
  
  // Get all castings for these roles
  const { data: castings } = await supabase
    .from("role_castings")
    .select("role_id, actor_id")
    .in("role_id", roleIds)
  
  if (!castings) return []
  
  const actorTotals = new Map<string, number>()
  for (const casting of castings) {
    const replicas = roleReplicasMap.get(casting.role_id) || 0
    const current = actorTotals.get(casting.actor_id) || 0
    actorTotals.set(casting.actor_id, current + replicas)
  }
  
  return Array.from(actorTotals.entries()).map(([actor_id, total_replicas]) => ({ actor_id, total_replicas }))
}

/**
 * Gets unique actors assigned to a project and their roles.
 */
export async function getProjectActorsFromCastings(projectId: string) {
  const supabase = await createClient()

  try {
    // 1. Get all roles for this project
    const { data: roles } = await supabase
      .from("project_roles")
      .select("id, role_name, replicas_count, replicas_needed")
      .eq("project_id", projectId)

    if (!roles || roles.length === 0) return []
    const roleIds = roles.map(r => r.id)

    // 2. Get all castings for these roles
    const { data: castings, error } = await supabase
      .from("role_castings")
      .select(`
        role_id,
        actor_id,
        status,
        replicas_planned,
        replicas_final,
        actors (
          id,
          full_name,
          image_url,
          voice_sample_url
        )
      `)
      .in("role_id", roleIds)

    if (error) throw error
    if (!castings) return []

    // 3. Group by actor - use replicas_count (updated by script import), fallback to replicas_needed
    const actorMap = new Map<string, any>()
    const roleIdToName = new Map(roles.map(r => [r.id, r.role_name]))
    const roleIdToReplicas = new Map(roles.map(r => [r.id, r.replicas_count ?? r.replicas_needed ?? 0]))

    for (const c of castings) {
      const actor = c.actors as any
      if (!actor) continue

      if (!actorMap.has(actor.id)) {
        actorMap.set(actor.id, {
          actor: {
            id: actor.id,
            name: actor.full_name,
            image_url: actor.image_url,
            voice_sample_url: actor.voice_sample_url
          },
          roles: []
        })
      }

      // Use replicas_planned from casting, fallback to replicas_needed from the role definition
      const replicasFromCasting = c.replicas_planned || 0
      const replicasFromRole = roleIdToReplicas.get(c.role_id) || 0

      actorMap.get(actor.id).roles.push({
        role_id: c.role_id,
        role_name: roleIdToName.get(c.role_id),
        status: c.status,
        replicas_planned: replicasFromCasting > 0 ? replicasFromCasting : replicasFromRole,
        replicas_final: c.replicas_final
      })
    }

    return Array.from(actorMap.values())
  } catch (error) {
    console.error("Error in getProjectActorsFromCastings:", error)
    return []
  }
}

/**
 * Searches for actors by name.
 */
export async function searchActors(query: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("actors")
      .select("id, full_name, image_url")
      .ilike("full_name", `%${query}%`)
      .limit(10)

    if (error) throw error

    return (data || []).map(a => ({
      id: a.id,
      name: a.full_name,
      image_url: a.image_url
    }))
  } catch (error) {
    console.error("Error in searchActors:", error)
    return []
  }
}
