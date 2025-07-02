import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value
  const { pathname } = request.nextUrl

  // Define protected and public routes
  const isAuthPage = pathname.startsWith("/auth")
  const isPublicPage = pathname === "/"
  const isProtectedRoute = !isAuthPage && !isPublicPage

  // Security headers
  const response = NextResponse.next()

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Handle authentication logic
  if (isProtectedRoute && !token) {
    // Redirect to login if accessing protected route without token
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && token) {
    // Redirect to dashboard if already authenticated
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (isPublicPage) {
    // Redirect root to appropriate page
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    } else {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
