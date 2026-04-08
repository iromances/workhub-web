<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  advanceIntakeStage,
  createUploadIntake,
  downloadAttachment,
  fetchIntakeDetail,
  fetchIntakeRecords,
  updateIntakeZentaoLink,
} from '@/api/intake'
import { useAuthStore } from '@/stores/auth'
import type { IntakeAttachment, IntakeDetail, IntakeSummary } from '@/types/work-item'

const authStore = useAuthStore()

const loading = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const intakeRecords = ref<IntakeSummary[]>([])
const total = ref(0)
const detailVisible = ref(false)
const createDialogVisible = ref(false)
const selectedDetail = ref<IntakeDetail | null>(null)
const screenshotFiles = ref<File[]>([])
const attachmentFiles = ref<File[]>([])
const previewVisible = ref(false)
const previewImageUrl = ref('')
const previewImageName = ref('')
const stageActionVisible = ref(false)
const stageSubmitting = ref(false)
const stageActionRow = ref<IntakeSummary | null>(null)
const zentaoSubmitting = ref(false)
const deliveryDataFiles = ref<File[]>([])

const filters = reactive({
  keyword: '',
  sourceType: '',
  demandStatus: '',
  enrichmentStatus: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const createForm = reactive({
  senderName: '',
  sourceChannel: '',
  rawContent: '',
})

const zentaoForm = reactive({
  url: '',
})

const stageActionForm = reactive({
  action: '',
  estimatedEffort: '',
  plannedDueDate: '',
  actualEffort: '',
  actualCompletedTime: '',
  acceptanceTime: '',
  occurredAt: '',
  developmentOwnerUserName: '',
})


const updateHistories = computed(() =>
  (selectedDetail.value?.histories || []).filter((item) => item.actionType === 'UPDATE'),
)

async function loadBaseData() {
  await loadIntakeRecords()
}

async function loadIntakeRecords() {
  loading.value = true
  try {
    const response = await fetchIntakeRecords({
      keyword: filters.keyword || undefined,
      sourceType: filters.sourceType || undefined,
      demandStatus: filters.demandStatus || undefined,
      enrichmentStatus: filters.enrichmentStatus || undefined,
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


async function loadDetail(id: number, recordView = true) {
  detailLoading.value = true
  try {
    selectedDetail.value = await fetchIntakeDetail(id, recordView)
    return selectedDetail.value
  } catch (error) {
    ElMessage.error('加载需求详情失败')
    console.error(error)
    return null
  } finally {
    detailLoading.value = false
  }
}

async function openDetail(id: number) {
  detailVisible.value = true
  const detail = await loadDetail(id, true)
  if (!detail) {
    detailVisible.value = false
    return
  }
  zentaoForm.url = detail.structuredData?.zentaoUrl || ''
}

function openCreateDialog() {
  createForm.senderName = authStore.userName || ''
  createForm.sourceChannel = '需求录入'
  createForm.rawContent = ''
  screenshotFiles.value = []
  attachmentFiles.value = []
  createDialogVisible.value = true
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

function handleDeliveryFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  deliveryDataFiles.value = mergeFiles(deliveryDataFiles.value, Array.from(target.files ?? []))
}

function handleDroppedDeliveryFiles(event: DragEvent) {
  deliveryDataFiles.value = mergeFiles(deliveryDataFiles.value, Array.from(event.dataTransfer?.files ?? []))
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
    if (!createForm.rawContent.trim() && screenshotFiles.value.length === 0) {
      ElMessage.warning('请填写需求录入内容或上传需求截图')
      return
    }
    const formData = new FormData()
    formData.append('senderName', createForm.senderName)
    formData.append('sourceChannel', createForm.sourceChannel)
    if (createForm.rawContent) {
      formData.append('rawContent', createForm.rawContent)
    }
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

function resolveActionForRow(row: IntakeSummary) {
  const operationsDemand = isOperationsDemand(row.requirementType)
  switch (row.demandStatus) {
    case '已收录':
    case '待评估':
      return 'EVALUATE_EFFORT'
    case '已评估':
      return 'START_DEVELOPMENT'
    case '研发中':
      return operationsDemand ? 'COMPLETE_DELIVERY' : 'SUBMIT_TESTING'
    case '待测试':
      return operationsDemand ? null : 'START_TESTING'
    case '测试中':
      return operationsDemand ? null : 'SUBMIT_ACCEPTANCE'
    case '待验收':
      return operationsDemand ? null : 'CONFIRM_ACCEPTANCE'
    case '待上线':
      return operationsDemand ? null : 'CONFIRM_RELEASE'
    default:
      return null
  }
}

function resolveActionLabel(action: string | null) {
  switch (action) {
    case 'EVALUATE_EFFORT':
      return '评估工时'
    case 'START_DEVELOPMENT':
      return '开始研发'
    case 'SUBMIT_TESTING':
      return '提交测试'
    case 'START_TESTING':
      return '开始测试'
    case 'SUBMIT_ACCEPTANCE':
      return '提交验收'
    case 'CONFIRM_ACCEPTANCE':
      return '确认验收'
    case 'CONFIRM_RELEASE':
      return '确认上线'
    case 'COMPLETE_DELIVERY':
      return '确认完成'
    default:
      return ''
  }
}

function resetStageActionForm() {
  stageActionForm.action = ''
  stageActionForm.estimatedEffort = ''
  stageActionForm.plannedDueDate = ''
  stageActionForm.actualEffort = ''
  stageActionForm.actualCompletedTime = ''
  stageActionForm.acceptanceTime = ''
  stageActionForm.occurredAt = normalizePickerDateValue(new Date().toISOString())
  stageActionForm.developmentOwnerUserName = ''
  deliveryDataFiles.value = []
}

function openStageActionDialog(row: IntakeSummary) {
  const action = resolveActionForRow(row)
  if (!action) {
    ElMessage.warning('当前阶段没有可执行的推进动作')
    return
  }
  stageActionRow.value = row
  resetStageActionForm()
  stageActionForm.action = action
  if (action === 'EVALUATE_EFFORT') {
    stageActionForm.estimatedEffort = row.estimatedEffort || ''
    stageActionForm.plannedDueDate = normalizePickerDateValue(row.plannedDueDate)
  }
  if (action === 'START_DEVELOPMENT') {
    stageActionForm.developmentOwnerUserName = row.developmentOwnerUserName || selectedDetail.value?.structuredData?.developmentOwnerUserName || ''
  }
  if (action === 'SUBMIT_TESTING') {
    stageActionForm.actualEffort = row.actualEffort || ''
    stageActionForm.actualCompletedTime = normalizePickerDateValue(row.actualCompletedTime) || normalizePickerDateValue(new Date().toISOString())
  }
  if (action === 'COMPLETE_DELIVERY') {
    stageActionForm.actualEffort = row.actualEffort || ''
    stageActionForm.actualCompletedTime = normalizePickerDateValue(row.actualCompletedTime) || normalizePickerDateValue(new Date().toISOString())
  }
  if (action === 'CONFIRM_ACCEPTANCE') {
    stageActionForm.acceptanceTime = normalizePickerDateValue(row.acceptanceTime) || normalizePickerDateValue(new Date().toISOString())
  }
  stageActionVisible.value = true
}

function buildStageActionFormData(payload: Record<string, string | undefined>, files: File[]) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) {
      formData.append(key, value)
    }
  })
  files.forEach((file) => formData.append('dataFiles', file))
  return formData
}

async function submitStageAction() {
  if (!stageActionRow.value || !stageActionForm.action) {
    return
  }
  if (stageActionForm.action === 'START_DEVELOPMENT' && !stageActionForm.developmentOwnerUserName.trim()) {
    ElMessage.warning('请选择研发人员')
    return
  }
  stageSubmitting.value = true
  try {
    const payload = {
      action: stageActionForm.action,
      estimatedEffort: stageActionForm.estimatedEffort || undefined,
      plannedDueDate: stageActionForm.plannedDueDate || undefined,
      actualEffort: stageActionForm.actualEffort || undefined,
      actualCompletedTime: stageActionForm.actualCompletedTime || undefined,
      acceptanceTime: stageActionForm.acceptanceTime || undefined,
      occurredAt: stageActionForm.occurredAt || undefined,
      developmentOwnerUserName: stageActionForm.developmentOwnerUserName || undefined,
    }
    const request = stageActionForm.action === 'COMPLETE_DELIVERY'
      ? buildStageActionFormData(payload, deliveryDataFiles.value)
      : payload
    const detail = await advanceIntakeStage(stageActionRow.value.id, request)
    if (selectedDetail.value?.id === detail.id) {
      selectedDetail.value = detail
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
  zentaoSubmitting.value = true
  try {
    const detail = await updateIntakeZentaoLink(selectedDetail.value.id, zentaoForm.url)
    selectedDetail.value = detail
    zentaoForm.url = detail.structuredData?.zentaoUrl || ''
    ElMessage.success('禅道地址已保存')
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '保存禅道地址失败'))
    console.error(error)
  } finally {
    zentaoSubmitting.value = false
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
    previewVisible.value = true
  } catch (error) {
    ElMessage.error('预览图片失败')
    console.error(error)
  }
}

function closePreview() {
  previewVisible.value = false
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value)
    previewImageUrl.value = ''
  }
  previewImageName.value = ''
}

function resolveSubmittedTime(row: IntakeSummary) {
  return formatDisplayTime(row.submittedTime || row.receivedAt)
}

function formatDisplayTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ')
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 10)
}

