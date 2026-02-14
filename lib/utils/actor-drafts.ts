/**
 * Actor Drafts - localStorage-based draft system for "Add Actor" form
 *
 * Stores form data locally so users don't lose work if they navigate away.
 * Each draft has a unique ID and timestamp.
 */

const DRAFTS_KEY = "scprodub_actor_drafts"

export interface ActorDraft {
  id: string
  created_at: string
  updated_at: string
  data: Record<string, any>
  /** Optional label for display */
  label?: string
}

/**
 * Get all saved drafts
 */
export function getDrafts(): ActorDraft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (!raw) return []
    const drafts = JSON.parse(raw) as ActorDraft[]
    // Sort by most recent first
    return drafts.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  } catch {
    return []
  }
}

/**
 * Save or update a draft
 */
export function saveDraft(data: Record<string, any>, draftId?: string): ActorDraft {
  const drafts = getDrafts()
  const now = new Date().toISOString()

  if (draftId) {
    // Update existing draft
    const index = drafts.findIndex((d) => d.id === draftId)
    if (index >= 0) {
      drafts[index].data = data
      drafts[index].updated_at = now
      drafts[index].label = data.full_name || "טיוטה ללא שם"
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
      return drafts[index]
    }
  }

  // Create new draft
  const newDraft: ActorDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: now,
    updated_at: now,
    data,
    label: data.full_name || "טיוטה ללא שם",
  }

  drafts.unshift(newDraft)

  // Keep max 20 drafts
  const trimmed = drafts.slice(0, 20)
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed))

  return newDraft
}

/**
 * Delete a draft
 */
export function deleteDraft(draftId: string): void {
  const drafts = getDrafts()
  const filtered = drafts.filter((d) => d.id !== draftId)
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered))
}

/**
 * Delete all drafts
 */
export function clearAllDrafts(): void {
  localStorage.removeItem(DRAFTS_KEY)
}

/**
 * Get a specific draft by ID
 */
export function getDraftById(draftId: string): ActorDraft | null {
  const drafts = getDrafts()
  return drafts.find((d) => d.id === draftId) || null
}
