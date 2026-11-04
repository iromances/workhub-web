<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelAgentRun, replyToAgentRun, retryAgentRun } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentRun, AgentRunDetail } from '@/types/agent'
import AgentRunAcceptancePanel from './AgentRunAcceptancePanel.vue'
import AgentChangesPanel from './AgentChangesPanel.vue'
import AgentRunReconciliationPanel from './AgentRunReconciliationPanel.vue'
import { errorText, eventLabels, eventSummary, localTime, prettyPayload, requestKey, statusLabels, statusTone } from './agentPresentation'

const props = defineProps<{ detail: AgentRunDetail }>()
const emit = defineEmits<{ refresh: []; newRun: [AgentRun] }>()
const auth = useAuthStore()
const busy = ref(false)
const error = ref('')
const reply = ref('')
const eventPage = ref(1)
const tab = ref('result')
let replyAttempt: { text: string; key: string } | null = null
let retryKey = requestKey()
const run = computed(() => props.detail.run)
const canOperate = computed(() => auth.hasPermission('agent:task:operate'))
const terminal = computed(() => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.value.status))
const eventRows = computed(() => props.detail.events.slice((eventPage.value - 1) * 20, eventPage.value * 20))
watch(() => props.detail.run.id, () => { reply.value = ''; error.value = ''; eventPage.value = 1; replyAttempt = null; retryKey = requestKey(); tab.value = 'result' })
async function cancel() {
  const target = run.value
  try { await ElMessageBox.confirm('停止这次运行？已发出的外部操作仍会等待确认结果。', '停止任务', { type: 'warning', confirmButtonText: '请求停止', cancelButtonText: '继续执行' }) }
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
    <div class="run-heading">
      <div><el-tag :type="statusTone(run.status)">{{ statusLabels[run.status] || run.status }}</el-tag><span class="run-meta">{{ run.stepCount }} 次行动 · {{ Math.floor(run.elapsedMillis / 1000) }} 秒 · {{ localTime(run.createdAt) }}</span></div>
      <div v-if="canOperate"><el-button v-if="!terminal && !run.cancelRequested" :disabled="busy" @click="cancel">停止运行</el-button><el-button v-if="run.retryAllowed" :loading="busy" @click="retry">重试</el-button></div>
    </div>
    <p class="run-meta">本次 AI：{{ detail.providerBinding.channelType }} · {{ detail.configuration.model || '未记录模型' }} · 接入配置版本 {{ detail.providerBinding.configurationVersion }}</p>
    <p v-if="detail.specification.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind))" class="run-meta">本轮完成目标：{{ detail.specification.completionTargets?.length ? detail.specification.completionTargets.map(scope => `${scope.businessLineCode} / ${scope.environmentCode === 'TEST' ? '测试' : '生产'}`).join('、') : '尚未明确，请重新分派任务' }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
    <el-alert v-if="run.errorMessage" :title="run.errorMessage" :type="run.status === 'FAILED' ? 'error' : 'warning'" :closable="false" show-icon class="feedback" />
    <el-alert v-if="run.status === 'CANCELLING'" title="正在确认执行与外部操作的停止结果，尚未完成取消。" type="warning" :closable="false" class="feedback" />
    <AgentRunReconciliationPanel :run="run" @refresh="emit('refresh')" />
    <el-tabs v-model="tab">
      <el-tab-pane label="结果与产物" name="result">
        <pre v-if="run.resultText" class="result-text">{{ run.resultText }}</pre>
        <el-empty v-else description="尚未返回最终结果" :image-size="56" />
        <div v-for="artifact in detail.artifacts" :key="artifact.id" class="artifact">
          <strong>{{ artifact.kind === 'REPORT' ? '分析报告' : artifact.kind }}</strong>
          <el-tag size="small" effect="plain">{{ artifact.provenance === 'AI_REPORT' ? 'AI 报告' : '执行证据' }}</el-tag>
          <span class="run-meta">{{ localTime(artifact.createdAt) }}</span>
          <details><summary>查看产物内容与校验值</summary><pre>{{ prettyPayload(artifact.payloadJson) }}</pre><code>{{ artifact.contentHash }}</code></details>
        </div>
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
.run-panel { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 22px; }
.run-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.run-meta { color: #6b7280; font-size: 12px; margin-left: 10px; }
.feedback { margin: 12px 0; }
pre, .event-summary { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
pre { max-height: 500px; overflow: auto; padding: 12px; background: #f6f8fa; border-radius: 6px; font-size: 12px; }
.result-text { font-family: inherit; font-size: 14px; background: transparent; padding: 0; }
.artifact { padding: 16px 0; border-top: 1px solid #f0f1f3; }
.artifact .el-tag { margin-left: 12px; }
summary { color: #64748b; font-size: 12px; cursor: pointer; margin-top: 8px; }
code { font-size: 11px; overflow-wrap: anywhere; }
.reply-box { display: grid; gap: 10px; margin-top: 20px; }
.reply-box .el-button { justify-self: end; }
</style>
