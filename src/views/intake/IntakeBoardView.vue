<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchIntakeBoard } from '@/api/intake'
import type { IntakeBoardGroupBy, IntakeBoardPerson, IntakeBoardRequirement } from '@/types/work-item'

const router = useRouter()
const loading = ref(false)
const includeClosed = ref(false)
const groupBy = ref<IntakeBoardGroupBy>('taskOwner')
const keyword = ref('')
const board = ref<{ groupBy: IntakeBoardGroupBy; includeClosed: boolean; people: IntakeBoardPerson[] } | null>(null)

const groupByOptions: Array<{ value: IntakeBoardGroupBy; label: string }> = [
  { value: 'demandOwner', label: '按需求负责人' },
  { value: 'taskOwner', label: '按任务负责人' },
]

const people = computed(() => board.value?.people || [])
const requirementTotal = computed(() =>
  people.value.reduce((total, person) => total + person.requirementCount, 0),
)

const groupByLabel = computed(
  () => groupByOptions.find((option) => option.value === groupBy.value)?.label || '',
)

const filteredPeople = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  if (!normalizedKeyword) {
    return people.value
  }
  return people.value
    .map((person) => {
      const personMatched = `${person.displayName} ${person.userName || ''}`
        .toLowerCase()
        .includes(normalizedKeyword)
      const requirements = personMatched
        ? person.requirements
        : person.requirements.filter((item) => requirementMatchesKeyword(item, normalizedKeyword))
      return { ...person, requirements }
    })
    .filter((person) => person.requirements.length > 0)
})

