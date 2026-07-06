import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { fetchCurrentUser, login } from '@/api/auth'
import type { LoginRequest } from '@/types/auth'

const TOKEN_KEY = 'workhub_token'
const USER_NAME_KEY = 'workhub_user_name'
const DISPLAY_NAME_KEY = 'workhub_display_name'
const ROLES_KEY = 'workhub_roles'
const PERMISSIONS_KEY = 'workhub_permissions'
const MUST_CHANGE_PASSWORD_KEY = 'workhub_must_change_password'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const userName = ref(localStorage.getItem(USER_NAME_KEY) ?? '')
  const displayName = ref(localStorage.getItem(DISPLAY_NAME_KEY) ?? '')
  const roles = ref<string[]>(readJsonArray(ROLES_KEY))
  const permissions = ref<string[]>(readJsonArray(PERMISSIONS_KEY))
  const mustChangePassword = ref(localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true')
  const profileLoaded = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))

  async function signIn(request: LoginRequest) {
    const response = await login(request)
    token.value = response.token
    userName.value = response.userName
    displayName.value = response.displayName || response.userName
    roles.value = response.roles || []
    permissions.value = response.permissions || []
    mustChangePassword.value = Boolean(response.mustChangePassword)
    profileLoaded.value = true
    localStorage.setItem(TOKEN_KEY, response.token)
    localStorage.setItem(USER_NAME_KEY, response.userName)
    persistProfile()
  }

  async function loadProfile() {
    if (!token.value) {
      return
    }
    const profile = await fetchCurrentUser()
    userName.value = profile.userName
    displayName.value = profile.displayName
    roles.value = profile.roles || []
    permissions.value = profile.permissions || []
    mustChangePassword.value = Boolean(profile.mustChangePassword)
    profileLoaded.value = true
    localStorage.setItem(USER_NAME_KEY, profile.userName)
    persistProfile()
  }

  function signOut() {
    token.value = ''
    userName.value = ''
    displayName.value = ''
    roles.value = []
    permissions.value = []
    mustChangePassword.value = false
    profileLoaded.value = false
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_NAME_KEY)
    localStorage.removeItem(DISPLAY_NAME_KEY)
    localStorage.removeItem(ROLES_KEY)
    localStorage.removeItem(PERMISSIONS_KEY)
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY)
  }

  function hasPermission(permission?: string) {
    if (!permission) {
      return true
    }
    return permissions.value.includes(permission)
  }

  function hasAnyPermission(permissionList: string[]) {
    if (!permissionList.length) {
      return true
    }
    return permissionList.some((permission) => hasPermission(permission))
  }

  function persistProfile() {
    localStorage.setItem(DISPLAY_NAME_KEY, displayName.value)
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles.value))
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions.value))
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(mustChangePassword.value))
  }

  return {
    token,
    userName,
    displayName,
    roles,
    permissions,
    mustChangePassword,
    profileLoaded,
    isAuthenticated,
    signIn,
    loadProfile,
    signOut,
    hasPermission,
    hasAnyPermission,
  }
})

function readJsonArray(key: string): string[] {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}
