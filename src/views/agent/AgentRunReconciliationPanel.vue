<script setup lang="ts">
import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgentRunReconciliation, reconcileAgentRun } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentReconciliationAction, AgentReconciliationDecision, AgentRun, AgentRunReconciliation, AgentRunReconciliationRequest } from '@/types/agent'
import { errorText, localTime, prettyPayload, requestKey } from './agentPresentation'

const props = defineProps<{ run: AgentRun }>()
const emit = defineEmits<{ refresh: [] }>()
const auth = useAuthStore()
const opened = ref(false)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const view = ref<AgentRunReconciliation | null>(null)
const decisions = ref<AgentReconciliationDecision[]>([])
const nextAction = ref<AgentReconciliationAction>('WAIT_INPUT')
const pending = ref<AgentRunReconciliationRequest | null>(null)
let active = true
let epoch = 0
const canView = computed(() => auth.hasPermission('agent:task:view'))
const canManage = computed(() => auth.hasPermission('agent:manage') && auth.hasPermission('agent:task:operate'))
const available = computed(() => ['RUNNING', 'CANCELLING', 'WAITING_RESOURCE'].includes(props.run.status))
const stale = computed(() => !!view.value && view.value.version !== props.run.version)
const ready = computed(() => !!view.value?.canReconcile && canManage.value && !stale.value && decisions.value.length > 0
  && decisions.value.every(item => item.evidence.trim()) && !(nextAction.value === 'RESUME' && view.value.resumeBlockedReasons.length)
  && !(view.value.cancelRequested && nextAction.value !== 'CANCEL'))
const processLabels: Record<string, string> = {
  RUNNING: '同一 CLI 进程仍在运行', LIVE_IDENTITY_UNAVAILABLE: '该 PID 仍存活，启动身份无法确认',
  PARENT_NOT_FOUND: '未发现父进程，仍需确认子进程树', PID_REUSED: 'PID 已被其他进程使用，仍需确认原子进程树',
  REMOTE_HOST: '需在执行主机上核对进程树', IDENTITY_UNAVAILABLE: '进程身份信息不足，需人工核实',
}
const actionLabels: Record<AgentReconciliationAction, string> = { RESUME: '继续重新规划', WAIT_INPUT: '等待人工补充', CANCEL: '结束本次运行' }
const receiptLabels: Record<string, string> = { MODEL_RESPONSE: '已有模型回执', TOOL_RESULT: '已有工具回执', CLI_RESULT: '已有进程树停止回执', COMMITTED_INSPECTION_TRANSACTION: '已有巡检事务结果' }
function current(ticket: number, runId: string) { return ticket === epoch && active && opened.value && canView.value && props.run.id === runId }
function clear() { epoch++; view.value = null; decisions.value = []; error.value = ''; loading.value = false; busy.value = false }
async function load() {
  const ticket = ++epoch, runId = props.run.id, taskId = props.run.taskId
  if (!opened.value || !active || !canView.value || pending.value) return
  loading.value = true; view.value = null; decisions.value = []; error.value = ''
  try {
    const result = await fetchAgentRunReconciliation(taskId, runId)
    if (!current(ticket, runId)) return
    view.value = result
    decisions.value = result.calls.filter(call => call.needsConfirmation).map(call => ({ key: call.key, outcome: 'ENDED', evidence: '' }))
    nextAction.value = result.cancelRequested ? 'CANCEL' : 'WAIT_INPUT'
  } catch (cause) { if (current(ticket, runId)) error.value = errorText(cause) }
  finally { if (current(ticket, runId)) loading.value = false }
}
function open() { opened.value = true; if (!pending.value) void load() }
function close() { opened.value = false; epoch++; loading.value = false; busy.value = false }
async function reread() {
  if (pending.value) {
    const ticket = epoch, runId = props.run.id
    try { await ElMessageBox.confirm('上次提交结果尚未确认。重新读取会放弃本地原请求重试；已保存的核对不会被撤销。是否重新读取当前状态？', '重新核对', { confirmButtonText: '重新读取', cancelButtonText: '保留原请求' }) }
    catch { return }
    if (!current(ticket, runId)) return
    pending.value = null
  }
  await load()
}
async function submit() {
  if (!canManage.value || busy.value) return
  const runId = props.run.id, taskId = props.run.taskId, ticket = epoch
  let request = pending.value
  if (!request) {
    if (!ready.value || !view.value) return
    request = { requestKey: requestKey(), expectedVersion: view.value.version, snapshotHash: view.value.snapshotHash,
      nextAction: nextAction.value, decisions: decisions.value.map(item => ({ ...item, evidence: item.evidence.trim() })) }
    busy.value = true
    try {
      await ElMessageBox.confirm(`确认所有待核对调用均已结束或未发出，并${actionLabels[request.nextAction]}？人工结论将与原调用一同留存；测试和发布结果仍需实际平台证据。`, '提交人工核对',
        { type: 'warning', confirmButtonText: '确认并提交', cancelButtonText: '返回核对' })
    } catch { if (current(ticket, runId)) busy.value = false; return }
    if (!current(ticket, runId) || !canManage.value) return
    pending.value = request
  }
  busy.value = true; error.value = ''
  try {
    await reconcileAgentRun(taskId, runId, request)
    if (!current(ticket, runId) || !canManage.value) return
    pending.value = null; clear(); opened.value = false
    ElMessage.success('人工核对已保存，正在刷新运行状态')
    emit('refresh')
  } catch (cause) {
    if (!current(ticket, runId)) return
    error.value = errorText(cause)
    emit('refresh')
  } finally { if (current(ticket, runId)) busy.value = false }
}
watch(() => props.run.id, () => { pending.value = null; opened.value = false; clear() })
watch([canView, canManage], () => {
  if (!canView.value || !canManage.value) { pending.value = null; opened.value = false; clear() }
})
onActivated(() => { if (!active) { active = true; if (opened.value && !pending.value) void load() } })
onDeactivated(() => { active = false; epoch++; loading.value = false; busy.value = false; if (!pending.value) view.value = null })
onUnmounted(() => { active = false; epoch++ })
</script>

