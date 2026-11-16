<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAgent, fetchAgentOptions, fetchAgents, fetchAgentTask, fetchAgentTasks, fetchAgentRun, fetchAgentRuns, runAgentTask, saveAgentSchedule, setAgentEnabled, deleteAgent, deleteAgentTask } from '@/api/agent'
import { useAuthStore } from '@/stores/auth'
import type { AgentDefinition, AgentOptions, AgentRun, AgentRunDetail, AgentSchedule, AgentTask } from '@/types/agent'
import AgentConfigDialog from './AgentConfigDialog.vue'
import AgentTaskDialog from './AgentTaskDialog.vue'
import AgentRunPanel from './AgentRunPanel.vue'
import { artifactLabels, errorText, localTime, requestKey, statusLabels, statusTone } from './agentPresentation'

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('agent:manage'))
const canAssign = computed(() => auth.hasPermission('agent:task:assign'))
const canViewTasks = computed(() => auth.hasPermission('agent:task:view'))
const canOperate = computed(() => auth.hasPermission('agent:task:operate'))
const options = ref<AgentOptions>({ providers: [], scopes: [] })
const agents = ref<AgentDefinition[]>([])
const selected = ref<AgentDefinition | null>(null)
const taskListOpen = ref(false)
const taskListAgent = ref<AgentDefinition | null>(null)
const agentPage = ref(1)
const agentTotal = ref(0)
const loading = ref(false)
const error = ref('')
const configOpen = ref(false)
const editing = ref<AgentDefinition | null>(null)
const taskOpen = ref(false)
const editingTask = ref<AgentTask | null>(null)
const tasks = ref<AgentTask[]>([])
const taskPage = ref(1)
const taskTotal = ref(0)
const tasksLoading = ref(false)
const taskError = ref('')
const drawer = ref(false)
const activeTask = ref<AgentTask | null>(null)
const runs = ref<AgentRun[]>([])
const runPage = ref(1)
const runTotal = ref(0)
const detail = ref<AgentRunDetail | null>(null)
const selectedRunId = ref('')
const drawerError = ref('')
const runsLoading = ref(false)
const operating = ref(false)
const scheduleOpen = ref(false)
const scheduleError = ref('')
const schedule = reactive<AgentSchedule>({ expectedVersion: null, mode: 'MANUAL', cronExpression: null, zoneId: 'Asia/Shanghai', misfirePolicy: 'RUN_ONCE', enabled: false })
let active = true
let initialized = false
let timer: ReturnType<typeof setInterval> | undefined
let polling = false
let agentEpoch = 0
let taskEpoch = 0
let runEpoch = 0
let detailEpoch = 0
let startKey = requestKey()

