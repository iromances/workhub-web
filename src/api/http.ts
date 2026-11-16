import axios from 'axios'

import { useAuthStore } from '@/stores/auth'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

function isAuthExpired(payload: unknown): boolean {
  const body = payload as { code?: number; message?: string } | undefined
  return body?.code === 1 && String(body.message ?? '').includes('登录已失效')
}

function handleAuthExpired() {
  const authStore = useAuthStore()
  authStore.signOut()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

http.interceptors.response.use(
  (response) => {
    // 个别接口/网关会把认证失败包装成 HTTP 200 + 业务码，同样按会话失效处理
    if (isAuthExpired(response.data)) {
      handleAuthExpired()
    }
    return response
  },
  (error) => {
    const status = error.response?.status
    if (status === 401 || (status !== undefined && isAuthExpired(error.response?.data))) {
      handleAuthExpired()
    }
    return Promise.reject(error)
  },
)

export default http
