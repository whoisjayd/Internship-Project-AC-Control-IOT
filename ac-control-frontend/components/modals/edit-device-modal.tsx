"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface Device {
  device_id: string
  zone_id: string
  zone_name?: string
  ac_brand_name: string
  ac_brand_protocol: string
  firmware_version: string
  last_seen: string
}

interface EditDeviceModalProps {
  device: Device | null
  isOpen: boolean
  onClose: () => void
}

export function EditDeviceModal({ device, isOpen, onClose }: EditDeviceModalProps) {
  const [formData, setFormData] = useState({
    zone_id: "",
    ac_brand_name: "",
    ac_brand_protocol: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { zones, updateDevice } = useDevices()
  const { toast } = useToast()

  useEffect(() => {
    if (device) {
      setFormData({
        zone_id: device.zone_id,
        ac_brand_name: device.ac_brand_name,
        ac_brand_protocol: device.ac_brand_protocol,
      })
    }
  }, [device])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!device) return

    setIsLoading(true)
    try {
      await updateDevice(device.device_id, formData)
      toast({
        title: "Device updated",
        description: "Device information has been successfully updated.",
      })
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update device. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Edit Device</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Device ID</Label>
            <Input value={device?.device_id || ""} disabled className="bg-slate-50 text-slate-500 border-slate-200" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zone_id" className="text-slate-700 font-medium">Zone</Label>
            <Select value={formData.zone_id} onValueChange={(value) => handleChange("zone_id", value)}>
              <SelectTrigger className="h-12 border-slate-300">
                <SelectValue placeholder="Select a zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.zone_id} value={zone.zone_id}>
                    {zone.zone_location_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ac_brand_name" className="text-slate-700 font-medium">AC Brand Name</Label>
            <Input
              id="ac_brand_name"
              value={formData.ac_brand_name}
              onChange={(e) => handleChange("ac_brand_name", e.target.value)}
              placeholder="Enter AC brand name"
              className="h-12 border-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ac_brand_protocol" className="text-slate-700 font-medium">AC Brand Protocol</Label>
            <Select
              value={formData.ac_brand_protocol}
              onValueChange={(value) => handleChange("ac_brand_protocol", value)}
            >
              <SelectTrigger className="h-12 border-slate-300">
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IR">IR</SelectItem>
                <SelectItem value="WiFi">WiFi</SelectItem>
                <SelectItem value="Zigbee">Zigbee</SelectItem>
                <SelectItem value="Bluetooth">Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Firmware Version</Label>
            <Input value={device?.firmware_version || ""} disabled className="bg-slate-50 text-slate-500 border-slate-200" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white border-0">
              {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
