import axios from 'axios'
import type { AgentArtifactKind, AgentScope } from '@/types/agent'

export const artifactLabels: Record<AgentArtifactKind, string> = {
  REPORT: '分析报告', CHANGE_SET: '代码分支及变更', TEST_REPORT: '实际测试结果', DEPLOYMENT: '发布结果', VERIFICATION: '效果验证',
}
export const statusLabels: Record<string, string> = {
  QUEUED: '排队中', RUNNING: '执行中', WAITING_INPUT: '等待补充', WAITING_RESOURCE: '等待资源或对账',
  CANCELLING: '正在停止', CANCELLED: '已取消', COMPLETED: '已完成', FAILED: '失败',
}
export const eventLabels: Record<string, string> = {
  QUEUED: '任务已排队', RUNNING: '开始执行', MODEL_REQUEST: '调用 AI', MODEL_RESPONSE: 'AI 返回行动', PLAN: '行动计划',
  TOOL_REQUEST: '调用工具', TOOL_RESULT: '工具结果', TOOL_IDENTITY: '请求记录', STEP_COMPLETED: '行动完成',
  HUMAN_INPUT: '人工补充', INPUT_CHANGED: '按新指令继续', FORMAT_ERROR: '调整行动格式',
  BUSINESS_MONITOR_SUBMITTED: '已提交业务监测场景', BUSINESS_MONITOR_RESULT: '业务监测核验结果',
  CLI_REQUEST: '启动 AI 任务', CLI_STARTED: 'AI 任务已启动', CLI_PROGRESS: '执行进度', CLI_RESULT: 'AI 任务结果',
  CODE_DELIVERY: '代码交付记录', NATIVE_CODE_DELIVERY: '原生 CLI 交付核验', ACCEPTANCE_CHECKED: '产物验收结果',
  MANUAL_RECONCILIATION: '人工核对执行结果', MANUAL_RECONCILIATION_HANDLED: '旧行动已人工核对',
  CANCEL_REQUESTED: '请求停止', RECOVERY: '恢复检查', RETRY: '重新执行', ...statusLabels,
}
export function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (['WAITING_INPUT', 'WAITING_RESOURCE', 'CANCELLING'].includes(status)) return 'warning'
  return status === 'RUNNING' ? 'primary' : 'info'
}
export function localTime(value: string | null | undefined): string {
  if (!value) return '—'
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
export const scopeKey = (scope: AgentScope) => `${scope.businessLineCode}/${scope.environmentCode}`
export const scopesFromKeys = (keys: string[]): AgentScope[] => keys.map(key => {
  const [businessLineCode, environmentCode] = key.split('/')
  return { businessLineCode, environmentCode }
})
export function requestKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), item => item.toString(16).padStart(2, '0')).join('')
}
export function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || '请求未完成，请刷新状态后重试'
  return error instanceof Error ? error.message : '操作未完成'
}
export function prettyPayload(value: string): string {
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}
export function eventSummary(value: string): string {
  try {
    const payload = JSON.parse(value) as Record<string, unknown>
    for (const key of ['summary', 'message', 'reason', 'tool', 'result']) if (typeof payload[key] === 'string') return payload[key] as string
  } catch { /* 原文可在详情中查看。 */ }
  return ''
}

export const issueDomainLabels: Record<string, string> = { SYSTEM_ALERT: '系统预警', BUSINESS_MONITOR: '服务监测', ACCOUNTING: '业务监测' }
export const issueStatusLabels: Record<string, string> = { OPEN: '开放', ANALYZED: '已分析', FIXING: '修复中', PENDING_REVIEW: '待审核', TESTING: '测试中', FIXED: '已修复', REJECTED: '已拒绝', CLOSED: '已关闭' }
