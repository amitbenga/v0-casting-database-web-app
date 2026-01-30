"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// Schema for extracted roles from script
const extractedRolesSchema = z.object({
  roles: z.array(
    z.object({
      role_name: z.string().describe("שם הדמות/התפקיד באותיות גדולות באנגלית או בעברית"),
      role_type: z
        .enum(["regular", "combined", "group", "ambiguous"])
        .describe("סוג התפקיד: regular=רגיל, combined=משולב (אותו שחקן לכמה דמויות), group=קבוצתי (כמה שחקנים), ambiguous=לא ברור"),
      replicas_count: z.number().describe("מספר הרפליקות המשוער של התפקיד בתסריט"),
      parent_role_name: z
        .string()
        .nullable()
        .describe("אם זה תפקיד משני, שם התפקיד הראשי שלו. null אם זה תפקיד עצמאי"),
      notes: z.string().nullable().describe("הערות נוספות על התפקיד"),
    })
  ),
  conflicts: z.array(
    z.object({
      role_1_name: z.string().describe("שם התפקיד הראשון"),
      role_2_name: z.string().describe("שם התפקיד השני"),
      scene_reference: z.string().nullable().describe("אזכור הסצנה בה שני התפקידים מופיעים יחד"),
      notes: z.string().nullable().describe("הערות על הקונפליקט"),
    })
  ),
})

export type ExtractedRolesResult = z.infer<typeof extractedRolesSchema>

export interface ProcessScriptResult {
  success: boolean
  data?: ExtractedRolesResult
  error?: string
}

/**
 * Process a script file and extract roles using AI
 */
export async function processScriptWithAI(
  scriptId: string,
  fileContent: string
): Promise<ProcessScriptResult> {
  const supabase = await createClient()

  try {
    // Update status to processing
    await supabase
      .from("project_scripts")
      .update({ processing_status: "processing" })
      .eq("id", scriptId)

    const systemPrompt = `אתה מומחה לניתוח תסריטים לדיבוב ושכפול קולי.
המשימה שלך היא לחלץ את כל התפקידים/דמויות מהתסריט ולזהות קונפליקטים פוטנציאליים.

כללים חשובים:
1. חלץ את כל הדמויות שמדברות בתסריט
2. זהה תפקידים משולבים (כמו "MOM/OLDER SARAH" - אותו שחקן)
3. זהה תפקידים קבוצתיים (כמו "CROWD", "SOLDIERS")
4. ספור את מספר הרפליקות לכל דמות
5. זהה סצנות בהן שתי דמויות מדברות יחד - אלה קונפליקטים (אותו שחקן לא יכול לשחק את שתיהן)
6. שמור על שמות התפקידים בדיוק כפי שהם מופיעים בתסריט

דוגמאות לזיהוי:
- "PADDINGTON" - תפקיד רגיל
- "MRS. BROWN / AUNT LUCY" - תפקיד משולב (אותו שחקן)
- "CHILDREN (GROUP)" - תפקיד קבוצתי
- אם PADDINGTON ו-MR. BROWN מדברים באותה סצנה - זה קונפליקט`

    const { output } = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      output: Output.object({
        schema: extractedRolesSchema,
      }),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `נתח את התסריט הבא וחלץ את כל התפקידים והקונפליקטים:\n\n${fileContent}`,
        },
      ],
      maxOutputTokens: 4000,
    })

    if (!output) {
      throw new Error("No output from AI")
    }

    // Get script to find project_id
    const { data: script, error: scriptError } = await supabase
      .from("project_scripts")
      .select("project_id")
      .eq("id", scriptId)
      .single()

    if (scriptError || !script) {
      throw new Error("Script not found")
    }

    // Save extracted roles to database
    for (const role of output.roles) {
      // Find parent role ID if specified
      let parentRoleId = null
      if (role.parent_role_name) {
        const parentRole = output.roles.find(
          (r) => r.role_name === role.parent_role_name
        )
        if (parentRole) {
          // We'll need to query for it after inserting
        }
      }

      await supabase.from("script_extracted_roles").insert({
        project_id: script.project_id,
        script_id: scriptId,
        role_name: role.role_name,
        role_type: role.role_type,
        replicas_count: role.replicas_count,
        notes: role.notes,
      })
    }

    // Save conflicts
    for (const conflict of output.conflicts) {
      await supabase.from("script_casting_warnings").insert({
        project_id: script.project_id,
        role_1_name: conflict.role_1_name,
        role_2_name: conflict.role_2_name,
        scene_reference: conflict.scene_reference,
        warning_type: "same_scene",
        notes: conflict.notes,
      })
    }

    // Update script status to completed
    await supabase
      .from("project_scripts")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", scriptId)

    return {
      success: true,
      data: output,
    }
  } catch (error) {
    console.error("Error processing script:", error)

    // Update script status to error
    await supabase
      .from("project_scripts")
      .update({
        processing_status: "error",
        processing_error:
          error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", scriptId)

    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בעיבוד התסריט",
    }
  }
}

/**
 * Get file content from URL (for processing)
 */
export async function fetchScriptContent(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    const contentType = response.headers.get("content-type") || ""

    // For text files, return directly
    if (contentType.includes("text")) {
      return await response.text()
    }

    // For PDF, we'd need a PDF parser - for now return a message
    if (contentType.includes("pdf")) {
      return "PDF parsing not yet implemented - please upload a text file"
    }

    // Try to get as text
    return await response.text()
  } catch (error) {
    console.error("Error fetching script content:", error)
    throw error
  }
}

/**
 * Trigger script processing after upload
 */
export async function triggerScriptProcessing(
  scriptId: string
): Promise<ProcessScriptResult> {
  const supabase = await createClient()

  // Get script details
  const { data: script, error } = await supabase
    .from("project_scripts")
    .select("*")
    .eq("id", scriptId)
    .single()

  if (error || !script) {
    return { success: false, error: "התסריט לא נמצא" }
  }

  if (!script.file_url) {
    return { success: false, error: "אין קובץ מצורף לתסריט" }
  }

  // Fetch file content
  try {
    const content = await fetchScriptContent(script.file_url)
    return await processScriptWithAI(scriptId, content)
  } catch (error) {
    return {
      success: false,
      error: "שגיאה בקריאת קובץ התסריט",
    }
  }
}
