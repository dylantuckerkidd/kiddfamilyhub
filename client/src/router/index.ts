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
