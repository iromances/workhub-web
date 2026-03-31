<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  convertIntakeToWorkItem,
  createManualIntake,
  createPastedIntake,
  createUploadIntake,
  downloadAttachment,
  fetchIntakeDetail,
  fetchIntakeRecords,
  generateIntakeAiDraft,
} from '@/api/intake'
import { fetchProjects } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type {
  IntakeAttachment,
  IntakeConvertRequest,
  IntakeDetail,
  IntakeSummary,
  IntakeTaskBreakdownItem,
  ProjectSummary,
} from '@/types/work-item'

const authStore = useAuthStore()

const loading = ref(false)
const detailLoading = ref(false)
const aiLoadingId = ref<number | null>(null)
const submitting = ref(false)
const intakeRecords = ref<IntakeSummary[]>([])
const projects = ref<ProjectSummary[]>([])
const detailVisible = ref(false)
const createDialogVisible = ref(false)
const convertDialogVisible = ref(false)
const selectedDetail = ref<IntakeDetail | null>(null)
const createMode = ref<'manual' | 'paste' | 'upload'>('manual')
const aiProvider = ref<'heuristic' | 'openrouter' | 'minimax'>('heuristic')
const screenshotFiles = ref<File[]>([])
const attachmentFiles = ref<File[]>([])

const filters = reactive({
  keyword: '',
  status: '',
  sourceType: '',
})

const createForm = reactive({
  senderName: '',
  sourceChannel: '',
  rawContent: '',
})

const convertForm = reactive<IntakeConvertRequest>({
  projectId: null,
  sprintId: null,
  releaseId: null,
  type: '需求',
  title: '',
  description: '',
  priority: 'P2',
  urgency: '',
  ownerUserName: '',
  followerUserName: '',
  proposerName: '',
  acceptanceCriteria: '',
  plannedStartAt: '',
  plannedEndAt: '',
})

const projectOptions = computed(() =>
  projects.value.map((project) => ({
    label: `${project.code} / ${project.name}`,
    value: project.id,
  })),
)

const convertTaskBreakdown = computed<IntakeTaskBreakdownItem[]>(() => selectedDetail.value?.aiDraft?.taskBreakdownSuggestions || [])

async function loadBaseData() {
  await Promise.all([loadIntakeRecords(), loadProjects()])
}

