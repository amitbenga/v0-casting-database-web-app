"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Merge report structure saved to actor_submissions.merge_report
 */
export interface MergeReport {
  merged_at: string
  target_actor_id: string
  fields_merged: Record<string, { source: "submission" | "existing"; value: any }>
  fields_skipped: string[]
}

/**
 * Field-by-field merge choices from the UI
 * For each conflicting field, the user chooses "submission" or "existing"
 */
export interface MergeFieldChoices {
  [fieldName: string]: "submission" | "existing"
}

/**
 * Merge a submission into an existing actor
 * - Auto-fills missing fields
 * - For conflicting fields, uses the choices provided by the user
 * - Saves a merge_report to the submission record
 */
export async function mergeSubmissionIntoActor(
  submissionId: string,
  targetActorId: string,
  fieldChoices: MergeFieldChoices
): Promise<{ success: boolean; error?: string; mergeReport?: MergeReport }> {
  try {
    const supabase = await createClient()

    // Fetch the submission
    const { data: submission, error: subError } = await supabase
      .from("actor_submissions")
      .select("*")
      .eq("id", submissionId)
      .single()

    if (subError || !submission) {
      return { success: false, error: "לא נמצאה הגשה" }
    }

    // Fetch the existing actor
    const { data: actor, error: actorError } = await supabase
      .from("actors")
      .select("*")
      .eq("id", targetActorId)
      .single()

    if (actorError || !actor) {
      return { success: false, error: "לא נמצא שחקן" }
    }

    // Map submission fields to actor fields
    const fieldMapping: Record<string, { submissionKey: string; actorKey: string }> = {
      full_name: { submissionKey: "full_name", actorKey: "full_name" },
      gender: { submissionKey: "gender", actorKey: "gender" },
      birth_year: { submissionKey: "birth_year", actorKey: "birth_year" },
      phone: { submissionKey: "phone", actorKey: "phone" },
      email: { submissionKey: "email", actorKey: "email" },
      image_url: { submissionKey: "image_url", actorKey: "image_url" },
      voice_sample_url: { submissionKey: "voice_sample_url", actorKey: "voice_sample_url" },
      singing_sample_url: { submissionKey: "singing_sample_url", actorKey: "singing_sample_url" },
      youtube_link: { submissionKey: "youtube_link", actorKey: "youtube_link" },
      singing_level: { submissionKey: "singing_level", actorKey: "singing_level" },
      is_singer: { submissionKey: "is_singer", actorKey: "is_singer" },
      is_course_graduate: { submissionKey: "is_course_graduate", actorKey: "is_course_grad" },
      vat_status: { submissionKey: "vat_status", actorKey: "vat_status" },
      notes: { submissionKey: "notes", actorKey: "notes" },
    }

    // Array fields that should be merged (union)
    const arrayFields: Record<string, { submissionKey: string; actorKey: string }> = {
      skills: { submissionKey: "skills", actorKey: "skills" },
      languages: { submissionKey: "languages", actorKey: "languages" },
      singing_styles: { submissionKey: "singing_styles", actorKey: "singing_styles" },
    }

    const updateData: Record<string, any> = {}
    const mergeReport: MergeReport = {
      merged_at: new Date().toISOString(),
      target_actor_id: targetActorId,
      fields_merged: {},
      fields_skipped: [],
    }

    // Process scalar fields
    for (const [fieldName, mapping] of Object.entries(fieldMapping)) {
      const submissionValue = submission[mapping.submissionKey]
      const actorValue = actor[mapping.actorKey]

      // Handle gender mapping (submission is in Hebrew, actor is in English)
      let normalizedSubmissionValue = submissionValue
      if (fieldName === "gender" && typeof submissionValue === "string") {
        const g = submissionValue.trim().toLowerCase()
        if (g === "זכר" || g === "male") {
          normalizedSubmissionValue = "male"
        } else if (g === "נקבה" || g === "female") {
          normalizedSubmissionValue = "female"
        } else if (g === "other" || g === "אחר" || g === "אחר/ת") {
          normalizedSubmissionValue = "other"
        } else {
          mergeReport.fields_skipped.push(fieldName)
          continue
        }
      }

      // Skip if submission has no value
      if (normalizedSubmissionValue == null || normalizedSubmissionValue === "") {
        mergeReport.fields_skipped.push(fieldName)
        continue
      }

      // If actor field is empty, auto-fill from submission
      if (actorValue == null || actorValue === "") {
        updateData[mapping.actorKey] = normalizedSubmissionValue
        mergeReport.fields_merged[fieldName] = {
          source: "submission",
          value: normalizedSubmissionValue,
        }
        continue
      }

      // If both have values and they differ, use user's choice
      if (String(normalizedSubmissionValue) !== String(actorValue)) {
        const choice = fieldChoices[fieldName] || "existing"
        if (choice === "submission") {
          updateData[mapping.actorKey] = normalizedSubmissionValue
          mergeReport.fields_merged[fieldName] = {
            source: "submission",
            value: normalizedSubmissionValue,
          }
        } else {
          mergeReport.fields_merged[fieldName] = {
            source: "existing",
            value: actorValue,
          }
        }
      } else {
        mergeReport.fields_skipped.push(fieldName)
      }
    }

    // Process array fields (always union)
    // Submission arrays come as plain Hebrew strings, actor arrays may be {id,key,label} objects
    for (const [fieldName, mapping] of Object.entries(arrayFields)) {
      const submissionArr = Array.isArray(submission[mapping.submissionKey])
        ? submission[mapping.submissionKey]
        : []
      const actorArr = Array.isArray(actor[mapping.actorKey])
        ? actor[mapping.actorKey]
        : []

      if (submissionArr.length === 0) {
        mergeReport.fields_skipped.push(fieldName)
        continue
      }

      // Normalize: extract labels/keys for dedup comparison
      const getKey = (item: any): string =>
        typeof item === "string" ? item : (item.key || item.label || item.style || JSON.stringify(item))

      const existingKeys = new Set(actorArr.map(getKey))
      const newItems = submissionArr.filter((item: any) => !existingKeys.has(getKey(item)))

      if (newItems.length > 0) {
        // Convert new submission strings to objects if actor already has objects
        const actorHasObjects = actorArr.length > 0 && typeof actorArr[0] === "object"
        const convertedNew = (fieldName === "skills" || fieldName === "languages") && !actorHasObjects
          ? submissionArr  // both are strings, keep as-is
          : newItems.map((item: any, i: number) => {
              if (typeof item === "string") {
                return { id: String(actorArr.length + i + 1), key: item, label: item }
              }
              return item
            })

        const merged = [...actorArr, ...convertedNew]
        updateData[mapping.actorKey] = merged
        mergeReport.fields_merged[fieldName] = {
          source: "submission",
          value: merged,
        }
      } else {
        mergeReport.fields_skipped.push(fieldName)
      }
    }

    // Extract additional fields from raw_payload that are not top-level columns on actor_submissions
    if (submission.raw_payload) {
      const rawPayloadFields: Record<string, string> = {
        city: "city",
        dubbing_experience_years: "dubbing_experience_years",
        youtube_link: "youtube_link",
        singing_sample_url: "singing_sample_url",
      }
      for (const [rawKey, actorKey] of Object.entries(rawPayloadFields)) {
        const rawValue = submission.raw_payload[rawKey]
        const actorValue = actor[actorKey]
        if (rawValue != null && rawValue !== "" && (actorValue == null || actorValue === "")) {
          updateData[actorKey] = rawValue
          mergeReport.fields_merged[rawKey] = { source: "submission", value: rawValue }
        }
      }
    }

    // Update the actor if there are changes
    if (Object.keys(updateData).length > 0) {
      const { error: updateActorError } = await supabase
        .from("actors")
        .update(updateData)
        .eq("id", targetActorId)

      if (updateActorError) {
        return { success: false, error: `שגיאה בעדכון שחקן: ${updateActorError.message}` }
      }
    }

    // Update the submission status and merge report
    const { error: updateSubError } = await supabase
      .from("actor_submissions")
      .update({
        review_status: "approved",
        match_status: "merged",
        matched_actor_id: targetActorId,
        merge_report: mergeReport,
      })
      .eq("id", submissionId)

    if (updateSubError) {
      return { success: false, error: `שגיאה בעדכון הגשה: ${updateSubError.message}` }
    }

    return { success: true, mergeReport }
  } catch (error) {
    console.error("Merge error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא ידועה",
    }
  }
}

/**
 * Soft-delete submissions by setting deleted_at timestamp
 */
export async function softDeleteSubmissions(
  submissionIds: string[]
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  try {
    const supabase = await createClient()

    const { error, count } = await supabase
      .from("actor_submissions")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", submissionIds)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, deletedCount: count || submissionIds.length }
  } catch (error) {
    console.error("Soft delete error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא ידועה",
    }
  }
}
