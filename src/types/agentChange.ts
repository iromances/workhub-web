import type { AgentScope, AgentTaskSpecification } from './agent'

export interface AgentCaseReference { caseId: string; caseVersion: number; proposalId: string; proposalHash: string }
export interface AgentChangePlan {
  summary: string; impact: string; acceptance: string; rollback: string
  dependencies: { repositoryId: string; dependsOn: string }[]
}
export interface AgentRepositoryChange {
  repositoryId: string; repositoryName: string; scope: AgentScope
  workspaceId: string; workspaceVersion: number; policyHash: string
  baseBranch: string; baseSha: string; sourceBranch: string; resultSha: string
  changedPaths: string[]; diffHash: string; diffPreview: string; diffTruncated: boolean
}
export interface AgentChangeSummary {
  id: string; runId: string; revision: number; manifestHash: string; createdAt: string
  current: boolean; readyForReview: boolean; blockers: string[]; summary: string
  caseReference: AgentCaseReference | null; dependencyOrder: string[]
  repositories: { repositoryId: string; name: string; workspaceVersion: number; baseSha: string; resultSha: string; plannedBranch: string; changedFileCount: number }[]
}
export interface AgentChangeDetail {
  id: string; runId: string; taskId: string; revision: number; manifestHash: string; createdAt: string
  current: boolean; readyForReview: boolean; blockers: string[]
  manifest: {
    schemaVersion: number; runId: string; taskId: string; task: AgentTaskSpecification
    plan: AgentChangePlan; caseReference: AgentCaseReference | null
    repositories: AgentRepositoryChange[]; dependencyOrder: string[]
  }
}

export interface AgentDelivery {
  id: string; changeSetId: string; repositoryId: string
  sourceBranch: string; targetBranch: string; resultSha: string; status: string
  mergeRequestIid: number | null; mergeRequestUrl: string | null
  errorMessage: string | null; verifiedAt: string | null; version: number
  remoteConfirmed: boolean; tested: boolean; readyForReview: boolean
}
