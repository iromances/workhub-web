<script setup lang="ts">
import { DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  appendIntakeAttachments,
  advanceIntakeStage,
  createIntakeTodo,
  createUploadIntake,
  deleteIntakeAttachment,
  deleteIntake,
  deleteIntakeTodo,
  downloadAttachment,
  confirmDevelopmentAnalysis,
  fetchIntakeDetail,
  fetchIntakeRecords,
  fetchDevelopmentAnalysis,
  fetchClarificationAnalysis,
  generateIntakeSqlDraft,
  openIntakeDevelopmentPlanFolder,
  openIntakeRequirementFolder,
  pauseIntakeDemand,
  replyClarificationItem,
  replaceIntakeAttachment,
  resumeIntakeDemand,
  retryIntakeEnrichment,
  startClarificationAnalysis,
  syncIntakeZentao,
  updateDevelopmentAnalysisDraft,
  updateIntakeBusinessLine,
  updateIntakeDevelopmentBranch,
  updateIntakePriority,
  updateIntakeTodo,
  updateIntakeTodoStatus,
  updateIntakeZentaoLink,
} from '@/api/intake'
import { fetchProjectGroups, fetchSelectableProjectInvolvedSystems } from '@/api/project'
import { fetchDeveloperOptions } from '@/api/system-config'
import { useAuthStore } from '@/stores/auth'
import type { DevelopmentAnalysisResponse, DevelopmentWorkItemDraft, IntakeAttachment, IntakeClarificationAnalysisResponse, IntakeClarificationItem, IntakeDetail, IntakeSummary, IntakeTodo, ProjectGroup, ProjectInvolvedSystem, UserOption } from '@/types/work-item'
import { buildAcceptanceDateDisplay, buildReleaseDateDisplay, buildTestingDateDisplay } from './intakeDateColumns'
import {
  resolveDevelopmentProjectGroupCandidate,
  shouldIgnoreDevelopmentSystemOptionsError,
  shouldReloadDevelopmentDraftAfterSaveError,
} from './intakeProjectGroupErrors'
import {
  countActiveIntakeTodos,
  formatActiveTodoLabel,
  formatTodoTabLabel,
  isActiveIntakeTodoStatus,
  validateIntakeTodoEditableForm,
  validateIntakeTodoStatusForm,
} from './intakeTodoForms'

const authStore = useAuthStore()

const loading = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const intakeRecords = ref<IntakeSummary[]>([])
const projectGroups = ref<ProjectGroup[]>([])
const developmentSystemOptions = ref<ProjectInvolvedSystem[]>([])
const developmentDeveloperOptions = ref<UserOption[]>([])
const total = ref(0)
const detailVisible = ref(false)
const detailActiveTab = ref('basic')
const createDialogVisible = ref(false)
const selectedDetail = ref<IntakeDetail | null>(null)
const screenshotFiles = ref<File[]>([])
const attachmentFiles = ref<File[]>([])
const attachmentUpdating = ref(false)
const deletingAttachmentId = ref<number | null>(null)
const replacingAttachmentId = ref<number | null>(null)
const enrichmentRetryingId = ref<number | null>(null)
const requirementFolderOpeningId = ref<number | null>(null)
const developmentPlanFolderOpeningId = ref<number | null>(null)
const previewVisible = ref(false)
const previewImageUrl = ref('')
const previewImageName = ref('')
const previewContentType = ref('')
const stageActionVisible = ref(false)
const stageSubmitting = ref(false)
const stageActionRow = ref<IntakeSummary | null>(null)
const closeDemandVisible = ref(false)
const closeDemandSubmitting = ref(false)
const closeDemandTarget = ref<IntakeSummary | null>(null)
const pauseDemandVisible = ref(false)
const pauseDemandSubmitting = ref(false)
const pauseDemandTarget = ref<IntakeSummary | null>(null)
const zentaoSubmitting = ref(false)
const developmentBranchSubmitting = ref(false)
const businessLineDialogVisible = ref(false)
const businessLineSubmitting = ref(false)
const priorityDialogVisible = ref(false)
const prioritySubmitting = ref(false)
const priorityTarget = ref<IntakeSummary | null>(null)
const sqlDraftSubmitting = ref(false)
const todoFormVisible = ref(false)
const todoFormSubmitting = ref(false)
const todoFormMode = ref<'create' | 'edit'>('create')
const editingTodo = ref<IntakeTodo | null>(null)
const todoStatusVisible = ref(false)
const todoStatusSubmitting = ref(false)
const statusEditingTodo = ref<IntakeTodo | null>(null)
const deletingTodoId = ref<number | null>(null)
const developmentAnalysis = ref<DevelopmentAnalysisResponse | null>(null)
const clarificationAnalysis = ref<IntakeClarificationAnalysisResponse | null>(null)
const developmentConfirmSubmitting = ref(false)
const developmentDraftSaving = ref(false)
const clarificationAnalysisSubmitting = ref(false)
const clarificationReplySubmittingKey = ref('')

const filters = reactive({
  approvalCode: '',
  proposerName: '',
  requirementName: '',
  businessLine: '',
  requirementType: '',
  demandStatus: '',
  releasedDateRange: [] as string[] | null,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const createForm = reactive({
  senderName: '',
  developmentOwnerUserName: '',
  sourceChannel: '',
  rawContent: '',
  projectGroup: '',
})

const zentaoForm = reactive({
  url: '',
})

const developmentBranchForm = reactive({
  name: '',
})

const businessLineForm = reactive({
  businessLine: '',
})
const priorityForm = reactive({
  priority: '',
})

const todoForm = reactive({
  title: '',
  content: '',
  assigneeUserName: '',
  plannedAt: '',
})

const todoStatusForm = reactive({
  status: '',
  processResult: '',
  completedAt: '',
})

const todoStatusOptions = ['待处理', '处理中', '已完成', '已取消']

const stageActionForm = reactive({
  action: '',
  plannedDueDate: '',
  plannedDevelopmentStartDate: '',
  plannedTestingStartDate: '',
  plannedReleaseDate: '',
  actualEffort: '',
  actualCompletedTime: '',
  scheduledAcceptanceDate: '',
  actualTestingEffort: '',
  actualTestingCompletedDate: '',
  acceptanceTime: '',
  occurredAt: '',
  aiClarificationEnabled: true,
  projectGroup: '',
})

const closeDemandForm = reactive({
  closeReason: '',
  occurredAt: '',
})

const pauseDemandForm = reactive({
  reason: '',
  pauseDate: '',
})

const priorityOptions = ['高', '中', '低']

const updateHistories = computed(() =>
  (selectedDetail.value?.histories || []).filter((item) => item.actionType === 'UPDATE'),
)

const detailStageTimeline = computed(() => buildDemandStageTimeline(selectedDetail.value, developmentAnalysis.value))

const detailTodos = computed(() => selectedDetail.value?.todos || [])

const activeDetailTodoCount = computed(() => countActiveIntakeTodos(detailTodos.value))

const todoFormTitle = computed(() => (todoFormMode.value === 'create' ? '新增需求待办' : '编辑需求待办'))

const previewKind = computed(() => {
  if (!previewImageUrl.value) {
    return ''
  }
  if (isImagePreview(previewContentType.value, previewImageName.value)) {
    return 'image'
  }
  if (isPdfPreview(previewContentType.value, previewImageName.value)) {
    return 'pdf'
  }
  return ''
})

const isDevelopmentTaskEvaluationDialog = computed(() =>
  stageActionForm.action === 'COMPLETE_EVALUATION' && stageActionRow.value?.requirementType === '研发需求',
)
const canCreateRecord = computed(() => authStore.hasPermission('intake:record:create'))
const canViewDetail = computed(() => authStore.hasPermission('intake:record:detail'))
const canCopyCollaboration = computed(() => authStore.hasPermission('intake:collaboration:copy'))
const canOpenZentao = computed(() => authStore.hasPermission('intake:zentao:open'))
const canOpenRequirementFolder = computed(() => authStore.hasPermission('intake:requirement-folder:open'))
const canOpenDevelopmentPlanFolder = computed(() => authStore.hasPermission('intake:development-plan-folder:open'))
const canDeleteRecord = computed(() => authStore.hasPermission('intake:record:delete'))
const canOperateStage = computed(() => authStore.hasPermission('intake:stage:operate'))
const canOperateAi = computed(() => authStore.hasPermission('intake:ai:operate'))
const canManageTodo = computed(() => authStore.hasPermission('intake:todo:manage'))
const canManageAttachment = computed(() => authStore.hasAnyPermission(['intake:attachment:manage', 'intake:record:update']))
const canUpdateMetadata = computed(() => authStore.hasAnyPermission(['intake:metadata:update', 'intake:record:update']))
const canSyncZentao = computed(() => authStore.hasAnyPermission(['intake:zentao:sync', 'intake:ai:operate']))

function currentDevelopmentDemandStatus() {
  if (stageActionVisible.value && isDevelopmentTaskEvaluationDialog.value) {
    return stageActionRow.value?.demandStatus || ''
  }
  return selectedDetail.value?.demandStatus || stageActionRow.value?.demandStatus || ''
}

function canRunDevelopmentAnalysis() {
  return canOperateAi.value && currentDevelopmentDemandStatus() === '待评估'
}

function canConfirmDevelopmentDraft() {
  return Boolean(developmentAnalysis.value?.draft && developmentAnalysis.value.status === 'DRAFT' && canRunDevelopmentAnalysis())
}

function canEditDevelopmentDraft() {
  return Boolean(
    canOperateAi.value
    && currentDevelopmentDemandStatus()
    && !isDevelopmentAnalysisInProgress(developmentAnalysis.value?.status),
  )
}

function resolveDevelopmentProjectGroup(draftProjectGroup?: string | null) {
  const row = currentDevelopmentContextRow()
  const detail = currentDevelopmentContextDetail()
  return resolveDevelopmentProjectGroupCandidate({
    draftProjectGroup,
    stageProjectGroup: stageActionForm.projectGroup,
    rowBusinessLineCode: row?.businessLineCode,
    rowBusinessLine: row?.businessLine,
    rowProjectHint: row?.projectHint,
    detailBusinessLineCode: detail?.structuredData?.businessLineCode,
    detailBusinessLine: detail?.structuredData?.businessLine,
    detailProjectHint: detail?.structuredData?.projectHint,
  })
}

function formatProjectGroupOption(item: ProjectGroup) {
  return `${item.groupName} / ${item.gitlabGroupName || '未配置 GitLab 组'}`
}

let detailRequestToken = 0
let developmentAnalysisRequestToken = 0
let clarificationAnalysisRequestToken = 0
let openDetailRequestToken = 0

async function loadBaseData() {
  await Promise.all([loadProjectGroups(), loadIntakeRecords(), loadDevelopmentDeveloperOptions()])
}

async function loadProjectGroups() {
  try {
    projectGroups.value = await fetchProjectGroups()
  } catch (error) {
    console.error(error)
  }
}

async function loadIntakeRecords() {
  loading.value = true
  try {
    const releasedDateRange = Array.isArray(filters.releasedDateRange) ? filters.releasedDateRange : []
    const response = await fetchIntakeRecords({
      approvalCode: filters.approvalCode || undefined,
      proposerName: filters.proposerName || undefined,
      requirementName: filters.requirementName || undefined,
      businessLine: filters.businessLine || undefined,
      requirementType: filters.requirementType || undefined,
      demandStatus: filters.demandStatus || undefined,
      releasedStartDate: releasedDateRange[0] || undefined,
      releasedEndDate: releasedDateRange[1] || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    intakeRecords.value = response.items
    total.value = response.total
  } catch (error) {
    ElMessage.error('加载需求管理列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadIntakeRecords()
}

function handlePageChange(page: number) {
  pagination.page = page
  loadIntakeRecords()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  loadIntakeRecords()
}

function syncDevelopmentForms(detail: IntakeDetail | null) {
  zentaoForm.url = detail?.structuredData?.zentaoUrl || ''
  developmentBranchForm.name = detail?.structuredData?.developmentBranchName || ''
}

function normalizeIntakeDetail(detail: IntakeDetail) {
  detail.todos ||= []
  detail.attachments ||= []
  detail.histories ||= []
  detail.relatedWorkItems ||= []
  detail.involvedSystems ||= []
  return detail
}

function openBusinessLineDialog() {
  if (!selectedDetail.value) {
    return
  }
  businessLineForm.businessLine = selectedDetail.value.structuredData?.businessLineCode
    || selectedDetail.value.structuredData?.businessLine
    || ''
  businessLineDialogVisible.value = true
}

function resetBusinessLineDialog() {
  businessLineForm.businessLine = ''
}

async function submitBusinessLine() {
  if (!selectedDetail.value) {
    return
  }
  const businessLine = businessLineForm.businessLine.trim()
  if (!businessLine) {
    ElMessage.warning('请选择业务线')
    return
  }
  const intakeId = selectedDetail.value.id
  businessLineSubmitting.value = true
  try {
    const detail = normalizeIntakeDetail(await updateIntakeBusinessLine(intakeId, { businessLineCode: businessLine }))
    if (!selectedDetail.value || selectedDetail.value.id !== intakeId) {
      return
    }
    selectedDetail.value = detail
    syncDevelopmentForms(detail)
    stageActionForm.projectGroup = detail.structuredData?.businessLineCode || detail.structuredData?.businessLine || ''
    if (isDevelopmentRequirement(detail) && stageActionForm.projectGroup) {
      await loadDevelopmentTaskOptions(stageActionForm.projectGroup)
    }
    businessLineDialogVisible.value = false
    ElMessage.success('业务线已保存')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存业务线失败'))
    console.error(error)
  } finally {
    businessLineSubmitting.value = false
  }
}

function openPriorityDialog(row: IntakeSummary) {
  priorityTarget.value = row
  priorityForm.priority = row.priority || ''
  priorityDialogVisible.value = true
}

function resetPriorityDialog() {
  priorityTarget.value = null
  priorityForm.priority = ''
}

async function submitPriority() {
  if (!priorityTarget.value) {
    return
  }
  if (!priorityOptions.includes(priorityForm.priority)) {
    ElMessage.warning('请选择优先级')
    return
  }
  const intakeId = priorityTarget.value.id
  prioritySubmitting.value = true
  try {
    await updateIntakePriority(intakeId, { priority: priorityForm.priority })
    priorityDialogVisible.value = false
    ElMessage.success('优先级已保存')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存优先级失败'))
    console.error(error)
  } finally {
    prioritySubmitting.value = false
  }
}

function resolvePriorityTagType(priority: string | null | undefined) {
  switch (priority) {
    case '高':
      return 'danger'
    case '中':
      return 'warning'
    case '低':
      return 'info'
    default:
      return 'info'
  }
}

function openCreateTodoDialog() {
  if (!selectedDetail.value) {
    return
  }
  todoFormMode.value = 'create'
  editingTodo.value = null
  todoForm.title = ''
  todoForm.content = ''
  todoForm.assigneeUserName = authStore.userName || ''
  todoForm.plannedAt = ''
  todoFormVisible.value = true
}

function openEditTodoDialog(todo: IntakeTodo) {
  todoFormMode.value = 'edit'
  editingTodo.value = todo
  todoForm.title = todo.title || ''
  todoForm.content = todo.content || ''
  todoForm.assigneeUserName = todo.assigneeUserName || ''
  todoForm.plannedAt = normalizePickerDateTimeValue(todo.plannedAt)
  todoFormVisible.value = true
}

function resetTodoFormDialog() {
  editingTodo.value = null
  todoForm.title = ''
  todoForm.content = ''
  todoForm.assigneeUserName = ''
  todoForm.plannedAt = ''
  todoFormMode.value = 'create'
}

async function submitTodoForm() {
  if (!selectedDetail.value) {
    return
  }
  const validationMessage = validateIntakeTodoEditableForm(todoForm)
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }
  const intakeId = selectedDetail.value.id
  const payload = {
    title: todoForm.title.trim(),
    content: cleanNullableBusinessValue(todoForm.content),
    assigneeUserName: cleanNullableBusinessValue(todoForm.assigneeUserName),
    plannedAt: cleanNullableBusinessValue(todoForm.plannedAt),
  }
  todoFormSubmitting.value = true
  try {
    if (todoFormMode.value === 'edit' && editingTodo.value) {
      await updateIntakeTodo(intakeId, editingTodo.value.id, payload)
      ElMessage.success('待办已更新')
    } else {
      await createIntakeTodo(intakeId, payload)
      ElMessage.success('待办已新增')
    }
    todoFormVisible.value = false
    await refreshSelectedDetail(intakeId)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, todoFormMode.value === 'edit' ? '更新待办失败' : '新增待办失败'))
    console.error(error)
  } finally {
    todoFormSubmitting.value = false
  }
}

function openTodoStatusDialog(todo: IntakeTodo) {
  statusEditingTodo.value = todo
  todoStatusForm.status = todo.status || '待处理'
  todoStatusForm.processResult = todo.processResult || ''
  todoStatusForm.completedAt = normalizePickerDateTimeValue(todo.completedAt)
  todoStatusVisible.value = true
}

function resetTodoStatusDialog() {
  statusEditingTodo.value = null
  todoStatusForm.status = ''
  todoStatusForm.processResult = ''
  todoStatusForm.completedAt = ''
}

async function submitTodoStatus() {
  if (!selectedDetail.value || !statusEditingTodo.value) {
    return
  }
  const validationMessage = validateIntakeTodoStatusForm(todoStatusForm)
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }
  const intakeId = selectedDetail.value.id
  todoStatusSubmitting.value = true
  try {
    await updateIntakeTodoStatus(intakeId, statusEditingTodo.value.id, {
      status: todoStatusForm.status,
      processResult: cleanNullableBusinessValue(todoStatusForm.processResult),
      completedAt: cleanNullableBusinessValue(todoStatusForm.completedAt),
    })
    todoStatusVisible.value = false
    ElMessage.success('待办状态已更新')
    await refreshSelectedDetail(intakeId)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '更新待办状态失败'))
    console.error(error)
  } finally {
    todoStatusSubmitting.value = false
  }
}

