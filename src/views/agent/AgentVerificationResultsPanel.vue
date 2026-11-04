<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { fetchAgentVerification, fetchAgentVerificationSamples, fetchAgentVerificationEvidence } from '@/api/agentRelease'
import type { AgentReleaseDetail, AgentVerificationView, AgentVerificationSamplePage, AgentVerificationSample, AgentVerificationFact, AgentVerificationEvidenceView } from '@/types/agentRelease'
import { useAuthStore } from '@/stores/auth'
import { errorText, localTime } from './agentPresentation'
import { assessmentLabels, constraintText, duration, monitoringTools, sourcePermissions } from './agentVerificationPresentation'

const props = defineProps<{ plan: AgentReleaseDetail }>()
const auth = useAuthStore()
const view = ref<AgentVerificationView | null>(null)
const loading = ref(false)
const error = ref('')
const selectedCheck = ref('')
const samples = ref<AgentVerificationSamplePage | null>(null)
const samplesLoading = ref(false)
const samplesError = ref('')
const pageIndex = ref(0)
let cursors = [0]
const evidence = ref<AgentVerificationEvidenceView | null>(null)
const evidenceLoading = ref(false)
const evidenceError = ref('')
const selectedEvidence = ref<{ sample: AgentVerificationSample; fact: AgentVerificationFact } | null>(null)
let active = true
let epoch = 0
let samplesEpoch = 0
let evidenceEpoch = 0
const baseAccess = computed(() => auth.hasPermission('agent:task:view') && auth.hasPermission('agent:code:use'))
const canView = computed(() => baseAccess.value && (props.plan.snapshot.verificationPlan?.checks || []).every(check => sourcePermissions(check.toolCode).some(auth.hasPermission)))
const standards = computed(() => new Map(view.value?.verificationPlan.checks.map(check => [check.id, check]) || []))
const statuses: Record<string, string> = { OBSERVING: '观察中', PASSED: '已记录通过', FAILED: '已记录未通过' }
const payloadText = computed(() => evidence.value ? JSON.stringify(evidence.value.payload, null, 2) : '')
const assessmentTone = (value: string) => value === 'PASS' ? 'success' : value === 'FAIL' ? 'danger' : 'info'

