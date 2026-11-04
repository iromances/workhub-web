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