async function deleteTodoFromDetail(todo: IntakeTodo) {
  if (!selectedDetail.value) {
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除待办“${todo.title || todo.id}”？`, '删除需求待办', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const intakeId = selectedDetail.value.id
  deletingTodoId.value = todo.id
  try {
    await deleteIntakeTodo(intakeId, todo.id)
    ElMessage.success('待办已删除')
    await refreshSelectedDetail(intakeId)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '删除待办失败'))
    console.error(error)
  } finally {
    deletingTodoId.value = null
  }
}

async function loadDetail(id: number, recordView = true) {
  const requestToken = ++detailRequestToken
  detailLoading.value = true
  try {
    const detail = normalizeIntakeDetail(await fetchIntakeDetail(id, recordView))
    if (requestToken !== detailRequestToken) {
      return null
    }
    selectedDetail.value = detail
    syncDevelopmentForms(detail)
    return detail
  } catch (error) {
    if (requestToken === detailRequestToken) {
      ElMessage.error('加载需求详情失败')
    }
    console.error(error)
    return null
  } finally {
    if (requestToken === detailRequestToken) {
      detailLoading.value = false
    }
  }
}

async function refreshSelectedDetail(intakeId: number) {
  const detail = normalizeIntakeDetail(await fetchIntakeDetail(intakeId, false))
  if (selectedDetail.value?.id === intakeId) {
    selectedDetail.value = detail
    syncDevelopmentForms(detail)
  }
  return detail
}

async function openDetail(id: number) {
  const openRequestToken = ++openDetailRequestToken
  if (!stageActionVisible.value) {
    stageActionRow.value = null
  }
  developmentAnalysisRequestToken += 1
  clarificationAnalysisRequestToken += 1
  detailVisible.value = true
  detailActiveTab.value = 'basic'
  const detail = await loadDetail(id, true)
  if (openRequestToken !== openDetailRequestToken) {
    return
  }
  if (!detail) {
    detailVisible.value = false
    return
  }
  stageActionForm.projectGroup = ''
  if (isDevelopmentRequirement(detail)) {
    await loadClarificationAnalysis(id, { expectedDetailId: id, clearBeforeLoad: true })
  }
  const analysis = await loadDevelopmentAnalysis(id, { expectedDetailId: id, clearBeforeLoad: true })
  if (analysis?.draft?.projectGroup) {
    stageActionForm.projectGroup = resolveDevelopmentProjectGroup(analysis.draft.projectGroup)
  }
  if (!analysis && isDevelopmentRequirement(detail) && detail.demandStatus === '待评估') {
    ensureManualDevelopmentDraft()
    if (developmentAnalysis.value?.draft?.projectGroup) {
      stageActionForm.projectGroup = resolveDevelopmentProjectGroup(developmentAnalysis.value.draft.projectGroup)
    }
    await loadDevelopmentTaskOptions(stageActionForm.projectGroup)
  }
}

function resetDetailDialog() {
  if (detailVisible.value) {
    return
  }
  openDetailRequestToken += 1
  detailRequestToken += 1
  developmentAnalysisRequestToken += 1
  clarificationAnalysisRequestToken += 1
  detailLoading.value = false
  selectedDetail.value = null
  detailActiveTab.value = 'basic'
  syncDevelopmentForms(null)
  clearDevelopmentAnalysisState()
  clearClarificationAnalysisState()
  developmentSystemOptions.value = []
  developmentDeveloperOptions.value = []
}

function clearDevelopmentAnalysisState() {
  developmentAnalysis.value = null
  stageActionForm.projectGroup = ''
}

function clearClarificationAnalysisState() {
  clarificationAnalysis.value = null
}

function currentDevelopmentContextRow() {
  if (stageActionVisible.value && isDevelopmentTaskEvaluationDialog.value) {
    return stageActionRow.value
  }
  return null
}

function currentDevelopmentContextIntakeId() {
  return currentDevelopmentContextRow()?.id || selectedDetail.value?.id || stageActionRow.value?.id || 0
}

function currentDevelopmentContextDetail() {
  const intakeId = currentDevelopmentContextIntakeId()
  return selectedDetail.value?.id === intakeId ? selectedDetail.value : null
}

async function loadDevelopmentAnalysis(id: number, options: { expectedDetailId?: number; clearBeforeLoad?: boolean } = {}) {
  const requestToken = ++developmentAnalysisRequestToken
  if (options.clearBeforeLoad) {
    developmentAnalysis.value = null
  }
  try {
    const analysis = await fetchDevelopmentAnalysis(id)
    if (requestToken !== developmentAnalysisRequestToken) {
      return null
    }
    if (options.expectedDetailId && selectedDetail.value?.id !== options.expectedDetailId) {
      return null
    }
    developmentAnalysis.value = normalizeDevelopmentAnalysisEffort(analysis)
    const projectGroup = resolveDevelopmentProjectGroup(developmentAnalysis.value?.draft?.projectGroup)
    if (projectGroup) {
      stageActionForm.projectGroup = projectGroup
      await loadDevelopmentTaskOptions(projectGroup)
    } else {
      await loadDevelopmentDeveloperOptions()
    }
    return analysis
  } catch (error) {
    if (requestToken === developmentAnalysisRequestToken) {
      developmentAnalysis.value = null
    }
    console.error(error)
    return null
  }
}

async function loadClarificationAnalysis(id: number, options: { expectedDetailId?: number; clearBeforeLoad?: boolean } = {}) {
  const requestToken = ++clarificationAnalysisRequestToken
  if (options.clearBeforeLoad) {
    clarificationAnalysis.value = null
  }
  try {
    const analysis = await fetchClarificationAnalysis(id)
    if (requestToken !== clarificationAnalysisRequestToken) {
      return null
    }
    if (options.expectedDetailId && selectedDetail.value?.id !== options.expectedDetailId) {
      return null
    }
    clarificationAnalysis.value = analysis
    return analysis
  } catch (error) {
    if (requestToken === clarificationAnalysisRequestToken) {
      clarificationAnalysis.value = null
    }
    console.error(error)
    return null
  }
}

async function loadDevelopmentSystemOptions(projectGroup: string) {
  const normalizedProjectGroup = projectGroup.trim()
  if (!normalizedProjectGroup) {
    developmentSystemOptions.value = []
    return
  }
  try {
    developmentSystemOptions.value = await fetchSelectableProjectInvolvedSystems(normalizedProjectGroup)
  } catch (error) {
    developmentSystemOptions.value = []
    if (!shouldIgnoreDevelopmentSystemOptionsError(error)) {
      ElMessage.error('加载涉及系统清单失败')
    }
    console.error(error)
  }
}

async function loadDevelopmentDeveloperOptions() {
  try {
    developmentDeveloperOptions.value = await fetchDeveloperOptions()
  } catch (error) {
    developmentDeveloperOptions.value = []
    ElMessage.error('加载负责人候选项失败')
    console.error(error)
  }
}

async function loadDevelopmentTaskOptions(projectGroup: string) {
  await Promise.all([
    loadDevelopmentSystemOptions(projectGroup),
    loadDevelopmentDeveloperOptions(),
  ])
}

function developmentSystemSelectOptions() {
  const byName = new Map<string, ProjectInvolvedSystem>()
  for (const system of developmentSystemOptions.value) {
    byName.set(system.systemName, system)
  }
  const workItems = developmentAnalysis.value?.draft?.workItems || []
  for (const item of workItems) {
    for (const systemName of sanitizeStringList(item.systemTags)) {
      if (!byName.has(systemName)) {
        byName.set(systemName, {
          id: -byName.size - 1,
          systemScope: 'PROJECT_GROUP',
          projectGroup: developmentAnalysis.value?.draft?.projectGroup || stageActionForm.projectGroup || '',
          systemName,
          description: null,
          enabled: false,
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
        })
      }
    }
  }
  return Array.from(byName.values())
}

function developmentDeveloperSelectOptions() {
  const byName = new Map<string, UserOption>()
  for (const developer of developmentDeveloperOptions.value) {
    if (developer.userName) {
      byName.set(developer.userName, developer)
    }
  }
  for (const developer of developmentAnalysis.value?.draft?.developerPool || []) {
    const normalized = cleanBusinessValue(developer)
    if (normalized && !byName.has(normalized)) {
      byName.set(normalized, { userName: normalized, displayName: normalized, projectGroup: null })
    }
  }
  for (const item of developmentAnalysis.value?.draft?.workItems || []) {
    const owner = cleanBusinessValue(item.ownerUserName)
    if (owner && !byName.has(owner)) {
      byName.set(owner, { userName: owner, displayName: owner, projectGroup: null })
    }
  }
  const demandOwner = cleanBusinessValue(currentDevelopmentContextDetail()?.developmentOwnerUserName || currentDevelopmentContextRow()?.developmentOwnerUserName)
  if (demandOwner && !byName.has(demandOwner)) {
    byName.set(demandOwner, { userName: demandOwner, displayName: demandOwner, projectGroup: null })
  }
  const currentUser = cleanBusinessValue(authStore.userName)
  if (currentUser && !byName.has(currentUser)) {
    byName.set(currentUser, { userName: currentUser, displayName: currentUser, projectGroup: null })
  }
  return Array.from(byName.values())
}

function openCreateDialog() {
  createForm.senderName = authStore.userName || ''
  createForm.developmentOwnerUserName = ''
  createForm.sourceChannel = '需求录入'
  createForm.rawContent = ''
  createForm.projectGroup = ''
  screenshotFiles.value = []
  attachmentFiles.value = []
  createDialogVisible.value = true
}

function isBlankBusinessValue(value: string | null | undefined) {
  const normalized = value?.trim()
  return !normalized || normalized === '-' || normalized === '无' || ['null', 'undefined'].includes(normalized.toLowerCase())
}

function cleanBusinessValue(value: string | null | undefined) {
  return isBlankBusinessValue(value) ? '' : value!.trim()
}

function cleanNullableBusinessValue(value: string | null | undefined) {
  const cleaned = cleanBusinessValue(value)
  return cleaned || null
}

function normalizeDevelopmentAnalysisEffort(analysis: DevelopmentAnalysisResponse) {
  if (!analysis.draft) {
    return analysis
  }
  analysis.draft.totalEstimatedEffort = cleanNullableBusinessValue(analysis.draft.totalEstimatedEffort)
  analysis.draft.developmentEstimatedEffort = cleanNullableBusinessValue(analysis.draft.developmentEstimatedEffort)
  analysis.draft.testingEstimatedEffort = cleanNullableBusinessValue(analysis.draft.testingEstimatedEffort)
  return analysis
}

function todayPickerDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function todayIsoDate() {
  return todayPickerDate().replaceAll('/', '-')
}

function firstDisplayValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!isBlankBusinessValue(value)) {
      return value!.trim()
    }
  }
  return '-'
}

function sanitizeStringList(values: string[] | null | undefined) {
  return (values || []).map((value) => value.trim()).filter(Boolean)
}

function displayChangePoints(item: DevelopmentWorkItemDraft) {
  const changePoints = sanitizeStringList(item.changePoints)
  if (changePoints.length) {
    return changePoints
  }
  const description = cleanBusinessValue(item.description)
  return description ? [description] : []
}

function mergeFiles(existing: File[], incoming: Iterable<File>) {
  const merged = [...existing]
  const seen = new Set(existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
  for (const file of incoming) {
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(file)
    }
  }
  return merged
}

function fileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function normalizeContentType(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function normalizeFileName(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function isImagePreview(contentType: string | null | undefined, fileName: string | null | undefined) {
  const normalizedContentType = normalizeContentType(contentType)
  const normalizedFileName = normalizeFileName(fileName)
  return normalizedContentType.startsWith('image/')
    || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((extension) => normalizedFileName.endsWith(extension))
}

function isPdfPreview(contentType: string | null | undefined, fileName: string | null | undefined) {
  return normalizeContentType(contentType) === 'application/pdf' || normalizeFileName(fileName).endsWith('.pdf')
}

function canPreviewFile(file: File) {
  return isImagePreview(file.type, file.name) || isPdfPreview(file.type, file.name)
}

function handleScreenshotChange(event: Event) {
  const target = event.target as HTMLInputElement
  screenshotFiles.value = mergeFiles(screenshotFiles.value, Array.from(target.files ?? []))
}

function handleAttachmentChange(event: Event) {
  const target = event.target as HTMLInputElement
  attachmentFiles.value = mergeFiles(attachmentFiles.value, Array.from(target.files ?? []))
}

function handleDroppedScreenshots(event: DragEvent) {
  screenshotFiles.value = mergeFiles(screenshotFiles.value, Array.from(event.dataTransfer?.files ?? []))
}

function handleDroppedAttachments(event: DragEvent) {
  attachmentFiles.value = mergeFiles(attachmentFiles.value, Array.from(event.dataTransfer?.files ?? []))
}

function handlePastedScreenshots(event: ClipboardEvent) {
  const imageFiles = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  if (!imageFiles.length) {
    return
  }

  screenshotFiles.value = mergeFiles(screenshotFiles.value, imageFiles)
  ElMessage.success(`已粘贴 ${imageFiles.length} 张需求截图`)
  event.preventDefault()
}

function handleCreateDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }
  if ((event as KeyboardEvent & { isComposing?: boolean }).isComposing) {
    return
  }
  const target = event.target as HTMLElement | null
  const tagName = target?.tagName?.toLowerCase()
  if (tagName === 'textarea' || target?.getAttribute('contenteditable') === 'true') {
    event.preventDefault()
  }
  void submitCreate()
}

async function submitCreate() {
  submitting.value = true
  try {
    if (!createForm.projectGroup.trim()) {
      ElMessage.warning('请选择业务线')
      return
    }
    if (!createForm.developmentOwnerUserName.trim()) {
      ElMessage.warning('请填写研发负责人')
      return
    }
    if (!createForm.rawContent.trim() && screenshotFiles.value.length === 0) {
      ElMessage.warning('请填写需求录入内容或上传需求截图')
      return
    }
    const formData = new FormData()
    formData.append('senderName', createForm.senderName)
    formData.append('developmentOwnerUserName', createForm.developmentOwnerUserName.trim())
    formData.append('sourceChannel', createForm.sourceChannel)
    if (createForm.rawContent) {
      formData.append('rawContent', createForm.rawContent)
    }
    formData.append('projectGroup', createForm.projectGroup.trim())
    if (screenshotFiles.value.length > 0) {
      screenshotFiles.value.forEach((file) => formData.append('screenshots', file))
    }
    attachmentFiles.value.forEach((file) => formData.append('attachments', file))
    await createUploadIntake(formData)
    createDialogVisible.value = false
    ElMessage.success('需求已提交，AI 正在后台识别并归类')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '提交待整理记录失败'))
    console.error(error)
  } finally {
    submitting.value = false
  }
}


function isOperationsDemand(requirementType: string | null | undefined) {
  return requirementType === '数据提取/运维'
}

function isDevelopmentRequirement(detail: IntakeDetail | null) {
  return detail?.structuredData?.requirementType === '研发需求'
}

function canCloseDemand(record: IntakeDetail | IntakeSummary | null) {
  return Boolean(canOperateStage.value && record?.demandStatus && !['已完成', '终止关闭', '已暂停'].includes(record.demandStatus))
}

function canPauseDemand(record: IntakeDetail | IntakeSummary | null) {
  return Boolean(canOperateStage.value && record?.demandStatus && !['已完成', '终止关闭', '已暂停'].includes(record.demandStatus))
}

function canResumeDemand(record: IntakeDetail | IntakeSummary | null) {
  return canOperateStage.value && record?.demandStatus === '已暂停'
}

function openCloseDemandDialog(row: IntakeSummary) {
  if (!canCloseDemand(row)) {
    ElMessage.warning('当前需求不允许关闭')
    return
  }
  closeDemandTarget.value = row
  closeDemandForm.closeReason = ''
  closeDemandForm.occurredAt = normalizePickerDateValue(new Date().toISOString())
  closeDemandVisible.value = true
}

function resetCloseDemandDialog() {
  closeDemandTarget.value = null
  closeDemandForm.closeReason = ''
  closeDemandForm.occurredAt = ''
}

async function submitCloseDemand() {
  if (!closeDemandTarget.value) {
    return
  }
  if (!closeDemandForm.closeReason.trim()) {
    ElMessage.warning('请输入关闭原因')
    return
  }
  closeDemandSubmitting.value = true
  try {
    const targetId = closeDemandTarget.value.id
    const detail = await advanceIntakeStage(targetId, {
      action: 'CLOSE_REQUIREMENT',
      closeReason: closeDemandForm.closeReason.trim(),
      occurredAt: closeDemandForm.occurredAt || undefined,
    })
    if (selectedDetail.value?.id === targetId) {
      selectedDetail.value = detail
    }
    closeDemandVisible.value = false
    ElMessage.success('需求已终止关闭')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '关闭需求失败'))
    console.error(error)
  } finally {
    closeDemandSubmitting.value = false
  }
}

function openPauseDemandDialog(row: IntakeSummary) {
  if (!canPauseDemand(row)) {
    ElMessage.warning('当前需求不允许暂停')
    return
  }
  pauseDemandTarget.value = row
  pauseDemandForm.reason = ''
  pauseDemandForm.pauseDate = todayIsoDate()
  pauseDemandVisible.value = true
}

function resetPauseDemandDialog() {
  pauseDemandTarget.value = null
  pauseDemandForm.reason = ''
  pauseDemandForm.pauseDate = ''
}

async function submitPauseDemand() {
  if (!pauseDemandTarget.value) {
    return
  }
  if (!pauseDemandForm.reason.trim()) {
    ElMessage.warning('请输入暂停原因')
    return
  }
  if (!pauseDemandForm.pauseDate) {
    ElMessage.warning('请选择暂停日期')
    return
  }
  pauseDemandSubmitting.value = true
  try {
    const targetId = pauseDemandTarget.value.id
    const detail = await pauseIntakeDemand(targetId, {
      reason: pauseDemandForm.reason.trim(),
      pauseDate: pauseDemandForm.pauseDate,
    })
    if (selectedDetail.value?.id === targetId) {
      selectedDetail.value = detail
    }
    pauseDemandVisible.value = false
    ElMessage.success('需求已暂停')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '暂停需求失败'))
    console.error(error)
  } finally {
    pauseDemandSubmitting.value = false
  }
}

async function resumeDemandFromRow(row: IntakeSummary) {
  if (!canResumeDemand(row)) {
    ElMessage.warning('当前需求不允许恢复')
    return
  }
  try {
    await ElMessageBox.confirm('确认恢复该需求到暂停前状态？', '恢复需求', {
      type: 'warning',
      confirmButtonText: '确认恢复',
      cancelButtonText: '取消',
    })
    const detail = await resumeIntakeDemand(row.id)
    if (selectedDetail.value?.id === row.id) {
      selectedDetail.value = detail
    }
    ElMessage.success('需求已恢复')
    await loadIntakeRecords()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(resolveErrorMessage(error, '恢复需求失败'))
      console.error(error)
    }
  }
}

function resolveActionForRow(row: IntakeSummary) {
  if (!canOperateStage.value) {
    return null
  }
  if (isOperationsDemand(row.requirementType)) {
    switch (row.demandStatus) {
      case '已收录':
        return 'CONFIRM_RECORDED'
      case '待澄清':
        return 'CONFIRM_CLARIFICATION'
      case '待处理':
        return 'START_PROCESSING'
      case '处理中':
        return 'SUBMIT_ACCEPTANCE'
      case '待验收':
        return 'CONFIRM_ACCEPTANCE'
      default:
        return null
    }
  }
  switch (row.demandStatus) {
    case '已收录':
      return 'START_CLARIFICATION'
    case '待澄清':
      return 'CONFIRM_CLARIFICATION'
    case '待评估':
      return 'COMPLETE_EVALUATION'
    case '待排期':
      return 'CONFIRM_SCHEDULING'
    case '待设计':
      return 'CONFIRM_DESIGN'
    case '开发中':
      return 'SUBMIT_TESTING'
    case '测试中':
      return 'PASS_TESTING'
    case '待上线':
      return 'CONFIRM_RELEASE'
    case '待验收':
      return 'CONFIRM_ACCEPTANCE'
    default:
      return null
  }
}

function resolveActionLabel(action: string | null) {
  switch (action) {
    case 'START_CLARIFICATION':
      return '开始澄清'
    case 'CONFIRM_RECORDED':
      return '确认收录'
    case 'CONFIRM_CLARIFICATION':
      return '澄清完成'
    case 'START_PROCESSING':
      return '开始处理'
    case 'SUBMIT_ACCEPTANCE':
      return '提交验收'
    case 'COMPLETE_EVALUATION':
      return '去评估'
    case 'CONFIRM_SCHEDULING':
      return '排期确认'
    case 'CONFIRM_DESIGN':
      return '设计完成'
    case 'SUBMIT_TESTING':
      return '提交测试'
    case 'PASS_TESTING':
      return '测试通过'
    case 'CONFIRM_ACCEPTANCE':
      return '验收通过'
    case 'CONFIRM_RELEASE':
      return '确认上线'
    case 'CLOSE_REQUIREMENT':
      return '关闭需求'
    default:
      return ''
  }
}

function resolveTaskTypeLabel(type: string | null | undefined) {
  switch (type) {
    case 'CODE_CHANGE':
      return '代码改造'
    case 'CONFIG_CHANGE':
      return '配置变更'
    case 'DATA_CHANGE':
      return '数据变更'
    case 'SQL_SCRIPT':
      return 'SQL脚本'
    case 'OPS_ACTION':
      return '运维操作'
    case 'VERIFY':
      return '验证项'
    case 'UNKNOWN':
      return '待确认'
    default:
      return '-'
  }
}

function resolveTaskTypeTagType(type: string | null | undefined) {
  switch (type) {
    case 'CODE_CHANGE':
      return ''
    case 'CONFIG_CHANGE':
      return 'warning'
    case 'DATA_CHANGE':
    case 'SQL_SCRIPT':
      return 'success'
    case 'VERIFY':
      return 'info'
    case 'OPS_ACTION':
      return 'danger'
    default:
      return 'info'
  }
}

function resolveConfidenceLabel(confidence: string | null | undefined) {
  switch (confidence) {
    case 'HIGH':
      return '高'
    case 'MEDIUM':
      return '中'
    case 'LOW':
      return '低'
    default:
      return '-'
  }
}

function resetStageActionForm() {
  stageActionForm.action = ''
  stageActionForm.plannedDueDate = ''
  stageActionForm.plannedDevelopmentStartDate = ''
  stageActionForm.plannedTestingStartDate = ''
  stageActionForm.plannedReleaseDate = ''
  stageActionForm.actualEffort = ''
  stageActionForm.actualCompletedTime = ''
  stageActionForm.scheduledAcceptanceDate = ''
  stageActionForm.actualTestingEffort = ''
  stageActionForm.actualTestingCompletedDate = ''
  stageActionForm.acceptanceTime = ''
  stageActionForm.occurredAt = normalizePickerDateValue(new Date().toISOString())
  stageActionForm.aiClarificationEnabled = true
  stageActionForm.projectGroup = ''
}

async function openStageActionDialog(row: IntakeSummary) {
  const action = resolveActionForRow(row)
  if (!action) {
    ElMessage.warning('当前阶段没有可执行的推进动作')
    return
  }
  stageActionRow.value = row
  resetStageActionForm()
  stageActionForm.action = action
  if (action === 'COMPLETE_EVALUATION') {
    if (row.requirementType === '研发需求') {
      stageActionVisible.value = true
      stageActionForm.projectGroup = ''
      const analysis = await loadDevelopmentAnalysis(row.id, { clearBeforeLoad: true })
      if (analysis?.draft) {
        const draft = analysis.draft
        stageActionForm.projectGroup = resolveDevelopmentProjectGroup(draft.projectGroup)
        stageActionForm.plannedDueDate = normalizePickerDateValue(draft.plannedDueDate || row.plannedDueDate)
      }
      ensureManualDevelopmentDraft()
      await loadDevelopmentTaskOptions(stageActionForm.projectGroup)
      return
    }
  }
  if (action === 'SUBMIT_TESTING' || action === 'SUBMIT_ACCEPTANCE') {
    stageActionForm.actualEffort = cleanBusinessValue(row.actualEffort)
    stageActionForm.actualCompletedTime = normalizePickerDateValue(row.actualCompletedTime) || normalizePickerDateValue(new Date().toISOString())
  }
  if (action === 'PASS_TESTING') {
    stageActionForm.scheduledAcceptanceDate = normalizePickerDateValue(row.scheduledAcceptanceDate) || normalizePickerDateValue(new Date().toISOString())
    stageActionForm.actualTestingEffort = cleanBusinessValue(row.actualTestingEffort)
    stageActionForm.actualTestingCompletedDate = normalizePickerDateValue(row.actualTestingCompletedDate) || normalizePickerDateValue(new Date().toISOString())
  }
  if (action === 'CONFIRM_ACCEPTANCE') {
    stageActionForm.acceptanceTime = normalizePickerDateValue(row.acceptanceTime) || normalizePickerDateValue(new Date().toISOString())
  }
  if (action === 'CONFIRM_SCHEDULING' && selectedDetail.value?.id === row.id) {
    stageActionForm.plannedDevelopmentStartDate = normalizePickerDateValue(selectedDetail.value.structuredData?.plannedDevelopmentStartDate) || todayPickerDate()
    stageActionForm.plannedTestingStartDate = normalizePickerDateValue(selectedDetail.value.structuredData?.plannedTestingStartDate)
    stageActionForm.plannedReleaseDate = normalizePickerDateValue(selectedDetail.value.structuredData?.plannedReleaseDate)
  } else if (action === 'CONFIRM_SCHEDULING') {
    stageActionForm.plannedDevelopmentStartDate = normalizePickerDateValue(row.plannedDevelopmentStartDate) || todayPickerDate()
    stageActionForm.plannedTestingStartDate = normalizePickerDateValue(row.plannedTestingStartDate)
    stageActionForm.plannedReleaseDate = normalizePickerDateValue(row.plannedReleaseDate)
  }
  stageActionVisible.value = true
}

async function handleTaskEvaluationProjectGroupChange() {
  stageActionForm.plannedDueDate = normalizePickerDateValue(stageActionRow.value?.plannedDueDate)
  ensureManualDevelopmentDraft()
  if (developmentAnalysis.value?.draft) {
    developmentAnalysis.value.draft.projectGroup = stageActionForm.projectGroup
    developmentAnalysis.value.draft.projectId = null
    developmentAnalysis.value.draft.projectName = null
    developmentAnalysis.value.draft.repositoryUrl = null
  }
  await loadDevelopmentTaskOptions(stageActionForm.projectGroup)
}

async function submitStageAction() {
  if (!stageActionRow.value || !stageActionForm.action) {
    return
  }
  const actualEffort = cleanBusinessValue(stageActionForm.actualEffort)
  const actualTestingEffort = cleanBusinessValue(stageActionForm.actualTestingEffort)
  if (stageActionForm.action === 'SUBMIT_TESTING') {
    if (!stageActionForm.occurredAt) {
      ElMessage.warning('请选择实际提测日期')
      return
    }
    if (!actualEffort) {
      ElMessage.warning('请填写实际开发工时')
      return
    }
    if (parseEffortHours(actualEffort) === null) {
      ElMessage.warning('实际开发工时格式不正确，请输入如 8h 或 1d')
      return
    }
    if (!stageActionForm.actualCompletedTime) {
      ElMessage.warning('请选择实际开发完成日期')
      return
    }
  }
  if (stageActionForm.action === 'SUBMIT_ACCEPTANCE' && actualEffort && parseEffortHours(actualEffort) === null) {
    ElMessage.warning('实际工时格式不正确，请输入如 8h 或 1d')
    return
  }
  if (stageActionForm.action === 'PASS_TESTING') {
    if (!stageActionForm.scheduledAcceptanceDate) {
      ElMessage.warning('请选择预约验收日期')
      return
    }
    if (!actualTestingEffort) {
      ElMessage.warning('请填写实际测试工时')
      return
    }
    if (parseEffortHours(actualTestingEffort) === null) {
      ElMessage.warning('实际测试工时格式不正确，请输入如 8h 或 1d')
      return
    }
    if (!stageActionForm.actualTestingCompletedDate) {
      ElMessage.warning('请选择实际测试完成日期')
      return
    }
  }
  if (stageActionForm.action === 'CONFIRM_ACCEPTANCE' && !stageActionForm.acceptanceTime) {
    ElMessage.warning('请选择实际验收日期')
    return
  }
  if (stageActionForm.action === 'CONFIRM_RELEASE' && !stageActionForm.occurredAt) {
    ElMessage.warning('请选择实际上线日期')
    return
  }
  if (
    stageActionForm.action === 'CONFIRM_SCHEDULING'
    && stageActionForm.plannedDevelopmentStartDate
    && stageActionForm.plannedTestingStartDate
    && stageActionForm.plannedTestingStartDate < stageActionForm.plannedDevelopmentStartDate
  ) {
    ElMessage.warning('预估提测日期不能早于预估开发日期')
    return
  }
  if (
    stageActionForm.action === 'CONFIRM_SCHEDULING'
    && stageActionForm.plannedTestingStartDate
    && stageActionForm.plannedReleaseDate
    && stageActionForm.plannedReleaseDate < stageActionForm.plannedTestingStartDate
  ) {
    ElMessage.warning('预估上线日期不能早于预估提测日期')
    return
  }
  stageSubmitting.value = true
  try {
    const payload = {
      action: stageActionForm.action,
      plannedDueDate: stageActionForm.plannedDueDate || undefined,
      plannedDevelopmentStartDate: stageActionForm.plannedDevelopmentStartDate || undefined,
      plannedTestingStartDate: stageActionForm.plannedTestingStartDate || undefined,
      plannedReleaseDate: stageActionForm.plannedReleaseDate || undefined,
      actualEffort: actualEffort || undefined,
      actualCompletedTime: stageActionForm.actualCompletedTime || undefined,
      scheduledAcceptanceDate: stageActionForm.scheduledAcceptanceDate || undefined,
      actualTestingEffort: actualTestingEffort || undefined,
      actualTestingCompletedDate: stageActionForm.actualTestingCompletedDate || undefined,
      acceptanceTime: stageActionForm.acceptanceTime || undefined,
      occurredAt: stageActionForm.occurredAt || undefined,
      aiClarificationEnabled: stageActionForm.action === 'START_CLARIFICATION'
        ? stageActionForm.aiClarificationEnabled
        : undefined,
    }
    const detail = await advanceIntakeStage(stageActionRow.value.id, payload)
    if (selectedDetail.value?.id === detail.id) {
      selectedDetail.value = detail
      if (isDevelopmentRequirement(detail)) {
        if (stageActionForm.action === 'START_CLARIFICATION' && stageActionForm.aiClarificationEnabled) {
          await loadClarificationAnalysis(detail.id, { expectedDetailId: detail.id, clearBeforeLoad: true })
        }
        if (stageActionForm.action === 'CONFIRM_CLARIFICATION') {
          await loadDevelopmentAnalysis(detail.id, { expectedDetailId: detail.id, clearBeforeLoad: true })
        }
      }
    }
    stageActionVisible.value = false
    ElMessage.success(`${resolveActionLabel(stageActionForm.action)}已完成`)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '推进需求阶段失败'))
    console.error(error)
  } finally {
    stageSubmitting.value = false
  }
}

async function submitZentaoLink() {
  if (!selectedDetail.value) {
    return
  }
  const intakeId = selectedDetail.value.id
  zentaoSubmitting.value = true
  try {
    const detail = await updateIntakeZentaoLink(intakeId, zentaoForm.url)
    if (!selectedDetail.value || selectedDetail.value.id !== intakeId) {
      return
    }
    selectedDetail.value = detail
    syncDevelopmentForms(detail)
    ElMessage.success('禅道地址已保存')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存禅道地址失败'))
    console.error(error)
  } finally {
    zentaoSubmitting.value = false
  }
}

async function submitDevelopmentBranch() {
  if (!selectedDetail.value) {
    return
  }
  const branchName = developmentBranchForm.name.trim()
  if (!branchName) {
    ElMessage.warning('请输入研发分支')
    return
  }
  const intakeId = selectedDetail.value.id
  developmentBranchSubmitting.value = true
  try {
    const detail = await updateIntakeDevelopmentBranch(intakeId, branchName)
    if (!selectedDetail.value || selectedDetail.value.id !== intakeId) {
      return
    }
    selectedDetail.value = detail
    syncDevelopmentForms(detail)
    ElMessage.success('研发分支已保存')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存研发分支失败'))
    console.error(error)
  } finally {
    developmentBranchSubmitting.value = false
  }
}

async function copyDevelopmentBranch(branchName: string | null) {
  const normalizedBranchName = branchName?.trim()
  if (!normalizedBranchName) {
    ElMessage.warning('当前需求没有研发分支')
    return
  }
  try {
    await copyTextToClipboard(normalizedBranchName)
    ElMessage.success('研发分支已复制')
  } catch {
    ElMessage.error('复制研发分支失败')
  }
}

async function copyRequirementValue(label: string, value: string | null | undefined) {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    ElMessage.warning(`当前需求没有${label}`)
    return
  }
  try {
    await copyTextToClipboard(normalizedValue)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error(`${label}复制失败`)
  }
}

function openExternalLink(url: string | null) {
  const normalizedUrl = url?.trim()
  if (!normalizedUrl) {
    ElMessage.warning('请先填写禅道地址')
    return
  }
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
}

type DevelopmentCollaborationSource = Pick<
  IntakeSummary,
  'requirementName' | 'requirementDigest' | 'approvalCode' | 'developmentBranchName' | 'zentaoUrl'
>

function buildDevelopmentCollaborationInfo(source: DevelopmentCollaborationSource) {
  const requirementName = cleanBusinessValue(source.requirementName || source.requirementDigest) || '-'
  const approvalCode = cleanBusinessValue(source.approvalCode) || '-'
  const branchName = cleanBusinessValue(source.developmentBranchName) || '-'
  const zentaoUrl = cleanBusinessValue(source.zentaoUrl) || '-'
  return `需求名称：${requirementName}\n审批编号：${approvalCode}\n研发分支：${branchName}\n禅道地址：${zentaoUrl}`
}

async function copyDevelopmentCollaborationInfo(source?: DevelopmentCollaborationSource | null) {
  const structuredData = source || selectedDetail.value?.structuredData
  if (!structuredData) {
    ElMessage.warning('当前需求没有研发协同信息')
    return
  }
  try {
    await copyTextToClipboard(buildDevelopmentCollaborationInfo(structuredData))
    ElMessage.success('研发协同信息已复制')
  } catch {
    ElMessage.error('复制研发协同信息失败')
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const succeeded = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!succeeded) {
    throw new Error('execCommand copy failed')
  }
}

async function generateSqlDraft() {
  if (!selectedDetail.value) {
    return
  }
  sqlDraftSubmitting.value = true
  try {
    const detail = await generateIntakeSqlDraft(selectedDetail.value.id)
    selectedDetail.value = detail
    ElMessage.success('SQL 草稿已生成，请人工确认后再执行')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '生成 SQL 草稿失败'))
    console.error(error)
  } finally {
    sqlDraftSubmitting.value = false
  }
}

function clarificationItems(type: 'QUESTION' | 'RISK') {
  return (clarificationAnalysis.value?.items || []).filter((item) => item.itemType === type)
}

function resolveClarificationStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'PENDING':
      return '排队中'
    case 'RUNNING':
      return '分析中'
    case 'DRAFT':
      return '待处理'
    case 'FAILED':
      return '失败'
    case 'CONFIRMED':
      return '已确认'
    default:
      return '未开始'
  }
}

function resolveClarificationItemStatusLabel(item: IntakeClarificationItem) {
  if (item.status === 'RESPONDED') {
    return '已回复'
  }
  if (item.status === 'ACKNOWLEDGED') {
    return '已确认'
  }
  return '待处理'
}

function resolveClarificationItemStatusType(item: IntakeClarificationItem) {
  return item.status === 'PENDING' ? 'warning' : 'success'
}

function clarificationReplyKey(item: IntakeClarificationItem) {
  return `${item.itemType}:${item.index}`
}

function isClarificationInProgress(status: string | null | undefined) {
  return status === 'PENDING' || status === 'RUNNING'
}

async function runClarificationAnalysis() {
  if (!selectedDetail.value) {
    return
  }
  clarificationAnalysisSubmitting.value = true
  try {
    clarificationAnalysis.value = await startClarificationAnalysis(selectedDetail.value.id)
    ElMessage.success('已提交需求澄清分析')
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '提交需求澄清分析失败'))
    console.error(error)
  } finally {
    clarificationAnalysisSubmitting.value = false
  }
}

async function saveClarificationReply(item: IntakeClarificationItem) {
  if (!selectedDetail.value) {
    return
  }
  if (item.itemType === 'QUESTION' && !cleanBusinessValue(item.responseText)) {
    ElMessage.warning('请先填写回复内容')
    return
  }
  const key = clarificationReplyKey(item)
  clarificationReplySubmittingKey.value = key
  try {
    clarificationAnalysis.value = await replyClarificationItem(selectedDetail.value.id, {
      itemType: item.itemType,
      itemIndex: item.index,
      responseText: cleanNullableBusinessValue(item.responseText),
    })
    ElMessage.success(item.itemType === 'QUESTION' ? '回复已保存' : '风险已确认')
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存澄清项失败'))
    console.error(error)
  } finally {
    clarificationReplySubmittingKey.value = ''
  }
}

async function handleDelete(row: IntakeSummary) {
  try {
    await ElMessageBox.confirm(
      `删除后该需求将不再出现在需求管理列表中。是否删除“${row.requirementDigest || row.approvalCode || row.id}”？`,
      '删除需求',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    await deleteIntake(row.id)
    if (selectedDetail.value?.id === row.id) {
      detailVisible.value = false
      selectedDetail.value = null
    }
    ElMessage.success('需求已删除')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '删除需求失败'))
    console.error(error)
  }
}

async function openRequirementFolder(row: IntakeSummary) {
  requirementFolderOpeningId.value = row.id
  try {
    const result = await openIntakeRequirementFolder(row.id)
    ElMessage.success(`已打开需求文件夹：${result.folderPath}`)
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '打开需求文件夹失败'))
    console.error(error)
  } finally {
    requirementFolderOpeningId.value = null
  }
}

async function openDevelopmentPlanFolder(row: IntakeSummary) {
  developmentPlanFolderOpeningId.value = row.id
  try {
    const result = await openIntakeDevelopmentPlanFolder(row.id)
    ElMessage.success(`已打开开发方案文件夹：${result.folderPath}`)
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '打开开发方案文件夹失败'))
    console.error(error)
  } finally {
    developmentPlanFolderOpeningId.value = null
  }
}

function canGenerateSqlDraft(detail: IntakeDetail | null) {
  return canOperateAi.value && detail?.structuredData?.requirementType === '数据提取/运维'
}

function deliveryDataAttachments(detail: IntakeDetail | null) {
  return (detail?.attachments || []).filter((item) => item.category === '数据文件')
}

function ensureManualDevelopmentDraft() {
  if (developmentAnalysis.value?.draft) {
    return
  }
  const intakeId = currentDevelopmentContextIntakeId()
  const detail = currentDevelopmentContextDetail()
  const row = currentDevelopmentContextRow()
  const structuredData = detail?.structuredData
  const projectGroup = resolveDevelopmentProjectGroup()
  stageActionForm.projectGroup = projectGroup
  developmentAnalysis.value = {
    id: 0,
    intakeId,
    status: 'DRAFT',
    message: '人工录入研发任务草稿',
    draft: {
      status: 'DRAFT',
      businessLine: projectGroup,
      projectGroup,
      projectId: null,
      projectName: null,
      repositoryUrl: null,
      requirementRawPath: null,
      requirementWikiPath: null,
      requirementWikiUrl: null,
      summary: structuredData?.requirementSummary || structuredData?.requirementDigest || '人工录入研发任务草稿',
      requirementChangePoints: [],
      impactedModules: [],
      risks: [],
      questions: [],
      developerPool: [],
      workItems: [],
      totalEstimatedEffort: null,
      developmentEstimatedEffort: null,
      testingEstimatedEffort: null,
	      plannedDueDate: null,
      plannedDevelopmentStartDate: null,
      plannedTestingStartDate: null,
      plannedTestingEndDate: null,
      plannedReleaseDate: null,
	      zentaoSyncStatus: 'RESERVED',
      zentaoSyncMessage: '禅道同步接口已预留，当前不会调用禅道。',
      generatedAt: new Date().toISOString(),
      generator: 'manual',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function parseEffortHours(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }
  const matcher = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*(d|day|days|天|人天|工作日|h|hour|hours|小时)?$/i)
  if (!matcher) {
    return null
  }
  const amount = Number(matcher[1])
  if (!Number.isFinite(amount)) {
    return null
  }
  const unit = (matcher[2] || 'h').toLowerCase()
  return ['d', 'day', 'days', '天', '人天', '工作日'].includes(unit) ? amount * 8 : amount
}

function formatEffortHours(hours: number) {
  return `${Number(hours.toFixed(2)).toString()}h`
}

function sumWorkItemEffortHours() {
  const workItems = developmentAnalysis.value?.draft?.workItems || []
  let total = 0
  let hasEffort = false
  for (const item of workItems) {
    const hours = parseEffortHours(item.estimatedEffort)
    if (hours === null) {
      continue
    }
    total += hours
    hasEffort = true
  }
  return hasEffort ? total : null
}

function syncDevelopmentTotalEffort() {
  const draft = developmentAnalysis.value?.draft
  if (!draft) {
    return
  }
  const developmentHours = sumWorkItemEffortHours()
  const testingHours = parseEffortHours(draft.testingEstimatedEffort)
  draft.totalEstimatedEffort = developmentHours === null && testingHours === null
    ? null
    : formatEffortHours((developmentHours || 0) + (testingHours || 0))
  draft.developmentEstimatedEffort = developmentHours === null ? null : formatEffortHours(developmentHours)
}

function deleteDevelopmentWorkItem(index: number) {
  if (!canEditDevelopmentDraft()) {
    ElMessage.warning('当前需求不允许调整研发任务')
    return
  }
  developmentAnalysis.value?.draft?.workItems.splice(index, 1)
  syncDevelopmentTotalEffort()
}

function addDevelopmentWorkItem() {
  if (!canEditDevelopmentDraft()) {
    ElMessage.warning('当前需求不允许调整研发任务')
    return
  }
  ensureManualDevelopmentDraft()
  const draft = developmentAnalysis.value?.draft
  if (!draft) {
    return
  }
  draft.workItems.push({
    title: `新增任务项 ${draft.workItems.length + 1}`,
    description: null,
    requirementChangePoint: null,
    taskType: null,
    targetResources: [],
    changePoints: [],
    systemTags: [],
    evidenceRefs: [],
    confidence: null,
    moduleName: null,
    relatedFiles: [],
    estimatedEffort: null,
    ownerUserName: null,
    priority: null,
    plannedStartDate: null,
    plannedEndDate: null,
    dependency: null,
    risk: null,
  })
}

function buildDevelopmentDraftItems() {
  const workItems = developmentAnalysis.value?.draft?.workItems || []
  return workItems.map((item) => ({
    title: cleanBusinessValue(item.title) || cleanBusinessValue(item.description),
    description: cleanNullableBusinessValue(item.description),
    requirementChangePoint: cleanNullableBusinessValue(item.requirementChangePoint),
    taskType: cleanNullableBusinessValue(item.taskType),
    targetResources: sanitizeStringList(item.targetResources),
    changePoints: sanitizeStringList(item.changePoints),
    systemTags: sanitizeStringList(item.systemTags),
    evidenceRefs: sanitizeStringList(item.evidenceRefs),
    confidence: cleanNullableBusinessValue(item.confidence),
    moduleName: cleanNullableBusinessValue(item.moduleName),
    relatedFiles: sanitizeStringList(item.relatedFiles),
    estimatedEffort: cleanNullableBusinessValue(item.estimatedEffort),
    ownerUserName: cleanNullableBusinessValue(item.ownerUserName),
    priority: cleanNullableBusinessValue(item.priority),
    plannedStartDate: cleanNullableBusinessValue(item.plannedStartDate),
    plannedEndDate: cleanNullableBusinessValue(item.plannedEndDate),
    dependency: cleanNullableBusinessValue(item.dependency),
    risk: cleanNullableBusinessValue(item.risk),
  }))
}

function validateDevelopmentDraftItems(workItems: ReturnType<typeof buildDevelopmentDraftItems>) {
  const draft = developmentAnalysis.value?.draft
  const testingEstimatedEffort = cleanBusinessValue(draft?.testingEstimatedEffort)
  if (testingEstimatedEffort && parseEffortHours(testingEstimatedEffort) === null) {
    ElMessage.warning('测试工时格式不正确，请输入如 4h 或 0.5d')
    return false
  }
  syncDevelopmentTotalEffort()
  const totalEstimatedEffort = cleanBusinessValue(draft?.totalEstimatedEffort)
  if (totalEstimatedEffort && parseEffortHours(totalEstimatedEffort) === null) {
    ElMessage.warning('总评估工时格式不正确，请输入如 8h 或 1d')
    return false
  }
  const invalidIndex = workItems.findIndex((item) => !item.title)
  if (invalidIndex >= 0) {
    ElMessage.warning(`第 ${invalidIndex + 1} 个任务项不能为空`)
    return false
  }
  const invalidEffortIndex = workItems.findIndex((item) => item.estimatedEffort && parseEffortHours(item.estimatedEffort) === null)
  if (invalidEffortIndex >= 0) {
    ElMessage.warning(`第 ${invalidEffortIndex + 1} 个任务工时格式不正确，请输入如 8 或 8h`)
    return false
  }
  const invalidSystemIndex = workItems.findIndex((item) => item.systemTags.length === 0)
  if (invalidSystemIndex >= 0) {
    ElMessage.warning(`第 ${invalidSystemIndex + 1} 个任务必须选择涉及系统`)
    return false
  }
  return true
}

async function persistDevelopmentDraft(intakeId: number, showSuccess = true) {
  if (!developmentAnalysis.value?.draft) {
    return false
  }
  if (developmentAnalysis.value.intakeId && developmentAnalysis.value.intakeId !== intakeId) {
    ElMessage.error('研发任务上下文已切换，请重新打开当前需求后再保存')
    await loadDevelopmentAnalysis(intakeId, selectedDetail.value?.id === intakeId ? { expectedDetailId: intakeId, clearBeforeLoad: true } : { clearBeforeLoad: true })
    return false
  }
  const projectGroup = cleanBusinessValue(stageActionForm.projectGroup || developmentAnalysis.value.draft.projectGroup)
  const workItems = buildDevelopmentDraftItems()
  if (workItems.length > 0 && !projectGroup) {
    ElMessage.warning('请先选择业务线')
    return false
  }
  if (!validateDevelopmentDraftItems(workItems)) {
    return false
  }
  developmentDraftSaving.value = true
  try {
    const updatedAnalysis = await updateDevelopmentAnalysisDraft(intakeId, {
      projectGroup,
      totalEstimatedEffort: cleanNullableBusinessValue(developmentAnalysis.value.draft.totalEstimatedEffort),
      developmentEstimatedEffort: null,
      testingEstimatedEffort: cleanNullableBusinessValue(developmentAnalysis.value.draft.testingEstimatedEffort),
      plannedDueDate: null,
      workItems,
    })
    developmentAnalysis.value = normalizeDevelopmentAnalysisEffort(updatedAnalysis)
    if (selectedDetail.value?.id === intakeId) {
      const detail = await fetchIntakeDetail(intakeId, false)
      if (selectedDetail.value?.id === intakeId) {
        selectedDetail.value = detail
        syncDevelopmentForms(detail)
      }
    }
    await loadIntakeRecords()
    if (showSuccess) {
      ElMessage.success('研发任务已保存')
    }
    return true
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存研发任务失败'))
    if (shouldReloadDevelopmentDraftAfterSaveError(error)) {
      await loadDevelopmentAnalysis(intakeId, selectedDetail.value?.id === intakeId ? { expectedDetailId: intakeId } : {})
    }
    console.error(error)
    return false
  } finally {
    developmentDraftSaving.value = false
  }
}

async function confirmDevelopmentDraft() {
  const intakeId = currentDevelopmentContextIntakeId()
  if (!intakeId) {
    return
  }
  if (!canConfirmDevelopmentDraft()) {
    ElMessage.warning('仅待评估且处于草稿状态的研发评估允许确认')
    return
  }
  try {
    const hasWorkItems = Boolean(developmentAnalysis.value?.draft?.workItems?.length)
    await ElMessageBox.confirm(
      hasWorkItems ? '确认后会按当前草稿批量创建正式工作项，并把需求推进到待排期，是否继续？' : '确认后会把需求推进到待排期，暂不创建正式工作项，是否继续？',
      '评估完成',
      {
      type: 'warning',
      confirmButtonText: '评估完成',
      cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  developmentConfirmSubmitting.value = true
  try {
    const saved = await persistDevelopmentDraft(intakeId, false)
    if (!saved) {
      return
    }
    await confirmDevelopmentAnalysis(intakeId)
    await loadDevelopmentAnalysis(intakeId, { expectedDetailId: intakeId })
    const detail = await fetchIntakeDetail(intakeId, false)
    if (selectedDetail.value?.id === intakeId) {
      selectedDetail.value = detail
      syncDevelopmentForms(detail)
    }
    if (stageActionRow.value?.id === intakeId) {
      stageActionVisible.value = false
    }
    ElMessage.success('需求已进入待排期')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '评估完成失败'))
    console.error(error)
  } finally {
    developmentConfirmSubmitting.value = false
  }
}

async function saveDevelopmentDraft() {
  const intakeId = currentDevelopmentContextIntakeId()
  if (!intakeId) {
    return
  }
  if (!canEditDevelopmentDraft()) {
    ElMessage.warning('当前需求不允许保存研发任务')
    return
  }
  await persistDevelopmentDraft(intakeId)
}

async function reserveZentaoSync() {
  if (!selectedDetail.value) {
    return
  }
  try {
    await syncIntakeZentao(selectedDetail.value.id)
    await loadDevelopmentAnalysis(selectedDetail.value.id, { expectedDetailId: selectedDetail.value.id })
    ElMessage.info('禅道同步接口已预留，当前未执行外部同步')
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '同步禅道失败'))
    console.error(error)
  }
}

async function handleDownload(item: IntakeAttachment) {
  try {
    const blob = await downloadAttachment(item.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('下载附件失败')
    console.error(error)
  }
}

function pickFiles(options: { multiple: boolean; accept?: string }, onSelected: (files: File[]) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = options.multiple
  if (options.accept) {
    input.accept = options.accept
  }
  input.onchange = () => {
    onSelected(Array.from(input.files ?? []))
  }
  input.click()
}

function openAppendAttachmentPicker() {
  pickFiles({ multiple: true }, (files) => {
    void submitDetailAttachments(files)
  })
}

function openReplaceAttachmentPicker(item: IntakeAttachment) {
  pickFiles({ multiple: false, accept: item.category === '截图' ? 'image/*' : undefined }, (files) => {
    const [file] = files
    if (file) {
      void replaceAttachmentFromDetail(item, file)
    }
  })
}

async function submitDetailAttachments(files: File[]) {
  if (!selectedDetail.value) {
    return
  }
  if (!files.length) {
    return
  }
  attachmentUpdating.value = true
  try {
    const formData = new FormData()
    files.forEach((file) => formData.append('attachments', file))
    selectedDetail.value = await appendIntakeAttachments(selectedDetail.value.id, formData)
    ElMessage.success('需求附件已更新')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '更新需求附件失败'))
    console.error(error)
  } finally {
    attachmentUpdating.value = false
  }
}

function canRetryEnrichment(record: Pick<IntakeDetail, 'enrichmentStatus'> | Pick<IntakeSummary, 'enrichmentStatus'> | null | undefined) {
  return canOperateAi.value && record?.enrichmentStatus === 'FAILED'
}

async function retryEnrichmentFromRow(row: IntakeSummary) {
  try {
    await ElMessageBox.confirm(
      '系统会重新读取当前需求截图和附件，并在后台异步识别结构化字段。是否重试？',
      '重试识别',
      {
        type: 'warning',
        confirmButtonText: '重试',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  await submitEnrichmentRetry(row.id)
}

async function retryEnrichmentFromDetail() {
  if (!selectedDetail.value) {
    return
  }
  await submitEnrichmentRetry(selectedDetail.value.id)
}

async function submitEnrichmentRetry(id: number) {
  enrichmentRetryingId.value = id
  try {
    const detail = await retryIntakeEnrichment(id)
    if (selectedDetail.value?.id === id) {
      selectedDetail.value = detail
    }
    ElMessage.success('已重新提交识别，后台处理中')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '重试识别失败'))
    console.error(error)
  } finally {
    enrichmentRetryingId.value = null
  }
}

async function replaceAttachmentFromDetail(item: IntakeAttachment, file: File) {
  if (!selectedDetail.value) {
    return
  }
  replacingAttachmentId.value = item.id
  try {
    const formData = new FormData()
    formData.append('file', file)
    selectedDetail.value = await replaceIntakeAttachment(selectedDetail.value.id, item.id, formData)
    ElMessage.success('需求附件已替换')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '替换需求附件失败'))
    console.error(error)
  } finally {
    replacingAttachmentId.value = null
  }
}

async function deleteAttachmentFromDetail(item: IntakeAttachment) {
  if (!selectedDetail.value) {
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除附件“${item.fileName}”？`, '删除附件', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  deletingAttachmentId.value = item.id
  try {
    selectedDetail.value = await deleteIntakeAttachment(selectedDetail.value.id, item.id)
    ElMessage.success('需求附件已删除')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '删除需求附件失败'))
    console.error(error)
  } finally {
    deletingAttachmentId.value = null
  }
}

