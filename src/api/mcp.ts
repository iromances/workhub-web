import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  McpAuditEntry,
  McpBastion,
  McpBastionConnectionTestRequest,
  McpBastionConnectionTestResult,
  McpBastionSaveRequest,
  McpCatalog,
  McpDatabaseConnectionTestRequest,
  McpDatabaseConnectionTestResult,
  McpResource,
  McpResourceSaveRequest,
  McpResourceType,
  McpServerConnectionTestRequest,
  McpServerConnectionTestResult,
} from '@/types/mcp'

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

export async function fetchMcpBastions(params?: {
  keyword?: string
  enabledOnly?: boolean
}): Promise<McpBastion[]> {
  const response = await http.get<ApiResponse<PageResponse<McpBastion>>>('/mcp/bastions', { params })
  return response.data.data.items
}

export async function createMcpBastion(request: McpBastionSaveRequest): Promise<McpBastion> {
  const response = await http.post<ApiResponse<McpBastion>>('/mcp/bastions', request)
  return response.data.data
}

export async function updateMcpBastion(id: number, request: McpBastionSaveRequest): Promise<McpBastion> {
  const response = await http.put<ApiResponse<McpBastion>>(`/mcp/bastions/${id}`, request)
  return response.data.data
}

export async function testMcpBastionConnection(
  request: McpBastionConnectionTestRequest,
): Promise<McpBastionConnectionTestResult> {
  const response = await http.post<ApiResponse<McpBastionConnectionTestResult>>(
    '/mcp/bastions/test-connection',
    request,
  )
  return response.data.data
}

export async function testMcpDatabaseConnection(
  request: McpDatabaseConnectionTestRequest,
): Promise<McpDatabaseConnectionTestResult> {
  const response = await http.post<ApiResponse<McpDatabaseConnectionTestResult>>(
    '/mcp/resources/test-database-connection',
    request,
  )
  return response.data.data
}

export async function testMcpServerConnection(
  request: McpServerConnectionTestRequest,
): Promise<McpServerConnectionTestResult> {
  const response = await http.post<ApiResponse<McpServerConnectionTestResult>>(
    '/mcp/resources/test-server-connection',
    request,
  )
  return response.data.data
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

export async function fetchMcpAudits(params?: {
  pageNum?: number
  pageSize?: number
}): Promise<PageResponse<McpAuditEntry>> {
  const response = await http.get<ApiResponse<PageResponse<McpAuditEntry>>>('/mcp/audits', { params })
  return response.data.data
}
