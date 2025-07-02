"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Download } from "lucide-react"

interface Device {
  device_id: string
  firmware_version: string
  ac_brand_name: string
}

interface OTAUpdateModalProps {
  device: Device | null
  isOpen: boolean
  onClose: () => void
}

export function OTAUpdateModal({ device, isOpen, onClose }: OTAUpdateModalProps) {
  const [formData, setFormData] = useState({
    firmware_url: "",
    firmware_version: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { triggerOTA } = useDevices()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!device) return

    setIsLoading(true)
    try {
      await triggerOTA(device.device_id, formData.firmware_url, formData.firmware_version)
      toast({
        title: "OTA update initiated",
        description: "Firmware update has been sent to the device.",
      })
      onClose()
      setFormData({ firmware_url: "", firmware_version: "" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate OTA update. Please try again.",
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
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Download className="h-5 w-5 text-primary" />
            OTA Firmware Update
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm font-medium text-slate-900">Device: {device?.device_id}</p>
            <p className="text-sm text-slate-600">Current Version: {device?.firmware_version}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firmware_url" className="text-slate-700 font-medium">Firmware URL</Label>
            <Input
              id="firmware_url"
              value={formData.firmware_url}
              onChange={(e) => handleChange("firmware_url", e.target.value)}
              placeholder="https://example.com/firmware.bin"
              className="border-slate-300"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firmware_version" className="text-slate-700 font-medium">New Firmware Version</Label>
            <Input
              id="firmware_version"
              value={formData.firmware_version}
              onChange={(e) => handleChange("firmware_version", e.target.value)}
              placeholder="v2.1.0"
              className="border-slate-300"
              required
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> Make sure the firmware URL is accessible and the version is compatible with your
              device.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white border-0">
              {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Start Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
