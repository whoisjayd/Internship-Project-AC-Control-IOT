"use client"

import type React from "react"
import { Country, State, City } from "country-state-city"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useToast } from "@/hooks/use-toast"
import {
  Eye,
  EyeOff,
  Thermometer,
  User,
  Building,
  Phone,
  MapPin,
  Mail,
  Lock,
  CheckCircle,
  XCircle,
  ChevronDown,
} from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface FormErrors {
  email?: string
  password?: string
  username?: string
  company_name?: string
  company_address?: string
  phone_no?: string
  country?: string
  state?: string
  city?: string
}

interface LocationData {
  country: { isoCode: string; name: string; flag: string } | null
  state: { isoCode: string; name: string } | null
  city: { name: string } | null
}

// Modern Combobox component for location selection
interface ComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string; flag?: string }>
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
  className?: string
}

function LocationCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredOptions = useMemo(() => {
    if (!searchValue) return options
    return options.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()))
  }, [options, searchValue])

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            {selectedOption?.flag && <span className="text-lg">{selectedOption.flag}</span>}
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg" align="start">
        <Command className="bg-white dark:bg-slate-950">
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue} 
            onValueChange={setSearchValue}
            className="bg-white dark:bg-slate-950"
          />
          <CommandList className="bg-white dark:bg-slate-950">
            <CommandEmpty className="bg-white dark:bg-slate-950">No results found.</CommandEmpty>
            <CommandGroup className="bg-white dark:bg-slate-950">
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                    setSearchValue("")
                  }}
                  className="flex items-center space-x-2 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {option.flag && <span className="text-lg">{option.flag}</span>}
                  <span>{option.label}</span>
                  {value === option.value && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    company_name: "",
    company_address: "",
    phone_no: "",
    country: "",
    state: "",
    city: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [step, setStep] = useState(1)
  const [locationData, setLocationData] = useState<LocationData>({
    country: null,
    state: null,
    city: null,
  })
  const { register } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  // Get all countries with flags
  const countries = useMemo(() => {
    return Country.getAllCountries()
      .map((country) => ({
        value: country.isoCode,
        label: country.name,
        flag: country.flag,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [])

  // Get states for selected country
  const states = useMemo(() => {
    if (!locationData.country) return []
    return State.getStatesOfCountry(locationData.country.isoCode)
      .map((state) => ({
        value: state.isoCode,
        label: state.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [locationData.country])

  // Get cities for selected state
  const cities = useMemo(() => {
    if (!locationData.country || !locationData.state) return []
    return City.getCitiesOfState(locationData.country.isoCode, locationData.state.isoCode)
      .map((city) => ({
        value: city.name,
        label: city.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [locationData.country, locationData.state])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }))
    }
  }

  const handleCountryChange = (countryCode: string) => {
    const country = Country.getCountryByCode(countryCode)
    setLocationData({
      country: country ? { isoCode: country.isoCode, name: country.name, flag: country.flag } : null,
      state: null,
      city: null,
    })
    setFormData((prev) => ({
      ...prev,
      country: country?.name || "",
      state: "",
      city: "",
    }))
  }

  const handleStateChange = (stateCode: string) => {
    if (!locationData.country) return

    const state = State.getStateByCodeAndCountry(stateCode, locationData.country.isoCode)
    setLocationData((prev) => ({
      ...prev,
      state: state ? { isoCode: state.isoCode, name: state.name } : null,
      city: null,
    }))
    setFormData((prev) => ({
      ...prev,
      state: state?.name || "",
      city: "",
    }))
  }

  const handleCityChange = (cityName: string) => {
    setLocationData((prev) => ({
      ...prev,
      city: cityName ? { name: cityName } : null,
    }))
    setFormData((prev) => ({
      ...prev,
      city: cityName,
    }))
  }

  const validateStep1 = () => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    // Username validation - must be alphanumeric and required
    if (!formData.username) {
      newErrors.username = "Username is required"
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters"
    } else if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      newErrors.username = "Username must contain only letters and numbers (no spaces or special characters)"
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: FormErrors = {}

    // All company fields are now mandatory
    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required"
    }

    if (!formData.company_address.trim()) {
      newErrors.company_address = "Company address is required"
    }

    if (!formData.phone_no.trim()) {
      newErrors.phone_no = "Phone number is required"
    } else if (!/^[\+]?[\d\s\-\(\)]{10,}$/.test(formData.phone_no)) {
      newErrors.phone_no = "Please enter a valid phone number"
    }

    if (!formData.country) {
      newErrors.country = "Country is required"
    }

    if (!formData.state) {
      newErrors.state = "State/Province is required"
    }

    if (!formData.city) {
      newErrors.city = "City is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"]
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"]

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2)
    } else {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateStep2()) {
      toast({
        title: "Validation Error", 
        description: "Please complete all required fields",
        variant: "destructive",
      })
      return
    }
    
    setIsLoading(true)

    try {
      await register(formData)
      toast({
        title: "Account created successfully!",
        description: "Welcome to AC Control Management System.",
      })
      router.push("/auth/login")
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Please check your information and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const requirements = [
    { text: "At least 8 characters", met: formData.password.length >= 8 },
    { text: "One uppercase letter", met: /[A-Z]/.test(formData.password) },
    { text: "One lowercase letter", met: /[a-z]/.test(formData.password) },
    { text: "One number", met: /[0-9]/.test(formData.password) },
    { text: "One special character", met: /[^A-Za-z0-9]/.test(formData.password) },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen">
        {/* Left Panel - Desktop Only with Enhanced Design */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div className="flex flex-col justify-center w-full px-12 xl:px-16 py-16 relative z-10">
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
                Join thousands managing their 
                <span className="text-gradient"> climate systems</span> efficiently
              </h2>

              <div className="space-y-6">
                {[
                  { icon: "🌡️", title: "Real-time Control", desc: "Monitor and adjust temperature settings instantly" },
                  { icon: "📊", title: "Smart Analytics", desc: "Advanced insights and energy optimization" },
                  { icon: "🏢", title: "Multi-Zone Management", desc: "Control multiple areas from one dashboard" },
                  { icon: "⚡", title: "Energy Efficiency", desc: "Reduce costs with intelligent automation" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 animate-slide-up" style={{animationDelay: `${0.3 + index * 0.1}s`}}>
                    <div className="text-2xl">{feature.icon}</div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div className="mt-12 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <blockquote className="text-slate-700 italic leading-relaxed mb-4">
                "This platform has transformed how we manage our building's climate control. The automation features have reduced our energy costs by 35%."
              </blockquote>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Sarah Johnson</p>
                  <p className="text-sm text-slate-600">Facility Manager, TechCorp</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form with Enhanced Design */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md animate-bounce-gentle">
            <Card className="modern-card border-0 shadow-2xl shadow-black/10">
              <CardHeader className="text-center space-y-4 pb-8">
                {/* Mobile Brand */}
                <div className="lg:hidden flex justify-center mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Thermometer className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">AC Control</span>
                  </div>
                </div>

                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
                    {step === 1 ? "Create your account" : "Complete your profile"}
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    {step === 1 
                      ? "Join us to start managing your AC devices" 
                      : "Please provide your company details (all fields required)"}
                  </CardDescription>
                </div>

                {/* Enhanced Progress Indicator */}
                <div className="flex space-x-3 pt-4">
                  <div className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    step >= 1 
                      ? "bg-gradient-to-r from-primary to-blue-500 shadow-sm shadow-primary/25" 
                      : "bg-slate-200"
                  }`} />
                  <div className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    step >= 2 
                      ? "bg-gradient-to-r from-primary to-blue-500 shadow-sm shadow-primary/25" 
                      : "bg-slate-200"
                  }`} />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Step {step} of 2
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <form
                  onSubmit={
                    step === 1
                      ? (e) => {
                          e.preventDefault()
                          handleNextStep()
                        }
                      : handleSubmit
                  }
                  className="space-y-6"
                >
                  {step === 1 ? (
                    <div className="space-y-5">
                      {/* Step 1: Basic Information */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center space-x-2 form-label">
                          <Mail className="w-4 h-4 text-primary" />
                          <span>Email Address *</span>
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Enter your email address"
                          value={formData.email}
                          onChange={handleChange}
                          className={`form-input h-12 ${errors.email ? "border-red-500 focus:border-red-500" : ""}`}
                          required
                        />
                        {errors.email && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.email}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="username" className="flex items-center space-x-2 form-label">
                          <User className="w-4 h-4 text-primary" />
                          <span>Username *</span>
                        </Label>
                        <Input
                          id="username"
                          name="username"
                          type="text"
                          placeholder="Choose a username (letters and numbers only)"
                          value={formData.username}
                          onChange={handleChange}
                          className={`form-input h-12 ${errors.username ? "border-red-500 focus:border-red-500" : ""}`}
                          required
                        />
                        {errors.username && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.username}</span>
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          Username must contain only letters and numbers (no spaces or special characters)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password" className="flex items-center space-x-2 form-label">
                          <Lock className="w-4 h-4 text-primary" />
                          <span>Password *</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`form-input h-12 pr-12 ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
                          </Button>
                        </div>

                        {errors.password && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.password}</span>
                          </p>
                        )}

                        {formData.password && (
                          <div className="space-y-3 animate-fade-in-up">
                            <div className="flex space-x-1">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                    i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-slate-600 font-medium">
                              Password strength: {strengthLabels[passwordStrength - 1] || "Very Weak"}
                            </p>

                            <div className="space-y-2">
                              {requirements.map((req, index) => (
                                <div key={index} className="flex items-center space-x-2 text-xs">
                                  {req.met ? (
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-slate-400" />
                                  )}
                                  <span className={req.met ? "text-green-600" : "text-slate-500"}>{req.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button type="submit" className="w-full h-12 btn-primary text-base font-medium">
                        Continue to Company Details
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Step 2: Company Information - All Required */}
                      <div className="space-y-2">
                        <Label htmlFor="company_name" className="flex items-center space-x-2 form-label">
                          <Building className="w-4 h-4 text-primary" />
                          <span>Company Name *</span>
                        </Label>
                        <Input
                          id="company_name"
                          name="company_name"
                          type="text"
                          placeholder="Enter your company name"
                          value={formData.company_name}
                          onChange={handleChange}
                          className={`form-input h-12 ${errors.company_name ? "border-red-500 focus:border-red-500" : ""}`}
                          required
                        />
                        {errors.company_name && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.company_name}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_address" className="flex items-center space-x-2 form-label">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>Company Address *</span>
                        </Label>
                        <Input
                          id="company_address"
                          name="company_address"
                          type="text"
                          placeholder="Enter your company address"
                          value={formData.company_address}
                          onChange={handleChange}
                          className={`form-input h-12 ${errors.company_address ? "border-red-500 focus:border-red-500" : ""}`}
                          required
                        />
                        {errors.company_address && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.company_address}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone_no" className="flex items-center space-x-2 form-label">
                          <Phone className="w-4 h-4 text-primary" />
                          <span>Phone Number *</span>
                        </Label>
                        <Input
                          id="phone_no"
                          name="phone_no"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={formData.phone_no}
                          onChange={handleChange}
                          className={`form-input h-12 ${errors.phone_no ? "border-red-500 focus:border-red-500" : ""}`}
                          required
                        />
                        {errors.phone_no && (
                          <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                            <XCircle className="w-4 h-4" />
                            <span>{errors.phone_no}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="flex items-center space-x-2 form-label">
                            <MapPin className="w-4 h-4 text-primary" />
                            <span>Country *</span>
                          </Label>
                          <LocationCombobox
                            value={locationData.country?.isoCode || ""}
                            onValueChange={handleCountryChange}
                            options={countries}
                            placeholder="Select your country"
                            searchPlaceholder="Search countries..."
                            className={`h-12 ${errors.country ? "border-red-500" : ""}`}
                          />
                          {errors.country && (
                            <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                              <XCircle className="w-4 h-4" />
                              <span>{errors.country}</span>
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="form-label">State/Province *</Label>
                            <LocationCombobox
                              value={locationData.state?.isoCode || ""}
                              onValueChange={handleStateChange}
                              options={states}
                              placeholder="Select state"
                              searchPlaceholder="Search states..."
                              disabled={!locationData.country}
                              className={`h-12 ${errors.state ? "border-red-500" : ""}`}
                            />
                            {errors.state && (
                              <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                                <XCircle className="w-4 h-4" />
                                <span>{errors.state}</span>
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="form-label">City *</Label>
                            <LocationCombobox
                              value={locationData.city?.name || ""}
                              onValueChange={handleCityChange}
                              options={cities}
                              placeholder="Select city"
                              searchPlaceholder="Search cities..."
                              disabled={!locationData.state}
                              className={`h-12 ${errors.city ? "border-red-500" : ""}`}
                            />
                            {errors.city && (
                              <p className="text-sm text-red-600 flex items-center space-x-1 animate-fade-in-up">
                                <XCircle className="w-4 h-4" />
                                <span>{errors.city}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-4 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setStep(1)} 
                          className="flex-1 h-12 btn-secondary"
                        >
                          Back
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 h-12 btn-primary text-base font-medium" 
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              <span>Creating Account...</span>
                            </div>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>

                <div className="text-center pt-4">
                  <p className="text-sm text-slate-600">
                    Already have an account?{" "}
                    <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
