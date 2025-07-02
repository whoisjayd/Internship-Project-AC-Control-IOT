"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { EditDeviceModal } from "@/components/modals/edit-device-modal"
import { DeleteDeviceModal } from "@/components/modals/delete-device-modal"
import { OTAUpdateModal } from "@/components/modals/ota-update-modal"
import { Thermometer, Power, Wind, Settings, History, Trash2, Wifi, WifiOff, Download, Zap, MapPin } from "lucide-react"

interface Device {
  device_id: string
  zone_id: string
  zone_location_name?: string
  ac_brand_name: string
  ac_brand_protocol: string
  firmware_version: string
  last_seen: string
  status?: {
    power: boolean
    mode: "auto" | "cool" | "heat" | "dry" | "fan"
    temperature: number
    fan_speed: "auto" | "low" | "medium" | "high"
    online: boolean
    timestamp: string
  }
}

interface DeviceCardProps {
  device: Device
}

export function DeviceCard({ device }: DeviceCardProps) {
  const [isControlling, setIsControlling] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [otaModalOpen, setOtaModalOpen] = useState(false)
  const { sendCommand, mqttConnected } = useDevices()
  const { toast } = useToast()
  const router = useRouter()

  const isOnline = device.status?.online ?? false
  const canControl = mqttConnected && isOnline && !isControlling

  const handlePowerToggle = async (power: boolean) => {
    setIsControlling(true)
    try {
      await sendCommand(device.device_id, { power })
      toast({
        title: "Command sent",
        description: `Device ${power ? "turned on" : "turned off"}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send command. Check MQTT connection.",
        variant: "destructive",
      })
    } finally {
      setIsControlling(false)
    }
  }

  const handleModeChange = async (mode: string) => {
    setIsControlling(true)
    try {
      await sendCommand(device.device_id, {
        mode: mode as "auto" | "cool" | "heat" | "dry" | "fan",
      })
      toast({
        title: "Command sent",
        description: `Mode changed to ${mode}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send command. Check MQTT connection.",
        variant: "destructive",
      })
    } finally {
      setIsControlling(false)
    }
  }

  const handleTemperatureChange = async (temperature: number[]) => {
    setIsControlling(true)
    try {
      await sendCommand(device.device_id, { temperature: temperature[0] })
      toast({
        title: "Command sent",
        description: `Temperature set to ${temperature[0]}°C`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send command. Check MQTT connection.",
        variant: "destructive",
      })
    } finally {
      setIsControlling(false)
    }
  }

  const handleFanSpeedChange = async (fanSpeed: string) => {
    setIsControlling(true)
    try {
      await sendCommand(device.device_id, {
        fan_speed: fanSpeed as "auto" | "low" | "medium" | "high",
      })
      toast({
        title: "Command sent",
        description: `Fan speed changed to ${fanSpeed}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send command. Check MQTT connection.",
        variant: "destructive",
      })
    } finally {
      setIsControlling(false)
    }
  }

  const handleViewHistory = () => {
    router.push(`/devices/${device.device_id}/history`)
  }

  const getStatusBadge = () => {
    if (!mqttConnected) {
      return <Badge className="status-warning">MQTT Disconnected</Badge>
    }
    const isOnline = device.status?.online ?? false
    if (!isOnline) {
      return <Badge className="status-offline">Offline</Badge>
    }
    const isPowered = device.status?.power ?? false
    return (
      <Badge className={isPowered ? "status-online" : "bg-muted text-muted-foreground"}>
        {isPowered ? "ON" : "OFF"}
      </Badge>
    )
  }

  return (
    <>
      <Card className="glass-card hover-lift transition-smooth animate-fade-in group">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <Thermometer className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">{device.device_id}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {device.zone_location_name || "No Zone Assigned"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mqttConnected ? (
                isOnline ? (
                  <Wifi className="h-4 w-4 icon-success" />
                ) : (
                  <WifiOff className="h-4 w-4 icon-error" />
                )
              ) : (
                <Zap className="h-4 w-4 icon-warning animate-pulse" />
              )}
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Device Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-surface/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Brand</p>
              <p className="text-sm font-medium text-foreground">{device.ac_brand_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Firmware</p>
              <p className="text-sm font-medium text-foreground">{device.firmware_version}</p>
            </div>
          </div>

          {/* Status Info */}
          {device.status?.timestamp ? (
            <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground">
                Last update: {new Date(device.status.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ) : (
            <div className="text-center p-3 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
              <p className="text-sm text-muted-foreground">Status: Data Not Available</p>
            </div>
          )}

          {/* MQTT Warning */}
          {!mqttConnected && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2 text-warning">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">MQTT connection required for control</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-4">
            {/* Power Control */}
            <div className="flex items-center justify-between p-4 bg-surface/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    device.status?.power ? "bg-success-light" : "bg-muted/50"
                  }`}
                >
                  <Power className={`h-4 w-4 ${device.status?.power ? "icon-success" : "text-muted-foreground"}`} />
                </div>
                <span className="text-sm font-medium text-foreground">Power</span>
              </div>
              <Switch
                checked={device.status?.power || false}
                onCheckedChange={handlePowerToggle}
                disabled={!canControl}
                className="transition-smooth"
              />
            </div>

            {/* Mode Control */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Mode
              </label>
              <Select
                value={device.status?.mode || "auto"}
                onValueChange={handleModeChange}
                disabled={!canControl || !device.status?.power}
              >
                <SelectTrigger className="transition-smooth focus-ring">
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-primary" />
                  Temperature
                </label>
                <div className="px-3 py-1 bg-primary/10 rounded-full">
                  <span className="text-sm font-bold text-primary">
                    {device.status?.temperature ? `${device.status.temperature}°C` : "N/A"}
                  </span>
                </div>
              </div>
              <div className="px-2">
                <Slider
                  value={[device.status?.temperature ?? 24]}
                  onValueChange={handleTemperatureChange}
                  min={16}
                  max={30}
                  step={1}
                  disabled={!canControl || !device.status?.power}
                  className="w-full transition-smooth"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>16°C</span>
                  <span>23°C</span>
                  <span>30°C</span>
                </div>
              </div>
            </div>

            {/* Fan Speed Control */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Wind className="h-4 w-4 text-primary" />
                Fan Speed
              </label>
              <Select
                value={device.status?.fan_speed || "auto"}
                onValueChange={handleFanSpeedChange}
                disabled={!canControl || !device.status?.power}
              >
                <SelectTrigger className="transition-smooth focus-ring">
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
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={handleViewHistory} className="transition-smooth hover-lift">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOtaModalOpen(true)}
              className="transition-smooth hover-lift"
            >
              <Download className="h-4 w-4 mr-2" />
              OTA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="transition-smooth hover-lift"
            >
              <Settings className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(true)}
              className="text-error hover-error transition-smooth hover-lift"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditDeviceModal device={device} isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} />
      <DeleteDeviceModal device={device} isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
      <OTAUpdateModal device={device} isOpen={otaModalOpen} onClose={() => setOtaModalOpen(false)} />
    </>
  )
}
