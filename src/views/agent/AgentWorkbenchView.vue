<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgent, fetchAgentDutyTask, fetchAgentOptions, fetchAgents, fetchAgentRun, fetchAgentRuns, runAgentTask, setAgentEnabled, deleteAgent } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentDefinition, AgentOptions, AgentRun, AgentRunDetail, AgentTask } from '@/types/agent'
import AgentConfigDialog from './AgentConfigDialog.vue'
import AgentTaskDialog from './AgentTaskDialog.vue'
import AgentRunPanel from './AgentRunPanel.vue'
import { agentReportOverview, selectReportRun } from './agentReportPresentation'
import { artifactLabels, errorText, localTime, requestKey, statusLabels, statusTone } from './agentPresentation'

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('agent:manage'))
const canViewTasks = computed(() => auth.hasPermission('agent:task:view'))
const canOperate = computed(() => auth.hasPermission('agent:task:operate'))
const options = ref<AgentOptions>({ providers: [], scopes: [], positions: [] })
const agents = ref<AgentDefinition[]>([])
const selected = ref<AgentDefinition | null>(null)
const agentPage = ref(1)
const agentTotal = ref(0)
const loading = ref(false)
const error = ref('')
const configOpen = ref(false)
const editing = ref<AgentDefinition | null>(null)
const drawer = ref(false)
const activeAgent = ref<AgentDefinition | null>(null)
/** 职责执行任务：数字员工唯一的常设执行配置，「开始新一轮」与「执行设置」都作用于它。 */
const dutyTask = ref<AgentTask | null>(null)
const dutyError = ref('')
const settingsOpen = ref(false)
const dutyText = ref<HTMLElement | null>(null)
const dutyClamped = ref(false)
const dutyExpanded = ref(false)
const runs = ref<AgentRun[]>([])
const runPage = ref(1)
const runTotal = ref(0)
const detail = ref<AgentRunDetail | null>(null)
const selectedRunId = ref('')
const drawerError = ref('')
const runsLoading = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const historyOpen = ref(false)
const historyRows = computed(() => runs.value.map(run => ({
  ...run,
  excerpt: (run.errorMessage || agentReportOverview(run.resultText || '').summary.replace(/^#+\s*/gm, '').trim() || '等待执行结果').slice(0, 180),
})))
const operating = ref(false)
const needsCompletionTargets = computed(() => dutyTask.value?.specification.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind)) ?? false)
let active = true
let initialized = false
let agentEpoch = 0
let runEpoch = 0
let detailEpoch = 0
let startKey = requestKey()

