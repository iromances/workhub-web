export interface ProjectSummary {
  id: number
  businessLineCode: string
  businessLineName: string
  businessLine: string
  code: string
  name: string
  type: string
  group: string
  ownerUserName: string
  status: string
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectGroup {
  id: number
  businessLineName: string
  groupName: string
  gitlabGroupName: string | null
  description: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectInvolvedSystem {
  id: number
  systemScope: 'PROJECT_GROUP' | 'BUSINESS_LINE' | 'MIDDLE_PLATFORM'
  businessLine: string
  projectGroup: string
  systemName: string
  description: string | null
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface UserOption {
  userName: string
  displayName: string | null
  projectGroup: string | null
}

export interface DeveloperResource {
  id: number
  userName: string
  displayName: string
  enabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface DeveloperResourceSaveRequest {
  userName: string
  displayName: string
  enabled: boolean
  remark?: string
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

export interface IntakeRelatedWorkItem {
  id: number
  no: string
  title: string
  type: string
  projectName: string
  ownerUserName: string
  status: string
  priority: string
  draftIndex: number | null
  relationType: string
}

export interface IntakeSummary {
  id: number
  sourceType: string
  sourceChannel: string
  senderName: string
  developmentOwnerUserName: string | null
  receivedAt: string
  demandStatus: string
  proposerName: string | null
  approvalCode: string | null
  submittedTime: string | null
  requirementType: string | null
  developmentBranchName: string | null
  zentaoUrl: string | null
  requirementDigest: string | null
  department: string | null
  requirementName: string | null
  requirementSummary: string | null
  businessLine: string | null
  remark: string | null
  totalEstimatedEffort: string | null
  developmentEstimatedEffort: string | null
  testingEstimatedEffort: string | null
  plannedDueDate: string | null
  plannedDevelopmentStartDate: string | null
  plannedTestingStartDate: string | null
  plannedReleaseDate: string | null
  developmentStartedDate: string | null
  actualEffort: string | null
  testingStartedDate: string | null
  actualCompletedTime: string | null
  scheduledAcceptanceDate: string | null
  actualTestingEffort: string | null
  actualTestingCompletedDate: string | null
  acceptanceTime: string | null
  releasedTime: string | null
  projectHint: string | null
  involvedSystems: string[]
  enrichmentStatus: string | null
  status: string
  convertedWorkItemId: number | null
}

export interface IntakeRequirementFolder {
  intakeId: number
  basePath: string
  folderName: string
  folderPath: string
  opened: boolean
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

export interface IntakeSqlDraft {
  dialect: string | null
  sql: string | null
  explanation: string | null
  parameters: string[]
  assumptions: string[]
  questions: string[]
  riskWarnings: string[]
  generatedAt: string | null
  generator: string | null
}

export interface DevelopmentWorkItemDraft {
  title: string
  description: string | null
  requirementChangePoint: string | null
  taskType: string | null
  targetResources: string[]
  changePoints: string[]
  systemTags: string[]
  evidenceRefs: string[]
  confidence: string | null
  moduleName: string | null
  relatedFiles: string[]
  estimatedEffort: string | null
  ownerUserName: string | null
  priority: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  dependency: string | null
  risk: string | null
}

export interface DevelopmentAnalysisDraft {
  status: string | null
  businessLine: string | null
  projectGroup: string | null
  projectId: number | null
  projectName: string | null
  repositoryUrl: string | null
  requirementRawPath: string | null
  requirementWikiPath: string | null
  requirementWikiUrl: string | null
  summary: string | null
  requirementChangePoints: string[]
  impactedModules: string[]
  risks: string[]
  questions: string[]
  developerPool: string[]
  workItems: DevelopmentWorkItemDraft[]
  totalEstimatedEffort: string | null
  developmentEstimatedEffort: string | null
  testingEstimatedEffort: string | null
  plannedDueDate: string | null
  plannedDevelopmentStartDate: string | null
  plannedTestingStartDate: string | null
  plannedTestingEndDate: string | null
  plannedReleaseDate: string | null
  zentaoSyncStatus: string | null
  zentaoSyncMessage: string | null
  generatedAt: string | null
  generator: string | null
}

export interface DevelopmentAnalysisResponse {
  id: number
  intakeId: number
  status: string
  message: string | null
  draft: DevelopmentAnalysisDraft | null
  createdAt: string
  updatedAt: string
}

export interface IntakeClarificationItem {
  index: number
  itemType: 'QUESTION' | 'RISK'
  title: string
  description: string | null
  evidence: string | null
  status: 'PENDING' | 'RESPONDED' | 'ACKNOWLEDGED'
  responseText: string | null
  respondedBy: string | null
  respondedAt: string | null
}

export interface IntakeClarificationAnalysisResponse {
  id: number
  intakeId: number
  status: string
  message: string | null
  items: IntakeClarificationItem[]
  createdAt: string
  updatedAt: string
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
  plannedDueDate: string | null
  plannedDevelopmentStartDate: string | null
  plannedTestingStartDate: string | null
  plannedReleaseDate: string | null
  developmentStartedDate: string | null
  actualEffort: string | null
  testingStartedDate: string | null
  actualCompletedTime: string | null
  scheduledAcceptanceDate: string | null
  actualTestingEffort: string | null
  actualTestingCompletedDate: string | null
  acceptanceTime: string | null
  releasedTime: string | null
  closedTime: string | null
  closeReason: string | null
  projectHint: string | null
  fields: IntakeStructuredField[]
  attachmentSummaries?: unknown[]
  sqlDraft: IntakeSqlDraft | null
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
  developmentOwnerUserName: string | null
  receivedAt: string
  demandStatus: string
  pausePreviousDemandStatus: string | null
  pauseReason: string | null
  pauseDate: string | null
  rawContent: string
  structuredData: IntakeStructuredData | null
  involvedSystems: string[]
  relatedWorkItems: IntakeRelatedWorkItem[]
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
  developmentOwnerUserName: string
  sourceChannel?: string
  receivedAt?: string
  rawContent: string
}


export interface IntakeStageActionRequest {
  action: string
  plannedDueDate?: string
  plannedDevelopmentStartDate?: string
  plannedTestingStartDate?: string
  plannedReleaseDate?: string
  actualEffort?: string
  actualCompletedTime?: string
  scheduledAcceptanceDate?: string
  actualTestingEffort?: string
  actualTestingCompletedDate?: string
  acceptanceTime?: string
  occurredAt?: string
  aiClarificationEnabled?: boolean
  closeReason?: string
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

export interface WorkItemUpdateRequest {
  title: string
  description?: string
  priority: string
  urgency?: string
  proposerName?: string
  acceptanceCriteria?: string
  plannedStartAt?: string | null
  plannedEndAt?: string | null
}

export interface WorkItemCreateRequest extends WorkItemUpdateRequest {
  projectId: number
  sprintId?: number | null
  releaseId?: number | null
  type: string
  sourceType: string
  sourceChannel: string
  ownerUserName: string
  followerUserName: string
}

export interface WorkItemAssignRequest {
  ownerUserName: string
  followerUserName: string
  reason?: string
}

export interface WorkItemFollowUpRequest {
  content: string
}

export interface WorkItemTransitionRequest {
  toStatus: string
  reason?: string
}

export interface WorkItemTransition {
  id: number
  fromStatus: string
  toStatus: string
  reason: string | null
  operatorUserName: string
  createdAt: string
}

export interface SysConfigItem {
  id: number
  configGroup: string
  configKey: string
  configName: string
  valueType: string
  value: string | null
  enabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface SysConfigSaveRequest {
  configGroup: string
  configKey: string
  configName: string
  valueType: string
  value?: string
  enabled?: boolean
  remark?: string
}
