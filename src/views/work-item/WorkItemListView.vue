<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import { fetchProjects } from '@/api/project'
import {
  addWorkItemFollowUp,
  assignWorkItem,
  createWorkItem,
  fetchWorkItemDetail,
  fetchWorkItemFollowUps,
  fetchWorkItemTransitions,
  fetchWorkItems,
  transitionWorkItem,
  updateWorkItem,
} from '@/api/work-item'
import type { ProjectSummary, WorkItemDetail, WorkItemFollowUp, WorkItemSummary, WorkItemTransition } from '@/types/work-item'

const loading = ref(false)
const detailLoading = ref(false)
const workItems = ref<WorkItemSummary[]>([])
const projects = ref<ProjectSummary[]>([])
const detailVisible = ref(false)
const editVisible = ref(false)
const createVisible = ref(false)
const assignVisible = ref(false)
const transitionVisible = ref(false)
const selectedDetail = ref<WorkItemDetail | null>(null)
const selectedFollowUps = ref<WorkItemFollowUp[]>([])
const selectedTransitions = ref<WorkItemTransition[]>([])
const editingId = ref<number | null>(null)
const assigningId = ref<number | null>(null)
const transitioningId = ref<number | null>(null)
const editSubmitting = ref(false)
const createSubmitting = ref(false)
const assignSubmitting = ref(false)
const followUpSubmitting = ref(false)
const transitionSubmitting = ref(false)
const activeDetailTab = ref('basic')
const activeTransitionOptions = ref<string[]>([])

const filters = reactive({
  keyword: '',
  type: '',
  status: '',
})

const createForm = reactive({
  projectId: null as number | null,
  type: '任务',
  title: '',
  description: '',
  sourceType: '人工创建',
  sourceChannel: '工作项页面',
  priority: '3',
  urgency: '',
  ownerUserName: '',
  followerUserName: '',
  proposerName: '',
  acceptanceCriteria: '',
})

const editForm = reactive({
  title: '',
  description: '',
  priority: '',
  urgency: '',
  proposerName: '',
  acceptanceCriteria: '',
})

const assignForm = reactive({
  ownerUserName: '',
  followerUserName: '',
  reason: '',
})

const followUpForm = reactive({
  content: '',
})

const transitionForm = reactive({
  toStatus: '',
  reason: '',
})

const transitionOptions = computed(() => resolveTransitionOptions(selectedDetail.value?.status))

function trimValue(value: string | null | undefined) {
  return value?.trim() || ''
}

function optionalValue(value: string | null | undefined) {
  const trimmed = trimValue(value)
  return trimmed || undefined
}

function resolveProjectName(projectId: number | null) {
  return projects.value.find((item) => item.id === projectId)?.name || ''
}

function resolveTransitionOptions(status: string | null | undefined) {
  switch (status) {
    case '待澄清':
      return ['待评估', '已拒绝', '已挂起']
    case '待评估':
      return ['待排期', '已拒绝', '已挂起']
    case '待排期':
      return ['开发中', '已拒绝', '已挂起']
    case '开发中':
      return ['测试中', '已拒绝', '已挂起']
    case '测试中':
      return ['待发布', '已拒绝', '已挂起']
    case '待发布':
      return ['已完成', '已拒绝', '已挂起']
    default:
      return []
  }
}

function requiresTransitionReason(status: string) {
  return ['已完成', '已拒绝', '已挂起'].includes(status)
}

async function loadProjects() {
  try {
    projects.value = await fetchProjects()
  } catch (error) {
    ElMessage.error('加载项目列表失败')
    console.error(error)
  }
}

