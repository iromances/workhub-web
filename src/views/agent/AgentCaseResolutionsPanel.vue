<script setup lang="ts">
import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { fetchAutonomyCaseResolutions } from '@/api/autonomy'
import type { AutonomyCase, AutonomyCaseResolution } from '@/types/autonomy'
import { useAuthStore } from '@/stores/auth'
import { errorText, localTime } from './agentPresentation'

const props = defineProps<{ agentId: string; problem: AutonomyCase; active: boolean }>()
const auth = useAuthStore()
const page = ref(1), total = ref(0)
const rows = ref<AutonomyCaseResolution[]>([])
const loading = ref(false), error = ref('')
let mounted = true, epoch = 0
const canRead = computed(() => {
  const prefix = props.problem.sourceType === 'ACCOUNTING' ? 'ops:accounting' : props.problem.sourceType === 'BUSINESS_MONITOR' ? 'ops:monitor' : 'ops:system-alert'
  return auth.hasPermission('autonomy:case:view') && auth.hasPermission('agent:view') && (auth.hasPermission(`${prefix}:view`) || auth.hasPermission(`${prefix}:manage`))
})
function clear() { epoch++; rows.value = []; total.value = 0; loading.value = false; error.value = '' }
async function load() {
  clear()
  if (!mounted || !props.active || !canRead.value) return
  const ticket = epoch, id = props.problem.id, agentId = props.agentId, requestedPage = page.value
  const current = () => mounted && props.active && canRead.value && ticket === epoch && id === props.problem.id && agentId === props.agentId
  loading.value = true
  try {
    const result = await fetchAutonomyCaseResolutions(agentId, id, requestedPage)
    if (!current()) return
    if (result.items.some(item => item.caseId !== id)) throw new Error('关闭记录不属于当前问题，请刷新后重试')
    rows.value = result.items; total.value = result.total
  } catch (cause) { if (current()) error.value = errorText(cause) }
  finally { if (current()) loading.value = false }
}
watch(() => [props.agentId, props.problem.id, props.problem.version, props.active, auth.userName, auth.permissions.slice().sort().join('|')], () => { page.value = 1; void load() }, { immediate: true })
onDeactivated(() => { mounted = false; clear() })
onBeforeUnmount(() => { mounted = false; clear() })
onActivated(() => { if (!mounted) { mounted = true; void load() } })
</script>

<template>
  <section class="resolutions" v-loading="loading">
    <div class="toolbar"><p class="muted">保留每轮关闭判断与凭据。历史关闭不代表问题当前仍已解决，后续故障证据可使问题重新进入处理。</p><el-button :disabled="!canRead" :loading="loading" @click="load">刷新关闭记录</el-button></div>
    <el-alert v-if="!canRead" title="缺少问题或监测来源查看权限。" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="error" :title="`关闭记录读取失败：${error}`" type="error" :closable="false" show-icon />
    <el-empty v-else-if="!loading && !rows.length" description="尚无经过业务复查的关闭记录" :image-size="55" />
    <article v-for="record in rows" :key="record.id">
      <strong>关闭时处理版本 {{ record.resolvedVersion }}</strong><p class="muted">{{ localTime(record.createdAt) }} · 依据证据版本 {{ record.evidenceVersion }}</p>
      <p>恢复观察窗口：{{ localTime(record.windowStart) }} 至 {{ localTime(record.windowEnd) }}</p>
      <p class="reason">{{ record.reason }}</p>
      <details><summary>查看关联复查与发布凭据</summary><dl>
        <dt>复查记录</dt><dd>{{ record.verificationId }}</dd><dt>发布计划</dt><dd>{{ record.planId }}</dd>
        <dt>候选变更</dt><dd>{{ record.changeSetId }}</dd><dt>候选摘要</dt><dd>{{ record.manifestHash }}</dd>
        <dt>复查产物</dt><dd>{{ record.artifactId }}</dd><dt>产物摘要</dt><dd>{{ record.artifactHash }}</dd>
        <dt>关联分析方案</dt><dd>{{ record.proposalId }}</dd>
      </dl></details>
    </article>
    <el-pagination v-if="!error && total" v-model:current-page="page" :total="total" :page-size="5" layout="total, prev, pager, next" @current-change="load" />
  </section>
</template>

<style scoped>
.resolutions { min-height: 130px; }.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.muted, dt { color: #64748b; font-size: 12px; line-height: 1.7; }.toolbar p { flex: 1; min-width: 180px; }
article { border-bottom: 1px solid #e5e7eb; padding: 18px 0; }p, dd { font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.reason { white-space: pre-wrap; }summary { color: #475569; font-size: 13px; cursor: pointer; }dt { margin-top: 10px; }dd { margin: 0; }
.el-pagination { justify-content: flex-end; margin-top: 16px; }
</style>
