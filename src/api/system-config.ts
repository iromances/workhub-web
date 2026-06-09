import type { ApiResponse, PageResponse } from '@/types/http'
import type { DeveloperResource, DeveloperResourceSaveRequest, SysConfigItem, SysConfigSaveRequest, UserOption } from '@/types/work-item'

import http from './http'

export async function fetchSystemConfigs(params?: { configGroup?: string; keyword?: string }): Promise<SysConfigItem[]> {
  const response = await http.get<ApiResponse<PageResponse<SysConfigItem>>>('/system/configs', { params })
  return response.data.data.items
}

export async function createSystemConfig(request: SysConfigSaveRequest): Promise<SysConfigItem> {
  const response = await http.post<ApiResponse<SysConfigItem>>('/system/configs', request)
  return response.data.data
}

export async function updateSystemConfig(id: number, request: SysConfigSaveRequest): Promise<SysConfigItem> {
  const response = await http.put<ApiResponse<SysConfigItem>>(`/system/configs/${id}`, request)
  return response.data.data
}

export async function fetchDeveloperOptions(): Promise<UserOption[]> {
  const response = await http.get<ApiResponse<PageResponse<UserOption>>>('/system/developer-options')
  return response.data.data.items
}

export async function fetchDeveloperResources(params?: { keyword?: string }): Promise<DeveloperResource[]> {
  const response = await http.get<ApiResponse<PageResponse<DeveloperResource>>>('/system/developers', { params })
  return response.data.data.items
}

export async function createDeveloperResource(request: DeveloperResourceSaveRequest): Promise<DeveloperResource> {
  const response = await http.post<ApiResponse<DeveloperResource>>('/system/developers', request)
  return response.data.data
}

export async function updateDeveloperResource(id: number, request: DeveloperResourceSaveRequest): Promise<DeveloperResource> {
  const response = await http.put<ApiResponse<DeveloperResource>>(`/system/developers/${id}`, request)
  return response.data.data
}

export async function deleteDeveloperResource(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/system/developers/${id}`)
}
