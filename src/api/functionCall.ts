import type { ApiResponse } from '@/types/http'
import http from './http'

export interface FuncCallSqlItem {
  id: number
  sqlCode: string
  scenarioCode: string | null
  branchOrder: number
  name: string
  description: string | null
  sqlTemplate: string
  paramDesc: string | null
  sourceModule: string | null
  enabled: boolean
  remark: string | null
}

export interface FuncCallSqlSaveRequest {
  sqlCode: string
  scenarioCode?: string | null
  branchOrder?: number
  name: string
  description?: string | null
  sqlTemplate: string
  paramDesc?: string | null
  sourceModule?: string | null
  enabled?: boolean
  remark?: string | null
}

export interface FuncCallExecuteRequest {
  codeOrScenario: string
  params: Record<string, string>
  businessLineCode: string
  environmentCode: string
}

export interface FuncCallExecuteResponse {
  sqlCode: string
  columns: string[]
  rows: Record<string, unknown>[]
  sqlRendered: string
}

export async function fetchFuncCallSqlList(params?: {
  keyword?: string
  enabled?: boolean
}): Promise<FuncCallSqlItem[]> {
  const response = await http.get<ApiResponse<FuncCallSqlItem[]>>('/ops/function-call/sql', { params })
  return response.data.data
}

export async function createFuncCallSql(request: FuncCallSqlSaveRequest): Promise<FuncCallSqlItem> {
  const response = await http.post<ApiResponse<FuncCallSqlItem>>('/ops/function-call/sql', request)
  return response.data.data
}

export async function updateFuncCallSql(id: number, request: FuncCallSqlSaveRequest): Promise<FuncCallSqlItem> {
  const response = await http.put<ApiResponse<FuncCallSqlItem>>(`/ops/function-call/sql/${id}`, request)
  return response.data.data
}

export async function updateFuncCallSqlEnabled(id: number, enabled: boolean): Promise<FuncCallSqlItem> {
  const response = await http.put<ApiResponse<FuncCallSqlItem>>(`/ops/function-call/sql/${id}/enabled`, { enabled })
  return response.data.data
}

export async function executeFuncCall(request: FuncCallExecuteRequest): Promise<FuncCallExecuteResponse> {
  const response = await http.post<ApiResponse<FuncCallExecuteResponse>>('/ops/function-call/execute', request)
  return response.data.data
}

export interface FuncCallAuditItem {
  id: number
  sqlCode: string
  scenarioCode: string | null
  source: string
  operator: string
  businessLineCode: string
  environmentCode: string
  renderedSql: string
  status: string
  rowCount: number | null
  durationMs: number | null
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
}

export interface FuncCallAuditPage {
  total: number
  page: number
  pageSize: number
  items: FuncCallAuditItem[]
}

export async function fetchFuncCallAudits(params?: {
  sqlCode?: string
  source?: string
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}): Promise<FuncCallAuditPage> {
  const response = await http.get<ApiResponse<FuncCallAuditPage>>('/ops/function-call/audits', { params })
  return response.data.data
}
