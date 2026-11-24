<template>
  <div class="page-card function-call-page">
    <div class="page-toolbar">
      <h2 class="page-title">Function Call</h2>
      <p class="page-subtitle">
        业务库只读查询统一入口：场景 SQL 集中登记（场景编码 ↔ SQL 编码），服务监测等场景按编码调用；
        修改保存后即时生效。
      </p>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="SQL 管理" name="sql">
        <el-form inline class="filter-form" @submit.prevent="loadList">
          <el-form-item label="关键词">
            <el-input v-model="keyword" placeholder="SQL 编码/场景/名称" clearable style="width: 240px" />
          </el-form-item>
          <el-form-item label="仅启用">
            <el-switch v-model="enabledOnly" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">查询</el-button>
            <el-button v-if="canManage" type="primary" @click="openCreate">新增 SQL</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loading" :data="items" row-key="id">
          <el-table-column prop="sqlCode" label="SQL 编码" min-width="220" show-overflow-tooltip />
          <el-table-column label="场景编码" min-width="200">
            <template #default="{ row }">
              <span class="scenario">{{ row.scenarioCode || '—' }}</span>
              <el-tag v-if="row.branchOrder > 1" size="small" class="branch-tag">分支{{ row.branchOrder }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="sourceModule" label="来源" width="100" />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openDetail(row)">查看</el-button>
              <el-button v-if="canManage" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canManage" size="small" @click="toggleEnabled(row)">
                {{ row.enabled ? '停用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="执行记录" name="audits">
        <el-form inline class="filter-form" @submit.prevent="loadAudits">
          <el-form-item label="SQL 编码">
            <el-input v-model="auditFilters.sqlCode" placeholder="编码模糊匹配" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="来源">
            <el-select v-model="auditFilters.source" clearable placeholder="全部" style="width: 130px">
              <el-option label="系统/巡检" value="SYSTEM" />
              <el-option label="手动试运行" value="MANUAL" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="auditFilters.status" clearable placeholder="全部" style="width: 110px">
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="ERROR" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker
              v-model="auditDateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始"
              end-placeholder="结束"
              range-separator="至"
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadAudits">查询</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="auditLoading" :data="auditPage?.items || []" row-key="id">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatAuditTime(row.startedAt) }}</template>
          </el-table-column>
          <el-table-column prop="sqlCode" label="SQL 编码" min-width="240" show-overflow-tooltip />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.source === 'MANUAL' ? 'warning' : 'info'">
                {{ row.source === 'MANUAL' ? '手动' : '系统' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="110" show-overflow-tooltip />
          <el-table-column label="目标库" min-width="150">
            <template #default="{ row }">{{ row.businessLineCode }} / {{ row.environmentCode }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'SUCCESS' ? 'success' : 'danger'">
                {{ row.status === 'SUCCESS' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="行数" width="80">
            <template #default="{ row }">{{ row.rowCount ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="90">
            <template #default="{ row }">{{ row.durationMs != null ? `${row.durationMs}ms` : '—' }}</template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="失败原因" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openAuditDetail(row)">SQL</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="audit-pager">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="auditPage?.total || 0"
            :page-size="auditPageSize"
            :current-page="auditPageNum"
            @current-change="onAuditPage"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="试运行" name="try">
        <el-form label-width="110px" class="try-form">
          <el-form-item label="编码">
            <el-input v-model="tryForm.codeOrScenario" placeholder="SQL 编码或场景编码，如 OPS_XXL_EXECUTORS" style="width: 320px" />
          </el-form-item>
          <el-form-item label="业务线">
            <el-input v-model="tryForm.businessLineCode" placeholder="如 BL000004" style="width: 200px" />
          </el-form-item>
          <el-form-item label="环境">
            <el-input v-model="tryForm.environmentCode" placeholder="如 PROD" style="width: 140px" />
          </el-form-item>
          <el-form-item label="参数 JSON">
            <el-input v-model="tryParamsJson" type="textarea" :rows="4" placeholder='{"databaseName":"`amp_xxl_job_250`"}' />
          </el-form-item>
          <el-form-item>
            <el-button
              v-if="canExecute"
              type="primary"
              :loading="trying"
              @click="tryRun"
            >试运行（只读，最多返回 50 行）</el-button>
          </el-form-item>
        </el-form>

        <template v-if="tryResult">
          <el-alert type="info" :closable="false" class="try-sql">
            <pre class="sql-preview">{{ tryResult.sqlRendered }}</pre>
          </el-alert>
          <el-table v-loading="trying" :data="tryResult.rows" size="small" max-height="420">
            <el-table-column
              v-for="column in tryResult.columns"
              :key="column"
              :prop="column"
              :label="column"
              min-width="140"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row[column] == null ? '—' : String(row[column]) }}</template>
            </el-table-column>
          </el-table>
        </template>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="auditDetailVisible" title="执行 SQL 详情" width="760px">
      <el-descriptions :column="2" border size="small" v-if="auditDetail">
        <el-descriptions-item label="SQL 编码">{{ auditDetail.sqlCode }}</el-descriptions-item>
        <el-descriptions-item label="场景编码">{{ auditDetail.scenarioCode || '—' }}</el-descriptions-item>
        <el-descriptions-item label="来源 / 操作人">
          {{ auditDetail.source === 'MANUAL' ? '手动' : '系统' }} / {{ auditDetail.operator }}
        </el-descriptions-item>
        <el-descriptions-item label="目标库">
          {{ auditDetail.businessLineCode }} / {{ auditDetail.environmentCode }}
        </el-descriptions-item>
      </el-descriptions>
      <pre class="sql-preview detail-sql">{{ auditDetail?.renderedSql }}</pre>
    </el-dialog>

    <el-dialog v-model="detailVisible" :title="detailItem?.name || 'SQL 详情'" width="760px">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="SQL 编码">{{ detailItem?.sqlCode }}</el-descriptions-item>
        <el-descriptions-item label="场景编码">{{ detailItem?.scenarioCode || '—' }}</el-descriptions-item>
        <el-descriptions-item label="分支顺序">{{ detailItem?.branchOrder }}</el-descriptions-item>
        <el-descriptions-item label="来源模块">{{ detailItem?.sourceModule || '—' }}</el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">{{ detailItem?.description || '—' }}</el-descriptions-item>
        <el-descriptions-item label="参数说明" :span="2">{{ detailItem?.paramDesc || '—' }}</el-descriptions-item>
      </el-descriptions>
      <pre class="sql-preview detail-sql">{{ detailItem?.sqlTemplate }}</pre>
    </el-dialog>

    <el-dialog v-model="editVisible" :title="editingId ? '编辑 SQL' : '新增 SQL'" width="760px">
      <el-form label-width="110px">
        <el-form-item label="SQL 编码" required>
          <el-input v-model="form.sqlCode" placeholder="大写字母/数字/下划线，如 OPS_XXL_XXX" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="场景编码">
          <el-input v-model="form.scenarioCode" placeholder="如 OPS-XXL-XXX（可空，多分支同场景）" />
        </el-form-item>
        <el-form-item label="分支顺序">
          <el-input-number v-model="form.branchOrder" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" />
        </el-form-item>
        <el-form-item label="SQL 模板" required>
          <el-input v-model="form.sqlTemplate" type="textarea" :rows="10" placeholder="SELECT ... WHERE x = :param（命名参数 :name，仅只读语句）" class="sql-editor" />
        </el-form-item>
        <el-form-item label="参数说明">
          <el-input v-model="form.paramDesc" type="textarea" :rows="2" placeholder="参数名、含义、是否可空" />
        </el-form-item>
        <el-form-item label="来源模块">
          <el-input v-model="form.sourceModule" placeholder="如 OPS_XXL" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createFuncCallSql,
  executeFuncCall,
  fetchFuncCallAudits,
  fetchFuncCallSqlList,
  updateFuncCallSql,
  updateFuncCallSqlEnabled,
  type FuncCallAuditItem,
  type FuncCallAuditPage,
  type FuncCallExecuteResponse,
  type FuncCallSqlItem,
  type FuncCallSqlSaveRequest,
} from '@/api/functionCall'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const canManage = computed(() => authStore.hasAnyPermission(['ops:function-call:manage']))
const canExecute = computed(() => authStore.hasAnyPermission(['ops:function-call:execute', 'ops:function-call:manage']))

const activeTab = ref('sql')
const loading = ref(false)
const saving = ref(false)
const trying = ref(false)
const keyword = ref('')
const enabledOnly = ref(false)
const items = ref<FuncCallSqlItem[]>([])

const detailVisible = ref(false)
const detailItem = ref<FuncCallSqlItem | null>(null)

const editVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<FuncCallSqlSaveRequest>({
  sqlCode: '',
  scenarioCode: '',
  branchOrder: 1,
  name: '',
  description: '',
  sqlTemplate: '',
  paramDesc: '',
  sourceModule: '',
  enabled: true,
  remark: '',
})

const tryForm = reactive({ codeOrScenario: '', businessLineCode: '', environmentCode: '' })
const tryParamsJson = ref('{}')
const tryResult = ref<FuncCallExecuteResponse | null>(null)

const auditFilters = reactive({ sqlCode: '', source: '', status: '' })
const auditDateRange = ref<string[]>([])
const auditLoading = ref(false)
const auditPage = ref<FuncCallAuditPage | null>(null)
const auditPageNum = ref(1)
const auditPageSize = 20
const auditDetailVisible = ref(false)
const auditDetail = ref<FuncCallAuditItem | null>(null)

async function loadAudits() {
  auditLoading.value = true
  try {
    auditPage.value = await fetchFuncCallAudits({
      sqlCode: auditFilters.sqlCode.trim() || undefined,
      source: auditFilters.source || undefined,
      status: auditFilters.status || undefined,
      startDate: auditDateRange.value?.[0] || undefined,
      endDate: auditDateRange.value?.[1] || undefined,
      page: auditPageNum.value,
      pageSize: auditPageSize,
    })
  } catch (error) {
    ElMessage.error('加载执行记录失败')
    console.error(error)
  } finally {
    auditLoading.value = false
  }
}

function onAuditPage(page: number) {
  auditPageNum.value = page
  loadAudits()
}

function openAuditDetail(row: FuncCallAuditItem) {
  auditDetail.value = row
  auditDetailVisible.value = true
}

function formatAuditTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

async function loadList() {
  loading.value = true
  try {
    items.value = await fetchFuncCallSqlList({
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
    })
  } catch (error) {
    ElMessage.error('加载 SQL 登记失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function openDetail(row: FuncCallSqlItem) {
  detailItem.value = row
  detailVisible.value = true
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    sqlCode: '',
    scenarioCode: '',
    branchOrder: 1,
    name: '',
    description: '',
    sqlTemplate: '',
    paramDesc: '',
    sourceModule: '',
    enabled: true,
    remark: '',
  })
  editVisible.value = true
}

function openEdit(row: FuncCallSqlItem) {
  editingId.value = row.id
  Object.assign(form, {
    sqlCode: row.sqlCode,
    scenarioCode: row.scenarioCode,
    branchOrder: row.branchOrder,
    name: row.name,
    description: row.description,
    sqlTemplate: row.sqlTemplate,
    paramDesc: row.paramDesc,
    sourceModule: row.sourceModule,
    enabled: row.enabled,
    remark: row.remark,
  })
  editVisible.value = true
}

async function save() {
  saving.value = true
  try {
    const request: FuncCallSqlSaveRequest = {
      ...form,
      scenarioCode: form.scenarioCode?.trim() || null,
      description: form.description?.trim() || null,
      paramDesc: form.paramDesc?.trim() || null,
      sourceModule: form.sourceModule?.trim() || null,
      remark: form.remark?.trim() || null,
    }
    if (editingId.value) {
      await updateFuncCallSql(editingId.value, request)
    } else {
      await createFuncCallSql(request)
    }
    ElMessage.success('已保存，调用即时生效')
    editVisible.value = false
    await loadList()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: FuncCallSqlItem) {
  const action = row.enabled ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(
      `确定${action}「${row.sqlCode}」？${row.enabled ? '停用后依赖该模板的服务监测调用将立即报错。' : ''}`,
      `${action} SQL`,
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await updateFuncCallSqlEnabled(row.id, !row.enabled)
    ElMessage.success(`已${action}`)
    await loadList()
  } catch (error) {
    ElMessage.error((error as Error).message || '操作失败')
    console.error(error)
  }
}

async function tryRun() {
  let params: Record<string, string>
  try {
    params = tryParamsJson.value.trim() ? JSON.parse(tryParamsJson.value) : {}
  } catch {
    ElMessage.error('参数 JSON 格式非法')
    return
  }
  trying.value = true
  try {
    tryResult.value = await executeFuncCall({
      codeOrScenario: tryForm.codeOrScenario.trim(),
      businessLineCode: tryForm.businessLineCode.trim(),
      environmentCode: tryForm.environmentCode.trim(),
      params,
    })
  } catch (error) {
    ElMessage.error((error as Error).message || '试运行失败')
    console.error(error)
  } finally {
    trying.value = false
  }
}

onMounted(() => {
  loadList()
  loadAudits()
})
</script>

<style scoped>
.function-call-page {
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

.filter-form {
  margin-bottom: 8px;
}

.scenario {
  font-family: monospace;
  font-size: 13px;
}

.branch-tag {
  margin-left: 6px;
}

.sql-preview {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-sql {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  max-height: 360px;
  overflow: auto;
}

.try-form {
  max-width: 720px;
}

.audit-pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.try-sql {
  margin-bottom: 12px;
}

:deep(.sql-editor textarea) {
  font-family: monospace;
}
</style>
