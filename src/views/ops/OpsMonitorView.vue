<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  checkOpsMonitor,
  createOpsMonitor,
  deleteOpsMonitor,
  fetchMqDashboard,
  fetchMqDetail,
  fetchXxlJobLogs,
  fetchOpsMonitors,
  updateOpsMonitor,
} from '@/api/ops'
import { fetchProjectGroups } from '@/api/project'
import { supportedEnvironmentPresets, toEnvironmentOptions } from '@/constants/environment'
import { useAuthStore } from '@/stores/auth'
import type {
  MqDashboard,
  OpsMonitor,
  OpsMonitorCheckResult,
  OpsMonitorSaveRequest,
  XxlJobLogPage,
} from '@/types/ops'
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

const environmentOptions = toEnvironmentOptions(supportedEnvironmentPresets)

const filters = reactive({
  businessLineCode: '',
  environmentCode: '',
  enabledOnly: true,
  lastStatus: '',
  enabled: '' as '' | 'true' | 'false',
})

const form = reactive<OpsMonitorSaveRequest>({
  monitorType: 'XXL_JOB',
  businessLineCode: '',
  environmentCode: 'PROD',
  xxlJobDatabaseName: '',
  enabled: true,
  remark: '',
})

const logFilters = reactive({
  dateRange: [] as string[],
  author: '',
  executorAppName: '',
  logStatus: [] as ('SUCCESS' | 'RUNNING' | 'STUCK' | 'EXECUTION_FAILED')[],
  page: 1,
  pageSize: 20,
})

const mqLoading = ref(false)
const mqSubmitting = ref(false)
const mqDetailLoading = ref(false)
const mqDrawerVisible = ref(false)
const mqDetailVisible = ref(false)
const mqEditingId = ref<number | null>(null)
const mqMonitors = ref<MqDashboard[]>([])
const mqSelected = ref<MqDashboard | null>(null)
const mqDetail = ref<MqDashboard | null>(null)
const mqFilters = reactive({
  businessLineCode: '',
  environmentCode: '',
  enabledOnly: true,
})
const mqForm = reactive<OpsMonitorSaveRequest>({
  monitorType: 'MQ',
  businessLineCode: '',
  environmentCode: 'PROD',
  mqTopic: undefined,
  mqConsumerGroup: undefined,
  mqLagThreshold: undefined,
  enabled: true,
  remark: '',
})
const mqMessageFilters = reactive({
  dateRange: [] as string[],
  logType: 'ALL' as 'ALL' | 'SENDER' | 'RECEIVER',
  exchangeKeyword: '',
  queueKeyword: '',
  page: 1,
  pageSize: 20,
})
const mqCheckingIds = reactive(new Set<number>())
const mqCheckingAll = ref(false)
const mqCheckProgress = reactive({ done: 0, total: 0 })
const mqCheckAllLabel = computed(() =>
  mqCheckingAll.value ? `全部检测（${mqCheckProgress.done}/${mqCheckProgress.total}）` : '全部检测',
)

const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))

