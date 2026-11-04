<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createAgentTask } from '@/api/agent'
import type { AgentArtifactKind, AgentDefinition, AgentOptions, AgentTask, AgentTaskCreate } from '@/types/agent'
import { artifactLabels, errorText, requestKey, scopeKey, scopesFromKeys } from './agentPresentation'

const props = defineProps<{ modelValue: boolean; agent: AgentDefinition | null; options: AgentOptions }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [AgentTask] }>()
const saving = ref(false)
const error = ref('')
const scopeKeys = ref<string[]>([])
const completionKeys = ref<string[]>([])
const form = reactive({ objective: '', context: '', acceptanceCriteria: '', expectedArtifacts: ['REPORT'] as AgentArtifactKind[], toolCodes: [] as string[],
  mode: 'MANUAL' as 'MANUAL' | 'CRON', cron: '0 0 * * * *', zoneId: 'Asia/Shanghai', misfirePolicy: 'RUN_ONCE' as 'RUN_ONCE' | 'SKIP', runImmediately: true })
const needsTargets = computed(() => form.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind)))
const completionOptions = computed(() => (props.agent?.configuration.scopes || [])
  .filter(scope => scopeKeys.value.includes(scopeKey(scope)) && ['TEST', 'PROD'].includes(scope.environmentCode)))
