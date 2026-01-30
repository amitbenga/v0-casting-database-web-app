"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Applies a parsed script to the project.
 * Maps raw extracted roles to project_roles and warnings to role_conflicts.
 */
export async function applyParsedScript(projectId: string, scriptId: string) {
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
        .single()

      if (existingRole) {
        // Update existing role
        await supabase
          .from("project_roles")
          .update({
            role_name_normalized: normalizedName,
            replicas_needed: rawRole.replicas_count,
            // We could update more fields here if needed
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
        
        // Update the raw warning with the IDs
        await supabase
          .from("script_casting_warnings")
          .update({ role_id_a: id1, role_id_b: id2 })
          .eq("id", warning.id)
      }
    }

    // 4. Mark script as completed
    await supabase
      .from("project_scripts")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString()
      })
      .eq("id", scriptId)

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error applying script:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Assigns an actor to a role, checking for conflicts.
 */
export async function assignActorToRole(roleId: string, actorId: string, projectId: string) {
  const supabase = await createClient()

  try {
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
        const { data: conflictingRole } = await supabase
          .from("project_roles")
          .select("role_name")
          .eq("id", conflicts[0].role_id_a === roleId ? conflicts[0].role_id_b : conflicts[0].role_id_a)
          .single()

        return { 
          success: false, 
          error: `השחקן כבר משובץ לתפקיד "${conflictingRole?.role_name}" שמתנגש עם תפקיד זה.` 
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
    return { success: false, error: error.message }
  }
}

/**
 * Unassigns an actor from a role.
 */
export async function unassignActorFromRole(roleId: string, projectId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("role_castings")
      .delete()
      .eq("role_id", roleId)

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error unassigning actor:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Gets project roles with their casting information.
 */
export async function getProjectRolesWithCasting(projectId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("project_roles")
      .select(`
        *,
        role_castings (
          actor_id,
          status,
          replicas_planned,
          replicas_final,
          actors (
            full_name,
            image_url
          )
        )
      `)
      .eq("project_id", projectId)
      .order("created_at")

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching roles with casting:", error)
    return { success: false, error: error.message }
  }
}