function requirementMatchesKeyword(item: IntakeBoardRequirement, normalizedKeyword: string) {
  return [
    item.requirementName,
    item.requirementType,
    item.approvalCode,
    item.businessLine,
    item.businessLineCode,
    item.demandStatus,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
}

async function loadBoard() {
  loading.value = true
  try {
    board.value = await fetchIntakeBoard(includeClosed.value, groupBy.value)
  } catch (error) {
    ElMessage.error('加载需求看板失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function toggleIncludeClosed(value: boolean | string | number) {
  includeClosed.value = Boolean(value)
  void loadBoard()
}

function resolveStatusTagType(status: string | null | undefined) {
  switch (status) {
    case '开发中':
      return 'primary'
    case '测试中':
    case '待验收':
    case '待上线':
      return 'warning'
    case '已完成':
      return 'success'
    case '终止关闭':
      return 'danger'
    default:
      return 'info'
  }
}

function resolvePriorityTagType(priority: string | null | undefined) {
  switch (priority) {
    case '高':
      return 'danger'
    case '中':
      return 'warning'
    case '低':
      return 'info'
    default:
      return 'info'
  }
}

function isOverdue(item: IntakeBoardRequirement) {
  if (!item.dueDate) {
    return false
  }
  const dueTime = new Date(`${item.dueDate}T00:00:00`).getTime()
  return !Number.isNaN(dueTime) && dueTime < new Date(new Date().toDateString()).getTime()
}

function formatEffort(value: string | null | undefined) {
  return value || '-'
}

function openRequirement(id: number) {
  void router.push({ path: '/demands/list', query: { intakeId: id } })
}

function showRequirementTotals(item: IntakeBoardRequirement) {
  return item.ownedTaskCount !== item.taskCount
    || (item.totalEstimatedEffort !== null && item.totalEstimatedEffort !== item.ownedEstimatedEffort)
}

onMounted(loadBoard)
</script>

<template>
  <div class="board-page" v-loading="loading">
    <div class="board-toolbar">
      <div class="board-toolbar-title">
        <h2>需求看板</h2>
        <span class="board-toolbar-summary">
          {{ people.length }} 人 · {{ requirementTotal }} 个需求
        </span>
      </div>
      <div class="board-toolbar-actions">
        <el-radio-group v-model="groupBy" @change="loadBoard">
          <el-radio-button
            v-for="option in groupByOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
        <el-input
          v-model="keyword"
          class="board-keyword-input"
          placeholder="搜索人员、需求名称、审批编号"
          clearable
        />
        <el-switch
          :model-value="includeClosed"
          active-text="含已完成/终止"
          @change="toggleIncludeClosed"
        />
        <el-button :icon="Refresh" :loading="loading" @click="loadBoard">刷新</el-button>
      </div>
    </div>

    <el-empty v-if="filteredPeople.length === 0" description="暂无进行中的需求" />
    <div v-else class="board-columns">
      <section
        v-for="person in filteredPeople"
        :key="person.userName || 'unassigned'"
        class="board-column"
      >
        <header class="board-column-header">
          <div class="board-column-title">
            <span class="board-column-name">{{ person.displayName }}</span>
            <span v-if="person.userName" class="board-column-username">{{ person.userName }}</span>
          </div>
          <div class="board-column-metrics">
            <el-tag size="small" type="info">{{ person.requirementCount }} 个需求</el-tag>
            <el-tag size="small" type="warning" v-if="person.totalEstimatedEffort">
              预估 {{ person.totalEstimatedEffort }}
            </el-tag>
          </div>
        </header>

        <div class="board-column-body">
          <article
            v-for="item in person.requirements"
            :key="item.id"
            class="requirement-card"
          >
            <div class="requirement-card-title-row">
              <button
                class="requirement-card-title"
                type="button"
                :title="item.requirementName || item.approvalCode || ''"
                @click="openRequirement(item.id)"
              >
                {{ item.requirementName || item.approvalCode || `需求 #${item.id}` }}
              </button>
              <el-tag size="small" :type="resolveStatusTagType(item.demandStatus)">
                {{ item.demandStatus }}
              </el-tag>
            </div>
            <div class="requirement-card-meta">
              <span v-if="item.approvalCode" class="requirement-card-code">{{ item.approvalCode }}</span>
              <el-tag
                v-if="item.priority"
                size="small"
                effect="plain"
                :type="resolvePriorityTagType(item.priority)"
              >
                {{ item.priority }}
              </el-tag>
              <span v-if="item.businessLine" class="requirement-card-business-line">
                {{ item.businessLine }}
              </span>
            </div>
            <dl class="requirement-card-metrics">
              <div class="metric">
                <dt>任务数</dt>
                <dd>
                  {{ item.ownedTaskCount }}<span
                    v-if="item.ownedTaskCount !== item.taskCount"
                    class="metric-hint"
                  >/共{{ item.taskCount }}项</span>
                </dd>
              </div>
              <div class="metric">
                <dt>预估工时</dt>
                <dd>
                  {{ formatEffort(item.ownedEstimatedEffort) }}<span
                    v-if="item.totalEstimatedEffort && item.totalEstimatedEffort !== item.ownedEstimatedEffort"
                    class="metric-hint"
                  >/共{{ formatEffort(item.totalEstimatedEffort) }}</span>
                </dd>
              </div>
              <div class="metric">
                <dt>实际工时</dt>
                <dd>{{ formatEffort(item.actualEffort) }}</dd>
              </div>
            </dl>
            <div v-if="showRequirementTotals(item)" class="requirement-card-dimension-note">
              {{ groupByLabel }}视角，需求共 {{ item.taskCount }} 项任务、预估
              {{ formatEffort(item.totalEstimatedEffort) }}
            </div>
            <div class="requirement-card-dates">
              <span class="date-item">
                开始：{{ item.startDate || '-' }}
              </span>
              <span class="date-item" :class="{ 'is-overdue': isOverdue(item) }">
                截止：{{ item.dueDate || '-' }}
              </span>
            </div>
          </article>
          <div v-if="person.requirements.length === 0" class="board-column-empty">无需求</div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.board-toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.board-toolbar-title h2 {
  margin: 0;
  font-size: 18px;
}

.board-toolbar-summary {
  color: #64748b;
  font-size: 13px;
}

.board-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.board-keyword-input {
  width: 240px;
}

.board-columns {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 320px;
  gap: 16px;
  overflow-x: auto;
  align-items: start;
  padding-bottom: 12px;
}

.board-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.9);
}

.board-column-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-column-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.board-column-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.board-column-username {
  color: #94a3b8;
  font-size: 12px;
}

.board-column-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.board-column-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.board-column-empty {
  padding: 18px 0;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

.requirement-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: #fff;
}

.requirement-card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.requirement-card-title {
  flex: 1 1 auto;
  overflow: hidden;
  padding: 0;
  border: none;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.requirement-card-title:hover {
  color: #0f766e;
  text-decoration: underline;
}

.requirement-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.requirement-card-code {
  color: #64748b;
  font-size: 12px;
}

.requirement-card-business-line {
  overflow: hidden;
  max-width: 100%;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-card-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0;
}

.metric dt {
  color: #94a3b8;
  font-size: 12px;
}

.metric dd {
  margin: 2px 0 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.metric-hint {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 400;
}

.requirement-card-dimension-note {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}

.requirement-card-dates {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.date-item {
  color: #475569;
  font-size: 12px;
}

.date-item.is-overdue {
  color: #dc2626;
  font-weight: 700;
}
</style>
