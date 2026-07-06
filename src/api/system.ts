import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  SysLoginLog,
  SysOperationLog,
  SysPermission,
  SysRole,
  SysRoleSaveRequest,
  SysUser,
  SysUserCreateResponse,
  SysUserSaveRequest,
} from '@/types/system'

import http from './http'

export async function fetchSystemUsers(params?: { keyword?: string; status?: string }): Promise<SysUser[]> {
  const response = await http.get<ApiResponse<PageResponse<SysUser>>>('/system/users', { params })
  return response.data.data.items
}

export async function createSystemUser(request: SysUserSaveRequest): Promise<SysUserCreateResponse> {
  const response = await http.post<ApiResponse<SysUserCreateResponse>>('/system/users', request)
  return response.data.data
}

export async function updateSystemUser(id: number, request: SysUserSaveRequest): Promise<SysUser> {
  const response = await http.put<ApiResponse<SysUser>>(`/system/users/${id}`, request)
  return response.data.data
}

export async function updateSystemUserStatus(id: number, status: string): Promise<SysUser> {
  const response = await http.post<ApiResponse<SysUser>>(`/system/users/${id}/status`, { status })
  return response.data.data
}

export async function resetSystemUserPassword(id: number): Promise<string> {
  const response = await http.post<ApiResponse<{ oneTimePassword: string }>>(`/system/users/${id}/password/reset`)
  return response.data.data.oneTimePassword
}

export async function fetchSystemUserRoleIds(id: number): Promise<number[]> {
  const response = await http.get<ApiResponse<number[]>>(`/system/users/${id}/roles`)
  return response.data.data
}

export async function updateSystemUserRoles(id: number, roleIds: number[]): Promise<number[]> {
  const response = await http.put<ApiResponse<number[]>>(`/system/users/${id}/roles`, { roleIds })
  return response.data.data
}

export async function fetchSystemRoles(params?: { keyword?: string; enabled?: boolean }): Promise<SysRole[]> {
  const response = await http.get<ApiResponse<PageResponse<SysRole>>>('/system/roles', { params })
  return response.data.data.items
}

export async function createSystemRole(request: SysRoleSaveRequest): Promise<SysRole> {
  const response = await http.post<ApiResponse<SysRole>>('/system/roles', request)
  return response.data.data
}

export async function updateSystemRole(id: number, request: SysRoleSaveRequest): Promise<SysRole> {
  const response = await http.put<ApiResponse<SysRole>>(`/system/roles/${id}`, request)
  return response.data.data
}

export async function updateSystemRoleStatus(id: number, enabled: boolean): Promise<SysRole> {
  const response = await http.post<ApiResponse<SysRole>>(`/system/roles/${id}/status`, { enabled })
  return response.data.data
}

export async function deleteSystemRole(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/system/roles/${id}`)
}

export async function fetchSystemPermissions(): Promise<SysPermission[]> {
  const response = await http.get<ApiResponse<SysPermission[]>>('/system/permissions')
  return response.data.data
}

export async function fetchSystemRolePermissions(id: number): Promise<string[]> {
  const response = await http.get<ApiResponse<string[]>>(`/system/roles/${id}/permissions`)
  return response.data.data
}

export async function updateSystemRolePermissions(id: number, permissionCodes: string[]): Promise<string[]> {
  const response = await http.put<ApiResponse<string[]>>(`/system/roles/${id}/permissions`, { permissionCodes })
  return response.data.data
}

export async function fetchLoginLogs(params?: { userName?: string; loginResult?: string; limit?: number }): Promise<SysLoginLog[]> {
  const response = await http.get<ApiResponse<PageResponse<SysLoginLog>>>('/system/audits/login', { params })
  return response.data.data.items
}

export async function fetchOperationLogs(params?: {
  operatorUserName?: string
  permissionCode?: string
  result?: string
  limit?: number
}): Promise<SysOperationLog[]> {
  const response = await http.get<ApiResponse<PageResponse<SysOperationLog>>>('/system/audits/operations', { params })
  return response.data.data.items
}
