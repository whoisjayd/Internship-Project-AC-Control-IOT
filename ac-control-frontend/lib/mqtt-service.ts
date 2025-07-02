"use client"

import { useEffect, useState, useCallback } from "react"

// MQTT configuration
const MQTT_CONFIG = {
  host: "13cc21a598da48498cbc4ecab9ba9c6d.s1.eu.hivemq.cloud",
  port: 8884,
  path: "/mqtt",
  username: "MyACControl",
  password: "MyAC@Control1",
  useSSL: true,
}

interface MQTTMessage {
  topic: string
  payload: string
  qos: number
  retain: boolean
}

interface DeviceStatus {
  power: boolean
  mode: "auto" | "cool" | "heat" | "dry" | "fan"
  temperature: number
  fan_speed: "auto" | "low" | "medium" | "high"
  online: boolean
  timestamp: string
}

interface DeviceTelemetry {
  device_id: string
  customer_id: string
  zone_id: string
  ac_brand: string
  ac_protocol: string
  firmware_version: string
  wifi_ssid: string
  rssi: number
  ac_power: boolean
  ac_mode: string
  ac_temperature: number
  ac_fanspeed: string
}

interface BatchOperationResult {
  success: string[]
  failed: string[]
  total: number
}

export class MQTTService {
  private client: any = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private messageHandlers: Map<string, (message: MQTTMessage) => void> = new Map()
  private statusHandlers: Map<string, (status: DeviceStatus) => void> = new Map()
  private connectionHandlers: Set<(connected: boolean) => void> = new Set()
  private clientId: string
  private pahoLoaded = false
  private connectionAttempted = false

  constructor() {
    this.clientId = `web_client_${Math.random().toString(36).substr(2, 9)}`
  }

