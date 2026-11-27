<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAccountingConfigs } from '@/api/accounting'
import type { AccountingMonitorConfig } from '@/types/accounting'
import { useAuthStore } from '@/stores/auth'
import { updateAgentTask } from '@/api/agent'
import type { AgentArtifactKind, AgentDefinition, AgentOptions, AgentTask } from '@/types/agent'
import { artifactLabels, errorText, scopeKey, scopesFromKeys } from './agentPresentation'

/** 数字员工的执行设置：编辑其职责执行任务（唯一的常设执行配置），只影响后续新运行。 */
const props = defineProps<{ modelValue: boolean; agent: AgentDefinition | null; options: AgentOptions; task: AgentTask | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [AgentTask] }>()
const auth = useAuthStore()
const monitorConfigs = ref<AccountingMonitorConfig[]>([])
const monitorError = ref('')
const canRunMonitors = computed(() => auth.hasPermission('ops:accounting:run') || auth.hasPermission('ops:accounting:manage'))
const availableMonitors = computed(() => monitorConfigs.value.filter(c => scopeKeys.value.includes(scopeKey({ businessLineCode: c.businessLineCode, environmentCode: c.environmentCode }))))
async function loadMonitorConfigs() {
  monitorError.value = ''
  try { monitorConfigs.value = await fetchAccountingConfigs({ enabledOnly: true }) }
  catch { monitorError.value = '业务监测配置读取失败，请刷新后重新选择'; monitorConfigs.value = [] }
}
const saving = ref(false)
const error = ref('')
const scopeKeys = ref<string[]>([])
const completionKeys = ref<string[]>([])
const form = reactive({ objective: '', context: '', expectedArtifacts: ['REPORT'] as AgentArtifactKind[],
  monitorMode: 'OBSERVE' as 'OBSERVE' | 'EXECUTE_CONFIGURED', monitorConfigIds: [] as number[], monitorCheckDate: '',
  analysisScope: 'FULL' as 'FULL' | 'INCREMENTAL', webhookUrl: '',
  mode: 'MANUAL' as 'MANUAL' | 'CRON', cron: '0 0 * * * *', zoneId: 'Asia/Shanghai', misfirePolicy: 'RUN_ONCE' as 'RUN_ONCE' | 'SKIP',
  scheduleEnabled: false })
const needsTargets = computed(() => form.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind)))
const needsWebhook = computed(() => (props.agent?.configuration.alertChannels || []).includes('WECOM'))
const scopeOptions = computed(() => {
  const configured = props.agent?.configuration.scopes
  if (!configured) return []
  return configured.length ? configured : props.options.scopes.flatMap(line =>
    line.environments.map(environmentCode => ({ businessLineCode: line.businessLineCode, environmentCode })))
})
const completionOptions = computed(() => scopeOptions.value
  .filter(scope => scopeKeys.value.includes(scopeKey(scope)) && ['TEST', 'PROD'].includes(scope.environmentCode)))
