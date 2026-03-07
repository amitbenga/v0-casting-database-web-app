"use server"

import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { AI_TRANSLATE_MODEL, AI_MODELS, type AIModelId } from "@/lib/ai-config"

interface TranslateResult {
  success: boolean
  translated: number
  error?: string
}

/**
 * Translate script lines from source language to Hebrew using AI.
 * Only translates lines where translation is null/empty (doesn't overwrite manual edits).
 * Processes in batches of 40 lines per AI call for context quality.
 */
export async function translateScriptLines(
  projectId: string,
  options: { lineIds?: string[]; force?: boolean; model?: string } = {}
): Promise<TranslateResult> {
  const supabase = await createClient()

  try {
    // Fetch lines that need translation
    let query = supabase
      .from("script_lines")
      .select("id, line_number, role_name, source_text, translation")
      .eq("project_id", projectId)
      .order("line_number", { ascending: true })

    if (options.lineIds && options.lineIds.length > 0) {
      query = query.in("id", options.lineIds)
    }

    const { data: allLines, error: fetchError } = await query
    if (fetchError) throw fetchError

    // Filter to lines that need translation
    const linesToTranslate = (allLines ?? []).filter((line) => {
      if (!line.source_text || line.source_text.trim() === "") return false
      if (options.force) return true
      return !line.translation || line.translation.trim() === ""
    })

    if (linesToTranslate.length === 0) {
      return { success: true, translated: 0 }
    }

    // Process in batches of 40 for good context
    const BATCH_SIZE = 40
    let totalTranslated = 0

    for (let i = 0; i < linesToTranslate.length; i += BATCH_SIZE) {
      const batch = linesToTranslate.slice(i, i + BATCH_SIZE)

      // Build the text block for translation
      const sourceBlock = batch
        .map((line, idx) => `[${idx}] ${line.role_name}: ${line.source_text}`)
        .join("\n")

      const { text } = await generateText({
        model: (AI_MODELS.some(m => m.id === options.model) ? options.model : AI_TRANSLATE_MODEL) as AIModelId,
        messages: [
          {
            role: "system",
            content: `אתה מתרגם מקצועי לדיבוב. תרגם את שורות הדיאלוג הבאות לעברית.

כללים קריטיים:
1. שמור על מספור השורות [0], [1], ... בדיוק כפי שהם
2. אל תכלול את שם הדמות בפלט — תרגם רק את טקסט הדיאלוג עצמו
3. השתמש בעברית טבעית ומדוברת, מתאימה לדיבוב
4. שמור על אורך דומה למקור (חשוב לסנכרון שפתיים)
5. אל תוסיף הסברים — רק את התרגום

דוגמה:
קלט: [0] JOHN: Hello, how are you?
פלט נכון: [0] שלום, מה שלומך?
פלט שגוי: [0] ג'ון: שלום, מה שלומך?

פורמט הפלט:
[0] תרגום בלבד ללא שם דמות
[1] תרגום בלבד ללא שם דמות
...`,
          },
          {
            role: "user",
            content: sourceBlock,
          },
        ],
        maxOutputTokens: 4000,
      })

      // Parse the response — extract translations by line index
      const translations = parseTranslationResponse(text, batch.length)

      // Build updates for batch upsert.
      // Must include NOT NULL columns (project_id, role_name) because PostgreSQL
      // evaluates INSERT constraints before checking for conflicts on upsert.
      const updates: { id: string; project_id: string; role_name: string; translation: string }[] = []
      for (let j = 0; j < batch.length; j++) {
        const translation = translations[j]
        if (translation) {
          updates.push({
            id: batch[j].id,
            project_id: projectId,
            role_name: batch[j].role_name,
            translation,
          })
        }
      }

      if (updates.length > 0) {
        // Supabase upsert with onConflict lets us batch-update all lines at once
        const { error: batchError } = await supabase
          .from("script_lines")
          .upsert(updates, { onConflict: "id", ignoreDuplicates: false })

        if (batchError) {
          console.error("Batch translation update failed:", batchError)
        } else {
          totalTranslated += updates.length
        }
      }
    }

    return { success: true, translated: totalTranslated }
  } catch (err) {
    console.error("translateScriptLines error:", err)
    return { success: false, translated: 0, error: String(err) }
  }
}

/**
 * Parse AI translation response into an array indexed by line number.
 * Expected format: "[0] translation text\n[1] translation text\n..."
 */
function parseTranslationResponse(text: string, expectedCount: number): (string | null)[] {
  const result: (string | null)[] = new Array(expectedCount).fill(null)
  const lines = text.split("\n")

  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.+)$/)
    if (match) {
      const idx = parseInt(match[1])
      const translation = match[2].trim()
      if (idx >= 0 && idx < expectedCount && translation) {
        result[idx] = translation
      }
    }
  }

  return result
}
