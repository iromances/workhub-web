<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createAccountingConfig,
  fetchAccountingDashboard,
  fetchAccountingRules,
  fetchAccountingRunDetail,
  fetchAccountingRuns,
  retryAccountingRun,
  submitAccountingManualRun,
  updateAccountingConfig,
} from '@/api/accounting'
import { useAuthStore } from '@/stores/auth'
import type {
  AccountingDashboard,
  AccountingMonitorConfig,
  AccountingMonitorSaveRequest,
  AccountingRule,
  AccountingRun,
  AccountingRunDetail,
} from '@/types/accounting'

const authStore = useAuthStore()
const loading = ref(false)
const runLoading = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const dashboard = ref<AccountingDashboard | null>(null)
const runs = ref<AccountingRun[]>([])
const runTotal = ref(0)
const detail = ref<AccountingRunDetail | null>(null)
const rules = ref<AccountingRule[]>([])
const detailVisible = ref(false)
const manualVisible = ref(false)
const configVisible = ref(false)
const editingConfigId = ref<number | null>(null)

const filters = reactive({
  businessLineCode: '',
  status: '',
  page: 1,
  pageSize: 20,
})

const manualForm = reactive({
  configId: undefined as number | undefined,
  timeRange: [] as string[],
  ruleCodes: [] as string[],
})

const configForm = reactive<AccountingMonitorSaveRequest>({
  businessLineCode: '',
  environmentCode: 'prod',
  systemName: '',
  displayName: '',
  databaseTargetKey: '',
  schemaName: '',
  ruleProfile: 'COMMON_SAPS',
  enabled: false,
  dailyEnabled: false,
  remark: '',
})

const profileOptions = [
  'COMMON_SAPS',
  'SCF_SAPS',
  'LEASE_SAPS',
  'JIATAI_AMP_SAPS',
  'ASSETS_SAPS',
  'EQUIP_LEASE_SAPS',
  'OL_SAPS',
  'AMP_SAPS',
  'LOGISTICS_SAPS',
]

