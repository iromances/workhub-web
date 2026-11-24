<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchAccountingSqlEvidence, fetchAccountingAgentRuns, type AccountingSqlEvidence } from '@/api/accounting'
const props = defineProps<{ runId: number }>()
const rows = ref<AccountingSqlEvidence[]>([]), agents = ref<string[]>([])
const page = ref(1), total = ref(0), error = ref(''), loading = ref(false)
let epoch = 0
async function load() {
  const ticket = ++epoch, id = props.runId
  error.value = ''; loading.value = true
  try {
    const [result, links] = await Promise.all([fetchAccountingSqlEvidence(id, page.value), fetchAccountingAgentRuns(id)])
    if (ticket !== epoch) return
    rows.value = result.items; total.value = result.total; agents.value = links
  } catch { if (ticket === epoch) error.value = 'SQL 执行证据读取失败，请重试' }
  finally { if (ticket === epoch) loading.value = false }
}
watch(() => props.runId, () => { page.value = 1; rows.value = []; total.value = 0; agents.value = []; void load() }, { immediate: true })
</script>
<template>
  <section class="sql-evidence">
    <div class="toolbar"><h3>实际 SQL 执行记录</h3><el-button :loading="loading" @click="load">刷新 SQL 记录</el-button></div>
    <p v-if="agents.length">关联数字员工运行：{{ agents.join('、') }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-else v-loading="loading" :data="rows" row-key="id" max-height="420" empty-text="本批次没有已关联的 SQL 审计；旧批次不按时间推测关联，不能据此判定核验通过。">
      <el-table-column type="expand"><template #default="{ row }">
        <div class="snapshot"><p>证据 #{{ row.id }} · 规则组 {{ row.ruleFamily }}</p><p>模板 SHA-256：{{ row.templateHash }}</p>
          <p>参数：{{ row.parametersJson }}</p><p>{{ row.startedAt }} — {{ row.finishedAt }}</p>
          <el-alert v-if="row.errorMessage" :title="row.errorMessage" type="error" :closable="false" />
          <pre>{{ row.renderedSql }}</pre></div>
      </template></el-table-column>
      <el-table-column prop="sqlCode" label="SQL 编码" min-width="280" />
      <el-table-column prop="status" label="执行状态" width="110" />
      <el-table-column prop="startedAt" label="执行时间" width="190" />
      <el-table-column prop="rowCount" label="返回行数" width="100" />
      <el-table-column prop="durationMs" label="耗时(ms)" width="100" />
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" />
  </section>
</template>
<style scoped>.sql-evidence{margin-top:24px}.toolbar{display:flex;justify-content:space-between;align-items:center}.snapshot{padding:12px 24px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:16px;max-height:360px;overflow:auto}</style>
