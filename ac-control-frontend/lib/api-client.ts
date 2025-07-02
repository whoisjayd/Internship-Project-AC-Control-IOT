class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any,
  ) {
    super(message)
    this.name = "APIError"
  }
}

class APIClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = "https://accontrolapi-922006260296.us-central1.run.app") {
    this.baseURL = baseURL
  }

  setToken(token: string | null) {
    this.token = token
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    return headers
  }

  private async handleResponse(response: Response) {
    const contentType = response.headers.get("content-type")
    const isJSON = contentType?.includes("application/json")

    let data: any = null
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`

    try {
      if (isJSON) {
        data = await response.json()
      } else {
        const text = await response.text()
        if (text) {
          data = { message: text }
        }
      }
    } catch (parseError) {
      console.warn("Failed to parse response:", parseError)
    }

    if (!response.ok) {
      // Extract error message from response
      if (data?.message) {
        errorMessage = data.message
      } else if (data?.error) {
        errorMessage = data.error
      } else if (data?.detail) {
        errorMessage = data.detail
      }

      // Handle specific status codes
      switch (response.status) {
        case 400:
          errorMessage = data?.message || "Invalid request. Please check your input and try again."
          break
        case 401:
          errorMessage = "Authentication failed. Please log in again."
          break
        case 403:
          errorMessage = "You do not have permission to perform this action."
          break
        case 404:
          errorMessage = "The requested resource was not found."
          break
        case 409:
          errorMessage = data?.message || "A conflict occurred. The resource may already exist or be in use."
          break
        case 422:
          errorMessage = data?.message || "Validation failed. Please check your input."
          break
        case 429:
          errorMessage = "Too many requests. Please wait a moment and try again."
          break
        case 500:
          errorMessage = "Internal server error. Please try again later."
          break
        case 502:
        case 503:
        case 504:
          errorMessage = "Service temporarily unavailable. Please try again later."
          break
        default:
          errorMessage = data?.message || `Request failed with status ${response.status}`
      }

      throw new APIError(errorMessage, response.status, data?.code, data)
    }

    return data
  }

  async get(endpoint: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${this.baseURL}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      })

      return await this.handleResponse(response)
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new APIError("Network error. Please check your internet connection and try again.", 0, "NETWORK_ERROR")
      }

      throw new APIError("An unexpected error occurred. Please try again.", 0, "UNKNOWN_ERROR", error)
    }
  }

  async post(endpoint: string, data?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      })

      return await this.handleResponse(response)
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new APIError("Network error. Please check your internet connection and try again.", 0, "NETWORK_ERROR")
      }

      throw new APIError("An unexpected error occurred. Please try again.", 0, "UNKNOWN_ERROR", error)
    }
  }

  async put(endpoint: string, data?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "PUT",
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      })

      return await this.handleResponse(response)
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new APIError("Network error. Please check your internet connection and try again.", 0, "NETWORK_ERROR")
      }

      throw new APIError("An unexpected error occurred. Please try again.", 0, "UNKNOWN_ERROR", error)
    }
  }

  async delete(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      })

      // For DELETE requests, we consider 204 (No Content) as success
      if (response.status === 204) {
        return { success: true, message: "Successfully deleted" }
      }

      return await this.handleResponse(response)
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new APIError("Network error. Please check your internet connection and try again.", 0, "NETWORK_ERROR")
      }

      throw new APIError("An unexpected error occurred. Please try again.", 0, "UNKNOWN_ERROR", error)
    }
  }
}

export const apiClient = new APIClient()
export { APIError }
