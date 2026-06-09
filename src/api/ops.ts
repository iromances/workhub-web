import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  OpsMonitor,
  OpsMonitorCheckResult,
  OpsMonitorSaveRequest,
  OpsMonitorType,
  SystemAlertDashboard,
  SystemAlertSubsystem,
  SystemAlertSubsystemSaveRequest,
  XxlJobDashboard,
  XxlJobExecutor,
} from '@/types/ops'

import http from './http'

export async function fetchOpsMonitors(params?: {
  monitorType?: OpsMonitorType | ''
  businessLineCode?: string
  environmentCode?: string
  keyword?: string
  enabledOnly?: boolean
}): Promise<OpsMonitor[]> {
  const response = await http.get<ApiResponse<PageResponse<OpsMonitor>>>('/ops/monitors', { params })
  return response.data.data.items
}

export async function createOpsMonitor(request: OpsMonitorSaveRequest): Promise<OpsMonitor> {
  const response = await http.post<ApiResponse<OpsMonitor>>('/ops/monitors', request)
  return response.data.data
}

export async function updateOpsMonitor(id: number, request: OpsMonitorSaveRequest): Promise<OpsMonitor> {
  const response = await http.put<ApiResponse<OpsMonitor>>(`/ops/monitors/${id}`, request)
  return response.data.data
}

export async function deleteOpsMonitor(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/ops/monitors/${id}`)
}

export async function checkOpsMonitor(id: number): Promise<OpsMonitorCheckResult> {
  const response = await http.post<ApiResponse<OpsMonitorCheckResult>>(`/ops/monitors/${id}/check`)
  return response.data.data
}

export async function fetchXxlJobDashboard(params?: {
  businessLineCode?: string
  environmentCode?: string
  enabledOnly?: boolean
}): Promise<XxlJobDashboard[]> {
  const response = await http.get<ApiResponse<PageResponse<XxlJobDashboard>>>('/ops/monitors/xxl-job/dashboard', { params })
  return response.data.data.items
}

export async function fetchXxlJobExecutors(params: {
  businessLineCode: string
  environmentCode: string
  xxlJobDatabaseName: string
}): Promise<XxlJobExecutor[]> {
  const response = await http.get<ApiResponse<XxlJobExecutor[]>>('/ops/monitors/xxl-job/executors', { params })
  return response.data.data
}

export async function fetchXxlJobDetail(
  id: number,
  params?: {
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
    author?: string
    executorAppName?: string
    logStatus?: 'ALL' | 'FAILED'
  },
): Promise<XxlJobDashboard> {
  const response = await http.get<ApiResponse<XxlJobDashboard>>(`/ops/monitors/${id}/xxl-job/detail`, { params })
  return response.data.data
}

export async function fetchSystemAlertDashboard(params?: {
  businessLineCode?: string
  environmentCode?: string
  serviceName?: string
  level?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}): Promise<SystemAlertDashboard> {
  const response = await http.get<ApiResponse<SystemAlertDashboard>>('/ops/system-alerts', { params })
  return response.data.data
}

export async function fetchSystemAlertSubsystems(params?: {
  businessLineCode?: string
  environmentCode?: string
  enabledOnly?: boolean
  keyword?: string
}): Promise<SystemAlertSubsystem[]> {
  const response = await http.get<ApiResponse<PageResponse<SystemAlertSubsystem>>>('/ops/system-alerts/subsystems', { params })
  return response.data.data.items
}

export async function createSystemAlertSubsystem(request: SystemAlertSubsystemSaveRequest): Promise<SystemAlertSubsystem> {
  const response = await http.post<ApiResponse<SystemAlertSubsystem>>('/ops/system-alerts/subsystems', request)
  return response.data.data
}

export async function updateSystemAlertSubsystem(id: number, request: SystemAlertSubsystemSaveRequest): Promise<SystemAlertSubsystem> {
  const response = await http.put<ApiResponse<SystemAlertSubsystem>>(`/ops/system-alerts/subsystems/${id}`, request)
  return response.data.data
}

export async function deleteSystemAlertSubsystem(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/ops/system-alerts/subsystems/${id}`)
}
