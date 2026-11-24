import type {
  AccountingDashboard,
  AccountingManualRunRequest,
  AccountingMonitorConfig,
  AccountingMonitorSaveRequest,
  AccountingRun,
  AccountingRunDetail,
  AccountingScenarioType,
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

export async function fetchAccountingScenarios(): Promise<AccountingScenarioType[]> {
  const response = await http.get<ApiResponse<AccountingScenarioType[]>>('/ops/accounting/scenarios')
  return response.data.data
}

export async function fetchAccountingRuns(params?: {
  businessLineCode?: string
  status?: string
  configId?: number
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

export interface AccountingSqlEvidence {
  id: number; monitorRunId: number; sqlCode: string; ruleFamily: string; parametersJson: string;
  templateHash: string; renderedSql: string; status: string; rowCount: number | null;
  durationMs: number; errorMessage: string | null; startedAt: string; finishedAt: string;
}
export interface AccountingRuleFamily {
  code: string; name: string; sqlCodes: string[]; checks: { id: string; name: string; severity: string; note: string }[];
}
export async function fetchAccountingSqlEvidence(id: number, page = 1, family?: string) {
  const r = await http.get<ApiResponse<PageResponse<AccountingSqlEvidence>>>(`/ops/accounting/runs/${id}/sql-evidence`, { params: { page, pageSize: 20, family: family || undefined } }); return r.data.data
}
export async function fetchAccountingAgentRuns(id: number) {
  const r = await http.get<ApiResponse<string[]>>(`/ops/accounting/runs/${id}/agent-runs`); return r.data.data
}
export async function fetchAccountingRules(id: number) {
  const r = await http.get<ApiResponse<AccountingRuleFamily[]>>(`/ops/accounting/configs/${id}/rules`); return r.data.data
}
