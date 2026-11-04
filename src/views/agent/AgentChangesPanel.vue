<script setup lang="ts">
import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { fetchAgentChange, fetchAgentChanges, fetchAgentDeliveries } from '@/api/agentChange'
import type { AgentChangeSummary, AgentChangeDetail, AgentDelivery } from '@/types/agentChange'
import { errorText, localTime } from './agentPresentation'
import AgentReleasesPanel from './AgentReleasesPanel.vue'

const props = defineProps<{ runId: string }>()
const rows = ref<AgentChangeSummary[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const detailError = ref('')
const selectedId = ref('')
const detail = ref<AgentChangeDetail | null>(null)
const deliveries = ref<AgentDelivery[]>([])
const deliveryLoading = ref(false)
const deliveryError = ref('')
const expanded = ref<string[]>([])
let active = true
let listEpoch = 0
let detailEpoch = 0
const planFields = [
  { key: 'summary', label: '变更说明' }, { key: 'impact', label: '影响范围' },
  { key: 'acceptance', label: '验收建议' }, { key: 'rollback', label: '回退建议' },
] as const
const repositoryNames = computed(() => new Map(detail.value?.manifest.repositories.map(repo => [repo.repositoryId, repo.repositoryName]) || []))
const order = computed(() => detail.value?.manifest.dependencyOrder.map(id => repositoryNames.value.get(id) || id).join(' → '))
const reference = computed(() => detail.value?.manifest.caseReference)
const repositories = computed(() => {
  const byRepository = new Map(deliveries.value.map(row => [row.repositoryId, row]))
  return detail.value?.manifest.repositories.map(repo => ({ ...repo, delivery: byRepository.get(repo.repositoryId) })) || []
})
const confirmedCount = computed(() => repositories.value.filter(repo => repo.delivery?.remoteConfirmed).length)
const deliveryLabels: Record<string, string> = {
  NEW: '等待推送', PUSHING: '推送中', PUSH_UNKNOWN: '推送结果待核对', BRANCH_READY: '分支已核验',
  MR_CREATING: 'MR 创建中', MR_UNKNOWN: 'MR 结果待核对', REMOTE_CONFIRMED: '分支与 MR 已核验',
  UNCHANGED_CONFIRMED: '无差异，基线已核验', CONFLICT: '交付冲突', REJECTED: '请求被拒绝',
}
function deliveryLabel(value: AgentDelivery | undefined) {
  if (deliveryLoading.value) return '正在读取交付记录'
  if (deliveryError.value) return '交付记录读取失败'
  if (!value) return '尚未登记交付'
  if (value.errorMessage && ['REMOTE_CONFIRMED', 'UNCHANGED_CONFIRMED'].includes(value.status)) return '待重新核验'
  return deliveryLabels[value.status] || value.status
}
function deliveryTone(value: AgentDelivery | undefined): 'success' | 'warning' | 'danger' | 'info' {
  if (deliveryError.value) return 'danger'
  if (!value || deliveryLoading.value || value.status === 'NEW') return 'info'
  if (value.remoteConfirmed) return 'success'
  return ['CONFLICT', 'REJECTED'].includes(value.status) ? 'danger' : 'warning'
}
function mrLink(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
const blockers: Record<string, string> = {
  NEWER_MANIFEST_EXISTS: '已有更新的候选版本', WORKSPACE_SET_CHANGED: '参与仓库已变化',
  CODE_CHANGED: '代码已变化', CODE_POLICY_CHANGED: '仓库授权策略已变化', CASE_PLAN_CHANGED: '关联问题或方案已变化',
  BUG_CONTEXT_CHANGED: '关联缺陷的需求依据已变化，需要重新核对',
  CASE_REFERENCE_REQUIRED: '缺少已领取问题的方案关联', PLATFORM_TEST_EVIDENCE_MISSING: '缺少平台实际测试结果',
  REMOTE_DELIVERY_EVIDENCE_MISSING: '缺少远端分支交付确认',
}
function blockerLabel(value: string) {
  const [code, repo] = value.split(':')
  return `${blockers[code] || code}${repo ? `：${repositoryNames.value.get(repo) || repo}` : ''}`
}
function state(value: { current: boolean; readyForReview: boolean }) {
  return !value.current ? '已失效' : value.readyForReview ? '可提交审核' : '待补齐验证'
}
function clearDetail() {
  ++detailEpoch; detail.value = null; detailError.value = ''; selectedId.value = ''; expanded.value = []; detailLoading.value = false
  deliveries.value = []; deliveryError.value = ''; deliveryLoading.value = false
}
async function load() {
  if (!active) return
  const epoch = ++listEpoch
  const runId = props.runId
  rows.value = []; total.value = 0; error.value = ''; clearDetail(); loading.value = true
  try {
    const result = await fetchAgentChanges(runId, page.value)
    if (epoch !== listEpoch || runId !== props.runId || !active) return
    rows.value = result.items; total.value = result.total
    if (result.items.length) await select(result.items[0])
  } catch (cause) { if (epoch === listEpoch && active) error.value = errorText(cause) }
  finally { if (epoch === listEpoch) loading.value = false }
}
async function select(value: AgentChangeSummary) {
  clearDetail()
  const epoch = ++detailEpoch
  const runId = props.runId
  selectedId.value = value.id; detailLoading.value = true
  void loadDeliveries(value.id, epoch, runId)
  try {
    const result = await fetchAgentChange(value.id)
    if (epoch !== detailEpoch || !active || runId !== props.runId) return
    detail.value = result
    expanded.value = result.manifest.repositories.length ? [result.manifest.repositories[0].repositoryId] : []
  } catch (cause) { if (epoch === detailEpoch && active) detailError.value = errorText(cause) }
  finally { if (epoch === detailEpoch) detailLoading.value = false }
}
async function loadDeliveries(id: string, epoch: number, runId: string) {
  deliveryLoading.value = true
  try {
    const result = await fetchAgentDeliveries(id)
    if (epoch !== detailEpoch || !active || runId !== props.runId) return
    deliveries.value = result
  } catch (cause) {
    if (epoch === detailEpoch && active && runId === props.runId) deliveryError.value = errorText(cause)
  } finally { if (epoch === detailEpoch) deliveryLoading.value = false }
}
function invalidate() { active = false; ++listEpoch; rows.value = []; total.value = 0; loading.value = false; clearDetail() }
watch(() => props.runId, () => { page.value = 1; void load() }, { immediate: true })
onDeactivated(invalidate)
onBeforeUnmount(invalidate)
onActivated(() => { if (!active) { active = true; void load() } })
</script>

<template>
  <section class="changes-panel">
    <div class="toolbar"><span class="muted">查看本次运行生成的候选代码及方案</span><el-button :loading="loading" @click="load">刷新候选变更</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
    <el-table v-loading="loading" :data="rows" row-key="id" :max-height="300" highlight-current-row :current-row-key="selectedId" @row-click="select">
      <el-table-column label="候选版本" width="100"><template #default="{ row }"><el-button link type="primary" @click.stop="select(row)">第 {{ row.revision }} 版</el-button></template></el-table-column>
      <el-table-column prop="summary" label="变更说明" min-width="230" show-overflow-tooltip />
      <el-table-column label="仓库" width="70"><template #default="{ row }">{{ row.repositories.length }}</template></el-table-column>
      <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag :type="row.current ? 'warning' : 'info'">{{ state(row) }}</el-tag></template></el-table-column>
      <el-table-column label="生成时间" width="175"><template #default="{ row }">{{ localTime(row.createdAt) }}</template></el-table-column>
      <template #empty><el-empty :description="error ? '查询失败，请重试' : '尚未生成候选变更'" :image-size="48" /></template>
    </el-table>
    <el-pagination v-if="total" v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" />
    <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon class="feedback" />
    <div v-loading="detailLoading" class="change-detail">
      <template v-if="detail">
        <h3>第 {{ detail.revision }} 版 · {{ state(detail) }}</h3>
        <el-alert v-if="!detail.current" title="该版本已失效，保留作历史记录。请查看或生成新的候选版本。" type="warning" :closable="false" show-icon />
        <ul v-if="detail.blockers.length" class="blockers"><li v-for="item in detail.blockers" :key="item">{{ blockerLabel(item) }}</li></ul>
        <div class="plan-heading"><h4>方案说明</h4><el-tag size="small" effect="plain">AI 建议</el-tag></div>
        <dl class="plan"><template v-for="field in planFields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ detail.manifest.plan[field.key] }}</dd></template></dl>
        <p v-if="reference" class="muted">关联问题 {{ reference.caseId }} · 处理版本 {{ reference.caseVersion }} · 方案 {{ reference.proposalId }}</p>
        <p><strong>依赖顺序：</strong>{{ order }}</p>
        <div class="delivery-heading"><h4>远端交付记录</h4><span v-if="!deliveryLoading && !deliveryError" class="muted">{{ confirmedCount }} / {{ repositories.length }} 个仓库上次核验通过</span></div>
        <p class="muted">显示最近一次核验结果。远端交付成功后，仍需完成实际测试及人工审核。</p>
        <el-alert v-if="deliveryError" :title="deliveryError" description="交付记录未能读取，请刷新候选变更重试。" type="error" :closable="false" show-icon class="feedback" />
        <el-collapse v-model="expanded">
          <el-collapse-item v-for="repo in repositories" :key="repo.repositoryId" :name="repo.repositoryId">
            <template #title><span class="repo-heading"><strong>{{ repo.repositoryName }}</strong><span class="repo-meta">{{ repo.scope.businessLineCode }} / {{ repo.scope.environmentCode }} · {{ repo.changedPaths.length }} 个文件</span><el-tag :type="deliveryTone(repo.delivery)" size="small">{{ deliveryLabel(repo.delivery) }}</el-tag></span></template>
            <dl class="repository">
              <dt>基线分支</dt><dd>{{ repo.baseBranch }}</dd>
              <dt>基线提交</dt><dd><code>{{ repo.baseSha }}</code></dd>
              <dt>候选提交</dt><dd><code>{{ repo.resultSha }}</code></dd>
              <dt>拟交付分支</dt><dd>{{ repo.sourceBranch }}</dd>
            </dl>
            <dl v-if="repo.delivery" class="repository delivery-record">
              <dt>交付分支</dt><dd>{{ repo.delivery.sourceBranch }}</dd>
              <dt>目标分支</dt><dd>{{ repo.delivery.targetBranch }}</dd>
              <dt>MR</dt><dd><a v-if="mrLink(repo.delivery.mergeRequestUrl)" :href="mrLink(repo.delivery.mergeRequestUrl)" target="_blank" rel="noopener noreferrer">查看 MR !{{ repo.delivery.mergeRequestIid }}</a><span v-else>{{ repo.changedPaths.length ? '尚无可查看的 MR' : '未变更，不创建 MR' }}</span></dd>
              <dt>上次核验</dt><dd>{{ localTime(repo.delivery.verifiedAt) }}</dd>
            </dl>
            <el-alert v-if="repo.delivery?.errorMessage" :title="repo.delivery.errorMessage" type="warning" :closable="false" show-icon class="feedback" />
            <p v-else-if="!repo.delivery && !deliveryLoading && !deliveryError" class="muted">尚未登记该仓库的远端交付；拟交付分支不代表远端已存在。</p>
            <details v-if="repo.changedPaths.length"><summary>查看全部变更文件（{{ repo.changedPaths.length }}）</summary><pre class="paths">{{ repo.changedPaths.join('\n') }}</pre></details>
            <el-alert v-if="repo.diffTruncated" title="差异较长，当前仅显示部分内容。" type="info" :closable="false" />
            <pre v-if="repo.diffPreview" class="diff">{{ repo.diffPreview }}</pre>
            <p v-else class="muted">该仓库没有代码差异，纳入清单以固定依赖版本。</p>
            <details><summary>查看差异校验值</summary><code>{{ repo.diffHash }}</code></details>
          </el-collapse-item>
        </el-collapse>
        <AgentReleasesPanel :key="detail.id" :change-set-id="detail.id" />
        <details class="manifest-meta"><summary>查看清单版本标识</summary><p>{{ detail.id }}</p><code>{{ detail.manifestHash }}</code></details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.toolbar, .plan-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.delivery-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.delivery-heading h4 { margin: 10px 0; }
.repo-heading { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 0; line-height: 1.6; }
.delivery-record { border-top: 1px solid #e5e7eb; padding-top: 12px; }
.delivery-record a { color: #2563eb; }
.feedback { margin: 12px 0; }
.muted, .repo-meta { font-size: 12px; color: #6b7280; overflow-wrap: anywhere; }
.repo-meta { margin-left: 12px; font-weight: normal; }
.change-detail { min-height: 40px; }
.blockers { line-height: 1.8; color: #92400e; padding-left: 22px; }
.plan-heading { justify-content: flex-start; }
.plan-heading h4 { margin: 10px 0; }
dl { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 10px 14px; }
dt { color: #6b7280; }
dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
.diff, .paths { max-height: 360px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; background: #f6f8fa; line-height: 1.65; border-radius: 6px; }
code, pre { font-size: 12px; overflow-wrap: anywhere; }
summary { cursor: pointer; color: #64748b; margin: 10px 0; }
.manifest-meta { margin-top: 18px; }
.el-pagination { margin: 12px 0; }
</style>