watch(() => [needsTargets.value, completionOptions.value.map(scopeKey).join('|')], () => {
  const allowed = new Set(needsTargets.value ? completionOptions.value.map(scopeKey) : [])
  completionKeys.value = completionKeys.value.filter(key => allowed.has(key))
})
watch(() => props.modelValue, visible => {
  if (!visible || !props.agent || !props.task) return
  if (canRunMonitors.value) void loadMonitorConfigs()
  const spec = props.task.specification
  const schedule = props.task.schedule
  Object.assign(form, { objective: spec.objective, context: spec.context || '',
    expectedArtifacts: [...spec.expectedArtifacts], analysisScope: spec.analysisScope === 'INCREMENTAL' ? 'INCREMENTAL' as const : 'FULL' as const,
    monitorMode: spec.monitorMode || 'OBSERVE', monitorConfigIds: [...(spec.monitorConfigIds || [])], monitorCheckDate: spec.monitorCheckDate || '',
    webhookUrl: spec.webhookUrl || '',
    mode: schedule.mode === 'CRON' ? 'CRON' as const : 'MANUAL' as const, cron: schedule.cronExpression || '0 0 * * * *',
    zoneId: schedule.zoneId || 'Asia/Shanghai', misfirePolicy: schedule.misfirePolicy === 'SKIP' ? 'SKIP' as const : 'RUN_ONCE' as const,
    scheduleEnabled: schedule.enabled })
  scopeKeys.value = spec.scopes.map(scopeKey)
  completionKeys.value = (spec.completionTargets || []).map(scopeKey)
  error.value = ''
})
async function submit() {
  if (!props.agent || !props.task) return
  if (!form.expectedArtifacts.length) { error.value = '请选择至少一种期望产物'; return }
  if (needsTargets.value && !completionKeys.value.length) { error.value = '请选择本次必须完成的目标环境'; return }
  if (form.mode === 'CRON' && (!form.cron.trim() || !form.zoneId.trim())) { error.value = '请填写周期表达式和时区'; return }
  if (form.monitorMode === 'EXECUTE_CONFIGURED' && (!form.monitorConfigIds.length || form.monitorConfigIds.some(id => !availableMonitors.value.some(c => c.id === id)))) {
    error.value = '请选择执行范围内的业务监测场景'; return
  }
  const specification = { objective: form.objective.trim(), context: form.context || null, acceptanceCriteria: props.task.specification.acceptanceCriteria ?? null,
    expectedArtifacts: [...form.expectedArtifacts], completionTargets: needsTargets.value ? scopesFromKeys(completionKeys.value) : [], scopes: scopesFromKeys(scopeKeys.value),
    monitorMode: form.monitorMode, monitorConfigIds: form.monitorMode === 'EXECUTE_CONFIGURED' ? [...form.monitorConfigIds] : [],
    monitorCheckDate: form.monitorMode === 'EXECUTE_CONFIGURED' ? form.monitorCheckDate || null : null,
    analysisScope: form.analysisScope, webhookUrl: needsWebhook.value && form.webhookUrl.trim() ? form.webhookUrl.trim() : null }
  saving.value = true
  error.value = ''
  try {
    const schedule = { expectedVersion: null, mode: form.mode, cronExpression: form.mode === 'CRON' ? form.cron.trim() : null,
      zoneId: form.zoneId.trim(), misfirePolicy: form.misfirePolicy, enabled: form.mode === 'CRON' && form.scheduleEnabled }
    const task = await updateAgentTask(props.task, specification, schedule)
    ElMessage.success('执行设置已更新，下一轮运行按新配置执行')
    emit('saved', task)
    emit('update:modelValue', false)
  } catch (cause) { error.value = errorText(cause) } finally { saving.value = false }
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="`执行设置 · ${agent?.configuration.name || ''}`" direction="rtl" size="min(860px, 94vw)" @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="feedback" />
    <el-alert type="info" :closable="false" show-icon class="feedback" title="修改只影响后续新运行；已有运行保留原配置快照。" />
    <el-form label-width="110px" :disabled="saving" @submit.prevent="submit">
      <el-form-item label="工作目标"><el-input v-model="form.objective" type="textarea" :rows="3" maxlength="12000" placeholder="例如：巡检生产环境的系统预警、服务监测与业务监测；可留空，默认按员工职责执行" /></el-form-item>
      <el-form-item label="补充资料"><el-input v-model="form.context" type="textarea" :autosize="{ minRows: 6, maxRows: 16 }" maxlength="24000" placeholder="提供已知情况、限制或需要参考的资料" /></el-form-item>
      <el-form-item label="期望产物" required><el-checkbox-group v-model="form.expectedArtifacts"><el-checkbox v-for="(label, kind) in artifactLabels" :key="kind" :value="kind">{{ label }}</el-checkbox></el-checkbox-group></el-form-item>
      <el-form-item label="数据范围">
        <el-radio-group v-model="form.analysisScope"><el-radio value="FULL">全量分析</el-radio><el-radio value="INCREMENTAL">增量分析</el-radio></el-radio-group>
        <p class="target-hint">全量：每轮不受时间窗限制。增量：每轮只分析自上一轮完成以来的新数据（平台计算时间窗；首轮无基线，先全量建立基线）。</p>
      </el-form-item>
      <el-form-item label="执行范围"><el-select v-model="scopeKeys" multiple filterable collapse-tags collapse-tags-tooltip :max-collapse-tags="6" placeholder="从 Agent 授权范围内选择"><el-option v-for="scope in scopeOptions" :key="scopeKey(scope)" :value="scopeKey(scope)" :label="scopeKey(scope)" /></el-select></el-form-item>
      <el-form-item v-if="needsWebhook" label="预警 webhook">
        <el-input v-model="form.webhookUrl" maxlength="512" placeholder="该员工触发企微预警的机器人地址（https://…）；可留空" />
        <p class="target-hint">Agent 预警方式含企微机器人时生效；地址加密存储，巡检完成后平台自动推送报告摘要。</p>
      </el-form-item>
      <el-form-item v-if="needsTargets" label="本次完成目标" required>
        <el-checkbox-group v-model="completionKeys"><el-checkbox v-for="scope in completionOptions" :key="scopeKey(scope)" :value="scopeKey(scope)">{{ scope.businessLineCode }} / {{ scope.environmentCode === 'TEST' ? '测试' : '生产' }}</el-checkbox></el-checkbox-group>
        <p class="target-hint">逐一选择每轮必须完成的业务线和环境。测试、生产可同时选择。</p>
        <p v-if="!completionOptions.length" class="target-hint">请先在执行范围中选择测试或生产环境。</p>
      </el-form-item>
      <el-form-item label="业务监测">
        <el-radio-group v-model="form.monitorMode">
          <el-radio value="OBSERVE">读取已有核验结果</el-radio>
          <el-radio value="EXECUTE_CONFIGURED" :disabled="!canRunMonitors">先执行指定场景，再生成报告</el-radio>
        </el-radio-group>
      </el-form-item>
      <template v-if="form.monitorMode === 'EXECUTE_CONFIGURED'">
        <el-alert v-if="monitorError" :title="monitorError" type="error" :closable="false" />
        <el-form-item label="监测场景" required>
          <el-select v-model="form.monitorConfigIds" multiple placeholder="选择执行范围内的监测场景">
            <el-option v-for="c in availableMonitors" :key="c.id" :value="c.id" :label="`${c.displayName} / ${c.environmentCode}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景核验日期">
          <el-date-picker v-model="form.monitorCheckDate" value-format="YYYY-MM-DD" placeholder="一致性场景留空全量；流程场景必填" />
          <p class="hint">场景核验范围独立于报告增量窗口。周期执行时每轮都会执行，可能耗时较长。</p>
        </el-form-item>
      </template>
      <el-form-item label="执行方式"><el-radio-group v-model="form.mode"><el-radio value="MANUAL">手动执行</el-radio><el-radio value="CRON">周期执行</el-radio></el-radio-group></el-form-item>
      <template v-if="form.mode === 'CRON'">
        <el-form-item label="周期表达式"><el-input v-model="form.cron" maxlength="128" placeholder="六段 Cron：秒 分 时 日 月 周" /><div class="hint">例如 0 0 * * * * 表示每小时执行一次。</div></el-form-item>
        <el-form-item label="时区"><el-input v-model="form.zoneId" maxlength="64" placeholder="Asia/Shanghai" /></el-form-item>
        <el-form-item label="错过周期时"><el-radio-group v-model="form.misfirePolicy"><el-radio value="RUN_ONCE">最多补一次</el-radio><el-radio value="SKIP">跳过已错过周期</el-radio></el-radio-group></el-form-item>
        <el-form-item label="周期启用"><el-switch v-model="form.scheduleEnabled" /><span class="hint">{{ form.scheduleEnabled ? '按周期自动调度' : '暂停调度，可随时再启用' }}</span></el-form-item>
      </template>
    </el-form>
    <template #footer>
      <div class="drawer-footer">
        <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存设置</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.el-select { width: 100%; }
.feedback { margin-bottom: 16px; }
.target-hint { width: 100%; margin:  6px 0 0; color: #6b7280; font-size: 12px; }
.hint { margin-left: 12px; color: #6b7280; font-size: 12px; }
.drawer-footer { display: flex; justify-content: flex-end; gap: 0; }
:global(.el-drawer__body) { padding-top: 8px; overflow-y: auto; }
:global(.el-drawer__footer) { border-top: 1px solid var(--el-border-color-lighter); padding: 12px 20px; }
</style>