  private async loadPahoMQTT(): Promise<boolean> {
    if (typeof window === "undefined") {
      return false
    }

    if (this.pahoLoaded && window.Paho?.MQTT?.Client) {
      return true
    }

    try {
      const cdnUrls = [
        "https://unpkg.com/paho-mqtt@1.1.0/paho-mqtt.js",
        "https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js",
        "https://cdn.jsdelivr.net/npm/paho-mqtt@1.1.0/paho-mqtt.js",
      ]

      for (const url of cdnUrls) {
        try {
          await this.loadScript(url)
          if (window.Paho?.MQTT?.Client) {
            this.pahoLoaded = true
            console.log("Paho MQTT loaded successfully from:", url)
            return true
          }
        } catch (error) {
          console.warn(`Failed to load from ${url}:`, error)
          continue
        }
      }

      throw new Error("All CDN sources failed")
    } catch (error) {
      console.error("Failed to load Paho MQTT library:", error)
      return false
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`)
      if (existingScript) {
        resolve()
        return
      }

      const script = document.createElement("script")
      script.src = src
      script.async = true
      script.onload = () => {
        setTimeout(() => resolve(), 100)
      }
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))

      document.head.appendChild(script)
    })
  }

  async connect(): Promise<boolean> {
    if (typeof window === "undefined") {
      return false
    }

    if (this.connectionAttempted && this.isConnected) {
      return true
    }

    this.connectionAttempted = true

    try {
      const loaded = await this.loadPahoMQTT()
      if (!loaded) {
        throw new Error("Failed to load Paho MQTT library")
      }

      if (!window.Paho?.MQTT?.Client) {
        throw new Error("Paho MQTT Client not available")
      }

      this.client = new window.Paho.MQTT.Client(MQTT_CONFIG.host, MQTT_CONFIG.port, MQTT_CONFIG.path, this.clientId)

      this.client.onConnectionLost = this.onConnectionLost.bind(this)
      this.client.onMessageArrived = this.onMessageArrived.bind(this)

      const connectOptions = {
        useSSL: MQTT_CONFIG.useSSL,
        userName: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        onSuccess: this.onConnect.bind(this),
        onFailure: this.onFailure.bind(this),
        keepAliveInterval: 60,
        cleanSession: true,
        timeout: 10,
      }

      try {
        const willMessage = new window.Paho.MQTT.Message("offline")
        willMessage.destinationName = `web/${this.clientId}/status`
        willMessage.qos = 1
        willMessage.retained = true
        connectOptions.willMessage = willMessage
      } catch (error) {
        console.warn("Will message not supported:", error)
      }

      this.client.connect(connectOptions)
      return true
    } catch (error) {
      console.error("Failed to connect to MQTT:", error)
      this.handleReconnect()
      return false
    }
  }

  private onConnect() {
    console.log("MQTT connected successfully")
    this.isConnected = true
    this.reconnectAttempts = 0

    try {
      const message = new window.Paho.MQTT.Message("online")
      message.destinationName = `web/${this.clientId}/status`
      message.qos = 1
      message.retained = true
      this.client.send(message)
    } catch (error) {
      console.warn("Failed to send online status:", error)
    }

    // Subscribe to pending device statuses
    this.subscribeToPendingDevices()

    this.connectionHandlers.forEach((handler) => {
      try {
        handler(true)
      } catch (error) {
        console.error("Error in connection handler:", error)
      }
    })
  }

  private onFailure(error: any) {
    console.error("MQTT connection failed:", error)
    this.isConnected = false
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(false)
      } catch (error) {
        console.error("Error in connection handler:", error)
      }
    })
    this.handleReconnect()
  }

  private onConnectionLost(responseObject: any) {
    console.log("MQTT connection lost:", responseObject.errorMessage)
    this.isConnected = false
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(false)
      } catch (error) {
        console.error("Error in connection handler:", error)
      }
    })
    this.handleReconnect()
  }

  private onMessageArrived(message: any) {
    try {
      const topic = message.destinationName
      const payload = message.payloadString
      console.log(`MQTT message received: ${topic} - ${payload}`)
      this.handleMessage({ topic, payload, qos: message.qos, retain: message.retained })
    } catch (error) {
      console.error("Error handling MQTT message:", error)
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      setTimeout(() => this.connect(), this.reconnectInterval)
    } else {
      console.error("Max reconnection attempts reached")
    }
  }

  private handleMessage(message: MQTTMessage) {
    const { topic, payload } = message

    // Handle device status messages (simple "online"/"offline" strings)
    const statusMatch = topic.match(/^node\/([^/]+)\/([^/]+)\/status$/)
    if (statusMatch) {
      const [, customerId, deviceId] = statusMatch
      const isOnline = payload.trim() === "online"

      console.log(`Device ${deviceId} status: ${isOnline ? "online" : "offline"}`)

      const handler = this.statusHandlers.get(deviceId)
      if (handler) {
        // For status messages, we only update the online status
        // The actual AC state comes from telemetry
        handler({
          power: false, // Will be updated by telemetry
          mode: "auto", // Will be updated by telemetry
          temperature: 24, // Will be updated by telemetry
          fan_speed: "auto", // Will be updated by telemetry
          online: isOnline,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Handle device telemetry messages (JSON with AC state)
    const telemetryMatch = topic.match(/^node\/([^/]+)\/([^/]+)\/telemetry$/)
    if (telemetryMatch) {
      const [, customerId, deviceId] = telemetryMatch

      try {
        const telemetry: DeviceTelemetry = JSON.parse(payload)
        console.log(`Device ${deviceId} telemetry:`, telemetry)

        const handler = this.statusHandlers.get(deviceId)
        if (handler) {
          // Map firmware telemetry to our status format
          const status: DeviceStatus = {
            power: telemetry.ac_power || false,
            mode: this.mapFirmwareMode(telemetry.ac_mode),
            temperature: telemetry.ac_temperature || 24,
            fan_speed: this.mapFirmwareFanSpeed(telemetry.ac_fanspeed),
            online: true, // If we receive telemetry, device is online
            timestamp: new Date().toISOString(),
          }

          handler(status)
        }
      } catch (error) {
        console.error("Failed to parse telemetry JSON:", error)
      }
    }

    // Handle error messages
    const errorMatch = topic.match(/^node\/([^/]+)\/([^/]+)\/error$/)
    if (errorMatch) {
      const [, customerId, deviceId] = errorMatch
      try {
        const errorData = JSON.parse(payload)
        console.error(`Device ${deviceId} error:`, errorData)
      } catch (error) {
        console.error("Failed to parse error JSON:", error)
      }
    }

    // Call registered message handlers
    for (const [pattern, handler] of this.messageHandlers) {
      try {
        if (topic.includes(pattern)) {
          handler(message)
        }
      } catch (error) {
        console.error("Error in message handler:", error)
      }
    }
  }

  private mapFirmwareMode(firmwareMode: string): "auto" | "cool" | "heat" | "dry" | "fan" {
    switch (firmwareMode) {
      case "auto":
        return "auto"
      case "cool":
        return "cool"
      case "heat":
        return "heat"
      case "dry":
        return "dry"
      case "fan":
        return "fan"
      default:
        return "cool"
    }
  }

  private mapFirmwareFanSpeed(firmwareFanSpeed: string): "auto" | "low" | "medium" | "high" {
    switch (firmwareFanSpeed) {
      case "auto":
        return "auto"
      case "min":
        return "low"
      case "medium":
        return "medium"
      case "max":
        return "high"
      default:
        return "auto"
    }
  }

  async subscribe(topic: string, callback?: (message: MQTTMessage) => void): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.warn(`MQTT not connected, cannot subscribe to ${topic}`)
      return // Return instead of throwing to prevent errors
    }

    try {
      this.client.subscribe(topic, { qos: 1 })
      console.log(`Subscribed to ${topic}`)
      if (callback) {
        this.messageHandlers.set(topic, callback)
      }
    } catch (error) {
      console.error(`Failed to subscribe to ${topic}:`, error)
      // Don't throw error to prevent breaking the app
    }
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      this.client.unsubscribe(topic)
      console.log(`Unsubscribed from ${topic}`)
      this.messageHandlers.delete(topic)
    } catch (error) {
      console.error(`Failed to unsubscribe from ${topic}:`, error)
    }
  }

  async publish(topic: string, messageText: string, options = { qos: 1, retain: false }): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error("MQTT not connected")
    }

    try {
      const message = new window.Paho.MQTT.Message(messageText)
      message.destinationName = topic
      message.qos = options.qos
      message.retained = options.retain

      this.client.send(message)
      console.log(`Published to ${topic}: ${messageText}`)
    } catch (error) {
      console.error(`Failed to publish to ${topic}:`, error)
      throw error
    }
  }

  async sendDeviceCommand(customerId: string, deviceId: string, command: string, value: string): Promise<void> {
    const topic = `node/${customerId}/${deviceId}/command/${command}`
    return this.publish(topic, value)
  }

  async sendBatchCommand(
    customerId: string,
    deviceIds: string[],
    command: string,
    value: string,
  ): Promise<BatchOperationResult> {
    const results: BatchOperationResult = { success: [], failed: [], total: deviceIds.length }

    const promises = deviceIds.map(async (deviceId) => {
      try {
        await this.sendDeviceCommand(customerId, deviceId, command, value)
        results.success.push(deviceId)
      } catch (error) {
        console.error(`Failed to send command to ${deviceId}:`, error)
        results.failed.push(deviceId)
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  subscribeToDeviceStatus(customerId: string, deviceId: string, callback: (status: DeviceStatus) => void) {
    this.statusHandlers.set(deviceId, callback)

    // Only subscribe if connected, otherwise store for later
    if (this.isConnected) {
      this.subscribe(`node/${customerId}/${deviceId}/status`).catch(console.error)
      this.subscribe(`node/${customerId}/${deviceId}/telemetry`).catch(console.error)
      this.subscribe(`node/${customerId}/${deviceId}/error`).catch(console.error)
    } else {
      console.log(`MQTT not connected, will subscribe to device ${deviceId} when connected`)
    }
  }

  unsubscribeFromDeviceStatus(customerId: string, deviceId: string) {
    this.statusHandlers.delete(deviceId)
    this.unsubscribe(`node/${customerId}/${deviceId}/status`).catch(console.error)
    this.unsubscribe(`node/${customerId}/${deviceId}/telemetry`).catch(console.error)
    this.unsubscribe(`node/${customerId}/${deviceId}/error`).catch(console.error)
  }

  async triggerOTA(customerId: string, deviceId: string, firmwareUrl: string, firmwareVersion: string): Promise<void> {
    const topic = `node/${customerId}/${deviceId}/ota/update`
    const payload = `${firmwareUrl},${firmwareVersion}`
    return this.publish(topic, payload)
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionHandlers.add(callback)
    callback(this.isConnected)
  }

  offConnectionChange(callback: (connected: boolean) => void) {
    this.connectionHandlers.delete(callback)
  }

  disconnect() {
    if (this.client && this.isConnected) {
      try {
        const message = new window.Paho.MQTT.Message("offline")
        message.destinationName = `web/${this.clientId}/status`
        message.qos = 1
        message.retained = true
        this.client.send(message)

        this.client.disconnect()
      } catch (error) {
        console.error("Error during disconnect:", error)
      }
      this.isConnected = false
    }
  }

  getConnectionStatus() {
    return this.isConnected
  }

  private subscribeToPendingDevices() {
    if (!this.isConnected) return

    for (const [deviceId, callback] of this.statusHandlers) {
      // Extract customer ID from the first status handler (assuming all devices belong to same customer)
      // This is a simplified approach - in production you might want to store customer ID separately
      const topics = [`node/+/${deviceId}/status`, `node/+/${deviceId}/telemetry`, `node/+/${deviceId}/error`]

      topics.forEach((topic) => {
        this.subscribe(topic).catch(console.error)
      })
    }
  }
}

// Singleton instance
let mqttService: MQTTService | null = null

export function useMQTTService() {
  const [isConnected, setIsConnected] = useState(false)
  const [service, setService] = useState<MQTTService | null>(null)

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!mqttService) {
      mqttService = new MQTTService()
    }

    setService(mqttService)
    mqttService.onConnectionChange(handleConnectionChange)

    const connectTimer = setTimeout(() => {
      mqttService?.connect().catch(console.error)
    }, 1000)

    return () => {
      clearTimeout(connectTimer)
      if (mqttService) {
        mqttService.offConnectionChange(handleConnectionChange)
      }
    }
  }, [handleConnectionChange])

  return { service, isConnected }
}

declare global {
  interface Window {
    Paho: any
  }
}
