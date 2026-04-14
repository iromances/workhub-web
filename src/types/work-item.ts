export interface ProjectSummary {
  id: number
  code: string
  name: string
  type: string
  ownerUserName: string
  status: string
}

export interface WorkItemSummary {
  id: number
  no: string
  title: string
  type: string
  projectName: string
  ownerUserName: string
  status: string
  priority: string
}

export interface IntakeSummary {
  id: number
  sourceType: string
  sourceChannel: string
  senderName: string
  receivedAt: string
  demandStatus: string
  proposerName: string | null
  approvalCode: string | null
  submittedTime: string | null
  requirementType: string | null
  developmentOwnerUserName: string | null
  developmentBranchName: string | null
  zentaoUrl: string | null
  requirementDigest: string | null
  department: string | null
  requirementName: string | null
  requirementSummary: string | null
  businessLine: string | null
  remark: string | null
  estimatedEffort: string | null
  plannedDueDate: string | null
  actualEffort: string | null
  actualCompletedTime: string | null
  acceptanceTime: string | null
  releasedTime: string | null
  enrichmentStatus: string | null
  status: string
  convertedWorkItemId: number | null
}

export interface IntakeAttachment {
  id: number
  category: string
  fileName: string
  contentType: string | null
  downloadUrl: string
  previewable: boolean
  createdAt: string
}

export interface IntakeStructuredField {
  label: string
  value: string
}

export interface IntakeStructuredData {
  category: string | null
  approvalTitle: string | null
  proposerName: string | null
  developmentOwnerUserName: string | null
  approvalCode: string | null
  submittedTime: string | null
  requirementType: string | null
  developmentBranchName: string | null
  zentaoUrl: string | null
  requirementDigest: string | null
  requirementName: string | null
  requirementSummary: string | null
  department: string | null
  businessLine: string | null
  remark: string | null
  estimatedEffort: string | null
  plannedDueDate: string | null
  developmentStartedDate: string | null
  actualEffort: string | null
  testingStartedDate: string | null
  actualCompletedTime: string | null
  acceptanceTime: string | null
  releasedTime: string | null
  projectHint: string | null
  fields: IntakeStructuredField[]
}

export interface IntakeTaskBreakdownItem {
  taskName: string
  estimatedEffort: string | null
  ownerUserName: string | null
  status: string | null
  notes: string | null
}

export interface IntakeAIDraft {
  titleSuggestion: string | null
  descriptionSuggestion: string | null
  typeSuggestion: string | null
  prioritySuggestion: string | null
  suggestedProjectCode: string | null
  acceptanceCriteriaSuggestion: string | null
  taskBreakdownSuggestions: IntakeTaskBreakdownItem[]
  provider: string | null
  model: string | null
  rawResponse: string | null
}

export interface IntakeDetail {
  id: number
  sourceType: string
  sourceChannel: string
  externalMessageId: string | null
  senderName: string
  receivedAt: string
  demandStatus: string
  rawContent: string
  structuredData: IntakeStructuredData | null
  histories: IntakeHistory[]
  status: string
  enrichmentStatus: string | null
  enrichmentErrorSummary: string | null
  enrichmentUpdatedAt: string | null
  aiDraft: IntakeAIDraft | null
  attachments: IntakeAttachment[]
  convertedWorkItemId: number | null
  createdAt: string
  updatedAt: string
}

export interface IntakeCreateRequest {
  senderName: string
  sourceChannel?: string
  receivedAt?: string
  rawContent: string
}


export interface IntakeStageActionRequest {
  action: string
  estimatedEffort?: string
  plannedDueDate?: string
  actualEffort?: string
  actualCompletedTime?: string
  acceptanceTime?: string
  occurredAt?: string
  developmentOwnerUserName?: string
}

export interface IntakeHistory {
  id: number
  actionType: string
  actionSummary: string
  detailText: string | null
  operatorUserName: string
  createdAt: string
}


export interface WorkItemFollowUp {
  id: number
  content: string
  operatorUserName: string
  createdAt: string
}

export interface WorkItemDetail {
  id: number
  no: string
  projectId: number
  projectName: string
  sprintId: number | null
  sprintName: string | null
  releaseId: number | null
  releaseName: string | null
  type: string
  title: string
  description: string | null
  sourceType: string
  sourceChannel: string
  priority: string
  urgency: string | null
  status: string
  creatorUserName: string
  ownerUserName: string
  followerUserName: string
  proposerName: string | null
  acceptanceCriteria: string | null
  plannedStartAt: string | null
  plannedEndAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}
