"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export function useAuthGuard(redirectTo = "/auth/login") {
  const { user, token, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !token)) {
      router.replace(redirectTo)
    }
  }, [user, token, loading, router, redirectTo])

  return { isAuthenticated: !!user && !!token, loading }
}

export function useGuestGuard(redirectTo = "/dashboard") {
  const { user, token, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && token) {
      router.replace(redirectTo)
    }
  }, [user, token, loading, router, redirectTo])

  return { isGuest: !user && !token, loading }
}
