"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Settings, Power, Thermometer, Wind, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

export function DeviceControlPanel() {
  const { devices, selectedDevices, sendBatchCommand, mqttConnected } = useDevices()

  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [batchSettings, setBatchSettings] = useState({
    power: false,
    mode: "auto" as "auto" | "cool" | "heat" | "dry" | "fan",
    temperature: 24,
    fan_speed: "auto" as "auto" | "low" | "medium" | "high",
  })

  const selectedDevicesList = devices.filter((d) => selectedDevices.has(d.device_id))
  const onlineSelectedDevices = selectedDevicesList.filter((d) => d.status?.online)
  const offlineSelectedDevices = selectedDevicesList.filter((d) => !d.status?.online)

  const handleBatchCommand = async (command: string, value: any) => {
    if (!mqttConnected) {
      toast({
        title: "MQTT Disconnected",
        description: "Cannot send commands without MQTT connection",
        variant: "destructive",
      })
      return
    }

    if (onlineSelectedDevices.length === 0) {
      toast({
        title: "No Online Devices",
        description: "No online devices selected for batch operation",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const deviceIds = onlineSelectedDevices.map((d) => d.device_id)
      const result = await sendBatchCommand(deviceIds, { [command]: value })

      toast({
        title: "Batch Command Sent",
        description: `${result.success.length} devices updated successfully${result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}`,
        variant: result.failed.length === 0 ? "default" : "destructive",
      })
    } catch (error) {
      toast({
        title: "Batch Command Failed",
        description: "Failed to send batch command to devices",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePowerToggle = (power: boolean) => {
    setBatchSettings((prev) => ({ ...prev, power }))
    handleBatchCommand("power", power)
  }

  const handleModeChange = (mode: string) => {
    setBatchSettings((prev) => ({ ...prev, mode: mode as any }))
    handleBatchCommand("mode", mode)
  }

  const handleTemperatureChange = (temperature: number[]) => {
    setBatchSettings((prev) => ({ ...prev, temperature: temperature[0] }))
    handleBatchCommand("temperature", temperature[0])
  }

  const handleFanSpeedChange = (fanSpeed: string) => {
    setBatchSettings((prev) => ({ ...prev, fan_speed: fanSpeed as any }))
    handleBatchCommand("fan_speed", fanSpeed)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Batch Device Control
            <Badge variant="secondary">{selectedDevices.size} devices</Badge>
          </CardTitle>
          {isLoading && <LoadingSpinner size="sm" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-success-light rounded-lg">
            <CheckCircle className="h-5 w-5 icon-success" />
            <div>
              <p className="font-medium text-success">{onlineSelectedDevices.length} Online</p>
              <p className="text-sm text-success-dark">Ready for control</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-error-light rounded-lg">
            <XCircle className="h-5 w-5 icon-error" />
            <div>
              <p className="font-medium text-error">{offlineSelectedDevices.length} Offline</p>
              <p className="text-sm text-error-dark">Cannot be controlled</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-info-light rounded-lg">
            <Settings className="h-5 w-5 icon-info" />
            <div>
              <p className="font-medium text-info">Batch Control</p>
              <p className="text-sm text-info-dark">Control all at once</p>
            </div>
          </div>
        </div>

        {/* MQTT Warning */}
        {!mqttConnected && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 icon-warning" />
            <div>
              <p className="font-medium text-warning">MQTT Connection Required</p>
              <p className="text-sm text-warning-dark">Device control requires active MQTT connection</p>
            </div>
          </div>
        )}

        {/* Batch Controls */}
        <div className="space-y-4">
          {/* Power Control */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              <div>
                <p className="font-medium">Power Control</p>
                <p className="text-sm text-muted-foreground">Turn all selected devices on/off</p>
              </div>
            </div>
            <Switch
              checked={batchSettings.power}
              onCheckedChange={handlePowerToggle}
              disabled={isLoading || !mqttConnected || onlineSelectedDevices.length === 0}
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
              disabled={isLoading || !mqttConnected || onlineSelectedDevices.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="cool">Cool</SelectItem>
                <SelectItem value="heat">Heat</SelectItem>
                <SelectItem value="dry">Dry</SelectItem>
                <SelectItem value="fan">Fan</SelectItem>
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
              disabled={isLoading || !mqttConnected || onlineSelectedDevices.length === 0}
              className="w-full"
            />
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
              disabled={isLoading || !mqttConnected || onlineSelectedDevices.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Device Status Summary */}
        <div className="space-y-2">
          <h4 className="font-medium">Selected Devices Status</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {selectedDevicesList.map((device) => (
              <div key={device.device_id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span>{device.device_id}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={device.status?.online ? "default" : "destructive"} className="text-xs">
                    {device.status?.online ? "Online" : "Offline"}
                  </Badge>
                  {device.status?.online && (
                    <Badge variant={device.status?.power ? "default" : "secondary"} className="text-xs">
                      {device.status?.power ? "ON" : "OFF"}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
