"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { 
  ProjectRoleWithCasting, 
  RoleCasting, 
  CastingActionResult,
  CastingStatus,
  RoleConflict 
} from "@/lib/types"

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
      .select("*")
      .eq("script_id", scriptId)

    if (rolesError) throw rolesError

    // 2. Upsert to project_roles
    for (const rawRole of rawRoles || []) {
      const normalizedName = rawRole.role_name.trim().toLowerCase()
      
      // Check if role exists
      const { data: existingRole } = await supabase
        .from("project_roles")
        .select("id")
        .eq("project_id", projectId)
        .eq("role_name", rawRole.role_name)
        .maybeSingle()

      if (existingRole) {
        // Update existing role
        await supabase
          .from("project_roles")
          .update({
            role_name_normalized: normalizedName,
            replicas_needed: rawRole.replicas_count,
            source: "script"
          })
          .eq("id", existingRole.id)
      } else {
        // Create new role
        await supabase
          .from("project_roles")
          .insert({
            project_id: projectId,
            role_name: rawRole.role_name,
            role_name_normalized: normalizedName,
            replicas_needed: rawRole.replicas_count,
            source: "script"
          })
      }
    }

    // 3. Map warnings to role_conflicts
    const { data: rawWarnings, error: warningsError } = await supabase
      .from("script_casting_warnings")
      .select("*")
      .eq("project_id", projectId)

    if (warningsError) throw warningsError

    // Get all roles for this project to map names to IDs
    const { data: projectRoles } = await supabase
      .from("project_roles")
      .select("id, role_name")
      .eq("project_id", projectId)

    const roleMap = new Map(projectRoles?.map(r => [r.role_name, r.id]))

    for (const warning of rawWarnings || []) {
      const roleIdA = roleMap.get(warning.role_1_name)
      const roleIdB = roleMap.get(warning.role_2_name)

      if (roleIdA && roleIdB) {
        // Ensure roleIdA < roleIdB
        const [id1, id2] = roleIdA < roleIdB ? [roleIdA, roleIdB] : [roleIdB, roleIdA]

        await supabase
          .from("role_conflicts")
          .upsert({
            project_id: projectId,
            role_id_a: id1,
            role_id_b: id2,
            warning_type: warning.warning_type,
            scene_reference: warning.scene_reference,
          }, {
            onConflict: "project_id, role_id_a, role_id_b"
          })
      }
    }

    // 4. Mark script as applied
    await supabase
      .from("project_scripts")
      .update({
        applied_at: new Date().toISOString()
      })
      .eq("id", scriptId)

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

    // 1. Check for conflicts
    // Get all roles this actor is already assigned to in this project
    const { data: currentAssignments } = await supabase
      .from("role_castings")
      .select("role_id")
      .eq("project_id", projectId)
      .eq("actor_id", actorId)

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

    // 2. Perform upsert
    const { error } = await supabase
      .from("role_castings")
      .upsert({
        project_id: projectId,
        role_id: roleId,
        actor_id: actorId,
        status: "מלוהק",
        updated_at: new Date().toISOString()
      }, {
        onConflict: "role_id"
      })

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error assigning actor:", error)
    return { success: false, error: error.message || "שגיאה בשיבוץ שחקן" }
  }
}

/**
 * Unassigns an actor from a role.
 */
export async function unassignActorFromRole(roleId: string): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { data: role } = await supabase.from("project_roles").select("project_id").eq("id", roleId).single()
    
    const { error } = await supabase
      .from("role_castings")
      .delete()
      .eq("role_id", roleId)

    if (error) throw error

    if (role) revalidatePath(`/projects/${role.project_id}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error unassigning actor:", error)
    return { success: false, error: error.message || "שגיאה בהסרת שיבוץ" }
  }
}

/**
 * Updates casting status.
 */
export async function updateCastingStatus(roleId: string, status: CastingStatus): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { data: role } = await supabase.from("project_roles").select("project_id").eq("id", roleId).single()
    
    const { error } = await supabase
      .from("role_castings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("role_id", roleId)

    if (error) throw error

    if (role) revalidatePath(`/projects/${role.project_id}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error updating status:", error)
    return { success: false, error: error.message || "שגיאה בעדכון סטטוס" }
  }
}

/**
 * Updates casting details.
 */
export async function updateCastingDetails(
  roleId: string, 
  details: { notes?: string, replicas_planned?: number, replicas_final?: number }
): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { data: role } = await supabase.from("project_roles").select("project_id").eq("id", roleId).single()
    
    const { error } = await supabase
      .from("role_castings")
      .update({ 
        ...details,
        updated_at: new Date().toISOString() 
      })
      .eq("role_id", roleId)

    if (error) throw error

    if (role) revalidatePath(`/projects/${role.project_id}`)
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
    const { data: role } = await supabase.from("project_roles").select("project_id").eq("id", roleId).single()
    
    // 1. Delete related castings first
    await supabase
      .from("role_castings")
      .delete()
      .eq("role_id", roleId)

    // 2. Delete related conflicts
    await supabase
      .from("role_conflicts")
      .delete()
      .or(`role_id_a.eq.${roleId},role_id_b.eq.${roleId}`)

    // 3. Delete child roles (if this is a parent)
    const { data: children } = await supabase
      .from("project_roles")
      .select("id")
      .eq("parent_role_id", roleId)

    if (children && children.length > 0) {
      for (const child of children) {
        await supabase.from("role_castings").delete().eq("role_id", child.id)
        await supabase.from("role_conflicts").delete().or(`role_id_a.eq.${child.id},role_id_b.eq.${child.id}`)
      }
      await supabase.from("project_roles").delete().eq("parent_role_id", roleId)
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
    // Get roles with casting
    const { data: roles, error: rolesError } = await supabase
      .from("project_roles")
      .select(`
        *,
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
      .order("created_at")

    if (rolesError) throw rolesError

    // Get conflicts
    const { data: conflicts, error: conflictsError } = await supabase
      .from("role_conflicts")
      .select("*")
      .eq("project_id", projectId)

    if (conflictsError) throw conflictsError

    // Map role names for conflict visualization
    const roleIdToName = new Map(roles.map(r => [r.id, r.role_name]));

    // Transform roles to handle children and legacy casting naming
    const transformedRoles = roles.map(role => {
      const casting = role.role_castings && role.role_castings.length > 0 ? {
        ...role.role_castings[0],
        actor: role.role_castings[0].actors,
        name: role.role_castings[0].actors?.full_name // for v0 UI
      } : null;
      
      return {
        ...role,
        casting,
        replicas_count: role.replicas_needed || 0
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
 */
export async function createManualRole(
  projectId: string, 
  roleName: string, 
  description?: string, 
  replicasNeeded: number = 0
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
        replicas_needed: replicasNeeded,
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
 * Gets unique actors assigned to a project and their roles.
 */
export async function getProjectActorsFromCastings(projectId: string) {
  const supabase = await createClient()

  try {
    // 1. Get all roles for this project
    const { data: roles } = await supabase
      .from("project_roles")
      .select("id, role_name, replicas_needed")
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

    // 3. Group by actor - use replicas_needed from project_roles as fallback
    const actorMap = new Map<string, any>()
    const roleIdToName = new Map(roles.map(r => [r.id, r.role_name]))
    const roleIdToReplicas = new Map(roles.map(r => [r.id, r.replicas_needed || 0]))

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
