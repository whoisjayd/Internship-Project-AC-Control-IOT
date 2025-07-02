"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle } from "lucide-react"

interface Device {
  device_id: string
  zone_name?: string
  ac_brand_name: string
}

interface DeleteDeviceModalProps {
  device: Device | null
  isOpen: boolean
  onClose: () => void
}

export function DeleteDeviceModal({ device, isOpen, onClose }: DeleteDeviceModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { deleteDevice } = useDevices()
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!device) return

    setIsLoading(true)
    try {
      await deleteDevice(device.device_id)
      toast({
        title: "Device deleted",
        description: "Device has been successfully removed from your account.",
      })
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-destructive">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            Delete Device
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Are you sure you want to remove this device from your account? This action cannot be undone and will also
            delete all historical data for this device.
          </p>
          <div className="bg-muted/30 border border-border p-4 rounded-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Device Details:</p>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground"><span className="font-medium">ID:</span> {device?.device_id}</p>
                <p className="text-sm text-muted-foreground"><span className="font-medium">Brand:</span> {device?.ac_brand_name}</p>
                <p className="text-sm text-muted-foreground"><span className="font-medium">Zone:</span> {device?.zone_name || "Unknown"}</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Delete Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
