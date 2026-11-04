import type { PageResponse } from '@/types/http'

export interface AutonomyCase {
  id: string
  fingerprint: string
  businessLineCode: string
  environmentCode: string
  sourceType: string
  subjectKey: string
  category: string
  title: string
  status: string
  activeRunId: string | null
  latestProposalId: string | null
  occurrenceCount: number
  evidenceVersion: number
  version: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastObservedAt: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}
export interface AutonomySignal {
  id: string; signalKey: string; caseId: string; observationId: string; evidencePointer: string
  sourceEventId: string; sourceVersion: string; evidenceJson: string; occurredAt: string | null; observedAt: string
}
export interface AutonomyProposal {
  id: string; caseId: string; runId: string; caseVersion: number; proposalJson: string; createdAt: string
}
export interface AutonomyAnalysis {
  facts: string; hypothesis: string; impact: string; plan: string; acceptance: string
  rollback: string; unknowns: string; changeType: string
}
export interface AutonomyCaseDetail {
  caseInfo: AutonomyCase
  signals: PageResponse<AutonomySignal>
  proposals: PageResponse<AutonomyProposal>
  relatedRuns: { caseId: string; runId: string; relation: string; createdAt: string }[]
  relatedRunTotal: number
  bugContext: { historyCount: number; bugCount: number; changedCount: number; unavailableCount: number }
}

export interface AutonomyBugLink {
  link: {
    id: string; caseId: string; workItemId: number; workItemVersion: string; snapshotJson: string
    observationId: string; evidencePointer: string; signalId: string; reason: string
    runId: string; caseVersion: number; createdAt: string
  }
  latest: boolean
  sourceState: 'CURRENT' | 'CHANGED' | 'UNAVAILABLE'
}