async function previewAttachment(item: IntakeAttachment) {
  if (!item.previewable) {
    return
  }
  try {
    if (previewImageUrl.value) {
      URL.revokeObjectURL(previewImageUrl.value)
    }
    const blob = await downloadAttachment(item.id)
    previewImageUrl.value = URL.createObjectURL(blob)
    previewImageName.value = item.fileName
    previewContentType.value = item.contentType || blob.type || ''
    previewVisible.value = true
  } catch (error) {
    ElMessage.error('预览附件失败')
    console.error(error)
  }
}

function previewLocalFile(file: File) {
  if (!canPreviewFile(file)) {
    return
  }
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value)
  }
  previewImageUrl.value = URL.createObjectURL(file)
  previewImageName.value = file.name
  previewContentType.value = file.type
  previewVisible.value = true
}

function closePreview() {
  previewVisible.value = false
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value)
    previewImageUrl.value = ''
  }
  previewImageName.value = ''
  previewContentType.value = ''
}

function resolveSubmittedTime(row: IntakeSummary) {
  return formatDisplayTime(row.submittedTime || row.receivedAt)
}

function formatDisplayTime(value: string | null | undefined) {
  if (isBlankBusinessValue(value)) {
    return '-'
  }
  const parsed = parseDateTimeParts(value)
  if (!parsed) {
    return value.trim().replace('T', ' ')
  }
  const date = `${parsed.year}/${parsed.month}/${parsed.day}`
  if (!parsed.hour || !parsed.minute) {
    return date
  }
  return `${date} ${parsed.hour}:${parsed.minute}`
}

