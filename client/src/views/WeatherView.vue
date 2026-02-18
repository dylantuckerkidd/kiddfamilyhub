<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWeatherStore, getWeatherInfo, type GeocodingResult } from '@/stores/weather'

const weather = useWeatherStore()

const searchQuery = ref('')
const searchResults = ref<GeocodingResult[]>([])
const showDropdown = ref(false)
const searching = ref(false)
const detectingLocation = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    searchResults.value = await weather.searchCities(searchQuery.value)
    showDropdown.value = searchResults.value.length > 0
    searching.value = false
  }, 300)
}

function selectCity(result: GeocodingResult) {
  const name = result.admin1
    ? `${result.name}, ${result.admin1}`
    : `${result.name}, ${result.country}`
  weather.setLocation(result.latitude, result.longitude, name)
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
}

async function useMyLocation() {
  detectingLocation.value = true
  await weather.detectLocation()
  detectingLocation.value = false
}

onMounted(() => {
  if (weather.hasLocation && !weather.current) {
    weather.fetchWeather()
  }
})

const refresh = () => window.location.reload()
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Weather</h1>
          <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Local forecast and conditions</p>
      </div>
    </div>

    <!-- Location search -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 relative">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            @focus="showDropdown = searchResults.length > 0"
            type="text"
            placeholder="Search for a city..."
            class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
          />
          <!-- Search dropdown -->
          <div
            v-if="showDropdown"
            class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
          >
            <button
              v-for="result in searchResults"
              :key="`${result.latitude}-${result.longitude}`"
              @click="selectCity(result)"
              class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ result.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ result.admin1 ? `${result.admin1}, ` : '' }}{{ result.country }}
                </div>
              </div>
            </button>
          </div>
        </div>
        <button
          @click="useMyLocation"
          :disabled="detectingLocation"
          class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center gap-2 justify-center text-sm"
        >
          <svg v-if="!detectingLocation" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Use my location
        </button>
      </div>

      <div v-if="weather.location" class="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {{ weather.location.name }}
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="weather.loading && !weather.current" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 sm:p-16">
      <div class="flex flex-col items-center justify-center gap-3">
        <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-500 dark:text-gray-400 text-sm">Loading weather...</span>
      </div>
    </div>

    <!-- No location -->
    <div v-else-if="!weather.hasLocation" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 sm:p-16 text-center">
      <div class="text-4xl mb-3">🌤️</div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">No location set</p>
      <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Search for a city or use your current location</p>
    </div>

    <!-- Current conditions hero -->
    <template v-else-if="weather.current">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
        <div class="flex items-center gap-4 sm:gap-6">
          <span class="text-5xl sm:text-6xl">{{ getWeatherInfo(weather.current.weathercode).emoji }}</span>
          <div>
            <div class="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">{{ weather.current.temperature }}°F</div>
            <div class="text-lg text-gray-500 dark:text-gray-400 mt-1">{{ getWeatherInfo(weather.current.weathercode).label }}</div>
          </div>
        </div>
        <div v-if="weather.daily.length > 0" class="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>H: {{ weather.daily[0].high }}° L: {{ weather.daily[0].low }}°</span>
          <span v-if="weather.daily[0].precipitationProbability > 0">
            💧 {{ weather.daily[0].precipitationProbability }}% precip
          </span>
        </div>
      </div>

      <!-- 7-day forecast -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 class="font-semibold text-gray-900 dark:text-white">7-Day Forecast</h2>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div
            v-for="(day, i) in weather.daily"
            :key="day.date"
            class="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4"
          >
            <div class="w-12 text-sm font-medium text-gray-900 dark:text-white">
              {{ i === 0 ? 'Today' : day.dayName }}
            </div>
            <span class="text-xl sm:text-2xl w-8 text-center">{{ getWeatherInfo(day.weathercode).emoji }}</span>
            <div class="flex-1 text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              {{ getWeatherInfo(day.weathercode).label }}
            </div>
            <div v-if="day.precipitationProbability > 0" class="text-xs text-blue-500 dark:text-blue-400 w-12 text-right">
              💧 {{ day.precipitationProbability }}%
            </div>
            <div v-else class="w-12"></div>
            <div class="w-20 flex items-center justify-end gap-2 text-sm">
              <span class="font-semibold text-gray-900 dark:text-white">{{ day.high }}°</span>
              <span class="text-gray-400 dark:text-gray-500">{{ day.low }}°</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-if="weather.error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">
      {{ weather.error }}
    </div>
  </div>
</template>
