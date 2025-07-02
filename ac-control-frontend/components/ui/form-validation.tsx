"use client"

import { useState } from "react"
import { AuthUtils } from "@/lib/auth-utils"

interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: string) => string | null
}

interface ValidationRules {
  [key: string]: ValidationRule
}

export function useFormValidation<T extends Record<string, string>>(initialValues: T, rules: ValidationRules) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const validateField = (name: keyof T, value: string): string | null => {
    const rule = rules[name as string]
    if (!rule) return null

    if (rule.required && !value.trim()) {
      return `${String(name)} is required`
    }

    if (rule.minLength && value.length < rule.minLength) {
      return `${String(name)} must be at least ${rule.minLength} characters`
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      return `${String(name)} must be no more than ${rule.maxLength} characters`
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      if (name === "email") {
        return "Please enter a valid email address"
      }
      return `${String(name)} format is invalid`
    }

    if (rule.custom) {
      return rule.custom(value)
    }

    return null
  }

  const setValue = (name: keyof T, value: string) => {
    const sanitizedValue = AuthUtils.sanitizeInput(value)
    setValues((prev) => ({ ...prev, [name]: sanitizedValue }))

    if (touched[name]) {
      const error = validateField(name, sanitizedValue)
      setErrors((prev) => ({ ...prev, [name]: error || undefined }))
    }
  }

  const setFieldTouched = (name: keyof T) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    const error = validateField(name, values[name])
    setErrors((prev) => ({ ...prev, [name]: error || undefined }))
  }

  const validateAll = (): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {}
    let isValid = true

    Object.keys(values).forEach((key) => {
      const error = validateField(key as keyof T, values[key as keyof T])
      if (error) {
        newErrors[key as keyof T] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}))
    return isValid
  }

  const reset = () => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }

  return {
    values,
    errors,
    touched,
    setValue,
    setTouched: setFieldTouched,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0,
  }
}
