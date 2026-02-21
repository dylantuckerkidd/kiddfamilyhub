import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/digest'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue')
    },
    {
      path: '/digest',
      name: 'digest',
      component: () => import('@/views/DigestView.vue')
    },
    {
      path: '/weather',
      name: 'weather',
      component: () => import('@/views/WeatherView.vue')
    },
    {
      path: '/grocery',
      name: 'grocery',
      component: () => import('@/views/GroceryListView.vue')
    },
    {
      path: '/todos',
      name: 'todos',
      component: () => import('@/views/TodoListView.vue')
    },
    {
      path: '/meals',
      name: 'meals',
      component: () => import('@/views/MealPlanView.vue')
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('@/views/MaintenanceLogView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for auth to initialize
  if (auth.loading) {
    await auth.initialize()
  }

  if (to.path === '/login') {
    if (auth.isAuthenticated) return '/'
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  return true
})

export default router
