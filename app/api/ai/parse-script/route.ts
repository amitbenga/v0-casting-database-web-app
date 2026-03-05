"use server"
// IMPORTANT: Server-side only — never import from client components.
// Uses Vercel AI Gateway (zero config) via ai package.

import { ToolLoopAgent, tool, stepCountIs } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60 // seconds — parsing large scripts can be slow

// ─────────────────────────────────────────────
// Draft schemas (matches migration 007 draft_json)
// ─────────────────────────────────────────────
const DraftRoleSchema = z.object({
  role_name: z.string(),
  role_name_normalized: z.string(),
  replicas_count: z.number().int().min(0),
  notes: z.string().nullable(),
})

const DraftLineSchema = z.object({
  line_number: z.number().int().min(1),
  role_name: z.string(),
  source_text: z.string(),
  timecode: z.string().nullable(),
})

const DraftWarningSchema = z.object({
  type: z.enum(["ambiguous_name", "low_confidence", "format_issue", "duplicate_role"]),
  message: z.string(),
  line_ref: z.number().nullable(),
})

// ─────────────────────────────────────────────
// POST /api/ai/parse-script
// Body: { importId: string }
// importId must be a row in script_imports with status='pending' and raw_text filled.
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { importId } = await req.json()
    if (!importId) return Response.json({ error: "importId required" }, { status: 400 })

    const supabase = await createClient()

    // 1. Load import record
    const { data: importRow, error: fetchError } = await supabase
      .from("script_imports")
      .select("id, project_id, source_filename, raw_text, status")
      .eq("id", importId)
      .single()

    if (fetchError || !importRow) {
      return Response.json({ error: "Import record not found" }, { status: 404 })
    }
    if (importRow.status !== "pending") {
      return Response.json({ error: `Import already in status: ${importRow.status}` }, { status: 409 })
    }
    if (!importRow.raw_text) {
      return Response.json({ error: "raw_text is empty — nothing to parse" }, { status: 422 })
    }

    // Mark as processing
    await supabase
      .from("script_imports")
      .update({ status: "processing" })
      .eq("id", importId)

    // 2. Load existing project roles for context (helps agent match names)
    const { data: existingRoles } = await supabase
      .from("project_roles")
      .select("role_name, role_name_normalized")
      .eq("project_id", importRow.project_id)
      .limit(100)

    const existingRoleNames = (existingRoles ?? []).map(r => r.role_name).join(", ")

    // 3. Accumulated draft state (tools write into this)
    const draftRoles: z.infer<typeof DraftRoleSchema>[] = []
    const draftLines: z.infer<typeof DraftLineSchema>[] = []
    const draftWarnings: z.infer<typeof DraftWarningSchema>[] = []

    // 4. Build agent
    const agent = new ToolLoopAgent({
      model: "anthropic/claude-opus-4.6",

      instructions: `You are an expert script parser for a Hebrew dubbing studio casting database.

Your job: analyze the raw script text and extract ALL characters (roles) and their dialogue lines.

Project context:
- Filename: ${importRow.source_filename}
- Existing roles in project: ${existingRoleNames || "none yet"}

Rules:
1. A "character" is any name that appears before a colon or on its own line followed by dialogue.
2. Hebrew AND English scripts are supported. Preserve character names exactly as they appear.
3. Stage directions (in parentheses, brackets, or ALL-CAPS action lines) are NOT dialogue — skip them.
4. If a character name appears in multiple forms (e.g. "MOM" and "אמא"), treat them as the same role — use reportAmbiguity.
5. Timecodes (HH:MM:SS:FF format) should be extracted when present.
6. ALWAYS call saveRoles first, then saveLines, then finish. Do not stop without saving.
7. If you encounter an unclear section, call reportWarning — then continue parsing.

Workflow:
1. Read the script
2. Identify all unique character names → saveRoles
3. Extract all dialogue lines with character attribution → saveLines (in batches of 100 if long)
4. Report any ambiguities → reportWarning
5. Done`,

      tools: {
        saveRoles: tool({
          description: "Save the list of identified characters/roles from the script",
          inputSchema: z.object({
            roles: z.array(DraftRoleSchema),
          }),
          execute: async ({ roles }) => {
            draftRoles.push(...roles)
            return { saved: roles.length, total: draftRoles.length }
          },
        }),

        saveLines: tool({
          description: "Save extracted dialogue lines. Call multiple times for long scripts.",
          inputSchema: z.object({
            lines: z.array(DraftLineSchema),
          }),
          execute: async ({ lines }) => {
            draftLines.push(...lines)
            return { saved: lines.length, total: draftLines.length }
          },
        }),

        reportWarning: tool({
          description: "Report an ambiguity or parsing issue without stopping",
          inputSchema: z.object({
            warning: DraftWarningSchema,
          }),
          execute: async ({ warning }) => {
            draftWarnings.push(warning)
            return { noted: true, totalWarnings: draftWarnings.length }
          },
        }),

        lookupExistingRole: tool({
          description: "Check if a character name matches an existing role in the project",
          inputSchema: z.object({
            name: z.string().describe("The character name to look up"),
          }),
          execute: async ({ name }) => {
            const { data } = await supabase
              .from("project_roles")
              .select("id, role_name, role_name_normalized")
              .eq("project_id", importRow.project_id)
              .ilike("role_name", `%${name}%`)
              .limit(5)

            return {
              matches: data ?? [],
              exactMatch: (data ?? []).find(
                r => r.role_name.toLowerCase() === name.toLowerCase()
              ) ?? null,
            }
          },
        }),
      },

      stopWhen: stepCountIs(20),
    })

    // 5. Run agent with the raw script text as the user message
    let tokensUsed = 0
    try {
      const result = await agent.run([
        {
          role: "user",
          content: `Parse this script:\n\n${importRow.raw_text.slice(0, 80000)}`,
        },
      ])
      // Extract token usage if available
      tokensUsed = (result as { usage?: { totalTokens?: number } })?.usage?.totalTokens ?? 0
    } catch (agentError) {
      // Agent failed — save failure
      await supabase
        .from("script_imports")
        .update({
          status: "failed",
          error_message: agentError instanceof Error ? agentError.message : String(agentError),
        })
        .eq("id", importId)
      return Response.json({ error: "Agent failed", detail: String(agentError) }, { status: 500 })
    }

    // 6. Persist draft to script_imports
    const draftJson = {
      roles: draftRoles,
      lines: draftLines,
      warnings: draftWarnings,
    }

    const { error: saveError } = await supabase
      .from("script_imports")
      .update({
        status: "draft_ready",
        draft_json: draftJson,
        model_used: "anthropic/claude-opus-4.6",
        tokens_used: tokensUsed,
      })
      .eq("id", importId)

    if (saveError) throw saveError

    return Response.json({
      success: true,
      importId,
      summary: {
        roles: draftRoles.length,
        lines: draftLines.length,
        warnings: draftWarnings.length,
        tokensUsed,
      },
    })
  } catch (err) {
    console.error("[parse-script] unexpected error:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
