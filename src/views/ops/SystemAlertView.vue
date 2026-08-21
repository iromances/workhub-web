<script setup lang="ts">
import { DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createSystemAlertRule,
  createSystemAlertSubsystem,
  deleteSystemAlertRule,
  deleteSystemAlertSubsystem,
  fetchSystemAlertDashboard,
  fetchSystemAlertRules,
  fetchSystemAlertSubsystems,
  updateSystemAlertRule,
  updateSystemAlertSubsystem,
} from '@/api/ops'
import { fetchProjectGroups } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type {
  SystemAlertDashboard,
  SystemAlertEvent,
  SystemAlertEventCategory,
  SystemAlertRule,
  SystemAlertRuleAction,
  SystemAlertRuleMatchMode,
  SystemAlertRuleMatchScope,
  SystemAlertRuleSaveRequest,
  SystemAlertSubsystem,
  SystemAlertSubsystemSaveRequest,
} from '@/types/ops'
import type { ProjectGroup } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const subsystemLoading = ref(false)
const ruleLoading = ref(false)
const submitting = ref(false)
const drawerVisible = ref(false)
const ruleDrawerVisible = ref(false)
const editingId = ref<number | null>(null)
const editingRuleId = ref<number | null>(null)
const activeTab = ref<'systemError' | 'slowSql' | 'subsystems' | 'rules'>('systemError')
const activeSystemErrorTab = ref<'summary' | 'events'>('events')
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
const rules = ref<SystemAlertRule[]>([])
const ruleFilters = reactive({
  keyword: '',
  enabledOnly: false,
})

const environmentOptions = [
  { label: '开发', value: 'dev' },
  { label: '测试', value: 'test' },
  { label: '准生产', value: 'staging' },
  { label: '生产', value: 'prod' },
]

const levelOptions = ['ERROR', 'WARN', 'INFO']

type TimeRangeShortcut = {
  text: string
  value: () => [Date, Date]
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function recentDaysRange(days: number): [Date, Date] {
  const end = new Date()
  const start = startOfDay(end)
  start.setDate(start.getDate() - days + 1)
  return [start, end]
}

const timeRangeShortcuts: TimeRangeShortcut[] = [
  { text: '今天', value: () => recentDaysRange(1) },
  {
    text: '昨天',
    value: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return [startOfDay(yesterday), endOfDay(yesterday)]
    },
  },
  { text: '最近三天', value: () => recentDaysRange(3) },
  { text: '最近7天', value: () => recentDaysRange(7) },
  { text: '最近15天', value: () => recentDaysRange(15) },
  { text: '最近30天', value: () => recentDaysRange(30) },
  { text: '最近90天', value: () => recentDaysRange(90) },
]

const filters = reactive({
  businessLineCode: '',
  environmentCode: 'prod',
  serviceName: '',
  level: 'ERROR',
  timeRange: null as [string, string] | null,
  page: 1,
  pageSize: 20,
})

const form = reactive<SystemAlertSubsystemSaveRequest>({
  businessLineCode: '',
  environmentCode: 'prod',
  subsystemName: '',
  serviceName: '',
  indexPatterns: [''],
  enabled: true,
  remark: '',
})

