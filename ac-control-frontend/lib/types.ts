// Common types used throughout the application

export interface User {
  user_id: number
  username: string
  email: string
  created_at: string
}

export interface Device {
  device_id: string
  device_name: string
  device_type: string
  zone_id?: string
  owner_id: number
  status: DeviceStatus
  created_at: string
  updated_at: string
}

export interface DeviceStatus {
  online: boolean
  power: boolean
  mode: 'cool' | 'heat' | 'dry' | 'fan' | 'auto'
  temperature: number
  fan_speed: 'low' | 'medium' | 'high' | 'auto'
  last_seen?: string
}

export interface Zone {
  zone_id: string
  zone_location_name: string
  zone_description?: string
  owner_id: number
  created_at: string
  updated_at: string
}

export interface HistoryItem {
  history_id: number
  device_id: string
  user_id: number
  action: string
  timestamp: string
  device_name?: string
  // Status fields
  power?: boolean
  mode?: string
  temperature?: number
  fan_speed?: string
}

export interface BatchSettings {
  power: boolean
  mode: 'cool' | 'heat' | 'dry' | 'fan' | 'auto'
  temperature: number
  fan_speed: 'low' | 'medium' | 'high' | 'auto'
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface LoadingState {
  loading: boolean
  error: string | null
}

// Form types
export interface LoginForm {
  username: string
  password: string
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  country: string
  state: string
  city: string
}

export interface DeviceForm {
  device_name: string
  device_type: string
  zone_id?: string
}

export interface ZoneForm {
  zone_location_name: string
  zone_description?: string
}

// UI component prop types
export interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

// Chart data types
export interface ChartData {
  name: string
  value: number
  color?: string
}

export interface TemperatureData {
  time: string
  temperature: number
  device: string
}

export interface EnergyData {
  totalConsumption: number
  averageEfficiency: number
  activePowerUsage: number
  peakHours: string
  costEstimate: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}
