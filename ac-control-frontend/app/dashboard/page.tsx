"use client"

import { useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useDevices } from "@/contexts/device-context"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/hooks/use-toast"
import {
  Thermometer,
  MapPin,
  Wifi,
  Zap,
  RefreshCw,
  Power,
  Activity,
  Plus,
  ArrowRight,
  Settings,
} from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { user } = useAuth()
  const { devices, zones, loading, mqttConnected, fetchDevices, fetchZones } = useDevices()
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await Promise.all([fetchDevices(), fetchZones()])
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        })
      }
    }

    initializeDashboard()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchDevices(), fetchZones()])
      toast({
        title: "Dashboard Refreshed",
        description: "All data has been updated successfully",
      })
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh dashboard data",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
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

  const totalDevices = devices.length
  const onlineDevices = devices.filter((d) => d.status?.online).length
  const activeDevices = devices.filter((d) => d.status?.power).length
  const totalZones = zones.length

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {user?.username || "User"}</h1>
            <p className="text-muted-foreground">Here's what's happening with your AC system today</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="transition-smooth hover-lift"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mqttConnected ? "bg-success-light border border-success" : "bg-error-light border border-error"} animate-pulse`} />
              <span className="text-sm text-muted-foreground">{mqttConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </div>

        {/* MQTT Warning */}
        {!mqttConnected && (
          <Card className="border-orange-500/20 bg-orange-500/5 animate-slide-down">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="h-4 w-4 icon-warning" />
                </div>
                <div>
                  <p className="font-medium text-warning">MQTT Connection Required</p>
                  <p className="text-sm text-warning-dark">
                    Real-time device control requires MQTT connection. Please check your network.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-card hover-lift transition-smooth animate-scale-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                  <p className="text-3xl font-bold text-foreground">{totalDevices}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Thermometer className="h-6 w-6 icon-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link href="/devices" className="text-sm text-primary hover:text-primary/80 transition-smooth">
                  Manage devices
                </Link>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift transition-smooth animate-scale-in animate-delay-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Online</p>
                  <p className="text-3xl font-bold text-success">{onlineDevices}</p>
                </div>
                <div className="w-12 h-12 bg-success-light rounded-xl flex items-center justify-center">
                  <Wifi className="h-6 w-6 icon-success" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {totalDevices > 0 ? `${onlineDevices} of ${totalDevices} online` : "No devices"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift transition-smooth animate-scale-in animate-delay-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold text-primary">{activeDevices}</p>
                </div>
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Power className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {onlineDevices > 0
                    ? `${activeDevices} of ${onlineDevices} devices active`
                    : "No active devices"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift transition-smooth animate-scale-in animate-delay-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Zones</p>
                  <p className="text-3xl font-bold text-purple-500">{totalZones}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link href="/zones" className="text-sm text-primary hover:text-primary/80 transition-smooth">
                  Manage zones
                </Link>
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card hover-lift transition-smooth animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="outline" className="h-auto p-4 justify-start transition-smooth hover-lift" asChild>
                  <Link href="/devices">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-info-light rounded-lg flex items-center justify-center">
                        <Thermometer className="h-4 w-4 icon-info" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Add Device</p>
                        <p className="text-xs text-muted-foreground">Connect new AC unit</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start transition-smooth hover-lift" asChild>
                  <Link href="/zones">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-warning-light rounded-lg flex items-center justify-center">
                        <MapPin className="h-4 w-4 icon-warning" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Create Zone</p>
                        <p className="text-xs text-muted-foreground">Organize by location</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start transition-smooth hover-lift" asChild>
                  <Link href="/batch-control">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-success-light rounded-lg flex items-center justify-center">
                        <Activity className="h-4 w-4 icon-success" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Batch Control</p>
                        <p className="text-xs text-muted-foreground">Control multiple devices</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start transition-smooth hover-lift" asChild>
                  <Link href="/settings">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-warning-light rounded-lg flex items-center justify-center">
                        <Settings className="h-4 w-4 icon-warning" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Settings</p>
                        <p className="text-xs text-muted-foreground">Customize preferences</p>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
