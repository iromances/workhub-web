<script setup lang="ts">
import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import { fetchAutonomyCaseBugs } from '@/api/autonomy'
import type { AutonomyBugLink } from '@/types/autonomy'
import { errorText, localTime, prettyPayload } from './agentPresentation'

const props = defineProps<{ agentId: string; caseId: string; active: boolean }>()
const page = ref(1)
const total = ref(0)
const rows = ref<AutonomyBugLink[]>([])
const loading = ref(false)
const error = ref('')
let mounted = true
let epoch = 0
const sourceLabels = { CURRENT: '与当前缺陷内容一致', CHANGED: '缺陷原文已变化', UNAVAILABLE: '原缺陷当前不可用' }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown) { return typeof value === 'string' && value ? value : '未记录' }
function parseSnapshot(encoded: string) {
  try {
    const value: unknown = JSON.parse(encoded)
    if (!object(value) || !object(value.workItem) || !object(value.scope)) return null
    const item = value.workItem
    return {
      no: text(item.no), title: text(item.title), project: text(item.projectName), status: text(item.status), priority: text(item.priority),
      description: text(item.description), acceptance: text(item.acceptanceCriteria),
      scope: `${text(value.scope.businessLineCode)} / ${text(value.scope.environmentCode)}`,
      historicalEnvironmentUnverified: value.historicalEnvironmentVerified === false,
    }
  } catch { return null }
}
const records = computed(() => rows.value.map(item => ({ ...item, snapshot: parseSnapshot(item.link.snapshotJson) })))
async function load() {
  const request = ++epoch
  if (!props.active || !mounted) { loading.value = false; return }
  const agentId = props.agentId, caseId = props.caseId
  loading.value = true; error.value = ''; rows.value = []
  try {
    const result = await fetchAutonomyCaseBugs(agentId, caseId, page.value)
    if (request !== epoch || agentId !== props.agentId || caseId !== props.caseId || !props.active || !mounted) return
    rows.value = result.items; total.value = result.total
  } catch (cause) {
    if (request === epoch) { error.value = errorText(cause); rows.value = []; total.value = 0 }
  } finally { if (request === epoch) loading.value = false }
}
watch(() => [props.agentId, props.caseId], () => {
  epoch++; page.value = 1; total.value = 0; rows.value = []; error.value = ''; void load()
}, { immediate: true })
watch(() => props.active, () => { void load() })
onActivated(() => { if (!mounted) { mounted = true; void load() } })
onDeactivated(() => { mounted = false; epoch++; loading.value = false })
onUnmounted(() => { mounted = false; epoch++ })
</script>

<template>
  <section v-loading="loading" class="bug-links">
    <div class="toolbar"><p class="description">保留关联时的缺陷原文和证据。关联为 AI 判断，需由人审核。</p><el-button :loading="loading" @click="load">刷新关联</el-button></div>
    <el-alert v-if="error" :title="`关联缺陷读取失败：${error}`" type="error" :closable="false" show-icon />
    <el-empty v-else-if="!loading && !records.length" description="尚无缺陷关联记录" :image-size="55" />
    <article v-for="record in records" :key="record.link.id" class="bug-record">
      <div class="tags"><strong>{{ record.snapshot ? `${record.snapshot.no} · ${record.snapshot.title}` : `缺陷 #${record.link.workItemId}` }}</strong>
        <el-tag :type="record.latest ? 'primary' : 'info'" effect="plain">{{ record.latest ? '最新关联' : '历史关联' }}</el-tag>
        <el-tag :type="record.sourceState === 'CURRENT' ? 'success' : 'warning'">{{ sourceLabels[record.sourceState] || record.sourceState }}</el-tag>
      </div>
      <p class="description">关联时处理版本 {{ record.link.caseVersion }} · {{ localTime(record.link.createdAt) }}</p>
      <p v-if="record.latest && record.sourceState !== 'CURRENT'" class="changed">需求依据已变化，已有方案和候选代码需要重新核对。</p>
      <el-descriptions v-if="record.snapshot" :column="2" border class="facts">
        <el-descriptions-item label="所属项目">{{ record.snapshot.project }}</el-descriptions-item>
        <el-descriptions-item label="关联时状态">{{ record.snapshot.status }} · {{ record.snapshot.priority }}</el-descriptions-item>
        <el-descriptions-item label="证据范围" :span="2">{{ record.snapshot.scope }}</el-descriptions-item>
      </el-descriptions>
      <p class="description">缺陷自身未记录环境；此处范围来自所引用的监测或日志证据。</p>
      <el-alert v-if="record.snapshot?.historicalEnvironmentUnverified" title="此证据按当前监测配置定位，历史记录的实际环境仍待核实。" type="warning" :closable="false" show-icon />
      <dl><dt>AI 关联依据</dt><dd>{{ record.link.reason }}</dd></dl>
      <template v-if="record.snapshot">
        <dl><dt>关联时的缺陷描述</dt><dd>{{ record.snapshot.description }}</dd><dt>关联时的验收要求</dt><dd>{{ record.snapshot.acceptance }}</dd></dl>
      </template>
      <template v-else><el-alert title="快照格式无法解析，请核对保存的原始内容。" type="warning" :closable="false" /><pre>{{ prettyPayload(record.link.snapshotJson) }}</pre></template>
      <details><summary>查看证据引用与原文版本</summary><dl>
        <dt>缺陷原文版本</dt><dd>{{ record.link.workItemVersion }}</dd><dt>监测记录</dt><dd>{{ record.link.observationId }}</dd>
        <dt>记录位置</dt><dd>{{ record.link.evidencePointer }}</dd><dt>问题信号</dt><dd>{{ record.link.signalId }}</dd>
        <dt>关联运行</dt><dd>{{ record.link.runId }}</dd>
      </dl></details>
    </article>
    <el-pagination v-if="!error && total" v-model:current-page="page" :total="total" :page-size="5" layout="total, prev, pager, next" @current-change="load" />
  </section>
</template>

<style scoped>
.bug-links { min-height: 130px; }
.toolbar, .tags { display: flex; align-items: center; gap: 10px; }
.toolbar { justify-content: space-between; margin-bottom: 14px; }
.tags { flex-wrap: wrap; }
.tags strong { overflow-wrap: anywhere; }
.description { color: #6b7280; font-size: 12px; line-height: 1.7; }
.bug-record { padding: 18px 0; border-bottom: 1px solid #e5e7eb; }
.changed { color: #92400e; font-size: 13px; line-height: 1.7; }
.facts, .el-alert { margin: 12px 0; }
dl { margin: 12px 0; }
dt { color: #64748b; font-size: 12px; margin: 10px 0 4px; }
dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-size: 13px; max-height: 360px; overflow: auto; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; max-height: 360px; overflow: auto; padding: 12px; background: #f6f8fa; font-size: 12px; }
summary { color: #64748b; cursor: pointer; font-size: 12px; }
.el-pagination { justify-content: flex-end; margin-top: 16px; }
</style>
