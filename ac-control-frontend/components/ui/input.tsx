import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  showError?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, showError = true, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border border-input bg-surface/50 px-4 py-3 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground transition-all duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-card",
            "hover:border-border hover:bg-card",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && showError && "border-destructive/50 focus-visible:ring-destructive/20 focus-visible:border-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && showError && (
          <p className="text-sm text-destructive animate-slide-down">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
