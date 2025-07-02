"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyToClipboardProps {
  text: string
  label?: string
  className?: string
  showIcon?: boolean
  variant?: "default" | "ghost" | "outline" | "inline"
}

export function CopyToClipboard({ text, label, className, showIcon = false, variant = "ghost" }: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)

      toast({
        title: "Copied to clipboard",
        description: `${label || "Text"} copied successfully`,
        duration: 2000,
      })

      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  if (variant === "inline") {
    return (
      <span
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1 cursor-pointer hover:text-primary transition-colors font-mono text-xs",
          className,
        )}
        title="Click to copy"
      >
        {text}
        {showIcon &&
          (copied ? (
            <Check className="h-3 w-3 icon-success" />
          ) : (
            <Copy className="h-3 w-3 opacity-50 hover:opacity-100" />
          ))}
      </span>
    )
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleCopy}
      className={cn("h-auto p-1 text-xs", className)}
      title="Click to copy"
    >
      <span className="font-mono">{text}</span>
      {showIcon && (copied ? <Check className="h-3 w-3 ml-1 icon-success" /> : <Copy className="h-3 w-3 ml-1" />)}
    </Button>
  )
}
