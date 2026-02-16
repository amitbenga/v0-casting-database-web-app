"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { CastingActionResult } from "@/lib/types"
import type { RoleForDatabase, ConflictForDatabase } from "@/lib/parser"

/**
 * Apply parsed roles to a project
 * Creates project_roles and role_conflicts from the parser output
 */
export async function applyParsedRoles(
  projectId: string,
  roles: RoleForDatabase[],
  conflicts: ConflictForDatabase[]
): Promise<CastingActionResult & { rolesCreated?: number; conflictsCreated?: number }> {
  const supabase = await createClient()

  try {
    // Map to track role names to their created IDs
    const roleNameToId = new Map<string, string>()
    let rolesCreated = 0
    let conflictsCreated = 0

    const uniqueNormalizedRoleNames = Array.from(new Set(roles.map((role) => role.role_name_normalized)))
    const existingRolesByNormalizedName = new Map<string, { id: string }>()

    // Load existing roles in one query to avoid N+1
    if (uniqueNormalizedRoleNames.length > 0) {
      const { data: existingRoles, error: existingRolesError } = await supabase
        .from("project_roles")
        .select("id, role_name_normalized")
        .eq("project_id", projectId)
        .in("role_name_normalized", uniqueNormalizedRoleNames)

      if (existingRolesError) throw existingRolesError

      for (const existingRole of existingRoles || []) {
        existingRolesByNormalizedName.set(existingRole.role_name_normalized, { id: existingRole.id })
      }
    }

    // First pass: update existing roles and create missing roles
    for (const role of roles) {
      const existingRole = existingRolesByNormalizedName.get(role.role_name_normalized)

      if (existingRole) {
        await supabase
          .from("project_roles")
          .update({
            replicas_needed: role.replicas_needed,
            source: "script",
          })
          .eq("id", existingRole.id)

        roleNameToId.set(role.role_name_normalized, existingRole.id)
        continue
      }

      const { data: newRole, error } = await supabase
        .from("project_roles")
        .insert({
          project_id: projectId,
          role_name: role.role_name,
          role_name_normalized: role.role_name_normalized,
          replicas_needed: role.replicas_needed,
          source: "script",
        })
        .select("id")
        .single()

      if (error) {
        console.error("Error creating role:", error)
        continue
      }

      roleNameToId.set(role.role_name_normalized, newRole.id)
      existingRolesByNormalizedName.set(role.role_name_normalized, { id: newRole.id })
      rolesCreated++
    }

    // Second pass: update parent_role_id for variants
    const parentUpdates: PromiseLike<unknown>[] = []
    for (const role of roles) {
      if (role.parent_role_id) {
        const roleId = roleNameToId.get(role.role_name_normalized)
        const parentId = roleNameToId.get(role.parent_role_id.toUpperCase())

        if (roleId && parentId) {
          parentUpdates.push(
            supabase
              .from("project_roles")
              .update({ parent_role_id: parentId })
              .eq("id", roleId)
          )
        }
      }
    }
    if (parentUpdates.length > 0) {
      await Promise.all(parentUpdates)
    }

    // Create conflicts (deduplicated + single existing lookup)
    const candidateConflicts: {
      key: string
      role_id_a: string
      role_id_b: string
      warning_type: string
      scene_reference: string | null
    }[] = []

    for (const conflict of conflicts) {
      const roleIdA = roleNameToId.get(conflict.role_name_a.toUpperCase())
      const roleIdB = roleNameToId.get(conflict.role_name_b.toUpperCase())

      if (!roleIdA || !roleIdB) continue

      // Ensure consistent ordering (smaller ID first)
      const [id1, id2] = roleIdA < roleIdB ? [roleIdA, roleIdB] : [roleIdB, roleIdA]
      const key = `${id1}:${id2}`
      candidateConflicts.push({
        key,
        role_id_a: id1,
        role_id_b: id2,
        warning_type: conflict.warning_type,
        scene_reference: conflict.scene_reference ?? null,
      })
    }

    const uniqueConflictMap = new Map<
      string,
      { role_id_a: string; role_id_b: string; warning_type: string; scene_reference: string | null }
    >()
    for (const conflict of candidateConflicts) {
      if (!uniqueConflictMap.has(conflict.key)) {
        uniqueConflictMap.set(conflict.key, {
          role_id_a: conflict.role_id_a,
          role_id_b: conflict.role_id_b,
          warning_type: conflict.warning_type,
          scene_reference: conflict.scene_reference,
        })
      }
    }

    const uniqueConflicts = Array.from(uniqueConflictMap.values())
    if (uniqueConflicts.length > 0) {
      const roleIdsA = Array.from(new Set(uniqueConflicts.map((c) => c.role_id_a)))
      const roleIdsB = Array.from(new Set(uniqueConflicts.map((c) => c.role_id_b)))

      const { data: existingConflicts, error: existingConflictsError } = await supabase
        .from("role_conflicts")
        .select("role_id_a, role_id_b")
        .eq("project_id", projectId)
        .in("role_id_a", roleIdsA)
        .in("role_id_b", roleIdsB)

      if (existingConflictsError) throw existingConflictsError

      const existingConflictKeys = new Set(
        (existingConflicts || []).map((existingConflict) => `${existingConflict.role_id_a}:${existingConflict.role_id_b}`)
      )

      const conflictsToInsert = uniqueConflicts.filter(
        (conflict) => !existingConflictKeys.has(`${conflict.role_id_a}:${conflict.role_id_b}`)
      )

      if (conflictsToInsert.length > 0) {
        const { error: insertConflictsError } = await supabase.from("role_conflicts").insert(
          conflictsToInsert.map((conflict) => ({
            project_id: projectId,
            role_id_a: conflict.role_id_a,
            role_id_b: conflict.role_id_b,
            warning_type: conflict.warning_type,
            scene_reference: conflict.scene_reference,
          }))
        )

        if (!insertConflictsError) {
          conflictsCreated = conflictsToInsert.length
        }
      }
    }

    revalidatePath(`/projects/${projectId}`)

    return {
      success: true,
      rolesCreated,
      conflictsCreated
    }
  } catch (error: unknown) {
    console.error("Error applying parsed roles:", error)
    const errorMessage = error instanceof Error ? error.message : "שגיאה בהחלת התפקידים"
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Save a script record to the database
 */
export async function saveScriptRecord(
  projectId: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number
): Promise<{ success: boolean; scriptId?: string; error?: string }> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("project_scripts")
      .insert({
        project_id: projectId,
        file_name: fileName,
        file_type: fileType,
        file_size_bytes: fileSizeBytes,
        processing_status: "completed",
        applied_at: new Date().toISOString()
      })
      .select("id")
      .single()

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)

    return { success: true, scriptId: data.id }
  } catch (error: unknown) {
    console.error("Error saving script record:", error)
    const errorMessage = error instanceof Error ? error.message : "שגיאה בשמירת התסריט"
    return { success: false, error: errorMessage }
  }
}

