"use client"

import { Button } from "@/components/ui/button"
import { Sun } from "lucide-react"

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground transition-colors cursor-default"
      title="Light mode"
      disabled
    >
      <Sun className="h-4 w-4" />
      <span className="sr-only">Light mode</span>
    </Button>
  )
}
