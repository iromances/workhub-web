<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

import { fetchIntakeRecords } from '@/api/intake'
import type { IntakeSummary } from '@/types/work-item'

import {
  buildBusinessLineStats,
  businessLineDemandTypeOptions,
  demandGroups,
  filterRecordsByDemandType,
  formatDemandRatio,
  type DemandTypeFilter,
} from './dashboardStats'
import {
  buildProjectProgressReport,
  buildProjectProgressReportFileName,
  downloadProjectProgressReportScreenshot,
} from './dashboardReport'

const loading = ref(false)
const reportGenerating = ref(false)
const businessLineDemandType = ref<DemandTypeFilter>('ALL')
const intakeRecords = ref<IntakeSummary[]>([])

const demandCards = computed(() =>
  demandGroups.map((group) => {
    const items = intakeRecords.value.filter((item) => group.statuses.includes(item.demandStatus))
    return {
      ...group,
      value: items.length,
      items: sortDemandItems(items),
    }
  }),
)

const highlightedDemands = computed(() =>
  demandCards.value
    .flatMap((card) => card.items.map((item) => ({
      ...item,
      groupLabel: card.label,
      groupTagClass: card.tagClass,
    })))
    .slice(0, 12),
)

const businessLineRecords = computed(() => filterRecordsByDemandType(intakeRecords.value, businessLineDemandType.value))
const businessLineStats = computed(() => buildBusinessLineStats(intakeRecords.value, businessLineDemandType.value))
const businessLineFilterLabel = computed(() => businessLineDemandTypeOptions.find((option) => option.value === businessLineDemandType.value)?.label || '所有')

async function loadDashboard() {
  loading.value = true
  try {
    const intakes = await fetchIntakeRecords({ page: 1, pageSize: 1000 })
    intakeRecords.value = intakes.items
  } catch (error) {
    ElMessage.error('加载工作台数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function sortDemandItems(items: IntakeSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.submittedTime || left.receivedAt).getTime()
    const rightTime = new Date(right.submittedTime || right.receivedAt).getTime()
    return rightTime - leftTime
  })
}

function formatDisplayTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ')
}

function resolveDemandTitle(item: IntakeSummary) {
  return item.requirementDigest || item.requirementName || item.approvalCode || '未命名需求'
}

