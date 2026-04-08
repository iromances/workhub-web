import type { ApiResponse, PageResponse } from '@/types/http'
import type { IntakeDetail, IntakeStageActionRequest, IntakeSummary } from '@/types/work-item'

import http from './http'

export async function fetchIntakeRecords(params?: {
  status?: string
  sourceType?: string
  keyword?: string
  demandStatus?: string
  enrichmentStatus?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<IntakeSummary>> {
  const response = await http.get<ApiResponse<PageResponse<IntakeSummary>>>('/intake', { params })
  return response.data.data
}

export async function fetchIntakeDetail(id: number, recordView = true): Promise<IntakeDetail> {
  const response = await http.get<ApiResponse<IntakeDetail>>(`/intake/${id}`, { params: { recordView } })
  return response.data.data
}

export async function createUploadIntake(formData: FormData): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>('/intake/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data.data
}


export async function advanceIntakeStage(id: number, request: IntakeStageActionRequest | FormData): Promise<IntakeDetail> {
  const isFormData = typeof FormData !== 'undefined' && request instanceof FormData
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/stage-actions`, request, isFormData ? {
    headers: { 'Content-Type': 'multipart/form-data' },
  } : undefined)
  return response.data.data
}

export async function updateIntakeZentaoLink(id: number, zentaoUrl: string): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/zentao-link`, { zentaoUrl })
  return response.data.data
}

export async function downloadAttachment(id: number): Promise<Blob> {
  const response = await http.get(`/attachments/${id}/download`, { responseType: 'blob' })
  return response.data as Blob
}
