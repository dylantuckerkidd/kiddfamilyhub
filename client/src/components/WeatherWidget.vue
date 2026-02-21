<script setup lang="ts">
import { useWeatherStore, getWeatherInfo } from '@/stores/weather'
import { RouterLink } from 'vue-router'

const weather = useWeatherStore()

const fiveDayForecast = () => weather.daily.slice(0, 5)
</script>

<template>
  <div class="card p-4">
    <!-- Loading skeleton -->
    <div v-if="weather.loading && !weather.current" class="flex items-center gap-4">
      <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
      </div>
    </div>

    <!-- No location state -->
    <div v-else-if="!weather.hasLocation && !weather.loading" class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl">
          🌤️
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">Weather</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Set your location to see weather</p>
        </div>
      </div>
      <RouterLink
        to="/weather"
        class="px-3 py-1.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
      >
        Set up
      </RouterLink>
    </div>

    <!-- Weather loaded -->
    <template v-else-if="weather.current">
      <!-- Current conditions row -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl">{{ getWeatherInfo(weather.current.weathercode).emoji }}</span>
          <div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ weather.current.temperature }}°</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ getWeatherInfo(weather.current.weathercode).label }}</span>
            </div>
            <RouterLink
              to="/weather"
              class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {{ weather.location?.name }}
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- 5-day mini forecast -->
      <div class="flex gap-1">
        <div
          v-for="day in fiveDayForecast()"
          :key="day.date"
          class="flex-1 text-center py-2 px-1 rounded-lg bg-gray-50 dark:bg-gray-700/50"
        >
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ day.dayName }}</div>
          <div class="text-base my-0.5">{{ getWeatherInfo(day.weathercode).emoji }}</div>
          <div class="text-xs font-semibold text-gray-900 dark:text-white">{{ day.high }}°</div>
          <div class="text-xs text-gray-400 dark:text-gray-500">{{ day.low }}°</div>
        </div>
      </div>
    </template>

    <!-- Error state -->
    <div v-else-if="weather.error" class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl">
        ⚠️
      </div>
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">Weather unavailable</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ weather.error }}</p>
      </div>
    </div>
  </div>
</template>
