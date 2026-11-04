<script setup lang="ts">
import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import { fetchAutonomyCase, fetchAutonomyCases } from '@/api/autonomy'
import type { AgentDefinition, AgentOptions } from '@/types/agent'
import type { AutonomyAnalysis, AutonomyCase, AutonomyCaseDetail } from '@/types/autonomy'
import { errorText, localTime, prettyPayload, scopeKey } from './agentPresentation'

const props = defineProps<{ agent: AgentDefinition; options: AgentOptions }>()
const selectedScope = ref('')
const page = ref(1)
const total = ref(0)
const rows = ref<AutonomyCase[]>([])
const loading = ref(false)
const error = ref('')
const drawer = ref(false)
const selectedId = ref('')
const detail = ref<AutonomyCaseDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const evidencePage = ref(1)
const proposalPage = ref(1)
const tab = ref('analysis')
let active = true
let initialized = false
let listEpoch = 0
let detailEpoch = 0
const scopes = computed(() => props.agent.configuration.scopes)
const sourceLabels: Record<string, string> = { BUSINESS_MONITOR: '业务监测', ACCOUNTING: '账务监测', SYSTEM_ALERT: '系统预警', SELF_LOG: 'WorkHub 日志', INSPECTION: '业务巡检', BUG: '缺陷反馈' }
const categoryLabels: Record<string, string> = { MONITORING_GAP: '监测覆盖待核实', EXECUTION_FAILURE: '执行失败', STALE_DATA: '数据时效待核实', DATA_DISCREPANCY: '账务差异候选', APPLICATION_ERROR: '应用异常', PERFORMANCE: '性能问题' }
const stateLabels: Record<string, string> = { DISCOVERED: '已发现', ANALYZING: '分析中', IMPLEMENTING: '修复中', VERIFYING_LOCAL: '本地验证中', WAITING_TEST_REVIEW: '等待测试发布审核', DEPLOYING_TEST: '测试发布中', VERIFYING_TEST: '测试验证中', WAITING_PROD_REVIEW: '等待上线审核', DEPLOYING_PROD: '上线中', OBSERVING: '观察中', RESOLVED: '已解决', NEEDS_INPUT: '等待补充', BLOCKED: '等待处理', FAILED: '处理失败', CANCELLING: '正在停止', CANCELLED: '已取消' }
const changeLabels: Record<string, string> = { CODE: '代码修改', CONFIGURATION: '配置调整', DATA: '数据处理', INVESTIGATION: '继续调查' }
const fields: { key: Exclude<keyof AutonomyAnalysis, 'changeType'>; label: string }[] = [
  { key: 'facts', label: '事实摘要' }, { key: 'hypothesis', label: '原因假设' }, { key: 'impact', label: '影响范围' },
  { key: 'plan', label: '处理方案' }, { key: 'acceptance', label: '验收方法' }, { key: 'rollback', label: '回退方案' }, { key: 'unknowns', label: '尚待核实' },
]
const analyses = computed(() => (detail.value?.proposals.items || []).map(proposal => {
  let parsed: Partial<AutonomyAnalysis> | null = null
  try {
    const value: unknown = JSON.parse(proposal.proposalJson)
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Partial<AutonomyAnalysis>
  } catch { /* 保留原始内容供查看，不能将解析失败显示为空方案。 */ }
  return { ...proposal, parsed }
}))
function scopeLabel(key: string) {
  const scope = scopes.value.find(item => scopeKey(item) === key)
  if (!scope) return key
  const line = props.options.scopes.find(item => item.businessLineCode === scope.businessLineCode)
  return `${line?.businessLineName || scope.businessLineCode} / ${scope.environmentCode}`
}
function tone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (status === 'RESOLVED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (['BLOCKED', 'NEEDS_INPUT', 'WAITING_TEST_REVIEW', 'WAITING_PROD_REVIEW'].includes(status)) return 'warning'
  return ['DISCOVERED', 'CANCELLED'].includes(status) ? 'info' : 'primary'
}
async function load() {
  const scope = scopes.value.find(item => scopeKey(item) === selectedScope.value)
  const epoch = ++listEpoch
  if (!scope || !active) { rows.value = []; total.value = 0; loading.value = false; return }
  const id = props.agent.id
  const key = selectedScope.value
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAutonomyCases(id, scope, page.value)
    if (epoch !== listEpoch || props.agent.id !== id || key !== selectedScope.value || !active) return
    rows.value = result.items; total.value = result.total
  } catch (cause) { if (epoch === listEpoch) error.value = errorText(cause) }
  finally { if (epoch === listEpoch) loading.value = false }
}
function changeScope() {
  page.value = 1; rows.value = []; total.value = 0; drawer.value = false; detail.value = null; detailEpoch++
  void load()
}
async function open(value: AutonomyCase) {
  selectedId.value = value.id; detail.value = null; evidencePage.value = 1; proposalPage.value = 1; tab.value = 'analysis'; drawer.value = true
  await loadDetail()
}
async function loadDetail() {
  if (!drawer.value || !selectedId.value || !active) return
  const id = selectedId.value, agentId = props.agent.id, epoch = ++detailEpoch
  detailLoading.value = true; detailError.value = ''; detail.value = null
  try {
    const result = await fetchAutonomyCase(agentId, id, evidencePage.value, proposalPage.value)
    if (epoch === detailEpoch && props.agent.id === agentId && selectedId.value === id && drawer.value && active) detail.value = result
  } catch (cause) { if (epoch === detailEpoch) detailError.value = errorText(cause) }
  finally { if (epoch === detailEpoch) detailLoading.value = false }
}
watch(() => `${props.agent.id}:${scopes.value.map(scopeKey).join(',')}`, () => {
  selectedScope.value = scopes.value[0] ? scopeKey(scopes.value[0]) : ''
  initialized = true; changeScope()
}, { immediate: true })
onActivated(() => { if (!active) { active = true; if (initialized) { void load(); void loadDetail() } } })
onDeactivated(() => { active = false; listEpoch++; detailEpoch++ })
onUnmounted(() => { active = false; listEpoch++; detailEpoch++ })
</script>

