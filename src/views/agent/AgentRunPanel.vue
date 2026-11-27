<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelAgentRun, deleteAgentRun, replyToAgentRun, retryAgentRun, fetchStructuredAgentReport } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentRun, AgentRunDetail, AgentOptions } from '@/types/agent'
import AgentRunAcceptancePanel from './AgentRunAcceptancePanel.vue'
import AgentRunIssuesPanel from './AgentRunIssuesPanel.vue'
import AgentChangesPanel from './AgentChangesPanel.vue'
import AgentRunReconciliationPanel from './AgentRunReconciliationPanel.vue'
import AgentReportView from './AgentReportView.vue'
import { renderStructuredReport, structuredReportDocument, type StructuredReport } from './structuredAgentReport'
import reportCss from './agentReport.css?inline'
import AgentMonitorResults from './AgentMonitorResults.vue'
import { monitorEvidence, monitorOverview } from './agentMonitorEvidence'
import { buildAgentReportDocument } from './agentReportPresentation'
import { errorText, eventLabels, eventSummary, localTime, prettyPayload, requestKey, statusLabels, statusTone } from './agentPresentation'

const router = useRouter()
/** 数字员工任务成果里的一轮运行；dutyObjective 为该员工常设配置的工作目标。 */
const props = defineProps<{ detail: AgentRunDetail; businessLines?: AgentOptions['scopes']; dutyObjective?: string }>()
const emit = defineEmits<{ refresh: []; newRun: [AgentRun] }>()
const auth = useAuthStore()
const busy = ref(false)
const error = ref('')
const reply = ref('')
const eventPage = ref(1)
const tab = ref('result')
const resultTab = ref('report')
let replyAttempt: { text: string; key: string } | null = null
let retryKey = requestKey()
const run = computed(() => props.detail.run)
const structuredReport = ref<StructuredReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const reportContext = computed(() => ({ businessLines: props.businessLines }))
const structuredHtml = computed(() => structuredReport.value ? renderStructuredReport(structuredReport.value, reportContext.value) : '')
let reportEpoch = 0
watch(() => [run.value.id, run.value.updatedAt], async () => {
  const epoch = ++reportEpoch
  structuredReport.value = null
  reportError.value = ''
  reportLoading.value = true
  try {
    const response = await fetchStructuredAgentReport(run.value.agentId, run.value.id)
    if (epoch === reportEpoch) structuredReport.value = response.available ? response.report || null : null
  } catch (cause) { if (epoch === reportEpoch) reportError.value = errorText(cause) }
  finally { if (epoch === reportEpoch) reportLoading.value = false }
}, { immediate: true })
onBeforeUnmount(() => { reportEpoch++ })
const canOperate = computed(() => auth.hasPermission('agent:task:operate'))
const canManage = computed(() => auth.hasPermission('agent:manage'))
const deletable = computed(() => !['QUEUED', 'RUNNING', 'CANCELLING'].includes(run.value.status))
const terminal = computed(() => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.value.status))
const monitorBatches = computed(() => props.detail.events.filter(e => e.kind === 'BUSINESS_MONITOR_SUBMITTED').flatMap(e => {
  try { const p = JSON.parse(e.payloadJson); return Number.isSafeInteger(p.monitorRunId) && p.monitorRunId > 0 ? [p.monitorRunId as number] : [] } catch { return [] }
}))
const monitorResults = computed(() => monitorEvidence(props.detail.events))
const formalOverview = computed(() => monitorOverview(monitorResults.value))
const monitorRuleCount = computed(() => monitorResults.value.reduce((total, batch) => total + batch.rules.length, 0))
const eventRows = computed(() => props.detail.events.slice((eventPage.value - 1) * 20, eventPage.value * 20))
/** 历史运行可能来自需求开发、问题修复等其他任务；目标与常设配置不同时才单独标出。 */
const foreignObjective = computed(() => {
  const objective = props.detail.specification.objective
  return objective && objective !== props.dutyObjective ? objective : ''
})

