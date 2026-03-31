import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  IntakeConvertRequest,
  IntakeConvertResponse,
  IntakeCreateRequest,
  IntakeDetail,
  IntakeSummary,
} from '@/types/work-item'

import http from './http'

export async function fetchIntakeRecords(params?: {
  status?: string
  sourceType?: string
  keyword?: string
}): Promise<IntakeSummary[]> {
  const response = await http.get<ApiResponse<PageResponse<IntakeSummary>>>('/intake', { params })
  return response.data.data.items
}

export async function fetchIntakeDetail(id: number): Promise<IntakeDetail> {
  const response = await http.get<ApiResponse<IntakeDetail>>(`/intake/${id}`)
  return response.data.data
}

export async function createManualIntake(request: IntakeCreateRequest): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>('/intake/manual', request)
  return response.data.data
}

export async function createPastedIntake(request: IntakeCreateRequest): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>('/intake/paste', request)
  return response.data.data
}

export async function createUploadIntake(formData: FormData): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>('/intake/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data.data
}

export async function generateIntakeAiDraft(id: number, provider?: string): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/ai-draft`, null, {
    params: provider ? { provider } : undefined,
  })
  return response.data.data
}

export async function convertIntakeToWorkItem(id: number, request: IntakeConvertRequest): Promise<IntakeConvertResponse> {
  const response = await http.post<ApiResponse<IntakeConvertResponse>>(`/intake/${id}/convert`, request)
  return response.data.data
}

export async function downloadAttachment(id: number): Promise<Blob> {
  const response = await http.get(`/attachments/${id}/download`, { responseType: 'blob' })
  return response.data as Blob
}
