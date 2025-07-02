"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useDevices } from "@/contexts/device-context"
import { useToast } from "@/hooks/use-toast"
import { Users } from "lucide-react"

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDevices: string[]
}

export function CreateGroupModal({ isOpen, onClose, selectedDevices }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("")
  const { devices, createDeviceGroup } = useDevices()
  const { toast } = useToast()

  const selectedDeviceDetails = devices.filter((d) => selectedDevices.includes(d.device_id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return

    createDeviceGroup(groupName.trim(), selectedDevices)
    toast({
      title: "Group Created",
      description: `Device group "${groupName}" created with ${selectedDevices.length} devices.`,
    })

    setGroupName("")
    onClose()
  }

  const handleClose = () => {
    setGroupName("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-card-foreground">
            <Users className="h-5 w-5 text-primary" />
            Create Device Group
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group_name">Group Name</Label>
            <Input
              id="group_name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name (e.g., Living Room ACs)"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Selected Devices ({selectedDevices.length})</Label>
            <div className="max-h-32 overflow-y-auto space-y-1 p-3 border border-border rounded-lg bg-muted/30">
              {selectedDeviceDetails.map((device) => (
                <div key={device.device_id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{device.device_id}</span>
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {device.zone_location_name}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!groupName.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
