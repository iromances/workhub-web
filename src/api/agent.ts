import type { AxiosResponse } from 'axios'
import http from './http'
import type { ApiResponse, PageResponse } from '@/types/http'
import type { AgentIssue, AgentConfiguration, AgentDefinition, AgentOptions, AgentRun, AgentRunDetail, AgentRunAcceptance, AgentRunReconciliation, AgentRunReconciliationRequest, AgentRunReconciliationResult, AgentSchedule, AgentTask, AgentTaskSpecification } from '@/types/agent'

async function data<T>(call: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await call
  if (response.data.code !== 0) throw new Error(response.data.message || '操作未完成')
  return response.data.data
}
const segment = encodeURIComponent
export const fetchAgentOptions = () => data(http.get<ApiResponse<AgentOptions>>('/agents/options'))
export const fetchAgents = (page: number) => data(http.get<ApiResponse<PageResponse<AgentDefinition>>>('/agents', { params: { page, pageSize: 20 } }))
export const fetchAgent = (id: string) => data(http.get<ApiResponse<AgentDefinition>>(`/agents/${segment(id)}`))
export const saveAgent = (id: string | null, expectedVersion: number | null, configuration: AgentConfiguration) => id
  ? data(http.put<ApiResponse<AgentDefinition>>(`/agents/${segment(id)}`, { expectedVersion, configuration }))
  : data(http.post<ApiResponse<AgentDefinition>>('/agents', { expectedVersion, configuration }))
export const setAgentEnabled = (agent: AgentDefinition, enabled: boolean) => data(http.post<ApiResponse<AgentDefinition>>(`/agents/${segment(agent.id)}/${enabled ? 'enable' : 'disable'}`, { expectedVersion: agent.version }))
export const deleteAgent = (agent: AgentDefinition) =>
  data(http.delete<ApiResponse<null>>(`/agents/${segment(agent.id)}`, { params: { expectedVersion: agent.version } }))
/** 职责执行任务：数字员工唯一的常设执行配置；员工还没有时由后端认领存量任务或补建。 */
export const fetchAgentDutyTask = (agentId: string) => data(http.get<ApiResponse<AgentTask>>(`/agents/${segment(agentId)}/duty-task`))
export const updateAgentTask = (task: AgentTask, specification: AgentTaskSpecification, schedule: AgentSchedule) =>
  data(http.put<ApiResponse<AgentTask>>(`/agent-tasks/${segment(task.id)}`, { expectedVersion: task.version, specification, schedule }))
export const runAgentTask = (task: AgentTask, requestKey: string) => data(http.post<ApiResponse<AgentRun>>(`/agent-tasks/${segment(task.id)}/run`, { expectedVersion: task.version, requestKey }))
export const fetchAgentRuns = (agentId: string, page: number) => data(http.get<ApiResponse<PageResponse<AgentRun>>>(`/agents/${segment(agentId)}/runs`, { params: { page, pageSize: 5 } }))
export const fetchAgentRun = (taskId: string, runId: string) => data(http.get<ApiResponse<AgentRunDetail>>(`/agent-tasks/${segment(taskId)}/runs/${segment(runId)}`))
export const cancelAgentRun = (run: AgentRun) => data(http.post<ApiResponse<AgentRun>>(`/agent-tasks/${segment(run.taskId)}/runs/${segment(run.id)}/cancel`, { expectedVersion: run.version }))
export const retryAgentRun = (run: AgentRun, requestKey: string) => data(http.post<ApiResponse<AgentRun>>(`/agent-tasks/${segment(run.taskId)}/runs/${segment(run.id)}/retry`, { expectedVersion: run.version, requestKey }))
export const replyToAgentRun = (run: AgentRun, requestKey: string, message: string) => data(http.post<ApiResponse<AgentRun>>(`/agent-tasks/${segment(run.taskId)}/messages`, { runId: run.id, expectedVersion: run.version, requestKey, message }))

export const fetchAgentRunAcceptance = (taskId: string, runId: string) => data(http.get<ApiResponse<AgentRunAcceptance>>(`/agent-tasks/${segment(taskId)}/runs/${segment(runId)}/acceptance`))

export const deleteAgentRun = (taskId: string, run: AgentRun) =>
  data(http.delete<ApiResponse<null>>(`/agent-tasks/${segment(taskId)}/runs/${segment(run.id)}`, { params: { expectedVersion: run.version } }))

export const fetchAgentRunReconciliation = (taskId: string, runId: string) => data(http.get<ApiResponse<AgentRunReconciliation>>(`/agent-tasks/${segment(taskId)}/runs/${segment(runId)}/reconciliation`))
export const reconcileAgentRun = (taskId: string, runId: string, request: AgentRunReconciliationRequest) => data(http.post<ApiResponse<AgentRunReconciliationResult>>(`/agent-tasks/${segment(taskId)}/runs/${segment(runId)}/reconciliation`, request))

export const fetchAgentIssues = (params: { runId?: string; status?: string; domain?: string; agentId?: string; limit?: number }) =>
  data(http.get<ApiResponse<AgentIssue[]>>('/agent-issues', { params }))

export const fixAgentIssues = (issueIds: string[]) =>
  data(http.post<ApiResponse<AgentIssue[]>>('/agent-issues/fix', { issueIds }))
export const reviewAgentIssue = (issue: AgentIssue, decision: 'APPROVE' | 'REJECT', note: string) =>
  data(http.put<ApiResponse<AgentIssue>>(`/agent-issues/${segment(issue.id)}`, { expectedVersion: issue.version, decision, note }))
export const deployAgentIssue = (issue: AgentIssue, outcome: 'PASS' | 'FAIL') =>
  data(http.post<ApiResponse<AgentIssue>>(`/agent-issues/${segment(issue.id)}/deploy`, { outcome }))

export const fetchStructuredAgentReport = (agentId: string, runId: string) => data(http.get<ApiResponse<{ available: boolean; report?: import('@/types/agentReport').StructuredReport }>>(`/agents/${segment(agentId)}/runs/${segment(runId)}/report`))
