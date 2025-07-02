"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDevices } from "@/contexts/device-context"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { History, Search, Thermometer, Calendar, TrendingUp, Activity, BarChart3 } from "lucide-react"

export default function HistoryPage() {
  const { devices, zones, loading } = useDevices()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedZone, setSelectedZone] = useState("all")
  const router = useRouter()

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ac_brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.zone_name && device.zone_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesZone = selectedZone === "all" || device.zone_id === selectedZone

    return matchesSearch && matchesZone
  })

  const handleViewDeviceHistory = (deviceId: string) => {
    router.push(`/devices/${deviceId}/history`)
  }

  const getLastSeenStatus = (lastSeen: string) => {
    if (!lastSeen) return "Never"
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 5) return "Online"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-8 w-8" />
            Device History
          </h1>
          <p className="text-gray-600">View and analyze historical data for all your devices</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Devices</p>
                  <p className="text-3xl font-bold text-gray-900">{devices.length}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <Thermometer className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Today</p>
                  <p className="text-3xl font-bold text-gray-900">{devices.filter((d) => d.status?.power).length}</p>
                </div>
                <div className="p-3 rounded-full bg-success-light">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Temperature</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {devices.length > 0
                      ? Math.round(
                          devices.reduce((sum, device) => sum + (device.status?.temperature || 24), 0) / devices.length,
                        )
                      : 24}
                    °C
                  </p>
                </div>
                <div className="p-3 rounded-full bg-orange-100">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Zones</p>
                  <p className="text-3xl font-bold text-gray-900">{zones.length}</p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.zone_id} value={zone.zone_id}>
                      {zone.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Device List */}
        <Card>
          <CardHeader>
            <CardTitle>Device History Access ({filteredDevices.length} devices)</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredDevices.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
                <p className="text-gray-600">
                  {devices.length === 0
                    ? "No devices are available for history viewing."
                    : "No devices match your current filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{device.device_id}</p>
                          <p className="text-sm text-gray-600">
                            {device.zone_name || "Unknown Zone"} • {device.ac_brand_name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{device.status?.power ? "Active" : "Inactive"}</p>
                        <p className="text-sm text-gray-600">Last seen: {getLastSeenStatus(device.last_seen)}</p>
                      </div>

                      <Badge variant={device.status?.power ? "default" : "secondary"}>
                        {device.status?.temperature || 24}°C
                      </Badge>

                      <Button variant="outline" size="sm" onClick={() => handleViewDeviceHistory(device.device_id)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        View History
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
