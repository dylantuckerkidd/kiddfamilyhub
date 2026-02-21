import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { getWeatherInfo, useWeatherStore } from '@/stores/weather'

describe('getWeatherInfo', () => {
  it('returns clear sky for code 0', () => {
    expect(getWeatherInfo(0)).toEqual({ emoji: '☀️', label: 'Clear sky' })
  })

  it('returns thunderstorm for code 95', () => {
    expect(getWeatherInfo(95)).toEqual({ emoji: '⛈️', label: 'Thunderstorm' })
  })

  it('returns unknown for unrecognized code', () => {
    expect(getWeatherInfo(999)).toEqual({ emoji: '🌡️', label: 'Unknown' })
  })

  it('returns correct values for fog (45)', () => {
    expect(getWeatherInfo(45)).toEqual({ emoji: '🌫️', label: 'Fog' })
  })
})

describe('useWeatherStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('hasLocation is false when no location set', () => {
    const store = useWeatherStore()
    expect(store.hasLocation).toBe(false)
  })

  it('hasLocation is true when location exists', () => {
    localStorage.setItem('weather_location', JSON.stringify({ lat: 40, lng: -74, name: 'NYC' }))
    // Need a fresh pinia so the store re-reads localStorage
    setActivePinia(createPinia())
    const store = useWeatherStore()
    expect(store.hasLocation).toBe(true)
    expect(store.location?.name).toBe('NYC')
  })
})
