import type { AutonomyCaseResolution } from '@/types/autonomy'
import type { AgentScope, AgentArtifact } from './agent'
import type { AgentChangeDetail } from './agentChange'

export interface AgentReleaseVerificationPlan {
  checks: {
    id: string; scope: AgentScope; toolCode: string; monitoringItem: string; passCondition: string
    observationSeconds: number; sampleIntervalSeconds: number; maxDataAgeSeconds: number; minimumSamples: number; evidenceRequirements: string
  }[]
  historicalDataHandling: string; failureHandling: string
}

export interface AgentReleasePlan {
  id: string; runId: string; changeSetId: string; manifestHash: string; snapshotHash: string
  stage: 'TEST_DEPLOY' | 'PROD_DEPLOY'; status: string; version: number
  createdBy: string; createdAt: string; updatedAt: string; businessVerified: boolean
}
export interface AgentReleaseStep {
  requestId: string; approvalId: string; dependsOn: string[]; parameters: Record<string, string>
  binding: { hash: string; instance: { id: string; name: string; baseUrl: string }; binding: {
    id: string; name: string; scope: AgentScope; systemName: string; stage: string
    jobSegments: string[]; commitParameters: Record<string, string>
  } }
}
export interface AgentDeployment {
  id: string; status: string; queueId: number | null; buildNumber: number | null; buildResult: string | null
  errorMessage: string | null; updatedAt: string; businessVerified: boolean
}
export interface AgentReleaseReview {
  id: string; planId: string; requestKey: string; decision: 'APPROVED' | 'REJECTED'; reviewedBy: string
  comment: string; snapshotHash: string; expectedVersion: number; createdAt: string
}
export interface AgentReleaseDetail extends AgentReleasePlan {
  current: boolean; readyForReview: boolean; blockers: string[]; reviews: AgentReleaseReview[]; deployments: AgentDeployment[]
  snapshot: { schemaVersion: number; change: AgentChangeDetail; evidence: AgentArtifact[]; blockers: string[]; steps: AgentReleaseStep[]; verificationPlan?: AgentReleaseVerificationPlan | null }
}
export interface AgentReleaseReviewRequest {
  requestKey: string; expectedVersion: number; snapshotHash: string; decision: 'APPROVED' | 'REJECTED'; comment: string
}


export interface AgentVerificationFact {
  observationId: string; contentHash: string; pointer: string; sourceKey: string; eventKey: string
  observedAt: string; dataAt: string | null; problems: string[]; coverageFrom?: string | null; coverageThrough?: string | null
}
export interface AgentVerificationProgress {
  checkId: string; assessment: 'PASS' | 'FAIL' | 'INCONCLUSIVE'; reason: string; reasonTruncated?: boolean
  historicalDataPending: boolean; distinctSamples: number; observedSeconds: number
  windowStart: string | null; windowEnd: string | null; constraints: string[]; latestSampleId: string | null; evidenceRoot: string
}
export interface AgentVerificationView {
  id: string; planId: string; runId: string; changeSetId: string; stage: string; manifestHash: string; approvedSnapshotHash: string
  status: 'OBSERVING' | 'PASSED' | 'FAILED'; version: number; constraintsCheckedAt: string; currentConstraintsSatisfied: boolean
  deployedAt: string; verificationPlan: AgentReleaseVerificationPlan; nextCheckAt: string | null; artifactId: string | null
  checks: AgentVerificationProgress[]; caseClosed: boolean; caseResolution: AutonomyCaseResolution | null; caseStatus: string | null
  conclusion: null | { assessment: 'PASS' | 'FAIL' | 'INCONCLUSIVE'; reason: string; historicalDataPending: boolean
    conclusionSource: 'AI_ASSESSMENT'; platformConstraintsSatisfied: boolean; checks: AgentVerificationProgress[]; recordedAt: string }
}
export interface AgentVerificationSample {
  id: string; checkId: string; sampleOrder: number; assessment: 'PASS' | 'FAIL' | 'INCONCLUSIVE'; reason: string
  historicalDataPending: boolean; createdAt: string; evidence: AgentVerificationFact[]
}
export interface AgentVerificationSamplePage {
  planId: string; verificationId: string; checkId: string; afterOrder: number; throughOrder: number; pageSize: number
  items: AgentVerificationSample[]; hasMore: boolean; nextAfterOrder: number
}
export interface AgentVerificationEvidenceView {
  planId: string; verificationId: string; sampleId: string; checkId: string; observationId: string; pointer: string
  contentHash: string; toolCode: string; sourceType: string; scope: AgentScope; observedAt: string; payload: unknown
}
