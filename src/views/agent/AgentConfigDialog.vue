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
const form = reactive<AgentConfiguration>({ name: '', instructions: '', providerConfigId: 0, model: null, scopes: [], toolCodes: [], maxSteps: 40, maxRunSeconds: 900, maxConcurrentRuns: 1 })
const provider = computed(() => props.options.providers.find(item => item.id === form.providerConfigId))
const scopeOptions = computed(() => props.options.scopes.flatMap(line => line.environments.map(environment => ({
  value: `${line.businessLineCode}/${environment}`, label: `${line.businessLineName} / ${environment}`,
}))))
watch(() => props.modelValue, visible => {
  if (!visible) return
  error.value = ''
  Object.assign(form, props.agent ? JSON.parse(JSON.stringify(props.agent.configuration)) : {
    name: '', instructions: '', providerConfigId: 0, model: null, scopes: [], toolCodes: [], maxSteps: 40, maxRunSeconds: 900, maxConcurrentRuns: 1,
  })
  selectedScopes.value = form.scopes.map(scopeKey)
})
async function submit() {
  if (!form.name.trim() || !form.instructions.trim() || !form.providerConfigId) { error.value = '请填写名称、职责并选择 AI 接入'; return }
  if (!form.model?.trim() && !provider.value?.defaultModel) { error.value = '请填写模型，或先为所选 AI 配置默认模型'; return }
  saving.value = true
  error.value = ''
  try {
    const agent = await saveAgent(props.agent?.id || null, props.agent?.version ?? null, {
      ...form, name: form.name.trim(), model: form.model?.trim() || null, scopes: scopesFromKeys(selectedScopes.value), toolCodes: [...form.toolCodes],
    })
    ElMessage.success(props.agent ? 'Agent 配置已保存' : 'Agent 已创建，启用后可执行任务')
    emit('saved', agent)
    emit('update:modelValue', false)
  } catch (cause) { error.value = errorText(cause) } finally { saving.value = false }
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="agent ? '配置 Agent' : '创建 Agent'" width="720px" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
    <el-form label-width="100px" :disabled="saving" @submit.prevent="submit">
      <el-form-item label="名称" required><el-input v-model="form.name" maxlength="128" placeholder="例如：工作台巡检助手" /></el-form-item>
      <el-form-item label="职责" required><el-input v-model="form.instructions" type="textarea" :rows="3" maxlength="12000" placeholder="说明它负责什么、判断问题时应遵循什么要求" /></el-form-item>
      <el-form-item label="AI 接入" required>
        <el-select :model-value="form.providerConfigId || undefined" placeholder="选择系统已配置的 AI" filterable @update:model-value="form.providerConfigId = $event ?? 0">
          <el-option v-for="item in options.providers" :key="item.id" :value="item.id" :disabled="!item.enabled" :label="`${item.name} · ${item.channelType}${item.enabled ? '' : '（已停用）'}`" />
        </el-select>
      </el-form-item>
      <el-form-item label="模型"><el-input v-model="form.model" maxlength="128" :placeholder="provider?.defaultModel ? `留空使用 ${provider.defaultModel}` : '填写所选接入可用的模型'" /></el-form-item>
      <el-form-item label="业务范围"><el-select v-model="selectedScopes" multiple filterable placeholder="选择可访问的业务线和环境；纯文本任务可留空"><el-option v-for="scope in scopeOptions" :key="scope.value" :value="scope.value" :label="scope.label" /></el-select></el-form-item>
      <el-form-item label="可用工具"><el-select v-model="form.toolCodes" multiple filterable placeholder="选择允许 Agent 使用的能力"><el-option v-for="tool in options.tools" :key="tool.code" :value="tool.code" :label="tool.description" /></el-select></el-form-item>
      <div class="limits">
        <el-form-item label="行动上限"><el-input-number v-model="form.maxSteps" :min="1" :max="200" /></el-form-item>
        <el-form-item label="时长（秒）"><el-input-number v-model="form.maxRunSeconds" :min="30" :max="14400" /></el-form-item>
        <el-form-item label="并行任务"><el-input-number v-model="form.maxConcurrentRuns" :min="1" :max="8" /></el-form-item>
      </div>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" @click="submit">保存</el-button></template>
  </el-dialog>
</template>

<style scoped>
.el-select { width: 100%; }
.feedback { margin-bottom: 16px; }
.limits { display: grid; grid-template-columns: repeat(2, 1fr); }
@media (max-width: 700px) { .limits { grid-template-columns: 1fr; } }
</style>
