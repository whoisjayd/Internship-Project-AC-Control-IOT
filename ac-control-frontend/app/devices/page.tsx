"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { DeviceCard } from "@/components/ui/device-card"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDevices } from "@/contexts/device-context"
import { Search, Thermometer, RefreshCw, Filter, Grid, List } from "lucide-react"

export default function DevicesPage() {
  const { devices, zones, loading, fetchDevices } = useDevices()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedZone, setSelectedZone] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [refreshing, setRefreshing] = useState(false)

  // Handle zone filter from URL params
  useEffect(() => {
    const zoneParam = searchParams.get("zone")
    if (zoneParam) {
      setSelectedZone(zoneParam)
    }
  }, [searchParams])

  // Memoized filtered devices for performance
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesSearch =
        device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.ac_brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.zone_location_name && device.zone_location_name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesZone = selectedZone === "all" || device.zone_id === selectedZone

      const isOnline = device.status?.online ?? false
      const isPowered = device.status?.power ?? false

      let matchesStatus = true
      switch (statusFilter) {
        case "online":
          matchesStatus = isOnline
          break
        case "offline":
          matchesStatus = !isOnline
          break
        case "active":
          matchesStatus = isOnline && isPowered
          break
        case "inactive":
          matchesStatus = isOnline && !isPowered
          break
      }

      return matchesSearch && matchesZone && matchesStatus
    })
  }, [devices, searchTerm, selectedZone, statusFilter])

  // Device statistics
  const deviceStats = useMemo(() => {
    const total = devices.length
    const online = devices.filter((d) => d.status?.online).length
    const active = devices.filter((d) => d.status?.online && d.status?.power).length
    const offline = total - online

    return { total, online, active, offline, filtered: filteredDevices.length }
  }, [devices, filteredDevices])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchDevices()
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
            </div>
            <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
            <div className="h-10 w-48 bg-muted animate-pulse rounded" />
            <div className="h-10 w-48 bg-muted animate-pulse rounded" />
          </div>

          <PageSkeleton type="devices" gridCols={3} />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Devices</h1>
            <p className="text-muted-foreground">Manage and monitor all your AC devices • {deviceStats.total} total</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-info-light rounded-lg border border-info">
            <p className="text-2xl font-bold text-info">{deviceStats.total}</p>
            <p className="text-sm text-info-dark">Total Devices</p>
          </div>
          <div className="p-4 bg-success-light rounded-lg border border-success">
            <p className="text-2xl font-bold text-success">{deviceStats.online}</p>
            <p className="text-sm text-success-dark">Online</p>
          </div>
          <div className="p-4 bg-warning-light rounded-lg border border-warning">
            <p className="text-2xl font-bold text-warning">{deviceStats.active}</p>
            <p className="text-sm text-warning-dark">Active</p>
          </div>
          <div className="p-4 bg-error-light rounded-lg border border-error">
            <p className="text-2xl font-bold text-error">{deviceStats.offline}</p>
            <p className="text-sm text-error-dark">Offline</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices by ID, brand, or zone..."
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
                  {zone.zone_location_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredDevices.length} of {devices.length} devices
            </p>
            {(searchTerm || selectedZone !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("")
                  setSelectedZone("all")
                  setStatusFilter("all")
                }}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          {filteredDevices.length > 0 && (
            <Badge variant="outline">{filteredDevices.filter((d) => d.status?.online).length} online</Badge>
          )}
        </div>

        {/* Devices Grid/List */}
        {filteredDevices.length === 0 ? (
          <div className="text-center py-12">
            <Thermometer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {devices.length === 0 ? "No devices found" : "No devices match your filters"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {devices.length === 0
                ? "Devices will appear here automatically once they are configured and connect to the system."
                : "Try adjusting your search or filter criteria to find the devices you're looking for."}
            </p>
            {(searchTerm || selectedZone !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setSelectedZone("all")
                  setStatusFilter("all")
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredDevices.map((device) => (
              <DeviceCard key={device.device_id} device={device} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