function closeEvidence() {
  evidenceEpoch++; evidence.value = null; selectedEvidence.value = null; evidenceError.value = ''; evidenceLoading.value = false
}
function clearSamples() {
  samplesEpoch++; samples.value = null; samplesError.value = ''; samplesLoading.value = false
  pageIndex.value = 0; cursors = [0]; closeEvidence()
}
function clear() {
  epoch++; view.value = null; loading.value = false; error.value = ''; selectedCheck.value = ''; clearSamples()
}
async function load() {
  clear()
  if (!active || !canView.value) return
  const ticket = epoch, planId = props.plan.id
  const current = () => active && canView.value && ticket === epoch && props.plan.id === planId
  loading.value = true
  try {
    const result = await fetchAgentVerification(planId)
    if (!current()) return
    if (result && (result.planId !== planId || result.runId !== props.plan.runId || result.changeSetId !== props.plan.changeSetId
      || result.approvedSnapshotHash !== props.plan.snapshotHash || result.manifestHash !== props.plan.manifestHash || result.stage !== props.plan.stage)) {
      throw new Error('复查记录与当前发布材料不一致，请重新读取发布计划')
    }
    view.value = result
    if (result?.verificationPlan.checks.length) {
      selectedCheck.value = result.verificationPlan.checks[0].id
      await loadSamples(0)
    }
  } catch (cause) { if (current()) { view.value = null; clearSamples(); error.value = errorText(cause) } }
  finally { if (current()) loading.value = false }
}
async function loadSamples(index: number) {
  const target = view.value
  if (!target || !selectedCheck.value || !active || !canView.value) return
  const ticket = ++samplesEpoch, parent = epoch, planId = props.plan.id, checkId = selectedCheck.value
  const afterOrder = cursors[index] ?? 0
  const current = () => active && canView.value && parent === epoch && ticket === samplesEpoch && props.plan.id === planId && selectedCheck.value === checkId
  pageIndex.value = index
  samples.value = null; samplesError.value = ''; samplesLoading.value = true; closeEvidence()
  try {
    const result = await fetchAgentVerificationSamples(planId, { checkId, afterOrder, throughOrder: target.version, pageSize: 10 })
    if (!current()) return
    if (result.planId !== planId || result.verificationId !== target.id || result.checkId !== checkId
      || result.afterOrder !== afterOrder || result.throughOrder !== target.version || result.items.some(sample => sample.checkId !== checkId)) {
      throw new Error('采样历史与当前复查项不一致，请刷新复查结果')
    }
    samples.value = result
    cursors = cursors.slice(0, index + 1)
    if (result.hasMore) cursors.push(result.nextAfterOrder)
  } catch (cause) { if (current()) samplesError.value = errorText(cause) }
  finally { if (current()) samplesLoading.value = false }
}
function selectCheck() { clearSamples(); void loadSamples(0) }
async function openEvidence(sample: AgentVerificationSample, fact: AgentVerificationFact) {
  const target = view.value
  if (!target || !active || !canView.value) return
  closeEvidence(); selectedEvidence.value = { sample, fact }; evidenceLoading.value = true
  const ticket = evidenceEpoch, parent = epoch, history = samplesEpoch, planId = props.plan.id, checkId = selectedCheck.value
  const current = () => active && canView.value && ticket === evidenceEpoch && parent === epoch && history === samplesEpoch && props.plan.id === planId && selectedCheck.value === checkId
  try {
    const result = await fetchAgentVerificationEvidence(planId, sample.id, fact.observationId, fact.pointer)
    if (!current()) return
    if (result.planId !== planId || result.verificationId !== target.id || result.sampleId !== sample.id || result.checkId !== checkId
      || result.observationId !== fact.observationId || result.pointer !== fact.pointer || result.contentHash !== fact.contentHash) {
      throw new Error('原始监测记录与所选采样引用不一致')
    }
    evidence.value = result
  } catch (cause) { if (current()) evidenceError.value = errorText(cause) }
  finally { if (current()) evidenceLoading.value = false }
}
function invalidate() { active = false; clear() }
watch(() => [props.plan.id, props.plan.version, props.plan.snapshotHash, auth.userName, auth.permissions.slice().sort().join('|')], () => { void load() }, { immediate: true })
onDeactivated(invalidate)
onBeforeUnmount(invalidate)
onActivated(() => { if (!active) { active = true; void load() } })
</script>

