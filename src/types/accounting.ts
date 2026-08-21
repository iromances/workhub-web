export type AccountingGranularity = 'HOURLY' | 'DAILY'
export type AccountingRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'WARNING' | 'PARTIAL' | 'FAILED'
export type AccountingResultStatus = 'PASS' | 'WARN' | 'ERROR' | 'FAILED' | 'SKIPPED'

export interface AccountingMonitorConfig {
  id: number
  businessLineCode: string
  businessLineName: string | null
  environmentCode: string
  systemName: string
  displayName: string
  databaseTargetKey: string | null
  schemaName: string
  ruleProfile: string
  enabled: boolean
  dailyEnabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountingRun {
  id: number
  runNo: string
  idempotencyKey: string
  configId: number
  businessLineCode: string
  businessLineName: string | null
  systemName: string
  displayName: string
  triggerType: 'MANUAL' | 'SCHEDULED' | 'RETRY'
  startTime: string
  endTime: string
  ruleCodes: string | null
  status: AccountingRunStatus
  ruleTotal: number
  passedCount: number
  warningCount: number
  failedCount: number
  skippedCount: number
  anomalyCount: number
  requestedBy: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  createdAt: string
}

export interface AccountingResult {
  id: number
  runId: number
  ruleCode: string
  ruleName: string
  category: string
  granularity: AccountingGranularity
  severity: 'WARN' | 'ERROR'
  status: AccountingResultStatus
  anomalyCount: number
  differenceAmount: number
  sampleJson: string
  message: string | null
  durationMs: number
  createdAt: string
}

export interface AccountingRule {
  ruleCode: string
  ruleName: string
  category: string
  granularity: AccountingGranularity
  severity: 'WARN' | 'ERROR'
  description: string
  ruleProfile: string
}

export interface AccountingDashboardSummary {
  monitorCount: number
  runningCount: number
  successCount: number
  warningCount: number
  errorCount: number
  anomalyCount: number
}

export interface AccountingMonitorStatus {
  config: AccountingMonitorConfig
  latestRun: AccountingRun | null
}

export interface AccountingDashboard {
  summary: AccountingDashboardSummary
  monitors: AccountingMonitorStatus[]
}

export interface AccountingRunDetail {
  run: AccountingRun
  results: AccountingResult[]
}

export interface AccountingMonitorSaveRequest {
  businessLineCode: string
  environmentCode: string
  systemName: string
  displayName: string
  databaseTargetKey?: string
  schemaName: string
  ruleProfile: string
  enabled: boolean
  dailyEnabled: boolean
  remark?: string
}

export interface AccountingManualRunRequest {
  configId: number
  startTime: string
  endTime: string
  ruleCodes?: string[]
  requestKey: string
}
