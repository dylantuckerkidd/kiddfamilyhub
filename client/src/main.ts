import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize auth store before mounting so router guard has session data
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
auth.initialize().then(() => {
  app.mount('#app')
})
