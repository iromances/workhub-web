<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgentReleasePlan, fetchAgentReleasePlans, reviewAgentReleasePlan, releaseRequestRejected } from '@/api/agentRelease'
import type { AgentReleaseDetail, AgentReleasePlan, AgentReleaseReviewRequest } from '@/types/agentRelease'
import { useAuthStore } from '@/stores/auth'
import AgentReleaseVerificationPanel from './AgentReleaseVerificationPanel.vue'
import { errorText, localTime, prettyPayload, requestKey } from './agentPresentation'

const props = defineProps<{ changeSetId: string }>()
const auth = useAuthStore()
const rows = ref<AgentReleasePlan[]>([])
const detail = ref<AgentReleaseDetail | null>(null)
const selected = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const busy = ref(false)
const error = ref('')
const detailError = ref('')
const reviewError = ref('')
const comment = ref('')
const attempts = ref<Record<string, AgentReleaseReviewRequest>>({})
let active = true
let listEpoch = 0
let detailEpoch = 0
const canView = computed(() => auth.hasPermission('agent:task:view') && auth.hasPermission('agent:code:use'))
const canReview = computed(() => auth.hasPermission('autonomy:release:review'))
const pending = computed(() => attempts.value[selected.value])
const isWaiting = computed(() => detail.value?.status === 'WAITING_REVIEW')
const canApprove = computed(() => canReview.value && isWaiting.value && detail.value?.readyForReview && !!detail.value?.snapshot.verificationPlan && !busy.value && !pending.value)
const stage = (value: string) => value === 'PROD_DEPLOY' ? '生产上线' : '测试发布'
const labels: Record<string, string> = {
  WAITING_REVIEW: '等待人工审核', APPROVED: '已批准，等待执行', EXECUTING: '发布执行中', NEEDS_ATTENTION: '需核对原请求',
  STOPPING: '等待在途请求结束', SUCCEEDED: '部署完成，待业务复查', FAILED: '发布失败', CANCELLED: '已停止后续发布', REJECTED: '已驳回',
  PREPARED: '等待前置步骤或调度', SUBMITTING: '已登记发送意图', QUEUED: 'Jenkins 排队中', BUILDING: 'Jenkins 执行中',
  DEPLOYING: '等待实际部署回执', UNKNOWN: '原请求结果待核对', ABORTED: 'Jenkins 已取消', BLOCKED: '未发出，已阻止',
}
const blockers: Record<string, string> = {
  VERIFICATION_PLAN_MISSING: '缺少随本次发布审核的业务复查标准',
  PLATFORM_TEST_EVIDENCE_MISSING: '缺少平台实际测试结果', MANIFEST_NOT_READY: '候选清单尚未满足发布条件',
  MANIFEST_NOT_CURRENT: '候选清单已失效', TEST_ENVIRONMENT_VERIFICATION_MISSING: '缺少同一版本测试发布后的业务验证',
  RELEASE_MATERIAL_CHANGED: '审核材料已变化，需重新准备计划', RELEASE_MATERIAL_UNAVAILABLE: '当前发布材料或绑定不可用',
  RELEASE_AUTHORIZATION_UNAVAILABLE: '当前执行授权不可用', REMOTE_DELIVERY_EVIDENCE_MISSING: '缺少远端交付确认',
}
const stepRows = computed(() => {
  const deployments = new Map(detail.value?.deployments.map(row => [row.id, row]))
  return detail.value?.snapshot.steps.map((step, index) => ({ ...step, order: index + 1, deployment: deployments.get(step.requestId) })) || []
})
const targets = computed(() => [...new Set(detail.value?.snapshot.steps.map(step => `${step.binding.binding.scope.businessLineCode} / ${step.binding.binding.scope.environmentCode}`))].join('、'))
const bindingNames = computed(() => new Map(detail.value?.snapshot.steps.map(step => [step.binding.binding.id, step.binding.binding.name])))
function tone(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'SUCCEEDED') return 'success'
  if (['FAILED', 'REJECTED', 'BLOCKED'].includes(status)) return 'danger'
  return ['CANCELLED', 'ABORTED'].includes(status) ? 'info' : 'warning'
}
function resetDetail() { ++detailEpoch; detail.value = null; detailError.value = ''; reviewError.value = ''; selected.value = ''; comment.value = ''; detailLoading.value = false; busy.value = false }
async function load() {
  const epoch = ++listEpoch; const id = props.changeSetId
  rows.value = []; error.value = ''; resetDetail(); loading.value = false
  if (!active || !canView.value) return
  loading.value = true
  try {
    const result = await fetchAgentReleasePlans(id)
    if (epoch !== listEpoch || !active || !canView.value || id !== props.changeSetId) return
    rows.value = result
    if (result.length) await select(result[0])
  } catch (cause) { if (epoch === listEpoch && active) error.value = errorText(cause) }
  finally { if (epoch === listEpoch) loading.value = false }
}
async function select(row: AgentReleasePlan) {
  if (busy.value || !active || !canView.value) return
  resetDetail(); selected.value = row.id; detailLoading.value = true
  const epoch = ++detailEpoch; const changeId = props.changeSetId
  try {
    const result = await fetchAgentReleasePlan(row.id)
    if (epoch !== detailEpoch || !active || !canView.value || changeId !== props.changeSetId) return
    if (result.id !== row.id || result.changeSetId !== changeId) throw new Error('发布计划不属于当前候选版本')
    detail.value = result
    const attempt = attempts.value[result.id]
    if (attempt && result.reviews.some(review => review.requestKey === attempt.requestKey)) delete attempts.value[result.id]
    comment.value = attempts.value[result.id]?.comment || ''
  } catch (cause) { if (epoch === detailEpoch && active) detailError.value = errorText(cause) }
  finally { if (epoch === detailEpoch) detailLoading.value = false }
}
async function review(decision: 'APPROVED' | 'REJECTED', retry = false) {
  const target = detail.value
  if (!target || !active || !canView.value || !canReview.value || busy.value) return
  if (!retry && (!comment.value.trim() || !isWaiting.value || pending.value || decision === 'APPROVED' && (!target.readyForReview || !target.snapshot.verificationPlan))) return
  const epoch = detailEpoch; const changeId = props.changeSetId
  const request = retry ? attempts.value[target.id] : { requestKey: requestKey(), expectedVersion: target.version, snapshotHash: target.snapshotHash, decision, comment: comment.value.trim() }
  if (!request) return
  busy.value = true; reviewError.value = ''
  try {
    if (!retry) {
      try {
        await ElMessageBox.confirm(decision === 'APPROVED'
          ? `批准第 ${target.snapshot.change.revision} 版的${stage(target.stage)}？目标：${targets.value}，共 ${target.snapshot.steps.length} 个 Job，同时批准 ${target.snapshot.verificationPlan?.checks.length || 0} 项业务复查标准。WorkHub 将按已审核顺序自动调用 Jenkins。`
          : '驳回本组发布计划并将审核意见交给原 Agent 任务？', decision === 'APPROVED' ? '审核并执行发布' : '驳回发布计划',
        { type: 'warning', confirmButtonText: decision === 'APPROVED' ? '批准并执行' : '确认驳回', cancelButtonText: '返回核对' })
      } catch { return }
    }
    if (epoch !== detailEpoch || !active || !canView.value || !canReview.value || changeId !== props.changeSetId) return
    attempts.value[target.id] = request
    const result = await reviewAgentReleasePlan(target.id, request)
    if (result.id !== target.id || result.changeSetId !== changeId) throw new Error('审核返回的计划身份不一致')
    delete attempts.value[target.id]
    if (epoch !== detailEpoch || !active || !canView.value || !canReview.value || changeId !== props.changeSetId) return
    detail.value = result; comment.value = ''
    rows.value = rows.value.map(row => row.id === result.id ? result : row)
    ElMessage.success(request.decision === 'APPROVED' ? '整组审核已通过，WorkHub 将自动执行发布' : '驳回意见已保存到原任务')
  } catch (cause) {
    const rejected = releaseRequestRejected(cause)
    if (rejected) delete attempts.value[target.id]
    if (epoch === detailEpoch && active) reviewError.value = rejected ? errorText(cause) : `${errorText(cause)}。请刷新核对审核历史，或重试原请求。`
  }
  finally { if (epoch === detailEpoch) busy.value = false }
}
function invalidate() { active = false; ++listEpoch; rows.value = []; loading.value = false; resetDetail() }
watch(() => [props.changeSetId, auth.userName, auth.permissions.slice().sort().join('|')], () => { attempts.value = {}; void load() }, { immediate: true })
onDeactivated(invalidate)
onBeforeUnmount(invalidate)
onActivated(() => { if (!active) { active = true; void load() } })
</script>