function formatDisplayDate(value: string | null | undefined) {
  if (isBlankBusinessValue(value)) {
    return '-'
  }
  const parsed = parseDateTimeParts(value)
  if (!parsed) {
    return value.trim().replace('T', ' ').slice(0, 10)
  }
  return `${parsed.year}/${parsed.month}/${parsed.day}`
}

function parseDateTimeParts(value: string | null | undefined) {
  const normalized = value?.trim().replace(/-/g, '/').replace('T', ' ')
  if (!normalized) {
    return null
  }
  const matched = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?/)
  if (!matched) {
    return null
  }
  const [, year, month, day, hour, minute] = matched
  return {
    year,
    month: month.padStart(2, '0'),
    day: day.padStart(2, '0'),
    hour: hour?.padStart(2, '0'),
    minute: minute?.padStart(2, '0'),
  }
}

function normalizePickerDateValue(value: string | null | undefined) {
  if (isBlankBusinessValue(value)) {
    return ''
  }
  const normalized = value.trim().replace(/-/g, '/').replace('T', ' ')
  const matched = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!matched) {
    return ''
  }
  const [, year, month, day] = matched
  return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
}

function normalizePickerDateTimeValue(value: string | null | undefined) {
  if (isBlankBusinessValue(value)) {
    return ''
  }
  const parsed = parseDateTimeParts(value)
  if (!parsed) {
    return ''
  }
  return `${parsed.year}-${parsed.month}-${parsed.day}T${parsed.hour || '00'}:${parsed.minute || '00'}:00`
}

function compareBusinessDate(left: string | null | undefined, right: string | null | undefined) {
  const leftDate = normalizePickerDateValue(left)
  const rightDate = normalizePickerDateValue(right)
  if (!leftDate || !rightDate) {
    return 0
  }
  return leftDate.localeCompare(rightDate)
}

function effectiveTestingDate(row: IntakeSummary) {
  return row.testingStartedDate || row.plannedTestingStartDate
}

function effectiveDevelopmentDate(row: IntakeSummary) {
  return row.developmentStartedDate || row.plannedDevelopmentStartDate
}

function effectiveReleaseDate(row: IntakeSummary) {
  return row.releasedTime || row.plannedReleaseDate
}

function isDevelopmentDateEstimated(row: IntakeSummary) {
  return !cleanBusinessValue(row.developmentStartedDate) && Boolean(cleanBusinessValue(row.plannedDevelopmentStartDate))
}

function isTestingDateEstimated(row: IntakeSummary) {
  return !cleanBusinessValue(row.testingStartedDate) && Boolean(cleanBusinessValue(row.plannedTestingStartDate))
}

function isReleaseDateEstimated(row: IntakeSummary) {
  return !cleanBusinessValue(row.releasedTime) && Boolean(cleanBusinessValue(row.plannedReleaseDate))
}

function isTestingDelayed(row: IntakeSummary | IntakeDetail['structuredData']) {
  return compareBusinessDate(row?.testingStartedDate, row?.plannedTestingStartDate) > 0
}

function isReleaseDelayed(row: IntakeSummary | IntakeDetail['structuredData']) {
  return compareBusinessDate(row?.releasedTime, row?.plannedReleaseDate) > 0
}

function resolveErrorMessage(error: unknown, fallback: string) {
  const maybeAxios = error as { response?: { data?: { message?: string } }; message?: string }
  return maybeAxios.response?.data?.message || maybeAxios.message || fallback
}

function resolveEnrichmentStatusLabel(status: string | null) {
  switch (status) {
    case 'PENDING':
      return '排队中'
    case 'RUNNING':
      return '处理中'
    case 'SUCCEEDED':
      return '已完成'
    case 'FAILED':
      return '失败'
    default:
      return '未启动'
  }
}

function resolveEnrichmentStatusType(status: string | null) {
  switch (status) {
    case 'PENDING':
      return 'info'
    case 'RUNNING':
      return 'warning'
    case 'SUCCEEDED':
      return 'success'
    case 'FAILED':
      return 'danger'
    default:
      return 'info'
  }
}

function resolveEnrichmentIndicatorClass(status: string | null) {
  switch (status) {
    case 'PENDING':
      return 'enrichment-dot--pending'
    case 'RUNNING':
      return 'enrichment-dot--running'
    case 'SUCCEEDED':
      return 'enrichment-dot--success'
    case 'FAILED':
      return 'enrichment-dot--failed'
    default:
      return 'enrichment-dot--idle'
  }
}

function resolveDevelopmentAnalysisStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'PENDING':
      return '排队中'
    case 'RUNNING':
      return '评估中'
    case 'DRAFT':
      return '待确认'
    case 'FAILED':
      return '失败'
    case 'CONFIRMED':
      return '已确认'
    default:
      return '未开始'
  }
}

function resolveDevelopmentAnalysisAlertType(status: string | null | undefined) {
  switch (status) {
    case 'FAILED':
      return 'error'
    case 'DRAFT':
    case 'CONFIRMED':
      return 'success'
    default:
      return 'info'
  }
}

function isDevelopmentAnalysisInProgress(status: string | null | undefined) {
  return status === 'PENDING' || status === 'RUNNING'
}

function resolveDemandStatusClass(status: string | null | undefined) {
  switch (status) {
    case '已收录':
      return 'demand-status-chip--recorded'
    case '待澄清':
      return 'demand-status-chip--clarifying'
    case '待处理':
      return 'demand-status-chip--pending-processing'
    case '处理中':
      return 'demand-status-chip--processing'
    case '待评估':
      return 'demand-status-chip--pending-review'
    case '待排期':
      return 'demand-status-chip--pending-scheduling'
    case '待设计':
      return 'demand-status-chip--pending-design'
    case '开发中':
      return 'demand-status-chip--developing'
    case '测试中':
      return 'demand-status-chip--testing'
    case '待上线':
      return 'demand-status-chip--pending-release'
    case '待验收':
      return 'demand-status-chip--pending-acceptance'
    case '已暂停':
      return 'demand-status-chip--paused'
    case '已完成':
      return 'demand-status-chip--completed'
    case '终止关闭':
      return 'demand-status-chip--closed'
    default:
      return 'demand-status-chip--default'
  }
}

function resolveTodoStatusType(status: string | null | undefined) {
  switch (status) {
    case '待处理':
      return 'warning'
    case '处理中':
      return 'primary'
    case '已完成':
      return 'success'
    case '已取消':
      return 'info'
    default:
      return 'info'
  }
}

function resolveIntakeRowClassName({ row }: { row: IntakeSummary }) {
  return (row.activeTodoCount || 0) > 0 ? 'intake-table-row--active-todo' : ''
}

function buildDemandStageTimeline(detail: IntakeDetail | null, analysis: DevelopmentAnalysisResponse | null) {
  const structuredData = detail?.structuredData
	  const currentStatus = detail?.demandStatus || ''
	  const operationsDemand = isOperationsDemand(structuredData?.requirementType)
	  const receivedAt = detail?.receivedAt
	  const evaluationMetrics = buildEvaluationStageMetrics(analysis)
	  const schedulingMetrics = buildSchedulingStageMetrics(structuredData)
  const developmentMetrics = buildDevelopmentStageMetrics(structuredData)
  const testingMetrics = buildTestingStageMetrics(structuredData)
  const acceptanceMetrics = buildAcceptanceStageMetrics(structuredData)
  const releaseMetrics = buildReleaseStageMetrics(structuredData)
  const stages = operationsDemand
    ? [
      { status: '已收录', title: '需求收录', time: receivedAt },
      { status: '待澄清', title: '待澄清', time: findHistoryTime(detail, ['开始澄清']) },
      { status: '待处理', title: '待处理', time: findHistoryTime(detail, ['确认收录', '澄清完成']) || receivedAt },
      { status: '处理中', title: '处理中', time: findHistoryTime(detail, ['开始处理']) },
      { status: '待验收', title: '待验收', time: structuredData?.actualCompletedTime || findHistoryTime(detail, ['提交验收']) },
      { status: '已完成', title: '已完成', time: structuredData?.acceptanceTime || findHistoryTime(detail, ['验收通过']) },
    ]
    : [
      { status: '已收录', title: '需求收录', time: receivedAt },
      { status: '待澄清', title: '需求澄清', time: findHistoryTime(detail, ['开始澄清']) },
      {
        status: '待评估',
        title: '需求评估',
        time: isDevelopmentAnalysisInProgress(analysis?.status)
          ? (analysis?.createdAt || analysis?.updatedAt || findHistoryTime(detail, ['澄清完成']) || receivedAt)
          : findHistoryTime(detail, ['澄清完成']) || receivedAt,
        metrics: evaluationMetrics,
      },
	      { status: '待排期', title: '需求排期', time: findHistoryTime(detail, ['评估完成', '确认研发评估']), metrics: schedulingMetrics },
      { status: '待设计', title: '设计', time: findHistoryTime(detail, ['排期确认']) },
      { status: '开发中', title: '研发', time: structuredData?.developmentStartedDate || findHistoryTime(detail, ['设计完成']), metrics: developmentMetrics },
      { status: '测试中', title: '测试', time: structuredData?.testingStartedDate || findHistoryTime(detail, ['提交测试']), metrics: testingMetrics },
      { status: '待验收', title: '验收', time: structuredData?.acceptanceTime || findHistoryTime(detail, ['测试通过']), metrics: acceptanceMetrics },
      { status: '待上线', currentStatuses: ['待上线', '已完成'], title: '上线', time: structuredData?.releasedTime, metrics: releaseMetrics },
    ]
  const visibleStages = currentStatus === '终止关闭'
    ? [
      ...stages,
      { status: '终止关闭', title: '终止关闭', time: structuredData?.closedTime || findHistoryTime(detail, ['关闭需求']) },
    ]
    : stages
  const currentIndex = visibleStages.findIndex((stage) => stageMatchesCurrentStatus(stage, currentStatus))
  return visibleStages.map((stage, stageIndex) => {
    const active = stageMatchesCurrentStatus(stage, currentStatus)
    const completed = currentIndex >= 0 && stageIndex >= 0 && stageIndex < currentIndex
    return {
      ...stage,
      active,
      completed,
      color: active ? '#409eff' : completed ? '#33b074' : '#c8d0dc',
      timestamp: formatStageTimestamp(stage.time),
    }
  })
}

