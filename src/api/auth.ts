import type { ChangePasswordRequest, LoginRequest, LoginResponse, UserProfileResponse } from '@/types/auth'
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
