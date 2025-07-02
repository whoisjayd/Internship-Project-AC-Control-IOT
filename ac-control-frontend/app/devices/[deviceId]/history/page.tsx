"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ArrowLeft, History, Trash2, Search, Download, Power, Thermometer, Wind, Calendar } from "lucide-react"

interface StatusHistoryItem {
  id: string
  device_id: string
  power: boolean
  mode: "auto" | "cool" | "heat" | "dry" | "fan"
  temperature: number
  fan_speed: "auto" | "low" | "medium" | "high"
  timestamp: string
}

export default function DeviceHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.deviceId as string
  const { devices, fetchDeviceHistory, deleteDeviceHistory } = useDevices()
  const { toast } = useToast()

  const [history, setHistory] = useState<StatusHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [powerFilter, setPowerFilter] = useState("all")
  const [modeFilter, setModeFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const device = devices.find((d) => d.device_id === deviceId)

  useEffect(() => {
    loadHistory()
  }, [deviceId, currentPage])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await fetchDeviceHistory(deviceId, currentPage, 50)
      setHistory(data.history || [])
      setTotalPages(Math.ceil((data.total || 0) / 50))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load device history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAllHistory = async () => {
    if (!confirm("Are you sure you want to delete all history for this device? This action cannot be undone.")) {
      return
    }

    try {
      await deleteDeviceHistory(deviceId)
      toast({
        title: "History deleted",
        description: "All device history has been deleted",
      })
      setHistory([])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device history",
        variant: "destructive",
      })
    }
  }

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.mode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.timestamp.includes(searchTerm)

    const matchesPower =
      powerFilter === "all" || (powerFilter === "on" && item.power) || (powerFilter === "off" && !item.power)

    const matchesMode = modeFilter === "all" || item.mode === modeFilter

    return matchesSearch && matchesPower && matchesMode
  })

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "cool":
        return "❄️"
      case "heat":
        return "🔥"
      case "dry":
        return "💨"
      case "fan":
        return "🌪️"
      default:
        return "🔄"
    }
  }

  const exportHistory = () => {
    const csvContent = [
      ["Timestamp", "Power", "Mode", "Temperature", "Fan Speed"],
      ...filteredHistory.map((item) => [
        item.timestamp,
        item.power ? "ON" : "OFF",
        item.mode,
        `${item.temperature}°C`,
        item.fan_speed,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `device-${deviceId}-history.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading && history.length === 0) {
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
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <History className="h-8 w-8" />
              Device History
            </h1>
            <p className="text-gray-600">Status history for device: {device?.device_id || deviceId}</p>
          </div>
        </div>

        {/* Device Info */}
        {device && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Device ID</p>
                  <p className="font-medium">{device.device_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Zone</p>
                  <p className="font-medium">{device.zone_name || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Brand</p>
                  <p className="font-medium">{device.ac_brand_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Firmware</p>
                  <p className="font-medium">{device.firmware_version}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={powerFilter} onValueChange={setPowerFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Power</SelectItem>
                  <SelectItem value="on">ON</SelectItem>
                  <SelectItem value="off">OFF</SelectItem>
                </SelectContent>
              </Select>

              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="cool">Cool</SelectItem>
                  <SelectItem value="heat">Heat</SelectItem>
                  <SelectItem value="dry">Dry</SelectItem>
                  <SelectItem value="fan">Fan</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={exportHistory}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Button variant="destructive" onClick={handleDeleteAllHistory}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History List */}
        <Card>
          <CardHeader>
            <CardTitle>Status History ({filteredHistory.length} records)</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No history found</h3>
                <p className="text-gray-600">
                  {history.length === 0
                    ? "This device has no recorded status history yet."
                    : "No records match your current filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{formatTimestamp(item.timestamp)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Power className="h-4 w-4" />
                        <Badge variant={item.power ? "default" : "secondary"}>{item.power ? "ON" : "OFF"}</Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getModeIcon(item.mode)}</span>
                        <span className="text-sm font-medium capitalize">{item.mode}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4" />
                        <span className="text-sm">{item.temperature}°C</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4" />
                        <span className="text-sm capitalize">{item.fan_speed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