function providerName(id: number) { return options.value.providers.find(provider => provider.id === id)?.name || `AI 接入 #${id}` }
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
        tasks.value = []
        taskTotal.value = 0
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
async function openTaskList(agent: AgentDefinition) {
  taskListAgent.value = agent
  taskListOpen.value = true
  taskPage.value = 1
  tasks.value = []
  await loadTasks()
}
async function loadTasks() {
  if (!taskListAgent.value || !canViewTasks.value) return
  const id = taskListAgent.value.id
  const epoch = ++taskEpoch
  tasksLoading.value = true
  taskError.value = ''
  try {
    const result = await fetchAgentTasks(id, taskPage.value)
    if (epoch !== taskEpoch || taskListAgent.value?.id !== id || !active) return
    tasks.value = result.items
    taskTotal.value = result.total
  } catch (cause) { if (epoch === taskEpoch) taskError.value = errorText(cause) }
  finally { if (epoch === taskEpoch) tasksLoading.value = false }
}
function configure(agent: AgentDefinition | null) { editing.value = agent; configOpen.value = true }
async function agentSaved(agent: AgentDefinition) { selected.value = agent; agentPage.value = 1; taskPage.value = 1; await Promise.all([loadAgents(), loadTasks()]) }
async function toggle(agent: AgentDefinition) {
  if (!agent.enabled) {
    try { await setAgentEnabled(agent, true); ElMessage.success('Agent 已启用'); await loadAgents() }
    catch (cause) { error.value = errorText(cause) }
    return
  }
  try { await ElMessageBox.confirm('停用后不再领取新任务，并向正在执行的任务发出停止请求。', `停用 ${agent.configuration.name}`, { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' }) }
  catch { return }
  try { await setAgentEnabled(agent, false); ElMessage.success('Agent 已停用，正在确认运行停止结果'); await loadAgents() }
  catch (cause) { error.value = errorText(cause) }
}
async function taskSaved(task: AgentTask) { taskPage.value = 1; await loadTasks(); await openTask(task) }
async function removeAgent(agent: AgentDefinition) {
  try {
    await ElMessageBox.confirm('将物理删除该 Agent 及其全部任务、运行记录与产物（保留审计）；须已停用，存在启用中周期、未结束运行或过程数据时会被拒绝。', `删除 ${agent.configuration.name}`, { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await deleteAgent(agent)
    ElMessage.success('Agent 已删除')
    if (selected.value?.id === agent.id) selected.value = null
    if (taskListAgent.value?.id === agent.id) { taskListOpen.value = false; taskListAgent.value = null; tasks.value = []; taskTotal.value = 0 }
    await loadAgents()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}
function editTask(task: AgentTask) { editingTask.value = task; taskOpen.value = true }
async function removeTask(task: AgentTask) {
  try {
    await ElMessageBox.confirm('将物理删除该任务及其全部运行记录与产物（保留审计）；周期任务须先暂停，存在未结束运行或过程数据时会被拒绝。', `删除任务 ${task.specification.objective.slice(0, 30)}`, { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await deleteAgentTask(task)
    ElMessage.success('任务已删除')
    if (activeTask.value?.id === task.id) { drawer.value = false; detail.value = null }
    await loadTasks()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}
async function openTask(task: AgentTask) {
  activeTask.value = task
  runPage.value = 1
  runs.value = []
  detail.value = null
  selectedRunId.value = ''
  drawerError.value = ''
  drawer.value = true
  startKey = requestKey()
  await loadRuns()
}
async function loadRuns(quiet = false) {
  if (!activeTask.value || !drawer.value) return
  const taskId = activeTask.value.id
  const epoch = ++runEpoch
  if (!quiet) runsLoading.value = true
  try {
    const [task, result] = await Promise.all([fetchAgentTask(taskId), fetchAgentRuns(taskId, runPage.value)])
    if (epoch !== runEpoch || activeTask.value?.id !== taskId || !drawer.value || !active) return
    activeTask.value = task
    runs.value = result.items
    runTotal.value = result.total
    drawerError.value = ''
    if (!selectedRunId.value && result.items.length) selectedRunId.value = result.items[0].id
    if (selectedRunId.value) await loadRunDetail(selectedRunId.value)
  } catch (cause) { if (epoch === runEpoch) drawerError.value = errorText(cause) }
  finally { if (epoch === runEpoch) runsLoading.value = false }
}
async function loadRunDetail(id: string) {
  if (!activeTask.value) return
  const taskId = activeTask.value.id
  const epoch = ++detailEpoch
  if (selectedRunId.value !== id) detail.value = null
  selectedRunId.value = id
  try {
    const result = await fetchAgentRun(taskId, id)
    if (epoch === detailEpoch && activeTask.value?.id === taskId && selectedRunId.value === id && drawer.value && active) detail.value = result
  } catch (cause) { if (epoch === detailEpoch) drawerError.value = errorText(cause) }
}
async function start() {
  if (!activeTask.value) return
  operating.value = true
  try {
    const run = await runAgentTask(activeTask.value, startKey)
    startKey = requestKey()
    await newRun(run)
    ElMessage.success('新一轮运行已排队')
  } catch (cause) { drawerError.value = errorText(cause) }
  finally { operating.value = false }
}
async function newRun(run: AgentRun) {
  if (activeTask.value?.id !== run.taskId) return
  runPage.value = 1
  selectedRunId.value = run.id
  detail.value = null
  await loadRuns()
}
function editSchedule() {
  if (!activeTask.value) return
  Object.assign(schedule, activeTask.value.schedule, { expectedVersion: activeTask.value.version })
  scheduleError.value = ''
  scheduleOpen.value = true
}
async function saveSchedule() {
  if (!activeTask.value) return
  const taskId = activeTask.value.id
  operating.value = true
  scheduleError.value = ''
  try {
    const updated = await saveAgentSchedule(taskId, { ...schedule, enabled: schedule.mode === 'CRON' && schedule.enabled, cronExpression: schedule.mode === 'CRON' ? schedule.cronExpression : null })
    if (activeTask.value?.id === taskId) activeTask.value = updated
    scheduleOpen.value = false
    ElMessage.success('任务周期已更新')
    await loadTasks()
  } catch (cause) { scheduleError.value = errorText(cause) }
  finally { operating.value = false }
}
function stopPolling() { if (timer) clearInterval(timer); timer = undefined }
function startPolling() {
  stopPolling()
  timer = setInterval(async () => {
    if (!active || !drawer.value || polling || operating.value) return
    polling = true
    try { await loadRuns(true) } finally { polling = false }
  }, 5000)
}
onMounted(async () => { await initialize(); startPolling() })
onActivated(() => { active = true; startPolling(); if (initialized) { void loadAgents(); void loadRuns(true) } })
onDeactivated(() => { active = false; stopPolling() })
onUnmounted(() => { active = false; stopPolling() })
</script>

<template>
  <div class="agent-workbench">
    <section class="page-card agent-card">
      <div class="page-header"><div><h2>数字员工</h2><p class="description">配置 AI 助手，分派巡检或其他任务，跟踪执行与产物。</p></div><div><el-button @click="initialize">刷新</el-button><el-button v-if="canManage" type="primary" @click="configure(null)">创建 Agent</el-button></div></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="feedback" />
      <el-table v-loading="loading" :data="agents" row-key="id" highlight-current-row @row-click="selectAgent">
        <el-table-column label="Agent" min-width="190"><template #default="{ row }"><strong>{{ row.configuration.name }}</strong><div class="muted line-clamp">{{ row.configuration.instructions }}</div></template></el-table-column>
        <el-table-column label="AI / 模型" min-width="170"><template #default="{ row }"><span>{{ providerName(row.configuration.providerConfigId) }}</span><div class="muted">{{ row.configuration.model || '使用接入默认模型' }}</div></template></el-table-column>
        <el-table-column label="授权" width="160"><template #default="{ row }">{{ row.configuration.scopes.length }} 个范围</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="265" fixed="right"><template #default="{ row }"><el-button v-if="canViewTasks" link type="primary" @click.stop="openTaskList(row)">任务</el-button><el-button v-if="canManage" link type="primary" @click.stop="configure(row)">配置</el-button><el-button v-if="canManage" link :type="row.enabled ? 'warning' : 'success'" @click.stop="toggle(row)">{{ row.enabled ? '停用' : '启用' }}</el-button><el-button v-if="canManage" link type="danger" @click.stop="removeAgent(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="尚未配置 Agent" :image-size="70"><el-button v-if="canManage" type="primary" @click="configure(null)">创建第一个 Agent</el-button></el-empty></template>
      </el-table>
      <el-pagination v-model:current-page="agentPage" :total="agentTotal" :page-size="20" layout="total, prev, pager, next" @current-change="loadAgents" />
    </section>
    <el-dialog v-model="taskListOpen" :title="`${taskListAgent?.configuration.name ?? ''} 的任务`" width="min(1100px, 92vw)" top="4vh" class="task-list-dialog">
      <div class="drawer-toolbar"><el-button @click="loadTasks">刷新任务</el-button><el-button v-if="canAssign" type="primary" @click="editingTask = null; taskOpen = true">分派任务</el-button></div>
      <el-alert v-if="taskError" :title="taskError" type="error" :closable="false" class="feedback" />
      <el-table v-loading="tasksLoading" :data="tasks" row-key="id">
        <el-table-column label="目标" min-width="240"><template #default="{ row }"><el-button class="task-title" link type="primary" @click="openTask(row)">{{ row.specification.objective }}</el-button></template></el-table-column>
        <el-table-column label="执行方式" width="175"><template #default="{ row }">{{ row.schedule.mode === 'MANUAL' ? '手动分派' : row.schedule.enabled ? '周期执行' : '周期已暂停' }}<div v-if="row.schedule.mode === 'CRON'" class="muted">{{ row.schedule.cronExpression }}</div></template></el-table-column>
        <el-table-column label="下一次运行" width="185"><template #default="{ row }">{{ localTime(row.nextRunAt) }}</template></el-table-column>
        <el-table-column prop="requestedBy" label="分派人" width="100" />
        <el-table-column label="操作" width="200" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openTask(row)">运行记录</el-button><el-button v-if="canAssign" link type="primary" @click.stop="editTask(row)">编辑</el-button><el-button v-if="canManage" link type="danger" @click.stop="removeTask(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="尚未分派任务" :image-size="50" /></template>
      </el-table>
      <el-pagination v-model:current-page="taskPage" :total="taskTotal" :page-size="20" layout="total, prev, pager, next" @current-change="loadTasks" />
    </el-dialog>
    <AgentConfigDialog v-model="configOpen" :agent="editing" :options="options" @saved="agentSaved" />
    <AgentTaskDialog v-model="taskOpen" :agent="taskListAgent" :options="options" :task="editingTask" @saved="taskSaved" />
    <el-dialog v-model="drawer" title="任务与运行" width="min(1100px, 92vw)" top="4vh" class="task-dialog">
      <template v-if="activeTask">
        <h3 class="task-objective">{{ activeTask.specification.objective }}</h3>
        <p class="description">验收：{{ activeTask.specification.acceptanceCriteria }}</p>
        <div class="artifact-kinds"><el-tag v-for="kind in activeTask.specification.expectedArtifacts" :key="kind" effect="plain">{{ artifactLabels[kind] }}</el-tag><el-tag v-if="activeTask.specification.analysisScope === 'INCREMENTAL'" type="warning" effect="plain">增量分析</el-tag></div>
        <p v-if="activeTask.specification.expectedArtifacts.some(kind => ['DEPLOYMENT', 'VERIFICATION'].includes(kind))" class="description">本次完成目标：{{ activeTask.specification.completionTargets?.length ? activeTask.specification.completionTargets.map(scope => `${scope.businessLineCode} / ${scope.environmentCode === 'TEST' ? '测试' : '生产'}`).join('、') : '尚未明确，请重新分派任务' }}</p>
        <div class="drawer-toolbar"><el-button @click="loadRuns(false)">刷新</el-button><el-button v-if="canOperate" @click="editSchedule">调整周期</el-button><el-button v-if="canOperate" type="primary" :loading="operating" @click="start">开始新一轮</el-button></div>
        <el-alert v-if="drawerError" :title="drawerError" type="error" :closable="false" class="feedback" />
        <el-table v-loading="runsLoading" :data="runs" row-key="id" highlight-current-row @row-click="(run: AgentRun) => loadRunDetail(run.id)">
          <el-table-column label="开始时间" min-width="170"><template #default="{ row }">{{ localTime(row.createdAt) }}</template></el-table-column>
          <el-table-column label="状态" width="180"><template #default="{ row }"><el-tag :type="statusTone(row.status)">{{ statusLabels[row.status] || row.status }}</el-tag></template></el-table-column>
          <el-table-column prop="stepCount" label="行动数" width="90" />
          <el-table-column label="说明" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.errorMessage || row.resultText || '等待执行结果' }}</template></el-table-column>
        </el-table>
        <el-pagination v-model:current-page="runPage" :total="runTotal" :page-size="5" layout="total, prev, pager, next" @current-change="loadRuns(false)" />
        <AgentRunPanel v-if="detail" :key="detail.run.id" :detail="detail" @refresh="loadRuns(true)" @new-run="newRun" />
      </template>
    </el-dialog>
    <el-drawer v-model="scheduleOpen" title="调整任务周期" direction="rtl" size="min(1100px, 92vw)">
      <el-alert v-if="scheduleError" :title="scheduleError" type="error" :closable="false" class="feedback" />
      <el-form label-width="110px" :disabled="operating">
        <el-form-item label="执行方式"><el-radio-group v-model="schedule.mode"><el-radio value="MANUAL">手动</el-radio><el-radio value="CRON">周期</el-radio></el-radio-group></el-form-item>
        <template v-if="schedule.mode === 'CRON'"><el-form-item label="启用周期"><el-switch v-model="schedule.enabled" /></el-form-item><el-form-item label="Cron 表达式"><el-input v-model="schedule.cronExpression" placeholder="六段：秒 分 时 日 月 周" maxlength="128" /></el-form-item><el-form-item label="时区"><el-input v-model="schedule.zoneId" maxlength="64" /></el-form-item><el-form-item label="错过周期时"><el-select v-model="schedule.misfirePolicy"><el-option value="RUN_ONCE" label="最多补一次" /><el-option value="SKIP" label="跳过已错过周期" /></el-select></el-form-item></template>
      </el-form>
      <template #footer>
        <div class="drawer-footer"><el-button :disabled="operating" @click="scheduleOpen = false">取消</el-button><el-button type="primary" :loading="operating" @click="saveSchedule">保存周期</el-button></div>
      </template>
    </el-drawer>
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
.task-title { white-space: normal; height: auto; text-align: left; justify-content: flex-start; line-height: 1.6; }
.task-objective { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.artifact-kinds { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.drawer-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin: 16px 0; }
.drawer-footer { display: flex; justify-content: flex-end; }
:global(.el-drawer__footer) { border-top: 1px solid var(--el-border-color-lighter); padding: 12px 20px; }
:global(.task-dialog .el-dialog__body) { max-height: calc(90vh - 110px); overflow-y: auto; }
:global(.task-list-dialog .el-dialog__body) { max-height: calc(88vh - 110px); overflow-y: auto; }
@media (max-width: 800px) { .page-header { flex-direction: column; align-items: flex-start; } .agent-card { padding: 14px; } }
</style>
