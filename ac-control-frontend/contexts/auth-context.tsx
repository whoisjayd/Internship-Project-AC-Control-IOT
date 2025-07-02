"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AuthUtils } from "@/lib/auth-utils"
import { apiClient } from "@/lib/api-client"

interface User {
  customer_id: string
  email: string
  username: string
  company_name?: string
  company_address?: string
  phone_no?: string
  country?: string
  state?: string
  city?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (userData: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
  loading: boolean
  isAuthenticated: boolean
}

interface RegisterData {
  email: string
  password: string
  username: string
  company_name?: string
  company_address?: string
  phone_no?: string
  country?: string
  state?: string
  city?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    apiClient.setToken("")
    AuthUtils.removeToken()
    router.push("/auth/login")
  }, [router])

  const refreshToken = useCallback(async () => {
    const currentToken = AuthUtils.getToken()
    if (!currentToken) {
      logout()
      return
    }

    try {
      if (!AuthUtils.isTokenValid(currentToken)) {
        logout()
        return
      }

      setToken(currentToken)
      apiClient.setToken(currentToken)
    } catch (error) {
      console.error("Token refresh failed:", error)
      logout()
    }
  }, [logout])

  const updateUser = useCallback(
    (userData: Partial<User>) => {
      setUser((prev) => (prev ? { ...prev, ...userData } : null))
      if (user) {
        AuthUtils.setUser({ ...user, ...userData })
      }
    },
    [user],
  )

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = AuthUtils.getToken()
        const storedUser = AuthUtils.getUser()

        if (storedToken && storedUser) {
          if (AuthUtils.isTokenValid(storedToken)) {
            setToken(storedToken)
            setUser(storedUser)
            apiClient.setToken(storedToken)

            if (AuthUtils.shouldRefreshToken(storedToken)) {
              await refreshToken()
            }
          } else {
            AuthUtils.removeToken()
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error)
        AuthUtils.removeToken()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [refreshToken])

  useEffect(() => {
    if (token) {
      const interval = setInterval(() => {
        if (AuthUtils.shouldRefreshToken(token)) {
          refreshToken()
        }
      }, 60000)

      return () => clearInterval(interval)
    }
  }, [token, refreshToken])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)

      const sanitizedEmail = AuthUtils.sanitizeInput(email)
      const sanitizedPassword = AuthUtils.sanitizeInput(password)

      if (!AuthUtils.validateEmail(sanitizedEmail)) {
        throw new Error("Invalid email format")
      }

      const formData = {
        email: sanitizedEmail,
        password: sanitizedPassword,
      }

      const data = await apiClient.post("/auth/login", formData)
      const userToken = data.access_token
      const userData = data.customer

      if (!AuthUtils.isTokenValid(userToken)) {
        throw new Error("Invalid token received")
      }

      AuthUtils.setToken(userToken)
      AuthUtils.setUser(userData)
      setToken(userToken)
      setUser(userData)
      apiClient.setToken(userToken)

      router.push("/dashboard")
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      setLoading(true)

      if (!AuthUtils.validateEmail(userData.email)) {
        throw new Error("Invalid email format")
      }

      const passwordValidation = AuthUtils.validatePassword(userData.password)
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors[0])
      }

      const sanitizedData = {
        ...userData,
        email: AuthUtils.sanitizeInput(userData.email),
        username: AuthUtils.sanitizeInput(userData.username),
        company_name: userData.company_name ? AuthUtils.sanitizeInput(userData.company_name) : undefined,
      }

      const data = await apiClient.post("/auth/register", sanitizedData)
      const userToken = data.access_token
      const userProfile = data.customer

      AuthUtils.setToken(userToken)
      AuthUtils.setUser(userProfile)
      setToken(userToken)
      setUser(userProfile)
      apiClient.setToken(userToken)

      router.push("/dashboard")
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    token,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    loading,
    isAuthenticated: !!user && !!token,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
