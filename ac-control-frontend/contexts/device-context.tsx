"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useAuth } from "./auth-context"
import { useMQTTService } from "@/lib/mqtt-service"
import { apiClient, APIError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { deviceAPI } from "@/lib/device-api"

interface Device {
  device_id: string
  zone_id: string
  zone_location_name?: string
  ac_brand_name: string
  ac_brand_protocol: string
  firmware_version: string
  last_seen: string
  status?: DeviceStatus
}

interface DeviceStatus {
  power: boolean
  mode: "auto" | "cool" | "heat" | "dry" | "fan"
  temperature: number
  fan_speed: "auto" | "low" | "medium" | "high"
  online: boolean
  timestamp: string
}

interface Zone {
  zone_id: string
  zone_location_name: string
  device_count?: number
}

interface DeviceGroup {
  id: string
  name: string
  device_ids: string[]
  created_at: string
}

interface BatchOperationResult {
  success: string[]
  failed: { deviceId: string; error: string }[]
  total: number
}

interface DeviceContextType {
  devices: Device[]
  zones: Zone[]
  deviceGroups: DeviceGroup[]
  selectedDevices: Set<string>
  loading: boolean
  error: string | null
  mqttConnected: boolean
  lastUpdated: Date | null
  fetchDevices: () => Promise<void>
  fetchZones: () => Promise<void>
  sendCommand: (deviceId: string, command: Partial<DeviceStatus>) => Promise<void>
  sendBatchCommand: (deviceIds: string[], command: Partial<DeviceStatus>) => Promise<BatchOperationResult>
  updateDevice: (deviceId: string, data: Partial<Device>) => Promise<void>
  deleteDevice: (deviceId: string) => Promise<void>
  triggerOTA: (deviceId: string, firmwareUrl: string, firmwareVersion: string) => Promise<void>
  createZone: (zoneLocationName: string) => Promise<void>
  updateZone: (zoneId: string, zoneLocationName: string) => Promise<void>
  deleteZone: (zoneId: string) => Promise<void>
  fetchDeviceHistory: (deviceId: string, page?: number, limit?: number) => Promise<any>
  deleteDeviceHistory: (deviceId: string) => Promise<void>
  toggleDeviceSelection: (deviceId: string) => void
  selectAllDevices: () => void
  clearSelection: () => void
  selectDevicesByZone: (zoneId: string) => void
  createDeviceGroup: (name: string, deviceIds: string[]) => void
  deleteDeviceGroup: (groupId: string) => void
  selectDeviceGroup: (groupId: string) => void
  refreshDeviceStatus: (deviceId: string) => Promise<void>
  getDeviceById: (deviceId: string) => Device | undefined
  getZoneById: (zoneId: string) => Zone | undefined
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { user, token } = useAuth()
  const { service: mqttService, isConnected: mqttConnected } = useMQTTService()
  const { toast } = useToast()

  // Device status cache for performance
  const [deviceStatusCache, setDeviceStatusCache] = useState<Map<string, DeviceStatus>>(new Map())
  const [statusUpdateQueue, setStatusUpdateQueue] = useState<Set<string>>(new Set())

  const showErrorToast = useCallback(
    (error: unknown, defaultMessage: string) => {
      let message = defaultMessage
      let description = ""

      if (error instanceof APIError) {
        message = error.message
        if (error.status === 0) {
          description = "Please check your internet connection and try again."
        } else if (error.status >= 500) {
          description = "This appears to be a server issue. Please try again in a few moments."
        }
      } else if (error instanceof Error) {
        message = error.message
      }

      toast({
        title: "Error",
        description: description || message,
        variant: "destructive",
      })
    },
    [toast],
  )

  const showSuccessToast = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
        variant: "default",
      })
    },
    [toast],
  )

  // Optimized device status determination
  const isDeviceOnline = useCallback((device: Device): boolean => {
    if (!device.last_seen) return false

    const lastSeen = new Date(device.last_seen)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60)

    // Consider device offline if not seen for more than 5 minutes
    return diffMinutes < 5
  }, [])

  // Batch update device statuses for performance
  const updateDeviceStatuses = useCallback(
    (statusUpdates: Map<string, DeviceStatus>) => {
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          const statusUpdate = statusUpdates.get(device.device_id)
          if (statusUpdate) {
            return {
              ...device,
              status: {
                ...statusUpdate,
                online: isDeviceOnline(device),
              },
            }
          }
          return device
        }),
      )
      setLastUpdated(new Date())
    },
    [isDeviceOnline],
  )

  const fetchDevices = useCallback(async () => {
    if (!token || !user) return

    setLoading(true)
    setError(null)

    try {
      const data = await apiClient.get(`/customers/${user.customer_id}/devices`)
      const devicesList = data.items || []

      // Map devices with proper zone_location_name from zones data
      const devicesWithZoneNames = devicesList.map((device: any) => {
        const zone = zones.find((z) => z.zone_id === device.zone_id)
        return {
          ...device,
          zone_location_name: zone?.zone_location_name || null,
        }
      })

      setDevices(devicesWithZoneNames)
      setLastUpdated(new Date())

      // Subscribe to MQTT status updates for all devices
      if (mqttService && user.customer_id) {
        devicesWithZoneNames.forEach((device: Device) => {
          try {
            mqttService.subscribeToDeviceStatus(user.customer_id, device.device_id, (status: DeviceStatus) => {
              setDeviceStatusCache((prev) => {
                const newCache = new Map(prev)
                newCache.set(device.device_id, status)
                return newCache
              })

              // Batch status updates to avoid too many re-renders
              setStatusUpdateQueue((prev) => new Set(prev).add(device.device_id))
            })
          } catch (error) {
            console.warn(`Failed to subscribe to device ${device.device_id}:`, error)
          }
        })
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error)
      setError("Failed to load devices")
      showErrorToast(error, "Failed to load devices")
    } finally {
      setLoading(false)
    }
  }, [token, user, zones, mqttService, showErrorToast])

  const fetchZones = useCallback(async () => {
    if (!token || !user) return

    try {
      const data = await apiClient.get(`/customers/${user.customer_id}/zones`)
      setZones(data || [])
    } catch (error) {
      console.error("Failed to fetch zones:", error)
      showErrorToast(error, "Failed to load zones")
    }
  }, [token, user, showErrorToast])

  // Process batched status updates
  useEffect(() => {
    if (statusUpdateQueue.size === 0) return

    const timer = setTimeout(() => {
      const updates = new Map<string, DeviceStatus>()
      statusUpdateQueue.forEach((deviceId) => {
        const status = deviceStatusCache.get(deviceId)
        if (status) {
          updates.set(deviceId, status)
        }
      })

      if (updates.size > 0) {
        updateDeviceStatuses(updates)
      }

      setStatusUpdateQueue(new Set())
    }, 100) // Batch updates every 100ms

    return () => clearTimeout(timer)
  }, [statusUpdateQueue, deviceStatusCache, updateDeviceStatuses])

  const sendCommand = useCallback(
    async (deviceId: string, command: Partial<DeviceStatus>) => {
      try {
        const commandKey = Object.keys(command)[0] as keyof DeviceStatus
        const commandValue = command[commandKey]

        await deviceAPI.sendDeviceCommand(deviceId, {
          command: commandKey === "fan_speed" ? "fanspeed" : (commandKey as any),
          value: commandKey === "power" ? (commandValue ? "on" : "off") : String(commandValue),
        })

        showSuccessToast("Command sent", `Successfully sent ${commandKey} command to device`)
      } catch (error) {
        console.error("Failed to send command:", error)
        showErrorToast(error, "Failed to send command to device")
        throw error
      }
    },
    [showSuccessToast, showErrorToast],
  )

  const sendBatchCommand = useCallback(
    async (deviceIds: string[], command: Partial<DeviceStatus>): Promise<BatchOperationResult> => {
      try {
        const commandKey = Object.keys(command)[0] as keyof DeviceStatus
        const commandValue = command[commandKey]

        const result = await deviceAPI.sendBatchCommand(deviceIds, {
          command: commandKey === "fan_speed" ? "fanspeed" : (commandKey as any),
          value: commandKey === "power" ? (commandValue ? "on" : "off") : String(commandValue),
        })

        if (result.failed.length === 0) {
          showSuccessToast("Batch command successful", `Command sent to ${result.success.length} devices`)
        } else {
          showErrorToast(
            new Error(`${result.failed.length} devices failed`),
            "Some devices failed to receive the command",
          )
        }

        return {
          success: result.success,
          failed: result.failed,
          total: deviceIds.length,
        }
      } catch (error) {
        console.error("Failed to send batch command:", error)
        showErrorToast(error, "Failed to send batch command")
        throw error
      }
    },
    [showSuccessToast, showErrorToast],
  )

  const refreshDeviceStatus = useCallback(
    async (deviceId: string) => {
      try {
        const response = await apiClient.get(`/devices/${deviceId}/status`)
        const status = response.status

        setDevices((prevDevices) =>
          prevDevices.map((device) =>
            device.device_id === deviceId
              ? { ...device, status: { ...status, online: isDeviceOnline(device) } }
              : device,
          ),
        )
      } catch (error) {
        console.error(`Failed to refresh status for device ${deviceId}:`, error)
      }
    },
    [isDeviceOnline],
  )

  const updateDevice = useCallback(
    async (deviceId: string, data: Partial<Device>) => {
      if (!token) return

      try {
        await apiClient.put(`/devices/${deviceId}`, data)
        showSuccessToast("Device updated", "Device information has been successfully updated")
        await fetchDevices()
      } catch (error) {
        console.error("Failed to update device:", error)
        showErrorToast(error, "Failed to update device")
        throw error
      }
    },
    [token, showSuccessToast, showErrorToast, fetchDevices],
  )

  const deleteDevice = useCallback(
    async (deviceId: string) => {
      if (!token) return

      try {
        if (mqttService && user) {
          mqttService.unsubscribeFromDeviceStatus(user.customer_id, deviceId)
        }

        await apiClient.delete(`/devices/${deviceId}`)

        setSelectedDevices((prev) => {
          const newSet = new Set(prev)
          newSet.delete(deviceId)
          return newSet
        })

        // Clear from cache
        setDeviceStatusCache((prev) => {
          const newCache = new Map(prev)
          newCache.delete(deviceId)
          return newCache
        })

        showSuccessToast("Device deleted", "Device has been successfully removed from your account")
        await fetchDevices()
      } catch (error) {
        console.error("Failed to delete device:", error)
        showErrorToast(error, "Failed to delete device")
        throw error
      }
    },
    [token, mqttService, user, showSuccessToast, showErrorToast, fetchDevices],
  )

  const triggerOTA = useCallback(
    async (deviceId: string, firmwareUrl: string, firmwareVersion: string) => {
      if (!mqttService || !user) {
        throw new Error("MQTT service not available")
      }

      try {
        await mqttService.triggerOTA(user.customer_id, deviceId, firmwareUrl, firmwareVersion)
        showSuccessToast("OTA update triggered", "Firmware update has been initiated for the device")
      } catch (error) {
        console.error("Failed to trigger OTA update:", error)
        showErrorToast(error, "Failed to trigger OTA update")
        throw error
      }
    },
    [mqttService, user, showSuccessToast, showErrorToast],
  )

  const createZone = useCallback(
    async (zoneLocationName: string) => {
      if (!token || !user) return

      try {
        await apiClient.post(`/customers/${user.customer_id}/zones`, { zone_location_name: zoneLocationName })
        showSuccessToast("Zone created", `Zone "${zoneLocationName}" has been successfully created`)
        await fetchZones()
      } catch (error) {
        console.error("Failed to create zone:", error)
        showErrorToast(error, "Failed to create zone")
        throw error
      }
    },
    [token, user, showSuccessToast, showErrorToast, fetchZones],
  )

  const updateZone = useCallback(
    async (zoneId: string, zoneLocationName: string) => {
      if (!token) return

      try {
        await apiClient.put(`/zones/${zoneId}`, { zone_location_name: zoneLocationName })
        showSuccessToast("Zone updated", `Zone has been successfully updated to "${zoneLocationName}"`)
        await fetchZones()
        await fetchDevices()
      } catch (error) {
        console.error("Failed to update zone:", error)
        showErrorToast(error, "Failed to update zone")
        throw error
      }
    },
    [token, showSuccessToast, showErrorToast, fetchZones, fetchDevices],
  )

  const deleteZone = useCallback(
    async (zoneId: string) => {
      if (!token) return

      try {
        const zone = zones.find((z) => z.zone_id === zoneId)
        const zoneName = zone?.zone_location_name || "Unknown Zone"

        await apiClient.delete(`/zones/${zoneId}`)

        showSuccessToast("Zone deleted", `Zone "${zoneName}" has been successfully deleted`)
        await fetchZones()
        await fetchDevices()
      } catch (error) {
        console.error("Failed to delete zone:", error)
        showErrorToast(error, "Failed to delete zone")
        throw error
      }
    },
    [token, zones, showSuccessToast, showErrorToast, fetchZones, fetchDevices],
  )

  const fetchDeviceHistory = useCallback(
    async (deviceId: string, page = 1, limit = 50) => {
      if (!token) return

      try {
        return await apiClient.get(`/devices/${deviceId}/status-history`, {
          page: page.toString(),
          page_size: limit.toString(),
        })
      } catch (error) {
        console.error("Failed to fetch device history:", error)
        showErrorToast(error, "Failed to load device history")
        throw error
      }
    },
    [token, showErrorToast],
  )

  const deleteDeviceHistory = useCallback(
    async (deviceId: string) => {
      if (!token) return

      try {
        await apiClient.delete(`/devices/${deviceId}/history`)
        showSuccessToast("History deleted", "Device history has been successfully cleared")
      } catch (error) {
        console.error("Failed to delete device history:", error)
        showErrorToast(error, "Failed to delete device history")
        throw error
      }
    },
    [token, showSuccessToast, showErrorToast],
  )

  // Device selection functions
  const toggleDeviceSelection = useCallback((deviceId: string) => {
    setSelectedDevices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId)
      } else {
        newSet.add(deviceId)
      }
      return newSet
    })
  }, [])

  const selectAllDevices = useCallback(() => {
    setSelectedDevices(new Set(devices.map((d) => d.device_id)))
  }, [devices])

  const clearSelection = useCallback(() => {
    setSelectedDevices(new Set())
  }, [])

  const selectDevicesByZone = useCallback(
    (zoneId: string) => {
      const zoneDevices = devices.filter((d) => d.zone_id === zoneId).map((d) => d.device_id)
      setSelectedDevices(new Set(zoneDevices))
    },
    [devices],
  )

  // Device group functions
  const createDeviceGroup = useCallback(
    (name: string, deviceIds: string[]) => {
      const newGroup: DeviceGroup = {
        id: `group_${Date.now()}`,
        name,
        device_ids: deviceIds,
        created_at: new Date().toISOString(),
      }
      setDeviceGroups((prev) => [...prev, newGroup])

      const groups = [...deviceGroups, newGroup]
      try {
        localStorage.setItem(`device_groups_${user?.customer_id}`, JSON.stringify(groups))
        showSuccessToast("Group created", `Device group "${name}" has been created`)
      } catch (error) {
        console.warn("Failed to save device group:", error)
      }
    },
    [deviceGroups, user?.customer_id, showSuccessToast],
  )

  const deleteDeviceGroup = useCallback(
    (groupId: string) => {
      const group = deviceGroups.find((g) => g.id === groupId)
      setDeviceGroups((prev) => prev.filter((g) => g.id !== groupId))

      const groups = deviceGroups.filter((g) => g.id !== groupId)
      try {
        localStorage.setItem(`device_groups_${user?.customer_id}`, JSON.stringify(groups))
        showSuccessToast("Group deleted", `Device group "${group?.name || "Unknown"}" has been deleted`)
      } catch (error) {
        console.warn("Failed to save device groups:", error)
      }
    },
    [deviceGroups, user?.customer_id, showSuccessToast],
  )

  const selectDeviceGroup = useCallback(
    (groupId: string) => {
      const group = deviceGroups.find((g) => g.id === groupId)
      if (group) {
        setSelectedDevices(new Set(group.device_ids))
      }
    },
    [deviceGroups],
  )

  // Utility functions
  const getDeviceById = useCallback(
    (deviceId: string) => {
      return devices.find((d) => d.device_id === deviceId)
    },
    [devices],
  )

  const getZoneById = useCallback(
    (zoneId: string) => {
      return zones.find((z) => z.zone_id === zoneId)
    },
    [zones],
  )

  useEffect(() => {
    if (user && token) {
      fetchZones().then(() => {
        fetchDevices()
      })

      // Load device groups from localStorage
      const savedGroups = localStorage.getItem(`device_groups_${user.customer_id}`)
      if (savedGroups) {
        try {
          setDeviceGroups(JSON.parse(savedGroups))
        } catch (error) {
          console.error("Failed to load device groups:", error)
        }
      }
    }

    return () => {
      // Cleanup MQTT subscriptions when component unmounts
      if (mqttService && user && devices.length > 0) {
        devices.forEach((device) => {
          mqttService.unsubscribeFromDeviceStatus(user.customer_id, device.device_id)
        })
      }

      // Clear API queues
      deviceAPI.clearAllCommands()
    }
  }, [user, token])

  // Re-subscribe to device statuses when MQTT connects
  useEffect(() => {
    if (mqttConnected && mqttService && user && devices.length > 0) {
      console.log("MQTT connected, subscribing to device statuses...")
      devices.forEach((device) => {
        try {
          mqttService.subscribeToDeviceStatus(user.customer_id, device.device_id, (status: DeviceStatus) => {
            setDeviceStatusCache((prev) => {
              const newCache = new Map(prev)
              newCache.set(device.device_id, status)
              return newCache
            })
            setStatusUpdateQueue((prev) => new Set(prev).add(device.device_id))
          })
        } catch (error) {
          console.warn(`Failed to subscribe to device ${device.device_id}:`, error)
        }
      })
    }
  }, [mqttConnected, mqttService, user, devices.length])

  // Update devices with zone names when zones change
  useEffect(() => {
    if (zones.length > 0 && devices.length > 0) {
      setDevices((prev) =>
        prev.map((device) => {
          const zone = zones.find((z) => z.zone_id === device.zone_id)
          return {
            ...device,
            zone_location_name: zone?.zone_location_name || null,
          }
        }),
      )
    }
  }, [zones])

  return (
    <DeviceContext.Provider
      value={{
        devices,
        zones,
        deviceGroups,
        selectedDevices,
        loading,
        error,
        mqttConnected,
        lastUpdated,
        fetchDevices,
        fetchZones,
        sendCommand,
        sendBatchCommand,
        updateDevice,
        deleteDevice,
        triggerOTA,
        createZone,
        updateZone,
        deleteZone,
        fetchDeviceHistory,
        deleteDeviceHistory,
        toggleDeviceSelection,
        selectAllDevices,
        clearSelection,
        selectDevicesByZone,
        createDeviceGroup,
        deleteDeviceGroup,
        selectDeviceGroup,
        refreshDeviceStatus,
        getDeviceById,
        getZoneById,
      }}
    >
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevices() {
  const context = useContext(DeviceContext)
  if (context === undefined) {
    throw new Error("useDevices must be used within a DeviceProvider")
  }
  return context
}