watch(() => [needsTargets.value, completionOptions.value.map(scopeKey).join('|')], () => {
  const allowed = new Set(needsTargets.value ? completionOptions.value.map(scopeKey) : [])
  completionKeys.value = completionKeys.value.filter(key => allowed.has(key))
})
let pending: { fingerprint: string; key: string } | null = null
watch(() => props.modelValue, visible => {
  if (!visible || !props.agent) return
  Object.assign(form, { objective: '', context: '', acceptanceCriteria: '', expectedArtifacts: ['REPORT'], toolCodes: [...props.agent.configuration.toolCodes],
    mode: 'MANUAL', cron: '0 0 * * * *', zoneId: 'Asia/Shanghai', misfirePolicy: 'RUN_ONCE', runImmediately: props.agent.enabled })
  scopeKeys.value = props.agent.configuration.scopes.map(scopeKey)
  completionKeys.value = []
  pending = null
  error.value = ''
})
function toolLabel(code: string) { return props.options.tools.find(tool => tool.code === code)?.description || code }
async function submit() {
  if (!props.agent) return
  if (!form.objective.trim() || !form.acceptanceCriteria.trim() || !form.expectedArtifacts.length) { error.value = '请填写目标、验收要求并选择至少一种产物'; return }
  if (needsTargets.value && !completionKeys.value.length) { error.value = '请选择本次必须完成的目标环境'; return }
  if (form.mode === 'CRON' && (!form.cron.trim() || !form.zoneId.trim())) { error.value = '请填写周期表达式和时区'; return }
  const content = {
    specification: { objective: form.objective.trim(), context: form.context || null, acceptanceCriteria: form.acceptanceCriteria.trim(),
      expectedArtifacts: [...form.expectedArtifacts], completionTargets: needsTargets.value ? scopesFromKeys(completionKeys.value) : [], scopes: scopesFromKeys(scopeKeys.value), toolCodes: [...form.toolCodes] },
    schedule: { expectedVersion: null, mode: form.mode, cronExpression: form.mode === 'CRON' ? form.cron.trim() : null, zoneId: form.zoneId.trim(),
      misfirePolicy: form.misfirePolicy, enabled: form.mode === 'CRON' },
    runImmediately: form.runImmediately,
  }
  const fingerprint = JSON.stringify(content)
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: requestKey() }
  const request: AgentTaskCreate = { ...content, requestKey: pending.key }
  saving.value = true
  error.value = ''
  try {
    const task = await createAgentTask(props.agent.id, request)
    ElMessage.success(request.runImmediately ? '任务已分派并进入执行队列' : '任务已保存')
    emit('saved', task)
    emit('update:modelValue', false)
  } catch (cause) { error.value = errorText(cause) } finally { saving.value = false }
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="`分派任务 · ${agent?.configuration.name || ''}`" width="760px" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="feedback" />
    <el-form label-width="110px" :disabled="saving" @submit.prevent="submit">
      <el-form-item label="任务目标" required><el-input v-model="form.objective" type="textarea" :rows="3" maxlength="12000" placeholder="例如：巡检 WorkHub 测试环境的监测和错误日志，分析异常并给出处理建议" /></el-form-item>
      <el-form-item label="补充资料"><el-input v-model="form.context" type="textarea" :rows="2" maxlength="24000" placeholder="提供已知情况、限制或需要参考的资料" /></el-form-item>
      <el-form-item label="验收要求" required><el-input v-model="form.acceptanceCriteria" type="textarea" :rows="2" maxlength="8000" placeholder="说明达到什么结果才算完成" /></el-form-item>
      <el-form-item label="期望产物" required><el-checkbox-group v-model="form.expectedArtifacts"><el-checkbox v-for="(label, kind) in artifactLabels" :key="kind" :value="kind">{{ label }}</el-checkbox></el-checkbox-group></el-form-item>
      <el-form-item label="任务范围"><el-select v-model="scopeKeys" multiple filterable placeholder="从 Agent 授权范围内选择"><el-option v-for="scope in agent?.configuration.scopes || []" :key="scopeKey(scope)" :value="scopeKey(scope)" :label="scopeKey(scope)" /></el-select></el-form-item>
      <el-form-item v-if="needsTargets" label="本次完成目标" required>
        <el-checkbox-group v-model="completionKeys"><el-checkbox v-for="scope in completionOptions" :key="scopeKey(scope)" :value="scopeKey(scope)">{{ scope.businessLineCode }} / {{ scope.environmentCode === 'TEST' ? '测试' : '生产' }}</el-checkbox></el-checkbox-group>
        <p class="target-hint">逐一选择本次必须完成的业务线和环境。测试、生产可同时选择。</p>
        <p v-if="!completionOptions.length" class="target-hint">请先在任务范围中选择测试或生产环境。</p>
      </el-form-item>
      <el-form-item label="任务工具"><el-select v-model="form.toolCodes" multiple filterable placeholder="选择任务可用工具；纯文本任务可留空"><el-option v-for="code in agent?.configuration.toolCodes || []" :key="code" :value="code" :label="toolLabel(code)" /></el-select></el-form-item>
      <el-form-item label="执行方式"><el-radio-group v-model="form.mode"><el-radio value="MANUAL">手动分派</el-radio><el-radio value="CRON">周期执行</el-radio></el-radio-group></el-form-item>
      <template v-if="form.mode === 'CRON'">
        <el-form-item label="周期表达式"><el-input v-model="form.cron" maxlength="128" placeholder="六段 Cron：秒 分 时 日 月 周" /><div class="hint">例如 0 0 * * * * 表示每小时执行一次。</div></el-form-item>
        <el-form-item label="时区"><el-input v-model="form.zoneId" maxlength="64" placeholder="Asia/Shanghai" /></el-form-item>
        <el-form-item label="错过周期时"><el-radio-group v-model="form.misfirePolicy"><el-radio value="RUN_ONCE">最多补一次</el-radio><el-radio value="SKIP">跳过已错过周期</el-radio></el-radio-group></el-form-item>
      </template>
      <el-form-item label="立即执行"><el-switch v-model="form.runImmediately" :disabled="!agent?.enabled" /><span class="hint">{{ agent?.enabled ? '保存后立即开始一轮' : 'Agent 已停用，可先保存任务' }}</span></el-form-item>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">分派任务</el-button></template>
  </el-dialog>
</template>

<style scoped>
.el-select { width: 100%; }
.feedback { margin-bottom: 16px; }
.target-hint { width: 100%; margin: 6px 0 0; color: #6b7280; font-size: 12px; }
.hint { margin-left: 12px; color: #6b7280; font-size: 12px; }
</style>