function stageMatchesCurrentStatus(stage: { status: string; currentStatuses?: string[] }, currentStatus: string) {
  return (stage.currentStatuses || [stage.status]).includes(currentStatus)
}

function buildEvaluationStageMetrics(analysis: DevelopmentAnalysisResponse | null) {
  const draft = analysis?.draft
  if (!draft) {
    return []
  }
  return compactMetrics([
    { label: '总预估工时', value: draft.totalEstimatedEffort },
    { label: '测试预估工时', value: draft.testingEstimatedEffort },
  ])
	}

function buildSchedulingStageMetrics(structuredData: IntakeDetail['structuredData'] | null | undefined) {
  if (!structuredData) {
    return []
  }
  return compactMetrics([
    { label: '预估开发日期', value: structuredData.plannedDevelopmentStartDate, tag: '预估' },
    { label: '预估提测日期', value: structuredData.plannedTestingStartDate, tag: '预估' },
    { label: '预估上线日期', value: structuredData.plannedReleaseDate, tag: '预估' },
  ])
}

function buildDevelopmentStageMetrics(structuredData: IntakeDetail['structuredData'] | null | undefined) {
  if (!structuredData) {
    return []
  }
  return compactMetrics([
    { label: '开发日期', value: structuredData.developmentStartedDate },
    { label: '实际开发工时', value: structuredData.actualEffort },
    { label: '实际开发完成日期', value: structuredData.actualCompletedTime },
  ])
}

function buildTestingStageMetrics(structuredData: IntakeDetail['structuredData'] | null | undefined) {
  if (!structuredData) {
    return []
  }
  return compactMetrics([
    {
      label: structuredData.testingStartedDate ? '实际提测日期' : '预估提测日期',
      value: structuredData.testingStartedDate || structuredData.plannedTestingStartDate,
      tag: structuredData.testingStartedDate ? (isTestingDelayed(structuredData) ? '延期' : '') : '预估',
      type: structuredData.testingStartedDate && isTestingDelayed(structuredData) ? 'danger' : 'info',
    },
    { label: '实际测试工时', value: structuredData.actualTestingEffort },
    { label: '实际测试完成日期', value: structuredData.actualTestingCompletedDate },
  ])
}

function buildAcceptanceStageMetrics(structuredData: IntakeDetail['structuredData'] | null | undefined) {
  if (!structuredData) {
    return []
  }
  return compactMetrics([
    { label: '预约验收日期', value: structuredData.scheduledAcceptanceDate },
    { label: '实际验收日期', value: structuredData.acceptanceTime },
  ])
}

function buildReleaseStageMetrics(structuredData: IntakeDetail['structuredData'] | null | undefined) {
  if (!structuredData) {
    return []
  }
  return compactMetrics([
    {
      label: structuredData.releasedTime ? '实际上线日期' : '预估上线日期',
      value: structuredData.releasedTime || structuredData.plannedReleaseDate,
      tag: structuredData.releasedTime ? (isReleaseDelayed(structuredData) ? '延期' : '') : '预估',
      type: structuredData.releasedTime && isReleaseDelayed(structuredData) ? 'danger' : 'info',
    },
  ])
}

function compactMetrics<T extends { value: string | null | undefined }>(metrics: T[]) {
  return metrics.filter((metric) => !isBlankBusinessValue(metric.value))
}

function findHistoryTime(detail: IntakeDetail | null, actionSummaries: string[]) {
  const histories = detail?.histories || []
  const matched = histories
    .filter((history) => actionSummaries.includes(history.actionSummary))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  return matched[0]?.createdAt || null
}

function formatStageTimestamp(value: string | null | undefined) {
  const formatted = formatDisplayTime(value)
  return formatted === '-' ? '' : formatted
}

function resolveStageActionDialogTitle(action: string) {
  return resolveActionLabel(action) || '推进阶段'
}

function resolveOccurredAtLabel(action: string) {
  switch (action) {
    case 'CONFIRM_DESIGN':
      return '开发日期'
    case 'START_PROCESSING':
      return '处理开始日期'
    case 'SUBMIT_TESTING':
      return '实际提测日期'
    case 'SUBMIT_ACCEPTANCE':
      return '完成时间'
    case 'PASS_TESTING':
      return '测试通过日期'
    case 'CONFIRM_RELEASE':
      return '实际上线日期'
    case 'CLOSE_REQUIREMENT':
      return '关闭日期'
    default:
      return '操作日期'
  }
}

function requiresOccurredAt(action: string) {
  return ['CONFIRM_DESIGN', 'START_PROCESSING', 'SUBMIT_TESTING', 'CONFIRM_RELEASE'].includes(action)
}

