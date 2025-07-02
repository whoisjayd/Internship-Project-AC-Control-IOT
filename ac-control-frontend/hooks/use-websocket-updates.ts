"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useWebSocket } from "@/lib/websocket-service"

export function useWebSocketUpdates() {
  const { user, token } = useAuth()
  const { isConnected, lastMessage } = useWebSocket(user?.customer_id, token)
  const [deviceUpdates, setDeviceUpdates] = useState<any[]>([])
  const [statusUpdates, setStatusUpdates] = useState<any[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")

  useEffect(() => {
    setConnectionStatus(isConnected ? "connected" : "disconnected")
  }, [isConnected])

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === "device_update") {
        setDeviceUpdates(lastMessage.data)
      } else if (lastMessage.type === "status_history") {
        setStatusUpdates(lastMessage.data)
      }
    }
  }, [lastMessage])

  return {
    deviceUpdates,
    statusUpdates,
    connectionStatus,
  }
}
