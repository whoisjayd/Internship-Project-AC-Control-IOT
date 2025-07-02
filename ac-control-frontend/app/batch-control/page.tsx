"use client"

import { useState, useMemo, useCallback } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard"
import { BatchControlSkeleton } from "@/components/ui/batch-control-skeleton"
import { deviceAPI, type DeviceCommand } from "@/lib/device-api"
import {
  Settings,
  Power,
  Thermometer,
  Wind,
  CheckSquare,
  Square,
  MapPin,
  Search,
  Wifi,
  WifiOff,
  Users,
  Filter,
  Play,
  AlertTriangle,
  X,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"

interface BatchOperation {
  id: string
  type: "single" | "batch"
  command: string
  value: any
  deviceIds: string[]
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  results?: {
    success: string[]
    failed: { deviceId: string; error: string }[]
  }
  startTime: Date
  endTime?: Date
}

export default function BatchControlPage() {
  const {
    devices,
    zones,
    selectedDevices,
    loading: devicesLoading,
    mqttConnected,
    toggleDeviceSelection,
    selectAllDevices,
    clearSelection,
    selectDevicesByZone,
  } = useDevices()

  const { toast } = useToast()

  // UI State
  const [searchTerm, setSearchTerm] = useState("")
  const [filterZone, setFilterZone] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showOfflineDevices, setShowOfflineDevices] = useState(true)

  // Batch Settings
  const [batchSettings, setBatchSettings] = useState({
    power: false,
    mode: "auto" as "auto" | "cool" | "heat" | "dry" | "fan",
    temperature: 24,
    fan_speed: "auto" as "auto" | "low" | "medium" | "high",
  })

  // Operation Management
  const [operations, setOperations] = useState<BatchOperation[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [showOperationHistory, setShowOperationHistory] = useState(false)

  // Memoized filtered devices for performance
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        !searchTerm ||
        device.device_id.toLowerCase().includes(searchLower) ||
        device.ac_brand_name.toLowerCase().includes(searchLower) ||
        (device.zone_location_name && device.zone_location_name.toLowerCase().includes(searchLower))

      // Zone filter
      const matchesZone = filterZone === "all" || device.zone_id === filterZone

      // Status filter
      const isOnline = device.status?.online ?? false
      const isPowered = device.status?.power ?? false

      let matchesStatus = true
      switch (filterStatus) {
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

      // Show offline devices filter
      if (!showOfflineDevices && !isOnline) {
        return false
      }

      return matchesSearch && matchesZone && matchesStatus
    })
  }, [devices, searchTerm, filterZone, filterStatus, showOfflineDevices])

  // Memoized device statistics
  const deviceStats = useMemo(() => {
    const selectedList = devices.filter((d) => selectedDevices.has(d.device_id))
    const onlineSelected = selectedList.filter((d) => d.status?.online)
    const offlineSelected = selectedList.filter((d) => !d.status?.online)
    const activeSelected = selectedList.filter((d) => d.status?.online && d.status?.power)

    return {
      total: devices.length,
      filtered: filteredDevices.length,
      selected: selectedDevices.size,
      onlineSelected: onlineSelected.length,
      offlineSelected: offlineSelected.length,
      activeSelected: activeSelected.length,
      onlineTotal: devices.filter((d) => d.status?.online).length,
      offlineTotal: devices.filter((d) => !d.status?.online).length,
    }
  }, [devices, filteredDevices, selectedDevices])

  // Quick selection handlers
  const handleSelectAllFiltered = useCallback(() => {
    const allFilteredSelected = filteredDevices.every((device) => selectedDevices.has(device.device_id))

    if (allFilteredSelected) {
      // Deselect all filtered devices
      filteredDevices.forEach((device) => {
        if (selectedDevices.has(device.device_id)) {
          toggleDeviceSelection(device.device_id)
        }
      })
    } else {
      // Select all filtered devices
      filteredDevices.forEach((device) => {
        if (!selectedDevices.has(device.device_id)) {
          toggleDeviceSelection(device.device_id)
        }
      })
    }
  }, [filteredDevices, selectedDevices, toggleDeviceSelection])

  const handleSelectOnlineOnly = useCallback(() => {
    clearSelection()
    filteredDevices
      .filter((device) => device.status?.online)
      .forEach((device) => toggleDeviceSelection(device.device_id))
  }, [filteredDevices, clearSelection, toggleDeviceSelection])

  // Command execution
  const executeCommand = useCallback(
    async (command: string, value: any, deviceIds: string[] = []) => {
      const targetDevices = deviceIds.length > 0 ? deviceIds : Array.from(selectedDevices)
      const onlineDevices = devices
        .filter((d) => targetDevices.includes(d.device_id) && d.status?.online)
        .map((d) => d.device_id)

      if (onlineDevices.length === 0) {
        toast({
          title: "No online devices",
          description: "No online devices selected for command execution",
          variant: "destructive",
        })
        return
      }

      if (!mqttConnected) {
        toast({
          title: "MQTT Disconnected",
          description: "Cannot send commands without MQTT connection",
          variant: "destructive",
        })
        return
      }

      const operation: BatchOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: onlineDevices.length === 1 ? "single" : "batch",
        command,
        value,
        deviceIds: onlineDevices,
        status: "pending",
        progress: 0,
        startTime: new Date(),
      }

      setOperations((prev) => [operation, ...prev.slice(0, 9)]) // Keep last 10 operations
      setIsExecuting(true)

      try {
        // Update operation status
        setOperations((prev) => prev.map((op) => (op.id === operation.id ? { ...op, status: "running" as const } : op)))

        // Map command names to API format
        const apiCommand: DeviceCommand = {
          command: command === "fan_speed" ? "fanspeed" : (command as any),
          value: command === "power" ? (value ? "on" : "off") : String(value),
        }

        const result = await deviceAPI.sendBatchCommand(onlineDevices, apiCommand)

        // Update operation with results
        setOperations((prev) =>
          prev.map((op) =>
            op.id === operation.id
              ? {
                  ...op,
                  status: result.failed.length === 0 ? ("completed" as const) : ("failed" as const),
                  progress: 100,
                  results: result,
                  endTime: new Date(),
                }
              : op,
          ),
        )

        // Show result toast
        if (result.failed.length === 0) {
          toast({
            title: "Command executed successfully",
            description: `${command} applied to ${result.success.length} device(s)`,
          })
        } else {
          toast({
            title: "Command partially failed",
            description: `${result.success.length} succeeded, ${result.failed.length} failed`,
            variant: "destructive",
          })
        }
      } catch (error: any) {
        console.error("Command execution failed:", error)

        setOperations((prev) =>
          prev.map((op) =>
            op.id === operation.id
              ? {
                  ...op,
                  status: "failed" as const,
                  progress: 0,
                  endTime: new Date(),
                }
              : op,
          ),
        )

        toast({
          title: "Command failed",
          description: error.message || "Failed to execute command",
          variant: "destructive",
        })
      } finally {
        setIsExecuting(false)
      }
    },
    [selectedDevices, devices, mqttConnected, toast],
  )

  // Batch settings handlers
  const handlePowerToggle = useCallback(
    (power: boolean) => {
      setBatchSettings((prev) => ({ ...prev, power }))
      executeCommand("power", power)
    },
    [executeCommand],
  )

  const handleModeChange = useCallback(
    (mode: string) => {
      setBatchSettings((prev) => ({ ...prev, mode: mode as any }))
      executeCommand("mode", mode)
    },
    [executeCommand],
  )

  const handleTemperatureChange = useCallback(
    (temperature: number[]) => {
      setBatchSettings((prev) => ({ ...prev, temperature: temperature[0] }))
      executeCommand("temperature", temperature[0])
    },
    [executeCommand],
  )

  const handleFanSpeedChange = useCallback(
    (fanSpeed: string) => {
      setBatchSettings((prev) => ({ ...prev, fan_speed: fanSpeed as any }))
      executeCommand("fanspeed", fanSpeed)
    },
    [executeCommand],
  )

  const handleExecuteAllSettings = useCallback(async () => {
    const commands = [
      { command: "power", value: batchSettings.power },
      ...(batchSettings.power
        ? [
            { command: "mode", value: batchSettings.mode },
            { command: "temperature", value: batchSettings.temperature },
            { command: "fanspeed", value: batchSettings.fan_speed },
          ]
        : []),
    ]

    for (const { command, value } of commands) {
      await executeCommand(command, value)
      // Small delay between commands
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }, [batchSettings, executeCommand])

  // Loading state
  if (devicesLoading) {
    return (
      <MainLayout>
        <BatchControlSkeleton />
      </MainLayout>
    )
  }

  const allFilteredSelected =
    filteredDevices.length > 0 && filteredDevices.every((device) => selectedDevices.has(device.device_id))
  const someFilteredSelected = filteredDevices.some((device) => selectedDevices.has(device.device_id))

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Settings className="h-6 w-6 sm:h-8 sm:w-8" />
                Batch Control
              </h1>
              <p className="text-muted-foreground mt-1">
                Control multiple devices simultaneously • {deviceStats.total} total devices
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOperationHistory(!showOperationHistory)}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                History ({operations.length})
              </Button>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${mqttConnected ? "bg-success-light border border-success" : "bg-error-light border border-error"} animate-pulse`}
                />
                <span className="text-sm text-muted-foreground">{mqttConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MQTT Status Warning */}
        {!mqttConnected && (
          <Alert variant="destructive" className="animate-slide-up animate-delay-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              MQTT connection required for device control. Please check your network connection.
            </AlertDescription>
          </Alert>
        )}

        {/* Operation History */}
        {showOperationHistory && operations.length > 0 && (
          <Card className="animate-slide-up animate-delay-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Operations
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowOperationHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {operations.map((operation) => (
                  <div key={operation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {operation.status === "completed" && <CheckCircle className="h-4 w-4 icon-success" />}
                        {operation.status === "failed" && <XCircle className="h-4 w-4 icon-error" />}
                        {operation.status === "running" && <LoadingSpinner size="sm" />}
                        {operation.status === "pending" && <Clock className="h-4 w-4 icon-warning" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {operation.command} = {String(operation.value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {operation.deviceIds.length} devices • {operation.startTime.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {operation.results && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-success">
                            {operation.results.success.length} ✓
                          </Badge>
                          {operation.results.failed.length > 0 && (
                            <Badge variant="outline" className="text-error">
                              {operation.results.failed.length} ✗
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Selection Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card
              className="glass-card hover-lift transition-smooth animate-slide-up animate-delay-300"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Device Selection
                    {selectedDevices.size > 0 && <Badge variant="secondary">{selectedDevices.size} selected</Badge>}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search devices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={filterZone} onValueChange={setFilterZone}>
                    <SelectTrigger>
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

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="active">Active (ON)</SelectItem>
                      <SelectItem value="inactive">Inactive (OFF)</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="show-offline" checked={showOfflineDevices} onCheckedChange={setShowOfflineDevices} />
                    <label htmlFor="show-offline" className="text-sm">
                      Show offline
                    </label>
                  </div>
                </div>

                {/* Quick Selection */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFiltered}
                    className="flex items-center gap-1"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : someFilteredSelected ? (
                      <Square className="h-4 w-4 opacity-50" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {allFilteredSelected ? "Deselect Filtered" : "Select Filtered"} ({filteredDevices.length})
                  </Button>

                  <Button variant="outline" size="sm" onClick={handleSelectOnlineOnly}>
                    <Wifi className="h-4 w-4 mr-1" />
                    Online Only ({deviceStats.onlineTotal})
                  </Button>

                  <Button variant="outline" size="sm" onClick={selectAllDevices}>
                    Select All ({deviceStats.total})
                  </Button>

                  {zones.map((zone) => {
                    const zoneDeviceCount = filteredDevices.filter((d) => d.zone_id === zone.zone_id).length
                    if (zoneDeviceCount === 0) return null

                    return (
                      <Button
                        key={zone.zone_id}
                        variant="outline"
                        size="sm"
                        onClick={() => selectDevicesByZone(zone.zone_id)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        {zone.zone_location_name} ({zoneDeviceCount})
                      </Button>
                    )
                  })}
                </div>

                <Separator />

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-info-light rounded-lg">
                    <p className="text-lg font-bold text-info">{deviceStats.filtered}</p>
                    <p className="text-xs text-info-dark">Filtered</p>
                  </div>
                  <div className="p-3 bg-success-light rounded-lg">
                    <p className="text-lg font-bold text-success">{deviceStats.onlineSelected}</p>
                    <p className="text-xs text-success-dark">Online Selected</p>
                  </div>
                  <div className="p-3 bg-error-light rounded-lg">
                    <p className="text-lg font-bold text-error">{deviceStats.offlineSelected}</p>
                    <p className="text-xs text-error-dark">Offline Selected</p>
                  </div>
                  <div className="p-3 bg-warning-light rounded-lg">
                    <p className="text-lg font-bold text-warning">{deviceStats.activeSelected}</p>
                    <p className="text-xs text-warning-dark">Active Selected</p>
                  </div>
                </div>

                {/* Device List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredDevices.length === 0 ? (
                    <div className="text-center py-8">
                      <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No devices match the current filters</p>
                      {!showOfflineDevices && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Try enabling "Show offline" to see more devices
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredDevices.map((device) => {
                      const isOnline = device.status?.online ?? false
                      const isPowered = device.status?.power ?? false
                      const lastSeen = device.last_seen ? new Date(device.last_seen) : null
                      const timeSinceLastSeen = lastSeen
                        ? Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60))
                        : null

                      return (
                        <div
                          key={device.device_id}
                          className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                            !isOnline ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedDevices.has(device.device_id)}
                              onCheckedChange={() => toggleDeviceSelection(device.device_id)}
                            />
                            <div className="flex items-center gap-2">
                              {isOnline ? (
                                <Wifi className="h-4 w-4 icon-success" />
                              ) : (
                                <WifiOff className="h-4 w-4 icon-error" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{device.device_id}</p>
                                  <CopyToClipboard text={device.device_id} variant="inline" showIcon />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{device.zone_location_name || "Unknown Zone"}</span>
                                  <span>•</span>
                                  <span>{device.ac_brand_name}</span>
                                  {timeSinceLastSeen !== null && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        {timeSinceLastSeen < 1
                                          ? "Just now"
                                          : timeSinceLastSeen < 60
                                            ? `${timeSinceLastSeen}m ago`
                                            : timeSinceLastSeen < 1440
                                              ? `${Math.floor(timeSinceLastSeen / 60)}h ago`
                                              : `${Math.floor(timeSinceLastSeen / 1440)}d ago`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={isPowered ? "default" : "secondary"}>
                              <Power className="h-3 w-3 mr-1" />
                              {isPowered ? "ON" : "OFF"}
                            </Badge>
                            {device.status?.temperature && (
                              <Badge variant="outline">{device.status.temperature}°C</Badge>
                            )}
                            {!isOnline && (
                              <Badge variant="destructive" className="text-xs">
                                Offline
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Batch Control Panel */}
          <div className="space-y-6">
            {/* Selection Summary */}
            <Card
              className="glass-card hover-lift transition-smooth animate-slide-up animate-delay-400"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Selection Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-success-light rounded-lg">
                    <p className="text-2xl font-bold text-success">{deviceStats.onlineSelected}</p>
                    <p className="text-xs text-success-dark">Online</p>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-error">{deviceStats.offlineSelected}</p>
                    <p className="text-xs text-error-dark">Offline</p>
                  </div>
                </div>

                {deviceStats.onlineSelected > 0 && (
                  <div className="text-center p-2 bg-blue-500/10 rounded-lg">
                    <p className="text-sm font-medium text-info">
                      Ready to control {deviceStats.onlineSelected} device{deviceStats.onlineSelected !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                {!mqttConnected && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">MQTT connection required for device control</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Batch Controls */}
            <Card
              className="glass-card hover-lift transition-smooth animate-slide-up animate-delay-500"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Batch Controls
                  {isExecuting && <LoadingSpinner size="sm" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Power Control */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Power className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Power Control</p>
                      <p className="text-sm text-muted-foreground">Turn devices on/off</p>
                    </div>
                  </div>
                  <Switch
                    checked={batchSettings.power}
                    onCheckedChange={handlePowerToggle}
                    disabled={isExecuting || !mqttConnected || deviceStats.onlineSelected === 0}
                  />
                </div>

                {/* Mode Control */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <label className="font-medium">Operating Mode</label>
                  </div>
                  <Select
                    value={batchSettings.mode}
                    onValueChange={handleModeChange}
                    disabled={isExecuting || !mqttConnected || deviceStats.onlineSelected === 0}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔄 Auto</SelectItem>
                      <SelectItem value="cool">❄️ Cool</SelectItem>
                      <SelectItem value="heat">🔥 Heat</SelectItem>
                      <SelectItem value="dry">💨 Dry</SelectItem>
                      <SelectItem value="fan">🌪️ Fan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5" />
                      <label className="font-medium">Temperature</label>
                    </div>
                    <span className="text-sm font-medium">{batchSettings.temperature}°C</span>
                  </div>
                  <Slider
                    value={[batchSettings.temperature]}
                    onValueChange={handleTemperatureChange}
                    min={16}
                    max={30}
                    step={1}
                    disabled={isExecuting || !mqttConnected || deviceStats.onlineSelected === 0}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>16°C</span>
                    <span>23°C</span>
                    <span>30°C</span>
                  </div>
                </div>

                {/* Fan Speed Control */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Wind className="h-5 w-5" />
                    <label className="font-medium">Fan Speed</label>
                  </div>
                  <Select
                    value={batchSettings.fan_speed}
                    onValueChange={handleFanSpeedChange}
                    disabled={isExecuting || !mqttConnected || deviceStats.onlineSelected === 0}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔄 Auto</SelectItem>
                      <SelectItem value="low">🌬️ Low</SelectItem>
                      <SelectItem value="medium">💨 Medium</SelectItem>
                      <SelectItem value="high">🌪️ High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Execute All Button */}
                <Button
                  onClick={handleExecuteAllSettings}
                  disabled={isExecuting || !mqttConnected || deviceStats.onlineSelected === 0}
                  className="w-full transition-smooth hover-lift"
                  size="lg"
                >
                  {isExecuting ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Apply All Settings ({deviceStats.onlineSelected} devices)
                    </>
                  )}
                </Button>

                {deviceStats.offlineSelected > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {deviceStats.offlineSelected} selected device{deviceStats.offlineSelected !== 1 ? "s are" : " is"}{" "}
                      offline and won't receive commands
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