function normalizePickerDateValue(value: string | null | undefined) {
  if (!value) {
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

function resolveDemandStatusClass(status: string | null | undefined) {
  switch (status) {
    case '已收录':
      return 'demand-status-chip--recorded'
    case '待评估':
      return 'demand-status-chip--pending-review'
    case '已评估':
      return 'demand-status-chip--reviewed'
    case '研发中':
      return 'demand-status-chip--developing'
    case '待测试':
      return 'demand-status-chip--pending-test'
    case '测试中':
      return 'demand-status-chip--testing'
    case '待验收':
      return 'demand-status-chip--pending-acceptance'
    case '待上线':
      return 'demand-status-chip--pending-release'
    case '已上线':
      return 'demand-status-chip--released'
    default:
      return 'demand-status-chip--default'
  }
}

function resolveStageActionDialogTitle(action: string) {
  return resolveActionLabel(action) || '推进阶段'
}

function resolveOccurredAtLabel(action: string) {
  switch (action) {
    case 'START_DEVELOPMENT':
      return '研发开始日期'
    case 'START_TESTING':
      return '测试开始日期'
    case 'CONFIRM_RELEASE':
      return '上线时间'
    case 'COMPLETE_DELIVERY':
      return '完成日期'
    default:
      return '操作日期'
  }
}

function requiresOccurredAt(action: string) {
  return ['START_DEVELOPMENT', 'START_TESTING', 'CONFIRM_RELEASE', 'COMPLETE_DELIVERY'].includes(action)
}

onMounted(loadBaseData)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <h1 class="page-title">需求管理</h1>
    </div>

    <el-form inline class="filter-form" @submit.prevent="handleSearch">
      <el-form-item>
        <el-input v-model="filters.keyword" placeholder="审批编号 / 需求类型 / 需求摘要 / 提出人" clearable />
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.sourceType" placeholder="录入来源" clearable style="width: 160px">
          <el-option label="企业微信回调" value="企业微信回调" />
          <el-option label="需求截图附件录入" value="需求截图附件录入" />
          <el-option label="截图附件录入（历史）" value="截图附件录入" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.demandStatus" placeholder="需求状态" clearable style="width: 160px">
          <el-option label="已收录" value="已收录" />
          <el-option label="待评估" value="待评估" />
          <el-option label="已评估" value="已评估" />
          <el-option label="研发中" value="研发中" />
          <el-option label="待测试" value="待测试" />
          <el-option label="测试中" value="测试中" />
          <el-option label="待验收" value="待验收" />
          <el-option label="待上线" value="待上线" />
          <el-option label="已上线" value="已上线" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.enrichmentStatus" placeholder="识别状态" clearable style="width: 160px">
          <el-option label="排队中" value="PENDING" />
          <el-option label="处理中" value="RUNNING" />
          <el-option label="已完成" value="SUCCEEDED" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button @click="openCreateDialog">需求录入</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="intakeRecords" class="intake-table">
      <el-table-column label="" width="56" align="center">
        <template #default="{ row }">
          <el-tooltip :content="`识别状态：${resolveEnrichmentStatusLabel(row.enrichmentStatus)}`" placement="top">
            <span class="enrichment-dot" :class="resolveEnrichmentIndicatorClass(row.enrichmentStatus)" />
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="approvalCode" label="审批编号" width="150" />
      <el-table-column label="提交时间" width="180">
        <template #default="{ row }">
          {{ resolveSubmittedTime(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="proposerName" label="提出人" width="120" />
      <el-table-column label="需求状态" width="120">
        <template #default="{ row }">
          <span class="demand-status-chip" :class="resolveDemandStatusClass(row.demandStatus)">
            {{ row.demandStatus || '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="requirementType" label="需求类型" width="140" />
      <el-table-column prop="requirementDigest" label="需求摘要" min-width="220" show-overflow-tooltip />
      <el-table-column prop="businessLine" label="需求所属业务线" width="160" show-overflow-tooltip />
      <el-table-column label="预估工时" width="130">
        <template #default="{ row }">
          {{ row.estimatedEffort || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="预估完成时间" width="160">
        <template #default="{ row }">
          {{ row.plannedDueDate || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="实际工时" width="130">
        <template #default="{ row }">
          {{ row.actualEffort || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="实际完成时间" width="160">
        <template #default="{ row }">
          {{ row.actualCompletedTime || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="验收时间" width="160">
        <template #default="{ row }">
          {{ row.acceptanceTime || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="需求备注" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">查看详情</el-button>
          <el-button
            v-if="resolveActionForRow(row)"
            link
            type="primary"
            @click="openStageActionDialog(row)"
          >
            {{ resolveActionLabel(resolveActionForRow(row)) }}
          </el-button>
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
              <li v-for="file in screenshotFiles" :key="file.name">{{ file.name }}</li>
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
              <li v-for="file in attachmentFiles" :key="file.name">{{ file.name }}</li>
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
    width="520px"
  >
    <el-form label-position="top">
      <el-form-item v-if="stageActionForm.action === 'EVALUATE_EFFORT'" label="预估工时">
        <el-input v-model="stageActionForm.estimatedEffort" placeholder="例如 2d / 16h" />
      </el-form-item>
      <el-form-item v-if="stageActionForm.action === 'EVALUATE_EFFORT'" label="预估完成时间">
        <el-date-picker
          v-model="stageActionForm.plannedDueDate"
          type="date"
          style="width: 100%"
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
          clearable
        />
      </el-form-item>
      <el-form-item v-if="stageActionForm.action === 'START_DEVELOPMENT'" label="研发人员">
        <el-input v-model="stageActionForm.developmentOwnerUserName" placeholder="请输入研发人员用户名" />
      </el-form-item>
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
      <template v-if="['SUBMIT_TESTING', 'COMPLETE_DELIVERY'].includes(stageActionForm.action)">
        <el-form-item label="实际工时">
          <el-input v-model="stageActionForm.actualEffort" placeholder="例如 3d / 24h" />
        </el-form-item>
        <el-form-item :label="stageActionForm.action === 'COMPLETE_DELIVERY' ? '完成时间' : '实际完成时间'">
          <el-date-picker
            v-model="stageActionForm.actualCompletedTime"
            type="date"
            style="width: 100%"
            format="YYYY/MM/DD"
            value-format="YYYY/MM/DD"
            clearable
          />
        </el-form-item>
        <el-form-item v-if="stageActionForm.action === 'COMPLETE_DELIVERY'" label="数据文件（可选）">
          <label class="upload-dropzone upload-dropzone--compact" @dragover.prevent @drop.prevent="handleDroppedDeliveryFiles">
            <input class="upload-input" type="file" multiple @change="handleDeliveryFileChange" />
            <span class="upload-dropzone-title">点击选择或直接拖入数据文件</span>
            <span class="upload-dropzone-desc">可上传交付结果、导出文件或处理凭证</span>
          </label>
          <ul v-if="deliveryDataFiles.length" class="file-list">
            <li v-for="file in deliveryDataFiles" :key="`${file.name}-${file.size}-${file.lastModified}`">{{ file.name }}</li>
          </ul>
        </el-form-item>
      </template>
      <el-form-item v-if="stageActionForm.action === 'CONFIRM_ACCEPTANCE'" label="验收时间">
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
        v-if="['SUBMIT_ACCEPTANCE', 'START_DEVELOPMENT', 'START_TESTING', 'CONFIRM_RELEASE', 'COMPLETE_DELIVERY'].includes(stageActionForm.action)"
        :title="`确认执行“${resolveActionLabel(stageActionForm.action)}”后，需求状态将自动推进。`"
        type="info"
        show-icon
        :closable="false"
      />
    </el-form>

    <template #footer>
      <el-button @click="stageActionVisible = false">取消</el-button>
      <el-button type="primary" :loading="stageSubmitting" @click="submitStageAction">
        确认
      </el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="detailVisible" title="需求详情" size="760px">
    <el-skeleton :loading="detailLoading" animated>
      <template #template>
        <el-skeleton-item variant="h3" style="width: 55%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" />
        <el-skeleton-item variant="text" />
      </template>

      <template #default>
        <template v-if="selectedDetail">
          <div class="section-title">需求概览</div>
          <template v-if="selectedDetail.structuredData">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="需求状态">
                <span class="demand-status-chip" :class="resolveDemandStatusClass(selectedDetail.demandStatus)">
                  {{ selectedDetail.demandStatus || '-' }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="识别状态">
                {{ resolveEnrichmentStatusLabel(selectedDetail.enrichmentStatus) }}
              </el-descriptions-item>
              <el-descriptions-item label="审批编号">{{ selectedDetail.structuredData.approvalCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="提出人">
                {{ selectedDetail.structuredData.proposerName || selectedDetail.senderName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="提交时间">{{ formatDisplayTime(selectedDetail.structuredData.submittedTime) }}</el-descriptions-item>
              <el-descriptions-item label="需求类型">{{ selectedDetail.structuredData.requirementType || '-' }}</el-descriptions-item>
              <el-descriptions-item label="需求摘要">{{ selectedDetail.structuredData.requirementDigest || '-' }}</el-descriptions-item>
              <el-descriptions-item label="审批标题">{{ selectedDetail.structuredData.approvalTitle || '-' }}</el-descriptions-item>
              <el-descriptions-item label="研发人员">
                {{ selectedDetail.structuredData.developmentOwnerUserName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="研发分支">
                {{ selectedDetail.structuredData.developmentBranchName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="禅道地址">
                <a
                  v-if="selectedDetail.structuredData.zentaoUrl"
                  :href="selectedDetail.structuredData.zentaoUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  打开链接
                </a>
                <span v-else>-</span>
              </el-descriptions-item>
            </el-descriptions>

            <div class="section-title">研发协同</div>
            <el-form label-position="top" class="zentao-form">
              <el-form-item label="关联禅道地址">
                <el-input v-model="zentaoForm.url" placeholder="https://zentao.example.com/..." />
              </el-form-item>
              <div class="zentao-form-actions">
                <el-button type="primary" :loading="zentaoSubmitting" @click="submitZentaoLink">保存禅道地址</el-button>
              </div>
            </el-form>

            <div class="section-title">业务信息</div>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="所在部门">{{ selectedDetail.structuredData.department || '-' }}</el-descriptions-item>
              <el-descriptions-item label="业务线">{{ selectedDetail.structuredData.businessLine || '-' }}</el-descriptions-item>
              <el-descriptions-item label="预估工时">{{ selectedDetail.structuredData.estimatedEffort || '-' }}</el-descriptions-item>
              <el-descriptions-item label="预估完成时间">{{ formatDisplayDate(selectedDetail.structuredData.plannedDueDate) }}</el-descriptions-item>
              <el-descriptions-item label="研发开始日期">{{ formatDisplayDate(selectedDetail.structuredData.developmentStartedDate) }}</el-descriptions-item>
              <el-descriptions-item label="实际工时">{{ selectedDetail.structuredData.actualEffort || '-' }}</el-descriptions-item>
              <el-descriptions-item label="测试开始日期">{{ formatDisplayDate(selectedDetail.structuredData.testingStartedDate) }}</el-descriptions-item>
              <el-descriptions-item label="实际完成时间">{{ formatDisplayDate(selectedDetail.structuredData.actualCompletedTime) }}</el-descriptions-item>
              <el-descriptions-item label="验收时间">{{ formatDisplayDate(selectedDetail.structuredData.acceptanceTime) }}</el-descriptions-item>
              <el-descriptions-item label="上线时间">{{ formatDisplayDate(selectedDetail.structuredData.releasedTime) }}</el-descriptions-item>
              <el-descriptions-item label="来源">{{ selectedDetail.sourceType }}</el-descriptions-item>
              <el-descriptions-item label="渠道">{{ selectedDetail.sourceChannel }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{ selectedDetail.structuredData.remark || '-' }}</el-descriptions-item>
            </el-descriptions>

            <div class="section-title">需求描述</div>
            <div class="detail-block">{{ selectedDetail.structuredData.requirementSummary || '-' }}</div>

            <div class="section-title">原始材料</div>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="发送人">{{ selectedDetail.senderName }}</el-descriptions-item>
              <el-descriptions-item label="外部消息 ID">{{ selectedDetail.externalMessageId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="原始内容">
                <pre class="raw-block">{{ selectedDetail.rawContent }}</pre>
              </el-descriptions-item>
            </el-descriptions>

            <div class="field-table-wrap">
              <el-table :data="selectedDetail.structuredData.fields" size="small" border>
                <el-table-column prop="label" label="字段" width="160" />
                <el-table-column prop="value" label="值" min-width="360" />
              </el-table>
            </div>
          </template>
          <el-empty v-else description="尚未抽取出结构化字段" />

          <div class="section-title">截图与附件</div>
          <template v-if="selectedDetail.attachments.length">
            <el-table :data="selectedDetail.attachments" size="small" border>
              <el-table-column prop="category" label="类型" width="100" />
              <el-table-column prop="fileName" label="文件名" min-width="280" />
              <el-table-column prop="contentType" label="内容类型" min-width="160" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button v-if="row.previewable" link type="primary" @click="previewAttachment(row)">预览</el-button>
                  <el-button link type="primary" @click="handleDownload(row)">下载</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <el-empty v-else description="没有附件" />

          <div class="section-title">修改历史</div>
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

        </template>
      </template>
    </el-skeleton>
  </el-drawer>

  <el-dialog v-model="previewVisible" :title="previewImageName || '图片预览'" width="960px" @closed="closePreview">
    <img v-if="previewImageUrl" :src="previewImageUrl" class="preview-image" alt="附件预览" />
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

.demand-status-chip--pending-review {
  color: #9a5b00;
  background: #fff3dc;
  border-color: #f3d18f;
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

.demand-status-chip--released {
  color: #166534;
  background: #e7f8eb;
  border-color: #bce7c8;
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

.subsection-title {
  margin-bottom: 10px;
  font-weight: 600;
}

.field-table-wrap {
  margin-top: 12px;
}

.zentao-form {
  margin-top: 12px;
}

.zentao-form-actions {
  display: flex;
  justify-content: flex-end;
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

.upload-dropzone-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

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
</style>
