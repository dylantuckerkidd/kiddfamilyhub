import { useAuthStore } from '@/stores/auth'
import router from '@/router'

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const auth = useAuthStore()

  const headers = new Headers(options.headers)
  if (auth.token) {
    headers.set('Authorization', `Bearer ${auth.token}`)
  }

  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      auth.logout()
      router.push('/login')
    }
    return res
  })
}
