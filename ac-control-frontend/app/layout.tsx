import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"
import { DeviceProvider } from "@/contexts/device-context"
import { ThemeProvider } from "@/contexts/theme-context"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/ui/error-boundary"

// Configure Inter font with all weights we need
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  // Include all weights we need
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "AC Control System",
  description: "Smart AC control and monitoring system",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <DeviceProvider>
                {children}
                <Toaster />
              </DeviceProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
