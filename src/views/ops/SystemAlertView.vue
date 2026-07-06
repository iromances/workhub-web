<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createSystemAlertSubsystem,
  deleteSystemAlertSubsystem,
  fetchSystemAlertDashboard,
  fetchSystemAlertSubsystems,
  updateSystemAlertSubsystem,
} from '@/api/ops'
import { fetchProjectGroups } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type {
  SystemAlertDashboard,
  SystemAlertEvent,
  SystemAlertSubsystem,
  SystemAlertSubsystemSaveRequest,
} from '@/types/ops'
import type { ProjectGroup } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const subsystemLoading = ref(false)
const submitting = ref(false)
const drawerVisible = ref(false)
const editingId = ref<number | null>(null)
const businessLines = ref<ProjectGroup[]>([])
const dashboard = ref<SystemAlertDashboard>({
  totalCount: 0,
  page: 1,
  pageSize: 20,
  subsystems: [],
  summaries: [],
  events: [],
})
const subsystems = ref<SystemAlertSubsystem[]>([])

const environmentOptions = [
  { label: '开发', value: 'dev' },
  { label: '测试', value: 'test' },
  { label: '准生产', value: 'staging' },
  { label: '生产', value: 'prod' },
]

const levelOptions = ['ERROR', 'WARN', 'INFO']

const filters = reactive({
  businessLineCode: '',
  environmentCode: 'prod',
  serviceName: '',
  level: 'ERROR',
  timeRange: defaultTimeRange(),
  page: 1,
  pageSize: 20,
})

const form = reactive<SystemAlertSubsystemSaveRequest>({
  businessLineCode: '',
  environmentCode: 'prod',
  subsystemName: '',
  serviceName: '',
  enabled: true,
  remark: '',
})