async function generateProgressReportScreenshot() {
  if (reportGenerating.value) {
    return
  }
  reportGenerating.value = true
  try {
    const generatedAt = new Date()
    const report = buildProjectProgressReport({
      generatedAt,
      demandGroups,
      records: intakeRecords.value,
      businessLineStats: businessLineStats.value,
      businessLineFilterLabel: businessLineFilterLabel.value,
    })
    await downloadProjectProgressReportScreenshot(report, buildProjectProgressReportFileName(generatedAt))
    ElMessage.success('项目总体进度报告截图已生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成报告截图失败')
    console.error(error)
  } finally {
    reportGenerating.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">工作台</h1>
        <p class="page-desc">按需求阶段和业务线快速查看未启动、开发中、测试中和待上线的事项。</p>
      </div>
      <el-button
        type="primary"
        :icon="Download"
        :loading="reportGenerating"
        @click="generateProgressReportScreenshot"
      >
        生成报告截图
      </el-button>
    </div>

    <el-row v-loading="loading" :gutter="18">
      <el-col v-for="card in demandCards" :key="card.key" :xs="24" :sm="12" :lg="6">
        <div class="page-card metric-card" :class="card.className">
          <div class="metric-label">{{ card.label }}</div>
          <div class="metric-value">{{ card.value }}</div>
          <div class="metric-note">{{ card.note }}</div>
          <div class="metric-statuses">{{ card.statuses.join(' / ') }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="18" class="dashboard-section">
      <el-col :span="24">
        <div class="page-card content-card">
          <div class="section-header">
            <div>
              <h3>业务线需求统计</h3>
              <span>当前范围：{{ businessLineFilterLabel }}，共 {{ businessLineRecords.length }} 个需求；待上线包含待验收和待上线</span>
            </div>
            <el-radio-group v-model="businessLineDemandType" class="stats-filter" size="small">
              <el-radio-button
                v-for="option in businessLineDemandTypeOptions"
                :key="option.value"
                :label="option.value"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <el-table :data="businessLineStats" border stripe>
            <el-table-column prop="businessLine" label="业务线" min-width="180" />
            <el-table-column prop="notStartedCount" label="未启动" width="100" align="right" />
            <el-table-column prop="developingCount" label="开发中" width="100" align="right" />
            <el-table-column prop="testingCount" label="测试中" width="100" align="right" />
            <el-table-column prop="pendingReleaseCount" label="待上线" width="100" align="right" />
            <el-table-column prop="totalCount" label="阶段合计" width="110" align="right" />
            <el-table-column prop="demandCount" label="需求数" width="100" align="right" />
            <el-table-column label="需求占比" width="110" align="right">
              <template #default="{ row }">
                {{ formatDemandRatio(row.demandRatio) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="18" class="dashboard-section">
      <el-col :span="24">
        <div class="page-card content-card">
          <h3>阶段性实施基线</h3>
          <el-timeline v-if="highlightedDemands.length">
            <el-timeline-item
              v-for="item in highlightedDemands"
              :key="`${item.groupLabel}-${item.id}`"
              :timestamp="formatDisplayTime(item.submittedTime || item.receivedAt)"
            >
              <div class="demand-heading">
                <div class="demand-title">{{ resolveDemandTitle(item) }}</div>
                <div class="demand-tags">
                  <span class="stage-tag" :class="item.groupTagClass">{{ item.groupLabel }}</span>
                  <span class="stage-tag stage-tag--status">{{ item.demandStatus || '-' }}</span>
                </div>
              </div>
              <div class="demand-meta">
                <span>审批编号：{{ item.approvalCode || '-' }}</span>
                <span>提出人：{{ item.proposerName || item.senderName || '-' }}</span>
                <span>需求类型：{{ item.requirementType || '-' }}</span>
                <span>业务线：{{ item.businessLine || '-' }}</span>
              </div>
              <div class="demand-note">{{ item.remark || item.requirementSummary || '等待继续推进需求阶段' }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="当前没有待推进的需求" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.metric-card,
.content-card {
  padding: 24px;
}

.metric-card {
  min-height: 188px;
  border: 1px solid transparent;
  overflow: hidden;
  position: relative;
  box-shadow: 0 18px 34px rgb(15 23 42 / 8%);
}

.metric-card::after {
  content: '';
  position: absolute;
  right: -38px;
  top: -42px;
  width: 128px;
  height: 128px;
  border-radius: 999px;
  opacity: 0.18;
}

.metric-card--idle {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-color: #cbd5e1;
}

.metric-card--idle::after {
  background: #64748b;
}

.metric-card--developing {
  background: linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%);
  border-color: #93c5fd;
}

.metric-card--developing::after {
  background: #2563eb;
}

.metric-card--testing {
  background: linear-gradient(135deg, #ecfeff 0%, #99f6e4 100%);
  border-color: #5eead4;
}

.metric-card--testing::after {
  background: #0f766e;
}

.metric-card--release {
  background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
  border-color: #fdba74;
}

.metric-card--release::after {
  background: #f97316;
}

.metric-label {
  color: #475569;
  font-size: 14px;
  font-weight: 700;
}

.metric-value {
  margin-top: 10px;
  font-size: 44px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.metric-note {
  margin-top: 14px;
  color: #475569;
  line-height: 1.6;
}

.metric-statuses {
  margin-top: 12px;
  color: #64748b;
  font-size: 12px;
}

.dashboard-section {
  margin-top: 18px;
}

h3 {
  margin-top: 0;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.stats-filter {
  flex-shrink: 0;
}

.section-header h3 {
  margin-bottom: 0;
}

.section-header span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.demand-heading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.demand-title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.demand-tags {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.stage-tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.stage-tag--idle {
  color: #334155;
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.stage-tag--developing {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}

.stage-tag--testing {
  color: #0f766e;
  background: #ccfbf1;
  border-color: #5eead4;
}

.stage-tag--release {
  color: #c2410c;
  background: #ffedd5;
  border-color: #fdba74;
}

.stage-tag--status {
  color: #64748b;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.demand-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  color: #475569;
  font-size: 13px;
}

.demand-note {
  margin-top: 10px;
  color: #334155;
  line-height: 1.7;
}
</style>
