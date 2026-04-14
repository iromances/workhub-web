import type { ApiResponse, PageResponse } from '@/types/http'
import type { ProjectSummary } from '@/types/work-item'

import http from './http'

export async function fetchProjects(params?: { status?: string; keyword?: string }): Promise<ProjectSummary[]> {
  const response = await http.get<ApiResponse<PageResponse<ProjectSummary>>>('/projects', { params })
  return response.data.data.items
}

export interface ProjectCreateRequest {
  code: string
  name: string
  type: string
  ownerUserName: string
  status: string
  description?: string
}

export async function createProject(request: ProjectCreateRequest): Promise<void> {
  await http.post<ApiResponse<unknown>>('/projects', request)
}
