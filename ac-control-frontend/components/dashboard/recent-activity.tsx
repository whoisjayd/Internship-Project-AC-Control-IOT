"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDevices } from "@/contexts/device-context"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"
import { Activity, Clock, Thermometer, Power, Wind, AlertCircle } from "lucide-react"

interface ActivityItem {
  id: string
  device_id: string
  action: string
  timestamp: string
  details?: any
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const { devices } = useDevices()
  const { user, token } = useAuth()

  useEffect(() => {
    const fetchRecentActivity = async () => {
      if (!token || !user) return

      try {
        setLoading(true)
        // Fetch recent device history for all devices
        const deviceActivities: ActivityItem[] = []

        for (const device of devices.slice(0, 5)) {
          // Limit to first 5 devices to avoid too many API calls
          try {
            const history = await apiClient.get(`/devices/${device.device_id}/status-history`, {
              page: "1",
              page_size: "5",
            })

            if (history?.items) {
              const deviceHistory = history.items.map((item: any) => ({
                id: `${device.device_id}-${item.timestamp}`,
                device_id: device.device_id,
                action: determineAction(item),
                timestamp: item.timestamp,
                details: item,
              }))

              deviceActivities.push(...deviceHistory)
            }
          } catch (error) {
            console.error(`Failed to fetch history for device ${device.device_id}:`, error)
          }
        }

        // Sort by timestamp (most recent first) and limit to 10 items
        const sortedActivities = deviceActivities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)

        setActivities(sortedActivities)
      } catch (error) {
        console.error("Failed to fetch recent activity:", error)
      } finally {
        setLoading(false)
      }
    }

    if (devices.length > 0) {
      fetchRecentActivity()
    }
  }, [devices, token, user])

  const determineAction = (historyItem: any): string => {
    if (historyItem.power !== undefined) {
      return historyItem.power ? "Device turned ON" : "Device turned OFF"
    }
    if (historyItem.mode) {
      return `Mode changed to ${historyItem.mode.toUpperCase()}`
    }
    if (historyItem.temperature) {
      return `Temperature set to ${historyItem.temperature}°C`
    }
    if (historyItem.fan_speed) {
      return `Fan speed changed to ${historyItem.fan_speed.toUpperCase()}`
    }
    return "Status updated"
  }

  const getActionIcon = (action: string) => {
    if (action.includes("turned ON") || action.includes("turned OFF")) {
      return <Power className="h-4 w-4" />
    }
    if (action.includes("Mode changed")) {
      return <Activity className="h-4 w-4" />
    }
    if (action.includes("Temperature")) {
      return <Thermometer className="h-4 w-4" />
    }
    if (action.includes("Fan speed")) {
      return <Wind className="h-4 w-4" />
    }
    return <AlertCircle className="h-4 w-4" />
  }

  const getActionColor = (action: string) => {
    if (action.includes("turned ON")) return "default"
    if (action.includes("turned OFF")) return "secondary"
    if (action.includes("Mode changed")) return "outline"
    if (action.includes("Temperature")) return "outline"
    if (action.includes("Fan speed")) return "outline"
    return "secondary"
  }

  const getDeviceName = (deviceId: string) => {
    const device = devices.find((d) => d.device_id === deviceId)
    return device ? `${deviceId} (${device.zone_location_name || "Unknown Zone"})` : deviceId
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">Device actions will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getActionColor(activity.action)} className="text-xs">
                        {activity.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground truncate">{getDeviceName(activity.device_id)}</p>
                    <p className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
