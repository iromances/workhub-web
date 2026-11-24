<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AccountingSqlEvidence from './AccountingSqlEvidence.vue'
import AccountingRuleCatalog from './AccountingRuleCatalog.vue'

import {
  createAccountingConfig,
  fetchAccountingDashboard,
  fetchAccountingRunDetail,
  fetchAccountingRuns,
  fetchAccountingScenarios,
  fetchAccountingRules,
  fetchAccountingSqlEvidence,
  retryAccountingRun,
  submitAccountingManualRun,
  updateAccountingConfig,
  type AccountingSqlEvidence as AccountingSqlEvidenceRow,
} from '@/api/accounting'
import { useAuthStore } from '@/stores/auth'
import type {
  AccountingDashboard,
  AccountingMonitorConfig,
  AccountingMonitorSaveRequest,
  AccountingResult,
  AccountingRun,
  AccountingRunDetail,
  AccountingScenarioType,
  AccountingScenarioTypeCode,
  ExpectedCountSource,
} from '@/types/accounting'

const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const dashboard = ref<AccountingDashboard | null>(null)
const detail = ref<AccountingRunDetail | null>(null)
const scenarioTypes = ref<AccountingScenarioType[]>([])
const detailVisible = ref(false)
const manualVisible = ref(false)
const configVisible = ref(false)
const editingConfigId = ref<number | null>(null)
const configDetailVisible = ref(false)
const configDetail = ref<AccountingMonitorConfig | null>(null)
const configDetailTab = ref<'info' | 'runs'>('info')
const configRuns = ref<AccountingRun[]>([])
const configRunTotal = ref(0)
const configRunLoading = ref(false)

const filters = reactive({
  businessLineCode: '',
})

const configRunFilters = reactive({
  status: '',
  page: 1,
  pageSize: 10,
})

const manualForm = reactive({
  configId: undefined as number | undefined,
  checkDate: '',
})

const expectedSource = ref<ExpectedCountSource>('SQL')

const configForm = reactive({
  businessLineCode: '',
  environmentCode: 'PROD',
  systemName: '',
  displayName: '',
  scenarioType: 'BATCH_WITHHOLD' as AccountingScenarioTypeCode,
  expectedTime: '',
  checkTime: '08:30:00',
  expectedCountSqlCode: '',
  expectedFixedCount: undefined as number | undefined,
  actualCountSqlCode: '',
  successCountSqlCode: '',
  toleranceRate: 0,
  alertEnabled: false,
  enabled: false,
  remark: '',
})

const monitors = computed(() => dashboard.value?.monitors || [])
const configs = computed(() => monitors.value.map((item) => item.config))
const runnableConfigs = computed(() => configs.value.filter((item) => item.enabled))
const businessLineOptions = computed(() => {
  const map = new Map<string, string>()
  configs.value.forEach((item) => map.set(item.businessLineCode, item.businessLineName || item.businessLineCode))
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
})
const canRun = computed(() => authStore.hasAnyPermission(['ops:accounting:run', 'ops:accounting:manage']))
const canManage = computed(() => authStore.hasPermission('ops:accounting:manage'))
const integrityConfig = computed(() => configForm.scenarioType === 'ACCOUNTING_INTEGRITY')
const integrityManual = computed(() => configs.value.find(c => c.id === manualForm.configId)?.scenarioType === 'ACCOUNTING_INTEGRITY')

const selectedScenario = computed(() =>
  scenarioTypes.value.find((item) => item.type === configForm.scenarioType),
)

function scenarioName(type?: string | null) {
  if (!type) return '-'
  return scenarioTypes.value.find((item) => item.type === type)?.name || type
}

function formatTimePart(value?: string | null) {
  if (!value) return '-'
  return value.length > 5 ? value.slice(0, 5) : value
}

function formatCheckDate(value?: string | null) {
  return value ? value.slice(0, 10) : '全量'
}

function expectedSourceText(config: AccountingMonitorConfig) {
  if (config.scenarioType === 'ACCOUNTING_INTEGRITY') return '内置单据及支付核验规则'
  if (config.expectedCountSqlCode) return `SQL ${config.expectedCountSqlCode}`
  return `固定 ${config.expectedFixedCount ?? 0} 笔`
}

function disabledFutureDate(date: Date) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date.getTime() > today.getTime()
}

async function loadDashboard() {
  dashboard.value = await fetchAccountingDashboard(filters.businessLineCode || undefined)
}

