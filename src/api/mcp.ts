import type { ApiResponse, PageResponse } from '@/types/http'
import type { McpAuditEntry, McpCatalog, McpResource, McpResourceSaveRequest, McpResourceType } from '@/types/mcp'

import http from './http'

export async function fetchMcpResources(params?: {
  resourceType?: McpResourceType | ''
  businessLineCode?: string
  environmentCode?: string
  keyword?: string
  enabledOnly?: boolean
}): Promise<McpResource[]> {
  const response = await http.get<ApiResponse<PageResponse<McpResource>>>('/mcp/resources', { params })
  return response.data.data.items
}

export async function createMcpResource(request: McpResourceSaveRequest): Promise<McpResource> {
  const response = await http.post<ApiResponse<McpResource>>('/mcp/resources', request)
  return response.data.data
}

export async function updateMcpResource(id: number, request: McpResourceSaveRequest): Promise<McpResource> {
  const response = await http.put<ApiResponse<McpResource>>(`/mcp/resources/${id}`, request)
  return response.data.data
}

export async function deleteMcpResource(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/mcp/resources/${id}`)
}

export async function fetchMcpCatalog(): Promise<McpCatalog> {
  const response = await http.get<ApiResponse<McpCatalog>>('/mcp/catalog')
  return response.data.data
}

export async function fetchMcpAudits(limit = 100): Promise<McpAuditEntry[]> {
  const response = await http.get<ApiResponse<PageResponse<McpAuditEntry>>>('/mcp/audits', { params: { limit } })
  return response.data.data.items
}
