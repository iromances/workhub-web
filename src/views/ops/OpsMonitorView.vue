<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createOpsMonitor,
  deleteOpsMonitor,
  fetchXxlJobLogs,
  fetchOpsMonitors,
  updateOpsMonitor,
} from '@/api/ops'
import { fetchProjectGroups } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type { OpsMonitor, OpsMonitorSaveRequest, XxlJobLogPage } from '@/types/ops'
import type { ProjectGroup } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const detailLoading = ref(false)
const drawerVisible = ref(false)
const detailVisible = ref(false)
const editingId = ref<number | null>(null)
const activeTab = ref<'XXL_JOB' | 'MQ'>('XXL_JOB')
const monitors = ref<OpsMonitor[]>([])
const businessLines = ref<ProjectGroup[]>([])
const selectedMonitor = ref<OpsMonitor | null>(null)
const logPage = ref<XxlJobLogPage | null>(null)

const environmentOptions = [
  { label: '开发', value: 'dev' },
  { label: '测试', value: 'test' },
  { label: '准生产', value: 'staging' },
  { label: '生产', value: 'prod' },
]

const filters = reactive({
  businessLineCode: '',
  environmentCode: '',
  enabledOnly: true,
})

const form = reactive<OpsMonitorSaveRequest>({
  monitorType: 'XXL_JOB',
  businessLineCode: '',
  environmentCode: 'prod',
  xxlJobDatabaseName: '',
  enabled: true,
  remark: '',
})

const logFilters = reactive({
  dateRange: [] as string[],
  author: '',
  executorAppName: '',
  logStatus: 'ALL' as 'ALL' | 'FAILED',
  page: 1,
  pageSize: 20,
})

