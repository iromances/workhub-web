import type { AxiosResponse } from 'axios'
import http from './http'
import type { ApiResponse, PageResponse } from '@/types/http'
import type { AgentChangeSummary, AgentChangeDetail, AgentDelivery } from '@/types/agentChange'

async function data<T>(call: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await call
  if (response.data.code !== 0) throw new Error(response.data.message || '查询未完成')
  return response.data.data
}
export const fetchAgentChanges = (runId: string, page: number) =>
  data(http.get<ApiResponse<PageResponse<AgentChangeSummary>>>('/agent-changes', { params: { runId, page } }))
export const fetchAgentChange = (id: string) =>
  data(http.get<ApiResponse<AgentChangeDetail>>(`/agent-changes/${encodeURIComponent(id)}`))
export const fetchAgentDeliveries = (id: string) =>
  data(http.get<ApiResponse<AgentDelivery[]>>(`/agent-changes/${encodeURIComponent(id)}/deliveries`))
