<script setup lang="ts">
import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import { fetchAgentRunAcceptance } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentRun, AgentRunAcceptance } from '@/types/agent'
import { artifactLabels, errorText, localTime } from './agentPresentation'

const props = defineProps<{ run: AgentRun }>()
const auth = useAuthStore()
const view = ref<AgentRunAcceptance | null>(null)
const loading = ref(false)
const error = ref('')
let active = true
let epoch = 0
const canView = computed(() => auth.hasPermission('agent:task:view'))
const labels: Record<string, string> = artifactLabels
const states: Record<string, string> = { SATISFIED: '已满足', MISSING: '缺少证据', BLOCKED: '需要处理', UNAVAILABLE: '尚不可核验' }
function clear() { epoch++; view.value = null; error.value = ''; loading.value = false }
async function load() {
  clear()
  if (!active || !canView.value) return
  const ticket = epoch, runId = props.run.id, taskId = props.run.taskId
  const current = () => active && ticket === epoch && canView.value && props.run.id === runId && props.run.taskId === taskId
  loading.value = true
  try {
    const result = await fetchAgentRunAcceptance(taskId, runId)
    if (current()) view.value = result
  } catch (cause) { if (current()) error.value = errorText(cause) }
  finally { if (current()) loading.value = false }
}
watch(() => [props.run.id, props.run.taskId, props.run.version, auth.permissions.slice().sort().join('|')], () => { void load() }, { immediate: true })
onDeactivated(() => { active = false; clear() })
onActivated(() => { if (!active) { active = true; void load() } })
onUnmounted(() => { active = false; clear() })
</script>

<template>
  <section class="acceptance" v-if="canView" v-loading="loading">
    <div class="heading"><p>按分派时要求的产物逐项核验。</p><el-button :disabled="loading" @click="load">重新核验</el-button></div>
    <p class="meta">这是当前证据复查，不会改写运行的历史结果。代码交付、实际测试、发布和效果验证分别验收。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="view">
      <el-alert :title="view.satisfied ? '当前证据已满足所需产物' : '所需产物尚未全部满足'" :type="view.satisfied ? 'success' : 'warning'" :closable="false" show-icon />
      <p class="meta">核验时间：{{ localTime(view.checkedAt) }}</p>
      <article v-for="item in view.items" :key="item.kind" class="item">
        <div class="heading"><strong>{{ labels[item.kind] || item.kind }}</strong><el-tag :type="item.status === 'SATISFIED' ? 'success' : 'warning'">{{ states[item.status] || item.status }}</el-tag></div>
        <p>{{ item.message }}</p>
        <div v-for="target in item.targets || []" :key="`${target.scope.businessLineCode}/${target.scope.environmentCode}`" class="target">
          <div class="heading"><strong>{{ target.scope.businessLineCode }} / {{ target.scope.environmentCode === 'TEST' ? '测试' : '生产' }}</strong><el-tag :type="target.status === 'SATISFIED' ? 'success' : 'warning'">{{ states[target.status] || target.status }}</el-tag></div>
          <p>{{ target.message }}</p>
        </div>
        <details v-if="item.evidence.length"><summary>查看证据引用</summary>
          <div v-for="evidence in item.evidence" :key="evidence.id" class="evidence">
            <span>{{ evidence.kind === 'CHANGE_SET' ? '交付清单' : evidence.kind === 'EVENT' ? '执行记录' : '产物' }}：{{ evidence.id }}</span>
            <code>{{ evidence.contentHash }}</code>
          </div>
          <p v-if="item.evidence.some(evidence => evidence.kind === 'EVENT')" class="meta">准确提交和远端分支的核验凭据可在“执行记录”的“原生 CLI 交付核验”中查看。</p>
          <p v-else-if="item.kind === 'CHANGE_SET'" class="meta">准确提交、实际分支及 MR 核验记录可在“候选变更”中查看。</p>
        </details>
      </article>
    </template>
  </section>
</template>

<style scoped>
.acceptance { min-height: 120px; }
.heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.heading p { margin: 0; }
.meta { color: #64748b; font-size: 12px; line-height: 1.7; }
.item { border-bottom: 1px solid #e5e7eb; padding: 18px 0; }
.target { margin-top: 12px; padding: 12px; background: #f6f8fa; }
.item p { line-height: 1.7; overflow-wrap: anywhere; }
summary { cursor: pointer; color: #64748b; font-size: 12px; }
.evidence { display: grid; gap: 6px; padding: 12px; margin-top: 8px; background: #f6f8fa; overflow-wrap: anywhere; font-size: 12px; }
code { font-size: 11px; }
</style>