function downloadReport() {
  const objective = props.detail.specification.objective || '数字员工运行报告'
  const title = props.detail.configuration?.name ? `${props.detail.configuration.name} · ${objective}` : objective
  const scopes = (props.detail.specification.scopes || []).map(scope => `${scope.businessLineCode}/${scope.environmentCode}`).join('、')
  const html = structuredReport.value ? structuredReportDocument(structuredReport.value, reportCss, reportContext.value) : buildAgentReportDocument(title, run.value.resultText || '', [
    `执行状态：${statusLabels[run.value.status] || run.value.status}`,
    `范围：${scopes || '未指定'} · 开始：${localTime(run.value.createdAt)}`,
    `运行概况：${run.value.stepCount} 次行动 · ${Math.floor(run.value.elapsedMillis / 1000)} 秒 · ${props.detail.artifacts.length} 项产物`,
    ...(props.detail.configuration?.model ? [`模型：${props.detail.configuration.model}`] : []),
  ], formalOverview.value)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(props.detail.configuration?.name || '报告').replace(/[\\/:*?"<>|]/g, '')}-${run.value.createdAt.slice(0, 10)}.html`
  link.click()
  URL.revokeObjectURL(url)
}
watch(() => props.detail.run.id, () => { reply.value = ''; error.value = ''; eventPage.value = 1; replyAttempt = null; retryKey = requestKey(); tab.value = 'result' })
async function cancel() {
  const target = run.value
  try { await ElMessageBox.confirm('停止这次运行？已发出的外部操作仍会等待确认结果。', '停止运行', { type: 'warning', confirmButtonText: '请求停止', cancelButtonText: '继续执行' }) }
  catch { return }
  busy.value = true
  error.value = ''
  try { await cancelAgentRun(target); ElMessage.success('已发送停止请求'); emit('refresh') }
  catch (cause) { error.value = errorText(cause); emit('refresh') } finally { busy.value = false }
}
async function retry() {
  busy.value = true
  error.value = ''
  try { const created = await retryAgentRun(run.value, retryKey); retryKey = requestKey(); emit('newRun', created) }
  catch (cause) { error.value = errorText(cause); emit('refresh') } finally { busy.value = false }
}
async function removeRun() {
  try {
    await ElMessageBox.confirm('将物理删除该运行记录及其事件与产物（审计保留）。待核对的僵尸运行删除后立即释放其占用的全局并发额度。', `删除运行 ${run.value.id.slice(0, 8)}…`, { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  busy.value = true
  error.value = ''
  try {
    await deleteAgentRun(run.value.taskId, run.value)
    ElMessage.success('运行记录已删除')
    emit('refresh')
  } catch (cause) { error.value = errorText(cause) } finally { busy.value = false }
}
async function sendReply() {
  if (!reply.value.trim()) return
  const text = reply.value.trim()
  if (replyAttempt?.text !== text) replyAttempt = { text, key: requestKey() }
  busy.value = true
  error.value = ''
  try {
    await replyToAgentRun(run.value, replyAttempt.key, text)
    reply.value = ''
    replyAttempt = null
    ElMessage.success('补充指令已保存')
    emit('refresh')
  } catch (cause) { error.value = errorText(cause); emit('refresh') } finally { busy.value = false }
}
</script>

<template>
  <section class="run-panel">
    <div v-if="monitorBatches.length" class="monitor-batches">
      <strong>本轮业务监测</strong>
      <el-button v-for="id in monitorBatches" :key="id" link type="primary" @click="router.push({ path: '/ops/accounting', query: { runId: id } })">核对批次 #{{ id }} · 规则结果与实际 SQL</el-button>
    </div>
    <div class="run-heading">
      <div class="run-heading-title"><span>执行状态</span><el-tag :type="statusTone(run.status)">{{ statusLabels[run.status] || run.status }}</el-tag><span class="run-meta">{{ localTime(run.createdAt) }}</span></div>
      <div>
        <el-button v-if="run.resultText || structuredReport" :disabled="reportLoading || !!reportError" @click="downloadReport">下载报告 (HTML)</el-button>
        <template v-if="canOperate">
          <el-button v-if="!terminal && !run.cancelRequested" :disabled="busy" @click="cancel">停止运行</el-button>
          <el-button v-if="run.retryAllowed" :loading="busy" @click="retry">重试</el-button>
        </template>
        <el-button v-if="canManage && deletable" type="danger" plain :loading="busy" @click="removeRun">删除记录</el-button>
      </div>
    </div>
    <div class="run-facts" aria-label="运行概况">
      <span>运行概况</span><span><strong>{{ run.stepCount }}</strong> 次行动</span><span><strong>{{ Math.floor(run.elapsedMillis / 1000) }}</strong> 秒</span><span><strong>{{ detail.artifacts.length }}</strong> 项产物</span>
    </div>
    <details class="run-technical"><summary>运行信息</summary><p class="run-meta">模型：{{ detail.configuration.model || '未记录模型' }}</p></details>
    <p v-if="foreignObjective" class="run-objective">本轮目标：{{ foreignObjective }}</p>
    <p v-if="detail.specification.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind))" class="run-meta">本轮完成目标：{{ detail.specification.completionTargets?.length ? detail.specification.completionTargets.map(scope => `${scope.businessLineCode} / ${scope.environmentCode === 'TEST' ? '测试' : '生产'}`).join('、') : '尚未明确，请在执行设置中选择' }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
    <el-alert v-if="run.errorMessage" :title="run.errorMessage" :type="run.status === 'FAILED' ? 'error' : 'warning'" :closable="false" show-icon class="feedback" />
    <el-alert v-if="run.status === 'CANCELLING'" title="正在确认执行与外部操作的停止结果，尚未完成取消。" type="warning" :closable="false" class="feedback" />
    <AgentRunReconciliationPanel :run="run" @refresh="emit('refresh')" />
    <el-tabs v-model="tab">
      <el-tab-pane label="结果与产物" name="result">
        <el-tabs v-model="resultTab" class="result-subtabs">
          <el-tab-pane label="结果报告" name="report">
            <el-alert v-if="reportError" :title="`报告读取失败：${reportError}`" type="error" :closable="false" />
            <p v-else-if="reportLoading">正在读取报告…</p>
            <article v-else-if="structuredReport" class="agent-report" aria-label="结构化报告" v-html="structuredHtml" />
            <AgentReportView v-else-if="run.resultText" :text="run.resultText" :formal-overview="formalOverview" />
            <el-empty v-else description="尚未返回最终结果" :image-size="56" />
            <div v-for="artifact in detail.artifacts" :key="artifact.id" class="artifact">
              <strong>{{ artifact.kind === 'REPORT' ? '分析报告' : artifact.kind }}</strong>
              <el-tag size="small" effect="plain">{{ artifact.provenance === 'AI_REPORT' ? 'AI 报告' : '执行证据' }}</el-tag>
              <span class="run-meta">{{ localTime(artifact.createdAt) }}</span>
              <details><summary>查看产物内容与校验值</summary><pre>{{ prettyPayload(artifact.payloadJson) }}</pre><code>{{ artifact.contentHash }}</code></details>
            </div>
          </el-tab-pane>
          <el-tab-pane v-if="monitorBatches.length" :label="`业务监测（${monitorRuleCount} 条规则）`" name="monitor-evidence">
            <AgentMonitorResults v-if="monitorResults.length" :batches="monitorResults" />
            <el-empty v-else description="已关联核对批次，尚未取得最终规则结果" :image-size="48" />
          </el-tab-pane>
          <AgentRunIssuesPanel :grouped="!monitorBatches.length" :detail="detail" @refresh="emit('refresh')" />
        </el-tabs>
      </el-tab-pane>
      <el-tab-pane v-if="auth.hasPermission('agent:task:view')" label="产物验收" name="acceptance">
        <AgentRunAcceptancePanel v-if="tab === 'acceptance'" :run="run" />
      </el-tab-pane>
      <el-tab-pane v-if="auth.hasPermission('agent:code:use')" label="候选变更" name="changes">
        <AgentChangesPanel v-if="tab === 'changes'" :run-id="run.id" />
      </el-tab-pane>
      <el-tab-pane :label="`执行记录（${detail.events.length}）`" name="events">
        <el-timeline>
          <el-timeline-item v-for="event in eventRows" :key="event.id" :timestamp="localTime(event.createdAt)">
            <strong>{{ eventLabels[event.kind] || event.kind }}</strong>
            <p v-if="eventSummary(event.payloadJson)" class="event-summary">{{ eventSummary(event.payloadJson) }}</p>
            <details><summary>查看记录</summary><pre>{{ prettyPayload(event.payloadJson) }}</pre></details>
          </el-timeline-item>
        </el-timeline>
        <el-pagination v-model:current-page="eventPage" :total="detail.events.length" :page-size="20" layout="prev, pager, next" />
      </el-tab-pane>
    </el-tabs>
    <div v-if="canOperate && !terminal && !run.cancelRequested" class="reply-box">
      <label :for="`reply-${run.id}`">补充指令或回答 Agent 的问题</label>
      <el-input :id="`reply-${run.id}`" v-model="reply" type="textarea" :rows="3" maxlength="12000" :disabled="busy" placeholder="补充目标、业务口径或已有信息" />
      <el-button type="primary" :loading="busy" :disabled="!reply.trim()" @click="sendReply">发送补充</el-button>
    </div>
  </section>
</template>

<style scoped>
.run-panel { min-width: 0; }
.result-subtabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.run-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.run-heading-title { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: #637582; }
.run-heading > div:last-child { display: flex; flex-wrap: wrap; gap: 8px; }
.run-heading .el-button + .el-button { margin-left: 0; }
.run-facts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 16px; font-size: 12px; color: #637582; margin: 16px 0 10px; }
.run-facts strong { font-size: 17px; color: #304b57; }
.run-technical { margin-bottom: 16px; }
.run-meta { color: #6b7280; font-size: 12px; margin-left: 10px; }
.run-objective { margin: 0 0 12px; color: #314b59; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.feedback { margin: 12px 0; }
pre, .event-summary { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
pre { max-height: 500px; overflow: auto; padding: 12px; background: #f6f8fa; border-radius: 6px; font-size: 12px; }
.artifact { padding: 16px 0; border-top: 1px solid #f0f1f3; }
.artifact .el-tag { margin-left: 12px; }
summary { color: #64748b; font-size: 12px; cursor: pointer; margin-top: 8px; }
code { font-size: 11px; overflow-wrap: anywhere; }
.reply-box { display: grid; gap: 10px; margin-top: 20px; }
.reply-box .el-button { justify-self: end; }
@media (max-width: 800px) { .run-heading { align-items: flex-start; flex-direction: column; } }
</style>
