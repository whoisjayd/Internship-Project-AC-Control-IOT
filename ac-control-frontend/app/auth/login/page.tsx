"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useGuestGuard } from "@/hooks/use-auth-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Eye, EyeOff, Thermometer, AlertCircle, Zap, Shield, Mail, Lock } from "lucide-react"

interface FormErrors {
  email?: string
  password?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { loading: guestLoading } = useGuestGuard()

  const redirectTo = searchParams.get("redirect") || "/dashboard"

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!password) {
      newErrors.password = "Password is required"
    } else if (password.length < 1) {
      newErrors.password = "Password cannot be empty"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      await login(email, password)
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      })
      router.push(redirectTo)
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (guestLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen">
        {/* Left side - Enhanced Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative">
          <div className="relative z-10 max-w-md">
            {/* Brand Section */}
            <div className="mb-12 animate-fade-in-up">
              <div className="flex items-center space-x-4 mb-8">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/25">
                    <Thermometer className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-br from-primary to-blue-600 rounded-2xl blur opacity-25 animate-pulse"></div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    AC Control
                  </h1>
                  <p className="text-lg text-slate-600 font-medium">Smart Climate Management</p>
                </div>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-8 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <h2 className="text-3xl font-bold text-slate-900 leading-tight">
                Welcome back to your
                <span className="text-gradient"> smart climate</span> dashboard
              </h2>

              <div className="space-y-6">
                {[
                  { icon: Zap, title: "Real-time Control", desc: "Monitor and control your AC devices from anywhere" },
                  { icon: Shield, title: "Secure & Reliable", desc: "Enterprise-grade security for your smart home" },
                  { icon: Thermometer, title: "Smart Automation", desc: "Intelligent scheduling and energy optimization" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 animate-slide-up" style={{animationDelay: `${0.3 + index * 0.1}s`}}>
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Enhanced Login form */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 lg:px-12 xl:px-16 py-12">
          <div className="w-full max-w-md mx-auto animate-bounce-gentle">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8 animate-fade-in-up">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Thermometer className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">AC Control</h1>
              </div>
              <p className="text-slate-600">Smart Climate Management</p>
            </div>

            <div className="modern-card border-0 shadow-2xl shadow-black/10 p-8">
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-slate-600">Sign in to your account to manage your AC devices</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="form-label flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Email address</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`form-input h-12 ${errors.email ? "border-red-500 focus:border-red-500" : ""}`}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <div className="flex items-center gap-2 text-sm text-red-600 animate-fade-in-up">
                      <AlertCircle className="h-4 w-4" />
                      {errors.email}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="form-label flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>Password</span>
                    </label>
                    <Link href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`form-input h-12 pr-12 ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-slate-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-500" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <div className="flex items-center gap-2 text-sm text-red-600 animate-fade-in-up">
                      <AlertCircle className="h-4 w-4" />
                      {errors.password}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 btn-primary text-base font-medium" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="text-center mt-8">
                <p className="text-sm text-slate-600">
                  Don't have an account?{" "}
                  <Link
                    href="/auth/register"
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Sign up here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