<template>
  <section class="page-card cases-panel">
    <div class="page-header"><div><h3>巡检问题</h3><p class="description">查看授权范围内的监测证据、AI 分析与处理进度。</p></div><el-button :loading="loading" :disabled="!selectedScope" @click="load">刷新问题</el-button></div>
    <el-empty v-if="!scopes.length" description="该 Agent 尚未配置业务线与环境范围" :image-size="60" />
    <template v-else>
      <div class="filter"><label for="case-scope">业务范围</label><el-select id="case-scope" v-model="selectedScope" placeholder="选择业务线与环境" @change="changeScope"><el-option v-for="scope in scopes" :key="scopeKey(scope)" :value="scopeKey(scope)" :label="scopeLabel(scopeKey(scope))" /></el-select></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column label="问题" min-width="260"><template #default="{ row }"><el-button class="case-title" link type="primary" @click="open(row)">{{ row.title }}</el-button><div class="muted">{{ categoryLabels[row.category] || row.category }}</div></template></el-table-column>
        <el-table-column label="来源" width="130"><template #default="{ row }">{{ sourceLabels[row.sourceType] || row.sourceType }}</template></el-table-column>
        <el-table-column label="状态" width="165"><template #default="{ row }"><el-tag :type="tone(row.status)">{{ stateLabels[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column label="证据次数" width="100"><template #default="{ row }">{{ row.occurrenceCount }}</template></el-table-column>
        <el-table-column label="最近发生" min-width="170"><template #default="{ row }">{{ localTime(row.lastSeenAt) }}</template></el-table-column>
        <el-table-column label="操作" width="115"><template #default="{ row }"><el-button link type="primary" @click="open(row)">证据与分析</el-button></template></el-table-column>
        <template #empty><el-empty description="当前范围尚无已登记问题" :image-size="50" /></template>
      </el-table>
      <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" />
    </template>
    <el-drawer v-model="drawer" title="问题证据与分析" size="min(1000px, 94vw)" :close-on-click-modal="false">
      <div class="detail-toolbar"><el-button :loading="detailLoading" @click="loadDetail">刷新详情</el-button></div>
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon class="feedback" />
      <div v-loading="detailLoading" class="case-detail">
        <template v-if="detail">
          <h3>{{ detail.caseInfo.title }}</h3>
          <div class="tags"><el-tag :type="tone(detail.caseInfo.status)">{{ stateLabels[detail.caseInfo.status] || detail.caseInfo.status }}</el-tag><el-tag effect="plain">{{ sourceLabels[detail.caseInfo.sourceType] || detail.caseInfo.sourceType }}</el-tag><span class="muted">{{ scopeLabel(`${detail.caseInfo.businessLineCode}/${detail.caseInfo.environmentCode}`) }} · 处理版本 {{ detail.caseInfo.version }}</span></div>
          <el-descriptions :column="2" border class="facts">
            <el-descriptions-item label="首次发生">{{ localTime(detail.caseInfo.firstSeenAt) }}</el-descriptions-item><el-descriptions-item label="最近发生">{{ localTime(detail.caseInfo.lastSeenAt) }}</el-descriptions-item>
            <el-descriptions-item label="最近观察">{{ localTime(detail.caseInfo.lastObservedAt) }}</el-descriptions-item><el-descriptions-item label="去重后证据">{{ detail.caseInfo.occurrenceCount }} 条</el-descriptions-item>
          </el-descriptions>
          <el-tabs v-model="tab">
            <el-tab-pane :label="`AI 分析（${detail.proposals.total}）`" name="analysis">
              <p class="description">以下内容为 Agent 的分析建议，实际修复、测试和发布结果需另行核实。</p>
              <el-empty v-if="!analyses.length" description="尚未形成分析方案" :image-size="55" />
              <article v-for="proposal in analyses" :key="proposal.id" class="proposal">
                <div class="tags"><strong>处理版本 {{ proposal.caseVersion }} 的方案</strong><el-tag effect="plain" type="info">AI 分析</el-tag><span class="muted">{{ localTime(proposal.createdAt) }}</span></div>
                <template v-if="proposal.parsed"><p>建议类型：{{ changeLabels[proposal.parsed.changeType || ''] || proposal.parsed.changeType || '未记录' }}</p><dl><template v-for="field in fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ proposal.parsed[field.key] || '未记录' }}</dd></template></dl></template>
                <pre v-else>{{ prettyPayload(proposal.proposalJson) }}</pre>
              </article>
              <el-pagination v-model:current-page="proposalPage" :total="detail.proposals.total" :page-size="5" layout="total, prev, pager, next" @current-change="loadDetail" />
            </el-tab-pane>
            <el-tab-pane :label="`监测证据（${detail.signals.total}）`" name="evidence">
              <el-empty v-if="!detail.signals.items.length" description="本页没有证据记录" :image-size="55" />
              <article v-for="signal in detail.signals.items" :key="signal.id" class="evidence">
                <div class="evidence-times"><span>发生：{{ localTime(signal.occurredAt) }}</span><span>观察：{{ localTime(signal.observedAt) }}</span></div>
                <pre>{{ prettyPayload(signal.evidenceJson) }}</pre>
                <details><summary>查看来源引用</summary><dl><dt>来源事件</dt><dd>{{ signal.sourceEventId }}</dd><dt>监测记录</dt><dd>{{ signal.observationId }}</dd><dt>记录位置</dt><dd>{{ signal.evidencePointer }}</dd></dl></details>
              </article>
              <el-pagination v-model:current-page="evidencePage" :total="detail.signals.total" :page-size="5" layout="total, prev, pager, next" @current-change="loadDetail" />
            </el-tab-pane>
            <el-tab-pane :label="`关联运行（${detail.relatedRunTotal}）`" name="runs">
              <p v-if="detail.caseInfo.activeRunId" class="description">当前处理运行：{{ detail.caseInfo.activeRunId }}</p>
              <el-table :data="detail.relatedRuns" row-key="runId"><el-table-column prop="runId" label="运行编号" min-width="300" /><el-table-column label="参与方式" width="120"><template #default="{ row }">{{ row.relation === 'ANALYSIS' ? '分析与处理' : '提供证据' }}</template></el-table-column><el-table-column label="关联时间" min-width="180"><template #default="{ row }">{{ localTime(row.createdAt) }}</template></el-table-column></el-table>
              <p v-if="detail.relatedRunTotal > detail.relatedRuns.length" class="muted">显示最近 {{ detail.relatedRuns.length }} 次关联运行，共 {{ detail.relatedRunTotal }} 次。</p>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.cases-panel { padding: 22px; }
