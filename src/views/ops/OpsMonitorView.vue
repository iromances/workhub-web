<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createOpsMonitor,
  deleteOpsMonitor,
  fetchXxlJobDetail,
  fetchXxlJobExecutors,
  fetchOpsMonitors,
  fetchXxlJobDashboard,
  updateOpsMonitor,
} from '@/api/ops'
import { fetchProjectGroups } from '@/api/project'
import type { OpsMonitor, OpsMonitorSaveRequest, XxlJobDashboard, XxlJobExecutor, XxlJobFailedJob } from '@/types/ops'
import type { ProjectGroup } from '@/types/work-item'

const loading = ref(false)
const submitting = ref(false)
const detailLoadingId = ref<number | null>(null)
const detailQuerying = ref(false)
const executorLoading = ref(false)
const drawerVisible = ref(false)
const detailVisible = ref(false)
const detailMonitorId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const activeTab = ref<'XXL_JOB' | 'MQ'>('XXL_JOB')
const monitors = ref<OpsMonitor[]>([])
const dashboards = ref<XxlJobDashboard[]>([])
const businessLines = ref<ProjectGroup[]>([])
const executorOptions = ref<XxlJobExecutor[]>([])
const selectedExecutorAppNames = ref<string[]>([])
const selectedDetail = ref<XxlJobDashboard | null>(null)
const detailDateRange = ref<[string, string] | null>(defaultDetailDateRange())
const detailPage = ref(1)
const detailPageSize = ref(20)
const detailFilters = reactive({
  author: '',
  executorAppName: '',
  logStatus: 'ALL' as 'ALL' | 'FAILED',
})

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

const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))
const monitorMap = computed(() => new Map(monitors.value.map((item) => [item.id, item])))
const executorSelectOptions = computed(() => {
  const options = new Map(executorOptions.value.map((item) => [item.appName, item]))
  selectedExecutorAppNames.value.forEach((appName) => {
    if (!options.has(appName)) {
      options.set(appName, { appName, title: appName })
    }
  })
  return Array.from(options.values())
})
let executorLoadSeq = 0

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDetailDateRange(): [string, string] {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 1)
  return [formatDate(startDate), formatDate(endDate)]
}

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
    dashboards.value = await fetchXxlJobDashboard({
      businessLineCode: filters.businessLineCode || undefined,
      environmentCode: filters.environmentCode || undefined,
      enabledOnly: filters.enabledOnly,
    })
  } catch (error) {
    ElMessage.error('加载 XXL-JOB 统计失败')
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
  selectedExecutorAppNames.value = []
  executorOptions.value = []
  form.jobHandler = undefined
  form.jobDesc = undefined
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  drawerVisible.value = true
}

function openEdit(row: XxlJobDashboard) {
  const monitor = monitorMap.value.get(row.id)
  editingId.value = row.id
  form.monitorType = 'XXL_JOB'
  form.monitorKey = monitor?.monitorKey
  form.businessLineCode = row.businessLineCode
  form.environmentCode = row.environmentCode
  form.name = monitor?.name
  form.xxlJobDatabaseName = monitor?.xxlJobDatabaseName || row.xxlJobDatabaseName || ''
  form.executorAppName = monitor?.executorAppName || undefined
  selectedExecutorAppNames.value = splitExecutorAppNames(form.executorAppName)
  form.enabled = monitor?.enabled ?? true
  form.remark = monitor?.remark || ''
  drawerVisible.value = true
  void loadExecutorOptions()
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
    executorAppName: selectedExecutorAppNames.value.join(',') || undefined,
    enabled: form.enabled,
    remark: form.remark?.trim() || undefined,
  }
}

