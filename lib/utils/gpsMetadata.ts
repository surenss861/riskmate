/**
 * GPS Metadata Capture
 * 
 * Captures GPS coordinates, weather data, and proof of presence
 * for photos and job locations.
 */

export interface GPSMetadata {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  timestamp: string
  weather?: WeatherData
}

export interface WeatherData {
  temperature?: number
  conditions?: string
  humidity?: number
  windSpeed?: number
}

/**
 * Get current GPS coordinates
 */
export async function getGPSLocation(): Promise<GPSMetadata> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const metadata: GPSMetadata = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          timestamp: new Date().toISOString(),
        }

        // Try to get weather data (optional, requires API key)
        try {
          const weather = await getWeatherData(
            position.coords.latitude,
            position.coords.longitude
          )
          metadata.weather = weather
        } catch (error) {
          console.warn('Failed to fetch weather data:', error)
          // Continue without weather data
        }

        resolve(metadata)
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Get weather data for coordinates (requires weather API)
 */
async function getWeatherData(
  lat: number,
  lon: number
): Promise<WeatherData | undefined> {
  // This would integrate with a weather API like OpenWeatherMap
  // For now, return undefined - can be implemented when API key is available
  return undefined
}

/**
 * Extract GPS metadata from EXIF data in a photo
 */
export async function extractGPSFromPhoto(file: File): Promise<GPSMetadata | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      // This would use a library like exif-js to extract GPS data
      // For now, return null - can be implemented with exif-js library
      resolve(null)
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Format GPS metadata for display
 */
export function formatGPSMetadata(metadata: GPSMetadata): string {
  return `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`
}