async function loadAll() {
  loading.value = true
  try {
    await loadDashboard()
  } catch (error) {
    ElMessage.error('加载业务监测数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadConfigRuns() {
  if (!configDetail.value) return
  configRunLoading.value = true
  try {
    const page = await fetchAccountingRuns({
      configId: configDetail.value.id,
      status: configRunFilters.status || undefined,
      page: configRunFilters.page,
      pageSize: configRunFilters.pageSize,
    })
    configRuns.value = page.items
    configRunTotal.value = page.total
  } finally {
    configRunLoading.value = false
  }
}

function openConfigDetail(config: AccountingMonitorConfig) {
  configDetail.value = config
  configDetailTab.value = 'info'
  Object.assign(configRunFilters, { status: '', page: 1, pageSize: 10 })
  configRuns.value = []
  configRunTotal.value = 0
  configDetailVisible.value = true
  loadConfigRuns().catch((error) => {
    ElMessage.error('加载核对批次失败')
    console.error(error)
  })
}

async function refreshAfterRunChange(configId?: number) {
  await loadAll()
  if (configDetailVisible.value && configDetail.value?.id === configId) {
    await loadConfigRuns()
  }
}

async function loadScenarios() {
  try {
    scenarioTypes.value = await fetchAccountingScenarios()
  } catch (error) {
    console.error(error)
  }
}

async function search() {
  await loadAll()
}

async function searchConfigRuns() {
  configRunFilters.page = 1
  await loadConfigRuns()
}

async function changeConfigRunPage(page: number) {
  configRunFilters.page = page
  await loadConfigRuns()
}

async function changeConfigRunPageSize(pageSize: number) {
  configRunFilters.pageSize = pageSize
  configRunFilters.page = 1
  await loadConfigRuns()
}

async function openDetail(run: AccountingRun) {
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await fetchAccountingRunDetail(run.id)
  } catch (error) {
    ElMessage.error('加载核对批次详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

/** REQ-372e4ce1：监测维度点击查看 SQL。 */
const dimensionSqlVisible = ref(false)
const dimensionSqlRow = ref<AccountingResult | null>(null)
const dimensionSqlItems = ref<AccountingSqlEvidenceRow[]>([])
const dimensionSqlTotal = ref(0)
const dimensionSqlPage = ref(1)
const dimensionSqlLoading = ref(false)
const dimensionSqlError = ref('')
const rulesCache = new Map<number, Awaited<ReturnType<typeof fetchAccountingRules>>>()

/** 维度 → 关联审计的 rule_family 过滤值：一致性按规则组目录精确匹配，流程场景按执行用途。 */
async function familiesFor(row: AccountingResult): Promise<string[]> {
  if (row.category === '单据支付一致性' && detail.value?.run.configId) {
    const configId = detail.value.run.configId
    if (!rulesCache.has(configId)) {
      rulesCache.set(configId, await fetchAccountingRules(configId))
    }
    const hit = (rulesCache.get(configId) || []).find(family =>
      family.checks.some(check => row.ruleCode === `${family.code}_${check.id}`))
    return hit ? [hit.code] : []
  }
  if (row.ruleCode.endsWith('_STARTED_ON_TIME')) return ['实际发起笔数']
  if (row.ruleCode.endsWith('_EXPECTED_VS_ACTUAL')) return ['应发起笔数', '实际发起笔数']
  if (row.ruleCode.endsWith('_SUCCESS_RATE')) return ['成功笔数', '实际发起笔数']
  return []
}

async function openDimensionSql(row: AccountingResult) {
  dimensionSqlRow.value = row
  dimensionSqlVisible.value = true
  dimensionSqlPage.value = 1
  await loadDimensionSql()
}

async function loadDimensionSql() {
  const runId = detail.value?.run.id
  const row = dimensionSqlRow.value
  if (!runId || !row) return
  dimensionSqlLoading.value = true
  dimensionSqlError.value = ''
  try {
    const families = await familiesFor(row)
    if (!families.length) {
      // 无法映射到规则组/用途时不放宽过滤，直接给空态，避免误导为全部 SQL
      dimensionSqlItems.value = []
      dimensionSqlTotal.value = 0
      return
    }
    const page = await fetchAccountingSqlEvidence(runId, dimensionSqlPage.value, families.join(','))
    dimensionSqlItems.value = page.items
    dimensionSqlTotal.value = page.total
  } catch (error) {
    dimensionSqlError.value = '维度 SQL 读取失败，请重试'
    console.error(error)
  } finally {
    dimensionSqlLoading.value = false
  }
}

function changeDimensionSqlPage(page: number) {
  dimensionSqlPage.value = page
  loadDimensionSql()
}

/** 弹框头部展示的过滤口径（与 familiesFor 保持一致）。 */
function dimensionFamiliesText(row: AccountingResult): string {
  if (row.category === '单据支付一致性') return '规则组（目录精确匹配）'
  if (row.ruleCode.endsWith('_STARTED_ON_TIME')) return '实际发起笔数'
  if (row.ruleCode.endsWith('_EXPECTED_VS_ACTUAL')) return '应发起笔数、实际发起笔数'
  if (row.ruleCode.endsWith('_SUCCESS_RATE')) return '成功笔数、实际发起笔数'
  return '-'
}

function openManual(config?: AccountingMonitorConfig) {
  manualForm.configId = config?.id || runnableConfigs.value[0]?.id
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  manualForm.checkDate = integrityManual.value ? '' : formatCheckDate(yesterday.toISOString())
  manualVisible.value = true
}

async function submitManual() {
  if (!manualForm.configId || (!integrityManual.value && !manualForm.checkDate)) {
    ElMessage.warning('请选择场景配置和核对日期')
    return
  }
  submitting.value = true
  try {
    const run = await submitAccountingManualRun({
      configId: manualForm.configId,
      checkDate: manualForm.checkDate || null,
      requestKey: crypto.randomUUID(),
    })
    ElMessage.success(`核对批次 ${run.runNo} 已提交`)
    manualVisible.value = false
    await refreshAfterRunChange(manualForm.configId)
  } catch (error) {
    ElMessage.error('提交手动核对失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function retry(run: AccountingRun) {
  try {
    const created = await retryAccountingRun(run.id)
    ElMessage.success(`重试批次 ${created.runNo} 已提交`)
    await refreshAfterRunChange(run.configId)
  } catch (error) {
    ElMessage.error('提交重试失败')
    console.error(error)
  }
}

function resetConfigForm() {
  editingConfigId.value = null
  expectedSource.value = 'SQL'
  Object.assign(configForm, {
    businessLineCode: '',
    environmentCode: 'PROD',
    systemName: '',
    displayName: '',
    scenarioType: 'BATCH_WITHHOLD',
    expectedTime: '',
    checkTime: '08:30:00',
    expectedCountSqlCode: '',
    expectedFixedCount: undefined,
    actualCountSqlCode: '',
    successCountSqlCode: '',
    toleranceRate: 0,
    alertEnabled: false,
    enabled: false,
    remark: '',
  })
}

function openCreateConfig() {
  resetConfigForm()
  configVisible.value = true
}

function openEditConfig(config: AccountingMonitorConfig) {
  editingConfigId.value = config.id
  expectedSource.value = config.expectedCountSqlCode ? 'SQL' : 'FIXED'
  Object.assign(configForm, {
    businessLineCode: config.businessLineCode,
    environmentCode: config.environmentCode,
    systemName: config.systemName,
    displayName: config.displayName,
    scenarioType: config.scenarioType,
    expectedTime: config.expectedTime || '',
    checkTime: config.checkTime,
    expectedCountSqlCode: config.expectedCountSqlCode || '',
    expectedFixedCount: config.expectedFixedCount ?? undefined,
    actualCountSqlCode: config.actualCountSqlCode || '',
    successCountSqlCode: config.successCountSqlCode || '',
    toleranceRate: config.toleranceRate,
    alertEnabled: config.alertEnabled,
    enabled: config.enabled,
    remark: config.remark || '',
  })
  configVisible.value = true
}

async function saveConfig() {
  if (!configForm.businessLineCode.trim() || !configForm.systemName.trim() || !configForm.displayName.trim()) {
    ElMessage.warning('请完整填写业务线、系统和名称')
    return
  }
  if (!integrityConfig.value && expectedSource.value === 'SQL' && !configForm.expectedCountSqlCode.trim()) {
    ElMessage.warning('请填写应发起笔数的 func_call_sql 编码')
    return
  }
  if (!integrityConfig.value && expectedSource.value === 'FIXED' && (configForm.expectedFixedCount ?? -1) < 0) {
    ElMessage.warning('请填写非负的固定应发起笔数')
    return
  }
  if (!integrityConfig.value && !configForm.actualCountSqlCode?.trim()) {
    ElMessage.warning('请填写实际发起笔数的 func_call_sql 编码')
    return
  }
  submitting.value = true
  try {
    const request: AccountingMonitorSaveRequest = {
      businessLineCode: configForm.businessLineCode.trim(),
      environmentCode: configForm.environmentCode.trim().toUpperCase(),
      systemName: configForm.systemName.trim(),
      displayName: configForm.displayName.trim(),
      scenarioType: configForm.scenarioType,
      expectedTime: configForm.expectedTime || null,
      checkTime: configForm.checkTime,
      expectedCountSqlCode: !integrityConfig.value && expectedSource.value === 'SQL' ? configForm.expectedCountSqlCode.trim() : null,
      expectedFixedCount: !integrityConfig.value && expectedSource.value === 'FIXED' ? (configForm.expectedFixedCount ?? 0) : null,
      actualCountSqlCode: integrityConfig.value ? null : configForm.actualCountSqlCode?.trim() || null,
      successCountSqlCode: configForm.successCountSqlCode?.trim() || null,
      toleranceRate: configForm.toleranceRate,
      alertEnabled: integrityConfig.value ? false : configForm.alertEnabled,
      enabled: configForm.enabled,
      remark: configForm.remark?.trim() || undefined,
    }
    if (editingConfigId.value) {
      await updateAccountingConfig(editingConfigId.value, request)
    } else {
      await createAccountingConfig(request)
    }
    ElMessage.success('业务监测配置已保存')
    configVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error('保存业务监测配置失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function runStatusType(status?: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'WARNING' || status === 'PARTIAL' || status === 'RUNNING' || status === 'PENDING') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

function resultStatusType(status: string) {
  if (status === 'PASS') return 'success'
  if (status === 'WARN' || status === 'SKIPPED') return 'warning'
  return 'danger'
}

function statusName(status?: string) {
  return {
    PENDING: '等待执行',
    RUNNING: '执行中',
    SUCCESS: '正常',
    WARNING: '发现异常',
    PARTIAL: '部分完成',
    FAILED: '执行失败',
  }[status || ''] || '未执行'
}

function triggerName(trigger: string) {
  return { MANUAL: '手动', SCHEDULED: '自动', RETRY: '重试' }[trigger] || trigger
}

function resultStatusName(status: string) {
  return { PASS: '正常', WARN: '警告', ERROR: '异常', FAILED: '执行失败', SKIPPED: '已跳过' }[status] || status
}

function granularityName(granularity: string) {
  return { SCENARIO: '场景核对', HOURLY: '小时级', DAILY: '日级' }[granularity] || granularity
}

function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatSamples(value?: string) {
  if (!value || value === '[]') {
    return '无'
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

watch(() => route.query.runId, async value => {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) return
  try { await openDetail((await fetchAccountingRunDetail(id)).run) }
  catch { ElMessage.error('无法打开关联核对批次') }
}, { immediate: true })

onMounted(() => {
  loadScenarios()
  loadAll()
})
</script>

<template>
  <div class="accounting-page">
    <section class="page-card">
      <el-form inline class="filter-form" @submit.prevent="search">
        <el-form-item label="业务线">
          <el-select v-model="filters.businessLineCode" clearable placeholder="全部业务线" style="width: 220px">
            <el-option v-for="item in businessLineOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button :loading="loading" @click="loadAll">刷新</el-button>
          <el-button v-if="canManage" @click="openCreateConfig">新增配置</el-button>
          <el-button v-if="canRun" type="primary" @click="openManual()">手动核对</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="monitors" row-key="config.id" empty-text="暂无业务监测配置">
        <el-table-column label="业务线" min-width="160">
          <template #default="{ row }">
            <strong>{{ row.config.businessLineName || row.config.businessLineCode }}</strong>
            <div class="subtle">{{ row.config.businessLineCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="系统 / 场景" min-width="185">
          <template #default="{ row }">
            <div>{{ row.config.systemName }}</div>
            <div class="subtle">{{ scenarioName(row.config.scenarioType) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="预期 / 核对时间" width="135">
          <template #default="{ row }">
            <div v-if="row.config.scenarioType === 'ACCOUNTING_INTEGRITY'">仅手动核验</div>
            <div v-else>预期 {{ formatTimePart(row.config.expectedTime) }}</div>
            <div v-if="row.config.scenarioType !== 'ACCOUNTING_INTEGRITY'" class="subtle">核对 {{ formatTimePart(row.config.checkTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="笔数来源" min-width="230">
          <template #default="{ row }">
            <div class="sql-code">{{ expectedSourceText(row.config) }}</div>
            <div v-if="row.config.actualCountSqlCode" class="subtle sql-code">实 {{ row.config.actualCountSqlCode }}</div>
            <div v-if="row.config.successCountSqlCode" class="subtle sql-code">成 {{ row.config.successCountSqlCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="容差" width="80">
          <template #default="{ row }">{{ (row.config.toleranceRate * 100).toFixed(2).replace(/\.?0+$/, '') }}%</template>
        </el-table-column>
        <el-table-column label="开关" width="130">
          <template #default="{ row }">
            <div><el-tag :type="row.config.enabled ? 'success' : 'info'">{{ row.config.enabled ? '监测启用' : '监测停用' }}</el-tag></div>
            <div class="tag-gap">
              <el-tag :type="row.config.alertEnabled ? 'warning' : 'info'" effect="plain">
                {{ row.config.alertEnabled ? '告警开' : '告警关' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近状态" width="120">
          <template #default="{ row }">
            <el-tag :type="runStatusType(row.latestRun?.status)">
              {{ statusName(row.latestRun?.status) }}
            </el-tag>
            <div v-if="row.latestRun" class="subtle">差 {{ row.latestRun.anomalyCount }} 笔</div>
          </template>
        </el-table-column>
        <el-table-column label="最近核对日" width="120">
          <template #default="{ row }">
            <span v-if="row.latestRun">{{ formatCheckDate(row.latestRun.startTime) }}</span>
            <span v-else class="subtle">尚未执行</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="185" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openConfigDetail(row.config)">详情</el-button>
            <el-button v-if="canRun && row.config.enabled" link type="primary" @click="openManual(row.config)">核对</el-button>
            <el-button v-if="canManage" link type="primary" @click="openEditConfig(row.config)">配置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>

  <el-drawer v-model="manualVisible" title="手动核对" size="520px">
    <el-form label-position="top">
      <el-form-item label="场景配置" required>
        <el-select v-model="manualForm.configId" filterable style="width: 100%">
          <el-option
            v-for="item in runnableConfigs"
            :key="item.id"
            :label="`${item.businessLineName || item.businessLineCode} / ${item.systemName} / ${scenarioName(item.scenarioType)}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="integrityManual ? '核对日期（可选，留空核对全量）' : '核对日期（窗口为该日全天）'" :required="!integrityManual">
        <el-date-picker
          v-model="manualForm.checkDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          :placeholder="integrityManual ? '留空核对全量' : '选择核对日期'"
          :disabled-date="disabledFutureDate"
          style="width: 100%"
        />
      </el-form-item>
      <div class="readonly-note">
        {{ integrityManual ? '核验单据生成、主从明细、结算和支付渠道一致性。日期按来源创建时间筛选，留空全量分批。差额按规则统计，不能相加作为资金损失。仅手动执行。' : '只读核对应发起、实际发起与成功笔数，不修改业务库。' }}
      </div>
    </el-form>
    <template #footer>
      <el-button @click="manualVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitManual">提交核对</el-button>
    </template>
  </el-drawer>

  <el-drawer v-model="configVisible" :title="editingConfigId ? '编辑场景监测配置' : '新增场景监测配置'" size="600px">
    <el-form label-position="top">
      <div class="two-columns">
        <el-form-item label="业务线编码" required>
          <el-input v-model="configForm.businessLineCode" placeholder="BL000001" />
        </el-form-item>
        <el-form-item label="环境" required>
          <el-input v-model="configForm.environmentCode" placeholder="PROD" />
        </el-form-item>
      </div>
      <div class="two-columns">
        <el-form-item label="系统名称" required>
          <el-input v-model="configForm.systemName" placeholder="lease-saps" />
        </el-form-item>
        <el-form-item label="显示名称" required>
          <el-input v-model="configForm.displayName" />
        </el-form-item>
      </div>
      <el-form-item label="场景类型" required>
        <el-select v-model="configForm.scenarioType" style="width: 100%">
          <el-option
            v-for="item in scenarioTypes"
            :key="item.type"
            :label="`${item.name}（${item.description}）`"
            :value="item.type"
          />
        </el-select>
      </el-form-item>
      <div v-if="!integrityConfig" class="two-columns">
        <el-form-item label="预期发生时间">
          <el-time-picker
            v-model="configForm.expectedTime"
            value-format="HH:mm:ss"
            format="HH:mm"
            placeholder="如代扣 08:00"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="每日核对时间" required>
          <el-time-picker
            v-model="configForm.checkTime"
            value-format="HH:mm:ss"
            format="HH:mm"
            placeholder="核对时间"
            style="width: 100%"
          />
        </el-form-item>
      </div>
      <el-form-item v-if="!integrityConfig" label="应发起笔数来源" required>
        <el-radio-group v-model="expectedSource">
          <el-radio value="SQL">func_call_sql 编码</el-radio>
          <el-radio value="FIXED">固定笔数</el-radio>
        </el-radio-group>
        <el-input
          v-if="expectedSource === 'SQL'"
          v-model="configForm.expectedCountSqlCode"
          placeholder="如 OPS_SCN_WITHHOLD_EXPECTED（须已登记并启用）"
          style="margin-top: 8px"
        />
        <el-input-number
          v-else
          v-model="configForm.expectedFixedCount"
          :min="0"
          :step="1"
          step-strictly
          placeholder="固定应发起笔数"
          style="margin-top: 8px; width: 100%"
        />
      </el-form-item>
      <el-form-item v-if="!integrityConfig" label="实际发起笔数 SQL 编码" required>
        <el-input v-model="configForm.actualCountSqlCode" placeholder="如 OPS_SCN_WITHHOLD_ACTUAL" />
      </el-form-item>
      <el-form-item v-if="!integrityConfig" label="成功笔数 SQL 编码（留空则跳过成功率维度）">
        <el-input v-model="configForm.successCountSqlCode" placeholder="如 OPS_SCN_WITHHOLD_SUCCESS" />
      </el-form-item>
      <div class="two-columns">
        <el-form-item v-if="!integrityConfig" label="容差比例（0-1）">
          <el-input-number
            v-model="configForm.toleranceRate"
            :min="0"
            :max="1"
            :step="0.005"
            :precision="4"
            style="width: 100%"
          />
        </el-form-item>
        <div class="switch-row switches-inline">
          <el-form-item v-if="!integrityConfig" label="差异告警">
            <el-switch v-model="configForm.alertEnabled" />
          </el-form-item>
          <el-form-item label="启用监测">
            <el-switch v-model="configForm.enabled" />
          </el-form-item>
        </div>
      </div>
      <el-alert
        v-if="selectedScenario"
        :title="`${selectedScenario.name}：${selectedScenario.description}`"
        type="info"
        :closable="false"
        class="manual-alert"
      />
      <el-form-item label="备注">
        <el-input v-model="configForm.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="configVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="saveConfig">保存</el-button>
    </template>
  </el-drawer>

  <el-dialog v-model="configDetailVisible" :title="`场景监测配置详情：${configDetail?.displayName || ''}`" width="1080px">
    <el-tabs v-model="configDetailTab">
      <el-tab-pane label="配置信息" name="info">
        <el-descriptions v-if="configDetail" :column="2" border class="config-descriptions">
          <el-descriptions-item label="业务线">
            {{ configDetail.businessLineName || configDetail.businessLineCode }}（{{ configDetail.businessLineCode }}）
          </el-descriptions-item>
          <el-descriptions-item label="环境">{{ configDetail.environmentCode }}</el-descriptions-item>
          <el-descriptions-item label="系统">{{ configDetail.systemName }}</el-descriptions-item>
          <el-descriptions-item label="显示名称">{{ configDetail.displayName }}</el-descriptions-item>
          <el-descriptions-item label="场景类型">{{ scenarioName(configDetail.scenarioType) }}</el-descriptions-item>
          <el-descriptions-item label="预期 / 核对时间">
            <span v-if="configDetail.scenarioType === 'ACCOUNTING_INTEGRITY'">仅手动核验</span>
            <span v-else>预期 {{ formatTimePart(configDetail.expectedTime) }} / 核对 {{ formatTimePart(configDetail.checkTime) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="笔数来源" :span="2">
            <div class="sql-code">{{ expectedSourceText(configDetail) }}</div>
            <div v-if="configDetail.actualCountSqlCode" class="subtle sql-code">实 {{ configDetail.actualCountSqlCode }}</div>
            <div v-if="configDetail.successCountSqlCode" class="subtle sql-code">成 {{ configDetail.successCountSqlCode }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="容差比例">
            {{ (configDetail.toleranceRate * 100).toFixed(2).replace(/\.?0+$/, '') }}%
          </el-descriptions-item>
          <el-descriptions-item label="开关">
            <span class="switch-tags">
              <el-tag :type="configDetail.enabled ? 'success' : 'info'">{{ configDetail.enabled ? '监测启用' : '监测停用' }}</el-tag>
              <el-tag :type="configDetail.alertEnabled ? 'warning' : 'info'" effect="plain">
                {{ configDetail.alertEnabled ? '告警开' : '告警关' }}
              </el-tag>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ configDetail.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建 / 更新时间" :span="2">{{ configDetail.createdAt }} / {{ configDetail.updatedAt }}</el-descriptions-item>
        </el-descriptions>
        <AccountingRuleCatalog v-if="configDetail?.scenarioType === 'ACCOUNTING_INTEGRITY'" :config-id="configDetail.id" />
      </el-tab-pane>
      <el-tab-pane label="核对批次" name="runs">
        <el-form inline class="filter-form" @submit.prevent="searchConfigRuns">
          <el-form-item label="批次状态">
            <el-select v-model="configRunFilters.status" clearable placeholder="全部状态" style="width: 150px">
              <el-option label="等待执行" value="PENDING" />
              <el-option label="执行中" value="RUNNING" />
              <el-option label="正常" value="SUCCESS" />
              <el-option label="发现异常" value="WARNING" />
              <el-option label="部分完成" value="PARTIAL" />
              <el-option label="执行失败" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchConfigRuns">查询</el-button>
          </el-form-item>
        </el-form>
        <el-table v-loading="configRunLoading" :data="configRuns" row-key="id" empty-text="暂无核对批次">
          <el-table-column prop="runNo" label="批次号" min-width="190" show-overflow-tooltip />
          <el-table-column label="来源" width="85">
            <template #default="{ row }">{{ triggerName(row.triggerType) }}</template>
          </el-table-column>
          <el-table-column label="核对日" width="115">
            <template #default="{ row }">{{ formatCheckDate(row.startTime) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="runStatusType(row.status)">{{ statusName(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="anomalyCount" label="差异数" width="90" />
          <el-table-column prop="requestedBy" label="发起人" width="110" />
          <el-table-column prop="createdAt" label="创建时间" width="175" />
          <el-table-column label="操作" width="135" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="canRun && ['FAILED', 'PARTIAL', 'WARNING'].includes(row.status)"
                link
                type="primary"
                @click="retry(row)"
              >
                重试
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next"
            :total="configRunTotal"
            :current-page="configRunFilters.page"
            :page-size="configRunFilters.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="changeConfigRunPage"
            @size-change="changeConfigRunPageSize"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>

  <el-dialog v-model="detailVisible" title="核对批次详情" width="1180px">
    <div v-if="detail?.run" class="detail-head">
      <div><span>批次号</span><strong>{{ detail.run.runNo }}</strong></div>
      <div><span>状态</span><el-tag :type="runStatusType(detail.run.status)">{{ statusName(detail.run.status) }}</el-tag></div>
      <div><span>系统</span><strong>{{ detail.run.displayName }}</strong></div>
      <div><span>核对日</span><strong>{{ formatCheckDate(detail.run.startTime) }}</strong></div>
    </div>
    <el-alert
      v-if="detail?.run.errorMessage"
      :title="detail.run.errorMessage"
      type="error"
      :closable="false"
      show-icon
      class="detail-alert"
    />
    <el-table v-loading="detailLoading" :data="detail?.results || []" row-key="id" max-height="560">
      <el-table-column prop="ruleName" label="监测维度" min-width="200">
        <template #default="{ row }">
          <el-button link type="primary" class="dimension-link" @click="openDimensionSql(row)">
            {{ row.ruleName }}
          </el-button>
          <div class="subtle">{{ row.ruleCode }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="场景" width="100" />
      <el-table-column label="粒度" width="100">
        <template #default="{ row }">{{ granularityName(row.granularity) }}</template>
      </el-table-column>
      <el-table-column label="结果" width="105">
        <template #default="{ row }">
          <el-tag :type="resultStatusType(row.status)">{{ resultStatusName(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="anomalyCount" label="差异数" width="90" />
      <el-table-column label="差异金额" width="130">
        <template #default="{ row }">{{ formatMoney(row.differenceAmount) }}</template>
      </el-table-column>
      <el-table-column prop="durationMs" label="耗时(ms)" width="100" />
      <el-table-column prop="message" label="说明" min-width="280" show-overflow-tooltip />
      <el-table-column label="样例" width="90">
        <template #default="{ row }">
          <el-popover v-if="row.sampleJson && row.sampleJson !== '[]'" placement="left" :width="520" trigger="click">
            <template #reference><el-button link type="primary">查看</el-button></template>
            <pre class="sample-json">{{ formatSamples(row.sampleJson) }}</pre>
          </el-popover>
          <span v-else class="subtle">-</span>
        </template>
      </el-table-column>
    </el-table>
    <AccountingSqlEvidence v-if="detailVisible && detail?.run" :run-id="detail.run.id" />
  </el-dialog>

  <el-dialog
    v-model="dimensionSqlVisible"
    :title="`监测维度 SQL · ${dimensionSqlRow?.ruleName || ''}`"
    width="980px"
    append-to-body
  >
    <div v-if="dimensionSqlRow" class="detail-head">
      <div><span>规则编码</span><strong class="sql-code">{{ dimensionSqlRow.ruleCode }}</strong></div>
      <div><span>规则组过滤</span><strong>{{ dimensionFamiliesText(dimensionSqlRow) }}</strong></div>
    </div>
    <el-alert v-if="dimensionSqlError" :title="dimensionSqlError" type="error" :closable="false" />
    <el-table
      v-else
      v-loading="dimensionSqlLoading"
      :data="dimensionSqlItems"
      row-key="id"
      max-height="480"
      empty-text="该维度没有关联的 SQL 审计；旧批次不按时间推测关联，不能据此判定核验通过。"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="snapshot">
            <p>证据 #{{ row.id }} · 规则组 {{ row.ruleFamily }}</p>
            <p>模板 SHA-256：{{ row.templateHash }}</p>
            <p>参数：{{ row.parametersJson }}</p>
            <p>{{ row.startedAt }} — {{ row.finishedAt }}</p>
            <el-alert v-if="row.errorMessage" :title="row.errorMessage" type="error" :closable="false" />
            <pre>{{ row.renderedSql }}</pre>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="sqlCode" label="SQL 编码" min-width="260" />
      <el-table-column prop="ruleFamily" label="规则组" min-width="120" show-overflow-tooltip />
      <el-table-column prop="status" label="执行状态" width="100" />
      <el-table-column prop="startedAt" label="执行时间" width="180" />
      <el-table-column prop="rowCount" label="返回行数" width="95" />
      <el-table-column prop="durationMs" label="耗时(ms)" width="95" />
    </el-table>
    <div class="pagination">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="dimensionSqlTotal"
        :current-page="dimensionSqlPage"
        :page-size="20"
        @current-change="changeDimensionSqlPage"
      />
    </div>
  </el-dialog>
</template>

<style scoped>
.accounting-page {
  display: grid;
  gap: 16px;
}

.page-card {
  padding: 22px 24px;
}

.filter-form {
  margin-top: 18px;
}

.page-card > .filter-form {
  margin-top: 0;
}

.subtle {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 12px;
}

.sql-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.tag-gap {
  margin-top: 5px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.manual-alert,
.detail-alert {
  margin-bottom: 18px;
}

.readonly-note {
  padding: 12px 14px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  line-height: 1.6;
}

.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.switch-row {
  display: grid;
  gap: 16px;
}

.switches-inline {
  grid-template-columns: 1fr 1fr;
  align-items: end;
}

.detail-head {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 1fr 0.8fr;
  gap: 12px;
  margin-bottom: 18px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.detail-head span {
  display: block;
  margin-bottom: 5px;
  color: #64748b;
  font-size: 12px;
}

.config-descriptions {
  margin-bottom: 16px;
}

.switch-tags .el-tag + .el-tag {
  margin-left: 8px;
}

.sample-json {
  max-height: 380px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.dimension-link {
  height: auto;
  padding: 0;
  white-space: normal;
  text-align: left;
}

.snapshot {
  padding: 12px 24px;
  overflow-wrap: anywhere;
}

.snapshot pre {
  max-height: 360px;
  padding: 16px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f5f7fa;
}
</style>
