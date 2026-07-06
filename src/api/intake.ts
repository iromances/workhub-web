import type { ApiResponse, PageResponse } from '@/types/http'
import type { DemandTypeFilter, DevelopmentAnalysisResponse, IntakeBusinessLineUpdateRequest, IntakeClarificationAnalysisResponse, IntakeDashboard, IntakeDetail, IntakeRequirementFolder, IntakeStageActionRequest, IntakeSummary, IntakeTodo, IntakeTodoCreateRequest, IntakeTodoStatusRequest, IntakeTodoUpdateRequest } from '@/types/work-item'

import http from './http'
export { buildIntakeTodoPath, buildIntakeTodoStatusPath, buildIntakeTodosPath } from './intakeTodoPaths'
import { buildIntakeTodoPath, buildIntakeTodoStatusPath, buildIntakeTodosPath } from './intakeTodoPaths'

export async function fetchIntakeRecords(params?: {
  status?: string
  requirementName?: string
  approvalCode?: string
  proposerName?: string
  businessLine?: string
  requirementType?: string
  demandStatus?: string
  releasedStartDate?: string
  releasedEndDate?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<IntakeSummary>> {
  const response = await http.get<ApiResponse<PageResponse<IntakeSummary>>>('/intake', { params })
  return response.data.data
}

export async function fetchIntakeDashboard(demandType: DemandTypeFilter = 'ALL'): Promise<IntakeDashboard> {
  const response = await http.get<ApiResponse<IntakeDashboard>>('/intake/dashboard', { params: { demandType } })
  return response.data.data
}

export async function fetchIntakeDetail(id: number, recordView = true): Promise<IntakeDetail> {
  const response = await http.get<ApiResponse<IntakeDetail>>(`/intake/${id}`, { params: { recordView } })
  return response.data.data
}

export async function fetchIntakeTodos(id: number): Promise<PageResponse<IntakeTodo>> {
  const response = await http.get<ApiResponse<PageResponse<IntakeTodo>>>(buildIntakeTodosPath(id))
  return response.data.data
}

export async function createIntakeTodo(id: number, request: IntakeTodoCreateRequest): Promise<IntakeTodo> {
  const response = await http.post<ApiResponse<IntakeTodo>>(buildIntakeTodosPath(id), request)
  return response.data.data
}

export async function updateIntakeTodo(id: number, todoId: number, request: IntakeTodoUpdateRequest): Promise<IntakeTodo> {
  const response = await http.put<ApiResponse<IntakeTodo>>(buildIntakeTodoPath(id, todoId), request)
  return response.data.data
}

export async function updateIntakeTodoStatus(id: number, todoId: number, request: IntakeTodoStatusRequest): Promise<IntakeTodo> {
  const response = await http.post<ApiResponse<IntakeTodo>>(buildIntakeTodoStatusPath(id, todoId), request)
  return response.data.data
}

export async function deleteIntakeTodo(id: number, todoId: number): Promise<void> {
  await http.delete<ApiResponse<void>>(buildIntakeTodoPath(id, todoId))
}

export async function createUploadIntake(formData: FormData): Promise<IntakeDetail> {
  const projectGroup = formData.get('projectGroup')
  if (typeof projectGroup === 'string' && projectGroup && !formData.has('businessLineCode')) {
    formData.append('businessLineCode', projectGroup)
  }
  const response = await http.post<ApiResponse<IntakeDetail>>('/intake/upload', formData)
  return response.data.data
}

export async function retryIntakeEnrichment(id: number): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/enrichment/retry`)
  return response.data.data
}

export async function openIntakeRequirementFolder(id: number): Promise<IntakeRequirementFolder> {
  const response = await http.post<ApiResponse<IntakeRequirementFolder>>(`/intake/${id}/requirement-folder/open`)
  return response.data.data
}

export async function openIntakeDevelopmentPlanFolder(id: number): Promise<IntakeRequirementFolder> {
  const response = await http.post<ApiResponse<IntakeRequirementFolder>>(`/intake/${id}/development-plan-folder/open`)
  return response.data.data
}

export async function advanceIntakeStage(id: number, request: IntakeStageActionRequest | FormData): Promise<IntakeDetail> {
  const isFormData = typeof FormData !== 'undefined' && request instanceof FormData
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/stage-actions`, request, isFormData ? {} : undefined)
  return response.data.data
}

export async function pauseIntakeDemand(id: number, request: { reason: string; pauseDate: string }): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/pause`, request)
  return response.data.data
}

export async function resumeIntakeDemand(id: number): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/resume`)
  return response.data.data
}

