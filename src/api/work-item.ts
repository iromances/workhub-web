import type { ApiResponse, PageResponse } from '@/types/http'
import type { WorkItemDetail, WorkItemFollowUp, WorkItemSummary } from '@/types/work-item'

import http from './http'

export async function fetchWorkItems(params?: {
  projectId?: number
  status?: string
  type?: string
  keyword?: string
}): Promise<WorkItemSummary[]> {
  const response = await http.get<ApiResponse<PageResponse<WorkItemSummary>>>('/work-items', { params })
  return response.data.data.items
}

export async function fetchWorkItemDetail(id: number): Promise<WorkItemDetail> {
  const response = await http.get<ApiResponse<WorkItemDetail>>(`/work-items/${id}`)
  return response.data.data
}

export async function fetchWorkItemFollowUps(id: number): Promise<WorkItemFollowUp[]> {
  const response = await http.get<ApiResponse<PageResponse<WorkItemFollowUp>>>(`/work-items/${id}/follow-ups`)
  return response.data.data.items
}
