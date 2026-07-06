export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  userName: string
  displayName?: string
  mustChangePassword?: boolean
  roles?: string[]
  permissions?: string[]
}

export interface UserProfileResponse {
  userName: string
  displayName: string
  mustChangePassword: boolean
  roles: string[]
  permissions: string[]
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}