async function loadAgents() {
  const epoch = ++agentEpoch
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAgents(agentPage.value)
    if (epoch !== agentEpoch || !active) return
    agents.value = result.items
    agentTotal.value = result.total
    if (selected.value) {
      const selectedId = selected.value.id
      const updated = result.items.find(item => item.id === selectedId)
      if (updated) {
        if (epoch === agentEpoch && selected.value?.id === selectedId && active) selected.value = updated
      } else {
        // 已选助手被删除时清除选中态而不是报"Agent 不存在"
        selected.value = null
      }
    }
  } catch (cause) { if (epoch === agentEpoch) error.value = errorText(cause) }
  finally { if (epoch === agentEpoch) loading.value = false }
}
async function initialize() {
  const result = await Promise.allSettled([loadAgents(), fetchAgentOptions()])
  if (result[1].status === 'fulfilled') options.value = result[1].value
  else error.value = errorText(result[1].reason)
  initialized = true
}
async function reloadOptions() {
  try { options.value = await fetchAgentOptions() }
  catch (cause) { error.value = errorText(cause) }
}
function selectAgent(agent: AgentDefinition) { selected.value = agent }
function configure(agent: AgentDefinition | null) { editing.value = agent; configOpen.value = true }
async function agentSaved(agent: AgentDefinition) {
  selected.value = agent
  agentPage.value = 1
  await loadAgents()
  if (activeAgent.value?.id === agent.id) activeAgent.value = agent
}
async function toggle(agent: AgentDefinition) {
  if (!agent.enabled) {
    try { await setAgentEnabled(agent, true); ElMessage.success('Agent 已启用'); await loadAgents() }
    catch (cause) { error.value = errorText(cause) }
    return
  }
  try { await ElMessageBox.confirm('停用后不再开始新的运行，并向正在执行的运行发出停止请求。', `停用 ${agent.configuration.name}`, { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' }) }
  catch { return }
  try { await setAgentEnabled(agent, false); ElMessage.success('Agent 已停用，正在确认运行停止结果'); await loadAgents() }
  catch (cause) { error.value = errorText(cause) }
}
async function removeAgent(agent: AgentDefinition) {
  try {
    await ElMessageBox.confirm('将物理删除该 Agent 及其全部任务、运行记录与产物（保留审计）；须已停用，存在启用中周期、未结束运行或过程数据时会被拒绝。', `删除 ${agent.configuration.name}`, { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await deleteAgent(agent)
    ElMessage.success('Agent 已删除')
    if (selected.value?.id === agent.id) selected.value = null
    if (activeAgent.value?.id === agent.id) { drawer.value = false; detail.value = null }
    await loadAgents()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}
async function openResults(agent: AgentDefinition) {
  detailEpoch++
  activeAgent.value = agent
  dutyTask.value = null
  dutyError.value = ''
  dutyExpanded.value = false
  runPage.value = 1
  runs.value = []
  detail.value = null
  selectedRunId.value = ''
  drawerError.value = ''
  detailError.value = ''
  detailLoading.value = false
  historyOpen.value = false
  drawer.value = true
  startKey = requestKey()
  await loadRuns()
}
async function loadRuns(quiet = false) {
  if (!activeAgent.value || !drawer.value) return
  const agentId = activeAgent.value.id
  const epoch = ++runEpoch
  if (!quiet) runsLoading.value = true
  try {
    // 常设配置读取失败不影响历史运行展示，只收起依赖它的两个操作。
    const [agent, duty, result] = await Promise.all([
      fetchAgent(agentId),
      fetchAgentDutyTask(agentId).then(task => ({ task, error: '' }), (cause: unknown) => ({ task: null, error: errorText(cause) })),
      fetchAgentRuns(agentId, runPage.value),
    ])
    if (epoch !== runEpoch || activeAgent.value?.id !== agentId || !drawer.value || !active) return
    activeAgent.value = agent
    dutyTask.value = duty.task
    dutyError.value = duty.error
    runs.value = result.items
    runTotal.value = result.total
    drawerError.value = ''
    if (!selectedRunId.value) selectedRunId.value = selectReportRun(result.items, '')
    if (selectedRunId.value) await loadRunDetail(selectedRunId.value)
    await measureDuty()
  } catch (cause) { if (epoch === runEpoch) drawerError.value = errorText(cause) }
  finally { if (epoch === runEpoch) runsLoading.value = false }
}
async function loadRunDetail(id: string) {
  // 历史运行可能来自需求开发、问题修复等其他任务，详情按运行自身的任务标识读取。
  const taskId = runs.value.find(item => item.id === id)?.taskId ?? detail.value?.run.taskId
  if (!taskId || !activeAgent.value) return
  const agentId = activeAgent.value.id
  const epoch = ++detailEpoch
  if (selectedRunId.value !== id) detail.value = null
  selectedRunId.value = id
  detailError.value = ''
  detailLoading.value = !detail.value
  try {
    const result = await fetchAgentRun(taskId, id)
    if (epoch === detailEpoch && activeAgent.value?.id === agentId && selectedRunId.value === id && drawer.value && active) detail.value = result
  } catch (cause) {
    if (epoch === detailEpoch && selectedRunId.value === id && drawer.value && active) {
      detail.value = null
      detailError.value = errorText(cause)
    }
  } finally { if (epoch === detailEpoch) detailLoading.value = false }
}
/** 职责超过两行被截断时才显示展开入口；展开状态下不重新测量，保证可以收起。 */
async function measureDuty() {
  if (dutyExpanded.value) return
  await nextTick()
  dutyClamped.value = !!dutyText.value && dutyText.value.scrollHeight > dutyText.value.clientHeight + 1
}
function changeRunPage() {
  detailEpoch++
  selectedRunId.value = ''
  detail.value = null
  detailError.value = ''
  void loadRuns()
}
watch(drawer, value => {
  if (!value) { runEpoch++; detailEpoch++; runsLoading.value = false; detailLoading.value = false }
})
async function start() {
  if (!dutyTask.value) return
  operating.value = true
  try {
    const run = await runAgentTask(dutyTask.value, startKey)
    startKey = requestKey()
    await newRun(run)
    ElMessage.success('新一轮运行已排队')
  } catch (cause) { drawerError.value = errorText(cause) }
  finally { operating.value = false }
}
async function newRun(run: AgentRun) {
  if (activeAgent.value?.id !== run.agentId) return
  runPage.value = 1
  selectedRunId.value = run.id
  detail.value = null
  await loadRuns()
}
function settingsSaved(task: AgentTask) { dutyTask.value = task }
onMounted(async () => {
  window.addEventListener('resize', measureDuty)
  await initialize()
})
onActivated(() => { active = true; if (initialized) { void loadAgents(); void loadRuns(true) } })
onDeactivated(() => { active = false; runEpoch++; detailEpoch++ })
onUnmounted(() => { active = false; runEpoch++; detailEpoch++; window.removeEventListener('resize', measureDuty) })
</script>

<template>
  <div class="agent-workbench">
    <section class="page-card agent-card">
      <div class="page-header"><div><h2>数字员工</h2></div><div><el-button @click="initialize">刷新</el-button><el-button v-if="canManage" type="primary" @click="configure(null)">创建 Agent</el-button></div></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
      <el-table v-loading="loading" :data="agents" row-key="id" highlight-current-row @row-click="selectAgent">
        <el-table-column label="Agent" min-width="190"><template #default="{ row }"><strong>{{ row.configuration.name }}</strong><div class="muted line-clamp">{{ row.configuration.instructions }}</div></template></el-table-column>
        <el-table-column label="模型" min-width="170"><template #default="{ row }"><span>{{ row.configuration.model || '使用接入默认模型' }}</span></template></el-table-column>
        <el-table-column label="授权" width="160"><template #default="{ row }">{{ row.configuration.scopes.length ? row.configuration.scopes.length + ' 个范围' : '不限范围' }}</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="300" fixed="right"><template #default="{ row }"><el-button v-if="canViewTasks" link type="primary" @click.stop="openResults(row)">任务成果</el-button><el-button v-if="canManage" link type="primary" @click.stop="configure(row)">配置</el-button><el-button v-if="canManage" link :type="row.enabled ? 'warning' : 'success'" @click.stop="toggle(row)">{{ row.enabled ? '停用' : '启用' }}</el-button><el-button v-if="canManage" link type="danger" @click.stop="removeAgent(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="尚未配置 Agent" :image-size="70"><el-button v-if="canManage" type="primary" @click="configure(null)">创建第一个 Agent</el-button></el-empty></template>
      </el-table>
      <el-pagination v-model:current-page="agentPage" :total="agentTotal" :page-size="20" layout="total, prev, pager, next" @current-change="loadAgents" />
    </section>
    <AgentConfigDialog v-model="configOpen" :agent="editing" :options="options" @saved="agentSaved" />
    <el-dialog v-model="drawer" :title="`任务成果 · ${activeAgent?.configuration.name ?? ''}`" fullscreen class="task-dialog">
      <template v-if="activeAgent">
        <h3 v-if="dutyTask" class="task-objective">{{ dutyTask.specification.objective || '按员工职责执行' }}</h3>
        <div class="duty-brief">
          <span class="duty-label">职责</span>
          <p ref="dutyText" class="duty-text" :class="{ 'is-expanded': dutyExpanded }">{{ activeAgent.configuration.instructions }}</p>
          <el-button v-if="dutyClamped" class="duty-toggle" link type="primary" :aria-expanded="dutyExpanded" @click="dutyExpanded = !dutyExpanded">{{ dutyExpanded ? '收起' : '展开' }}</el-button>
        </div>
        <p v-if="dutyTask?.specification.acceptanceCriteria" class="description">验收：{{ dutyTask.specification.acceptanceCriteria }}</p>
        <p v-if="needsCompletionTargets" class="description">本次完成目标：{{ dutyTask?.specification.completionTargets?.length ? dutyTask.specification.completionTargets.map(scope => `${scope.businessLineCode} / ${scope.environmentCode === 'TEST' ? '测试' : '生产'}`).join('、') : '尚未明确，请在执行设置中选择' }}</p>
        <div class="drawer-toolbar">
          <div class="task-tags"><el-tag v-for="kind in dutyTask?.specification.expectedArtifacts ?? []" :key="kind" effect="plain">{{ artifactLabels[kind] }}</el-tag><el-tag v-if="dutyTask?.specification.analysisScope === 'INCREMENTAL'" type="warning" effect="plain">增量分析</el-tag></div>
          <el-button class="history-toggle" :aria-expanded="historyOpen" @click="historyOpen = !historyOpen">{{ historyOpen ? '收起历史运行' : '查看历史运行' }}</el-button>
          <el-button @click="loadRuns(false)">刷新</el-button>
          <el-button v-if="canOperate && dutyTask" @click="settingsOpen = true">执行设置</el-button>
          <el-button v-if="canOperate && dutyTask" type="primary" :loading="operating" @click="start">开始新一轮</el-button>
        </div>
        <el-alert v-if="drawerError" :title="drawerError" type="error" :closable="false" class="feedback" />
        <el-alert v-if="dutyError" :title="`执行设置读取失败：${dutyError}`" type="error" :closable="false" class="feedback" />
        <div class="run-workspace">
          <aside class="run-history" :class="{ 'history-open': historyOpen }" aria-label="历史运行" v-loading="runsLoading">
            <div class="history-heading"><strong>历史运行</strong><span>{{ runTotal }} 轮</span></div>
            <div class="history-list">
              <button v-for="row in historyRows" :key="row.id" type="button" class="history-item" :class="{ 'is-selected': selectedRunId === row.id }" :aria-current="selectedRunId === row.id ? 'true' : undefined" @click="loadRunDetail(row.id)">
                <span class="history-item-top"><time>{{ localTime(row.createdAt) }}</time><el-tag size="small" :type="statusTone(row.status)">{{ statusLabels[row.status] || row.status }}</el-tag></span>
                <span class="history-excerpt">{{ row.excerpt }}</span>
                <span class="history-item-meta">{{ row.stepCount }} 次行动 · {{ Math.floor(row.elapsedMillis / 1000) }} 秒</span>
              </button>
            </div>
            <el-empty v-if="!runsLoading && !runs.length" description="暂无运行记录" :image-size="48" />
            <div class="history-pagination"><span>第 {{ runPage }} 页</span><el-pagination v-model:current-page="runPage" :total="runTotal" :page-size="5" layout="prev, next" @current-change="changeRunPage" /></div>
          </aside>
          <main class="run-reading" v-loading="detailLoading" aria-label="所选运行成果">
            <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon><el-button link @click="loadRunDetail(selectedRunId)">重新加载报告</el-button></el-alert>
            <AgentRunPanel v-if="detail" :key="detail.run.id" :detail="detail" :business-lines="options.scopes" :duty-objective="dutyTask?.specification.objective || ''" @refresh="loadRuns(true)" @new-run="newRun" />
            <el-empty v-else-if="!detailLoading && !detailError && !runsLoading" :description="runs.length ? '选择一轮运行查看成果' : '运行后将在这里展示结论与报告'" :image-size="64" />
          </main>
        </div>
      </template>
    </el-dialog>
    <AgentTaskDialog v-model="settingsOpen" :agent="activeAgent" :options="options" :task="dutyTask" @saved="settingsSaved" />
  </div>
</template>

<style scoped>
.agent-workbench { display: grid; gap: 20px; }
.agent-card { padding: 22px; }
.page-header { align-items: center; gap: 12px; }
h2, h3 { margin: 0; }
.description { color: #6b7280; margin: 10px 0; line-height: 1.6; white-space: pre-wrap; }
.muted { color: #6b7280; font-size: 12px; margin-top: 5px; }
.line-clamp { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }
.feedback { margin: 14px 0; }
.el-pagination { margin-top: 18px; justify-content: flex-end; }
.task-objective { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.duty-brief { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; }
.duty-label { flex: none; margin-top: 1px; padding: 0 6px; border: 1px solid #d8e0e5; border-radius: 4px; font-size: 12px; line-height: 18px; color: #637582; }
.duty-text { flex: 1; min-width: 0; margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.duty-text.is-expanded { display: block; }
.duty-toggle { flex: none; }
.artifact-kinds { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.task-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-right: auto; }
.drawer-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin: 16px 0; }
.run-workspace { display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: 26px; align-items: start; border-top: 1px solid #e4eaee; padding-top: 22px; }
.run-history { min-width: 0; background: #f6f8f9; border: 1px solid #e5ebef; border-radius: 12px; padding: 14px; }
.history-heading { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #314b59; }
.history-heading > span { color: #637582; font-size: 12px; }
.history-list { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 9px; margin-top: 12px; }
.history-item { display: flex; flex-direction: column; gap: 9px; box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; overflow: hidden; overflow-wrap: anywhere; font: inherit; text-align: left; padding: 12px; border: 1px solid #e4eaee; border-radius: 8px; background: #fff; cursor: pointer; color: #344b5a; }
.history-item > span { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; }
.history-item:hover { border-color: #90bbae; }
.history-item.is-selected { background: #edf6f2; border-color: #438c75; box-shadow: inset 3px 0 #438c75; }
.history-item:focus-visible { outline: 2px solid #267c65; outline-offset: 2px; }
.history-item-top { display: flex; align-items: flex-start; gap: 6px; justify-content: space-between; font-size: 12px; flex-wrap: wrap; }
.history-excerpt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; line-height: 1.65; }
.history-item-meta { font-size: 11px; color: #637582; }
.history-pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: #637582; }
.history-pagination .el-pagination { margin: 0; }
.run-reading { min-width: 0; min-height: 260px; padding: 0 6px 20px 0; }
.history-toggle { display: none; }
:global(.task-dialog .el-dialog__body) { max-height: calc(100vh - 110px); overflow-y: auto; }
@media (max-width: 1000px) { .run-workspace { grid-template-columns: minmax(0, 1fr); gap: 18px; } .run-history { display: none; } .run-history.history-open { display: block; } .history-toggle { display: inline-flex; margin-right: auto; } .history-list { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); } .drawer-toolbar { flex-wrap: wrap; } }
@media (max-width: 800px) { .page-header { flex-direction: column; align-items: flex-start; } .agent-card { padding: 14px; } }
</style>
