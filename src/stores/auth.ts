import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { login } from '@/api/auth'
import type { LoginRequest } from '@/types/auth'

const TOKEN_KEY = 'workhub_token'
const USER_NAME_KEY = 'workhub_user_name'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const userName = ref(localStorage.getItem(USER_NAME_KEY) ?? '')

  const isAuthenticated = computed(() => Boolean(token.value))

  async function signIn(request: LoginRequest) {
    const response = await login(request)
    token.value = response.token
    userName.value = response.userName
    localStorage.setItem(TOKEN_KEY, response.token)
    localStorage.setItem(USER_NAME_KEY, response.userName)
  }

  function signOut() {
    token.value = ''
    userName.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_NAME_KEY)
  }

  return {
    token,
    userName,
    isAuthenticated,
    signIn,
    signOut,
  }
})
