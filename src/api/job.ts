import type { ApiResponse } from '@/types/http'
import http from './http'

export interface JobExecutionSnapshot {
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorMessage: string | null
  triggerType: string
  params: string | null
}

export interface JobAdminItem {
  jobCode: string
  jobName: string
  scheduleType: 'CRON' | 'FIXED_DELAY'
  scheduleValue: string
  defaultScheduleValue: string
  enabled: boolean
  allowManualTrigger: boolean
  paramDesc: string | null
  remark: string | null
  running: boolean
  nextFireTime: string | null
  lastExecution: JobExecutionSnapshot | null
}

export interface JobTriggerResult {
  jobCode: string
  triggerType: string
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorMessage: string | null
}

export interface JobExecutionPage {
  total: number
  page: number
  pageSize: number
  items: JobExecutionSnapshot[]
}

export async function fetchJobs(): Promise<JobAdminItem[]> {
  const response = await http.get<ApiResponse<JobAdminItem[]>>('/ops/jobs')
  return response.data.data
}

export async function updateJobSchedule(
  jobCode: string,
  request: { scheduleType: 'CRON' | 'FIXED_DELAY'; scheduleValue: string },
): Promise<JobAdminItem> {
  const response = await http.put<ApiResponse<JobAdminItem>>(`/ops/jobs/${jobCode}/schedule`, request)
  return response.data.data
}

export async function updateJobEnabled(jobCode: string, enabled: boolean): Promise<JobAdminItem> {
  const response = await http.put<ApiResponse<JobAdminItem>>(`/ops/jobs/${jobCode}/enabled`, { enabled })
  return response.data.data
}

export async function triggerJob(jobCode: string, params?: string): Promise<JobTriggerResult> {
  const response = await http.post<ApiResponse<JobTriggerResult>>(`/ops/jobs/${jobCode}/trigger`, {
    params: params || null,
  })
  return response.data.data
}

export async function fetchJobExecutions(
  jobCode: string,
  params: { page?: number; pageSize?: number; status?: string },
): Promise<JobExecutionPage> {
  const response = await http.get<ApiResponse<JobExecutionPage>>(`/ops/jobs/${jobCode}/executions`, { params })
  return response.data.data
}
