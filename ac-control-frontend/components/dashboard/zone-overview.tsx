"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDevices } from "@/contexts/device-context"
import { MapPin, Thermometer } from "lucide-react"
import Link from "next/link"
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard"

export function ZoneOverview() {
  const { devices, zones, selectDevicesByZone } = useDevices()

  const getZoneStats = (zoneId: string) => {
    const zoneDevices = devices.filter((d) => d.zone_id === zoneId)
    const onlineDevices = zoneDevices.filter((d) => d.status?.online)
    const activeDevices = zoneDevices.filter((d) => d.status?.power)

    // Only calculate average from devices with temperature data
    const devicesWithTemp = zoneDevices.filter((d) => d.status?.temperature)
    const avgTemp =
      devicesWithTemp.length > 0
        ? Math.round(devicesWithTemp.reduce((sum, d) => sum + (d.status?.temperature || 0), 0) / devicesWithTemp.length)
        : null

    return {
      total: zoneDevices.length,
      online: onlineDevices.length,
      active: activeDevices.length,
      avgTemp,
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Zone Overview
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/zones">Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.length === 0 ? (
          <div className="text-center py-6">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No zones created yet</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/zones">Create Zone</Link>
            </Button>
          </div>
        ) : (
          zones.map((zone) => {
            const stats = getZoneStats(zone.zone_id)
            return (
              <div key={zone.zone_id} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{zone.zone_location_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">ID:</span>
                      <CopyToClipboard text={zone.zone_id} className="text-xs" showIcon={true} />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => selectDevicesByZone(zone.zone_id)}>
                    Select All
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Devices</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-success">{stats.active}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stats.avgTemp !== null ? `${stats.avgTemp}°C` : "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Avg Temp</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
                    <Badge variant={stats.online > 0 ? "default" : "secondary"} className="text-xs">
                      {stats.online} Online
                    </Badge>
                    <Badge variant={stats.active > 0 ? "default" : "secondary"} className="text-xs">
                      {stats.active} Active
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/devices?zone=${zone.zone_id}`}>
                      <Thermometer className="h-3 w-3 mr-1" />
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
