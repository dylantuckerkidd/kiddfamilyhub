import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface WeatherLocation {
  lat: number
  lng: number
  name: string
}

export interface CurrentWeather {
  temperature: number
  weathercode: number
}

export interface DailyForecast {
  date: string
  dayName: string
  high: number
  low: number
  precipitationProbability: number
  weathercode: number
}

export interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

const WMO_MAP: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'Clear sky' },
  1: { emoji: '🌤️', label: 'Mainly clear' },
  2: { emoji: '⛅', label: 'Partly cloudy' },
  3: { emoji: '☁️', label: 'Overcast' },
  45: { emoji: '🌫️', label: 'Fog' },
  48: { emoji: '🌫️', label: 'Freezing fog' },
  51: { emoji: '🌦️', label: 'Light drizzle' },
  53: { emoji: '🌦️', label: 'Drizzle' },
  55: { emoji: '🌦️', label: 'Heavy drizzle' },
  61: { emoji: '🌧️', label: 'Light rain' },
  63: { emoji: '🌧️', label: 'Rain' },
  65: { emoji: '🌧️', label: 'Heavy rain' },
  71: { emoji: '🌨️', label: 'Light snow' },
  73: { emoji: '🌨️', label: 'Snow' },
  75: { emoji: '🌨️', label: 'Heavy snow' },
  77: { emoji: '🌨️', label: 'Snow grains' },
  80: { emoji: '🌧️', label: 'Light showers' },
  81: { emoji: '🌧️', label: 'Showers' },
  82: { emoji: '🌧️', label: 'Heavy showers' },
  85: { emoji: '🌨️', label: 'Light snow showers' },
  86: { emoji: '🌨️', label: 'Snow showers' },
  95: { emoji: '⛈️', label: 'Thunderstorm' },
  96: { emoji: '⛈️', label: 'Thunderstorm with hail' },
  99: { emoji: '⛈️', label: 'Thunderstorm with heavy hail' }
}

export function getWeatherInfo(code: number): { emoji: string; label: string } {
  return WMO_MAP[code] || { emoji: '🌡️', label: 'Unknown' }
}

const LOCATION_KEY = 'weather_location'

function loadLocation(): WeatherLocation | null {
  try {
    const stored = localStorage.getItem(LOCATION_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return null
}

function saveLocation(loc: WeatherLocation) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc))
}

export const useWeatherStore = defineStore('weather', () => {
  const location = ref<WeatherLocation | null>(loadLocation())
  const current = ref<CurrentWeather | null>(null)
  const daily = ref<DailyForecast[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasLocation = computed(() => location.value !== null)

  async function fetchWeather() {
    if (!location.value) return

    loading.value = true
    error.value = null

    try {
      const { lat, lng } = location.value
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&current=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=auto`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch weather')

      const data = await res.json()

      current.value = {
        temperature: Math.round(data.current.temperature_2m),
        weathercode: data.current.weathercode
      }

      daily.value = data.daily.time.map((date: string, i: number) => {
        const d = new Date(date + 'T00:00:00')
        return {
          date,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
          weathercode: data.daily.weathercode[i]
        }
      })
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch weather'
    } finally {
      loading.value = false
    }
  }

  async function detectLocation(): Promise<boolean> {
    if (!navigator.geolocation) {
      error.value = 'Geolocation not supported'
      return false
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          // Reverse geocode to get city name
          try {
            const res = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${latitude}&longitude=${longitude}&count=1&language=en`
            )
            // Open-Meteo geocoding doesn't support reverse geocoding directly,
            // so we'll use a simple label
            const name = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
            setLocation(latitude, longitude, name)
            resolve(true)
          } catch {
            setLocation(latitude, longitude, `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`)
            resolve(true)
          }
        },
        () => {
          error.value = 'Location access denied'
          resolve(false)
        },
        { timeout: 10000 }
      )
    })
  }

  async function searchCities(query: string): Promise<GeocodingResult[]> {
    if (!query || query.length < 2) return []

    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`
      )
      const data = await res.json()
      return (data.results || []).map((r: any) => ({
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country || '',
        admin1: r.admin1
      }))
    } catch {
      return []
    }
  }

  function setLocation(lat: number, lng: number, name: string) {
    location.value = { lat, lng, name }
    saveLocation(location.value)
    fetchWeather()
  }

  return {
    location,
    current,
    daily,
    loading,
    error,
    hasLocation,
    fetchWeather,
    detectLocation,
    searchCities,
    setLocation
  }
})
