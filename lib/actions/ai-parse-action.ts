"use server"

import { generateText } from "ai"
import type { ScriptLineInput } from "@/lib/types"

interface AiParseParams {
  /** Base64-encoded file content */
  fileBase64: string
  fileName: string
  mimeType: string
}

interface AiParseResult {
  success: boolean
  lines?: ScriptLineInput[]
  error?: string
}

/**
 * Parse a script file (PDF / DOCX) using AI when the rule-based parser fails.
 *
 * The file is sent to Claude as a base64-encoded document.
 * Claude extracts dialogue lines and returns structured JSON.
 *
 * Called from the workspace tab when:
 *   - PDF.js returns empty text (scanned PDF, unusual font encoding)
 *   - Rule-based dialogue extraction finds 0 lines
 */
export async function parseScriptWithAI(params: AiParseParams): Promise<AiParseResult> {
  const { fileBase64, fileName, mimeType } = params

  try {
    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: fileBase64,
              mediaType: mimeType,
            },
            {
              type: "text",
              text: `This is a dubbing script or dialogue list file: "${fileName}".

Extract ALL dialogue lines from the document. For each line return:
- role_name: character/role name (as it appears in the script)
- timecode: timecode if visible (format HH:MM:SS:FF or HH:MM:SS), null if not present
- source_text: the dialogue text / line content

Return ONLY a JSON array, no explanation, no markdown fences:
[{"role_name":"CHAR","timecode":"00:01:23:00","source_text":"Hello world"},...]

Rules:
- Include every dialogue line, even short ones
- If timecodes are absent, omit the field or set to null
- Preserve the original language of the source_text
- If you see a table with rows (timecode | character | dialogue), extract all rows`,
            },
          ],
        },
      ],
    })

    // Parse JSON response
    let raw = text.trim()
    // Strip markdown code fences if present
    raw = raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any[] = JSON.parse(raw)

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { success: false, error: "AI לא מצא שורות דיאלוג בקובץ" }
    }

    const lines: ScriptLineInput[] = parsed
      .filter((item) => item.role_name && String(item.role_name).trim())
      .map((item, idx) => ({
        line_number: idx + 1,
        role_name: String(item.role_name).trim(),
        timecode: item.timecode ? String(item.timecode).trim() : undefined,
        source_text: item.source_text ? String(item.source_text).trim() : undefined,
        rec_status: null,
        notes: undefined,
      }))

    return { success: true, lines }
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה"
    // JSON parse error
    if (message.includes("JSON") || message.includes("SyntaxError")) {
      return { success: false, error: "AI החזיר תגובה לא תקינה — נסה שוב" }
    }
    return { success: false, error: message }
  }
}
