<template>
  <div class="page-card job-admin-page">
    <div class="page-toolbar">
      <h2 class="page-title">Job 管理</h2>
      <p class="page-subtitle">系统定时任务调度与执行历史（修改调度时间即时生效，无需重启）</p>
    </div>

    <el-table v-loading="loading" :data="jobs" row-key="jobCode">
      <el-table-column prop="jobCode" label="任务编码" min-width="230" show-overflow-tooltip />
      <el-table-column prop="jobName" label="名称" min-width="130" />
      <el-table-column label="调度" min-width="200">
        <template #default="{ row }">
          <el-tag size="small" :type="row.scheduleType === 'CRON' ? 'primary' : 'warning'" class="schedule-tag">
            {{ row.scheduleType === 'CRON' ? 'CRON' : 'FIXED_DELAY' }}
          </el-tag>
          <span class="schedule-value">{{ row.scheduleValue }}{{ row.scheduleType === 'FIXED_DELAY' ? ' ms' : '' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.running ? 'warning' : row.enabled ? 'success' : 'info'">
            {{ row.running ? '运行中' : row.enabled ? '已启用' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下次触发" width="170">
        <template #default="{ row }">{{ formatTime(row.nextFireTime) || '—' }}</template>
      </el-table-column>
      <el-table-column label="最近执行" min-width="200">
        <template #default="{ row }">
          <template v-if="row.lastExecution">
            <el-tag size="small" :type="executionTag(row.lastExecution.status)">
              {{ executionStatusName(row.lastExecution.status) }}
            </el-tag>
            <span class="last-exec">{{ formatTime(row.lastExecution.startedAt) }}（{{ durationText(row.lastExecution.durationMs) }}）</span>
            <div v-if="row.lastExecution.errorMessage" class="exec-error" :title="row.lastExecution.errorMessage">
              {{ row.lastExecution.errorMessage }}
            </div>
          </template>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canManage" size="small" @click="openSchedule(row)">改调度</el-button>
          <el-button v-if="canManage" size="small" @click="toggleEnabled(row)">
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
          <el-button
            v-if="canTrigger && row.allowManualTrigger"
            size="small"
            type="primary"
            :loading="triggering === row.jobCode"
            @click="openTrigger(row)"
          >触发</el-button>
          <el-button size="small" @click="openHistory(row)">执行历史</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="scheduleVisible" title="修改调度时间（保存后立即生效）" width="520px">
      <el-form label-width="100px">
        <el-form-item label="任务">
          <span>{{ scheduleForm.jobName }}（{{ scheduleForm.jobCode }}）</span>
        </el-form-item>
        <el-form-item label="调度类型">
          <el-radio-group v-model="scheduleForm.scheduleType">
            <el-radio value="CRON">CRON</el-radio>
            <el-radio value="FIXED_DELAY">FIXED_DELAY</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="scheduleForm.scheduleType === 'CRON' ? 'cron 表达式' : '间隔毫秒'">
          <el-input
            v-model="scheduleForm.scheduleValue"
            :placeholder="scheduleForm.scheduleType === 'CRON' ? '如 0 */30 * * * *' : '如 5000（1000-3600000）'"
          />
        </el-form-item>
        <el-form-item label="默认值">
          <span class="default-schedule">{{ scheduleForm.defaultScheduleValue }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSchedule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="triggerVisible" title="手动触发任务" width="520px">
      <el-form label-width="100px">
        <el-form-item label="任务">
          <span>{{ triggerTarget?.jobName }}（{{ triggerTarget?.jobCode }}）</span>
        </el-form-item>
        <el-form-item label="参数">
          <el-input v-model="triggerParams" type="textarea" :rows="3" placeholder="可选，按任务参数说明填写" />
        </el-form-item>
        <el-form-item v-if="triggerTarget?.paramDesc" label="参数说明">
          <span class="param-desc">{{ triggerTarget.paramDesc }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="triggerVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmTrigger">执行</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="historyVisible" :title="`执行历史 - ${historyTarget?.jobName || ''}`" size="760px">
      <el-form inline class="history-filter">
        <el-form-item label="状态">
          <el-select v-model="historyStatus" clearable placeholder="全部" style="width: 140px" @change="loadHistory">
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="ERROR" />
            <el-option label="运行中" value="RUNNING" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="loadHistory">刷新</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="historyLoading" :data="historyPage?.items || []">
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ formatTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="触发" width="90">
          <template #default="{ row }">{{ row.triggerType === 'MANUAL' ? '手动' : '调度' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="executionTag(row.status)">{{ executionStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="90">
          <template #default="{ row }">{{ durationText(row.durationMs) }}</template>
        </el-table-column>
        <el-table-column prop="params" label="参数" min-width="120" show-overflow-tooltip />
        <el-table-column prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
      </el-table>
      <div class="history-pager">
        <el-pagination
          layout="prev, pager, next, total"
          :total="historyPage?.total || 0"
          :page-size="historyPageSize"
          :current-page="historyPageNum"
          @current-change="onHistoryPage"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchJobExecutions,
  fetchJobs,
  triggerJob,
  updateJobEnabled,
  updateJobSchedule,
  type JobAdminItem,
  type JobExecutionPage,
} from '@/api/job'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const canManage = computed(() => authStore.hasAnyPermission(['ops:job:manage']))
const canTrigger = computed(() => authStore.hasAnyPermission(['ops:job:trigger', 'ops:job:manage']))

const loading = ref(false)
const saving = ref(false)
const jobs = ref<JobAdminItem[]>([])
const triggering = ref('')

const scheduleVisible = ref(false)
const scheduleForm = reactive({
  jobCode: '',
  jobName: '',
  scheduleType: 'CRON' as 'CRON' | 'FIXED_DELAY',
  scheduleValue: '',
  defaultScheduleValue: '',
})

const triggerVisible = ref(false)
const triggerTarget = ref<JobAdminItem | null>(null)
const triggerParams = ref('')

const historyVisible = ref(false)
const historyTarget = ref<JobAdminItem | null>(null)
const historyLoading = ref(false)
const historyPage = ref<JobExecutionPage | null>(null)
const historyStatus = ref('')
const historyPageNum = ref(1)
const historyPageSize = 20

async function loadJobs() {
  loading.value = true
  try {
    jobs.value = await fetchJobs()
  } catch (error) {
    ElMessage.error('加载任务列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function openSchedule(row: JobAdminItem) {
  scheduleForm.jobCode = row.jobCode
  scheduleForm.jobName = row.jobName
  scheduleForm.scheduleType = row.scheduleType
  scheduleForm.scheduleValue = row.scheduleValue
  scheduleForm.defaultScheduleValue = row.defaultScheduleValue
  scheduleVisible.value = true
}

async function saveSchedule() {
  saving.value = true
  try {
    await updateJobSchedule(scheduleForm.jobCode, {
      scheduleType: scheduleForm.scheduleType,
      scheduleValue: scheduleForm.scheduleValue.trim(),
    })
    ElMessage.success('调度已更新并即时生效')
    scheduleVisible.value = false
    await loadJobs()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: JobAdminItem) {
  const stoppingAgentLoop = !row.enabled === false && row.jobCode.startsWith('AGENT_')
  try {
    await ElMessageBox.confirm(
      row.enabled
        ? `确定停用「${row.jobName}」？${stoppingAgentLoop ? '停用后数字员工相关轮询将停止运行。' : ''}停用期间不再按调度执行。`
        : `确定启用「${row.jobName}」？`,
      row.enabled ? '停用任务' : '启用任务',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await updateJobEnabled(row.jobCode, !row.enabled)
    ElMessage.success(row.enabled ? '已停用' : '已启用')
    await loadJobs()
  } catch (error) {
    ElMessage.error((error as Error).message || '操作失败')
    console.error(error)
  }
}

function openTrigger(row: JobAdminItem) {
  triggerTarget.value = row
  triggerParams.value = ''
  triggerVisible.value = true
}

async function confirmTrigger() {
  if (!triggerTarget.value) return
  saving.value = true
  triggering.value = triggerTarget.value.jobCode
  try {
    const result = await triggerJob(triggerTarget.value.jobCode, triggerParams.value.trim() || undefined)
    if (result.status === 'SUCCESS') {
      ElMessage.success(`执行成功，耗时 ${durationText(result.durationMs)}`)
    } else {
      ElMessage.error(`执行失败：${result.errorMessage || '未知原因'}`)
    }
    triggerVisible.value = false
    await loadJobs()
  } catch (error) {
    ElMessage.error((error as Error).message || '触发失败')
    console.error(error)
  } finally {
    saving.value = false
    triggering.value = ''
  }
}

function openHistory(row: JobAdminItem) {
  historyTarget.value = row
  historyStatus.value = ''
  historyPageNum.value = 1
  historyVisible.value = true
  loadHistory()
}

async function loadHistory() {
  if (!historyTarget.value) return
  historyLoading.value = true
  try {
    historyPage.value = await fetchJobExecutions(historyTarget.value.jobCode, {
      page: historyPageNum.value,
      pageSize: historyPageSize,
      status: historyStatus.value || undefined,
    })
  } catch (error) {
    ElMessage.error('加载执行历史失败')
    console.error(error)
  } finally {
    historyLoading.value = false
  }
}

function onHistoryPage(page: number) {
  historyPageNum.value = page
  loadHistory()
}

function formatTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

function durationText(durationMs?: number | null) {
  if (durationMs == null) return '—'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function executionTag(status: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'ERROR') return 'danger'
  return 'warning'
}

function executionStatusName(status: string) {
  if (status === 'SUCCESS') return '成功'
  if (status === 'ERROR') return '失败'
  return '运行中'
}

onMounted(loadJobs)
</script>

<style scoped>
.job-admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 18px;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.schedule-tag {
  margin-right: 6px;
}

.schedule-value {
  font-family: monospace;
  font-size: 13px;
}

.default-schedule {
  font-family: monospace;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.last-exec {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.exec-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-color-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.param-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-filter {
  margin-bottom: 8px;
}

.history-pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