function businessLineNameOf(code: string) {
  const line = businessLines.value.find((item) => item.businessLineCode === code)
  return line?.businessLineName || code
}
const executionLogs = computed(() => logPage.value?.logs || [])
const canCreate = computed(() => authStore.hasAnyPermission(['ops:monitor:create', 'ops:monitor:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['ops:monitor:update', 'ops:monitor:manage']))
const canDelete = computed(() => authStore.hasAnyPermission(['ops:monitor:delete', 'ops:monitor:manage']))
const canCheck = computed(() => authStore.hasAnyPermission(['ops:monitor:check', 'ops:monitor:manage']))
const checkingIds = reactive(new Set<number>())
const checkingAll = ref(false)
const checkProgress = reactive({ done: 0, total: 0 })
const checkAllLabel = computed(() =>
  checkingAll.value ? `全部检测（${checkProgress.done}/${checkProgress.total}）` : '全部检测',
)

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
    lastStatus: filters.lastStatus || undefined,
    enabled: filters.enabled === '' ? undefined : filters.enabled === 'true',
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
  form.environmentCode = 'PROD'
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

function statusName(status: string | null) {
  const normalized = status?.trim()
  if (!normalized) {
    return '未采集'
  }
  switch (normalized.toUpperCase()) {
    case 'UP':
      return '正常'
    case 'WARN':
      return '警告'
    case 'ERROR':
      return '异常'
    case 'DISABLED':
      return '已停用'
    case 'CONFIGURED':
      return '未采集'
    default:
      return '未知'
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.replace('T', ' ').slice(0, 19)
}

function applyCheckResult(row: OpsMonitor, result: OpsMonitorCheckResult) {
  row.lastStatus = result.status
  row.lastStatusName = statusName(result.status)
  row.lastMessage = result.message
  row.lastCheckedAt = result.checkedAt
}

async function checkRow(row: OpsMonitor) {
  if (row.monitorType !== 'XXL_JOB') {
    ElMessage.warning('MQ 监测采集下一步接入')
    return
  }
  if (checkingIds.has(row.id)) {
    return
  }
  checkingIds.add(row.id)
  try {
    const result = await checkOpsMonitor(row.id)
    applyCheckResult(row, result)
    if (result.status === 'UP') {
      ElMessage.success('检测完成：正常')
    } else if (result.status === 'WARN') {
      ElMessage.warning('检测完成：警告')
    } else {
      ElMessage.error(`检测异常：${result.message.slice(0, 80)}`)
    }
  } catch (error) {
    ElMessage.error('检测失败')
    console.error(error)
  } finally {
    checkingIds.delete(row.id)
  }
}

async function checkAll() {
  if (!monitors.value.length) {
    ElMessage.info('暂无监测配置')
    return
  }
  if (checkingAll.value || checkingIds.size) {
    return
  }
  checkingAll.value = true
  checkProgress.total = monitors.value.length
  checkProgress.done = 0
  let failed = 0
  try {
    for (const row of monitors.value) {
      if (row.monitorType !== 'XXL_JOB') {
        checkProgress.done += 1
        continue
      }
      try {
        applyCheckResult(row, await checkOpsMonitor(row.id))
      } catch (error) {
        failed += 1
        console.error(error)
      } finally {
        checkProgress.done += 1
      }
    }
    if (failed) {
      ElMessage.warning(`全部检测完成：成功 ${monitors.value.length - failed} 条，失败 ${failed} 条`)
    } else {
      ElMessage.success(`全部检测完成：共 ${monitors.value.length} 条`)
    }
  } finally {
    checkingAll.value = false
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
  start.setDate(end.getDate() - 6)
  logFilters.dateRange = [formatDate(start), formatDate(end)]
  logFilters.author = ''
  logFilters.executorAppName = ''
  logFilters.logStatus = ['STUCK', 'EXECUTION_FAILED']
  logFilters.page = 1
  logFilters.pageSize = 20
}

function lastCheckWindow(): string[] | null {
  const checkedDate = selectedMonitor.value?.lastCheckedAt?.split('T')[0] || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedDate)) {
    return null
  }
  const end = new Date(`${checkedDate}T00:00:00`)
  if (Number.isNaN(end.getTime())) {
    return null
  }
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  return [formatDate(start), formatDate(end)]
}

async function openDetail(row: OpsMonitor) {
  selectedMonitor.value = row
  logPage.value = null
  resetLogFilters()
  const checkWindow = lastCheckWindow()
  if (checkWindow) {
    logFilters.dateRange = checkWindow
  }
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
      logStatus: logFilters.logStatus.length ? logFilters.logStatus.join(',') : undefined,
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

function resetMqForm() {
  mqEditingId.value = null
  mqForm.monitorType = 'MQ'
  mqForm.monitorKey = undefined
  mqForm.businessLineCode = ''
  mqForm.environmentCode = 'PROD'
  mqForm.name = undefined
  mqForm.mqTopic = undefined
  mqForm.mqConsumerGroup = undefined
  mqForm.mqLagThreshold = undefined
  mqForm.enabled = true
  mqForm.remark = ''
}

async function loadMqDashboard() {
  mqLoading.value = true
  try {
    mqMonitors.value = await fetchMqDashboard({
      businessLineCode: mqFilters.businessLineCode || undefined,
      environmentCode: mqFilters.environmentCode || undefined,
      enabledOnly: false,
    })
  } catch (error) {
    ElMessage.error('加载 MQ 监测配置失败')
    console.error(error)
  } finally {
    mqLoading.value = false
  }
}

function openMqCreate() {
  resetMqForm()
  mqDrawerVisible.value = true
}

function openMqEdit(row: MqDashboard) {
  mqEditingId.value = row.id
  mqForm.monitorType = 'MQ'
  mqForm.monitorKey = row.monitorKey
  mqForm.businessLineCode = row.businessLineCode
  mqForm.environmentCode = row.environmentCode
  mqForm.name = row.name
  mqForm.mqTopic = row.mqTopic || undefined
  mqForm.mqConsumerGroup = row.mqConsumerGroup || undefined
  mqForm.mqLagThreshold = row.mqLagThreshold ?? undefined
  mqForm.enabled = rowEnabled(row)
  mqForm.remark = row.remark || ''
  mqDrawerVisible.value = true
}

function rowEnabled(row: MqDashboard) {
  return row.status !== 'DISABLED'
}

function validateMqForm() {
  if (!mqForm.businessLineCode.trim() || !mqForm.environmentCode.trim()) {
    ElMessage.warning('请选择业务线和环境')
    return false
  }
  if (mqForm.mqLagThreshold != null && mqForm.mqLagThreshold < 1) {
    ElMessage.warning('积压阈值必须大于等于 1 分钟')
    return false
  }
  return true
}

async function submitMq() {
  if (!validateMqForm()) {
    return
  }
  mqSubmitting.value = true
  try {
    const request: OpsMonitorSaveRequest = {
      monitorType: 'MQ',
      monitorKey: mqForm.monitorKey,
      businessLineCode: mqForm.businessLineCode.trim(),
      environmentCode: mqForm.environmentCode.trim(),
      name: mqForm.name,
      mqTopic: mqForm.mqTopic?.trim() || undefined,
      mqConsumerGroup: mqForm.mqConsumerGroup?.trim() || undefined,
      mqLagThreshold: mqForm.mqLagThreshold ?? undefined,
      enabled: mqForm.enabled,
      remark: mqForm.remark?.trim() || undefined,
    }
    if (mqEditingId.value) {
      await updateOpsMonitor(mqEditingId.value, request)
    } else {
      await createOpsMonitor(request)
    }
    ElMessage.success('MQ 监测配置已保存')
    mqDrawerVisible.value = false
    await loadMqDashboard()
  } catch (error) {
    ElMessage.error('保存 MQ 监测配置失败')
    console.error(error)
  } finally {
    mqSubmitting.value = false
  }
}

async function removeMq(row: MqDashboard) {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name}？`, '删除 MQ 监测配置', { type: 'warning' })
    await deleteOpsMonitor(row.id)
    ElMessage.success('MQ 监测配置已删除')
    await loadMqDashboard()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除 MQ 监测配置失败')
      console.error(error)
    }
  }
}

function applyMqCheckResult(row: MqDashboard, result: OpsMonitorCheckResult) {
  row.status = result.status
  row.message = result.message
  row.checkedAt = result.checkedAt
}

async function checkMqRow(row: MqDashboard) {
  if (mqCheckingIds.has(row.id)) {
    return
  }
  mqCheckingIds.add(row.id)
  try {
    const result = await checkOpsMonitor(row.id)
    applyMqCheckResult(row, result)
    if (result.status === 'UP') {
      ElMessage.success('检测完成：正常')
    } else if (result.status === 'WARN') {
      ElMessage.warning('检测完成：警告')
    } else {
      ElMessage.error(`检测异常：${result.message.slice(0, 80)}`)
    }
  } catch (error) {
    ElMessage.error('检测失败')
    console.error(error)
  } finally {
    mqCheckingIds.delete(row.id)
  }
}

async function checkMqAll() {
  if (!mqMonitors.value.length) {
    ElMessage.info('暂无 MQ 监测配置')
    return
  }
  if (mqCheckingAll.value || mqCheckingIds.size) {
    return
  }
  mqCheckingAll.value = true
  mqCheckProgress.total = mqMonitors.value.length
  mqCheckProgress.done = 0
  let failed = 0
  try {
    for (const row of mqMonitors.value) {
      if (!rowEnabled(row)) {
        mqCheckProgress.done += 1
        continue
      }
      try {
        applyMqCheckResult(row, await checkOpsMonitor(row.id))
      } catch (error) {
        failed += 1
        console.error(error)
      } finally {
        mqCheckProgress.done += 1
      }
    }
    if (failed) {
      ElMessage.warning(`全部检测完成：成功 ${mqMonitors.value.length - failed} 条，失败 ${failed} 条`)
    } else {
      ElMessage.success(`全部检测完成：共 ${mqMonitors.value.length} 条`)
    }
  } finally {
    mqCheckingAll.value = false
  }
}

function resetMqMessageFilters() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  mqMessageFilters.dateRange = [formatDate(start), formatDate(end)]
  mqMessageFilters.logType = 'ALL'
  mqMessageFilters.exchangeKeyword = ''
  mqMessageFilters.queueKeyword = ''
  mqMessageFilters.page = 1
  mqMessageFilters.pageSize = 20
}

async function openMqDetail(row: MqDashboard) {
  mqSelected.value = row
  mqDetail.value = null
  resetMqMessageFilters()
  mqMessageFilters.exchangeKeyword = row.mqTopic || ''
  mqMessageFilters.queueKeyword = row.mqConsumerGroup || ''
  mqDetailVisible.value = true
  await loadMqDetail()
}

async function loadMqDetail() {
  if (!mqSelected.value) {
    return
  }
  mqDetailLoading.value = true
  try {
    const [startDate, endDate] = mqMessageFilters.dateRange
    mqDetail.value = await fetchMqDetail(mqSelected.value.id, {
      startDate,
      endDate,
      page: mqMessageFilters.page,
      pageSize: mqMessageFilters.pageSize,
      logType: mqMessageFilters.logType,
      exchangeKeyword: mqMessageFilters.exchangeKeyword.trim() || undefined,
      queueKeyword: mqMessageFilters.queueKeyword.trim() || undefined,
    })
  } catch (error) {
    ElMessage.error('加载 MQ 消息明细失败')
    console.error(error)
  } finally {
    mqDetailLoading.value = false
  }
}

async function searchMqMessages() {
  mqMessageFilters.page = 1
  await loadMqDetail()
}

async function handleMqPageChange(page: number) {
  mqMessageFilters.page = page
  await loadMqDetail()
}

async function handleMqPageSizeChange(pageSize: number) {
  mqMessageFilters.pageSize = pageSize
  mqMessageFilters.page = 1
  await loadMqDetail()
}

function mqFailureTag(failureType: string) {
  if (failureType === 'SEND_STUCK') {
    return 'warning'
  }
  return 'danger'
}

function mqLogTypeText(logType: string) {
  return logType === 'SENDER' ? '发送' : '接收'
}

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadDashboard(), loadMqDashboard()])
})
</script>

<template>
  <div class="page-card ops-page">
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
          <el-form-item label="上次状态">
            <el-select v-model="filters.lastStatus" clearable placeholder="全部" style="width: 130px">
              <el-option label="正常 (UP)" value="UP" />
              <el-option label="异常 (ERROR)" value="ERROR" />
              <el-option label="未检查" value="UNCHECKED" />
            </el-select>
          </el-form-item>
          <el-form-item label="启用状态">
            <el-select v-model="filters.enabled" clearable placeholder="全部" style="width: 110px">
              <el-option label="启用" value="true" />
              <el-option label="停用" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadDashboard">查询</el-button>
            <el-button v-if="canCreate" type="primary" @click="openCreate">新增 XXL-JOB 监测</el-button>
            <el-button
              v-if="canCheck"
              :loading="checkingAll"
              :disabled="checkingIds.size > 0"
              @click="checkAll"
            >{{ checkAllLabel }}</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loading" :data="monitors" row-key="id">
          <el-table-column label="业务线" min-width="170">
            <template #default="{ row }">
              <div>{{ row.businessLineName }}</div>
              <div class="business-line-code">{{ row.businessLineCode }}</div>
            </template>
          </el-table-column>
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ row.environmentCode }}
            </template>
          </el-table-column>
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
              <el-tag :type="statusTag(row.lastStatus)">{{ row.lastStatusName }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastMessage" label="上次消息" min-width="220" show-overflow-tooltip />
          <el-table-column label="上次采集时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.lastCheckedAt) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="canCheck"
                link
                type="primary"
                :loading="checkingIds.has(row.id)"
                :disabled="checkingAll"
                @click="checkRow(row)"
              >检测</el-button>
              <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="MQ 消息" name="MQ">
        <el-form inline class="filter-form" @submit.prevent="loadMqDashboard">
          <el-form-item label="业务线">
            <el-select v-model="mqFilters.businessLineCode" placeholder="全部业务线" clearable filterable style="width: 220px">
              <el-option
                v-for="line in businessLineOptions"
                :key="line.id"
                :label="line.businessLineName"
                :value="line.businessLineCode"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="环境">
            <el-select v-model="mqFilters.environmentCode" clearable placeholder="全部环境" style="width: 140px">
              <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅启用">
            <el-switch v-model="mqFilters.enabledOnly" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadMqDashboard">查询</el-button>
            <el-button v-if="canCreate" type="primary" @click="openMqCreate">新增 MQ 监测</el-button>
            <el-button
              v-if="canCheck"
              :loading="mqCheckingAll"
              :disabled="mqCheckingIds.size > 0"
              @click="checkMqAll"
            >{{ mqCheckAllLabel }}</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="mqLoading" :data="mqMonitors" row-key="id">
          <el-table-column label="业务线" min-width="170">
            <template #default="{ row }">
              <div>{{ businessLineNameOf(row.businessLineCode) }}</div>
              <div class="business-line-code">{{ row.businessLineCode }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="environmentCode" label="环境" width="90" />
          <el-table-column label="子应用库" width="100">
            <template #default="{ row }">{{ row.databaseCount > 0 ? `${row.databaseCount} 个` : '—' }}</template>
          </el-table-column>
          <el-table-column prop="mqTopic" label="关注交换机" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.mqTopic || '全部' }}</template>
          </el-table-column>
          <el-table-column prop="mqConsumerGroup" label="关注队列" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.mqConsumerGroup || '全部' }}</template>
          </el-table-column>
          <el-table-column label="积压阈值" width="100">
            <template #default="{ row }">{{ row.mqLagThreshold ? `${row.mqLagThreshold} 分钟` : '默认 30 分钟' }}</template>
          </el-table-column>
          <el-table-column label="发送失败/积压" width="130">
            <template #default="{ row }">{{ row.sendFailedCount }} / {{ row.sendPendingCount }}</template>
          </el-table-column>
          <el-table-column label="接收失败" width="100">
            <template #default="{ row }">{{ row.receiveFailedCount }}</template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-tag :type="rowEnabled(row) ? 'success' : 'info'">{{ rowEnabled(row) ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上次状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status)">{{ statusName(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="上次消息" min-width="220" show-overflow-tooltip />
          <el-table-column label="上次采集时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.checkedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openMqDetail(row)">详情</el-button>
              <el-button
                v-if="canCheck"
                link
                type="primary"
                :loading="mqCheckingIds.has(row.id)"
                :disabled="mqCheckingAll"
                @click="checkMqRow(row)"
              >检测</el-button>
              <el-button v-if="canUpdate" link type="primary" @click="openMqEdit(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="removeMq(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
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

  <el-dialog v-model="detailVisible" title="XXL-JOB 执行日志" width="92%" top="4vh" class="job-log-dialog">
    <div v-if="selectedMonitor" class="detail-summary">
      <div>
        <span class="summary-label">业务线</span>
        <strong>{{ businessLineNameOf(selectedMonitor.businessLineCode) }}</strong>
        <span class="business-line-code">{{ selectedMonitor.businessLineCode }}</span>
      </div>
      <div>
        <span class="summary-label">环境</span>
        <strong>{{ selectedMonitor.environmentCode }}</strong>
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
        <el-select
          v-model="logFilters.logStatus"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          placeholder="全部状态"
          style="width: 240px"
        >
          <el-option label="执行成功" value="SUCCESS" />
          <el-option label="执行中" value="RUNNING" />
          <el-option label="卡死（回调丢失）" value="STUCK" />
          <el-option label="执行失败（含调度失败）" value="EXECUTION_FAILED" />
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

    <el-table v-loading="detailLoading" :data="executionLogs" row-key="logId" max-height="640" empty-text="暂无执行日志">
      <el-table-column prop="logId" label="日志ID" width="90" />
      <el-table-column prop="jobId" label="任务ID" width="90" />
      <el-table-column prop="jobDesc" label="任务描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="executorAppName" label="执行器" min-width="160" show-overflow-tooltip />
      <el-table-column prop="executorHandler" label="Handler" min-width="160" show-overflow-tooltip />
      <el-table-column prop="author" label="负责人" width="110" show-overflow-tooltip />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="executionStatusTag(row.failureType)">{{ row.failureTypeName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="triggerTime" label="触发时间" width="170" />
      <el-table-column prop="triggerCode" label="触发码" width="90" />
      <el-table-column prop="handleTime" label="处理时间" width="170" />
      <el-table-column prop="handleCode" label="处理码" width="90" />
      <el-table-column prop="handleMsg" label="错误摘要" min-width="260" show-overflow-tooltip />
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
  <el-drawer v-model="mqDrawerVisible" :title="mqEditingId ? '编辑 MQ 监测' : '新增 MQ 监测'" size="520px">
    <el-form label-position="top" class="drawer-form">
      <el-form-item label="业务线" required>
        <el-select v-model="mqForm.businessLineCode" filterable style="width: 100%">
          <el-option
            v-for="line in businessLineOptions"
            :key="line.id"
            :label="line.businessLineName"
            :value="line.businessLineCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="环境" required>
        <el-select v-model="mqForm.environmentCode" style="width: 100%">
          <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关注交换机">
        <el-input v-model="mqForm.mqTopic" placeholder="exchange，多个用英文逗号分隔，留空表示全部" />
      </el-form-item>
      <el-form-item label="关注队列（仅接收侧）">
        <el-input v-model="mqForm.mqConsumerGroup" placeholder="queue，多个用英文逗号分隔，留空表示全部" />
      </el-form-item>
      <el-form-item label="积压阈值（分钟）">
        <el-input-number v-model="mqForm.mqLagThreshold" :min="1" :max="1440" placeholder="默认 30" style="width: 100%" />
      </el-form-item>
      <el-form-item label="是否启用">
        <el-switch v-model="mqForm.enabled" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="mqForm.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="mqDrawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="mqSubmitting" @click="submitMq">保存</el-button>
    </template>
  </el-drawer>

  <el-dialog v-model="mqDetailVisible" title="MQ 消息监测详情" width="1120px" class="job-log-dialog">
    <div v-if="mqSelected" class="detail-summary">
      <div>
        <span class="summary-label">业务线</span>
        <strong>{{ businessLineNameOf(mqSelected.businessLineCode) }}</strong>
      </div>
      <div>
        <span class="summary-label">环境</span>
        <strong>{{ mqSelected.environmentCode }}</strong>
      </div>
      <div>
        <span class="summary-label">关注交换机</span>
        <strong>{{ mqSelected.mqTopic || '全部' }}</strong>
      </div>
      <div>
        <span class="summary-label">关注队列</span>
        <strong>{{ mqSelected.mqConsumerGroup || '全部' }}</strong>
      </div>
    </div>

    <el-table
      v-loading="mqDetailLoading"
      :data="mqDetail?.databaseStats || []"
      row-key="databaseName"
      max-height="240"
      empty-text="暂无子应用库统计"
      class="mq-stats-table"
    >
      <el-table-column prop="databaseName" label="子应用库" min-width="150" show-overflow-tooltip />
      <el-table-column label="发送总量" width="100" prop="sendTotalCount" />
      <el-table-column label="发送成功" width="100" prop="sendSuccessCount" />
      <el-table-column label="发送失败" width="100">
        <template #default="{ row }">
          <span :class="{ 'mq-count-danger': row.sendFailedCount > 0 }">{{ row.sendFailedCount }}</span>
        </template>
      </el-table-column>
      <el-table-column label="发送积压" width="100">
        <template #default="{ row }">
          <span :class="{ 'mq-count-warning': row.sendPendingCount > 0 }">{{ row.sendPendingCount }}</span>
        </template>
      </el-table-column>
      <el-table-column label="接收总量" width="100" prop="receiveTotalCount" />
      <el-table-column label="接收成功" width="100" prop="receiveSuccessCount" />
      <el-table-column label="接收失败" width="100">
        <template #default="{ row }">
          <span :class="{ 'mq-count-danger': row.receiveFailedCount > 0 }">{{ row.receiveFailedCount }}</span>
        </template>
      </el-table-column>
      <el-table-column label="最新活动" width="170">
        <template #default="{ row }">{{ formatDateTime(row.latestActivityAt) }}</template>
      </el-table-column>
      <el-table-column label="采集状态" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.errorMessage" class="mq-count-danger">{{ row.errorMessage }}</span>
          <span v-else>正常</span>
        </template>
      </el-table-column>
    </el-table>

    <el-form inline class="log-filter-form" @submit.prevent="searchMqMessages">
      <el-form-item label="日期">
        <el-date-picker
          v-model="mqMessageFilters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="mqMessageFilters.logType" style="width: 110px">
          <el-option label="全部" value="ALL" />
          <el-option label="发送" value="SENDER" />
          <el-option label="接收" value="RECEIVER" />
        </el-select>
      </el-form-item>
      <el-form-item label="交换机">
        <el-input v-model="mqMessageFilters.exchangeKeyword" clearable placeholder="exchange" style="width: 160px" />
      </el-form-item>
      <el-form-item label="队列">
        <el-input v-model="mqMessageFilters.queueKeyword" clearable placeholder="queue" style="width: 160px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="mqDetailLoading" @click="searchMqMessages">查询</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="mqDetail?.message"
      :title="mqDetail.message"
      :type="alertType(mqDetail.status)"
      show-icon
      :closable="false"
      class="log-alert"
    />

    <el-table
      v-loading="mqDetailLoading"
      :data="mqDetail?.messages || []"
      row-key="logId"
      max-height="420"
      empty-text="暂无失败或积压消息"
    >
      <el-table-column prop="databaseName" label="子应用库" min-width="140" show-overflow-tooltip />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ mqLogTypeText(row.logType) }}</template>
      </el-table-column>
      <el-table-column prop="logId" label="日志ID" width="90" />
      <el-table-column prop="messageId" label="Message ID" min-width="200" show-overflow-tooltip />
      <el-table-column prop="exchange" label="交换机" min-width="140" show-overflow-tooltip />
      <el-table-column prop="routingKey" label="Routing Key" min-width="140" show-overflow-tooltip />
      <el-table-column prop="queue" label="队列" min-width="130" show-overflow-tooltip />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="mqFailureTag(row.failureType)">{{ row.failureTypeName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="重试" width="80">
        <template #default="{ row }">{{ row.retryCount ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="occurredAt" label="发生时间" width="170" />
      <el-table-column prop="errorMsg" label="错误摘要" min-width="200" show-overflow-tooltip />
    </el-table>

    <div class="log-pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :total="mqDetail?.failedMessageCount || 0"
        :current-page="mqMessageFilters.page"
        :page-size="mqMessageFilters.pageSize"
        :page-sizes="[10, 20, 50]"
        @current-change="handleMqPageChange"
        @size-change="handleMqPageSizeChange"
      />
    </div>
  </el-dialog>

</template>

<style scoped>
.ops-page {
  padding: 24px;
}

.filter-form {
  margin-top: 16px;
}

.drawer-form {
  padding-right: 8px;
}

.business-line-code {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
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

.mq-stats-table {
  margin-bottom: 16px;
}

.mq-count-danger {
  color: #f56c6c;
  font-weight: 600;
}

.mq-count-warning {
  color: #e6a23c;
  font-weight: 600;
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
