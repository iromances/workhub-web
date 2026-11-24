<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgentIssues, fixAgentIssues } from '@/api/agent'
import type { AgentIssue, AgentIssueDomain, AgentRunDetail } from '@/types/agent'
import { issueDomainLabels, issueStatusLabels, localTime } from './agentPresentation'

const props = withDefaults(defineProps<{ detail: AgentRunDetail; grouped?: boolean }>(), { grouped: true })
const emit = defineEmits<{ refresh: [] }>()
const issues = ref<AgentIssue[]>([])
const loading = ref(false)
const selected = ref<string[]>([])
const fixing = ref(false)
const domains = computed(() => props.grouped ? ['SYSTEM_ALERT', 'BUSINESS_MONITOR', 'ACCOUNTING'] as const : ['ALL'] as const)

const byDomain = computed(() => {
  const map: Record<AgentIssueDomain | 'ALL', AgentIssue[]> = { SYSTEM_ALERT: [], BUSINESS_MONITOR: [], ACCOUNTING: [], ALL: issues.value }
  for (const issue of issues.value) map[issue.domain]?.push(issue)
  return map
})
const selectableCount = computed(() => issues.value.filter(issue => ['OPEN', 'ANALYZED', 'REJECTED'].includes(issue.status) && issue.analysis?.repos?.length).length)

watch(() => props.detail.run.id, load, { immediate: true })

async function load() {
  loading.value = true
  try {
    issues.value = await fetchAgentIssues({ runId: props.detail.run.id, limit: 100 })
    selected.value = selected.value.filter(id => issues.value.some(issue => issue.id === id))
  } finally { loading.value = false }
}

function severityTone(severity: string) {
  return severity === 'P0' ? 'danger' : severity === 'P1' ? 'warning' : 'info'
}

async function startFix() {
  if (!selected.value.length) return
  try { await ElMessageBox.confirm(`将对 ${selected.value.length} 个工单发起自动修复：独立克隆仓库→建修复分支→AI 编码→推送草稿 MR→转待人工审核。`, '发起修复', { type: 'warning', confirmButtonText: '去修复', cancelButtonText: '取消' }) }
  catch { return }
  fixing.value = true
  try {
    await fixAgentIssues([...selected.value])
    ElMessage.success('修复任务已派发，完成后工单转待审核')
    selected.value = []
    await load()
    emit('refresh')
  } finally { fixing.value = false }
}

async function copyFixPrompt() {
  const chosen = issues.value.filter(issue => selected.value.includes(issue.id))
  if (!chosen.length) return
  const text = chosen.map(issue =>
    `【${issue.severity}】${issue.title}\n代码位置：${issue.analysis?.codeLocation || '未定位'}\n根因：${issue.analysis?.rootCause || '未定位'}\n修复方向：${issue.analysis?.fixDirection || '无'}`).join('\n\n')
  await navigator.clipboard.writeText(text)
  ElMessage.success('已复制问题修复摘要')
}
</script>

<template>
  <!-- 挂在运行详情「结果与产物」内层 el-tabs 里：本组件只提供三个问题域 tab-pane 与工具条 -->
  <el-tab-pane v-for="domain in domains" :key="domain" :name="domain">
    <template #label>{{ domain === 'ALL' ? 'AI 分析工单' : issueDomainLabels[domain] }}（{{ byDomain[domain].length }}）</template>
    <div v-loading="loading">
      <el-empty v-if="!byDomain[domain].length" description="本轮暂无分析工单，业务核验以正式规则结果为准" :image-size="48" />
      <div v-for="issue in byDomain[domain]" :key="issue.id" class="issue-card">
        <div class="issue-head">
          <el-checkbox :model-value="selected.includes(issue.id)"
            :disabled="!['OPEN','ANALYZED','REJECTED'].includes(issue.status) || !issue.analysis?.repos?.length"
            @update:model-value="(value: boolean) => value ? selected.push(issue.id) : selected = selected.filter(id => id !== issue.id)" />
          <el-tag :type="severityTone(issue.severity)" size="small">{{ issue.severity }}</el-tag>
          <strong class="issue-title">{{ issue.title }}</strong>
          <el-tag size="small" effect="plain">{{ issueStatusLabels[issue.status] || issue.status }}</el-tag>
          <span class="issue-meta">出现 {{ issue.occurrenceCount }} 次<template v-if="issue.unseenRounds"> · {{ issue.unseenRounds }} 轮未复现</template><template v-if="issue.reopenCount"> · 复发 {{ issue.reopenCount }} 次</template></span>
        </div>
        <p v-if="issue.evidence?.summary" class="issue-evidence">{{ issue.evidence.summary }}</p>
        <details v-if="issue.analysis?.rootCause || issue.analysis?.codeLocation" class="issue-analysis">
          <summary>分析（{{ issue.analysis?.repos?.length ? issue.analysis.repos.map(r => r.repository).join('、') : '未定位仓库' }}）</summary>
          <dl>
            <template v-if="issue.analysis?.codeLocation"><dt>代码位置</dt><dd>{{ issue.analysis.codeLocation }}</dd></template>
            <template v-if="issue.analysis?.repro"><dt>触发步骤</dt><dd>{{ issue.analysis.repro }}</dd></template>
            <template v-if="issue.analysis?.rootCause"><dt>根因</dt><dd>{{ issue.analysis.rootCause }}</dd></template>
            <template v-if="issue.analysis?.impactVerification"><dt>影响与验证</dt><dd>{{ issue.analysis.impactVerification }}</dd></template>
            <template v-if="issue.analysis?.fixDirection"><dt>修复方向</dt><dd>{{ issue.analysis.fixDirection }}</dd></template>
          </dl>
        </details>
        <div v-if="issue.fix" class="issue-fix">
          <el-tag size="small" type="success">修复分支 {{ issue.fix.branch }}</el-tag>
          <a v-if="issue.fix.mrUrl" :href="issue.fix.mrUrl" target="_blank" class="issue-link">查看 MR</a>
        </div>
      </div>
    </div>
  </el-tab-pane>
  <div v-if="issues.length" class="issue-toolbar">
    <span class="issue-meta">已选 {{ selected.length }} 项（可选 {{ selectableCount }} 项：已分析且有仓库定位的开放问题）</span>
    <el-button size="small" :disabled="!selected.length" @click="copyFixPrompt">复制修复摘要</el-button>
    <el-button size="small" type="primary" :disabled="!selected.length || fixing" :loading="fixing" @click="startFix">去修复（{{ selected.length }}）</el-button>
  </div>
</template>

<style scoped>
.issue-card { padding: 12px 0; border-bottom: 1px solid #f0f1f3; }
.issue-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.issue-title { font-size: 14px; }
.issue-meta { color: #6b7280; font-size: 12px; }
.issue-evidence { margin: 6px 0 0 24px; color: #374151; font-size: 13px; }
.issue-analysis { margin: 8px 0 0 24px; }
.issue-analysis summary { cursor: pointer; color: #6b7280; font-size: 12px; }
.issue-analysis dl { margin: 8px 0 0; display: grid; grid-template-columns: 80px 1fr; gap: 4px 12px; font-size: 13px; }
.issue-analysis dt { color: #6b7280; }
.issue-analysis dd { margin: 0; white-space: pre-wrap; }
.issue-fix { margin: 8px 0 0 24px; display: flex; align-items: center; gap: 8px; }
.issue-link { color: var(--el-color-primary); font-size: 12px; }
.issue-toolbar { display: flex; align-items: center; gap: 12px; justify-content: flex-end; padding-top: 12px; margin-top: 4px; }
</style>