const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))
const serviceOptions = computed(() => {
  const options = new Map<string, SystemAlertSubsystem>()
  for (const item of dashboard.value.subsystems) {
    options.set(item.serviceName, item)
  }
  for (const item of subsystems.value) {
    options.set(item.serviceName, item)
  }
  return Array.from(options.values())
})
const canCreate = computed(() => authStore.hasAnyPermission(['ops:system-alert:create', 'ops:system-alert:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['ops:system-alert:update', 'ops:system-alert:manage']))
const canDelete = computed(() => authStore.hasAnyPermission(['ops:system-alert:delete', 'ops:system-alert:manage']))

function defaultTimeRange(): [string, string] {
  const end = new Date()
  const start = new Date(end.getTime() - 60 * 60 * 1000)
  return [formatDateTime(start), formatDateTime(end)]
}

function formatDateTime(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function readableTime(value?: string | null) {
  return value ? value.replace('T', ' ') : '-'
}

function levelTag(level: string) {
  if (level === 'ERROR') {
    return 'danger'
  }
  if (level === 'WARN') {
    return 'warning'
  }
  return 'info'
}

async function loadBusinessLines() {
  try {
    businessLines.value = await fetchProjectGroups()
  } catch (error) {
    ElMessage.error('加载业务线失败')
    console.error(error)
  }
}

async function loadSubsystems() {
  subsystemLoading.value = true
  try {
    subsystems.value = await fetchSystemAlertSubsystems({
      businessLineCode: filters.businessLineCode || undefined,
      environmentCode: filters.environmentCode || undefined,
      enabledOnly: false,
    })
  } catch (error) {
    ElMessage.error('加载关注子系统失败')
    console.error(error)
  } finally {
    subsystemLoading.value = false
  }
}

async function loadDashboard() {
  loading.value = true
  try {
    dashboard.value = await fetchSystemAlertDashboard({
      businessLineCode: filters.businessLineCode || undefined,
      environmentCode: filters.environmentCode || undefined,
      serviceName: filters.serviceName || undefined,
      level: filters.level || undefined,
      startTime: filters.timeRange?.[0],
      endTime: filters.timeRange?.[1],
      page: filters.page,
      pageSize: filters.pageSize,
    })
    await loadSubsystems()
  } catch (error) {
    ElMessage.error('加载系统预警失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.businessLineCode = filters.businessLineCode || ''
  form.environmentCode = filters.environmentCode || 'prod'
  form.subsystemName = ''
  form.serviceName = ''
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  drawerVisible.value = true
}

function openEdit(row: SystemAlertSubsystem) {
  editingId.value = row.id
  form.businessLineCode = row.businessLineCode
  form.environmentCode = row.environmentCode
  form.subsystemName = row.subsystemName
  form.serviceName = row.serviceName
  form.enabled = row.enabled
  form.remark = row.remark || ''
  drawerVisible.value = true
}

function validateForm() {
  if (!form.businessLineCode.trim() || !form.environmentCode.trim()) {
    ElMessage.warning('请选择业务线和环境')
    return false
  }
  if (!form.subsystemName.trim() || !form.serviceName.trim()) {
    ElMessage.warning('请填写子系统名称和服务名')
    return false
  }
  return true
}

function requestFromForm(): SystemAlertSubsystemSaveRequest {
  return {
    businessLineCode: form.businessLineCode.trim(),
    environmentCode: form.environmentCode.trim(),
    subsystemName: form.subsystemName.trim(),
    serviceName: form.serviceName.trim(),
    enabled: form.enabled,
    remark: form.remark?.trim() || undefined,
  }
}

async function submit() {
  if (!validateForm()) {
    return
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await updateSystemAlertSubsystem(editingId.value, requestFromForm())
      ElMessage.success('关注子系统已保存')
    } else {
      await createSystemAlertSubsystem(requestFromForm())
      ElMessage.success('关注子系统已新增')
    }
    drawerVisible.value = false
    await loadDashboard()
  } catch (error) {
    ElMessage.error('保存关注子系统失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function remove(row: SystemAlertSubsystem) {
  await ElMessageBox.confirm(`确认删除关注子系统「${row.subsystemName}」？`, '删除确认', { type: 'warning' })
  try {
    await deleteSystemAlertSubsystem(row.id)
    ElMessage.success('关注子系统已删除')
    await loadDashboard()
  } catch (error) {
    ElMessage.error('删除关注子系统失败')
    console.error(error)
  }
}

function handlePageChange(page: number) {
  filters.page = page
  void loadDashboard()
}

function eventMessage(row: SystemAlertEvent) {
  return row.message || row.title || row.errorType || '-'
}

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadDashboard()])
})
</script>

<template>
  <div class="page-card system-alert-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统预警</h1>
        <p class="page-desc">查询本地错误事件表，关注子系统在本菜单独立维护；ELK 同步接入后只负责补充本地事件数据。</p>
      </div>
      <div class="header-buttons">
        <el-button @click="loadDashboard">刷新</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">新增关注子系统</el-button>
      </div>
    </div>

    <el-form inline class="filter-form" @submit.prevent="loadDashboard">
      <el-form-item label="业务线">
        <el-select v-model="filters.businessLineCode" placeholder="全部业务线" clearable filterable style="width: 220px">
          <el-option
            v-for="line in businessLineOptions"
            :key="line.id"
            :label="line.businessLineName"
            :value="line.businessLineCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="环境">
        <el-select v-model="filters.environmentCode" clearable placeholder="全部环境" style="width: 140px">
          <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="子系统">
        <el-select v-model="filters.serviceName" clearable filterable placeholder="全部子系统" style="width: 220px">
          <el-option
            v-for="item in serviceOptions"
            :key="item.serviceName"
            :label="`${item.subsystemName} / ${item.serviceName}`"
            :value="item.serviceName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="级别">
        <el-select v-model="filters.level" style="width: 120px">
          <el-option v-for="item in levelOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间">
        <el-date-picker
          v-model="filters.timeRange"
          type="datetimerange"
          value-format="YYYY-MM-DDTHH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 360px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDashboard">查询</el-button>
      </el-form-item>
    </el-form>

    <div class="metric-row">
      <div class="metric-tile">
        <span class="metric-label">本地错误事件</span>
        <strong>{{ dashboard.totalCount }}</strong>
      </div>
      <div class="metric-tile">
        <span class="metric-label">关注子系统</span>
        <strong>{{ dashboard.subsystems.length }}</strong>
      </div>
      <div class="metric-tile">
        <span class="metric-label">命中子系统</span>
        <strong>{{ dashboard.summaries.length }}</strong>
      </div>
    </div>

    <el-table v-loading="loading" :data="dashboard.summaries" class="summary-table">
      <el-table-column prop="businessLineCode" label="业务线" width="140" />
      <el-table-column prop="environmentCode" label="环境" width="90" />
      <el-table-column prop="subsystemName" label="子系统" min-width="150" show-overflow-tooltip />
      <el-table-column prop="serviceName" label="服务名" min-width="160" show-overflow-tooltip />
      <el-table-column label="错误数" width="100">
        <template #default="{ row }">
          <el-tag :type="row.errorCount > 0 ? 'danger' : 'success'">{{ row.errorCount }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近发生时间" width="180">
        <template #default="{ row }">{{ readableTime(row.latestOccurredAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="section-title">最近错误事件</div>
    <el-table v-loading="loading" :data="dashboard.events" row-key="id">
      <el-table-column prop="occurredAt" label="发生时间" width="180">
        <template #default="{ row }">{{ readableTime(row.occurredAt) }}</template>
      </el-table-column>
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="levelTag(row.level)">{{ row.level }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="subsystemName" label="子系统" width="140" show-overflow-tooltip />
      <el-table-column prop="serviceName" label="服务名" width="160" show-overflow-tooltip />
      <el-table-column prop="errorType" label="异常类型" min-width="180" show-overflow-tooltip />
      <el-table-column label="错误消息" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ eventMessage(row) }}</template>
      </el-table-column>
      <el-table-column prop="traceId" label="Trace ID" width="160" show-overflow-tooltip />
      <el-table-column prop="sourceType" label="来源" width="90" />
    </el-table>

    <div class="pager-row">
      <el-pagination
        layout="prev, pager, next, sizes, total"
        :total="dashboard.totalCount"
        :current-page="filters.page"
        :page-size="filters.pageSize"
        :page-sizes="[20, 50, 100]"
        @current-change="handlePageChange"
        @size-change="(size: number) => { filters.pageSize = size; filters.page = 1; loadDashboard() }"
      />
    </div>

    <div class="section-title">关注子系统</div>
    <el-table v-loading="subsystemLoading" :data="subsystems" row-key="id">
      <el-table-column prop="businessLineCode" label="业务线" width="140" />
      <el-table-column prop="environmentCode" label="环境" width="90" />
      <el-table-column prop="subsystemName" label="子系统名称" min-width="150" />
      <el-table-column prop="serviceName" label="服务名" min-width="160" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="canDelete" link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="drawerVisible" :title="editingId ? '编辑关注子系统' : '新增关注子系统'" size="520px">
    <el-form label-position="top" class="drawer-form">
      <el-form-item label="业务线" required>
        <el-select v-model="form.businessLineCode" filterable style="width: 100%">
          <el-option
            v-for="line in businessLineOptions"
            :key="line.id"
            :label="line.businessLineName"
            :value="line.businessLineCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="环境" required>
        <el-select v-model="form.environmentCode" style="width: 100%">
          <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="子系统名称" required>
        <el-input v-model="form.subsystemName" placeholder="资产支付" />
      </el-form-item>
      <el-form-item label="服务名" required>
        <el-input v-model="form.serviceName" placeholder="asset-payment" />
      </el-form-item>
      <el-form-item label="是否启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.system-alert-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.header-buttons,
.pager-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-tile {
  display: flex;
  min-height: 72px;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #fff;
}

.metric-label {
  color: #64748b;
  font-size: 13px;
}

.metric-tile strong {
  margin-top: 6px;
  color: #0f172a;
  font-size: 28px;
}

.section-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.summary-table {
  margin-top: -4px;
}

@media (max-width: 900px) {
  .metric-row {
    grid-template-columns: 1fr;
  }
}
</style>