function splitExecutorAppNames(value?: string | null) {
  return Array.from(
    new Set(
      (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

async function loadExecutorOptions() {
  const businessLineCode = form.businessLineCode?.trim()
  const environmentCode = form.environmentCode?.trim()
  const xxlJobDatabaseName = form.xxlJobDatabaseName?.trim()
  if (!drawerVisible.value || !businessLineCode || !environmentCode || !xxlJobDatabaseName) {
    executorOptions.value = []
    return
  }
  const seq = ++executorLoadSeq
  executorLoading.value = true
  try {
    const items = await fetchXxlJobExecutors({ businessLineCode, environmentCode, xxlJobDatabaseName })
    if (seq === executorLoadSeq) {
      executorOptions.value = items
    }
  } catch (error) {
    if (seq === executorLoadSeq) {
      executorOptions.value = []
      ElMessage.warning('加载执行器列表失败')
    }
    console.error(error)
  } finally {
    if (seq === executorLoadSeq) {
      executorLoading.value = false
    }
  }
}

function handleExecutorSourceChange() {
  selectedExecutorAppNames.value = []
  void loadExecutorOptions()
}

watch(
  () => [drawerVisible.value, form.businessLineCode, form.environmentCode, form.xxlJobDatabaseName] as const,
  () => {
    void loadExecutorOptions()
  },
)

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

async function remove(row: XxlJobDashboard) {
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

async function openDetail(row: XxlJobDashboard) {
  detailMonitorId.value = row.id
  detailDateRange.value = defaultDetailDateRange()
  detailPage.value = 1
  detailPageSize.value = 20
  detailFilters.author = ''
  detailFilters.executorAppName = ''
  detailFilters.logStatus = 'ALL'
  await loadDetail()
}

async function queryDetailFromFirstPage() {
  detailPage.value = 1
  await loadDetail()
}

async function loadDetail() {
  if (!detailMonitorId.value) {
    return
  }
  const [startDate, endDate] = detailDateRange.value || []
  if (!startDate || !endDate) {
    ElMessage.warning('请选择日期区间')
    return
  }
  detailLoadingId.value = detailMonitorId.value
  detailQuerying.value = true
  try {
    const detail = await fetchXxlJobDetail(detailMonitorId.value, {
      startDate,
      endDate,
      page: detailPage.value,
      pageSize: detailPageSize.value,
      author: detailFilters.author.trim() || undefined,
      executorAppName: detailFilters.executorAppName.trim() || undefined,
      logStatus: detailFilters.logStatus,
    })
    selectedDetail.value = detail
    detailPage.value = detail.failedJobPage || detailPage.value
    detailPageSize.value = detail.failedJobPageSize || detailPageSize.value
    detailVisible.value = true
  } catch (error) {
    ElMessage.error('加载详情失败')
    console.error(error)
  } finally {
    detailLoadingId.value = null
    detailQuerying.value = false
  }
}

async function handleDetailPageChange(page: number) {
  detailPage.value = page
  await loadDetail()
}

async function handleDetailPageSizeChange(pageSize: number) {
  detailPageSize.value = pageSize
  detailPage.value = 1
  await loadDetail()
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

function failureTagType(failureType: string) {
  if (failureType === 'SUCCESS') {
    return 'success'
  }
  if (failureType === 'RUNNING' || failureType === 'SCHEDULE_FAILED') {
    return 'warning'
  }
  return 'danger'
}

function failureMessage(row: XxlJobFailedJob) {
  return row.failureType === 'SCHEDULE_FAILED' ? row.triggerMsg || row.handleMsg : row.handleMsg || row.triggerMsg
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
        <p class="page-desc">按业务线读取对应 DBServer 上的 XXL-JOB 数据库，默认展示 XXL-JOB 运行报表快照，详情中定位失败 Job。</p>
      </div>
      <div class="header-buttons">
        <el-button @click="loadDashboard">刷新统计</el-button>
        <el-button v-if="activeTab === 'XXL_JOB'" type="primary" @click="openCreate">新增 XXL-JOB 监测</el-button>
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
                :value="line.businessLineName"
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

        <el-table v-loading="loading" :data="dashboards" row-key="id">
          <el-table-column prop="businessLineCode" label="业务线" width="140" />
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="xxlJobDatabaseName" label="XXL-JOB 库" min-width="150" show-overflow-tooltip />
          <el-table-column label="运行状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="executorCount" label="执行器" width="90" />
          <el-table-column prop="jobCount" label="任务总数" width="100" />
          <el-table-column prop="enabledJobCount" label="启用" width="80" />
          <el-table-column prop="disabledJobCount" label="停用" width="80" />
          <el-table-column prop="triggerCount" label="调度次数" width="110" />
          <el-table-column prop="triggerSuccessCount" label="成功" width="90" />
          <el-table-column label="失败" width="90">
            <template #default="{ row }">
              <el-tag :type="row.triggerFailedCount > 0 ? 'danger' : 'success'">{{ row.triggerFailedCount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="triggerRunningCount" label="进行中" width="90" />
          <el-table-column prop="message" label="消息" min-width="220" show-overflow-tooltip />
          <el-table-column prop="reportUpdatedAt" label="报表更新时间" width="180" />
          <el-table-column label="操作" width="190" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :loading="detailLoadingId === row.id" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="remove(row)">删除</el-button>
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
        <el-select v-model="form.businessLineCode" filterable style="width: 100%" @change="handleExecutorSourceChange">
          <el-option
            v-for="line in businessLineOptions"
            :key="line.id"
            :label="line.businessLineName"
            :value="line.businessLineName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="环境" required>
        <el-select v-model="form.environmentCode" style="width: 100%" @change="handleExecutorSourceChange">
          <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="XXL-JOB 数据库名" required>
        <el-input v-model="form.xxlJobDatabaseName" placeholder="amp_xxl_job" @change="handleExecutorSourceChange" />
      </el-form-item>
      <el-form-item label="关注执行器">
        <el-select
          v-model="selectedExecutorAppNames"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          :loading="executorLoading"
          placeholder="不选默认关注全部执行器"
          style="width: 100%"
        >
          <el-option
            v-for="item in executorSelectOptions"
            :key="item.appName"
            :label="item.title && item.title !== item.appName ? `${item.appName} / ${item.title}` : item.appName"
            :value="item.appName"
          />
        </el-select>
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

  <el-dialog v-model="detailVisible" title="XXL-JOB 详情" width="980px">
    <div class="detail-toolbar">
      <el-date-picker
        v-model="detailDateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
      <el-input v-model="detailFilters.author" clearable placeholder="负责人" style="width: 140px" @keyup.enter="queryDetailFromFirstPage" />
      <el-input v-model="detailFilters.executorAppName" clearable placeholder="执行器" style="width: 180px" @keyup.enter="queryDetailFromFirstPage" />
      <el-select v-model="detailFilters.logStatus" style="width: 120px" @change="queryDetailFromFirstPage">
        <el-option label="全部日志" value="ALL" />
        <el-option label="失败日志" value="FAILED" />
      </el-select>
      <el-button type="primary" :loading="detailQuerying" @click="queryDetailFromFirstPage">查询</el-button>
    </div>
    <el-descriptions v-if="selectedDetail" :column="3" border>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTag(selectedDetail.status)">{{ selectedDetail.status }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="业务线">{{ selectedDetail.businessLineCode }}</el-descriptions-item>
      <el-descriptions-item label="环境">
        {{ environmentOptions.find((item) => item.value === selectedDetail?.environmentCode)?.label || selectedDetail.environmentCode }}
      </el-descriptions-item>
      <el-descriptions-item label="XXL-JOB 库">{{ selectedDetail.xxlJobDatabaseName }}</el-descriptions-item>
      <el-descriptions-item label="报表更新时间">{{ selectedDetail.reportUpdatedAt || '-' }}</el-descriptions-item>
      <el-descriptions-item label="详情查询时间">{{ selectedDetail.checkedAt }}</el-descriptions-item>
      <el-descriptions-item label="任务数量">{{ selectedDetail.jobCount }}</el-descriptions-item>
      <el-descriptions-item label="执行器数量">{{ selectedDetail.executorCount }}</el-descriptions-item>
      <el-descriptions-item label="调度次数">{{ selectedDetail.triggerCount }}</el-descriptions-item>
      <el-descriptions-item label="成功 / 失败 / 进行中">
        {{ selectedDetail.triggerSuccessCount }} / {{ selectedDetail.triggerFailedCount }} / {{ selectedDetail.triggerRunningCount }}
      </el-descriptions-item>
      <el-descriptions-item label="消息" :span="3">{{ selectedDetail.message }}</el-descriptions-item>
    </el-descriptions>
    <el-table
      class="detail-table"
      :data="selectedDetail?.failedJobs || []"
      size="small"
      empty-text="当前日期区间暂无失败 Job"
    >
      <el-table-column prop="executorAppName" label="执行器" min-width="150" show-overflow-tooltip />
      <el-table-column prop="jobId" label="Job ID" width="90" />
      <el-table-column prop="jobDesc" label="任务描述" min-width="150" show-overflow-tooltip />
      <el-table-column prop="author" label="负责人" width="110" show-overflow-tooltip />
      <el-table-column prop="executorHandler" label="JobHandler" min-width="170" show-overflow-tooltip />
      <el-table-column label="执行结果" width="110">
        <template #default="{ row }">
          <el-tag :type="failureTagType(row.failureType)">{{ row.failureTypeName || row.failureType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="triggerCode" label="调度码" width="90" />
      <el-table-column prop="handleCode" label="执行码" width="90" />
      <el-table-column prop="logId" label="Log ID" width="100" />
      <el-table-column prop="triggerTime" label="触发时间" width="170" />
      <el-table-column prop="handleTime" label="处理时间" width="170" />
      <el-table-column label="失败摘要" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          {{ failureMessage(row) }}
        </template>
      </el-table-column>
    </el-table>
    <div class="detail-pagination">
      <el-pagination
        v-model:current-page="detailPage"
        v-model:page-size="detailPageSize"
        :page-sizes="[20, 50, 100, 200]"
        :total="selectedDetail?.failedJobCount || 0"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handleDetailPageChange"
        @size-change="handleDetailPageSizeChange"
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
.filter-form,
.detail-table {
  margin-top: 16px;
}

.detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.detail-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.drawer-form {
  padding-right: 8px;
}

.empty-copy {
  color: #64748b;
  font-size: 14px;
}
</style>
