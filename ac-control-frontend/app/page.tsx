"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard
    router.push("/dashboard")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}
