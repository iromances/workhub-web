import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  IntegrationApiCatalog,
  IntegrationApiCatalogQuery,
  IntegrationProbeResult,
  IntegrationSystem,
  IntegrationSystemConfig,
  IntegrationSystemConfigSaveRequest,
  IntegrationSystemDetail,
  IntegrationSystemSaveRequest,
} from '@/types/integration'

import http from './http'

export async function fetchIntegrationApis(id: number, query: IntegrationApiCatalogQuery = {}): Promise<IntegrationApiCatalog> {
  const response = await http.get<ApiResponse<IntegrationApiCatalog>>(`/system/integrations/${id}/apis`, { params: query })
  return response.data.data
}

export async function fetchIntegrationSystems(): Promise<IntegrationSystem[]> {
  const response = await http.get<ApiResponse<PageResponse<IntegrationSystem>>>('/system/integrations')
  return response.data.data.items
}

export async function fetchIntegrationSystem(id: number): Promise<IntegrationSystemDetail> {
  const response = await http.get<ApiResponse<IntegrationSystemDetail>>(`/system/integrations/${id}`)
  return response.data.data
}

export async function fetchIntegrationSystemConfig(id: number): Promise<IntegrationSystemConfig> {
  const response = await http.get<ApiResponse<IntegrationSystemConfig>>(`/system/integrations/${id}/config`)
  return response.data.data
}

export async function saveIntegrationSystemConfig(
  id: number,
  request: IntegrationSystemConfigSaveRequest,
): Promise<IntegrationSystemConfig> {
  const response = await http.put<ApiResponse<IntegrationSystemConfig>>(`/system/integrations/${id}/config`, request)
  return response.data.data
}

export async function createIntegrationSystem(request: IntegrationSystemSaveRequest): Promise<IntegrationSystemDetail> {
  const response = await http.post<ApiResponse<IntegrationSystemDetail>>('/system/integrations', request)
  return response.data.data
}

export async function updateIntegrationSystem(id: number, request: IntegrationSystemSaveRequest): Promise<IntegrationSystemDetail> {
  const response = await http.put<ApiResponse<IntegrationSystemDetail>>(`/system/integrations/${id}`, request)
  return response.data.data
}

export async function probeIntegrationSystem(id: number): Promise<IntegrationProbeResult> {
  const response = await http.post<ApiResponse<IntegrationProbeResult>>(`/system/integrations/${id}/probe`)
  return response.data.data
}
