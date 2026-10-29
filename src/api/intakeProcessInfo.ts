import type { ApiResponse } from '@/types/http'
import type { IntakeProcessInfo, IntakeProcessInfoUpdateRequest } from '@/types/intakeProcessInfo'
import http from './http'

export async function fetchIntakeProcessInfo(id: number): Promise<IntakeProcessInfo> {
  const response = await http.get<ApiResponse<IntakeProcessInfo>>(`/intake/${id}/process-info`)
  return response.data.data
}

export async function updateIntakeProcessInfo(id: number, request: IntakeProcessInfoUpdateRequest): Promise<IntakeProcessInfo> {
  const response = await http.post<ApiResponse<IntakeProcessInfo>>(`/intake/${id}/process-info`, request)
  return response.data.data
}
