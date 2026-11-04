import type { AxiosResponse } from 'axios'
import http from './http'
import type { ApiResponse, PageResponse } from '@/types/http'
import type { AgentScope } from '@/types/agent'
import type { AutonomyCase, AutonomyCaseDetail, AutonomyBugLink, AutonomyCaseResolution } from '@/types/autonomy'

async function data<T>(call: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await call
  if (response.data.code !== 0) throw new Error(response.data.message || '查询未完成')
  return response.data.data
}
export const fetchAutonomyCases = (agentId: string, scope: AgentScope, page: number) =>
  data(http.get<ApiResponse<PageResponse<AutonomyCase>>>('/autonomy/cases', { params: { agentId, ...scope, page, pageSize: 20 } }))
export const fetchAutonomyCase = (agentId: string, caseId: string, evidencePage: number, proposalPage: number) =>
  data(http.get<ApiResponse<AutonomyCaseDetail>>(`/autonomy/cases/${encodeURIComponent(caseId)}`, { params: { agentId, evidencePage, proposalPage, pageSize: 5 } }))

export const fetchAutonomyCaseBugs = (agentId: string, caseId: string, page: number) =>
  data(http.get<ApiResponse<PageResponse<AutonomyBugLink>>>(`/autonomy/cases/${encodeURIComponent(caseId)}/bugs`, { params: { agentId, page, pageSize: 5 } }))

export const fetchAutonomyCaseResolutions = (agentId: string, caseId: string, page: number) =>
  data(http.get<ApiResponse<PageResponse<AutonomyCaseResolution>>>(`/autonomy/cases/${encodeURIComponent(caseId)}/resolutions`, { params: { agentId, page, pageSize: 5 } }))