export async function updateIntakeZentaoLink(id: number, zentaoUrl: string): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/zentao-link`, { zentaoUrl })
  return response.data.data
}

export async function updateIntakeDevelopmentBranch(id: number, developmentBranchName: string): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/development-branch`, { developmentBranchName })
  return response.data.data
}

export async function updateIntakeBusinessLine(id: number, request: IntakeBusinessLineUpdateRequest): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/business-line`, request)
  return response.data.data
}

export async function updateIntakePriority(id: number, request: { priority: string }): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/priority`, request)
  return response.data.data
}

export async function generateIntakeSqlDraft(id: number): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/sql-draft`, undefined, { timeout: 0 })
  return response.data.data
}

export async function fetchDevelopmentAnalysis(id: number): Promise<DevelopmentAnalysisResponse | null> {
  const response = await http.get<ApiResponse<DevelopmentAnalysisResponse | null>>(`/intake/${id}/development-analysis`)
  return normalizeDevelopmentAnalysis(response.data.data)
}

export async function fetchClarificationAnalysis(id: number): Promise<IntakeClarificationAnalysisResponse | null> {
  const response = await http.get<ApiResponse<IntakeClarificationAnalysisResponse | null>>(`/intake/${id}/clarification-analysis`)
  return response.data.data
}

export async function startClarificationAnalysis(id: number): Promise<IntakeClarificationAnalysisResponse> {
  const response = await http.post<ApiResponse<IntakeClarificationAnalysisResponse>>(`/intake/${id}/clarification-analysis`, undefined, { timeout: 0 })
  return response.data.data
}

export async function replyClarificationItem(
  id: number,
  request: { itemType: 'QUESTION' | 'RISK'; itemIndex: number; responseText?: string | null },
): Promise<IntakeClarificationAnalysisResponse> {
  const response = await http.post<ApiResponse<IntakeClarificationAnalysisResponse>>(
    `/intake/${id}/clarification-analysis/items/reply`,
    request,
  )
  return response.data.data
}

export async function updateDevelopmentAnalysisOwners(
  id: number,
  workItems: Array<{ index: number; ownerUserName: string | null }>,
): Promise<DevelopmentAnalysisResponse> {
  const response = await http.post<ApiResponse<DevelopmentAnalysisResponse>>(
    `/intake/${id}/development-analysis/owners`,
    { workItems },
  )
  return normalizeDevelopmentAnalysis(response.data.data)
}

export async function updateDevelopmentAnalysisDraft(
  id: number,
  draft: {
    projectGroup: string | null
    totalEstimatedEffort: string | null
    developmentEstimatedEffort: string | null
    testingEstimatedEffort: string | null
    plannedDueDate: string | null
    workItems: Array<{
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
    }>
  },
): Promise<DevelopmentAnalysisResponse> {
  const response = await http.post<ApiResponse<DevelopmentAnalysisResponse>>(
    `/intake/${id}/development-analysis/draft`,
    {
      ...draft,
      businessLine: draft.projectGroup,
      projectGroup: undefined,
    },
  )
  return normalizeDevelopmentAnalysis(response.data.data)
}

export async function confirmDevelopmentAnalysis(id: number): Promise<void> {
  await http.post<ApiResponse<unknown>>(`/intake/${id}/development-analysis/confirm`)
}

export async function syncIntakeZentao(id: number): Promise<void> {
  await http.post<ApiResponse<unknown>>(`/intake/${id}/zentao-sync`)
}

export async function deleteIntake(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/intake/${id}`)
}

export async function appendIntakeAttachments(id: number, formData: FormData): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/intake/${id}/attachments`, formData)
  return response.data.data
}

export async function deleteIntakeAttachment(id: number, attachmentId: number): Promise<IntakeDetail> {
  const response = await http.delete<ApiResponse<IntakeDetail>>(`/attachments/${attachmentId}`, {
    params: { intakeId: id },
  })
  return response.data.data
}

export async function replaceIntakeAttachment(id: number, attachmentId: number, formData: FormData): Promise<IntakeDetail> {
  const response = await http.post<ApiResponse<IntakeDetail>>(`/attachments/${attachmentId}/replace`, formData, {
    params: { intakeId: id },
  })
  return response.data.data
}

export async function downloadAttachment(id: number): Promise<Blob> {
  const response = await http.get(`/attachments/${id}/download`, { responseType: 'blob' })
  return response.data as Blob
}

function normalizeDevelopmentAnalysis<T extends DevelopmentAnalysisResponse | null>(analysis: T): T {
  if (!analysis?.draft) {
    return analysis
  }
  const draft = analysis.draft as typeof analysis.draft & { businessLine?: string; projectGroup?: string | null }
  if (!draft.projectGroup && draft.businessLine) {
    draft.projectGroup = draft.businessLine
  }
  return analysis
}
