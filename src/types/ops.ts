export type OpsMonitorType = 'XXL_JOB' | 'MQ'

export interface OpsMonitor {
  id: number
  monitorType: OpsMonitorType
  monitorKey: string
  businessLineCode: string
  environmentCode: string
  name: string
  adminBaseUrl: string | null
  username: string | null
  passwordConfigured: boolean
  xxlJobDatabaseName: string | null
  executorAppName: string | null
  jobHandler: string | null
  jobDesc: string | null
  mqTopic: string | null
  mqConsumerGroup: string | null
  mqLagThreshold: number | null
  enabled: boolean
  lastStatus: string | null
  lastMessage: string | null
  lastCheckedAt: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface OpsMonitorSaveRequest {
  monitorType: OpsMonitorType
  monitorKey?: string
  businessLineCode: string
  environmentCode: string
  name?: string
  adminBaseUrl?: string
  username?: string
  password?: string
  xxlJobDatabaseName?: string
  executorAppName?: string
  jobHandler?: string
  jobDesc?: string
  mqTopic?: string
  mqConsumerGroup?: string
  mqLagThreshold?: number
  enabled: boolean
  remark?: string
}

export interface OpsMonitorCheckResult {
  id: number
  monitorType: OpsMonitorType
  monitorKey: string
  status: string
  message: string
  checkedAt: string
  detail: Record<string, unknown>
}

export interface XxlJobFailedJob {
  executorAppName: string
  jobId: number
  jobDesc: string
  author: string
  executorHandler: string
  triggerStatus: number
  failureType: string
  failureTypeName: string
  logId: number
  triggerTime: string
  triggerCode: number
  triggerMsg: string
  handleTime: string
  handleCode: number
  handleMsg: string
}

export interface XxlJobExecutor {
  appName: string
  title: string
}

export interface XxlJobDashboard {
  id: number
  monitorKey: string
  businessLineCode: string
  environmentCode: string
  name: string
  xxlJobDatabaseName: string
  status: string
  message: string
  checkedAt: string
  executorCount: number
  jobCount: number
  enabledJobCount: number
  disabledJobCount: number
  triggerCount: number
  triggerRunningCount: number
  triggerSuccessCount: number
  triggerFailedCount: number
  reportUpdatedAt: string
  failedJobCount: number
  failedJobPage: number
  failedJobPageSize: number
  failedJobs: XxlJobFailedJob[]
}

export interface XxlJobLogPage {
  id: number
  monitorKey: string
  businessLineCode: string
  environmentCode: string
  name: string
  xxlJobDatabaseName: string
  status: string
  message: string
  checkedAt: string
  total: number
  page: number
  pageSize: number
  logs: XxlJobFailedJob[]
}

export interface SystemAlertSubsystem {
  id: number
  businessLineCode: string
  environmentCode: string
  subsystemName: string
  serviceName: string
  enabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemAlertSubsystemSaveRequest {
  businessLineCode: string
  environmentCode: string
  subsystemName: string
  serviceName: string
  enabled: boolean
  remark?: string
}

export interface SystemAlertSubsystemSummary {
  businessLineCode: string
  environmentCode: string
  subsystemName: string
  serviceName: string
  errorCount: number
  latestOccurredAt: string | null
}

export interface SystemAlertEvent {
  id: number
  businessLineCode: string
  environmentCode: string
  subsystemName: string | null
  serviceName: string
  level: string
  title: string | null
  message: string | null
  errorType: string | null
  stackTrace: string | null
  traceId: string | null
  requestId: string | null
  occurredAt: string
  sourceType: string
}

export interface SystemAlertDashboard {
  totalCount: number
  page: number
  pageSize: number
  subsystems: SystemAlertSubsystem[]
  summaries: SystemAlertSubsystemSummary[]
  events: SystemAlertEvent[]
}
