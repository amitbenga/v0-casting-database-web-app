"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: "admin" | "viewer"
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create a stable Supabase client at module level — avoids re-creating on every render
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

function makeDefaultProfile(userId: string, email?: string): UserProfile {
  return {
    id: userId,
    email: email || "",
    full_name: email?.split("@")[0] || "User",
    role: "admin",
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const profileCacheRef = useRef<Map<string, UserProfile>>(new Map())

  const loadProfile = useCallback(async (userId: string, userEmail?: string) => {
    // Check in-memory cache first — avoids re-fetching on every navigation
    const cached = profileCacheRef.current.get(userId)
    if (cached) {
      setProfile(cached)
      setLoading(false)
      return
    }

    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role")
        .eq("id", userId)
        .maybeSingle()

      let resolvedProfile: UserProfile
      if (error || !data) {
        if (error) {
          console.warn("[Auth] user_profiles table not found or not accessible, using default profile")
        }
        resolvedProfile = makeDefaultProfile(userId, userEmail)
      } else {
        resolvedProfile = data
      }

      profileCacheRef.current.set(userId, resolvedProfile)
      setProfile(resolvedProfile)
    } catch (error) {
      console.error("[Auth] Error loading profile:", error)
      const fallback = makeDefaultProfile(userId, userEmail)
      setProfile(fallback)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id, session.user.email)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
        profileCacheRef.current.clear()
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  async function signIn(email: string, password: string) {
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) return { error }

      router.push("/")
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  async function signOut() {
    try {
      const supabase = getSupabase()
      await supabase.auth.signOut()
      profileCacheRef.current.clear()
      router.push("/login")
    } catch (error) {
      console.error("[Auth] Error signing out:", error)
    }
  }

  const isAdmin = profile?.role === "admin"

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
