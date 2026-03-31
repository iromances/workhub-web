<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { fetchWorkItemDetail, fetchWorkItemFollowUps, fetchWorkItems } from '@/api/work-item'
import type { WorkItemDetail, WorkItemFollowUp, WorkItemSummary } from '@/types/work-item'

const loading = ref(false)
const detailLoading = ref(false)
const workItems = ref<WorkItemSummary[]>([])
const detailVisible = ref(false)
const selectedDetail = ref<WorkItemDetail | null>(null)
const selectedFollowUps = ref<WorkItemFollowUp[]>([])
const filters = reactive({
  keyword: '',
  type: '',
  status: '',
})

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

async function showDetail(id: number) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const [detail, followUps] = await Promise.all([fetchWorkItemDetail(id), fetchWorkItemFollowUps(id)])
    selectedDetail.value = detail
    selectedFollowUps.value = followUps
  } catch (error) {
    ElMessage.error('加载工作项详情失败')
    detailVisible.value = false
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

onMounted(loadWorkItems)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">工作项</h1>
        <p class="page-desc">需求、缺陷、运维、任务统一在一个模型中流转。</p>
      </div>
      <el-button type="primary" disabled>新建工作项</el-button>
    </div>

    <el-form inline @submit.prevent="loadWorkItems">
      <el-form-item>
        <el-input v-model="filters.keyword" placeholder="标题 / 编号" clearable />
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 140px">
          <el-option label="需求" value="需求" />
          <el-option label="缺陷" value="缺陷" />
          <el-option label="运维" value="运维" />
          <el-option label="任务" value="任务" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 160px">
          <el-option label="待澄清" value="待澄清" />
          <el-option label="待评估" value="待评估" />
          <el-option label="待排期" value="待排期" />
          <el-option label="开发中" value="开发中" />
          <el-option label="测试中" value="测试中" />
          <el-option label="待发布" value="待发布" />
          <el-option label="已完成" value="已完成" />
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
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row.id)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="detailVisible" title="工作项详情" size="640px">
    <el-skeleton :loading="detailLoading" animated>
      <template #template>
        <el-skeleton-item variant="h3" style="width: 60%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" />
        <el-skeleton-item variant="text" />
      </template>

      <template #default>
        <template v-if="selectedDetail">
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

          <div class="section-title">拆解与跟踪记录</div>
          <template v-if="selectedFollowUps.length">
            <div class="follow-up-list">
              <div v-for="item in selectedFollowUps" :key="item.id" class="follow-up-card">
                <div class="follow-up-meta">{{ item.createdAt }} · {{ item.operatorUserName }}</div>
                <pre class="follow-up-content">{{ item.content }}</pre>
              </div>
            </div>
          </template>
          <el-empty v-else description="还没有跟踪记录" />
        </template>
      </template>
    </el-skeleton>
  </el-drawer>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.follow-up-list {
  display: grid;
  gap: 12px;
}

.follow-up-card {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
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
</style>
