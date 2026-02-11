import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/calendar'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/budget',
      name: 'budget-dashboard',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/budget/transactions',
      name: 'transactions',
      component: () => import('@/views/TransactionsView.vue')
    },
    {
      path: '/budget/budgets',
      name: 'budgets',
      component: () => import('@/views/BudgetsView.vue')
    },
    {
      path: '/budget/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue')
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
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('@/views/MaintenanceLogView.vue')
    }
  ]
})

let verified = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (auth.isAuthenticated) {
      const valid = await auth.verify()
      if (valid) {
        verified = true
        return '/'
      }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  // Verify token server-side once per page load
  if (!verified) {
    const valid = await auth.verify()
    if (!valid) {
      return '/login'
    }
    verified = true
  }

  return true
})

export default router