async function loadIntakeRecords() {
  loading.value = true
  try {
    intakeRecords.value = await fetchIntakeRecords({
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
      sourceType: filters.sourceType || undefined,
    })
  } catch (error) {
    ElMessage.error('加载待整理箱失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadProjects() {
  try {
    projects.value = await fetchProjects()
  } catch (error) {
    ElMessage.error('加载项目列表失败')
    console.error(error)
  }
}

async function openDetail(id: number) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    selectedDetail.value = await fetchIntakeDetail(id)
  } catch (error) {
    detailVisible.value = false
    ElMessage.error('加载待整理详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

function openCreateDialog(mode: 'manual' | 'paste' | 'upload') {
  createMode.value = mode
  createForm.senderName = ''
  createForm.sourceChannel = mode === 'manual' ? '人工录入' : mode === 'paste' ? '文本粘贴' : '人工上传'
  createForm.rawContent = ''
  screenshotFiles.value = []
  attachmentFiles.value = []
  createDialogVisible.value = true
}

function handleScreenshotChange(event: Event) {
  const target = event.target as HTMLInputElement
  screenshotFiles.value = Array.from(target.files ?? [])
}

function handleAttachmentChange(event: Event) {
  const target = event.target as HTMLInputElement
  attachmentFiles.value = Array.from(target.files ?? [])
}

async function submitCreate() {
  submitting.value = true
  try {
    if (createMode.value === 'manual') {
      await createManualIntake({ ...createForm })
      ElMessage.success('人工录入成功')
    } else if (createMode.value === 'paste') {
      await createPastedIntake({ ...createForm })
      ElMessage.success('粘贴整理成功')
    } else {
      const formData = new FormData()
      formData.append('senderName', createForm.senderName)
      formData.append('sourceChannel', createForm.sourceChannel)
      if (createForm.rawContent) {
        formData.append('rawContent', createForm.rawContent)
      }
      screenshotFiles.value.forEach((file) => formData.append('screenshots', file))
      attachmentFiles.value.forEach((file) => formData.append('attachments', file))
      await createUploadIntake(formData)
      ElMessage.success('截图/附件录入成功')
    }
    createDialogVisible.value = false
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error, '提交待整理记录失败'))
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function runAi(row: IntakeSummary) {
  aiLoadingId.value = row.id
  try {
    const detail = await generateIntakeAiDraft(row.id, aiProvider.value)
    selectedDetail.value = detailVisible.value && selectedDetail.value?.id === row.id ? detail : selectedDetail.value
    ElMessage.success(`AI 整理完成，provider=${detail.aiDraft?.provider ?? 'heuristic'}`)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error('AI 整理失败')
    console.error(error)
  } finally {
    aiLoadingId.value = null
  }
}

async function openConvertDialog(row: IntakeSummary) {
  await openDetail(row.id)
  if (!selectedDetail.value) {
    return
  }
  const detail = selectedDetail.value
  const suggestedProject = projects.value.find((project) => project.code === detail.aiDraft?.suggestedProjectCode)

  convertForm.projectId = suggestedProject?.id ?? projects.value[0]?.id ?? null
  convertForm.type = detail.aiDraft?.typeSuggestion || '需求'
  convertForm.title = detail.aiDraft?.titleSuggestion || detail.structuredData?.requirementName || detail.rawContent.slice(0, 30)
  convertForm.description = detail.aiDraft?.descriptionSuggestion || detail.structuredData?.requirementSummary || detail.rawContent
  convertForm.priority = detail.aiDraft?.prioritySuggestion || 'P2'
  convertForm.urgency = detail.structuredData?.remark?.includes('最高优先级') ? '高' : ''
  convertForm.ownerUserName = authStore.userName || 'admin'
  convertForm.followerUserName = authStore.userName || 'admin'
  convertForm.proposerName = detail.senderName
  convertForm.acceptanceCriteria = detail.aiDraft?.acceptanceCriteriaSuggestion || ''
  convertForm.plannedStartAt = ''
  convertForm.plannedEndAt = normalizeDueDate(detail.structuredData?.plannedDueDate)

  convertDialogVisible.value = true
}

function normalizeDueDate(value?: string | null) {
  if (!value) {
    return ''
  }
  const normalized = value.trim().replace(/\//g, '-')
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T18:00:00`
  }
  return ''
}

async function submitConvert() {
  if (!selectedDetail.value) {
    return
  }
  submitting.value = true
  try {
    const payload: IntakeConvertRequest = {
      ...convertForm,
      projectId: convertForm.projectId,
      sprintId: convertForm.sprintId || null,
      releaseId: convertForm.releaseId || null,
      description: convertForm.description || undefined,
      urgency: convertForm.urgency || undefined,
      proposerName: convertForm.proposerName || undefined,
      acceptanceCriteria: convertForm.acceptanceCriteria || undefined,
      plannedStartAt: convertForm.plannedStartAt || undefined,
      plannedEndAt: convertForm.plannedEndAt || undefined,
    }
    const result = await convertIntakeToWorkItem(selectedDetail.value.id, payload)
    selectedDetail.value = result.intakeRecord
    convertDialogVisible.value = false
    ElMessage.success(`已转正式工作项：${result.workItem.no}`)
    await loadIntakeRecords()
  } catch (error) {
    ElMessage.error('转正式工作项失败')
    console.error(error)
  } finally {
    submitting.value = false
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

function resolveErrorMessage(error: unknown, fallback: string) {
  const maybeAxios = error as { response?: { data?: { message?: string } }; message?: string }
  return maybeAxios.response?.data?.message || maybeAxios.message || fallback
}

onMounted(loadBaseData)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">待整理箱</h1>
        <p class="page-desc">审批和原始消息先整理成结构化需求，再人工确认转正式工作项。</p>
      </div>
      <div class="actions">
        <el-select v-model="aiProvider" style="width: 160px">
          <el-option label="本地启发式" value="heuristic" />
          <el-option label="OpenRouter" value="openrouter" />
          <el-option label="MiniMax" value="minimax" />
        </el-select>
        <el-button @click="openCreateDialog('paste')">粘贴整理</el-button>
        <el-button @click="openCreateDialog('upload')">截图/附件录入</el-button>
        <el-button type="primary" @click="openCreateDialog('manual')">人工录入</el-button>
      </div>
    </div>

    <el-alert
      title="AI 只生成结构化建议和任务拆解，转正式工作项前必须人工确认。"
      type="info"
      show-icon
      :closable="false"
    />

    <el-form inline class="filter-form" @submit.prevent="loadIntakeRecords">
      <el-form-item>
        <el-input v-model="filters.keyword" placeholder="发送人 / 原始内容 / 外部消息 ID" clearable />
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.sourceType" placeholder="来源类型" clearable style="width: 160px">
          <el-option label="企业微信回调" value="企业微信回调" />
          <el-option label="人工录入" value="人工录入" />
          <el-option label="人工粘贴" value="人工粘贴" />
          <el-option label="截图附件录入" value="截图附件录入" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.status" placeholder="整理状态" clearable style="width: 160px">
          <el-option label="待整理" value="待整理" />
          <el-option label="AI 已整理" value="AI 已整理" />
          <el-option label="已转正式工作项" value="已转正式工作项" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadIntakeRecords">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="intakeRecords" class="intake-table">
      <el-table-column prop="approvalCode" label="审批编号" width="150" />
      <el-table-column prop="requirementName" label="需求名称" min-width="260" />
      <el-table-column prop="senderName" label="提交人" width="120" />
      <el-table-column prop="plannedDueDate" label="预计完成" width="130" />
      <el-table-column prop="status" label="整理状态" width="120" />
      <el-table-column prop="preview" label="原始内容预览" min-width="320" show-overflow-tooltip />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">查看详情</el-button>
          <el-button link :loading="aiLoadingId === row.id" @click="runAi(row)">AI 整理</el-button>
          <el-button link :disabled="Boolean(row.convertedWorkItemId)" @click="openConvertDialog(row)">
            转工作项
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="createDialogVisible"
    :title="createMode === 'manual' ? '人工录入待整理' : createMode === 'paste' ? '粘贴整理待整理' : '截图/附件录入待整理'"
    width="640px"
  >
    <el-form label-position="top">
      <el-form-item label="发送人">
        <el-input v-model="createForm.senderName" />
      </el-form-item>
      <el-form-item label="来源渠道">
        <el-input v-model="createForm.sourceChannel" />
      </el-form-item>
      <el-form-item :label="createMode === 'upload' ? '补充说明（建议按审批字段逐行填写）' : '原始内容'">
        <el-input v-model="createForm.rawContent" type="textarea" :rows="8" />
      </el-form-item>
      <template v-if="createMode === 'upload'">
        <el-alert
          title="当前上传录入不会自动 OCR 截图或解析文档正文，建议按“审批编号/需求名称/需求简介/预估工时/预估完成时间”这样的格式补充说明。"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-form-item label="截图（可多选）" class="upload-field">
          <input type="file" accept="image/*" multiple @change="handleScreenshotChange" />
          <ul v-if="screenshotFiles.length" class="file-list">
            <li v-for="file in screenshotFiles" :key="file.name">{{ file.name }}</li>
          </ul>
        </el-form-item>
        <el-form-item label="附件（可多选）" class="upload-field">
          <input type="file" multiple @change="handleAttachmentChange" />
          <ul v-if="attachmentFiles.length" class="file-list">
            <li v-for="file in attachmentFiles" :key="file.name">{{ file.name }}</li>
          </ul>
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="detailVisible" title="待整理详情" size="720px">
    <el-skeleton :loading="detailLoading" animated>
      <template #template>
        <el-skeleton-item variant="h3" style="width: 55%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" />
        <el-skeleton-item variant="text" />
      </template>

      <template #default>
        <template v-if="selectedDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="来源">{{ selectedDetail.sourceType }}</el-descriptions-item>
            <el-descriptions-item label="渠道">{{ selectedDetail.sourceChannel }}</el-descriptions-item>
            <el-descriptions-item label="发送人">{{ selectedDetail.senderName }}</el-descriptions-item>
            <el-descriptions-item label="接收时间">{{ selectedDetail.receivedAt }}</el-descriptions-item>
            <el-descriptions-item label="整理状态">{{ selectedDetail.status }}</el-descriptions-item>
            <el-descriptions-item label="外部消息 ID">
              {{ selectedDetail.externalMessageId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="原始内容">
              <pre class="raw-block">{{ selectedDetail.rawContent }}</pre>
            </el-descriptions-item>
          </el-descriptions>

          <div class="section-title">结构化需求</div>
          <template v-if="selectedDetail.structuredData">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="分类">{{ selectedDetail.structuredData.category || '-' }}</el-descriptions-item>
              <el-descriptions-item label="审批标题">{{ selectedDetail.structuredData.approvalTitle || '-' }}</el-descriptions-item>
              <el-descriptions-item label="审批编号">{{ selectedDetail.structuredData.approvalCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="需求名称">{{ selectedDetail.structuredData.requirementName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="所在部门">{{ selectedDetail.structuredData.department || '-' }}</el-descriptions-item>
              <el-descriptions-item label="业务线">{{ selectedDetail.structuredData.businessLine || '-' }}</el-descriptions-item>
              <el-descriptions-item label="预估工时">{{ selectedDetail.structuredData.estimatedEffort || '-' }}</el-descriptions-item>
              <el-descriptions-item label="预估完成时间">{{ selectedDetail.structuredData.plannedDueDate || '-' }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{ selectedDetail.structuredData.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="需求简介" :span="2">
                {{ selectedDetail.structuredData.requirementSummary || '-' }}
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
                  <el-button link type="primary" @click="handleDownload(row)">下载</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <el-empty v-else description="没有附件" />

          <div class="section-title">AI 草稿</div>
          <template v-if="selectedDetail.aiDraft">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="Provider">
                {{ selectedDetail.aiDraft.provider || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="Model">
                {{ selectedDetail.aiDraft.model || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="标题建议">
                {{ selectedDetail.aiDraft.titleSuggestion || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="类型建议">
                {{ selectedDetail.aiDraft.typeSuggestion || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="优先级建议">
                {{ selectedDetail.aiDraft.prioritySuggestion || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="项目建议">
                {{ selectedDetail.aiDraft.suggestedProjectCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="描述建议">
                {{ selectedDetail.aiDraft.descriptionSuggestion || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="验收建议">
                {{ selectedDetail.aiDraft.acceptanceCriteriaSuggestion || '-' }}
              </el-descriptions-item>
            </el-descriptions>
            <div class="field-table-wrap">
              <div class="subsection-title">任务拆解建议</div>
              <template v-if="selectedDetail.aiDraft.taskBreakdownSuggestions.length">
                <el-table :data="selectedDetail.aiDraft.taskBreakdownSuggestions" size="small" border>
                  <el-table-column prop="taskName" label="任务项" min-width="220" />
                  <el-table-column prop="estimatedEffort" label="工时" width="100" />
                  <el-table-column prop="ownerUserName" label="开发负责人" width="140" />
                  <el-table-column prop="status" label="状态" width="110" />
                  <el-table-column prop="notes" label="说明" min-width="220" />
                </el-table>
              </template>
              <el-empty v-else description="还没有任务拆解建议" />
            </div>
          </template>
          <el-empty v-else description="还没有 AI 草稿" />
        </template>
      </template>
    </el-skeleton>
  </el-drawer>

  <el-dialog v-model="convertDialogVisible" title="转正式工作项" width="860px">
    <el-form label-position="top">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="归属项目">
            <el-select v-model="convertForm.projectId" style="width: 100%">
              <el-option
                v-for="project in projectOptions"
                :key="project.value"
                :label="project.label"
                :value="project.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="类型">
            <el-select v-model="convertForm.type" style="width: 100%">
              <el-option label="需求" value="需求" />
              <el-option label="缺陷" value="缺陷" />
              <el-option label="运维" value="运维" />
              <el-option label="任务" value="任务" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="负责人">
            <el-input v-model="convertForm.ownerUserName" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="跟进人">
            <el-input v-model="convertForm.followerUserName" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="优先级">
            <el-select v-model="convertForm.priority" style="width: 100%">
              <el-option label="P1" value="P1" />
              <el-option label="P2" value="P2" />
              <el-option label="P3" value="P3" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="提出人">
            <el-input v-model="convertForm.proposerName" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="计划完成时间">
            <el-input v-model="convertForm.plannedEndAt" placeholder="YYYY-MM-DDTHH:mm:ss" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="标题">
        <el-input v-model="convertForm.title" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="convertForm.description" type="textarea" :rows="5" />
      </el-form-item>
      <el-form-item label="验收标准">
        <el-input v-model="convertForm.acceptanceCriteria" type="textarea" :rows="4" />
      </el-form-item>

      <div class="section-title">将写入工作项跟踪的 AI 拆解建议</div>
      <template v-if="convertTaskBreakdown.length">
        <el-table :data="convertTaskBreakdown" size="small" border>
          <el-table-column prop="taskName" label="任务项" min-width="220" />
          <el-table-column prop="estimatedEffort" label="工时" width="100" />
          <el-table-column prop="ownerUserName" label="开发负责人" width="140" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column prop="notes" label="说明" min-width="220" />
        </el-table>
      </template>
      <el-empty v-else description="本次没有 AI 拆解建议" />
    </el-form>

    <template #footer>
      <el-button @click="convertDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitConvert">确认转正式工作项</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
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

.raw-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
}

.file-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--el-text-color-secondary);
}
</style>
