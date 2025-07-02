"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDevices } from "@/contexts/device-context"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ZoneModal } from "@/components/modals/zone-modal"
import { DeleteZoneModal } from "@/components/modals/delete-zone-modal"
import { MapPin, Plus, Edit, Trash2, Thermometer } from "lucide-react"
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard"

export default function ZonesPage() {
  const { zones, devices, loading } = useDevices()
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [zoneModalMode, setZoneModalMode] = useState<"create" | "edit">("create")
  const [selectedZone, setSelectedZone] = useState<any>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const router = useRouter()

  const getZoneDeviceCount = (zoneId: string) => {
    return devices.filter((device) => device.zone_id === zoneId).length
  }

  const getZoneActiveDevices = (zoneId: string) => {
    return devices.filter((device) => device.zone_id === zoneId && device.status?.power).length
  }

  const handleCreateZone = () => {
    setZoneModalMode("create")
    setSelectedZone(null)
    setZoneModalOpen(true)
  }

  const handleEditZone = (zone: any) => {
    setZoneModalMode("edit")
    setSelectedZone(zone)
    setZoneModalOpen(true)
  }

  const handleDeleteZone = (zone: any) => {
    setSelectedZone(zone)
    setDeleteModalOpen(true)
  }

  const handleViewZoneDevices = (zoneId: string) => {
    router.push(`/devices?zone=${zoneId}`)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Zones</h1>
            <p className="text-gray-600">Organize your devices by location or area</p>
          </div>
          <Button onClick={handleCreateZone}>
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        </div>

        {/* Zones Grid */}
        {zones.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No zones created</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Create zones to organize your AC devices by location or area for easier management.
            </p>
            <Button onClick={handleCreateZone}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first zone
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {zones.map((zone) => {
              const deviceCount = getZoneDeviceCount(zone.zone_id)
              const activeDevices = getZoneActiveDevices(zone.zone_id)

              return (
                <Card key={zone.zone_id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <div className="flex flex-col gap-1">
                          <span>{zone.zone_location_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">ID:</span>
                            <CopyToClipboard text={zone.zone_id} className="text-xs" showIcon={true} />
                          </div>
                        </div>
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditZone(zone)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteZone(zone)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Devices</span>
                      <Badge variant="secondary">{deviceCount}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Devices</span>
                      <Badge variant={activeDevices > 0 ? "default" : "secondary"}>{activeDevices}</Badge>
                    </div>

                    <div className="pt-2 space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleViewZoneDevices(zone.zone_id)}
                      >
                        <Thermometer className="h-4 w-4 mr-2" />
                        View Devices ({deviceCount})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ZoneModal
        zone={selectedZone}
        isOpen={zoneModalOpen}
        onClose={() => setZoneModalOpen(false)}
        mode={zoneModalMode}
      />
      <DeleteZoneModal
        zone={selectedZone}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        deviceCount={selectedZone ? getZoneDeviceCount(selectedZone.zone_id) : 0}
      />
    </MainLayout>
  )
}
