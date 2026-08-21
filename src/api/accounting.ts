import type {
  AccountingDashboard,
  AccountingManualRunRequest,
  AccountingMonitorConfig,
  AccountingMonitorSaveRequest,
  AccountingRule,
  AccountingRun,
  AccountingRunDetail,
} from '@/types/accounting'
import type { ApiResponse, PageResponse } from '@/types/http'

import http from './http'

export async function fetchAccountingDashboard(businessLineCode?: string): Promise<AccountingDashboard> {
  const response = await http.get<ApiResponse<AccountingDashboard>>('/ops/accounting/dashboard', {
    params: { businessLineCode },
  })
  return response.data.data
}

export async function fetchAccountingConfigs(params?: {
  businessLineCode?: string
  enabledOnly?: boolean
}): Promise<AccountingMonitorConfig[]> {
  const response = await http.get<ApiResponse<PageResponse<AccountingMonitorConfig>>>('/ops/accounting/configs', { params })
  return response.data.data.items
}

export async function createAccountingConfig(
  request: AccountingMonitorSaveRequest,
): Promise<AccountingMonitorConfig> {
  const response = await http.post<ApiResponse<AccountingMonitorConfig>>('/ops/accounting/configs', request)
  return response.data.data
}

export async function updateAccountingConfig(
  id: number,
  request: AccountingMonitorSaveRequest,
): Promise<AccountingMonitorConfig> {
  const response = await http.put<ApiResponse<AccountingMonitorConfig>>(`/ops/accounting/configs/${id}`, request)
  return response.data.data
}

export async function fetchAccountingRules(ruleProfile: string): Promise<AccountingRule[]> {
  const response = await http.get<ApiResponse<AccountingRule[]>>('/ops/accounting/rules', {
    params: { ruleProfile },
  })
  return response.data.data
}

export async function fetchAccountingRuns(params?: {
  businessLineCode?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<AccountingRun>> {
  const response = await http.get<ApiResponse<PageResponse<AccountingRun>>>('/ops/accounting/runs', { params })
  return response.data.data
}

export async function fetchAccountingRunDetail(id: number): Promise<AccountingRunDetail> {
  const response = await http.get<ApiResponse<AccountingRunDetail>>(`/ops/accounting/runs/${id}`)
  return response.data.data
}

export async function submitAccountingManualRun(request: AccountingManualRunRequest): Promise<AccountingRun> {
  const response = await http.post<ApiResponse<AccountingRun>>('/ops/accounting/runs/manual', request)
  return response.data.data
}

export async function retryAccountingRun(id: number): Promise<AccountingRun> {
  const response = await http.post<ApiResponse<AccountingRun>>(`/ops/accounting/runs/${id}/retry`)
  return response.data.data
}
