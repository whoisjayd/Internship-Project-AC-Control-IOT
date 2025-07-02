import { jwtDecode } from "jwt-decode"

interface JWTPayload {
  sub: string
  exp: number
  iat: number
  customer_id: string
  email: string
}

export class AuthUtils {
  private static readonly TOKEN_KEY = "auth-token"
  private static readonly USER_KEY = "user-data"
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000 // 5 minutes

  static setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.TOKEN_KEY, token)
      document.cookie = `auth-token=${token}; path=/; secure; samesite=strict; max-age=${7 * 24 * 60 * 60}`
    }
  }

  static getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(this.TOKEN_KEY)
    }
    return null
  }

  static removeToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.TOKEN_KEY)
      localStorage.removeItem(this.USER_KEY)
      document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }
  }

  static setUser(user: any): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user))
    }
  }

  static getUser(): any | null {
    if (typeof window !== "undefined") {
      const userData = localStorage.getItem(this.USER_KEY)
      return userData ? JSON.parse(userData) : null
    }
    return null
  }

  static isTokenValid(token: string): boolean {
    try {
      const decoded = jwtDecode<JWTPayload>(token)
      const currentTime = Date.now() / 1000
      return decoded.exp > currentTime
    } catch {
      return false
    }
  }

  static shouldRefreshToken(token: string): boolean {
    try {
      const decoded = jwtDecode<JWTPayload>(token)
      const currentTime = Date.now()
      const expirationTime = decoded.exp * 1000
      return expirationTime - currentTime < this.REFRESH_THRESHOLD
    } catch {
      return false
    }
  }

  static getTokenPayload(token: string): JWTPayload | null {
    try {
      return jwtDecode<JWTPayload>(token)
    } catch {
      return null
    }
  }

  static sanitizeInput(input: string): string {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long")
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter")
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter")
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number")
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push("Password must contain at least one special character")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