async function loadWorkItems() {
  loading.value = true
  try {
    workItems.value = await fetchWorkItems({
      keyword: filters.keyword || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined,
    })
  } catch (error) {
    ElMessage.error('加载工作项列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadDetailContext(id: number) {
  const [detail, followUps, transitions] = await Promise.all([
    fetchWorkItemDetail(id),
    fetchWorkItemFollowUps(id),
    fetchWorkItemTransitions(id),
  ])
  selectedDetail.value = detail
  selectedFollowUps.value = followUps
  selectedTransitions.value = transitions
}

async function showDetail(id: number) {
  detailLoading.value = true
  detailVisible.value = true
  activeDetailTab.value = 'basic'
  try {
    await loadDetailContext(id)
  } catch (error) {
    ElMessage.error('加载工作项详情失败')
    detailVisible.value = false
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

function resetCreateForm() {
  Object.assign(createForm, {
    projectId: null,
    type: '任务',
    title: '',
    description: '',
    sourceType: '人工创建',
    sourceChannel: '工作项页面',
    priority: '3',
    urgency: '',
    ownerUserName: '',
    followerUserName: '',
    proposerName: '',
    acceptanceCriteria: '',
  })
}

function openCreate() {
  resetCreateForm()
  createVisible.value = true
}

async function submitCreate() {
  if (!createForm.projectId) {
    ElMessage.warning('请选择项目')
    return
  }
  if (!trimValue(createForm.title)) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!trimValue(createForm.ownerUserName) || !trimValue(createForm.followerUserName)) {
    ElMessage.warning('请填写负责人和跟进人')
    return
  }
  createSubmitting.value = true
  try {
    const detail = await createWorkItem({
      projectId: createForm.projectId,
      type: createForm.type,
      title: trimValue(createForm.title),
      description: optionalValue(createForm.description),
      sourceType: trimValue(createForm.sourceType),
      sourceChannel: trimValue(createForm.sourceChannel),
      priority: createForm.priority,
      urgency: optionalValue(createForm.urgency),
      ownerUserName: trimValue(createForm.ownerUserName),
      followerUserName: trimValue(createForm.followerUserName),
      proposerName: optionalValue(createForm.proposerName),
      acceptanceCriteria: optionalValue(createForm.acceptanceCriteria),
    })
    ElMessage.success('工作项已创建')
    createVisible.value = false
    await loadWorkItems()
    await showDetail(detail.id)
  } catch (error) {
    ElMessage.error('创建工作项失败')
    console.error(error)
  } finally {
    createSubmitting.value = false
  }
}

async function openEdit(id: number) {
  try {
    const detail = await fetchWorkItemDetail(id)
    editingId.value = id
    editForm.title = detail.title
    editForm.description = detail.description || ''
    editForm.priority = detail.priority
    editForm.urgency = detail.urgency || ''
    editForm.proposerName = detail.proposerName || ''
    editForm.acceptanceCriteria = detail.acceptanceCriteria || ''
    editVisible.value = true
  } catch (error) {
    ElMessage.error('加载工作项编辑数据失败')
    console.error(error)
  }
}

async function submitEdit() {
  if (!editingId.value || !trimValue(editForm.title) || !trimValue(editForm.priority)) {
    ElMessage.warning('请填写标题和优先级')
    return
  }
  editSubmitting.value = true
  try {
    await updateWorkItem(editingId.value, {
      title: trimValue(editForm.title),
      description: optionalValue(editForm.description),
      priority: trimValue(editForm.priority),
      urgency: optionalValue(editForm.urgency),
      proposerName: optionalValue(editForm.proposerName),
      acceptanceCriteria: optionalValue(editForm.acceptanceCriteria),
    })
    ElMessage.success('工作项已保存')
    editVisible.value = false
    await loadWorkItems()
    if (selectedDetail.value?.id === editingId.value) {
      await loadDetailContext(editingId.value)
    }
  } catch (error) {
    ElMessage.error('保存工作项失败')
    console.error(error)
  } finally {
    editSubmitting.value = false
  }
}

function openAssign(detail: WorkItemDetail) {
  assigningId.value = detail.id
  assignForm.ownerUserName = detail.ownerUserName
  assignForm.followerUserName = detail.followerUserName
  assignForm.reason = ''
  assignVisible.value = true
}

async function submitAssign() {
  if (!assigningId.value || !trimValue(assignForm.ownerUserName) || !trimValue(assignForm.followerUserName)) {
    ElMessage.warning('请填写负责人和跟进人')
    return
  }
  assignSubmitting.value = true
  try {
    await assignWorkItem(assigningId.value, {
      ownerUserName: trimValue(assignForm.ownerUserName),
      followerUserName: trimValue(assignForm.followerUserName),
      reason: optionalValue(assignForm.reason),
    })
    ElMessage.success('指派已更新')
    assignVisible.value = false
    await loadWorkItems()
    await loadDetailContext(assigningId.value)
  } catch (error) {
    ElMessage.error('更新指派失败')
    console.error(error)
  } finally {
    assignSubmitting.value = false
  }
}

async function submitFollowUp() {
  if (!selectedDetail.value || !trimValue(followUpForm.content)) {
    ElMessage.warning('请填写跟踪记录')
    return
  }
  followUpSubmitting.value = true
  try {
    await addWorkItemFollowUp(selectedDetail.value.id, { content: trimValue(followUpForm.content) })
    followUpForm.content = ''
    selectedFollowUps.value = await fetchWorkItemFollowUps(selectedDetail.value.id)
    ElMessage.success('跟踪记录已添加')
  } catch (error) {
    ElMessage.error('添加跟踪记录失败')
    console.error(error)
  } finally {
    followUpSubmitting.value = false
  }
}

function openTransition(detail: Pick<WorkItemDetail, 'id' | 'status'>) {
  const options = resolveTransitionOptions(detail.status)
  if (!options.length) {
    ElMessage.warning('当前状态没有可执行流转')
    return
  }
  transitioningId.value = detail.id
  activeTransitionOptions.value = options
  transitionForm.toStatus = options[0]
  transitionForm.reason = ''
  transitionVisible.value = true
}

async function submitTransition() {
  if (!transitioningId.value || !transitionForm.toStatus) {
    return
  }
  if (requiresTransitionReason(transitionForm.toStatus) && !trimValue(transitionForm.reason)) {
    ElMessage.warning('终态流转必须填写结论说明')
    return
  }
  transitionSubmitting.value = true
  try {
    await transitionWorkItem(transitioningId.value, {
      toStatus: transitionForm.toStatus,
      reason: optionalValue(transitionForm.reason),
    })
    ElMessage.success('状态已流转')
    transitionVisible.value = false
    await loadWorkItems()
    await loadDetailContext(transitioningId.value)
  } catch (error) {
    ElMessage.error('状态流转失败')
    console.error(error)
  } finally {
    transitionSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadProjects(), loadWorkItems()])
})
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">工作项</h1>
        <p class="page-desc">需求、缺陷、运维、任务统一在一个模型中流转。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建工作项</el-button>
    </div>

    <el-form inline @submit.prevent="loadWorkItems">
      <el-form-item label="关键字">
        <el-input
          v-model="filters.keyword"
          placeholder="标题 / 编号"
          clearable
          @keyup.enter="loadWorkItems"
        />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 140px">
          <el-option label="需求" value="需求" />
          <el-option label="缺陷" value="缺陷" />
          <el-option label="运维" value="运维" />
          <el-option label="任务" value="任务" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 160px">
          <el-option label="待澄清" value="待澄清" />
          <el-option label="待评估" value="待评估" />
          <el-option label="待排期" value="待排期" />
          <el-option label="开发中" value="开发中" />
          <el-option label="测试中" value="测试中" />
          <el-option label="待发布" value="待发布" />
          <el-option label="已完成" value="已完成" />
          <el-option label="已拒绝" value="已拒绝" />
          <el-option label="已挂起" value="已挂起" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadWorkItems">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="workItems">
      <el-table-column prop="no" label="编号" width="220" />
      <el-table-column prop="title" label="标题" min-width="320" />
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="projectName" label="项目" width="180" />
      <el-table-column prop="ownerUserName" label="负责人" width="120" />
      <el-table-column prop="priority" label="优先级" width="90" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row.id)">详情</el-button>
          <el-button link type="primary" @click="openEdit(row.id)">编辑</el-button>
          <el-button link type="primary" @click="openTransition(row)">流转</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="detailVisible" title="工作项详情" size="720px">
    <el-skeleton :loading="detailLoading" animated>
      <template #template>
        <el-skeleton-item variant="h3" style="width: 60%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" />
        <el-skeleton-item variant="text" />
      </template>

      <template #default>
        <template v-if="selectedDetail">
          <div class="detail-actions">
            <el-button type="primary" plain @click="openAssign(selectedDetail)">指派</el-button>
            <el-button type="primary" :disabled="!transitionOptions.length" @click="openTransition(selectedDetail)">状态流转</el-button>
          </div>

          <el-tabs v-model="activeDetailTab">
            <el-tab-pane label="基本信息" name="basic">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="编号">{{ selectedDetail.no }}</el-descriptions-item>
                <el-descriptions-item label="标题">{{ selectedDetail.title }}</el-descriptions-item>
                <el-descriptions-item label="项目">{{ selectedDetail.projectName }}</el-descriptions-item>
                <el-descriptions-item label="类型">{{ selectedDetail.type }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ selectedDetail.status }}</el-descriptions-item>
                <el-descriptions-item label="负责人">{{ selectedDetail.ownerUserName }}</el-descriptions-item>
                <el-descriptions-item label="跟进人">{{ selectedDetail.followerUserName }}</el-descriptions-item>
                <el-descriptions-item label="优先级">{{ selectedDetail.priority }}</el-descriptions-item>
                <el-descriptions-item label="描述">{{ selectedDetail.description || '-' }}</el-descriptions-item>
                <el-descriptions-item label="验收标准">
                  {{ selectedDetail.acceptanceCriteria || '-' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>

            <el-tab-pane label="跟踪记录" name="follow-ups">
              <el-form label-position="top" class="follow-up-form">
                <el-form-item label="新增跟踪记录">
                  <el-input v-model="followUpForm.content" type="textarea" :rows="3" />
                </el-form-item>
                <el-button type="primary" :loading="followUpSubmitting" @click="submitFollowUp">添加记录</el-button>
              </el-form>

              <div v-if="selectedFollowUps.length" class="follow-up-list">
                <div v-for="item in selectedFollowUps" :key="item.id" class="follow-up-card">
                  <div class="follow-up-meta">{{ item.createdAt }} · {{ item.operatorUserName }}</div>
                  <pre class="follow-up-content">{{ item.content }}</pre>
                </div>
              </div>
              <el-empty v-else description="还没有跟踪记录" />
            </el-tab-pane>

            <el-tab-pane label="流转记录" name="transitions">
              <el-table v-if="selectedTransitions.length" :data="selectedTransitions" size="small" border>
                <el-table-column prop="createdAt" label="时间" width="180" />
                <el-table-column prop="fromStatus" label="原状态" width="120" />
                <el-table-column prop="toStatus" label="目标状态" width="120" />
                <el-table-column prop="operatorUserName" label="操作人" width="120" />
                <el-table-column prop="reason" label="说明" min-width="220" />
              </el-table>
              <el-empty v-else description="还没有流转记录" />
            </el-tab-pane>
          </el-tabs>
        </template>
      </template>
    </el-skeleton>
  </el-drawer>

  <el-dialog v-model="createVisible" title="新建工作项" width="640px">
    <el-form label-position="top">
      <el-form-item label="项目">
        <el-select v-model="createForm.projectId" filterable style="width: 100%">
          <el-option
            v-for="project in projects"
            :key="project.id"
            :label="`${project.name} / ${project.group}`"
            :value="project.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="createForm.type" style="width: 100%">
          <el-option label="需求" value="需求" />
          <el-option label="缺陷" value="缺陷" />
          <el-option label="运维" value="运维" />
          <el-option label="任务" value="任务" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题">
        <el-input v-model="createForm.title" />
      </el-form-item>
      <el-form-item label="优先级">
        <el-select v-model="createForm.priority" style="width: 100%">
          <el-option label="1" value="1" />
          <el-option label="2" value="2" />
          <el-option label="3" value="3" />
          <el-option label="4" value="4" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="createForm.ownerUserName" />
      </el-form-item>
      <el-form-item label="跟进人">
        <el-input v-model="createForm.followerUserName" />
      </el-form-item>
      <el-form-item label="来源">
        <el-input v-model="createForm.sourceType">
          <template #append>{{ createForm.sourceChannel }}</template>
        </el-input>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="createForm.description" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item label="验收标准">
        <el-input v-model="createForm.acceptanceCriteria" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-hint">{{ createForm.projectId ? resolveProjectName(createForm.projectId) : '未选择项目' }}</span>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="submitCreate">创建</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="editVisible" title="编辑工作项" width="640px">
    <el-form label-position="top">
      <el-form-item label="标题">
        <el-input v-model="editForm.title" />
      </el-form-item>
      <el-form-item label="优先级">
        <el-select v-model="editForm.priority" style="width: 100%">
          <el-option label="1" value="1" />
          <el-option label="2" value="2" />
          <el-option label="3" value="3" />
          <el-option label="4" value="4" />
        </el-select>
      </el-form-item>
      <el-form-item label="紧急程度">
        <el-input v-model="editForm.urgency" />
      </el-form-item>
      <el-form-item label="提出人">
        <el-input v-model="editForm.proposerName" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editForm.description" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item label="验收标准">
        <el-input v-model="editForm.acceptanceCriteria" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="assignVisible" title="指派工作项" width="520px">
    <el-form label-position="top">
      <el-form-item label="负责人">
        <el-input v-model="assignForm.ownerUserName" />
      </el-form-item>
      <el-form-item label="跟进人">
        <el-input v-model="assignForm.followerUserName" />
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="assignForm.reason" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="assignVisible = false">取消</el-button>
      <el-button type="primary" :loading="assignSubmitting" @click="submitAssign">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="transitionVisible" title="状态流转" width="520px">
    <el-form label-position="top">
      <el-form-item label="目标状态">
        <el-select v-model="transitionForm.toStatus" style="width: 100%">
          <el-option
            v-for="status in activeTransitionOptions"
            :key="status"
            :label="status"
            :value="status"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="transitionForm.reason" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="transitionVisible = false">取消</el-button>
      <el-button type="primary" :loading="transitionSubmitting" @click="submitTransition">确认流转</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.follow-up-form {
  margin-bottom: 16px;
}

.follow-up-list {
  display: grid;
  gap: 12px;
}

.follow-up-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-blank);
}

.follow-up-meta {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.follow-up-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
}

.dialog-hint {
  float: left;
  color: var(--el-text-color-secondary);
  line-height: 32px;
}
</style>
