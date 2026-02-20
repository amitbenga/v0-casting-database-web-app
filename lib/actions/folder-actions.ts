"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Folder } from "@/lib/types"

export interface FolderActionResult {
  success: boolean
  error?: string
  folder?: Folder
}

export async function createFolder(
  name: string,
  description?: string,
  color?: string
): Promise<FolderActionResult> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("folders")
      .insert({
        name,
        description: description || null,
        color: color || "blue",
      })
      .select("id, name, color, description, created_at, updated_at")
      .single()

    if (error) throw error

    revalidatePath("/folders")
    return { success: true, folder: data as Folder }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "שגיאה ביצירת התיקייה"
    console.error("Error creating folder:", error)
    return { success: false, error: message }
  }
}
