"use client"

import { apiClient } from "@/lib/api-client"

export interface DeviceCommand {
  command: "power" | "mode" | "temperature" | "fanspeed"
  value: string
}

export interface BatchCommandResult {
  success: string[]
  failed: { deviceId: string; error: string }[]
  total: number
}

export class DeviceAPI {
  private static instance: DeviceAPI
  private commandQueue: Map<string, Promise<any>> = new Map()
  private rateLimiter: Map<string, number> = new Map()
  private readonly RATE_LIMIT_MS = 100 // Minimum time between commands per device

  static getInstance(): DeviceAPI {
    if (!DeviceAPI.instance) {
      DeviceAPI.instance = new DeviceAPI()
    }
    return DeviceAPI.instance
  }

  private async rateLimitedCommand(deviceId: string, commandFn: () => Promise<any>): Promise<any> {
    const now = Date.now()
    const lastCommand = this.rateLimiter.get(deviceId) || 0
    const timeSinceLastCommand = now - lastCommand

    if (timeSinceLastCommand < this.RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_MS - timeSinceLastCommand))
    }

    this.rateLimiter.set(deviceId, Date.now())
    return commandFn()
  }

  async sendDeviceCommand(deviceId: string, command: DeviceCommand): Promise<void> {
    const commandKey = `${deviceId}-${command.command}`

    // Cancel any pending command for the same device and command type
    if (this.commandQueue.has(commandKey)) {
      // Let the previous command complete but don't wait for it
    }

    const commandPromise = this.rateLimitedCommand(deviceId, async () => {
      try {
        await apiClient.post(`/devices/${deviceId}/command`, command)
      } catch (error: any) {
        console.error(`Command failed for device ${deviceId}:`, error)
        throw new Error(error.message || `Failed to send ${command.command} command`)
      } finally {
        this.commandQueue.delete(commandKey)
      }
    })

    this.commandQueue.set(commandKey, commandPromise)
    return commandPromise
  }

  async sendBatchCommand(deviceIds: string[], command: DeviceCommand): Promise<BatchCommandResult> {
    const result: BatchCommandResult = {
      success: [],
      failed: [],
      total: deviceIds.length,
    }

    // Process commands in batches to avoid overwhelming the API
    const batchSize = 10
    const batches = []

    for (let i = 0; i < deviceIds.length; i += batchSize) {
      batches.push(deviceIds.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (deviceId) => {
        try {
          await this.sendDeviceCommand(deviceId, command)
          result.success.push(deviceId)
        } catch (error: any) {
          result.failed.push({
            deviceId,
            error: error.message || "Unknown error",
          })
        }
      })

      await Promise.allSettled(batchPromises)

      // Small delay between batches to prevent API overload
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    return result
  }

  // Clear rate limiter for a device (useful when device goes offline/online)
  clearRateLimit(deviceId: string): void {
    this.rateLimiter.delete(deviceId)
  }

  // Clear all pending commands (useful for cleanup)
  clearAllCommands(): void {
    this.commandQueue.clear()
    this.rateLimiter.clear()
  }
}

export const deviceAPI = DeviceAPI.getInstance()
