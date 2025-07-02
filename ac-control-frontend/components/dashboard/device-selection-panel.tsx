"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useDevices } from "@/contexts/device-context"
import { CreateGroupModal } from "@/components/modals/create-group-modal"
import { Users, CheckSquare, Square, MapPin, Plus, Trash2, Wifi, WifiOff, Power } from "lucide-react"

export function DeviceSelectionPanel() {
  const {
    devices,
    zones,
    deviceGroups,
    selectedDevices,
    toggleDeviceSelection,
    selectAllDevices,
    clearSelection,
    selectDevicesByZone,
    selectDeviceGroup,
    deleteDeviceGroup,
  } = useDevices()

  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false)
  const [filterZone, setFilterZone] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const filteredDevices = devices.filter((device) => {
    const matchesZone = filterZone === "all" || device.zone_id === filterZone
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "online" && device.status?.online) ||
      (filterStatus === "offline" && !device.status?.online) ||
      (filterStatus === "active" && device.status?.power) ||
      (filterStatus === "inactive" && !device.status?.power)

    return matchesZone && matchesStatus
  })

  const allSelected =
    filteredDevices.length > 0 && filteredDevices.every((device) => selectedDevices.has(device.device_id))
  const someSelected = filteredDevices.some((device) => selectedDevices.has(device.device_id))

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection()
    } else {
      const deviceIds = filteredDevices.map((d) => d.device_id)
      deviceIds.forEach((id) => {
        if (!selectedDevices.has(id)) {
          toggleDeviceSelection(id)
        }
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Device Selection
              {selectedDevices.size > 0 && <Badge variant="secondary">{selectedDevices.size} selected</Badge>}
            </CardTitle>
            <div className="flex gap-2">
              {selectedDevices.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCreateGroupModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Group
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="zone-filter">Filter by Zone</Label>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger>
                  <SelectValue placeholder="All zones" />
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
            </div>
            <div className="flex-1">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="active">Active (ON)</SelectItem>
                  <SelectItem value="inactive">Inactive (OFF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Selection */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="flex items-center gap-1">
              {allSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : someSelected ? (
                <Square className="h-4 w-4 opacity-50" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            {zones.map((zone) => (
              <Button key={zone.zone_id} variant="outline" size="sm" onClick={() => selectDevicesByZone(zone.zone_id)}>
                <MapPin className="h-4 w-4 mr-1" />
                {zone.zone_location_name}
              </Button>
            ))}
          </div>

          {/* Device Groups */}
          {deviceGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Saved Groups</Label>
              <div className="flex flex-wrap gap-2">
                {deviceGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => selectDeviceGroup(group.id)}>
                      <Users className="h-4 w-4 mr-1" />
                      {group.name} ({group.device_ids.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDeviceGroup(group.id)}
                      className="text-error hover-error p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No devices match the current filters</p>
            ) : (
              filteredDevices.map((device) => (
                <div
                  key={device.device_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedDevices.has(device.device_id)}
                      onCheckedChange={() => toggleDeviceSelection(device.device_id)}
                    />
                    <div className="flex items-center gap-2">
                      {device.status?.online ? (
                        <Wifi className="h-4 w-4 icon-success" />
                      ) : (
                        <WifiOff className="h-4 w-4 icon-error" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{device.device_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.zone_location_name} • {device.ac_brand_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.status?.power ? "default" : "secondary"}>
                      <Power className="h-3 w-3 mr-1" />
                      {device.status?.power ? "ON" : "OFF"}
                    </Badge>
                    {device.status?.temperature && <Badge variant="outline">{device.status.temperature}°C</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreateGroupModal
        isOpen={createGroupModalOpen}
        onClose={() => setCreateGroupModalOpen(false)}
        selectedDevices={Array.from(selectedDevices)}
      />
    </>
  )
}
