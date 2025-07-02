"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface Zone {
  zone_id: string
  zone_location_name: string
}

interface ZoneModalProps {
  zone?: Zone | null
  isOpen: boolean
  onClose: () => void
  mode: "create" | "edit"
}

export function ZoneModal({ zone, isOpen, onClose, mode }: ZoneModalProps) {
  const [zoneLocationName, setZoneLocationName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { createZone, updateZone } = useDevices()
  const { toast } = useToast()

  useEffect(() => {
    if (mode === "edit" && zone) {
      setZoneLocationName(zone.zone_location_name || "")
    } else {
      setZoneLocationName("")
    }
  }, [mode, zone, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zoneLocationName || !zoneLocationName.trim()) return

    setIsLoading(true)
    try {
      if (mode === "create") {
        await createZone(zoneLocationName.trim())
        toast({
          title: "Zone created",
          description: "New zone has been successfully created.",
        })
      } else if (mode === "edit" && zone) {
        await updateZone(zone.zone_id, zoneLocationName.trim())
        toast({
          title: "Zone updated",
          description: "Zone has been successfully updated.",
        })
      }
      onClose()
      setZoneLocationName("")
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${mode} zone. Please try again.`,
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
          <DialogTitle>{mode === "create" ? "Create New Zone" : "Edit Zone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zone_location_name">Zone Location Name</Label>
            <Input
              id="zone_location_name"
              value={zoneLocationName}
              onChange={(e) => setZoneLocationName(e.target.value)}
              placeholder="Enter zone location name (e.g., Living Room, Bedroom)"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !zoneLocationName || !zoneLocationName.trim()}>
              {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              {mode === "create" ? "Create Zone" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
