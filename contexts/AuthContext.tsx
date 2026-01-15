"use client"

import { createContext, useContext, useEffect, useState } from "react"
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
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
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId)

      if (error) {
        console.warn("[Auth] user_profiles table not found or not accessible, using default profile")
        // Create a default profile from user data
        setProfile({
          id: userId,
          email: user?.email || "",
          full_name: user?.email?.split("@")[0] || "User",
          role: "admin", // Default to admin for now
        })
      } else if (data && data.length > 0) {
        setProfile(data[0])
      } else {
        // No profile found, create default
        setProfile({
          id: userId,
          email: user?.email || "",
          full_name: user?.email?.split("@")[0] || "User",
          role: "admin",
        })
      }
    } catch (error) {
      console.error("[Auth] Error loading profile:", error)
      // Fallback to default profile
      setProfile({
        id: userId,
        email: user?.email || "",
        full_name: "User",
        role: "admin",
      })
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const supabase = createClient()
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
      const supabase = createClient()
      await supabase.auth.signOut()
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
