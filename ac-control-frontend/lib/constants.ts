// Application routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/dashboard',
  DEVICES: '/devices',
  ZONES: '/zones',
  HISTORY: '/history',
  BATCH_CONTROL: '/batch-control',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const

// Device configuration
export const DEVICE_CONFIG = {
  MODES: ['cool', 'heat', 'dry', 'fan', 'auto'] as const,
  FAN_SPEEDS: ['low', 'medium', 'high', 'auto'] as const,
  TEMPERATURE_RANGE: {
    MIN: 16,
    MAX: 30,
    DEFAULT: 24,
  },
  REFRESH_INTERVAL: 30000, // 30 seconds
} as const

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  LOADING_DEBOUNCE: 300,
  ANIMATION_DURATION: 300,
  MOBILE_BREAKPOINT: 768,
  SKELETON_ITEMS: {
    DEVICES: 6,
    HISTORY: 10,
    ZONES: 4,
  },
} as const

// Status colors
export const STATUS_COLORS = {
  ONLINE: 'status-online',
  OFFLINE: 'status-offline',
  WARNING: 'status-warning',
  INFO: 'status-info',
  SUCCESS: 'status-success',
  ERROR: 'status-error',
} as const

// Validation rules
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 50,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  DEVICE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
  ZONE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
} as const

// Error messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_FAILED: 'Please check your input and try again.',
  MQTT_DISCONNECTED: 'MQTT connection lost. Device control may be limited.',
  WEBSOCKET_ERROR: 'Real-time updates unavailable.',
} as const

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Successfully logged in!',
  LOGOUT: 'Successfully logged out!',
  REGISTER: 'Account created successfully!',
  DEVICE_CREATED: 'Device added successfully!',
  DEVICE_UPDATED: 'Device updated successfully!',
  DEVICE_DELETED: 'Device deleted successfully!',
  ZONE_CREATED: 'Zone created successfully!',
  ZONE_UPDATED: 'Zone updated successfully!',
  ZONE_DELETED: 'Zone deleted successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  BATCH_COMMAND: 'Batch command sent successfully!',
} as const
