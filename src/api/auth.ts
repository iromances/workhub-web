import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UpdateProfileRequest,
  UserProfileResponse,
} from '@/types/auth'
import type { ApiResponse } from '@/types/http'

import http from './http'

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await http.post<ApiResponse<LoginResponse>>('/auth/login', request)
  return response.data.data
}

export async function fetchCurrentUser(): Promise<UserProfileResponse> {
  const response = await http.get<ApiResponse<UserProfileResponse>>('/auth/me')
  return response.data.data
}

export async function changePassword(request: ChangePasswordRequest): Promise<void> {
  await http.post<ApiResponse<void>>('/auth/change-password', request)
}

export async function updateProfile(request: UpdateProfileRequest): Promise<UserProfileResponse> {
  const response = await http.put<ApiResponse<UserProfileResponse>>('/auth/me', request)
  return response.data.data
}

export async function uploadProfileAvatar(file: File): Promise<UserProfileResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post<ApiResponse<UserProfileResponse>>('/auth/me/avatar', formData)
  return response.data.data
}