/**
 * Get all roles for a project with their conflicts
 */
export async function getProjectRolesForPreview(projectId: string) {
  const supabase = await createClient()

  try {
    const { data: roles, error: rolesError } = await supabase
      .from("project_roles")
      .select("*")
      .eq("project_id", projectId)
      .order("replicas_needed", { ascending: false })

    if (rolesError) throw rolesError

    const { data: conflicts, error: conflictsError } = await supabase
      .from("role_conflicts")
      .select("*")
      .eq("project_id", projectId)

    if (conflictsError) throw conflictsError

    return { roles: roles || [], conflicts: conflicts || [] }
  } catch (error) {
    console.error("Error getting roles for preview:", error)
    return { roles: [], conflicts: [] }
  }
}

/**
 * Delete multiple roles by ID
 */
export async function deleteRoles(
  projectId: string,
  roleIds: string[]
): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("project_roles")
      .delete()
      .in("id", roleIds)
      .eq("project_id", projectId)

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)

    return { success: true }
  } catch (error: unknown) {
    console.error("Error deleting roles:", error)
    const errorMessage = error instanceof Error ? error.message : "שגיאה במחיקת תפקידים"
    return { success: false, error: errorMessage }
  }
}

/**
 * Merge multiple roles into one
 */
export async function mergeRoles(
  projectId: string,
  roleIds: string[],
  primaryRoleId: string
): Promise<CastingActionResult> {
  const supabase = await createClient()

  try {
    // Get primary role
    const { data: primaryRole, error: primaryError } = await supabase
      .from("project_roles")
      .select("*")
      .eq("id", primaryRoleId)
      .single()

    if (primaryError || !primaryRole) {
      throw new Error("Primary role not found")
    }

    // Get all roles to merge
    const { data: rolesToMerge, error: mergeError } = await supabase
      .from("project_roles")
      .select("*")
      .in("id", roleIds)
      .neq("id", primaryRoleId)

    if (mergeError) throw mergeError

    // Calculate total replicas
    const totalReplicas = (primaryRole.replicas_needed || 0) +
      (rolesToMerge || []).reduce((sum, r) => sum + (r.replicas_needed || 0), 0)

    // Update primary role with combined replicas
    await supabase
      .from("project_roles")
      .update({ replicas_needed: totalReplicas })
      .eq("id", primaryRoleId)

    // Resolve castings for merged roles
    const otherRoleIds = roleIds.filter(id => id !== primaryRoleId)
    if (otherRoleIds.length > 0) {
      const { data: primaryCasting, error: primaryCastingError } = await supabase
        .from("role_castings")
        .select("*")
        .eq("role_id", primaryRoleId)
        .maybeSingle()

      if (primaryCastingError) throw primaryCastingError

      const { data: otherCastings, error: otherCastingsError } = await supabase
        .from("role_castings")
        .select("*")
        .in("role_id", otherRoleIds)

      if (otherCastingsError) throw otherCastingsError

      if (otherCastings && otherCastings.length > 0) {
        if (primaryCasting) {
          return {
            success: false,
            error: "לא ניתן לאחד תפקידים כאשר לתפקיד הראשי כבר משויך שחקן. בטל שיוכים ונסה שוב.",
          }
        }

        const uniqueActorIds = new Set(otherCastings.map((c) => c.actor_id))
        if (uniqueActorIds.size > 1) {
          return {
            success: false,
            error: "לא ניתן לאחד תפקידים עם מספר שחקנים שונים. בצע איחוד ידני של השיבוצים לפני האיחוד.",
          }
        }

        // Move one casting to the primary role and delete the rest.
        const [castingToKeep, ...castingsToDelete] = otherCastings
        const { error: moveCastingError } = await supabase
          .from("role_castings")
          .update({ role_id: primaryRoleId })
          .eq("id", castingToKeep.id)
        if (moveCastingError) throw moveCastingError

        if (castingsToDelete.length > 0) {
          const { error: deleteCastingsError } = await supabase
            .from("role_castings")
            .delete()
            .in("id", castingsToDelete.map((c) => c.id))
          if (deleteCastingsError) throw deleteCastingsError
        }
      }

      // Re-point conflicts from merged roles to primary role (instead of deleting them)
      const [{ error: repointAError }, { error: repointBError }] = await Promise.all([
        supabase
          .from("role_conflicts")
          .update({ role_id_a: primaryRoleId })
          .eq("project_id", projectId)
          .in("role_id_a", otherRoleIds),
        supabase
          .from("role_conflicts")
          .update({ role_id_b: primaryRoleId })
          .eq("project_id", projectId)
          .in("role_id_b", otherRoleIds),
      ])

      if (repointAError) throw repointAError
      if (repointBError) throw repointBError

      // Remove self-conflicts (where role_id_a === role_id_b after re-pointing)
      await supabase
        .from("role_conflicts")
        .delete()
        .eq("project_id", projectId)
        .eq("role_id_a", primaryRoleId)
        .eq("role_id_b", primaryRoleId)

      // Normalize ordering and remove duplicates:
      // Fetch all conflicts involving the primary role
      const { data: primaryConflicts } = await supabase
        .from("role_conflicts")
        .select("*")
        .eq("project_id", projectId)
        .or(`role_id_a.eq.${primaryRoleId},role_id_b.eq.${primaryRoleId}`)

      if (primaryConflicts && primaryConflicts.length > 0) {
        // Normalize: ensure smaller ID is always in role_id_a
        const seen = new Set<string>()
        const toDelete: string[] = []
        const toReorder: { id: string; role_id_a: string; role_id_b: string }[] = []

        for (const c of primaryConflicts) {
          const [normA, normB] = c.role_id_a < c.role_id_b
            ? [c.role_id_a, c.role_id_b]
            : [c.role_id_b, c.role_id_a]
          const key = `${normA}:${normB}`

          if (seen.has(key)) {
            toDelete.push(c.id)
          } else {
            seen.add(key)
            // Update ordering if needed
            if (c.role_id_a !== normA) {
              toReorder.push({ id: c.id, role_id_a: normA, role_id_b: normB })
            }
          }
        }

        if (toReorder.length > 0) {
          const reorderResults = await Promise.all(
            toReorder.map((conflict) =>
              supabase
                .from("role_conflicts")
                .update({ role_id_a: conflict.role_id_a, role_id_b: conflict.role_id_b })
                .eq("id", conflict.id)
            )
          )
          const failedReorder = reorderResults.find((result) => result.error)
          if (failedReorder?.error) throw failedReorder.error
        }

        // Delete duplicate conflicts
        if (toDelete.length > 0) {
          const { error: deleteDuplicatesError } = await supabase
            .from("role_conflicts")
            .delete()
            .in("id", toDelete)
          if (deleteDuplicatesError) throw deleteDuplicatesError
        }
      }

      // Delete merged roles
      const { error: deleteRolesError } = await supabase
        .from("project_roles")
        .delete()
        .in("id", otherRoleIds)
      if (deleteRolesError) throw deleteRolesError
    }

    revalidatePath(`/projects/${projectId}`)

    return { success: true }
  } catch (error: unknown) {
    console.error("Error merging roles:", error)
    const errorMessage = error instanceof Error ? error.message : "שגיאה באיחוד תפקידים"
    return { success: false, error: errorMessage }
  }
}
