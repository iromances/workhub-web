export interface AgentScope { businessLineCode: string; environmentCode: string }
export interface AgentConfiguration {
  name: string
  position: string
  instructions: string
  providerConfigId: number
  model: string | null
  scopes: AgentScope[]
  maxSteps: number
  maxRunSeconds: number
  maxConcurrentRuns: number
  alertLevel?: string
  alertChannels?: string[]
}
export interface AgentDefinition {
  id: string
  configuration: AgentConfiguration
  enabled: boolean
  ownerName: string
  version: number
  createdAt: string
  updatedAt: string
}
export type AgentArtifactKind = 'REPORT' | 'CHANGE_SET' | 'TEST_REPORT' | 'DEPLOYMENT' | 'VERIFICATION'
export type AgentAnalysisScope = 'FULL' | 'INCREMENTAL'
export interface AgentTaskSpecification {
  objective: string
  context: string | null
  acceptanceCriteria: string | null
  expectedArtifacts: AgentArtifactKind[]
  completionTargets: AgentScope[]
  scopes: AgentScope[]
  monitorMode?: 'OBSERVE' | 'EXECUTE_CONFIGURED'
  monitorConfigIds?: number[]
  monitorCheckDate?: string | null
  analysisScope?: AgentAnalysisScope
  webhookUrl?: string | null
}
export interface AgentSchedule {
  expectedVersion: number | null
  mode: 'MANUAL' | 'CRON'
  cronExpression: string | null
  zoneId: string
  misfirePolicy: 'SKIP' | 'RUN_ONCE'
  enabled: boolean
}
export interface AgentTask {
  id: string
  agentId: string
  specification: AgentTaskSpecification
  requestedBy: string
  schedule: AgentSchedule
  nextRunAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}
export interface AgentTaskCreate {
  requestKey: string
  specification: AgentTaskSpecification
  schedule: AgentSchedule
  runImmediately: boolean
}
export interface AgentRun {
  id: string
  taskId: string
  agentId: string
  status: string
  stepCount: number
  elapsedMillis: number
  cancelRequested: boolean
  resultText: string | null
  errorMessage: string | null
  retryAllowed: boolean
  version: number
  createdAt: string
  updatedAt: string
}
export interface AgentEvent {
  id: string; runId: string; eventKey: string; ordinal: number; kind: string
  payloadJson: string; actor: string; createdAt: string
}
export interface AgentArtifact {
  id: string; runId: string; artifactKey: string; kind: string; provenance: string
  payloadJson: string; contentHash: string; createdAt: string
}
export interface AgentRunDetail {
  run: AgentRun
  configuration: AgentConfiguration
  specification: AgentTaskSpecification
  providerBinding: { providerConfigId: number; channelType: string; apiProtocol: string | null; configurationVersion: number }
  events: AgentEvent[]
  artifacts: AgentArtifact[]
}
export interface AgentRunAcceptance {
  runId: string
  checkedAt: string
  satisfied: boolean
  items: { kind: AgentArtifactKind; status: 'SATISFIED' | 'MISSING' | 'BLOCKED' | 'UNAVAILABLE'; message: string
    evidence: { kind: 'ARTIFACT' | 'CHANGE_SET' | 'EVENT'; id: string; contentHash: string }[]
    targets?: { scope: AgentScope; status: string; message: string; evidence: { kind: string; id: string; contentHash: string }[] }[] }[]
}
export interface AgentOptions {
  providers: { id: number; code: string; name: string; channelType: string; defaultModel: string | null; enabled: boolean }[]
  scopes: { businessLineCode: string; businessLineName: string; environments: string[] }[]
  positions: { code: string; name: string }[]
}

export type AgentReconciliationAction = 'RESUME' | 'WAIT_INPUT' | 'CANCEL'
export type AgentReconciliationOutcome = 'NOT_STARTED' | 'ENDED'
export interface AgentReconciliationCall {
  kind: 'API' | 'TOOL' | 'CLI'; key: string; toolCode: string | null; readOnly: boolean | null
  host: string | null; pid: number | null; startInstant: string | null; phase: string | null
  processState: string | null; receiptSource: string | null; receiptKey: string | null
  needsConfirmation: boolean; requestPayloadJson: string | null
}
export interface AgentRunReconciliation {
  runId: string; version: number; snapshotHash: string; leaseUntil: string | null
  canReconcile: boolean; blockedReasons: string[]; resumeBlockedReasons: string[]
  cancelRequested: boolean; calls: AgentReconciliationCall[]
}
export interface AgentReconciliationDecision { key: string; outcome: AgentReconciliationOutcome; evidence: string }
export interface AgentRunReconciliationRequest {
  requestKey: string; expectedVersion: number; snapshotHash: string
  nextAction: AgentReconciliationAction; decisions: AgentReconciliationDecision[]
}
export interface AgentRunReconciliationResult { runId: string; status: string; version: number; eventKey: string }

export type AgentIssueDomain = 'SYSTEM_ALERT' | 'BUSINESS_MONITOR' | 'ACCOUNTING'
export interface AgentIssue {
  id: string; taskId: string; agentId: string; businessLineCode: string; environmentCode: string
  domain: AgentIssueDomain; signature: string; title: string; severity: 'P0' | 'P1' | 'P2'; status: string
  analysis: { codeLocation: string; repro: string; rootCause: string; impactVerification: string; fixDirection: string; repos: { system: string; repository: string; path: string }[] } | null
  evidence: { summary: string; references: string[]; window: string } | null
  fix: { branch: string; repos: { system: string; repository: string; path: string }[]; commit: string; mrUrl: string; diffSummary: string; fixRunId: string } | null
  review: { reviewer: string; decision: string; note: string; reviewedAt: string } | null
  deploy: { testStatus: string; testReceipt: string; testedAt: string; prodStatus: string; prodReceipt: string; prodAt: string } | null
  firstRunId: string; lastRunId: string; firstSeenAt: string; lastSeenAt: string
  occurrenceCount: number; unseenRounds: number; reopenCount: number; version: number
  createdAt: string; updatedAt: string
}
