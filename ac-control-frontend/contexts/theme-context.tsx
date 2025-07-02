"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  // Load saved preferences on mount
  useEffect(() => {
    setMounted(true)
    // Always set to light theme
    setTheme("light")
  }, [])

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove("light", "dark")

    // Always add light theme
    root.classList.add("light")

    // Save preferences
    try {
      localStorage.setItem("ac-control-theme", "light")
    } catch (error) {
      console.warn("Failed to save theme preferences:", error)
    }
  }, [mounted])

  const toggleTheme = () => {
    // No-op since we only use light theme
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: "light", // default value for SSR
          setTheme: () => {},
          toggleTheme: () => {},
        }}
      >
        <div className="opacity-0">{children}</div>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