<template>
  <section class="verification-results" v-if="baseAccess">
    <div class="heading"><h4>业务效果复查结果</h4><el-button :disabled="!canView" :loading="loading" @click="load">刷新复查结果</el-button></div>
    <el-alert v-if="!canView" title="缺少相关监测来源的查看权限，无法读取复查结果。" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="error" :title="error" type="error" :closable="false" show-icon />
    <p v-else-if="loading && !view" class="muted">正在读取复查记录…</p>
    <el-empty v-else-if="!view" :description="plan.status === 'SUCCEEDED' ? '尚未开始业务复查，等待 Agent 按已批准标准采样' : '尚无复查记录，须完成本组部署后开始'" :image-size="48" />
    <template v-if="canView && view">
      <div class="heading"><strong>{{ plan.stage === 'PROD_DEPLOY' ? '生产上线后' : '测试发布后' }}</strong><el-tag :type="view.status === 'FAILED' ? 'danger' : view.status === 'PASSED' ? 'success' : 'warning'">{{ statuses[view.status] || view.status }}</el-tag></div>
      <p class="muted">实际部署完成：{{ localTime(view.deployedAt) }}<span v-if="view.nextCheckAt"> · 下次计划复查：{{ localTime(view.nextCheckAt) }}</span></p>
      <article v-if="view.conclusion" class="conclusion">
        <div class="heading"><strong>Agent 最新结论：{{ assessmentLabels[view.conclusion.assessment] || view.conclusion.assessment }}</strong><span class="muted">{{ localTime(view.conclusion.recordedAt) }}</span></div>
        <p>记录结论时的平台约束：{{ view.conclusion.platformConstraintsSatisfied ? '全部满足' : '尚未全部满足' }}</p>
        <el-alert v-if="view.conclusion.historicalDataPending" title="Agent 标记历史数据仍待处置。" type="warning" :closable="false" />
        <details><summary>查看完整结论理由</summary><p class="reason">{{ view.conclusion.reason }}</p></details>
      </article>
      <p v-else class="muted">Agent 尚未提交总体结论。</p>
      <el-alert :title="view.currentConstraintsSatisfied ? '当前证据约束全部满足' : '当前证据约束尚未全部满足'" :type="view.currentConstraintsSatisfied ? 'success' : 'warning'" :closable="false" show-icon />
      <p class="muted">核验时间：{{ localTime(view.constraintsCheckedAt) }}。历史结论保留，当前数据新鲜度可能变化；问题是否关闭以巡检问题状态为准。</p>
      <article v-if="view.caseResolution" class="conclusion">
        <strong>{{ view.caseClosed ? '此复查已支持原问题关闭' : '此复查保留历史关闭记录，问题已重新进入处理' }}</strong>
        <p class="muted">关闭时间：{{ localTime(view.caseResolution.createdAt) }} · 关闭时处理版本 {{ view.caseResolution.resolvedVersion }}。当前状态以巡检问题为准。</p>
        <details><summary>查看关闭判断与问题标识</summary><p class="reason">{{ view.caseResolution.reason }}</p><p class="muted">问题：{{ view.caseResolution.caseId }}</p></details>
      </article>
      <article v-for="check in view.checks" :key="check.checkId" class="check-status">
        <h5>{{ standards.get(check.checkId)?.monitoringItem || check.checkId }}</h5>
        <p class="muted">{{ monitoringTools[standards.get(check.checkId)?.toolCode || ''] || standards.get(check.checkId)?.toolCode }} · {{ standards.get(check.checkId)?.scope.businessLineCode }} / {{ standards.get(check.checkId)?.scope.environmentCode }}</p>
        <div class="metrics">
          <span>有效样本 <strong>{{ check.distinctSamples }}</strong> / {{ standards.get(check.checkId)?.minimumSamples }}</span>
          <span>连续观察 <strong>{{ duration(check.observedSeconds) }}</strong> / {{ duration(standards.get(check.checkId)?.observationSeconds || 0) }}</span>
          <span>最近判断 <el-tag :type="assessmentTone(check.assessment)">{{ assessmentLabels[check.assessment] }}</el-tag></span>
        </div>
        <p class="muted">有效窗口：{{ localTime(check.windowStart) }} 至 {{ localTime(check.windowEnd) }}</p>
        <ul v-if="check.constraints.length" class="constraints"><li v-for="code in check.constraints" :key="code">{{ constraintText(code) }}</li></ul>
        <p v-else class="satisfied">此项当前约束已满足</p>
        <p v-if="check.reason" class="reason">{{ check.reason }}<span v-if="check.reasonTruncated" class="muted">…完整理由见采样历史</span></p>
      </article>
      <div class="heading history-heading"><h5>采样历史</h5><label :for="`verification-check-${plan.id}`">复查项 <select :id="`verification-check-${plan.id}`" v-model="selectedCheck" :disabled="loading" @change="selectCheck"><option v-for="check in view.verificationPlan.checks" :key="check.id" :value="check.id">{{ check.monitoringItem }}</option></select></label></div>
      <p class="muted">按记录顺序查看。单次证据满足约束不代表计入当前有效窗口；重复数据、观察间断等会影响上方汇总。刷新复查结果后可查看新增采样。</p>
      <div v-loading="samplesLoading" class="history">
        <el-alert v-if="samplesError" :title="samplesError" type="error" :closable="false" show-icon />
        <el-button v-if="samplesError" @click="loadSamples(pageIndex)">重试采样读取</el-button>
        <el-empty v-else-if="samples && !samples.items.length" description="该复查项尚无采样记录" :image-size="40" />
        <article v-for="sample in samples?.items || []" :key="sample.id" class="sample">
          <div class="heading"><strong>采样 {{ sample.sampleOrder }} · {{ localTime(sample.createdAt) }}</strong><el-tag :type="assessmentTone(sample.assessment)">Agent {{ assessmentLabels[sample.assessment] }}</el-tag></div>
          <p v-if="sample.historicalDataPending" class="constraints">历史数据仍待处置</p>
          <details><summary>查看本次判断理由</summary><p class="reason">{{ sample.reason }}</p></details>
          <div v-for="(fact, index) in sample.evidence" :key="`${fact.observationId}:${fact.pointer}`" class="fact">
            <div class="heading"><strong>证据 {{ index + 1 }}</strong><el-button link type="primary" @click="openEvidence(sample, fact)">查看原始监测记录</el-button></div>
            <p>查询时间：{{ localTime(fact.observedAt) }}<br>业务数据时间：{{ localTime(fact.dataAt) }}</p>
            <p v-if="fact.coverageFrom || fact.coverageThrough">查询区间：{{ localTime(fact.coverageFrom) }} 至 {{ localTime(fact.coverageThrough) }}</p>
            <ul v-if="fact.problems.length" class="constraints"><li v-for="code in fact.problems" :key="code">{{ constraintText(code) }}</li></ul>
            <p v-else class="satisfied">采样当时的单次证据约束满足</p>
          </div>
        </article>
        <div v-if="samples" class="pagination"><el-button :disabled="samplesLoading || pageIndex === 0" @click="loadSamples(pageIndex - 1)">上一页</el-button><span>第 {{ pageIndex + 1 }} 页 · 本页 {{ samples.items.length }} 条</span><el-button :disabled="samplesLoading || !samples.hasMore" @click="loadSamples(pageIndex + 1)">下一页</el-button></div>
      </div>
      <section v-if="selectedEvidence" class="original-evidence" v-loading="evidenceLoading">
        <div class="heading"><h5>原始监测记录</h5><el-button @click="closeEvidence">关闭原始记录</el-button></div>
        <el-alert v-if="evidenceError" :title="evidenceError" type="error" :closable="false" show-icon />
        <el-button v-if="evidenceError" @click="openEvidence(selectedEvidence.sample, selectedEvidence.fact)">重试原始记录</el-button>
        <template v-if="evidence">
          <p>{{ monitoringTools[evidence.toolCode] || evidence.toolCode }} · {{ evidence.scope.businessLineCode }} / {{ evidence.scope.environmentCode }} · {{ localTime(evidence.observedAt) }}</p>
          <p class="muted">本次引用位置：{{ evidence.pointer }}；下方为当时保存的完整脱敏记录。</p>
          <pre>{{ payloadText }}</pre>
          <details><summary>查看来源标识与摘要</summary><p class="muted">{{ evidence.observationId }}</p><code>{{ evidence.contentHash }}</code></details>
        </template>
      </section>
      <details v-if="view.artifactId"><summary>查看已记录通过的复查凭据标识</summary><code>{{ view.artifactId }}</code></details>
    </template>
  </section>