onMounted(loadBaseData)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <h1 class="page-title">需求管理</h1>
    </div>

    <el-form inline class="filter-form" @submit.prevent="handleSearch">
      <el-form-item label="需求编号">
        <el-input
          v-model="filters.approvalCode"
          placeholder="需求编号"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="提出人">
        <el-input
          v-model="filters.proposerName"
          placeholder="提出人"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="需求名称">
        <el-input
          v-model="filters.requirementName"
          placeholder="需求名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="业务线">
        <el-select v-model="filters.businessLine" filterable clearable placeholder="业务线" style="width: 180px">
          <el-option
            v-for="item in projectGroups.filter((group) => group.enabled)"
            :key="item.id"
            :label="item.groupName"
            :value="item.businessLineCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="需求类型">
        <el-select v-model="filters.requirementType" placeholder="需求类型" clearable style="width: 160px">
          <el-option label="研发需求" value="研发需求" />
          <el-option label="数据提取/运维" value="数据提取/运维" />
        </el-select>
      </el-form-item>
      <el-form-item label="需求状态">
        <el-select v-model="filters.demandStatus" placeholder="需求状态" clearable style="width: 160px">
          <el-option label="已收录" value="已收录" />
          <el-option label="待澄清" value="待澄清" />
          <el-option label="待处理" value="待处理" />
          <el-option label="处理中" value="处理中" />
          <el-option label="待评估" value="待评估" />
          <el-option label="待排期" value="待排期" />
          <el-option label="待设计" value="待设计" />
          <el-option label="开发中" value="开发中" />
          <el-option label="测试中" value="测试中" />
          <el-option label="待验收" value="待验收" />
          <el-option label="待上线" value="待上线" />
          <el-option label="已暂停" value="已暂停" />
          <el-option label="已完成" value="已完成" />
          <el-option label="终止关闭" value="终止关闭" />
        </el-select>
      </el-form-item>
      <el-form-item label="上线日期">
        <el-date-picker
          v-model="filters.releasedDateRange"
          type="daterange"
          start-placeholder="上线开始"
          end-placeholder="上线结束"
          range-separator="至"
          value-format="YYYY/MM/DD"
          clearable
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button v-if="canCreateRecord" @click="openCreateDialog">需求录入</el-button>
      </el-form-item>
    </el-form>

    <el-table
      v-loading="loading"
      :data="intakeRecords"
      class="intake-table"
      :row-class-name="resolveIntakeRowClassName"
    >
      <el-table-column label="" width="56" align="center">
        <template #default="{ row }">
          <el-tooltip :content="`识别状态：${resolveEnrichmentStatusLabel(row.enrichmentStatus)}`" placement="top">
            <span class="enrichment-dot" :class="resolveEnrichmentIndicatorClass(row.enrichmentStatus)" />
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="需求" min-width="340">
        <template #default="{ row }">
          <el-tooltip placement="top-start" effect="light" popper-class="requirement-cell-tooltip" :show-after="200">
            <template #content>
              <div class="requirement-tooltip">
                <div class="requirement-tooltip-title">{{ row.requirementName || row.requirementDigest || '-' }}</div>
                <div class="requirement-tooltip-row"><span>审批编号</span><strong>{{ row.approvalCode || '-' }}</strong></div>
                <div class="requirement-tooltip-row"><span>提出人</span><strong>{{ row.proposerName || '-' }}</strong></div>
                <div class="requirement-tooltip-row"><span>提交时间</span><strong>{{ resolveSubmittedTime(row) }}</strong></div>
                <div class="requirement-tooltip-row"><span>业务线</span><strong>{{ row.businessLine || '-' }}</strong></div>
                <div v-if="row.activeTodoCount" class="requirement-tooltip-row"><span>未完成待办</span><strong>{{ row.activeTodoCount }}</strong></div>
              </div>
            </template>
            <div class="requirement-cell">
              <div class="requirement-cell-line">
                <span class="requirement-cell-title">{{ row.requirementName || row.requirementDigest || '-' }}</span>
                <span v-if="row.activeTodoCount" class="active-todo-badge">
                  {{ formatActiveTodoLabel(row.activeTodoCount) }}
                </span>
                <el-button
                  v-if="canCopyCollaboration"
                  class="requirement-copy-button"
                  :icon="DocumentCopy"
                  link
                  size="small"
                  title="复制协同信息"
                  @click.stop="copyDevelopmentCollaborationInfo(row)"
                />
              </div>
              <div class="requirement-cell-line requirement-cell-line--meta">
                <span class="requirement-cell-meta">审批编号：{{ row.approvalCode || '-' }}</span>
                <el-button
                  v-if="canCopyCollaboration"
                  class="requirement-copy-button"
                  :icon="DocumentCopy"
                  link
                  size="small"
                  title="复制审批编号"
                  @click.stop="copyRequirementValue('审批编号', row.approvalCode)"
                />
              </div>
            </div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="优先级" width="96" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.priority" size="small" :type="resolvePriorityTagType(row.priority)" effect="plain">
            {{ row.priority }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="proposerName" label="提出人" width="120" />
      <el-table-column label="需求状态" width="150">
        <template #default="{ row }">
          <span class="demand-status-chip" :class="resolveDemandStatusClass(row.demandStatus)">
            {{ row.demandStatus || '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="requirementType" label="需求类型" width="140" />
      <el-table-column label="总工时" width="120">
        <template #default="{ row }">
          {{ firstDisplayValue(row.totalEstimatedEffort) }}
        </template>
      </el-table-column>
      <el-table-column label="开发日期" width="140">
        <template #default="{ row }">
          <div class="date-effort-cell">
            <span>
              {{ formatDisplayDate(effectiveDevelopmentDate(row)) }}
              <el-tag v-if="isDevelopmentDateEstimated(row)" size="small" type="info" effect="plain">预估</el-tag>
            </span>
            <small>开发工时：{{ firstDisplayValue(row.developmentEstimatedEffort) }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="测试日期" width="180">
        <template #default="{ row }">
          <div class="date-effort-cell">
            <small>
              提测：{{ formatDisplayDate(buildTestingDateDisplay(row).submitted.value) }}
              <el-tag
                v-if="buildTestingDateDisplay(row).submitted.tag"
                size="small"
                :type="buildTestingDateDisplay(row).submitted.type"
                effect="plain"
              >
                {{ buildTestingDateDisplay(row).submitted.tag }}
              </el-tag>
            </small>
            <small>完成：{{ formatDisplayDate(buildTestingDateDisplay(row).completed.value) }}</small>
            <small>开发：{{ firstDisplayValue(row.actualEffort, row.developmentEstimatedEffort) }}</small>
            <small>测试：{{ firstDisplayValue(row.actualTestingEffort, row.testingEstimatedEffort) }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="验收日期" width="150">
        <template #default="{ row }">
          <div class="date-effort-cell">
            <span>
              {{ formatDisplayDate(buildAcceptanceDateDisplay(row).value) }}
              <el-tag
                v-if="buildAcceptanceDateDisplay(row).tag"
                size="small"
                :type="buildAcceptanceDateDisplay(row).type"
                effect="plain"
              >
                {{ buildAcceptanceDateDisplay(row).tag }}
              </el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="上线日期" width="150">
        <template #default="{ row }">
          <div class="date-effort-cell">
            <span>
              {{ formatDisplayDate(buildReleaseDateDisplay(row).value) }}
              <el-tag
                v-if="buildReleaseDateDisplay(row).tag"
                size="small"
                :type="buildReleaseDateDisplay(row).type"
                effect="plain"
              >
                {{ buildReleaseDateDisplay(row).tag }}
              </el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right" align="center">
        <template #default="{ row }">
          <div class="table-action-buttons">
            <el-button
              v-if="canRetryEnrichment(row)"
              link
              type="primary"
              :loading="enrichmentRetryingId === row.id"
              @click="retryEnrichmentFromRow(row)"
            >
              重新识别
            </el-button>
            <el-button v-if="canViewDetail" link type="primary" @click="openDetail(row.id)">查看详情</el-button>
            <el-button
              v-if="canOpenZentao"
              link
              type="primary"
              :disabled="!row.zentaoUrl?.trim()"
              @click="openExternalLink(row.zentaoUrl)"
            >
              打开禅道
            </el-button>
            <el-dropdown trigger="hover">
              <el-button link type="primary">操作</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-if="resolveActionForRow(row)"
                  @click="openStageActionDialog(row)"
                >
                  {{ resolveActionLabel(resolveActionForRow(row)) }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="canPauseDemand(row)"
                  @click="openPauseDemandDialog(row)"
                >
                  暂停需求
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="canResumeDemand(row)"
                  @click="resumeDemandFromRow(row)"
                >
                  恢复需求
                </el-dropdown-item>
                <el-dropdown-item
                  :disabled="!canCloseDemand(row)"
                  @click="openCloseDemandDialog(row)"
                >
                  关闭需求
                </el-dropdown-item>
                <el-dropdown-item v-if="canUpdateMetadata" @click="openPriorityDialog(row)">
                  修改优先级
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="canOpenRequirementFolder"
                  :disabled="requirementFolderOpeningId === row.id"
                  @click="openRequirementFolder(row)"
                >
                  {{ requirementFolderOpeningId === row.id ? '打开中...' : '打开需求文件夹' }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="canOpenDevelopmentPlanFolder"
                  :disabled="developmentPlanFolderOpeningId === row.id"
                  @click="openDevelopmentPlanFolder(row)"
                >
                  {{ developmentPlanFolderOpeningId === row.id ? '打开中...' : '打开开发方案文件夹' }}
                </el-dropdown-item>
                <el-dropdown-item v-if="canDeleteRecord" divided class="danger-dropdown-item" @click="handleDelete(row)">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </div>
  </div>

  <el-dialog
    v-model="createDialogVisible"
    title="需求录入"
    width="920px"
  >
    <div @paste="handlePastedScreenshots" @keydown.enter="handleCreateDialogKeydown">
      <el-form label-position="top">
      <el-form-item label="研发负责人" required>
        <el-input
          v-model="createForm.developmentOwnerUserName"
          placeholder="请输入研发负责人用户名"
        />
      </el-form-item>
      <el-form-item label="业务线" required>
        <el-select
          v-model="createForm.projectGroup"
          filterable
          style="width: 100%"
          placeholder="请选择业务线，AI 任务评估会优先使用该业务线匹配项目和 GitLab 仓库"
        >
          <el-option
            v-for="item in projectGroups"
            :key="item.id"
            :label="formatProjectGroupOption(item)"
            :value="item.businessLineCode"
          >
            <div class="project-group-option">
              <span class="project-group-option-name">{{ item.groupName }}</span>
              <span class="project-group-option-meta">{{ item.gitlabGroupName || '未配置 GitLab 组' }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="需求录入">
        <el-input
          v-model="createForm.rawContent"
          type="textarea"
          :rows="8"
          placeholder="可直接输入需求内容；也可只上传或粘贴需求截图"
        />
      </el-form-item>
      <el-alert
        title="截图和附件会先直接入库，再异步调用 Codex CLI 识别并回填结构化字段。支持点击上传、拖拽上传和直接粘贴截图。"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-row :gutter="16" class="upload-panel-row">
        <el-col :span="12">
          <el-form-item label="需求截图（可多选）" class="upload-field">
            <label class="upload-dropzone" tabindex="0" @dragover.prevent @drop.prevent="handleDroppedScreenshots" @paste="handlePastedScreenshots">
              <input class="upload-input" type="file" accept="image/*" multiple @change="handleScreenshotChange" />
              <span class="upload-dropzone-title">点击选择、直接拖入或粘贴需求截图</span>
              <span class="upload-dropzone-desc">支持多张图片；可与需求录入文本一起提交</span>
            </label>
            <ul v-if="screenshotFiles.length" class="file-list">
              <li v-for="file in screenshotFiles" :key="fileIdentity(file)" class="file-list-item">
                <span class="file-list-name">{{ file.name }}</span>
                <el-button v-if="canPreviewFile(file)" link type="primary" @click.stop.prevent="previewLocalFile(file)">预览</el-button>
              </li>
            </ul>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="需求附件（可多选）" class="upload-field">
            <label class="upload-dropzone" @dragover.prevent @drop.prevent="handleDroppedAttachments">
              <input class="upload-input" type="file" multiple @change="handleAttachmentChange" />
              <span class="upload-dropzone-title">点击选择或直接拖入需求附件</span>
              <span class="upload-dropzone-desc">Word、PDF、Excel 或其他需求材料都可以</span>
            </label>
            <ul v-if="attachmentFiles.length" class="file-list">
              <li v-for="file in attachmentFiles" :key="fileIdentity(file)" class="file-list-item">
                <span class="file-list-name">{{ file.name }}</span>
                <el-button v-if="canPreviewFile(file)" link type="primary" @click.stop.prevent="previewLocalFile(file)">预览</el-button>
              </li>
            </ul>
          </el-form-item>
        </el-col>
      </el-row>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="stageActionVisible"
    :title="resolveStageActionDialogTitle(stageActionForm.action)"
    :width="isDevelopmentTaskEvaluationDialog ? '94vw' : '520px'"
    :top="isDevelopmentTaskEvaluationDialog ? '3vh' : '15vh'"
    class="stage-action-dialog"
    :class="{ 'task-evaluation-dialog': isDevelopmentTaskEvaluationDialog }"
  >
    <el-form label-position="top">
      <template v-if="isDevelopmentTaskEvaluationDialog">
        <div class="task-evaluation-layout">
          <div class="task-evaluation-toolbar-card">
            <div class="task-evaluation-toolbar-main">
              <div class="task-evaluation-toolbar">
                <span class="task-evaluation-toolbar-label">所属业务线</span>
                <el-select
                  v-model="stageActionForm.projectGroup"
                  class="task-project-group-select"
                  filterable
                  clearable
                  placeholder="请选择业务线"
                  @change="handleTaskEvaluationProjectGroupChange"
                >
                  <el-option
                    v-for="item in projectGroups"
                    :key="item.id"
                    :label="formatProjectGroupOption(item)"
                    :value="item.businessLineCode"
                  >
                    <div class="project-group-option">
                      <span class="project-group-option-name">{{ item.groupName }}</span>
                      <span class="project-group-option-meta">{{ item.gitlabGroupName || '未配置 GitLab 组' }}</span>
                    </div>
                  </el-option>
                </el-select>
                <el-button v-if="developmentAnalysis && canSyncZentao" @click="reserveZentaoSync">同步禅道</el-button>
              </div>
            </div>
          </div>

	          <div class="task-evaluation-scroll">
	            <div class="task-evaluation-output-grid">
	              <div class="task-evaluation-info-card">
	                <div class="mini-title mini-title--actions">
	                  <span>评估输出</span>
	                  <el-link
	                    v-if="developmentAnalysis?.draft?.requirementWikiUrl"
	                    :href="developmentAnalysis.draft.requirementWikiUrl"
	                    target="_blank"
	                    type="primary"
	                    :underline="false"
	                  >
	                    需求文档
	                  </el-link>
	                </div>
	                <div class="task-metric-grid">
	                  <div class="task-metric-card">
	                    <div class="task-metric-label">总预估工时</div>
	                    <el-input
	                      v-if="developmentAnalysis?.draft"
	                      :model-value="firstDisplayValue(developmentAnalysis.draft.totalEstimatedEffort)"
	                      disabled
	                    />
	                    <div v-else class="task-metric-value">-</div>
	                  </div>
	                  <div class="task-metric-card">
	                    <div class="task-metric-label">测试工时</div>
	                    <el-input
	                      v-if="developmentAnalysis?.draft"
	                      v-model="developmentAnalysis.draft.testingEstimatedEffort"
	                      placeholder="例如 4h"
	                      clearable
	                      @input="syncDevelopmentTotalEffort"
	                    />
	                    <div v-else class="task-metric-value">-</div>
	                  </div>
		                </div>
                <div class="task-description-block">
                  <div class="task-description-title">分析摘要</div>
                  <div class="task-description-content task-description-content--detail">
                    {{ developmentAnalysis?.draft?.summary || 'AI 评估完成后会在这里展示整体改动摘要。' }}
                  </div>
                </div>
              </div>
            </div>

            <template v-if="developmentAnalysis?.draft">
              <div class="task-evaluation-section">
                <div class="section-title">需求点</div>
                <div class="task-evaluation-info-card">
                  <ol v-if="developmentAnalysis.draft.requirementChangePoints?.length" class="requirement-change-list">
                    <li v-for="point in developmentAnalysis.draft.requirementChangePoints" :key="point">{{ point }}</li>
                  </ol>
                  <span v-else class="muted-text">AI 评估完成后会先列出需求点。</span>
                </div>
              </div>

              <div class="task-evaluation-section">
                <div class="section-title section-title--actions">
                  <span>任务拆解</span>
                  <el-button size="small" type="primary" plain :disabled="!canEditDevelopmentDraft()" @click="addDevelopmentWorkItem">
                    新增任务项
                  </el-button>
                </div>
                <div class="task-workitem-table">
                  <el-table
                    v-loading="developmentDraftSaving"
                    :data="developmentAnalysis.draft.workItems"
                    border
                  >
                    <el-table-column label="任务项" min-width="420">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.title"
                          type="textarea"
                          :rows="3"
                          placeholder="请输入任务项"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="工时（h）" width="140">
                      <template #default="{ row }">
                        <el-input v-model="row.estimatedEffort" placeholder="例如 8" @input="syncDevelopmentTotalEffort" />
                      </template>
                    </el-table-column>
                    <el-table-column label="涉及系统" min-width="260">
                      <template #default="{ row }">
                        <el-select
                          v-model="row.systemTags"
                          multiple
                          filterable
                          collapse-tags
                          collapse-tags-tooltip
                          placeholder="选择涉及系统"
                          :no-data-text="stageActionForm.projectGroup ? '当前业务线暂无可选系统' : '请先选择业务线'"
                          style="width: 100%"
                        >
                          <el-option
                            v-for="system in developmentSystemSelectOptions()"
                            :key="system.id"
                            :label="system.enabled === false ? `${system.systemName}（已保存）` : system.systemScope === 'MIDDLE_PLATFORM' ? `${system.systemName}（中台）` : system.systemName"
                            :value="system.systemName"
                          />
                        </el-select>
                      </template>
                    </el-table-column>
                    <el-table-column label="负责人" width="220">
                      <template #default="{ row }">
                        <el-select
                          v-model="row.ownerUserName"
                          filterable
                          allow-create
                          default-first-option
                          clearable
                          placeholder="选择或输入负责人"
                          style="width: 100%"
                        >
                          <el-option
                            v-for="developer in developmentDeveloperSelectOptions()"
                            :key="developer.userName"
                            :label="developer.userName"
                            :value="developer.userName"
                          >
                            <div class="user-option">
                              <span class="user-option-name">{{ developer.userName }}</span>
                              <span class="user-option-meta">{{ developer.projectGroup || developer.displayName || '候选负责人' }}</span>
                            </div>
                          </el-option>
                        </el-select>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="90" fixed="right">
                      <template #default="{ $index }">
                        <el-button link type="danger" :disabled="!canEditDevelopmentDraft()" @click="deleteDevelopmentWorkItem($index)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>

              <div class="task-evaluation-result-grid task-evaluation-result-grid--single">
                <div class="task-evaluation-info-card">
                  <div class="mini-title">风险与待确认</div>
                  <ul v-if="[...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions].length" class="plain-list warning-list">
                    <li v-for="item in [...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions]" :key="item">{{ item }}</li>
                  </ul>
                  <span v-else class="muted-text">无</span>
                </div>
              </div>
              <div class="task-evaluation-save-actions">
                <el-button type="primary" :loading="developmentDraftSaving" :disabled="!canEditDevelopmentDraft()" @click="saveDevelopmentDraft">保存</el-button>
                <el-button
                  v-if="canConfirmDevelopmentDraft()"
                  type="success"
                  :loading="developmentConfirmSubmitting"
                  @click="confirmDevelopmentDraft"
                >
                  评估完成
                </el-button>
              </div>
            </template>

            <el-empty
              v-else
              description="当前还没有任务草稿。"
            />
          </div>
        </div>
      </template>
      <template v-if="stageActionForm.action === 'START_CLARIFICATION'">
        <el-form-item label="AI 辅助澄清">
          <div class="ai-clarification-option">
            <el-switch
              v-model="stageActionForm.aiClarificationEnabled"
              active-text="启用"
              inactive-text="不启用"
            />
            <span class="ai-clarification-option__hint">
              {{ stageActionForm.aiClarificationEnabled ? '开始澄清后自动生成待确认项和风险项。' : '仅进入人工澄清，不自动生成 AI 澄清项。' }}
            </span>
          </div>
        </el-form-item>
      </template>
	      <el-form-item v-if="requiresOccurredAt(stageActionForm.action)" :label="resolveOccurredAtLabel(stageActionForm.action)">
	        <el-date-picker
	          v-model="stageActionForm.occurredAt"
          type="date"
          style="width: 100%"
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
          clearable
	        />
	      </el-form-item>
	      <template v-if="stageActionForm.action === 'CONFIRM_SCHEDULING'">
	        <el-form-item label="预估开发日期">
	          <el-date-picker
	            v-model="stageActionForm.plannedDevelopmentStartDate"
	            type="date"
	            style="width: 100%"
	            format="YYYY/MM/DD"
	            value-format="YYYY/MM/DD"
	            clearable
	          />
	        </el-form-item>
	        <el-form-item label="预估提测日期">
	          <el-date-picker
	            v-model="stageActionForm.plannedTestingStartDate"
	            type="date"
	            style="width: 100%"
	            format="YYYY/MM/DD"
	            value-format="YYYY/MM/DD"
	            clearable
	          />
	        </el-form-item>
	        <el-form-item label="预估上线日期">
	          <el-date-picker
	            v-model="stageActionForm.plannedReleaseDate"
	            type="date"
	            style="width: 100%"
	            format="YYYY/MM/DD"
	            value-format="YYYY/MM/DD"
	            clearable
	          />
	        </el-form-item>
	      </template>
	      <template v-if="['SUBMIT_TESTING', 'SUBMIT_ACCEPTANCE'].includes(stageActionForm.action)">
        <el-form-item :label="stageActionForm.action === 'SUBMIT_ACCEPTANCE' ? '实际工时（可选）' : '实际开发工时'">
          <el-input v-model="stageActionForm.actualEffort" placeholder="例如 24h" />
        </el-form-item>
        <el-form-item :label="stageActionForm.action === 'SUBMIT_ACCEPTANCE' ? '完成时间' : '实际开发完成日期'">
          <el-date-picker
            v-model="stageActionForm.actualCompletedTime"
            type="date"
            style="width: 100%"
            format="YYYY/MM/DD"
            value-format="YYYY/MM/DD"
            clearable
          />
        </el-form-item>
      </template>
      <template v-if="stageActionForm.action === 'PASS_TESTING'">
        <el-form-item label="预约验收日期">
          <el-date-picker
            v-model="stageActionForm.scheduledAcceptanceDate"
            type="date"
            style="width: 100%"
            format="YYYY/MM/DD"
            value-format="YYYY/MM/DD"
            clearable
          />
        </el-form-item>
        <el-form-item label="实际测试工时">
          <el-input v-model="stageActionForm.actualTestingEffort" placeholder="例如 8h" />
        </el-form-item>
        <el-form-item label="实际测试完成日期">
          <el-date-picker
            v-model="stageActionForm.actualTestingCompletedDate"
            type="date"
            style="width: 100%"
            format="YYYY/MM/DD"
            value-format="YYYY/MM/DD"
            clearable
          />
        </el-form-item>
      </template>
      <el-form-item v-if="stageActionForm.action === 'CONFIRM_ACCEPTANCE'" label="实际验收日期">
        <el-date-picker
          v-model="stageActionForm.acceptanceTime"
          type="date"
          style="width: 100%"
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
          clearable
        />
      </el-form-item>
	      <el-alert
	        v-if="['START_CLARIFICATION', 'CONFIRM_RECORDED', 'START_PROCESSING', 'SUBMIT_ACCEPTANCE', 'CONFIRM_SCHEDULING', 'CONFIRM_DESIGN', 'PASS_TESTING', 'CONFIRM_RELEASE', 'CONFIRM_ACCEPTANCE', 'SUBMIT_TESTING'].includes(stageActionForm.action)"
        :title="`确认执行“${resolveActionLabel(stageActionForm.action)}”后，需求状态将自动推进。`"
        type="info"
        show-icon
        :closable="false"
      />
    </el-form>

    <template v-if="!isDevelopmentTaskEvaluationDialog" #footer>
      <el-button @click="stageActionVisible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="stageSubmitting"
        :disabled="stageActionForm.action === 'COMPLETE_EVALUATION' && stageActionRow?.requirementType === '研发需求' && (!developmentAnalysis?.draft || developmentAnalysis.status !== 'DRAFT')"
        @click="submitStageAction"
      >
        确认
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="detailVisible"
    title="需求详情"
    width="86vw"
    top="5vh"
    class="intake-detail-dialog"
    destroy-on-close
    @closed="resetDetailDialog"
  >
    <el-skeleton :loading="detailLoading" animated>
      <template #template>
        <el-skeleton-item variant="h3" style="width: 55%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" />
        <el-skeleton-item variant="text" />
      </template>

      <template #default>
        <template v-if="selectedDetail">
          <el-tabs v-model="detailActiveTab" class="detail-tabs">
            <el-tab-pane label="基本信息" name="basic">
              <template v-if="selectedDetail.structuredData">
                <div class="detail-basic-layout">
                  <div class="detail-basic-main">
                    <el-descriptions :column="2" border>
                      <el-descriptions-item label="需求状态">
                        <span class="demand-status-chip" :class="resolveDemandStatusClass(selectedDetail.demandStatus)">
                          {{ selectedDetail.demandStatus || '-' }}
                        </span>
                      </el-descriptions-item>
                      <template v-if="selectedDetail.demandStatus === '已暂停'">
                        <el-descriptions-item label="暂停前状态">
                          {{ selectedDetail.pausePreviousDemandStatus || '-' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="暂停日期">
                          {{ formatDisplayDate(selectedDetail.pauseDate) }}
                        </el-descriptions-item>
                        <el-descriptions-item label="暂停原因" :span="2">
                          {{ selectedDetail.pauseReason || '-' }}
                        </el-descriptions-item>
                      </template>
                      <el-descriptions-item label="审批编号">
                        <span class="copyable-detail-value">
                          <span>{{ selectedDetail.structuredData.approvalCode || '-' }}</span>
                          <el-button
                            class="requirement-copy-button"
                            :icon="DocumentCopy"
                            link
                            size="small"
                            title="复制审批编号"
                            @click.stop="copyRequirementValue('审批编号', selectedDetail.structuredData.approvalCode)"
                          />
                        </span>
                      </el-descriptions-item>
                      <el-descriptions-item label="提出人">
                        {{ selectedDetail.structuredData.proposerName || selectedDetail.senderName || '-' }}
                      </el-descriptions-item>
                      <el-descriptions-item label="提交时间">{{ formatDisplayTime(selectedDetail.structuredData.submittedTime) }}</el-descriptions-item>
                      <el-descriptions-item label="需求类型">{{ selectedDetail.structuredData.requirementType || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="需求名称" :span="2">
                        <span class="copyable-detail-value">
                          <span>{{ selectedDetail.structuredData.requirementName || selectedDetail.structuredData.requirementDigest || '-' }}</span>
                          <el-button
                            class="requirement-copy-button"
                            :icon="DocumentCopy"
                            link
                            size="small"
                            title="复制需求名称"
                            @click.stop="copyRequirementValue('需求名称', selectedDetail.structuredData.requirementName || selectedDetail.structuredData.requirementDigest)"
                          />
                        </span>
                      </el-descriptions-item>
                      <el-descriptions-item label="需求摘要" :span="2">{{ selectedDetail.structuredData.requirementDigest || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="审批标题" :span="2">{{ selectedDetail.structuredData.approvalTitle || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="所在部门">{{ selectedDetail.structuredData.department || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="业务线">
                        <span class="copyable-detail-value">
                          <span>{{ selectedDetail.structuredData.businessLine || '-' }}</span>
                          <el-button v-if="canUpdateMetadata" link size="small" @click.stop="openBusinessLineDialog">编辑</el-button>
                        </span>
                      </el-descriptions-item>
                      <el-descriptions-item v-if="isDevelopmentRequirement(selectedDetail)" label="涉及系统" :span="2">
                        {{ selectedDetail.involvedSystems?.length ? selectedDetail.involvedSystems.join('、') : '-' }}
                      </el-descriptions-item>
                      <el-descriptions-item label="备注" :span="2">{{ selectedDetail.structuredData.remark || '-' }}</el-descriptions-item>
                    </el-descriptions>

                    <template v-if="isDevelopmentRequirement(selectedDetail)">
                      <div class="section-title">关联研发任务</div>
                      <el-table
                        v-if="selectedDetail.relatedWorkItems?.length"
                        :data="selectedDetail.relatedWorkItems"
                        size="small"
                        border
                      >
                        <el-table-column prop="no" label="编号" width="150" />
                        <el-table-column prop="title" label="任务" min-width="260" show-overflow-tooltip />
                        <el-table-column prop="projectName" label="项目" width="160" show-overflow-tooltip />
                        <el-table-column prop="ownerUserName" label="负责人" width="120" />
                        <el-table-column prop="status" label="状态" width="100" />
                      </el-table>
                      <el-empty v-else description="尚未创建正式研发任务" :image-size="72" />
                    </template>

	                    <div class="section-title">需求描述</div>
	                    <div class="detail-block">{{ selectedDetail.structuredData.requirementSummary || '-' }}</div>

	                    <template v-if="canGenerateSqlDraft(selectedDetail)">
                      <div class="section-title">交付数据文件</div>
                      <el-table
                        v-if="deliveryDataAttachments(selectedDetail).length"
                        :data="deliveryDataAttachments(selectedDetail)"
                        size="small"
                        border
                      >
                        <el-table-column prop="fileName" label="文件名" min-width="280" />
                        <el-table-column prop="contentType" label="内容类型" min-width="180" />
                        <el-table-column label="上传时间" width="180">
                          <template #default="{ row }">
                            {{ formatDisplayTime(row.createdAt) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="操作" width="96">
                          <template #default="{ row }">
                            <el-button link type="primary" @click="handleDownload(row)">下载</el-button>
                          </template>
                        </el-table-column>
                      </el-table>
                      <el-empty v-else description="暂无交付数据文件" />
                    </template>

                    <template v-if="isDevelopmentRequirement(selectedDetail)">
                      <div class="section-title section-title--actions">
                        <span>研发协同</span>
                        <el-button v-if="canCopyCollaboration" type="primary" plain size="small" @click="copyDevelopmentCollaborationInfo()">
                          复制协同信息
                        </el-button>
                      </div>
                      <el-descriptions :column="2" border>
                        <el-descriptions-item label="研发分支" :span="2">
                          <div class="collaboration-field">
                            <el-input v-model="developmentBranchForm.name" placeholder="feature/..." />
                            <el-button
                              type="primary"
                              link
                              :disabled="!developmentBranchForm.name.trim()"
                              @click="copyDevelopmentBranch(developmentBranchForm.name)"
                            >
                              复制
                            </el-button>
                            <el-button v-if="canUpdateMetadata" type="primary" :loading="developmentBranchSubmitting" @click="submitDevelopmentBranch">
                              保存
                            </el-button>
                          </div>
                        </el-descriptions-item>
                        <el-descriptions-item label="禅道地址" :span="2">
                          <div class="collaboration-field">
                            <el-input v-model="zentaoForm.url" placeholder="https://zentao.example.com/..." />
                            <el-button
                              type="primary"
                              link
                              :disabled="!zentaoForm.url.trim()"
                              @click="openExternalLink(zentaoForm.url)"
                            >
                              打开
                            </el-button>
                            <el-button v-if="canUpdateMetadata" type="primary" :loading="zentaoSubmitting" @click="submitZentaoLink">
                              保存
                            </el-button>
                          </div>
                        </el-descriptions-item>
                      </el-descriptions>
                    </template>

                    <template v-if="canGenerateSqlDraft(selectedDetail)">
                      <div class="section-title">SQL 草稿</div>
                      <div class="sql-draft-panel">
                        <div class="sql-draft-header">
                          <div>
                            <div class="sql-draft-title">AI 仅生成草稿，不连接数据库、不执行 SQL</div>
                            <div class="sql-draft-subtitle">如果表名、字段或口径不明确，AI 会在待确认问题中列出。</div>
                          </div>
                          <el-button type="primary" :loading="sqlDraftSubmitting" @click="generateSqlDraft">
                            {{ selectedDetail.structuredData.sqlDraft ? '重新生成 SQL 草稿' : '生成 SQL 草稿' }}
                          </el-button>
                        </div>
                        <template v-if="selectedDetail.structuredData.sqlDraft">
                          <el-descriptions :column="2" border class="sql-draft-meta">
                            <el-descriptions-item label="方言">{{ selectedDetail.structuredData.sqlDraft.dialect || 'MySQL' }}</el-descriptions-item>
                            <el-descriptions-item label="生成时间">{{ formatDisplayTime(selectedDetail.structuredData.sqlDraft.generatedAt) }}</el-descriptions-item>
                            <el-descriptions-item label="生成来源">{{ selectedDetail.structuredData.sqlDraft.generator || '-' }}</el-descriptions-item>
                            <el-descriptions-item label="用途说明">{{ selectedDetail.structuredData.sqlDraft.explanation || '-' }}</el-descriptions-item>
                          </el-descriptions>
                          <pre class="sql-block">{{ selectedDetail.structuredData.sqlDraft.sql || '-- 无可用 SQL 草稿，请先确认问题后重新生成' }}</pre>
                          <div class="sql-draft-grid">
                            <div>
                              <div class="mini-title">参数说明</div>
                              <ul v-if="selectedDetail.structuredData.sqlDraft.parameters.length" class="plain-list">
                                <li v-for="item in selectedDetail.structuredData.sqlDraft.parameters" :key="item">{{ item }}</li>
                              </ul>
                              <span v-else class="muted-text">无</span>
                            </div>
                            <div>
                              <div class="mini-title">AI 推断</div>
                              <ul v-if="selectedDetail.structuredData.sqlDraft.assumptions.length" class="plain-list">
                                <li v-for="item in selectedDetail.structuredData.sqlDraft.assumptions" :key="item">{{ item }}</li>
                              </ul>
                              <span v-else class="muted-text">无</span>
                            </div>
                            <div>
                              <div class="mini-title">待确认问题</div>
                              <ul v-if="selectedDetail.structuredData.sqlDraft.questions.length" class="plain-list warning-list">
                                <li v-for="item in selectedDetail.structuredData.sqlDraft.questions" :key="item">{{ item }}</li>
                              </ul>
                              <span v-else class="muted-text">无</span>
                            </div>
                            <div>
                              <div class="mini-title">执行风险提示</div>
                              <ul v-if="selectedDetail.structuredData.sqlDraft.riskWarnings.length" class="plain-list warning-list">
                                <li v-for="item in selectedDetail.structuredData.sqlDraft.riskWarnings" :key="item">{{ item }}</li>
                              </ul>
                              <span v-else class="muted-text">无</span>
                            </div>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>

                  <aside class="detail-lifecycle-panel">
                    <el-timeline class="stage-timeline">
                      <el-timeline-item
                        v-for="item in detailStageTimeline"
                        :key="item.status"
                        :timestamp="item.timestamp"
                        placement="top"
                        :color="item.color"
                      >
                        <div class="stage-timeline-item" :class="{ 'stage-timeline-item--active': item.active }">
                          <div class="stage-timeline-title">
                            <span>{{ item.title }}</span>
                            <el-tag v-if="item.completed" size="small" type="success" effect="plain">已完成</el-tag>
                          </div>
                          <div v-if="item.metrics?.length" class="stage-timeline-metrics">
                            <span v-for="metric in item.metrics" :key="metric.label" class="stage-timeline-metric">
                              {{ metric.label }}：{{ metric.value }}
                              <el-tag v-if="metric.tag" size="small" :type="metric.type || 'info'" effect="plain">
                                {{ metric.tag }}
                              </el-tag>
                            </span>
                          </div>
                        </div>
                      </el-timeline-item>
                    </el-timeline>
                  </aside>
                </div>
              </template>
              <el-empty v-else description="尚未抽取出结构化字段" />
            </el-tab-pane>

            <el-tab-pane :label="formatTodoTabLabel(activeDetailTodoCount)" name="todos">
              <div class="todo-tab">
                <div class="section-title section-title--actions">
                  <span>需求待办</span>
                  <el-button v-if="canManageTodo" type="primary" plain size="small" @click="openCreateTodoDialog">
                    新增待办
                  </el-button>
                </div>
                <el-table
                  v-if="detailTodos.length"
                  :data="detailTodos"
                  size="small"
                  border
                  class="todo-table"
                >
                  <el-table-column prop="title" label="待办标题" min-width="180" show-overflow-tooltip />
                  <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip>
                    <template #default="{ row }">
                      {{ row.content || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="96">
                    <template #default="{ row }">
                      <el-tag
                        size="small"
                        :type="resolveTodoStatusType(row.status)"
                        :effect="isActiveIntakeTodoStatus(row.status) ? 'dark' : 'plain'"
                        :class="{ 'todo-status-tag--active': isActiveIntakeTodoStatus(row.status) }"
                      >
                        {{ row.status || '-' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="处理人" width="120">
                    <template #default="{ row }">
                      {{ row.assigneeUserName || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="计划处理" width="150">
                    <template #default="{ row }">
                      {{ formatDisplayTime(row.plannedAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="完成时间" width="150">
                    <template #default="{ row }">
                      {{ formatDisplayTime(row.completedAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="processResult" label="处理结果" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                      {{ row.processResult || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="192" fixed="right">
                    <template #default="{ row }">
                      <el-button v-if="canManageTodo" link type="primary" @click="openEditTodoDialog(row)">编辑</el-button>
                      <el-button v-if="canManageTodo" link type="primary" @click="openTodoStatusDialog(row)">状态</el-button>
                      <el-button
                        v-if="canManageTodo"
                        link
                        type="danger"
                        :loading="deletingTodoId === row.id"
                        @click="deleteTodoFromDetail(row)"
                      >
                        删除
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else description="暂无需求待办" :image-size="96" />
              </div>
            </el-tab-pane>

            <el-tab-pane v-if="isDevelopmentRequirement(selectedDetail)" label="需求澄清" name="clarification">
              <div class="task-evaluation-layout task-evaluation-layout--detail">
                <div class="task-evaluation-toolbar-card">
                  <div class="task-evaluation-toolbar-main">
                    <div class="task-evaluation-toolbar">
                      <span class="task-evaluation-toolbar-label">
                        澄清状态：{{ resolveClarificationStatusLabel(clarificationAnalysis?.status) }}
                      </span>
                      <el-button
                        type="primary"
                        plain
                        :loading="clarificationAnalysisSubmitting"
                        :disabled="isClarificationInProgress(clarificationAnalysis?.status)"
                        @click="runClarificationAnalysis"
                      >
                        {{ clarificationAnalysis ? '重新分析澄清项' : '分析澄清项' }}
                      </el-button>
                    </div>
                    <div v-if="clarificationAnalysis?.message" class="muted-text">{{ clarificationAnalysis.message }}</div>
                  </div>
                </div>

                <template v-if="clarificationAnalysis">
                  <div class="task-evaluation-section">
                    <div class="section-title">待确认项</div>
                    <div v-if="clarificationItems('QUESTION').length" class="clarification-item-list">
                      <div v-for="item in clarificationItems('QUESTION')" :key="clarificationReplyKey(item)" class="task-evaluation-info-card clarification-item-card">
                        <div class="mini-title mini-title--actions">
                          <span>{{ item.index + 1 }}. {{ item.title }}</span>
                          <el-tag size="small" :type="resolveClarificationItemStatusType(item)" effect="plain">
                            {{ resolveClarificationItemStatusLabel(item) }}
                          </el-tag>
                        </div>
                        <div v-if="item.description" class="task-description-content">{{ item.description }}</div>
                        <div v-if="item.evidence" class="muted-text">依据：{{ item.evidence }}</div>
                        <el-input
                          v-model="item.responseText"
                          type="textarea"
                          :rows="3"
                          placeholder="填写人工回复或确认口径"
                        />
                        <div class="task-evaluation-save-actions task-evaluation-save-actions--inline">
                          <el-button
                            type="primary"
                            size="small"
                            :loading="clarificationReplySubmittingKey === clarificationReplyKey(item)"
                            @click="saveClarificationReply(item)"
                          >
                            保存回复
                          </el-button>
                        </div>
                      </div>
                    </div>
                    <el-empty v-else description="当前没有待确认项" />
                  </div>

                  <div class="task-evaluation-section">
                    <div class="section-title">风险项</div>
                    <div v-if="clarificationItems('RISK').length" class="clarification-item-list">
                      <div v-for="item in clarificationItems('RISK')" :key="clarificationReplyKey(item)" class="task-evaluation-info-card clarification-item-card">
                        <div class="mini-title mini-title--actions">
                          <span>{{ item.index + 1 }}. {{ item.title }}</span>
                          <el-tag size="small" :type="resolveClarificationItemStatusType(item)" effect="plain">
                            {{ resolveClarificationItemStatusLabel(item) }}
                          </el-tag>
                        </div>
                        <div v-if="item.description" class="task-description-content">{{ item.description }}</div>
                        <div v-if="item.evidence" class="muted-text">依据：{{ item.evidence }}</div>
                        <el-input
                          v-model="item.responseText"
                          type="textarea"
                          :rows="2"
                          placeholder="可补充风险处理说明"
                        />
                        <div class="task-evaluation-save-actions task-evaluation-save-actions--inline">
                          <el-button
                            type="primary"
                            size="small"
                            :loading="clarificationReplySubmittingKey === clarificationReplyKey(item)"
                            @click="saveClarificationReply(item)"
                          >
                            确认风险
                          </el-button>
                        </div>
                      </div>
                    </div>
                    <el-empty v-else description="当前没有风险项" />
                  </div>
                </template>
                <el-empty v-else description="开始澄清后会自动生成澄清项，也可以手动触发分析。" />
              </div>
            </el-tab-pane>

            <el-tab-pane v-if="isDevelopmentRequirement(selectedDetail)" label="AI任务评估" name="aiEvaluation">
              <div class="task-evaluation-layout task-evaluation-layout--detail">
                <el-alert
                  :title="`AI任务评估状态：${resolveDevelopmentAnalysisStatusLabel(developmentAnalysis?.status)}`"
                  :description="developmentAnalysis?.message || '这里只展示 AI 辅助参考，正式任务以“任务评估”页签中人工保存和确认的内容为准。'"
                  :type="resolveDevelopmentAnalysisAlertType(developmentAnalysis?.status)"
                  show-icon
                  :closable="false"
                />

                <template v-if="developmentAnalysis?.draft">
                  <div class="task-evaluation-section">
                    <div class="task-evaluation-info-card">
                      <div class="mini-title mini-title--actions">
                        <span>AI评估摘要</span>
                        <el-link
                          v-if="developmentAnalysis.draft.requirementWikiUrl"
                          :href="developmentAnalysis.draft.requirementWikiUrl"
                          target="_blank"
                          type="primary"
                          :underline="false"
                        >
                          需求文档
                        </el-link>
                      </div>
                      <div class="task-description-content task-description-content--detail">
                        {{ developmentAnalysis.draft.summary || '-' }}
                      </div>
                    </div>
                  </div>

                  <div class="task-evaluation-section">
                    <div class="section-title">AI识别需求点</div>
                    <div class="task-evaluation-info-card">
                      <ol v-if="developmentAnalysis.draft.requirementChangePoints?.length" class="requirement-change-list">
                        <li v-for="point in developmentAnalysis.draft.requirementChangePoints" :key="point">{{ point }}</li>
                      </ol>
                      <span v-else class="muted-text">无</span>
                    </div>
                  </div>

                  <div class="task-evaluation-section">
                    <div class="section-title">AI任务拆解参考</div>
                    <el-table :data="developmentAnalysis.draft.workItems" border>
                      <el-table-column prop="title" label="研发任务" min-width="220" />
                      <el-table-column label="改地点" min-width="280">
                        <template #default="{ row }">
                          <ol v-if="displayChangePoints(row).length" class="task-change-points">
                            <li v-for="point in displayChangePoints(row)" :key="point">{{ point }}</li>
                          </ol>
                          <span v-else class="muted-text">-</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="改造系统" min-width="200">
                        <template #default="{ row }">
                          <el-tag
                            v-for="system in row.systemTags || []"
                            :key="system"
                            size="small"
                            effect="plain"
                            class="system-tag"
                          >
                            {{ system }}
                          </el-tag>
                          <span v-if="!row.systemTags?.length" class="muted-text">-</span>
                        </template>
                      </el-table-column>
                      <el-table-column prop="estimatedEffort" label="工时" width="120" />
                    </el-table>
                  </div>

                  <div class="task-evaluation-result-grid task-evaluation-result-grid--single">
                    <div class="task-evaluation-info-card">
                      <div class="mini-title">风险与待确认</div>
                      <ul v-if="[...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions].length" class="plain-list warning-list">
                        <li v-for="item in [...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions]" :key="item">{{ item }}</li>
                      </ul>
                      <span v-else class="muted-text">无</span>
                    </div>
                  </div>
                </template>
                <el-empty v-else description="澄清完成后会自动触发 AI 任务评估，结果会显示在这里。" />
              </div>
            </el-tab-pane>

            <el-tab-pane v-if="isDevelopmentRequirement(selectedDetail)" label="任务评估" name="evaluation">
              <div class="task-evaluation-layout task-evaluation-layout--detail">
                <div class="task-evaluation-toolbar-card">
                  <div class="task-evaluation-toolbar-main">
                    <div class="task-evaluation-toolbar">
                      <span class="task-evaluation-toolbar-label">所属业务线</span>
                      <el-select
                        v-model="stageActionForm.projectGroup"
                        class="task-project-group-select"
                        filterable
                        clearable
                        placeholder="请选择业务线"
                        @change="handleTaskEvaluationProjectGroupChange"
                      >
                        <el-option
                          v-for="item in projectGroups"
                          :key="item.id"
                          :label="formatProjectGroupOption(item)"
                          :value="item.businessLineCode"
                        >
                          <div class="project-group-option">
                            <span class="project-group-option-name">{{ item.groupName }}</span>
                            <span class="project-group-option-meta">{{ item.gitlabGroupName || '未配置 GitLab 组' }}</span>
                          </div>
                        </el-option>
                      </el-select>
                      <el-button v-if="developmentAnalysis && canSyncZentao" @click="reserveZentaoSync">同步禅道</el-button>
                    </div>
                  </div>
                </div>

	                <div class="task-evaluation-scroll task-evaluation-scroll--detail">
	                  <div class="task-evaluation-output-grid">
	                    <div class="task-evaluation-info-card">
	                      <div class="mini-title mini-title--actions">
	                        <span>评估输出</span>
	                        <el-link
	                          v-if="developmentAnalysis?.draft?.requirementWikiUrl"
	                          :href="developmentAnalysis.draft.requirementWikiUrl"
	                          target="_blank"
	                          type="primary"
	                          :underline="false"
	                        >
	                          需求文档
	                        </el-link>
	                      </div>
	                      <div class="task-metric-grid">
	                        <div class="task-metric-card">
	                          <div class="task-metric-label">总预估工时</div>
	                          <el-input
	                            v-if="developmentAnalysis?.draft"
	                            :model-value="firstDisplayValue(developmentAnalysis.draft.totalEstimatedEffort)"
                            disabled
                          />
	                          <div v-else class="task-metric-value">-</div>
	                        </div>
	                        <div class="task-metric-card">
	                          <div class="task-metric-label">测试工时</div>
	                          <el-input
	                            v-if="developmentAnalysis?.draft"
	                            v-model="developmentAnalysis.draft.testingEstimatedEffort"
	                            placeholder="例如 4h"
	                            clearable
	                            @input="syncDevelopmentTotalEffort"
	                          />
	                          <div v-else class="task-metric-value">-</div>
	                        </div>
		                      </div>
                      <div class="task-description-block">
                        <div class="task-description-title">分析摘要</div>
                        <div class="task-description-content task-description-content--detail">
                          {{ developmentAnalysis?.draft?.summary || 'AI 评估完成后会在这里展示整体改动摘要。' }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <template v-if="developmentAnalysis?.draft">
                    <div class="task-evaluation-section">
                      <div class="section-title">需求点</div>
                      <div class="task-evaluation-info-card">
                        <ol v-if="developmentAnalysis.draft.requirementChangePoints?.length" class="requirement-change-list">
                          <li v-for="point in developmentAnalysis.draft.requirementChangePoints" :key="point">{{ point }}</li>
                        </ol>
                        <span v-else class="muted-text">AI 评估完成后会先列出需求点。</span>
                      </div>
                    </div>

                    <div class="task-evaluation-section">
                      <div class="section-title section-title--actions">
                        <span>任务拆解</span>
                        <el-button size="small" type="primary" plain :disabled="!canEditDevelopmentDraft()" @click="addDevelopmentWorkItem">
                          新增任务项
                        </el-button>
                      </div>
                      <div class="task-workitem-table">
                        <el-table
                          v-loading="developmentDraftSaving"
                          :data="developmentAnalysis.draft.workItems"
                          border
                        >
                          <el-table-column label="任务项" min-width="420">
                            <template #default="{ row }">
                              <el-input
                                v-model="row.title"
                                type="textarea"
                                :rows="3"
                                placeholder="请输入任务项"
                              />
                            </template>
                          </el-table-column>
                          <el-table-column label="改地点" min-width="320">
                            <template #default="{ row }">
                              <el-input
                                v-model="row.description"
                                type="textarea"
                                :rows="3"
                                placeholder="简述改地点"
                              />
                            </template>
                          </el-table-column>
                          <el-table-column label="工时（h）" width="140">
                            <template #default="{ row }">
                              <el-input v-model="row.estimatedEffort" placeholder="例如 8" @input="syncDevelopmentTotalEffort" />
                            </template>
                          </el-table-column>
                          <el-table-column label="涉及系统" min-width="260">
                            <template #default="{ row }">
                              <el-select
                                v-model="row.systemTags"
                                multiple
                                filterable
                                collapse-tags
                                collapse-tags-tooltip
                                placeholder="选择涉及系统"
                                :no-data-text="stageActionForm.projectGroup ? '当前业务线暂无可选系统' : '请先选择业务线'"
                                style="width: 100%"
                              >
                                  <el-option
                                  v-for="system in developmentSystemSelectOptions()"
                                  :key="system.id"
                                  :label="system.enabled === false ? `${system.systemName}（已保存）` : system.systemScope === 'MIDDLE_PLATFORM' ? `${system.systemName}（中台）` : system.systemName"
                                  :value="system.systemName"
                                />
                              </el-select>
                            </template>
                          </el-table-column>
                          <el-table-column label="负责人" width="220">
                            <template #default="{ row }">
                              <el-select
                                v-model="row.ownerUserName"
                                filterable
                                allow-create
                                default-first-option
                                clearable
                                placeholder="选择或输入负责人"
                                style="width: 100%"
                              >
                                <el-option
                                  v-for="developer in developmentDeveloperSelectOptions()"
                                  :key="developer.userName"
                                  :label="developer.userName"
                                  :value="developer.userName"
                                >
                                  <div class="user-option">
                                    <span class="user-option-name">{{ developer.userName }}</span>
                                    <span class="user-option-meta">{{ developer.projectGroup || developer.displayName || '候选负责人' }}</span>
                                  </div>
                                </el-option>
                              </el-select>
                            </template>
                          </el-table-column>
                          <el-table-column label="操作" width="90" fixed="right">
                            <template #default="{ $index }">
                              <el-button link type="danger" :disabled="!canEditDevelopmentDraft()" @click="deleteDevelopmentWorkItem($index)">删除</el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>
                    </div>

                    <div class="task-evaluation-result-grid task-evaluation-result-grid--single">
                      <div class="task-evaluation-info-card">
                        <div class="mini-title">风险与待确认</div>
                        <ul v-if="[...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions].length" class="plain-list warning-list">
                          <li v-for="item in [...developmentAnalysis.draft.risks, ...developmentAnalysis.draft.questions]" :key="item">{{ item }}</li>
                        </ul>
                        <span v-else class="muted-text">无</span>
                      </div>
                    </div>
                    <div class="task-evaluation-save-actions">
                      <el-button type="primary" :loading="developmentDraftSaving" :disabled="!canEditDevelopmentDraft()" @click="saveDevelopmentDraft">保存</el-button>
                      <el-button
                        v-if="canConfirmDevelopmentDraft()"
                        type="success"
                        :loading="developmentConfirmSubmitting"
                        @click="confirmDevelopmentDraft"
                      >
                        评估完成
                      </el-button>
                    </div>
                  </template>

                  <el-empty
                    v-else
                    description="当前还没有任务草稿。"
                  />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="识别与附件" name="materials">
              <div class="section-title section-title--actions">
                <span>识别状态</span>
                <el-button
                  v-if="canRetryEnrichment(selectedDetail)"
                  type="primary"
                  plain
                  size="small"
                  :loading="enrichmentRetryingId === selectedDetail.id"
                  @click="retryEnrichmentFromDetail"
                >
                  重试识别
                </el-button>
              </div>
              <el-alert
                :title="`当前状态：${resolveEnrichmentStatusLabel(selectedDetail.enrichmentStatus)}`"
                :description="selectedDetail.enrichmentErrorSummary || undefined"
                :type="selectedDetail.enrichmentStatus === 'FAILED' ? 'error' : selectedDetail.enrichmentStatus === 'RUNNING' ? 'warning' : selectedDetail.enrichmentStatus === 'SUCCEEDED' ? 'success' : 'info'"
                show-icon
                :closable="false"
              />

              <div class="section-title">原始材料</div>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="来源">{{ selectedDetail.sourceType }}</el-descriptions-item>
                <el-descriptions-item label="渠道">{{ selectedDetail.sourceChannel }}</el-descriptions-item>
                <el-descriptions-item label="发送人">{{ selectedDetail.senderName }}</el-descriptions-item>
                <el-descriptions-item label="外部消息 ID">{{ selectedDetail.externalMessageId || '-' }}</el-descriptions-item>
                <el-descriptions-item label="原始内容">
                  <pre class="raw-block">{{ selectedDetail.rawContent }}</pre>
                </el-descriptions-item>
              </el-descriptions>

              <template v-if="selectedDetail.structuredData">
                <div class="section-title">识别字段</div>
                <div class="field-table-wrap">
                  <el-table :data="selectedDetail.structuredData.fields" size="small" border>
                    <el-table-column prop="label" label="字段" width="160" />
                    <el-table-column prop="value" label="值" min-width="360" />
                  </el-table>
                </div>
              </template>

              <div class="section-title section-title--actions">
                <span>截图与附件</span>
                <el-button v-if="canManageAttachment" type="primary" plain size="small" :loading="attachmentUpdating" @click="openAppendAttachmentPicker">
                  新增附件
                </el-button>
              </div>
              <template v-if="selectedDetail.attachments.length">
                <el-table :data="selectedDetail.attachments" size="small" border>
                  <el-table-column prop="category" label="类型" width="100" />
                  <el-table-column prop="fileName" label="文件名" min-width="280" />
                  <el-table-column prop="contentType" label="内容类型" min-width="160" />
                  <el-table-column label="操作" width="210">
                    <template #default="{ row }">
                      <el-button v-if="row.previewable" link type="primary" @click="previewAttachment(row)">预览</el-button>
                      <el-button link type="primary" @click="handleDownload(row)">下载</el-button>
                      <el-button
                        v-if="canManageAttachment && row.category !== '数据文件'"
                        link
                        type="primary"
                        :loading="replacingAttachmentId === row.id"
                        @click="openReplaceAttachmentPicker(row)"
                      >
                        替换
                      </el-button>
                      <el-button
                        v-if="canManageAttachment && row.category !== '数据文件'"
                        link
                        type="danger"
                        :loading="deletingAttachmentId === row.id"
                        @click="deleteAttachmentFromDetail(row)"
                      >
                        删除
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
              <el-empty v-else description="没有附件" />
            </el-tab-pane>

            <el-tab-pane label="修改历史" name="history">
              <template v-if="updateHistories.length">
                <el-table :data="updateHistories" size="small" border>
                  <el-table-column label="时间" width="180">
                    <template #default="{ row }">
                      {{ formatDisplayTime(row.createdAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="actionSummary" label="动作" width="160" />
                  <el-table-column prop="operatorUserName" label="操作人" width="140" />
                  <el-table-column label="详情" min-width="300">
                    <template #default="{ row }">
                      <div class="history-detail">{{ row.detailText || '-' }}</div>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
              <el-empty v-else description="暂无历史记录" />
            </el-tab-pane>
          </el-tabs>
        </template>
      </template>
    </el-skeleton>
  </el-dialog>

  <el-dialog v-model="previewVisible" :title="previewImageName || '附件预览'" width="960px" @closed="closePreview">
    <img v-if="previewKind === 'image'" :src="previewImageUrl" class="preview-image" alt="附件预览" />
    <iframe v-else-if="previewKind === 'pdf'" :src="previewImageUrl" class="preview-frame" title="附件预览" />
    <el-empty v-else description="当前文件暂不支持预览" />
  </el-dialog>

  <el-dialog v-model="businessLineDialogVisible" title="修改业务线" width="520px" @closed="resetBusinessLineDialog">
    <el-form label-position="top">
      <el-form-item label="业务线" required>
        <el-select v-model="businessLineForm.businessLine" filterable placeholder="请选择业务线" style="width: 100%">
          <el-option
            v-for="item in projectGroups.filter((group) => group.enabled)"
            :key="item.id"
            :label="formatProjectGroupOption(item)"
            :value="item.businessLineCode"
          />
        </el-select>
      </el-form-item>
      <el-alert title="只修改该需求归属业务线，不会自动重跑 AI 评估或迁移已生成的需求文档。" type="info" show-icon :closable="false" />
    </el-form>

    <template #footer>
      <el-button @click="businessLineDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="businessLineSubmitting" @click="submitBusinessLine">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="priorityDialogVisible" title="修改优先级" width="420px" @closed="resetPriorityDialog">
    <el-form label-position="top">
      <el-form-item label="优先级" required>
        <el-radio-group v-model="priorityForm.priority">
          <el-radio-button v-for="item in priorityOptions" :key="item" :label="item" :value="item" />
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="priorityDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="prioritySubmitting" @click="submitPriority">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="todoFormVisible" :title="todoFormTitle" width="560px" @closed="resetTodoFormDialog">
    <el-form label-position="top">
      <el-form-item label="待办标题" required>
        <el-input v-model="todoForm.title" maxlength="120" show-word-limit placeholder="请输入待办标题" />
      </el-form-item>
      <el-form-item label="待办内容">
        <el-input
          v-model="todoForm.content"
          type="textarea"
          :rows="4"
          maxlength="1000"
          show-word-limit
          placeholder="补充处理背景、口径或交付要求"
        />
      </el-form-item>
      <el-form-item label="处理人">
        <el-input v-model="todoForm.assigneeUserName" maxlength="64" placeholder="请输入处理人用户名" />
      </el-form-item>
      <el-form-item label="计划处理时间">
        <el-date-picker
          v-model="todoForm.plannedAt"
          type="datetime"
          style="width: 100%"
          format="YYYY/MM/DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="todoFormVisible = false">取消</el-button>
      <el-button type="primary" :loading="todoFormSubmitting" @click="submitTodoForm">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="todoStatusVisible" title="更新待办状态" width="520px" @closed="resetTodoStatusDialog">
    <el-form label-position="top">
      <el-form-item label="处理状态" required>
        <el-select v-model="todoStatusForm.status" style="width: 100%" placeholder="请选择处理状态">
          <el-option v-for="status in todoStatusOptions" :key="status" :label="status" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="处理结果" :required="todoStatusForm.status === '已完成'">
        <el-input
          v-model="todoStatusForm.processResult"
          type="textarea"
          :rows="4"
          maxlength="1000"
          show-word-limit
          placeholder="状态为已完成时必须填写处理结果"
        />
      </el-form-item>
      <el-form-item label="完成时间">
        <el-date-picker
          v-model="todoStatusForm.completedAt"
          type="datetime"
          style="width: 100%"
          format="YYYY/MM/DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :disabled="todoStatusForm.status !== '已完成'"
          clearable
        />
      </el-form-item>
      <el-alert
        title="状态改为非已完成时，后端会清空完成时间。"
        type="info"
        show-icon
        :closable="false"
      />
    </el-form>

    <template #footer>
      <el-button @click="todoStatusVisible = false">取消</el-button>
      <el-button type="primary" :loading="todoStatusSubmitting" @click="submitTodoStatus">保存状态</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="pauseDemandVisible" title="暂停需求" width="520px" @closed="resetPauseDemandDialog">
    <el-form label-position="top">
      <el-form-item label="暂停原因">
        <el-input
          v-model="pauseDemandForm.reason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="请输入暂停原因，例如等待外部联调环境、业务资料暂缺等"
        />
      </el-form-item>
      <el-form-item label="暂停日期">
        <el-date-picker
          v-model="pauseDemandForm.pauseDate"
          type="date"
          style="width: 100%"
          format="YYYY/MM/DD"
          value-format="YYYY-MM-DD"
          clearable
        />
      </el-form-item>
      <el-alert title="恢复时系统会自动回到暂停前的需求状态。" type="info" show-icon :closable="false" />
    </el-form>

    <template #footer>
      <el-button @click="pauseDemandVisible = false">取消</el-button>
      <el-button type="primary" :loading="pauseDemandSubmitting" @click="submitPauseDemand">确认暂停</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="closeDemandVisible" title="关闭需求" width="520px" @closed="resetCloseDemandDialog">
    <el-form label-position="top">
      <el-form-item label="关闭原因">
        <el-input
          v-model="closeDemandForm.closeReason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="请输入关闭原因，例如业务取消、重复需求、暂不处理等"
        />
      </el-form-item>
      <el-form-item label="关闭日期">
        <el-date-picker
          v-model="closeDemandForm.occurredAt"
          type="date"
          style="width: 100%"
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
          clearable
        />
      </el-form-item>
      <el-alert title="关闭后该需求进入终态，不能继续推进阶段。" type="warning" show-icon :closable="false" />
    </el-form>

    <template #footer>
      <el-button @click="closeDemandVisible = false">取消</el-button>
      <el-button type="danger" :loading="closeDemandSubmitting" @click="submitCloseDemand">确认关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.project-group-option,
.user-option {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(140px, 1.1fr);
  gap: 16px;
  align-items: center;
}

.project-group-option-name,
.user-option-name {
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-group-option-meta,
.user-option-meta {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danger-dropdown-item {
  color: var(--el-color-danger);
}

.table-action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.requirement-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  cursor: default;
}

.requirement-cell-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.requirement-cell-line--meta {
  align-items: baseline;
}

.requirement-cell-title {
  flex: 0 1 auto;
  min-width: 0;
  color: #1f2d3d;
  font-weight: 600;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-cell-meta {
  flex: 0 1 auto;
  min-width: 0;
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-copy-button {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  color: #8a94a6;
  vertical-align: middle;
}

.requirement-copy-button:hover {
  color: var(--el-color-primary);
}

.active-todo-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid #f59e0b;
  border-radius: 999px;
  color: #b45309;
  background: #fff7ed;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

:deep(.intake-table .el-table__body tr.intake-table-row--active-todo > td:first-child) {
  box-shadow: inset 4px 0 0 #f59e0b;
}

:deep(.intake-table .el-table__body tr.intake-table-row--active-todo > td) {
  background: #fff7ed;
}

:deep(.intake-table .el-table__body tr.intake-table-row--active-todo:hover > td) {
  background: #ffedd5;
}

.todo-status-tag--active {
  font-weight: 700;
}

.copyable-detail-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.copyable-detail-value > span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

:global(.requirement-cell-tooltip.el-popper) {
  border: 1px solid rgba(64, 95, 140, 0.16) !important;
  border-radius: 16px !important;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%) !important;
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.22),
    0 8px 18px rgba(64, 95, 140, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.92) !important;
  transform: translateY(-4px);
}

:global(.requirement-cell-tooltip.el-popper .el-popper__arrow::before) {
  border-color: rgba(64, 95, 140, 0.16) !important;
  background: #f7fbff !important;
}

.requirement-tooltip {
  min-width: 360px;
  max-width: 560px;
  padding: 6px 4px;
}

.requirement-tooltip-title {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5edf7;
  color: #172033;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  word-break: break-word;
}

.requirement-tooltip-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 6px 0;
  color: #667085;
  line-height: 1.5;
}

.requirement-tooltip-row strong {
  color: #27364a;
  font-weight: 600;
  word-break: break-word;
}

.date-effort-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1.35;
}

.date-effort-cell small {
  color: #8a94a6;
  font-size: 12px;
}

:deep(.intake-detail-dialog) {
  max-width: 1400px;
}

:deep(.intake-detail-dialog .el-dialog__body) {
  max-height: calc(90vh - 112px);
  overflow-y: auto;
  padding-top: 8px;
}

.task-evaluation-toolbar {
  display: grid;
  grid-template-columns: auto minmax(240px, 320px) repeat(2, auto);
  align-items: center;
  gap: 10px;
  justify-content: end;
}

.task-project-group-select {
  min-width: 0;
  width: 100%;
}

.task-evaluation-toolbar .el-button {
  width: 120px;
}

.task-evaluation-toolbar .el-button + .el-button {
  margin-left: 0;
}

.task-evaluation-toolbar-label {
  color: #68768a;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.task-evaluation-save-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.task-evaluation-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.task-evaluation-layout--detail {
  padding-bottom: 4px;
}

.task-evaluation-toolbar-card {
  padding: 14px 16px;
  border: 1px solid #d6e2f5;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fbff, #fdfefe);
}

.task-evaluation-toolbar-main {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.task-evaluation-scroll {
  overflow: auto;
  padding-right: 4px;
}

.task-evaluation-scroll--detail {
  overflow: visible;
  padding-right: 0;
}

.task-evaluation-output-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.task-evaluation-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.task-evaluation-result-grid--single {
  grid-template-columns: 1fr;
}

.task-evaluation-section {
  margin-top: 16px;
}

.task-evaluation-info-card {
  padding: 18px 20px;
  border: 1px solid #d8e3ee;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(16, 24, 40, 0.04);
}

.task-description-title,
.task-metric-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #7b889a;
}

.task-metric-value {
  color: #1b2a44;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.6;
}

.task-description-block {
  margin-top: 16px;
}

.task-description-content {
  margin-top: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f6f8fb;
  color: #263445;
  line-height: 1.7;
  word-break: break-word;
}

.task-description-content--detail {
  white-space: pre-wrap;
}

.task-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.task-metric-card {
  padding: 14px 16px;
  border: 1px solid #dde6f2;
  border-radius: 14px;
  background: linear-gradient(180deg, #f7fbff, #fff);
}

.task-metric-card :deep(.el-input),
.task-metric-card :deep(.el-date-editor) {
  width: 100%;
  margin-top: 8px;
}

.task-workitem-table {
  border: 1px solid #dbe5ef;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}

.task-table-title {
  font-weight: 700;
  color: #1b2a44;
  line-height: 1.6;
}

.readonly-cell-text {
  color: #344054;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.system-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.task-change-points {
  margin: 0;
  padding-left: 18px;
  color: #344054;
  font-size: 13px;
  line-height: 1.7;
}

.task-resource-list {
  margin: 0;
  padding-left: 18px;
  color: #344054;
  font-size: 13px;
  line-height: 1.7;
}

.requirement-change-list {
  margin: 0;
  padding-left: 20px;
  color: #344054;
  line-height: 1.8;
}

.demand-status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.demand-status-chip--default {
  color: #516071;
  background: #eef2f6;
  border-color: #d7dee6;
}

.demand-status-chip--recorded {
  color: #35566d;
  background: #eaf4fb;
  border-color: #bfd8eb;
}

.demand-status-chip--clarifying {
  color: #7c3aed;
  background: #f3ecff;
  border-color: #d8c2ff;
}

.demand-status-chip--pending-processing {
  color: #8a4b00;
  background: #fff6df;
  border-color: #f2d28a;
}

.demand-status-chip--processing {
  color: #0f766e;
  background: #e2f8f2;
  border-color: #aee5d6;
}

.demand-status-chip--pending-review {
  color: #9a5b00;
  background: #fff3dc;
  border-color: #f3d18f;
}

.demand-status-chip--evaluating {
  color: #1d4ed8;
  background: #eaf2ff;
  border-color: #b9d4ff;
}

.demand-status-chip--pending-confirmation {
  color: #0f4db8;
  background: #e8f0ff;
  border-color: #bed2ff;
}

.demand-status-chip--reviewed {
  color: #5e3ab3;
  background: #f1eafe;
  border-color: #d7c6fb;
}

.demand-status-chip--developing {
  color: #0f4db8;
  background: #e8f0ff;
  border-color: #bed2ff;
}

.demand-status-chip--pending-test {
  color: #0d6c6e;
  background: #e6f7f7;
  border-color: #b7e4e4;
}

.demand-status-chip--testing {
  color: #0f766e;
  background: #ddf9f2;
  border-color: #ace9db;
}

.demand-status-chip--pending-acceptance {
  color: #b45309;
  background: #fff1e4;
  border-color: #f5cda5;
}

.demand-status-chip--pending-release {
  color: #a61b58;
  background: #fde7f1;
  border-color: #f3bfd4;
}

.demand-status-chip--paused {
  color: #7a3f05;
  background: #fff7ed;
  border-color: #fdba74;
}

.demand-status-chip--released {
  color: #166534;
  background: #e7f8eb;
  border-color: #bce7c8;
}

.demand-status-chip--closed {
  color: #5f6673;
  background: #f0f2f5;
  border-color: #cfd5df;
}

.detail-basic-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 20px;
  align-items: start;
}

.detail-basic-main {
  min-width: 0;
}

.detail-lifecycle-panel {
  position: sticky;
  top: 0;
  min-width: 0;
  padding: 10px 12px 2px;
  border: 1px solid #e3e8f1;
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff, #ffffff 42%);
}

.stage-timeline {
  margin-top: 0;
  padding-left: 4px;
}

.stage-timeline-item {
  padding: 8px 10px;
  border: 1px solid #e3e8f1;
  border-radius: 10px;
  background: #fff;
}

.stage-timeline-item--active {
  border-color: #9bc8ff;
  background: linear-gradient(180deg, #f3f8ff, #fff);
  box-shadow: 0 8px 22px rgb(64 158 255 / 10%);
}

.stage-timeline-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #15233d;
}

.stage-timeline-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}

.stage-timeline-metric {
  word-break: break-word;
}

@media (max-width: 1180px) {
  .detail-basic-layout {
    grid-template-columns: 1fr;
  }

  .detail-lifecycle-panel {
    position: static;
  }
}

.enrichment-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  position: relative;
  vertical-align: middle;
}

.enrichment-dot::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  opacity: 0.28;
}

.enrichment-dot--idle {
  background: #b8c0cc;
}

.enrichment-dot--idle::after {
  background: #b8c0cc;
}

.enrichment-dot--pending {
  background: #7b8cff;
}

.enrichment-dot--pending::after {
  background: #7b8cff;
}

.enrichment-dot--running {
  background: #f2a93b;
}

.enrichment-dot--running::after {
  background: #f2a93b;
}

.enrichment-dot--success {
  background: #33b074;
}

.enrichment-dot--success::after {
  background: #33b074;
}

.enrichment-dot--failed {
  background: #e06262;
}

.enrichment-dot--failed::after {
  background: #e06262;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.section-title--actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.subsection-title {
  margin-bottom: 10px;
  font-weight: 600;
}

.field-table-wrap {
  margin-top: 12px;
}

.collaboration-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.collaboration-field .el-input {
  flex: 1 1 auto;
  min-width: 0;
}

.collaboration-field .el-button {
  flex: 0 0 auto;
}

.raw-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
}

.file-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--el-text-color-secondary);
}

.file-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  line-height: 1.7;
}

.file-list-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-panel-row {
  margin-top: 16px;
}

.upload-dropzone {
  display: flex;
  min-height: 200px;
  width: 100%;
  cursor: pointer;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--el-border-color-darker);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--el-fill-color-extra-light), #fff);
  padding: 24px;
  box-sizing: border-box;
}

.upload-dropzone--compact {
  min-height: 112px;
  padding: 16px;
}

.upload-dropzone-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.upload-dropzone-subtitle,
.upload-dropzone-desc {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.upload-input {
  width: 100%;
}

.preview-image {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  margin: 0 auto;
  object-fit: contain;
}

.preview-frame {
  display: block;
  width: 100%;
  height: 72vh;
  border: 0;
}

.history-detail {
  white-space: pre-line;
  line-height: 1.6;
}

.detail-block {
  padding: 14px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
}

.sql-draft-panel {
  padding: 16px;
  border: 1px solid #b9d8ff;
  border-radius: 14px;
  background: linear-gradient(180deg, #f4f9ff, #fff);
}

.analysis-panel {
  padding: 16px;
  border: 1px solid #c6e3d2;
  border-radius: 14px;
  background: linear-gradient(180deg, #f4fff8, #fff);
}

.evaluation-panel {
  margin: 14px 0;
  padding: 14px;
  border: 1px solid #c6e3d2;
  border-radius: 14px;
  background: linear-gradient(180deg, #f4fff8, #fff);
}

.analysis-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sql-draft-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.sql-draft-title {
  font-weight: 700;
  color: #1f3f6d;
}

.sql-draft-subtitle,
.muted-text {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.sql-draft-meta {
  margin-bottom: 12px;
}

.sql-block {
  margin: 0 0 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #101828;
  color: #e8f1ff;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

.sql-draft-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.sql-draft-grid--single {
  grid-template-columns: 1fr;
}

.mini-title {
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mini-title--actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-clarification-option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}

.ai-clarification-option__hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.warning-list {
  color: #9f6a00;
}

.workitem-draft-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.workitem-draft-card {
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: #fff;
}

.workitem-draft-title {
  margin-bottom: 8px;
  font-weight: 700;
}

.workitem-draft-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 768px) {
  .collaboration-field {
    flex-wrap: wrap;
  }

  .collaboration-field .el-input {
    flex-basis: 100%;
  }

  .task-evaluation-toolbar-main,
  .task-evaluation-output-grid,
  .task-evaluation-result-grid,
  .task-metric-grid {
    grid-template-columns: 1fr;
  }

  .task-evaluation-toolbar {
    grid-template-columns: 1fr;
    justify-content: stretch;
  }

  .task-evaluation-toolbar .el-button {
    width: 100%;
  }

  .sql-draft-header {
    flex-direction: column;
  }

  .sql-draft-grid {
    grid-template-columns: 1fr;
  }

  .ai-clarification-option {
    align-items: flex-start;
    flex-direction: column;
  }
}

:deep(.task-evaluation-dialog .el-dialog) {
  max-width: 1600px;
  margin: 0 auto;
}

:deep(.task-evaluation-dialog .el-dialog__header) {
  padding: 24px 24px 18px;
  border-bottom: 1px solid #e7edf4;
}

:deep(.task-evaluation-dialog .el-dialog__title) {
  font-size: 28px;
  font-weight: 800;
  color: #142033;
}

:deep(.task-evaluation-dialog .el-dialog__body) {
  padding: 20px 24px;
  max-height: calc(88vh - 148px);
  overflow: hidden;
}

:deep(.task-evaluation-dialog .el-dialog__footer) {
  padding: 18px 24px 24px;
  border-top: 1px solid #e7edf4;
  background: #fff;
}
</style>