<template>
  <section v-if="canView && (available || opened || pending)" class="reconciliation">
    <div class="toolbar"><div><strong>执行结果核对</strong><p>调用回执缺失时，先核实原执行情况，再决定如何继续。</p></div>
      <el-button v-if="!opened" @click="open">{{ pending ? '查看待确认请求' : '查看核对材料' }}</el-button>
      <el-button v-else :disabled="busy" @click="close">收起核对</el-button>
    </div>
    <div v-if="opened" v-loading="loading">
      <el-alert title="逐项核实执行是否结束。仅父进程消失不足以确认整个进程树已停止；人工结论不表示测试或发布成功。" type="warning" :closable="false" show-icon />
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-alert v-if="pending" title="上次提交尚未确认，表单已固定。可重试原请求取得结果，或重新读取当前材料。" type="warning" :closable="false" />
      <template v-if="view">
        <p class="meta">材料版本 {{ view.version }} · 执行租约截至 {{ localTime(view.leaseUntil) }}</p>
        <el-alert v-for="reason in view.blockedReasons" :key="reason" :title="reason" type="warning" :closable="false" />
        <el-alert v-if="stale && !pending" title="运行已变化，请重新读取材料后核对。" type="warning" :closable="false" />
        <el-empty v-if="!view.calls.length" description="没有待核对的调用" :image-size="48" />
        <article v-for="(call, index) in view.calls" :key="call.key" class="call">
          <div class="call-heading"><strong>{{ index + 1 }}. {{ call.kind === 'CLI' ? 'CLI 进程树' : call.kind === 'API' ? 'AI API 调用' : `企业工具 · ${call.toolCode}` }}</strong>
            <el-tag :type="call.needsConfirmation ? 'warning' : 'success'">{{ call.needsConfirmation ? '需要人工核对' : receiptLabels[call.receiptSource || ''] || call.receiptSource }}</el-tag>
          </div>
          <p class="meta">调用标识：{{ call.key }}<template v-if="call.readOnly !== null"> · {{ call.readOnly ? '只读工具' : '包含写入操作' }}</template></p>
          <template v-if="call.kind === 'CLI'">
            <p>执行主机：{{ call.host || '未记录' }} · PID：{{ call.pid ?? '未记录' }} · 启动时间：{{ localTime(call.startInstant) }}</p>
            <p v-if="call.needsConfirmation || ['RUNNING', 'LIVE_IDENTITY_UNAVAILABLE'].includes(call.processState || '')">{{ processLabels[call.processState || ''] || '需核实进程树是否结束' }}</p>
          </template>
          <p v-if="call.receiptKey" class="meta">实际证据：{{ call.receiptKey }}</p>
          <details v-if="call.requestPayloadJson"><summary>查看原调用意图</summary><pre>{{ prettyPayload(call.requestPayloadJson) }}</pre></details>
          <template v-for="decision in decisions.filter(item => item.key === call.key)" :key="decision.key">
            <el-form v-if="canManage" label-position="top" class="decision">
              <el-form-item label="核对结论">
                <el-radio-group v-model="decision.outcome" :disabled="busy || !!pending || !view.canReconcile">
                  <el-radio value="ENDED">确认已结束</el-radio>
                  <el-radio value="NOT_STARTED" :disabled="busy || !!pending || !view.canReconcile || (call.kind === 'CLI' && call.pid !== null)">确认未发出</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="`${index + 1}. 核对依据`" :for="`reconcile-evidence-${index}`">
                <el-input :id="`reconcile-evidence-${index}`" v-model="decision.evidence" type="textarea" :rows="3" maxlength="3000" show-word-limit
                  :disabled="busy || !!pending || !view.canReconcile" placeholder="记录核对时间、日志或任务位置、执行结果及遗留影响；CLI 还需说明子进程树停止依据。不要填写凭据。" />
              </el-form-item>
            </el-form>
          </template>
        </article>
        <el-form v-if="canManage && view.calls.some(call => call.needsConfirmation)" label-position="top">
          <el-form-item label="核对后的处理">
            <el-radio-group v-model="nextAction" :disabled="busy || !!pending || !view.canReconcile">
              <el-radio value="RESUME" :disabled="busy || !!pending || !view.canReconcile || view.cancelRequested || !!view.resumeBlockedReasons.length">继续重新规划</el-radio>
              <el-radio value="WAIT_INPUT" :disabled="busy || !!pending || !view.canReconcile || view.cancelRequested">等待人工补充</el-radio>
              <el-radio value="CANCEL">结束本次运行</el-radio>
            </el-radio-group>
          </el-form-item>
          <p v-for="reason in view.resumeBlockedReasons" :key="reason" class="meta">不能继续重新规划：{{ reason }}</p>
        </el-form>
      </template>
      <div class="actions">
        <el-button :disabled="busy || loading" @click="reread">重新读取核对材料</el-button>
        <el-button v-if="canManage && (view?.canReconcile || pending)" type="primary" :loading="busy" :disabled="!pending && !ready" @click="submit">{{ pending ? '重试原核对请求' : '提交人工核对' }}</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reconciliation { margin: 16px 0; padding: 16px; border: 1px solid #dce3ea; border-radius: 8px; background: #fbfcfe; }
.toolbar, .call-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
p { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.toolbar p, .meta { color: #64748b; font-size: 12px; }
.el-alert { margin: 10px 0; }
.call { border-top: 1px solid #e5e7eb; padding: 16px 0; }
.decision { margin-top: 12px; }
summary { font-size: 12px; color: #64748b; cursor: pointer; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 280px; overflow: auto; font-size: 12px; padding: 12px; background: #f0f3f7; }
.actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
</style>
