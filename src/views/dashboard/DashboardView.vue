<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

import { fetchIntakeRecords } from '@/api/intake'
import { fetchWorkItems } from '@/api/work-item'
import type { IntakeSummary, WorkItemSummary } from '@/types/work-item'

const loading = ref(false)
const intakeRecords = ref<IntakeSummary[]>([])
const workItems = ref<WorkItemSummary[]>([])

const activeDemandStatuses = new Set(['已收录', '待评估', '已评估', '研发中', '待测试', '测试中', '待验收', '待上线'])
const activeWorkItemStatuses = new Set(['待澄清', '待评估', '待排期', '开发中', '测试中', '待发布'])

const cards = computed(() => [
  {
    label: '进行中需求',
    value: ongoingDemands.value.length,
    note: '展示已收录到待上线之间仍在推进的需求',
  },
  {
    label: '已上线需求',
    value: intakeRecords.value.filter((item) => item.demandStatus === '已上线').length,
    note: '需求管理中已经完成上线闭环的数量',
  },
  {
    label: '进行中工作项',
    value: workItems.value.filter((item) => activeWorkItemStatuses.has(item.status)).length,
    note: '当前仍在推进的正式工作项',
  },
  {
    label: '待识别/失败',
    value: intakeRecords.value.filter((item) => !item.demandStatus || item.enrichmentStatus === 'FAILED').length,
    note: '尚未进入业务状态或识别失败，需要补资料的需求',
  },
])

const ongoingDemands = computed(() =>
  intakeRecords.value
    .filter((item) => activeDemandStatuses.has(item.demandStatus))
    .sort((left, right) => {
      const leftTime = new Date(left.submittedTime || left.receivedAt).getTime()
      const rightTime = new Date(right.submittedTime || right.receivedAt).getTime()
      return rightTime - leftTime
    }),
)

async function loadDashboard() {
  loading.value = true
  try {
    const [intakes, items] = await Promise.all([
      fetchIntakeRecords(),
      fetchWorkItems(),
    ])
    intakeRecords.value = intakes.items
    workItems.value = items
  } catch (error) {
    ElMessage.error('加载工作台数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
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

onMounted(loadDashboard)
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">工作台</h1>
        <p class="page-desc">集中查看当前正在推进的需求和正式工作项。</p>
      </div>
    </div>

    <el-row v-loading="loading" :gutter="18">
      <el-col v-for="card in cards" :key="card.label" :span="6">
        <div class="page-card metric-card">
          <div class="metric-label">{{ card.label }}</div>
          <div class="metric-value">{{ card.value }}</div>
          <div class="metric-note">{{ card.note }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="18" class="dashboard-section">
      <el-col :span="24">
        <div class="page-card content-card">
          <h3>阶段性实施基线</h3>
          <el-timeline v-if="ongoingDemands.length">
            <el-timeline-item
              v-for="item in ongoingDemands"
              :key="item.id"
              :timestamp="`${item.demandStatus} · ${formatDisplayTime(item.submittedTime || item.receivedAt)}`"
            >
              <div class="demand-title">{{ resolveDemandTitle(item) }}</div>
              <div class="demand-meta">
                <span>审批编号：{{ item.approvalCode || '-' }}</span>
                <span>提出人：{{ item.proposerName || item.senderName || '-' }}</span>
                <span>需求类型：{{ item.requirementType || '-' }}</span>
                <span>所在部门：{{ item.department || '-' }}</span>
              </div>
              <div class="demand-note">{{ item.remark || item.requirementSummary || '等待继续推进需求阶段' }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="当前没有正在进行中的需求" />
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

.metric-label {
  color: #64748b;
  font-size: 14px;
}

.metric-value {
  margin-top: 10px;
  font-size: 40px;
  font-weight: 800;
  color: #0f172a;
}

.metric-note {
  margin-top: 12px;
  color: #475569;
  line-height: 1.6;
}

.dashboard-section {
  margin-top: 18px;
}

h3 {
  margin-top: 0;
}

.demand-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
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
