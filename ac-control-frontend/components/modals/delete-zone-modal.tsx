"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle } from "lucide-react"

interface Zone {
  zone_id: string
  zone_name: string
}

interface DeleteZoneModalProps {
  zone: Zone | null
  isOpen: boolean
  onClose: () => void
  deviceCount: number
}

export function DeleteZoneModal({ zone, isOpen, onClose, deviceCount }: DeleteZoneModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { deleteZone } = useDevices()
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!zone) return

    setIsLoading(true)
    try {
      await deleteZone(zone.zone_id)
      toast({
        title: "Zone deleted",
        description: "Zone has been successfully deleted.",
      })
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete zone. Please try again.",
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
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Zone
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this zone? This action cannot be undone.
          </p>
          <div className="bg-muted/30 border border-border p-3 rounded-lg">
            <p className="text-sm font-medium text-foreground">Zone: {zone?.zone_name}</p>
            <p className="text-sm text-muted-foreground">Devices in zone: {deviceCount}</p>
          </div>
          {deviceCount > 0 && (
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg">
              <p className="text-sm text-warning">
                <strong>Note:</strong> Devices in this zone will be moved to an unassigned state.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Delete Zone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