const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))
const executionLogs = computed(() => logPage.value?.logs || [])
const canCreate = computed(() => authStore.hasAnyPermission(['ops:monitor:create', 'ops:monitor:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['ops:monitor:update', 'ops:monitor:manage']))
const canDelete = computed(() => authStore.hasAnyPermission(['ops:monitor:delete', 'ops:monitor:manage']))

async function loadBusinessLines() {
  try {
    businessLines.value = await fetchProjectGroups()
  } catch (error) {
    ElMessage.error('加载业务线失败')
    console.error(error)
  }
}

async function loadMonitors() {
  monitors.value = await fetchOpsMonitors({
    monitorType: 'XXL_JOB',
    businessLineCode: filters.businessLineCode || undefined,
    environmentCode: filters.environmentCode || undefined,
    enabledOnly: false,
  })
}

async function loadDashboard() {
  loading.value = true
  try {
    await loadMonitors()
  } catch (error) {
    ElMessage.error('加载 XXL-JOB 监测配置失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.monitorType = 'XXL_JOB'
  form.monitorKey = undefined
  form.businessLineCode = ''
  form.environmentCode = 'prod'
  form.name = undefined
  form.adminBaseUrl = undefined
  form.username = undefined
  form.password = undefined
  form.xxlJobDatabaseName = ''
  form.executorAppName = undefined
  form.jobHandler = undefined
  form.jobDesc = undefined
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  drawerVisible.value = true
}

function openEdit(row: OpsMonitor) {
  editingId.value = row.id
  form.monitorType = 'XXL_JOB'
  form.monitorKey = row.monitorKey
  form.businessLineCode = row.businessLineCode
  form.environmentCode = row.environmentCode
  form.name = row.name
  form.xxlJobDatabaseName = row.xxlJobDatabaseName || ''
  form.executorAppName = row.executorAppName || undefined
  form.enabled = row.enabled
  form.remark = row.remark || ''
  drawerVisible.value = true
}

function validateForm() {
  if (!form.businessLineCode.trim() || !form.environmentCode.trim()) {
    ElMessage.warning('请选择业务线和环境')
    return false
  }
  if (!form.xxlJobDatabaseName?.trim()) {
    ElMessage.warning('请填写 XXL-JOB 数据库名')
    return false
  }
  return true
}

function requestFromForm(): OpsMonitorSaveRequest {
  return {
    monitorType: 'XXL_JOB',
    monitorKey: form.monitorKey,
    businessLineCode: form.businessLineCode.trim(),
    environmentCode: form.environmentCode.trim(),
    name: form.name,
    xxlJobDatabaseName: form.xxlJobDatabaseName?.trim(),
    executorAppName: form.executorAppName?.trim() || undefined,
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
    const request = requestFromForm()
    if (editingId.value) {
      await updateOpsMonitor(editingId.value, request)
    } else {
      await createOpsMonitor(request)
    }
    ElMessage.success('监测配置已保存')
    drawerVisible.value = false
    await loadDashboard()
  } catch (error) {
    ElMessage.error('保存监测配置失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function remove(row: OpsMonitor) {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name}？`, '删除监测配置', { type: 'warning' })
    await deleteOpsMonitor(row.id)
    ElMessage.success('监测配置已删除')
    await loadDashboard()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除监测配置失败')
      console.error(error)
    }
  }
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resetLogFilters() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 7)
  logFilters.dateRange = [formatDate(start), formatDate(end)]
  logFilters.author = ''
  logFilters.executorAppName = ''
  logFilters.logStatus = 'ALL'
  logFilters.page = 1
  logFilters.pageSize = 20
}

async function openDetail(row: OpsMonitor) {
  selectedMonitor.value = row
  logPage.value = null
  resetLogFilters()
  detailVisible.value = true
  await loadLogs()
}

async function loadLogs() {
  if (!selectedMonitor.value) {
    return
  }
  detailLoading.value = true
  try {
    const [startDate, endDate] = logFilters.dateRange
    logPage.value = await fetchXxlJobLogs(selectedMonitor.value.id, {
      startDate,
      endDate,
      page: logFilters.page,
      pageSize: logFilters.pageSize,
      author: logFilters.author.trim() || undefined,
      executorAppName: logFilters.executorAppName.trim() || undefined,
      logStatus: logFilters.logStatus,
    })
  } catch (error) {
    ElMessage.error('加载 XXL-JOB 执行日志失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

async function searchLogs() {
  logFilters.page = 1
  await loadLogs()
}

async function handleLogPageChange(page: number) {
  logFilters.page = page
  await loadLogs()
}

async function handleLogPageSizeChange(pageSize: number) {
  logFilters.pageSize = pageSize
  logFilters.page = 1
  await loadLogs()
}

function statusTag(status: string | null) {
  if (status === 'UP') {
    return 'success'
  }
  if (status === 'WARN') {
    return 'warning'
  }
  if (status === 'ERROR') {
    return 'danger'
  }
  return 'info'
}

function alertType(status: string | null) {
  if (status === 'UP') {
    return 'success'
  }
  if (status === 'WARN') {
    return 'warning'
  }
  if (status === 'ERROR') {
    return 'error'
  }
  return 'info'
}

function executionStatusTag(status: string) {
  if (status === 'SUCCESS') {
    return 'success'
  }
  if (status === 'RUNNING') {
    return 'warning'
  }
  return 'danger'
}

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadDashboard()])
})
</script>

<template>
  <div class="page-card ops-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">业务监测</h1>
        <p class="page-desc">维护本地 XXL-JOB 监测配置，首页不采集远端调度库统计。</p>
      </div>
      <div class="header-buttons">
        <el-button @click="loadDashboard">刷新配置</el-button>
        <el-button v-if="activeTab === 'XXL_JOB' && canCreate" type="primary" @click="openCreate">新增 XXL-JOB 监测</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="ops-tabs">
      <el-tab-pane label="XXL-JOB" name="XXL_JOB">
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
          <el-form-item label="仅启用">
            <el-switch v-model="filters.enabledOnly" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadDashboard">查询</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loading" :data="monitors" row-key="id">
          <el-table-column prop="businessLineCode" label="业务线" width="140" />
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="name" label="监测名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="monitorKey" label="监测 Key" min-width="180" show-overflow-tooltip />
          <el-table-column prop="xxlJobDatabaseName" label="XXL-JOB 库" min-width="150" show-overflow-tooltip />
          <el-table-column prop="executorAppName" label="关注执行器" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.executorAppName || '全部' }}</template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上次状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.lastStatus)">{{ row.lastStatus || '未采集' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastMessage" label="上次消息" min-width="220" show-overflow-tooltip />
          <el-table-column prop="lastCheckedAt" label="上次采集时间" width="180" />
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="MQ 消息" name="MQ">
        <el-empty description="MQ 消息监测采集下一步接入">
          <template #description>
            <div class="empty-copy">菜单入口已预留，后续再配置 Topic、Consumer Group、堆积阈值和真实采集来源。</div>
          </template>
        </el-empty>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-drawer v-model="drawerVisible" :title="editingId ? '编辑 XXL-JOB 监测' : '新增 XXL-JOB 监测'" size="520px">
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
      <el-form-item label="XXL-JOB 数据库名" required>
        <el-input v-model="form.xxlJobDatabaseName" placeholder="amp_xxl_job" />
      </el-form-item>
      <el-form-item label="关注执行器">
        <el-input v-model="form.executorAppName" placeholder="多个执行器用英文逗号分隔，留空表示全部" />
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

  <el-dialog v-model="detailVisible" title="XXL-JOB 执行日志" width="1120px" class="job-log-dialog">
    <div v-if="selectedMonitor" class="detail-summary">
      <div>
        <span class="summary-label">业务线</span>
        <strong>{{ selectedMonitor.businessLineCode }}</strong>
      </div>
      <div>
        <span class="summary-label">环境</span>
        <strong>{{ environmentOptions.find((item) => item.value === selectedMonitor?.environmentCode)?.label || selectedMonitor.environmentCode }}</strong>
      </div>
      <div>
        <span class="summary-label">XXL-JOB 库</span>
        <strong>{{ selectedMonitor.xxlJobDatabaseName }}</strong>
      </div>
      <div>
        <span class="summary-label">配置执行器</span>
        <strong>{{ selectedMonitor.executorAppName || '全部' }}</strong>
      </div>
    </div>

    <el-form inline class="log-filter-form" @submit.prevent="searchLogs">
      <el-form-item label="执行日期">
        <el-date-picker
          v-model="logFilters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="logFilters.logStatus" style="width: 110px">
          <el-option label="全部" value="ALL" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="logFilters.author" clearable placeholder="author" style="width: 130px" />
      </el-form-item>
      <el-form-item label="执行器">
        <el-input v-model="logFilters.executorAppName" clearable placeholder="appName" style="width: 150px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="detailLoading" @click="searchLogs">查询</el-button>
        <el-button :loading="detailLoading" @click="loadLogs">刷新</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="logPage?.message"
      :title="logPage.message"
      :type="alertType(logPage.status)"
      show-icon
      :closable="false"
      class="log-alert"
    />

    <el-table v-loading="detailLoading" :data="executionLogs" row-key="logId" max-height="520" empty-text="暂无执行日志">
      <el-table-column prop="logId" label="日志ID" width="90" />
      <el-table-column prop="jobId" label="任务ID" width="90" />
      <el-table-column prop="jobDesc" label="任务描述" min-width="180" show-overflow-tooltip />
      <el-table-column prop="executorAppName" label="执行器" min-width="160" show-overflow-tooltip />
      <el-table-column prop="executorHandler" label="Handler" min-width="160" show-overflow-tooltip />
      <el-table-column prop="author" label="负责人" width="110" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="executionStatusTag(row.failureType)">{{ row.failureTypeName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="triggerTime" label="触发时间" width="170" />
      <el-table-column prop="triggerCode" label="触发码" width="90" />
      <el-table-column prop="handleTime" label="处理时间" width="170" />
      <el-table-column prop="handleCode" label="处理码" width="90" />
      <el-table-column prop="handleMsg" label="错误摘要" min-width="220" show-overflow-tooltip />
    </el-table>

    <div class="log-pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :total="logPage?.total || 0"
        :current-page="logFilters.page"
        :page-size="logFilters.pageSize"
        :page-sizes="[10, 20, 50, 100, 200]"
        @current-change="handleLogPageChange"
        @size-change="handleLogPageSizeChange"
      />
    </div>
  </el-dialog>

</template>

<style scoped>
.ops-page {
  padding: 24px;
}

.header-buttons {
  display: flex;
  gap: 8px;
}

.ops-tabs,
.filter-form {
  margin-top: 16px;
}

.drawer-form {
  padding-right: 8px;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.summary-label {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
}

.detail-summary strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-filter-form {
  margin-bottom: 8px;
}

.log-alert {
  margin-bottom: 12px;
}

.log-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.empty-copy {
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 900px) {
  .detail-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
