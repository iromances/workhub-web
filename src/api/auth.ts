import type { LoginRequest, LoginResponse } from '@/types/auth'
import type { ApiResponse } from '@/types/http'

import http from './http'

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await http.post<ApiResponse<LoginResponse>>('/auth/login', request)
  return response.data.data
}
