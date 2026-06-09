import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  WorkItemAssignRequest,
  WorkItemCreateRequest,
  WorkItemDetail,
  WorkItemFollowUp,
  WorkItemFollowUpRequest,
  WorkItemSummary,
  WorkItemTransition,
  WorkItemTransitionRequest,
  WorkItemUpdateRequest,
} from '@/types/work-item'

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

export async function createWorkItem(request: WorkItemCreateRequest): Promise<WorkItemDetail> {
  const response = await http.post<ApiResponse<WorkItemDetail>>('/work-items', request)
  return response.data.data
}

export async function updateWorkItem(id: number, request: WorkItemUpdateRequest): Promise<WorkItemDetail> {
  const response = await http.put<ApiResponse<WorkItemDetail>>(`/work-items/${id}`, request)
  return response.data.data
}

export async function assignWorkItem(id: number, request: WorkItemAssignRequest): Promise<WorkItemDetail> {
  const response = await http.post<ApiResponse<WorkItemDetail>>(`/work-items/${id}/assign`, request)
  return response.data.data
}

export async function fetchWorkItemFollowUps(id: number): Promise<WorkItemFollowUp[]> {
  const response = await http.get<ApiResponse<PageResponse<WorkItemFollowUp>>>(`/work-items/${id}/follow-ups`)
  return response.data.data.items
}

export async function addWorkItemFollowUp(id: number, request: WorkItemFollowUpRequest): Promise<WorkItemFollowUp> {
  const response = await http.post<ApiResponse<WorkItemFollowUp>>(`/work-items/${id}/follow-ups`, request)
  return response.data.data
}

export async function fetchWorkItemTransitions(id: number): Promise<WorkItemTransition[]> {
  const response = await http.get<ApiResponse<PageResponse<WorkItemTransition>>>(`/work-items/${id}/transitions`)
  return response.data.data.items
}

export async function transitionWorkItem(id: number, request: WorkItemTransitionRequest): Promise<WorkItemTransition> {
  const response = await http.post<ApiResponse<WorkItemTransition>>(`/work-items/${id}/transitions`, request)
  return response.data.data
}
