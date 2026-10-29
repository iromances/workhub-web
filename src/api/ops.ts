import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  OpsMonitor,
  OpsMonitorCheckResult,
  OpsMonitorSaveRequest,
  OpsMonitorType,
  SystemAlertDashboard,
  SystemAlertCleanupTask,
  SystemAlertDeleteByEventRequest,
  SystemAlertDeleteByMessageRequest,
  SystemAlertDeleteAndFilterRequest,
  SystemAlertEventBatchDeleteResponse,
  SystemAlertEventCategory,
  SystemAlertRule,
  SystemAlertRuleSaveRequest,
  SystemAlertScope,
  SystemAlertScopeSaveRequest,
  SystemAlertSubsystem,
  SystemAlertSubsystemSaveRequest,
  XxlJobDashboard,
  XxlJobExecutor,
  XxlJobLogPage,
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

export async function fetchXxlJobLogs(
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
): Promise<XxlJobLogPage> {
  const response = await http.get<ApiResponse<XxlJobLogPage>>(`/ops/monitors/${id}/xxl-job/logs`, { params })
  return response.data.data
}

export async function fetchSystemAlertDashboard(params?: {
  businessLineCode?: string
  environmentCode?: string
  serviceName?: string
  level?: string
  eventCategory?: SystemAlertEventCategory
  messageKeyword?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}): Promise<SystemAlertDashboard> {
  const response = await http.get<ApiResponse<SystemAlertDashboard>>('/ops/system-alerts', { params })
  return response.data.data
}

export async function deleteSystemAlertEvents(ids: number[]): Promise<SystemAlertEventBatchDeleteResponse> {
  const response = await http.post<ApiResponse<SystemAlertEventBatchDeleteResponse>>(
    '/ops/system-alerts/events/batch-delete',
    { ids },
  )
  return response.data.data
}

export async function createSystemAlertDeleteAndFilterTask(
  request: SystemAlertDeleteAndFilterRequest,
): Promise<SystemAlertCleanupTask> {
  const response = await http.post<ApiResponse<SystemAlertCleanupTask>>(
    '/ops/system-alerts/events/delete-and-filter-tasks',
    request,
  )
  return response.data.data
}

export async function createSystemAlertDeleteTask(
  request: SystemAlertDeleteByMessageRequest,
): Promise<SystemAlertCleanupTask> {
  const response = await http.post<ApiResponse<SystemAlertCleanupTask>>(
    '/ops/system-alerts/events/delete-tasks',
    request,
  )
  return response.data.data
}

export async function createSystemAlertExactMessageDeleteTask(
  request: SystemAlertDeleteByEventRequest,
): Promise<SystemAlertCleanupTask> {
  const response = await http.post<ApiResponse<SystemAlertCleanupTask>>(
    '/ops/system-alerts/events/exact-message-delete-tasks',
    request,
  )
  return response.data.data
}

export async function fetchSystemAlertCleanupTask(id: number): Promise<SystemAlertCleanupTask> {
  const response = await http.get<ApiResponse<SystemAlertCleanupTask>>(
    `/ops/system-alerts/events/cleanup-tasks/${id}`,
  )
  return response.data.data
}

export async function fetchSystemAlertDeleteAndFilterTask(id: number): Promise<SystemAlertCleanupTask> {
  const response = await http.get<ApiResponse<SystemAlertCleanupTask>>(
    `/ops/system-alerts/events/delete-and-filter-tasks/${id}`,
  )
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

export async function fetchSystemAlertScopes(params?: {
  businessLineCode?: string
  environmentCode?: string
  enabledOnly?: boolean
}): Promise<SystemAlertScope[]> {
  const response = await http.get<ApiResponse<PageResponse<SystemAlertScope>>>('/ops/system-alerts/scopes', { params })
  return response.data.data.items
}

export async function createSystemAlertScope(request: SystemAlertScopeSaveRequest): Promise<SystemAlertScope> {
  const response = await http.post<ApiResponse<SystemAlertScope>>('/ops/system-alerts/scopes', request)
  return response.data.data
}

export async function updateSystemAlertScope(id: number, request: SystemAlertScopeSaveRequest): Promise<SystemAlertScope> {
  const response = await http.put<ApiResponse<SystemAlertScope>>(`/ops/system-alerts/scopes/${id}`, request)
  return response.data.data
}

export async function deleteSystemAlertScope(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/ops/system-alerts/scopes/${id}`)
}

export async function fetchSystemAlertRules(params?: {
  enabledOnly?: boolean
  keyword?: string
}): Promise<SystemAlertRule[]> {
  const response = await http.get<ApiResponse<PageResponse<SystemAlertRule>>>('/ops/system-alerts/rules', { params })
  return response.data.data.items
}

export async function createSystemAlertRule(request: SystemAlertRuleSaveRequest): Promise<SystemAlertRule> {
  const response = await http.post<ApiResponse<SystemAlertRule>>('/ops/system-alerts/rules', request)
  return response.data.data
}

export async function updateSystemAlertRule(id: number, request: SystemAlertRuleSaveRequest): Promise<SystemAlertRule> {
  const response = await http.put<ApiResponse<SystemAlertRule>>(`/ops/system-alerts/rules/${id}`, request)
  return response.data.data
}

export async function deleteSystemAlertRule(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/ops/system-alerts/rules/${id}`)
}
