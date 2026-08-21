import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { fetchCurrentUser, login, updateProfile as updateProfileApi, uploadProfileAvatar } from '@/api/auth'
import type { LoginRequest, UpdateProfileRequest, UserProfileResponse } from '@/types/auth'

const TOKEN_KEY = 'workhub_token'
const USER_NAME_KEY = 'workhub_user_name'
const DISPLAY_NAME_KEY = 'workhub_display_name'
const AVATAR_URL_KEY = 'workhub_avatar_url'
const ROLES_KEY = 'workhub_roles'
const PERMISSIONS_KEY = 'workhub_permissions'
const MUST_CHANGE_PASSWORD_KEY = 'workhub_must_change_password'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const userName = ref(localStorage.getItem(USER_NAME_KEY) ?? '')
  const displayName = ref(localStorage.getItem(DISPLAY_NAME_KEY) ?? '')
  const avatarUrl = ref(localStorage.getItem(AVATAR_URL_KEY) ?? '')
  const roles = ref<string[]>(readJsonArray(ROLES_KEY))
  const permissions = ref<string[]>(readJsonArray(PERMISSIONS_KEY))
  const mustChangePassword = ref(localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true')
  const profileLoaded = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const avatarDisplayUrl = computed(() => resolveAssetUrl(avatarUrl.value))

  async function signIn(request: LoginRequest) {
    const response = await login(request)
    token.value = response.token
    applyProfile({
      userName: response.userName,
      displayName: response.displayName || response.userName,
      avatarUrl: response.avatarUrl,
      roles: response.roles || [],
      permissions: response.permissions || [],
      mustChangePassword: Boolean(response.mustChangePassword),
    })
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
    applyProfile(profile)
    profileLoaded.value = true
    persistProfile()
  }

  async function updateProfile(request: UpdateProfileRequest) {
    const profile = await updateProfileApi(request)
    applyProfile(profile)
    profileLoaded.value = true
    persistProfile()
  }

  async function uploadAvatar(file: File) {
    const profile = await uploadProfileAvatar(file)
    applyProfile(profile)
    profileLoaded.value = true
    persistProfile()
  }

  function signOut() {
    token.value = ''
    userName.value = ''
    displayName.value = ''
    avatarUrl.value = ''
    roles.value = []
    permissions.value = []
    mustChangePassword.value = false
    profileLoaded.value = false
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_NAME_KEY)
    localStorage.removeItem(DISPLAY_NAME_KEY)
    localStorage.removeItem(AVATAR_URL_KEY)
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
    localStorage.setItem(USER_NAME_KEY, userName.value)
    localStorage.setItem(DISPLAY_NAME_KEY, displayName.value)
    if (avatarUrl.value) {
      localStorage.setItem(AVATAR_URL_KEY, avatarUrl.value)
    } else {
      localStorage.removeItem(AVATAR_URL_KEY)
    }
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles.value))
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions.value))
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(mustChangePassword.value))
  }

  function applyProfile(profile: UserProfileResponse) {
    userName.value = profile.userName
    displayName.value = profile.displayName || profile.userName
    avatarUrl.value = profile.avatarUrl || ''
    roles.value = profile.roles || []
    permissions.value = profile.permissions || []
    mustChangePassword.value = Boolean(profile.mustChangePassword)
  }

  return {
    token,
    userName,
    displayName,
    avatarUrl,
    avatarDisplayUrl,
    roles,
    permissions,
    mustChangePassword,
    profileLoaded,
    isAuthenticated,
    signIn,
    loadProfile,
    updateProfile,
    uploadAvatar,
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

function resolveAssetUrl(value: string) {
  if (!value || /^https?:\/\//i.test(value)) {
    return value
  }
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
  if (value.startsWith('/api') && apiBaseUrl.endsWith('/api')) {
    return `${apiBaseUrl.slice(0, -4)}${value}`
  }
  return value
}