.page-header, .tags, .filter, .evidence-times { display: flex; align-items: center; gap: 12px; }
.page-header { justify-content: space-between; margin-bottom: 18px; }
h3 { margin: 0 0 6px; }
.description, .muted { color: #6b7280; font-size: 12px; line-height: 1.6; }
.description { margin: 0; }
.filter { margin-bottom: 14px; font-size: 13px; }
.filter .el-select { width: min(400px, 75%); }
.feedback, .facts { margin: 16px 0; }
.case-title { height: auto; white-space: normal; text-align: left; line-height: 1.65; }
.case-title :deep(span) { white-space: normal; }
.el-pagination { justify-content: flex-end; margin-top: 16px; }
.detail-toolbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.case-detail { min-height: 160px; }
.tags, .evidence-times { flex-wrap: wrap; }
.proposal, .evidence { padding: 18px 0; border-bottom: 1px solid #e5e7eb; }
dl { margin: 14px 0; }
dt { color: #64748b; font-size: 12px; margin: 12px 0 4px; }
dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-size: 13px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; max-height: 460px; overflow: auto; padding: 12px; background: #f6f8fa; border-radius: 6px; font-size: 12px; }
.evidence-times { font-size: 12px; color: #64748b; }
summary { cursor: pointer; color: #64748b; font-size: 12px; }
@media (max-width: 700px) { .cases-panel { padding: 14px; } .page-header { align-items: flex-start; } }
</style>