const monitors = computed(() => dashboard.value?.monitors || [])
const summary = computed(() => dashboard.value?.summary)
const configs = computed(() => monitors.value.map((item) => item.config))
const runnableConfigs = computed(() =>
  configs.value.filter((item) => item.enabled && Boolean(item.databaseTargetKey)),
)
const businessLineOptions = computed(() => {
  const map = new Map<string, string>()
  configs.value.forEach((item) => map.set(item.businessLineCode, item.businessLineName || item.businessLineCode))
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
})
const canRun = computed(() => authStore.hasAnyPermission(['ops:accounting:run', 'ops:accounting:manage']))
const canManage = computed(() => authStore.hasPermission('ops:accounting:manage'))
const selectedManualConfig = computed(() =>
  configs.value.find((item) => item.id === manualForm.configId),
)
const partialDayWindow = computed(() => {
  if (manualForm.timeRange.length !== 2) {
    return false
  }
  return !manualForm.timeRange.every((item) => item.includes('T00:00:00'))
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatHour(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00:00`
}

function resetManualRange() {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 1)
  manualForm.timeRange = [formatHour(start), formatHour(end)]
}

async function loadDashboard() {
  dashboard.value = await fetchAccountingDashboard(filters.businessLineCode || undefined)
}

async function loadRuns() {
  runLoading.value = true
  try {
    const page = await fetchAccountingRuns({
      businessLineCode: filters.businessLineCode || undefined,
      status: filters.status || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    })
    runs.value = page.items
    runTotal.value = page.total
  } finally {
    runLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadDashboard(), loadRuns()])
  } catch (error) {
    ElMessage.error('加载账务监测数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function search() {
  filters.page = 1
  await loadAll()
}

async function changePage(page: number) {
  filters.page = page
  await loadRuns()
}

async function changePageSize(pageSize: number) {
  filters.pageSize = pageSize
  filters.page = 1
  await loadRuns()
}

async function openDetail(run: AccountingRun) {
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await fetchAccountingRunDetail(run.id)
  } catch (error) {
    ElMessage.error('加载对账批次详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

async function loadRulesForManual() {
  rules.value = []
  manualForm.ruleCodes = []
  const config = selectedManualConfig.value
  if (!config) {
    return
  }
  try {
    rules.value = await fetchAccountingRules(config.ruleProfile)
    manualForm.ruleCodes = rules.value.map((item) => item.ruleCode)
  } catch (error) {
    ElMessage.error('加载账务规则失败')
    console.error(error)
  }
}

function openManual(config?: AccountingMonitorConfig) {
  resetManualRange()
  manualForm.configId = config?.id || runnableConfigs.value[0]?.id
  manualVisible.value = true
}

async function submitManual() {
  if (!manualForm.configId || manualForm.timeRange.length !== 2) {
    ElMessage.warning('请选择账务系统和对账时间区间')
    return
  }
  submitting.value = true
  try {
    const run = await submitAccountingManualRun({
      configId: manualForm.configId,
      startTime: manualForm.timeRange[0],
      endTime: manualForm.timeRange[1],
      ruleCodes: manualForm.ruleCodes,
      requestKey: crypto.randomUUID(),
    })
    ElMessage.success(`对账批次 ${run.runNo} 已提交`)
    manualVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error('提交手动对账失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function retry(run: AccountingRun) {
  try {
    const created = await retryAccountingRun(run.id)
    ElMessage.success(`重试批次 ${created.runNo} 已提交`)
    await loadAll()
  } catch (error) {
    ElMessage.error('提交重试失败')
    console.error(error)
  }
}

function resetConfigForm() {
  editingConfigId.value = null
  Object.assign(configForm, {
    businessLineCode: '',
    environmentCode: 'prod',
    systemName: '',
    displayName: '',
    databaseTargetKey: '',
    schemaName: '',
    ruleProfile: 'COMMON_SAPS',
    enabled: false,
    dailyEnabled: false,
    remark: '',
  })
}

function openCreateConfig() {
  resetConfigForm()
  configVisible.value = true
}

function openEditConfig(config: AccountingMonitorConfig) {
  editingConfigId.value = config.id
  Object.assign(configForm, {
    businessLineCode: config.businessLineCode,
    environmentCode: config.environmentCode,
    systemName: config.systemName,
    displayName: config.displayName,
    databaseTargetKey: config.databaseTargetKey || '',
    schemaName: config.schemaName,
    ruleProfile: config.ruleProfile,
    enabled: config.enabled,
    dailyEnabled: config.dailyEnabled,
    remark: config.remark || '',
  })
  configVisible.value = true
}

async function saveConfig() {
  if (
    !configForm.businessLineCode.trim()
    || !configForm.systemName.trim()
    || !configForm.displayName.trim()
    || !configForm.schemaName.trim()
  ) {
    ElMessage.warning('请完整填写业务线、系统、名称和 schema')
    return
  }
  if ((configForm.enabled || configForm.dailyEnabled) && !configForm.databaseTargetKey?.trim()) {
    ElMessage.warning('启用监测前必须填写生产 DB 目标')
    return
  }
  submitting.value = true
  try {
    const request: AccountingMonitorSaveRequest = {
      ...configForm,
      businessLineCode: configForm.businessLineCode.trim(),
      environmentCode: configForm.environmentCode.trim(),
      systemName: configForm.systemName.trim(),
      displayName: configForm.displayName.trim(),
      databaseTargetKey: configForm.databaseTargetKey?.trim() || undefined,
      schemaName: configForm.schemaName.trim(),
      remark: configForm.remark?.trim() || undefined,
    }
    if (editingConfigId.value) {
      await updateAccountingConfig(editingConfigId.value, request)
    } else {
      await createAccountingConfig(request)
    }
    ElMessage.success('账务监测配置已保存')
    configVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error('保存账务监测配置失败')
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
  return { MANUAL: '手动', SCHEDULED: '每日', RETRY: '重试' }[trigger] || trigger
}

function resultStatusName(status: string) {
  return { PASS: '正常', WARN: '警告', ERROR: '异常', FAILED: '执行失败', SKIPPED: '已跳过' }[status] || status
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

watch(() => manualForm.configId, loadRulesForManual)

onMounted(loadAll)
</script>

<template>
  <div class="accounting-page">
    <section class="page-card page-header">
      <div>
        <h2>账务监测</h2>
        <p>通过生产 MCP 只读通道检查账单、对账单和交易数据；自动调度默认关闭。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="loading" @click="loadAll">刷新</el-button>
        <el-button v-if="canManage" @click="openCreateConfig">新增配置</el-button>
        <el-button v-if="canRun" type="primary" @click="openManual()">手动对账</el-button>
      </div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span>监测系统</span>
        <strong>{{ summary?.monitorCount || 0 }}</strong>
      </div>
      <div class="summary-card running">
        <span>执行中</span>
        <strong>{{ summary?.runningCount || 0 }}</strong>
      </div>
      <div class="summary-card success">
        <span>最近正常</span>
        <strong>{{ summary?.successCount || 0 }}</strong>
      </div>
      <div class="summary-card warning">
        <span>最近有异常</span>
        <strong>{{ summary?.warningCount || 0 }}</strong>
      </div>
      <div class="summary-card danger">
        <span>执行失败</span>
        <strong>{{ summary?.errorCount || 0 }}</strong>
      </div>
      <div class="summary-card danger">
        <span>异常数据</span>
        <strong>{{ summary?.anomalyCount || 0 }}</strong>
      </div>
    </section>

    <section class="page-card">
      <div class="section-title">
        <div>
          <h3>业务线监测状态</h3>
          <p>业务系统只读，WorkHub 仅保存规则结果和脱敏样例。</p>
        </div>
      </div>
      <el-form inline class="filter-form" @submit.prevent="search">
        <el-form-item label="业务线">
          <el-select v-model="filters.businessLineCode" clearable placeholder="全部业务线" style="width: 220px">
            <el-option v-for="item in businessLineOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 150px">
            <el-option label="等待执行" value="PENDING" />
            <el-option label="执行中" value="RUNNING" />
            <el-option label="正常" value="SUCCESS" />
            <el-option label="发现异常" value="WARNING" />
            <el-option label="部分完成" value="PARTIAL" />
            <el-option label="执行失败" value="FAILED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="monitors" row-key="config.id" empty-text="暂无账务监测配置">
        <el-table-column label="业务线" min-width="170">
          <template #default="{ row }">
            <strong>{{ row.config.businessLineName || row.config.businessLineCode }}</strong>
            <div class="subtle">{{ row.config.businessLineCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="账务系统" min-width="185">
          <template #default="{ row }">
            <div>{{ row.config.systemName }}</div>
            <div class="subtle">{{ row.config.schemaName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="生产 DB 目标" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.config.databaseTargetKey" type="info">{{ row.config.databaseTargetKey }}</el-tag>
            <el-tag v-else type="danger">未配置</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开关" width="135">
          <template #default="{ row }">
            <div><el-tag :type="row.config.enabled ? 'success' : 'info'">{{ row.config.enabled ? '监测启用' : '监测停用' }}</el-tag></div>
            <div class="tag-gap">
              <el-tag :type="row.config.dailyEnabled ? 'success' : 'info'" effect="plain">
                {{ row.config.dailyEnabled ? '每日启用' : '每日关闭' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近状态" width="120">
          <template #default="{ row }">
            <el-tag :type="runStatusType(row.latestRun?.status)">
              {{ statusName(row.latestRun?.status) }}
            </el-tag>
            <div v-if="row.latestRun" class="subtle">{{ row.latestRun.anomalyCount }} 条异常</div>
          </template>
        </el-table-column>
        <el-table-column label="最近区间" min-width="270">
          <template #default="{ row }">
            <template v-if="row.latestRun">
              <div>{{ row.latestRun.startTime }}</div>
              <div class="subtle">至 {{ row.latestRun.endTime }}（右开）</div>
            </template>
            <span v-else class="subtle">尚未执行</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="205" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.latestRun" link type="primary" @click="openDetail(row.latestRun)">详情</el-button>
            <el-button
              v-if="canRun && row.config.enabled && row.config.databaseTargetKey"
              link
              type="primary"
              @click="openManual(row.config)"
            >
              对账
            </el-button>
            <el-button v-if="canManage" link type="primary" @click="openEditConfig(row.config)">配置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="page-card">
      <div class="section-title">
        <div>
          <h3>对账批次</h3>
          <p>手动、每日和重试批次统一留痕；时间范围使用半开区间。</p>
        </div>
      </div>
      <el-table v-loading="runLoading" :data="runs" row-key="id" empty-text="暂无对账批次">
        <el-table-column prop="runNo" label="批次号" min-width="190" show-overflow-tooltip />
        <el-table-column label="来源" width="85">
          <template #default="{ row }">{{ triggerName(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column label="业务线/系统" min-width="195">
          <template #default="{ row }">
            <div>{{ row.businessLineName || row.businessLineCode }}</div>
            <div class="subtle">{{ row.systemName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="时间区间" min-width="270">
          <template #default="{ row }">
            <div>{{ row.startTime }}</div>
            <div class="subtle">至 {{ row.endTime }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="runStatusType(row.status)">{{ statusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="anomalyCount" label="异常数" width="90" />
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
          :total="runTotal"
          :current-page="filters.page"
          :page-size="filters.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="changePage"
          @size-change="changePageSize"
        />
      </div>
    </section>
  </div>

  <el-drawer v-model="manualVisible" title="手动对账" size="620px">
    <el-form label-position="top">
      <el-form-item label="账务系统" required>
        <el-select v-model="manualForm.configId" filterable style="width: 100%">
          <el-option
            v-for="item in runnableConfigs"
            :key="item.id"
            :label="`${item.businessLineName || item.businessLineCode} / ${item.systemName}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="对账时间区间（精确到小时，结束时间不包含）" required>
        <el-date-picker
          v-model="manualForm.timeRange"
          type="datetimerange"
          value-format="YYYY-MM-DDTHH:00:00"
          format="YYYY-MM-DD HH:00"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          range-separator="至"
          style="width: 100%"
        />
      </el-form-item>
      <el-alert
        v-if="partialDayWindow"
        title="当前不是整日区间：小时级交易规则正常执行，日级账单和对账单规则会明确标记为已跳过。"
        type="warning"
        :closable="false"
        show-icon
        class="manual-alert"
      />
      <el-form-item label="执行规则">
        <el-select v-model="manualForm.ruleCodes" multiple collapse-tags collapse-tags-tooltip style="width: 100%">
          <el-option
            v-for="rule in rules"
            :key="rule.ruleCode"
            :label="`${rule.ruleName}（${rule.granularity === 'HOURLY' ? '小时级' : '日级'}）`"
            :value="rule.ruleCode"
          />
        </el-select>
      </el-form-item>
      <div v-if="selectedManualConfig" class="readonly-note">
        <strong>只读目标：</strong>{{ selectedManualConfig.databaseTargetKey }} /
        {{ selectedManualConfig.schemaName }}；不会修改业务库、触发支付或自动核销。
      </div>
    </el-form>
    <template #footer>
      <el-button @click="manualVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitManual">提交对账</el-button>
    </template>
  </el-drawer>

  <el-drawer v-model="configVisible" :title="editingConfigId ? '编辑账务监测配置' : '新增账务监测配置'" size="560px">
    <el-form label-position="top">
      <div class="two-columns">
        <el-form-item label="业务线编码" required>
          <el-input v-model="configForm.businessLineCode" placeholder="BL000001" />
        </el-form-item>
        <el-form-item label="环境" required>
          <el-input v-model="configForm.environmentCode" disabled />
        </el-form-item>
      </div>
      <el-form-item label="系统名称" required>
        <el-input v-model="configForm.systemName" placeholder="scf-saps" />
      </el-form-item>
      <el-form-item label="显示名称" required>
        <el-input v-model="configForm.displayName" />
      </el-form-item>
      <el-form-item label="生产 DB 目标">
        <el-input v-model="configForm.databaseTargetKey" placeholder="必须是已绑定当前业务线的 readonly MCP DB 目标" />
      </el-form-item>
      <el-form-item label="账务 Schema" required>
        <el-input v-model="configForm.schemaName" placeholder="仅支持字母、数字、下划线" />
      </el-form-item>
      <el-form-item label="规则包" required>
        <el-select v-model="configForm.ruleProfile" style="width: 100%">
          <el-option v-for="item in profileOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <div class="switch-row">
        <el-form-item label="启用监测">
          <el-switch v-model="configForm.enabled" />
        </el-form-item>
        <el-form-item label="启用每日 T-1">
          <el-switch v-model="configForm.dailyEnabled" :disabled="!configForm.enabled" />
        </el-form-item>
      </div>
      <el-alert
        v-if="configForm.dailyEnabled"
        title="代码中的总调度开关仍需通过 WORKHUB_ACCOUNTING_SCHEDULE_ENABLED 启用。"
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

  <el-dialog v-model="detailVisible" title="对账批次详情" width="1180px">
    <div v-if="detail?.run" class="detail-head">
      <div><span>批次号</span><strong>{{ detail.run.runNo }}</strong></div>
      <div><span>状态</span><el-tag :type="runStatusType(detail.run.status)">{{ statusName(detail.run.status) }}</el-tag></div>
      <div><span>系统</span><strong>{{ detail.run.displayName }}</strong></div>
      <div><span>时间区间</span><strong>{{ detail.run.startTime }} 至 {{ detail.run.endTime }}</strong></div>
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
      <el-table-column prop="ruleName" label="规则" min-width="220">
        <template #default="{ row }">
          <div>{{ row.ruleName }}</div>
          <div class="subtle">{{ row.ruleCode }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="类别" width="100" />
      <el-table-column label="粒度" width="90">
        <template #default="{ row }">{{ row.granularity === 'HOURLY' ? '小时级' : '日级' }}</template>
      </el-table-column>
      <el-table-column label="结果" width="105">
        <template #default="{ row }">
          <el-tag :type="resultStatusType(row.status)">{{ resultStatusName(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="anomalyCount" label="异常数" width="90" />
      <el-table-column label="差异金额" width="130">
        <template #default="{ row }">{{ formatMoney(row.differenceAmount) }}</template>
      </el-table-column>
      <el-table-column prop="durationMs" label="耗时(ms)" width="100" />
      <el-table-column prop="message" label="说明" min-width="240" show-overflow-tooltip />
      <el-table-column label="脱敏样例" width="100">
        <template #default="{ row }">
          <el-popover placement="left" :width="520" trigger="click">
            <template #reference><el-button link type="primary">查看</el-button></template>
            <pre class="sample-json">{{ formatSamples(row.sampleJson) }}</pre>
          </el-popover>
        </template>
      </el-table-column>
    </el-table>
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

.page-header,
.section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.page-header h2,
.section-title h3 {
  margin: 0;
  color: #172033;
}

.page-header p,
.section-title p {
  margin: 6px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgb(15 23 42 / 4%);
}

.summary-card span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: #172033;
  font-size: 28px;
}

.summary-card.success {
  border-top: 3px solid #16a34a;
}

.summary-card.warning,
.summary-card.running {
  border-top: 3px solid #d97706;
}

.summary-card.danger {
  border-top: 3px solid #dc2626;
}

.filter-form {
  margin-top: 18px;
}

.subtle {
  margin-top: 3px;
  color: #94a3b8;
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

.two-columns,
.switch-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-head {
  display: grid;
  grid-template-columns: 1.1fr 0.7fr 1fr 2fr;
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

.sample-json {
  max-height: 380px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
