import { createClient } from "@/lib/supabase/server"

/**
 * Verify that the current request has an authenticated Supabase session.
 * Call this at the top of every Server Action and API route.
 *
 * Returns the authenticated user on success.
 * Throws an error if no valid session exists.
 */
export async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Unauthorized: authentication required")
  }

  return { user, supabase }
}
