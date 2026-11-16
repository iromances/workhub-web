<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgentIssues, reviewAgentIssue, deployAgentIssue } from '@/api/agent'
import type { AgentIssue } from '@/types/agent'
import { issueDomainLabels, issueStatusLabels, localTime } from './agentPresentation'
import { useAuthStore } from '@/stores/auth'
import { errorText } from './agentPresentation'

const auth = useAuthStore()
const canManage = auth.hasPermission('agent:manage')
const issues = ref<AgentIssue[]>([])
const loading = ref(false)
const busy = ref(false)
const filter = ref({ status: '', domain: '', severity: '' })

async function load() {
  loading.value = true
  try {
    issues.value = await fetchAgentIssues({ status: filter.value.status || undefined, domain: filter.value.domain || undefined, limit: 300 })
  } finally { loading.value = false }
}
onMounted(load)
onActivated(load)

function severityTone(severity: string) {
  return severity === 'P0' ? 'danger' : severity === 'P1' ? 'warning' : 'info'
}
async function review(issue: AgentIssue, decision: 'APPROVE' | 'REJECT') {
  let note = ''
  try {
    const { value } = await ElMessageBox.prompt(
      decision === 'APPROVE' ? '审核通过将合并 MR 并触发 TEST 部署。' : '拒绝将退回开放，请填写拒绝原因。', '工单审核',
      { confirmButtonText: '确认', cancelButtonText: '取消', inputPlaceholder: decision === 'REJECT' ? '拒绝原因（必填）' : '审核意见（可选）', inputValidator: v => decision === 'APPROVE' || (v && v.trim()) ? true : '拒绝原因必填' })
    note = value || ''
  } catch { return }
  busy.value = true
  try { await reviewAgentIssue(issue, decision, note); ElMessage.success('审核完成'); await load() }
  catch (cause) { ElMessage.error(errorText(cause)) } finally { busy.value = false }
}
async function deploy(issue: AgentIssue, outcome: 'PASS' | 'FAIL') {
  try { await ElMessageBox.confirm(outcome === 'PASS' ? '确认 TEST 通过并发版 PROD？确认后工单标记已修复。' : '确认 TEST 失败？工单将退回。', '部署确认', { type: 'warning' }) }
  catch { return }
  busy.value = true
  try { await deployAgentIssue(issue, outcome); ElMessage.success('部署结论已记录'); await load() }
  catch (cause) { ElMessage.error(errorText(cause)) } finally { busy.value = false }
}
</script>

<template>
  <section class="page-card issue-center">
    <div class="page-header">
      <div><h2>工单中心</h2><p class="description">巡检问题的跨轮工单：分析、修复、审核与两段式发版。</p></div>
      <el-button @click="load">刷新</el-button>
    </div>
    <div class="filters">
      <el-select v-model="filter.status" placeholder="状态" clearable style="width: 130px" @change="load">
        <el-option v-for="(label, key) in issueStatusLabels" :key="key" :value="key" :label="label" />
      </el-select>
      <el-select v-model="filter.domain" placeholder="域" clearable style="width: 130px" @change="load">
        <el-option v-for="(label, key) in issueDomainLabels" :key="key" :value="key" :label="label" />
      </el-select>
    </div>
    <el-table v-loading="loading" :data="issues" row-key="id">
      <el-table-column label="级别" width="70"><template #default="{ row }"><el-tag :type="severityTone(row.severity)" size="small">{{ row.severity }}</el-tag></template></el-table-column>
      <el-table-column label="问题" min-width="260"><template #default="{ row }"><strong>{{ row.title }}</strong><div class="muted">{{ issueDomainLabels[row.domain] }} · {{ row.businessLineCode }}/{{row.environmentCode }}</div></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag size="small" effect="plain">{{ issueStatusLabels[row.status] || row.status }}</el-tag></template></el-table-column>
      <el-table-column label="观测" width="130"><template #default="{ row }">{{ row.occurrenceCount }} 次<template v-if="row.unseenRounds"> · {{ row.unseenRounds }} 轮未见</template><template v-if="row.reopenCount"> · 复发{{ row.reopenCount }}</template></template></el-table-column>
      <el-table-column label="最近" width="160"><template #default="{ row }">{{ localTime(row.lastSeenAt) }}</template></el-table-column>
      <el-table-column label="修复/MR" width="120"><template #default="{ row }"><a v-if="row.fix?.mrUrl" :href="row.fix.mrUrl" target="_blank" class="muted">查看 MR</a><span v-else-if="row.fix?.branch" class="muted">{{ row.fix.branch.slice(0, 14) }}…</span><span v-else class="muted">—</span></template></el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="canManage && row.status === 'PENDING_REVIEW'">
            <el-button link type="success" :disabled="busy" @click="review(row, 'APPROVE')">通过</el-button>
            <el-button link type="danger" :disabled="busy" @click="review(row, 'REJECT')">拒绝</el-button>
          </template>
          <template v-else-if="canManage && row.status === 'TESTING'">
            <el-button link type="success" :disabled="busy" @click="deploy(row, 'PASS')">TEST通过→PROD</el-button>
            <el-button link type="danger" :disabled="busy" @click="deploy(row, 'FAIL')">失败退回</el-button>
          </template>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无工单——下轮巡检产出问题后自动生成" :image-size="60" /></template>
    </el-table>
  </section>
</template>

<style scoped>
.issue-center { padding: 22px; }
.filters { display: flex; gap: 12px; margin-bottom: 14px; }
.muted { color: #6b7280; font-size: 12px; }
</style>
