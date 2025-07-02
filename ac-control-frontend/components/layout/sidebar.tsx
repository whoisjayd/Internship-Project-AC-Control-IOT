"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/contexts/auth-context"
import { Home, Thermometer, MapPin, User, Settings, LogOut, X, History, Bell, Layers } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Devices", href: "/devices", icon: Thermometer },
  { name: "Zones", href: "/zones", icon: MapPin },
  { name: "History", href: "/history", icon: History },
  { name: "Batch Control", href: "/batch-control", icon: Layers },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-72 lg:overflow-y-auto glass-sidebar">
        <SidebarContent user={user} pathname={pathname} logout={logout} />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto glass-sidebar transform transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Thermometer className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AC Control</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 transition-smooth hover-lift">
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>
        <SidebarContent user={user} pathname={pathname} logout={logout} onLinkClick={onClose} />
      </div>
    </>
  )
}

interface SidebarContentProps {
  user: any
  pathname: string
  logout: () => void
  onLinkClick?: () => void
}

function SidebarContent({ user, pathname, logout, onLinkClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo - Desktop only */}
      <div className="hidden lg:flex lg:items-center lg:justify-between lg:h-16 lg:px-6 lg:border-b lg:border-border/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Thermometer className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">AC Control</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="p-2">
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href
          const animationClass = `animate-stagger-${Math.min(index + 1, 6)}`
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-smooth hover-lift group relative overflow-hidden",
                animationClass,
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground group-hover:scale-110",
                )}
              />
              <span>{item.name}</span>
              {isActive && <div className="ml-auto w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center space-x-3 mb-4 p-3 rounded-xl bg-surface/50">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-sm font-bold text-primary-foreground">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.username || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "user@example.com"}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="w-full justify-start transition-smooth hover-lift hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
