"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"

interface DeviceStatus {
  device_id: string
  online: boolean
  last_seen: string
  power: boolean
  mode: string
  temperature: number
  fan_speed: string
  timestamp: string
}

interface UseDeviceStatusOptions {
  refreshInterval?: number
  enableRealTimeUpdates?: boolean
}

export function useDeviceStatus(deviceId: string, options: UseDeviceStatusOptions = {}) {
  const { refreshInterval = 30000, enableRealTimeUpdates = true } = options
  const { token } = useAuth()
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!token || !deviceId) return

    try {
      setError(null)
      const response = await fetch(`/api/devices/${deviceId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
      setLastUpdated(new Date())
    } catch (err: any) {
      console.error(`Failed to fetch status for device ${deviceId}:`, err)
      setError(err.message || "Failed to fetch device status")
    } finally {
      setLoading(false)
    }
  }, [deviceId, token])

  // Initial fetch
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Periodic refresh
  useEffect(() => {
    if (!enableRealTimeUpdates) return

    const interval = setInterval(fetchStatus, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchStatus, refreshInterval, enableRealTimeUpdates])

  // Determine if device is truly online based on last_seen
  const isOnline = useCallback(() => {
    if (!status?.last_seen) return false

    const lastSeen = new Date(status.last_seen)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60)

    // Consider device offline if not seen for more than 5 minutes
    return diffMinutes < 5
  }, [status?.last_seen])

  return {
    status: status ? { ...status, online: isOnline() } : null,
    loading,
    error,
    lastUpdated,
    refresh: fetchStatus,
    isOnline: isOnline(),
  }
}
