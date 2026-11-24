<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveAgent } from '@/api/agent'
import type { AgentConfiguration, AgentDefinition, AgentOptions } from '@/types/agent'
import { errorText, scopeKey, scopesFromKeys } from './agentPresentation'

const props = defineProps<{ modelValue: boolean; agent: AgentDefinition | null; options: AgentOptions }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [AgentDefinition] }>()
const saving = ref(false)
const error = ref('')
const selectedScopes = ref<string[]>([])
const form = reactive<AgentConfiguration>({ name: '', position: '', instructions: '', providerConfigId: 0, model: null, scopes: [], maxSteps: 40, maxRunSeconds: 900, maxConcurrentRuns: 1, alertLevel: 'P0', alertChannels: ['INBOX'] })
const provider = computed(() => props.options.providers.find(item => item.id === form.providerConfigId))
const scopeOptions = computed(() => props.options.scopes.flatMap(line => line.environments.map(environment => ({
  value: `${line.businessLineCode}/${environment}`, label: `${line.businessLineName} / ${environment}`,
}))))
watch(() => props.modelValue, visible => {
  if (!visible) return
  error.value = ''
  Object.assign(form, props.agent ? { position: '', alertLevel: 'P0', alertChannels: ['INBOX'], ...JSON.parse(JSON.stringify(props.agent.configuration)) } : {
    name: '', position: '', instructions: '', providerConfigId: 0, model: null, scopes: [], maxSteps: 40, maxRunSeconds: 900, maxConcurrentRuns: 1,
    alertLevel: 'P0', alertChannels: ['INBOX'],
  })
  form.alertLevel = form.alertLevel || 'P0'
  form.alertChannels = form.alertChannels?.length ? form.alertChannels : ['INBOX']
  // 表单未选接入时默认取第一个启用的接入
  if (!form.providerConfigId) {
    form.providerConfigId = props.options.providers.find(item => item.enabled)?.id || 0
  }
  selectedScopes.value = form.scopes.map(scopeKey)
})
async function submit() {
  if (!form.name.trim() || !form.instructions.trim() || !form.providerConfigId) { error.value = '请填写名称、职责并选择 AI 接入'; return }
  if (!form.position) { error.value = '请选择岗位'; return }
  if (!form.model?.trim() && !provider.value?.defaultModel) { error.value = '请填写模型，或先为所选 AI 配置默认模型'; return }
  if (!form.alertChannels?.length) { error.value = '请至少选择一种预警方式'; return }
  saving.value = true
  error.value = ''
  try {
    const agent = await saveAgent(props.agent?.id || null, props.agent?.version ?? null, {
      ...form, name: form.name.trim(), model: form.model?.trim() || null, scopes: scopesFromKeys(selectedScopes.value),
    })
    ElMessage.success(props.agent ? 'Agent 配置已保存' : 'Agent 已创建，启用后可执行任务')
    emit('saved', agent)
    emit('update:modelValue', false)
  } catch (cause) { error.value = errorText(cause) } finally { saving.value = false }
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="agent ? '配置 Agent' : '创建 Agent'" direction="rtl" size="min(1100px, 92vw)" @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
    <el-form label-width="100px" :disabled="saving" @submit.prevent="submit">
      <el-form-item label="名称" required><el-input v-model="form.name" maxlength="128" placeholder="例如：工作台巡检助手" /></el-form-item>
      <el-form-item label="岗位" required><el-select v-model="form.position" filterable placeholder="选择岗位；可输入关键字过滤"><el-option v-for="item in options.positions" :key="item.code" :value="item.code" :label="item.name" /></el-select></el-form-item>
      <el-form-item label="职责" required>
        <el-input v-model="form.instructions" type="textarea" :autosize="{ minRows: 8, maxRows: 24 }" maxlength="12000" :placeholder="`建议公式：身份 + 常态职责边界 + 输出习惯 + 升级规则。写长期不变的常态职责，本次要交付的内容写到任务目标里，业务线/环境在业务范围选择，不写代码坐标。\n例如：你是xx业务线的运维数字员工。负责监控逾期账款、扣款失败与账务差异，按周输出巡检报告。只做查询与分析，不得修改业务数据；发现重大差异或需要人工决策的事项，在报告中单列“需人工处理”并说明理由。`" />
      </el-form-item>
      <el-form-item label="AI 接入" required>
        <el-select :model-value="form.providerConfigId || undefined" placeholder="选择系统已配置的 AI" filterable @update:model-value="form.providerConfigId = $event ?? 0">
          <el-option v-for="item in options.providers" :key="item.id" :value="item.id" :disabled="!item.enabled" :label="`${item.name}${item.enabled ? '' : '（已停用）'}`" />
        </el-select>
      </el-form-item>
      <el-form-item label="模型"><el-input v-model="form.model" maxlength="128" placeholder="留空使用默认模型" /></el-form-item>
      <el-form-item label="业务范围"><el-select v-model="selectedScopes" multiple filterable placeholder="留空允许所有已启用业务线及其环境"><el-option v-for="scope in scopeOptions" :key="scope.value" :value="scope.value" :label="scope.label" /></el-select></el-form-item>
      <el-form-item label="预警级别">
        <el-select v-model="form.alertLevel">
          <el-option value="P0" label="P0（仅最高级）" />
          <el-option value="P1" label="P1（P0 及 P1）" />
          <el-option value="P2" label="P2（全部级别）" />
        </el-select>
        <p class="alert-hint">巡检报告出现 ≥ 该级别的问题才触发预警。</p>
      </el-form-item>
      <el-form-item label="预警方式">
        <el-checkbox-group v-model="form.alertChannels">
          <el-checkbox value="INBOX">站内信</el-checkbox>
          <el-checkbox value="WECOM">企微机器人</el-checkbox>
        </el-checkbox-group>
        <p class="alert-hint">选企微机器人后，可在分派任务时填写该任务的机器人 webhook 地址。</p>
      </el-form-item>
      <div class="limits">
        <el-form-item label="行动上限"><el-input-number v-model="form.maxSteps" :min="1" :max="200" /></el-form-item>
        <el-form-item label="时长（秒）"><el-input-number v-model="form.maxRunSeconds" :min="30" :max="14400" /></el-form-item>
        <el-form-item label="并行任务"><span>不设并发上限</span></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <div class="drawer-footer"><el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">保存</el-button></div>
    </template>
  </el-drawer>
</template>

<style scoped>
.el-select { width: 100%; }
.feedback { margin-bottom: 16px; }
.limits { display: grid; grid-template-columns: repeat(2, 1fr); }
.drawer-footer { display: flex; justify-content: flex-end; }
:global(.el-drawer__body) { padding-top: 8px; overflow-y: auto; }
:global(.el-drawer__footer) { border-top: 1px solid var(--el-border-color-lighter); padding: 12px 20px; }
.alert-hint { color: var(--el-text-color-secondary); font-size: 12px; margin: 4px 0 0; }
@media (max-width: 700px) { .limits { grid-template-columns: 1fr; } }
</style>
