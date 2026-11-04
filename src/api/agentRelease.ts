import { isAxiosError, type AxiosResponse } from 'axios'
import http from './http'
import type { ApiResponse } from '@/types/http'
import type { AgentReleasePlan, AgentReleaseDetail, AgentReleaseReviewRequest } from '@/types/agentRelease'

class ReleaseRequestRejected extends Error {}
export function releaseRequestRejected(error: unknown): boolean {
  return error instanceof ReleaseRequestRejected || isAxiosError(error) && [400, 403, 404, 409, 422].includes(error.response?.status || 0)
}

async function data<T>(call: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await call
  if (response.data.code !== 0) throw new ReleaseRequestRejected(response.data.message || '发布审核请求未完成')
  return response.data.data
}
export const fetchAgentReleasePlans = (changeSetId: string) =>
  data(http.get<ApiResponse<AgentReleasePlan[]>>('/agent-release-plans', { params: { changeSetId } }))
export const fetchAgentReleasePlan = (id: string) =>
  data(http.get<ApiResponse<AgentReleaseDetail>>(`/agent-release-plans/${encodeURIComponent(id)}`))
export const reviewAgentReleasePlan = (id: string, request: AgentReleaseReviewRequest) =>
  data(http.post<ApiResponse<AgentReleaseDetail>>(`/agent-release-plans/${encodeURIComponent(id)}/reviews`, request))