<template>
  <section v-if="canView" class="release-panel">
    <div class="heading"><h3>发布审核</h3><el-button :loading="loading" :disabled="busy" @click="load">刷新发布计划</el-button></div>
    <p class="muted">人工核对整组提交、实测结果、目标环境和业务复查标准。审核通过后，由 WorkHub 调用既有 Jenkins 流程。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table v-loading="loading" :data="rows" row-key="id" :max-height="250" :current-row-key="selected" highlight-current-row @row-click="select">
      <el-table-column label="发布阶段" width="130"><template #default="{ row }"><el-button link type="primary" @click.stop="select(row)">{{ stage(row.stage) }}</el-button></template></el-table-column>
      <el-table-column label="状态" min-width="180"><template #default="{ row }">{{ labels[row.status] || row.status }}</template></el-table-column>
      <el-table-column prop="createdBy" label="准备人" width="140" />
      <el-table-column label="创建时间" width="175"><template #default="{ row }">{{ localTime(row.createdAt) }}</template></el-table-column>
      <template #empty><el-empty :description="error ? '计划读取失败，请重试' : '尚未准备发布计划'" :image-size="48" /></template>
    </el-table>
    <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
    <div v-loading="detailLoading" class="plan-detail">
      <template v-if="detail">
        <div class="heading"><h4>{{ stage(detail.stage) }} · 候选第 {{ detail.snapshot.change.revision }} 版</h4><el-tag :type="tone(detail.status)">{{ labels[detail.status] || detail.status }}</el-tag></div>
        <p><strong>目标环境：</strong>{{ targets }}</p>
        <el-alert v-if="detail.status === 'SUCCEEDED'" title="全部 Job 已取得部署成功回执，业务效果尚待复查。" type="info" :closable="false" show-icon />
        <el-alert v-else-if="!detail.current" title="当前材料已失效或不可用。保留本次审核及在途发布历史，请重新准备材料后审核。" type="warning" :closable="false" show-icon />
        <ul v-if="isWaiting && detail.blockers.length" class="blockers"><li v-for="item in detail.blockers" :key="item">{{ blockers[item] || item }}</li></ul>
        <h4>本次审核的准确提交</h4>
        <div v-for="repo in detail.snapshot.change.manifest.repositories" :key="repo.repositoryId" class="commit"><strong>{{ repo.repositoryName }}</strong><code>{{ repo.resultSha }}</code></div>
        <details><summary>查看本次冻结的方案、验收及回退说明</summary><dl><template v-for="(label, key) in { summary: '变更说明', impact: '影响范围', acceptance: '验收建议', rollback: '回退建议' }" :key="key"><dt>{{ label }}</dt><dd>{{ detail.snapshot.change.manifest.plan[key] }}</dd></template></dl></details>
        <AgentReleaseVerificationPanel :plan="detail.snapshot.verificationPlan" />
        <h4>Job 顺序与发布进度</h4>
        <div v-for="step in stepRows" :key="step.requestId" class="step">
          <div class="heading"><strong>{{ step.order }}. {{ step.binding.binding.name }}</strong><el-tag :type="tone(step.deployment?.status || 'PREPARED')">{{ step.deployment ? labels[step.deployment.status] || step.deployment.status : '尚未登记执行' }}</el-tag></div>
          <p>{{ step.binding.instance.name }} · {{ step.binding.binding.jobSegments.join(' / ') }} · {{ step.binding.binding.scope.businessLineCode }} / {{ step.binding.binding.scope.environmentCode }}</p>
          <p class="muted">前置步骤：{{ step.dependsOn.length ? step.dependsOn.map(id => bindingNames.get(id) || id).join('、') : '无' }}</p>
          <p v-if="step.deployment" class="muted">队列 {{ step.deployment.queueId ?? '—' }} · 构建 {{ step.deployment.buildNumber ?? '—' }} · 构建结果 {{ step.deployment.buildResult || '尚无结果' }} · {{ localTime(step.deployment.updatedAt) }}</p>
          <el-alert v-if="step.deployment?.errorMessage" :title="step.deployment.errorMessage" type="warning" :closable="false" show-icon />
          <details><summary>查看已固定的执行参数</summary><dl><template v-for="(value, key) in step.parameters" :key="key"><dt>{{ key }}</dt><dd><code>{{ value }}</code></dd></template></dl></details>
        </div>
        <h4>本次冻结的平台验证证据（{{ detail.snapshot.evidence.length }}）</h4>
        <p v-if="!detail.snapshot.evidence.length" class="muted">没有平台验证证据，不能批准发布。</p>
        <details v-for="evidence in detail.snapshot.evidence" :key="evidence.id" class="evidence"><summary>{{ evidence.kind === 'TEST_REPORT' ? '实际测试报告' : '业务验证记录' }} · {{ localTime(evidence.createdAt) }}</summary><pre>{{ prettyPayload(evidence.payloadJson) }}</pre><code>{{ evidence.contentHash }}</code></details>
        <h4>人工审核历史</h4>
        <p v-if="!detail.reviews.length" class="muted">尚无审核结论。</p>
        <div v-for="item in detail.reviews" :key="item.id" class="review"><strong>{{ item.decision === 'APPROVED' ? '批准' : '驳回' }} · {{ item.reviewedBy }}</strong><span class="muted">{{ localTime(item.createdAt) }}</span><p>{{ item.comment }}</p></div>
        <div v-if="canReview && (isWaiting || pending)" class="review-form">
          <label for="release-review-comment">审核意见</label>
          <el-input id="release-review-comment" v-model="comment" type="textarea" :rows="3" maxlength="4000" show-word-limit :disabled="busy || !!pending" placeholder="说明核对结论或需要 Agent 补充的内容" />
          <el-alert v-if="reviewError" :title="reviewError" type="error" :closable="false" show-icon />
          <p v-if="pending" class="muted">上次提交结果尚未确认。重试会沿用相同版本、意见和请求标识。</p>
          <div class="actions"><template v-if="pending"><el-button :loading="busy" @click="review(pending.decision, true)">重试原审核请求</el-button></template><template v-else><el-button type="primary" :disabled="!canApprove || !comment.trim()" :loading="busy" @click="review('APPROVED')">批准{{ stage(detail.stage) }}</el-button><el-button type="danger" plain :disabled="busy || !comment.trim()" @click="review('REJECTED')">驳回并反馈</el-button></template></div>
        </div>
        <p v-else-if="isWaiting && !canReview" class="muted">当前账号没有发布审核权限。</p>
        <details><summary>查看本次审核材料标识</summary><p>{{ detail.id }}</p><code>{{ detail.snapshotHash }}</code></details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.release-panel { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
.heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.heading h3, .heading h4 { margin: 10px 0; }
.muted { color: #6b7280; font-size: 12px; overflow-wrap: anywhere; }
.plan-detail { min-height: 30px; }
.blockers { color: #92400e; line-height: 1.8; }
.commit { display: flex; flex-wrap: wrap; gap: 16px; padding: 8px 0; }
.step, .review, .review-form { padding: 12px; margin: 10px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; }
.review .muted { margin-left: 12px; }
.review p, dd { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.review-form label { display: block; margin-bottom: 8px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
dl { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px 12px; }
dt { color: #64748b; overflow-wrap: anywhere; } dd { margin: 0; }
code, pre { font-size: 12px; overflow-wrap: anywhere; }
pre { max-height: 320px; overflow: auto; white-space: pre-wrap; background: #f8fafc; padding: 12px; }
summary { cursor: pointer; color: #64748b; margin: 10px 0; }
.el-alert { margin: 12px 0; }
</style>