const ruleForm = reactive<SystemAlertRuleSaveRequest>({
  ruleName: '',
  action: 'IGNORE',
  matchScope: 'MESSAGE',
  matchMode: 'ANY',
  keywords: [''],
  priority: 100,
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
const activeEventCategory = computed<SystemAlertEventCategory>(() =>
  activeTab.value === 'slowSql' ? 'SLOW_SQL' : 'SYSTEM_ERROR',
)
const eventDisplayName = computed(() => activeTab.value === 'slowSql' ? '慢 SQL' : '系统异常')
const eventMetricLabel = computed(() => activeTab.value === 'slowSql' ? '慢 SQL 事件' : '系统异常事件')
const eventCountLabel = computed(() => activeTab.value === 'slowSql' ? '慢 SQL 数' : '系统异常数')
const eventSummaryLabel = computed(() => activeTab.value === 'slowSql' ? '慢 SQL 汇总' : '系统异常汇总')

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

async function loadRules() {
  ruleLoading.value = true
  try {
    rules.value = await fetchSystemAlertRules({
      enabledOnly: ruleFilters.enabledOnly,
      keyword: ruleFilters.keyword.trim() || undefined,
    })
  } catch (error) {
    ElMessage.error('加载过滤规则失败')
    console.error(error)
  } finally {
    ruleLoading.value = false
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
      eventCategory: activeEventCategory.value,
      startTime: filters.timeRange?.[0],
      endTime: filters.timeRange?.[1],
      page: filters.page,
      pageSize: filters.pageSize,
    })
  } catch (error) {
    ElMessage.error(`加载${eventDisplayName.value}失败`)
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
  form.indexPatterns = ['']
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  drawerVisible.value = true
}

function resetRuleForm() {
  editingRuleId.value = null
  ruleForm.ruleName = ''
  ruleForm.action = 'IGNORE'
  ruleForm.matchScope = 'MESSAGE'
  ruleForm.matchMode = 'ANY'
  ruleForm.keywords = ['']
  ruleForm.priority = 100
  ruleForm.enabled = true
  ruleForm.remark = ''
}

function openCreateRule() {
  resetRuleForm()
  ruleDrawerVisible.value = true
}

function openEditRule(row: SystemAlertRule) {
  editingRuleId.value = row.id
  ruleForm.ruleName = row.ruleName
  ruleForm.action = row.action
  ruleForm.matchScope = row.matchScope
  ruleForm.matchMode = row.matchMode
  ruleForm.keywords = row.keywords.length ? [...row.keywords] : ['']
  ruleForm.priority = row.priority
  ruleForm.enabled = row.enabled
  ruleForm.remark = row.remark || ''
  ruleDrawerVisible.value = true
}

function openEdit(row: SystemAlertSubsystem) {
  editingId.value = row.id
  form.businessLineCode = row.businessLineCode
  form.environmentCode = row.environmentCode
  form.subsystemName = row.subsystemName
  form.serviceName = row.serviceName
  form.indexPatterns = row.indexPatterns.length ? [...row.indexPatterns] : ['']
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
  if (!form.indexPatterns.some((item) => item.trim())) {
    ElMessage.warning('请至少填写一个日志索引模式')
    return false
  }
  return true
}

function addIndexPattern() {
  if (form.indexPatterns.length >= 20) {
    ElMessage.warning('日志索引模式最多配置20个')
    return
  }
  form.indexPatterns.push('')
}

function removeIndexPattern(index: number) {
  if (form.indexPatterns.length === 1) {
    form.indexPatterns[0] = ''
    return
  }
  form.indexPatterns.splice(index, 1)
}

function requestFromForm(): SystemAlertSubsystemSaveRequest {
  return {
    businessLineCode: form.businessLineCode.trim(),
    environmentCode: form.environmentCode.trim(),
    subsystemName: form.subsystemName.trim(),
    serviceName: form.serviceName.trim(),
    indexPatterns: Array.from(new Set(form.indexPatterns.map((item) => item.trim()).filter(Boolean))),
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
    await loadSubsystems()
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
    await loadSubsystems()
  } catch (error) {
    ElMessage.error('删除关注子系统失败')
    console.error(error)
  }
}

function addRuleKeyword() {
  if (ruleForm.keywords.length >= 10) {
    ElMessage.warning('匹配关键词最多配置10个')
    return
  }
  ruleForm.keywords.push('')
}

function removeRuleKeyword(index: number) {
  if (ruleForm.keywords.length === 1) {
    ruleForm.keywords[0] = ''
    return
  }
  ruleForm.keywords.splice(index, 1)
}

function ruleRequestFromForm(): SystemAlertRuleSaveRequest | null {
  const keywords = Array.from(new Set(ruleForm.keywords.map((item) => item.trim()).filter(Boolean)))
  if (!ruleForm.ruleName.trim()) {
    ElMessage.warning('请填写规则名称')
    return null
  }
  if (!keywords.length) {
    ElMessage.warning('请至少填写一个匹配关键词')
    return null
  }
  return {
    ruleName: ruleForm.ruleName.trim(),
    action: ruleForm.action,
    matchScope: ruleForm.matchScope,
    matchMode: ruleForm.matchMode,
    keywords,
    priority: ruleForm.priority,
    enabled: ruleForm.enabled,
    remark: ruleForm.remark?.trim() || undefined,
  }
}

async function submitRule() {
  const request = ruleRequestFromForm()
  if (!request) return
  submitting.value = true
  try {
    if (editingRuleId.value) {
      await updateSystemAlertRule(editingRuleId.value, request)
      ElMessage.success('过滤规则已保存')
    } else {
      await createSystemAlertRule(request)
      ElMessage.success('过滤规则已新增')
    }
    ruleDrawerVisible.value = false
    await loadRules()
  } catch (error) {
    ElMessage.error('保存过滤规则失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function removeRule(row: SystemAlertRule) {
  await ElMessageBox.confirm(`确认删除过滤规则「${row.ruleName}」？`, '删除确认', { type: 'warning' })
  try {
    await deleteSystemAlertRule(row.id)
    ElMessage.success('过滤规则已删除')
    await loadRules()
  } catch (error) {
    ElMessage.error('删除过滤规则失败')
    console.error(error)
  }
}

function ruleActionLabel(value: SystemAlertRuleAction) {
  return ({ IGNORE: '忽略', SLOW_SQL: '归入慢 SQL', SYSTEM_ERROR: '归入系统异常' })[value]
}

function ruleActionTag(value: SystemAlertRuleAction) {
  return ({ IGNORE: 'info', SLOW_SQL: 'warning', SYSTEM_ERROR: 'danger' } as const)[value]
}

function ruleScopeLabel(value: SystemAlertRuleMatchScope) {
  return value === 'MESSAGE' ? '消息正文' : '全部文本'
}

function ruleModeLabel(value: SystemAlertRuleMatchMode) {
  return value === 'ANY' ? '任一关键词' : '全部关键词'
}

function handlePageChange(page: number) {
  filters.page = page
  void loadDashboard()
}

function refreshCurrentTab() {
  if (activeTab.value === 'subsystems') {
    void loadSubsystems()
    return
  }
  if (activeTab.value === 'rules') {
    void loadRules()
    return
  }
  void loadDashboard()
}

function handleTabChange() {
  filters.page = 1
  refreshCurrentTab()
}

function eventMessage(row: SystemAlertEvent) {
  return row.message || row.title || row.errorType || '-'
}

function canCopyTraceId(traceId?: string | null) {
  return Boolean(traceId?.trim()) && traceId?.trim().toUpperCase() !== 'N/A'
}

async function copyTraceId(traceId?: string | null) {
  const text = traceId?.trim()
  if (!text || text.toUpperCase() === 'N/A') return
  try {
    await copyTextToClipboard(text)
    ElMessage.success('Trace ID 已复制')
  } catch (error) {
    ElMessage.error('Trace ID 复制失败')
    console.error(error)
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

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadDashboard(), loadSubsystems(), loadRules()])
})
</script>

<template>
  <div class="page-card system-alert-page">
    <div class="alert-tab-toolbar">
      <el-tabs v-model="activeTab" class="alert-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="系统异常" name="systemError" />
        <el-tab-pane label="慢 SQL" name="slowSql" />
        <el-tab-pane label="关注子系统" name="subsystems" />
        <el-tab-pane label="过滤规则" name="rules" />
      </el-tabs>
      <div class="header-buttons">
        <el-button @click="refreshCurrentTab">刷新</el-button>
        <el-button v-if="activeTab === 'subsystems' && canCreate" type="primary" @click="openCreate">新增关注子系统</el-button>
        <el-button v-if="activeTab === 'rules' && canCreate" type="primary" @click="openCreateRule">新增过滤规则</el-button>
      </div>
    </div>

    <el-form
      v-if="activeTab === 'systemError' || activeTab === 'slowSql'"
      inline
      class="filter-form"
      @submit.prevent="loadDashboard"
    >
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
          :shortcuts="timeRangeShortcuts"
          clearable
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 360px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDashboard">查询</el-button>
      </el-form-item>
    </el-form>

    <el-form v-else-if="activeTab === 'subsystems'" inline class="filter-form" @submit.prevent="loadSubsystems">
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
      <el-form-item>
        <el-button type="primary" @click="loadSubsystems">查询</el-button>
      </el-form-item>
    </el-form>

    <el-form v-else inline class="filter-form" @submit.prevent="loadRules">
      <el-form-item label="关键词">
        <el-input v-model="ruleFilters.keyword" clearable placeholder="规则名称、关键词或备注" style="width: 280px" />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="ruleFilters.enabledOnly">仅看启用</el-checkbox>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadRules">查询</el-button>
      </el-form-item>
    </el-form>

    <template v-if="activeTab === 'systemError' || activeTab === 'slowSql'">
    <el-tabs v-if="activeTab === 'systemError'" v-model="activeSystemErrorTab" class="event-detail-tabs">
      <el-tab-pane label="最近系统异常事件" name="events" />
      <el-tab-pane label="系统异常汇总" name="summary" />
    </el-tabs>

    <template v-if="activeTab === 'slowSql' || activeSystemErrorTab === 'summary'">
    <div v-if="activeTab === 'slowSql'" class="section-title">{{ eventSummaryLabel }}</div>
    <el-table v-loading="loading" :data="dashboard.summaries" class="summary-table">
      <el-table-column prop="businessLineCode" label="业务线" width="140" />
      <el-table-column prop="environmentCode" label="环境" width="90" />
      <el-table-column prop="subsystemName" label="子系统" min-width="150" show-overflow-tooltip />
      <el-table-column prop="serviceName" label="服务名" min-width="160" show-overflow-tooltip />
      <el-table-column :label="eventCountLabel" width="110">
        <template #default="{ row }">
          <el-tag :type="row.errorCount > 0 ? 'danger' : 'success'">{{ row.errorCount }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近发生时间" width="180">
        <template #default="{ row }">{{ readableTime(row.latestOccurredAt) }}</template>
      </el-table-column>
    </el-table>
    </template>

    <template v-if="activeTab === 'slowSql' || activeSystemErrorTab === 'events'">
    <div v-if="activeTab === 'slowSql'" class="section-title">最近{{ eventMetricLabel }}</div>
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
      <el-table-column label="错误消息" min-width="480">
        <template #default="{ row }">
          <div class="event-message-cell">{{ eventMessage(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Trace ID" width="190">
        <template #default="{ row }">
          <div class="trace-id-cell">
            <span class="trace-id-text" :title="row.traceId || ''">{{ row.traceId || '-' }}</span>
            <el-tooltip v-if="canCopyTraceId(row.traceId)" content="复制 Trace ID" placement="top">
              <el-button
                :icon="DocumentCopy"
                link
                type="primary"
                aria-label="复制 Trace ID"
                @click="copyTraceId(row.traceId)"
              />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
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
    </template>
    </template>

    <template v-else-if="activeTab === 'subsystems'">
    <el-table v-loading="subsystemLoading" :data="subsystems" row-key="id">
      <el-table-column prop="businessLineCode" label="业务线" width="140" />
      <el-table-column prop="environmentCode" label="环境" width="90" />
      <el-table-column prop="subsystemName" label="子系统名称" min-width="150" />
      <el-table-column prop="serviceName" label="服务名" min-width="160" />
      <el-table-column label="日志索引模式" min-width="220">
        <template #default="{ row }">
          <div class="index-pattern-tags">
            <el-tag v-for="pattern in row.indexPatterns" :key="pattern" type="info">{{ pattern }}</el-tag>
            <span v-if="!row.indexPatterns.length">-</span>
          </div>
        </template>
      </el-table-column>
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
    </template>

    <template v-else>
      <el-alert
        title="规则仅影响后续采集；优先级越小越先匹配，第一条命中后即停止。未命中规则的日志归入系统异常。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-table v-loading="ruleLoading" :data="rules" row-key="id">
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column prop="ruleName" label="规则名称" min-width="170" show-overflow-tooltip />
        <el-table-column label="处理动作" width="130">
          <template #default="{ row }">
            <el-tag :type="ruleActionTag(row.action)">{{ ruleActionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配范围" width="110">
          <template #default="{ row }">{{ ruleScopeLabel(row.matchScope) }}</template>
        </el-table-column>
        <el-table-column label="匹配方式" width="110">
          <template #default="{ row }">{{ ruleModeLabel(row.matchMode) }}</template>
        </el-table-column>
        <el-table-column label="关键词" min-width="260">
          <template #default="{ row }">
            <div class="index-pattern-tags">
              <el-tag v-for="keyword in row.keywords" :key="keyword" type="info">{{ keyword }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canUpdate" link type="primary" @click="openEditRule(row)">编辑</el-button>
            <el-button v-if="canDelete" link type="danger" @click="removeRule(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
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
      <el-form-item label="日志索引模式" required>
        <div class="index-pattern-editor">
          <div v-for="(_pattern, index) in form.indexPatterns" :key="index" class="index-pattern-row">
            <el-input v-model="form.indexPatterns[index]" placeholder="例如 amp-saps-*" />
            <el-button type="danger" plain @click="removeIndexPattern(index)">删除</el-button>
          </div>
          <el-button type="primary" plain @click="addIndexPattern">添加索引模式</el-button>
          <span class="field-tip">同一子系统可配置多个索引模式，采集时合并查询。</span>
        </div>
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

  <el-drawer v-model="ruleDrawerVisible" :title="editingRuleId ? '编辑过滤规则' : '新增过滤规则'" size="560px">
    <el-form label-position="top" class="drawer-form">
      <el-alert
        title="保存后从下一次日志采集开始生效，不会自动重分历史事件。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-form-item label="规则名称" required>
        <el-input v-model="ruleForm.ruleName" maxlength="128" placeholder="例如：Druid 空闲连接日志" />
      </el-form-item>
      <el-form-item label="处理动作" required>
        <el-radio-group v-model="ruleForm.action">
          <el-radio-button value="IGNORE">忽略</el-radio-button>
          <el-radio-button value="SLOW_SQL">归入慢 SQL</el-radio-button>
          <el-radio-button value="SYSTEM_ERROR">归入系统异常</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <div class="rule-option-row">
        <el-form-item label="匹配范围" required>
          <el-select v-model="ruleForm.matchScope" style="width: 100%">
            <el-option label="消息正文" value="MESSAGE" />
            <el-option label="全部文本（标题、类型、堆栈等）" value="ALL_TEXT" />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配方式" required>
          <el-select v-model="ruleForm.matchMode" style="width: 100%">
            <el-option label="命中任一关键词" value="ANY" />
            <el-option label="命中全部关键词" value="ALL" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="匹配关键词" required>
        <div class="index-pattern-editor">
          <div v-for="(_keyword, index) in ruleForm.keywords" :key="index" class="index-pattern-row">
            <el-input v-model="ruleForm.keywords[index]" maxlength="255" placeholder="输入要匹配的文本片段" />
            <el-button type="danger" plain @click="removeRuleKeyword(index)">删除</el-button>
          </div>
          <el-button type="primary" plain @click="addRuleKeyword">添加关键词</el-button>
          <span class="field-tip">“任一”表示任一关键词命中；“全部”表示所有关键词都需命中。</span>
        </div>
      </el-form-item>
      <div class="rule-option-row">
        <el-form-item label="优先级" required>
          <el-input-number v-model="ruleForm.priority" :min="0" :max="100000" controls-position="right" style="width: 100%" />
          <span class="field-tip">数值越小越先匹配。</span>
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </div>
      <el-form-item label="备注">
        <el-input v-model="ruleForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="ruleDrawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitRule">保存</el-button>
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

.alert-tab-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.alert-tabs {
  min-width: 0;
  flex: 1;
}

.alert-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.index-pattern-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.index-pattern-editor {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
}

.index-pattern-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.rule-option-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.trace-id-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.trace-id-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-message-cell {
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.section-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.summary-table {
  margin-top: -4px;
}

.event-detail-tabs {
  margin-bottom: -6px;
}

@media (max-width: 900px) {
  .rule-option-row {
    grid-template-columns: 1fr;
  }
}
</style>