</template>

<style scoped>
.verification-results { padding: 16px; margin: 18px 0; border: 1px solid #dbe2ea; border-radius: 8px; background: #fff; }
.heading, .metrics, .pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
h4, h5 { margin: 8px 0; } h5 { font-size: 14px; overflow-wrap: anywhere; }
p { font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.muted { color: #64748b; font-size: 12px; line-height: 1.7; }
.conclusion, .check-status, .sample { padding: 14px; margin: 12px 0; border: 1px solid #e5e7eb; border-radius: 6px; background: #f8fafc; }
.check-status { background: #fff; }.metrics { justify-content: flex-start; font-size: 13px; gap: 16px; }
.reason { white-space: pre-wrap; overflow-wrap: anywhere; }
.constraints { color: #92400e; font-size: 13px; line-height: 1.7; padding-left: 20px; }.satisfied { color: #217a47; font-size: 12px; }
.history { min-height: 70px; }.history-heading { margin-top: 24px; }.history-heading label { display: flex; align-items: center; gap: 8px; font-size: 13px; max-width: 100%; }
select { font: inherit; padding: 7px; border: 1px solid #cbd5e1; border-radius: 4px; max-width: 400px; }
.fact { padding: 10px 0; border-top: 1px solid #e2e8f0; }.fact p { margin: 6px 0; }
.pagination { justify-content: flex-end; margin: 14px 0; font-size: 13px; }
.original-evidence { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 10px; }
pre { max-height: 420px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; background: #f1f5f9; font-size: 12px; }
summary { cursor: pointer; color: #475569; margin: 10px 0; font-size: 13px; } code { font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 560px) { .verification-results { padding: 10px; } .history-heading label { width: 100%; } select { min-width: 0; flex: 1; max-width: 100%; } }
</style>
