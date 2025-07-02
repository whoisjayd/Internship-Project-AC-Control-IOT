"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Settings, Bell, Shield, Thermometer, Palette } from "lucide-react"
import { CopyToClipboard } from "@/components/ui/copy-to-clipboard"
import { useAuth } from "@/contexts/auth-context"

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    deviceOfflineAlerts: true,
    temperatureAlerts: false,
    maintenanceReminders: true,

    // Appearance
    language: "en",
    timezone: "UTC",
    temperatureUnit: "celsius",

    // Device Settings
    autoRefreshInterval: "30",
    defaultTemperature: "24",
    energySavingMode: false,

    // Security
    twoFactorAuth: false,
    sessionTimeout: "24",
    deviceAccessLogging: true,
  })

  const { user } = useAuth()

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))

    toast({
      title: "Setting updated",
      description: "Your preference has been saved.",
    })
  }

  const handleSaveAllSettings = () => {
    toast({
      title: "Settings saved",
      description: "All your preferences have been saved successfully.",
    })
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 sm:h-8 sm:w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and system settings</p>
        </div>

        {/* Customer Information */}
        <Card className="hover-lift transition-smooth animate-slide-up animate-delay-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer ID</Label>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <CopyToClipboard
                    text={user?.customer_id || "N/A"}
                    label="Customer ID"
                    className="w-full justify-start"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="font-mono text-sm">{user?.username || "N/A"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="hover-lift transition-smooth animate-slide-up animate-delay-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
                <div>
                  <Label className="text-base font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(value) => handleSettingChange("emailNotifications", value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
                <div>
                  <Label className="text-base font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive browser notifications</p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(value) => handleSettingChange("pushNotifications", value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
                <div>
                  <Label className="text-base font-medium">Device Offline Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when devices go offline</p>
                </div>
                <Switch
                  checked={settings.deviceOfflineAlerts}
                  onCheckedChange={(value) => handleSettingChange("deviceOfflineAlerts", value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
                <div>
                  <Label className="text-base font-medium">Temperature Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alerts for extreme temperatures</p>
                </div>
                <Switch
                  checked={settings.temperatureAlerts}
                  onCheckedChange={(value) => handleSettingChange("temperatureAlerts", value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
                <div>
                  <Label className="text-base font-medium">Maintenance Reminders</Label>
                  <p className="text-sm text-muted-foreground">Periodic maintenance notifications</p>
                </div>
                <Switch
                  checked={settings.maintenanceReminders}
                  onCheckedChange={(value) => handleSettingChange("maintenanceReminders", value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="hover-lift transition-smooth animate-slide-up animate-delay-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={settings.language} onValueChange={(value) => handleSettingChange("language", value)}>
                  <SelectTrigger className="transition-smooth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Temperature Unit</Label>
                <Select
                  value={settings.temperatureUnit}
                  onValueChange={(value) => handleSettingChange("temperatureUnit", value)}
                >
                  <SelectTrigger className="transition-smooth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celsius">🌡️ Celsius (°C)</SelectItem>
                    <SelectItem value="fahrenheit">🌡️ Fahrenheit (°F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(value) => handleSettingChange("timezone", value)}>
                <SelectTrigger className="transition-smooth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">🌍 UTC</SelectItem>
                  <SelectItem value="America/New_York">🇺🇸 Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">🇺🇸 Central Time</SelectItem>
                  <SelectItem value="America/Denver">🇺🇸 Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">🇺🇸 Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">🇬🇧 London</SelectItem>
                  <SelectItem value="Europe/Paris">🇫🇷 Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Device Settings */}
        <Card className="hover-lift transition-smooth animate-slide-up animate-delay-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5" />
              Device Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Auto Refresh Interval</Label>
                <Select
                  value={settings.autoRefreshInterval}
                  onValueChange={(value) => handleSettingChange("autoRefreshInterval", value)}
                >
                  <SelectTrigger className="transition-smooth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">⚡ 10 seconds</SelectItem>
                    <SelectItem value="30">🔄 30 seconds</SelectItem>
                    <SelectItem value="60">⏱️ 1 minute</SelectItem>
                    <SelectItem value="300">⏰ 5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Temperature (°C)</Label>
                <Input
                  type="number"
                  min="16"
                  max="30"
                  value={settings.defaultTemperature}
                  onChange={(e) => handleSettingChange("defaultTemperature", e.target.value)}
                  className="transition-smooth"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
              <div>
                <Label className="text-base font-medium">Energy Saving Mode</Label>
                <p className="text-sm text-muted-foreground">Optimize for energy efficiency</p>
              </div>
              <Switch
                checked={settings.energySavingMode}
                onCheckedChange={(value) => handleSettingChange("energySavingMode", value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="hover-lift transition-smooth animate-slide-up animate-delay-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
              <div>
                <Label className="text-base font-medium">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Switch
                checked={settings.twoFactorAuth}
                onCheckedChange={(value) => handleSettingChange("twoFactorAuth", value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <Select
                value={settings.sessionTimeout}
                onValueChange={(value) => handleSettingChange("sessionTimeout", value)}
              >
                <SelectTrigger className="transition-smooth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">⏰ 1 hour</SelectItem>
                  <SelectItem value="8">🕐 8 hours</SelectItem>
                  <SelectItem value="24">📅 24 hours</SelectItem>
                  <SelectItem value="168">📆 1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg transition-smooth">
              <div>
                <Label className="text-base font-medium">Device Access Logging</Label>
                <p className="text-sm text-muted-foreground">Log all device access attempts</p>
              </div>
              <Switch
                checked={settings.deviceAccessLogging}
                onCheckedChange={(value) => handleSettingChange("deviceAccessLogging", value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end animate-fade-in animate-delay-600">
          <Button onClick={handleSaveAllSettings} size="lg" className="transition-smooth hover-lift">
            💾 Save All Settings
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}
