<script setup lang="ts">
import type { MonitorEvidence } from './agentMonitorEvidence'
defineProps<{ batches: MonitorEvidence[] }>()
const statusLabels: Record<string, string> = { PASS: '正常', WARN: '警告', ERROR: '异常', FAILED: '执行失败', SKIPPED: '无样本或跳过' }
</script>
<template>
  <section v-for="batch in batches" :key="batch.monitorRunId" class="monitor-result">
    <h3>{{ batch.run.runNo }}</h3>
    <p>本轮正式规则结果 · 异常数按各规则统计，差额不跨规则相加。</p>
    <el-button link type="primary" @click="$router.push({ path: '/ops/accounting', query: { runId: batch.monitorRunId } })">查看本批次实际 SQL、参数与模板版本</el-button>
    <el-table :data="batch.rules" max-height="520" row-key="ruleCode">
      <el-table-column prop="ruleName" label="监测规则" min-width="220" />
      <el-table-column label="结果" width="125"><template #default="{ row }">{{ statusLabels[row.status] || row.status }}</template></el-table-column>
      <el-table-column prop="anomalyCount" label="异常数" width="90" />
      <el-table-column prop="differenceAmount" label="本规则差额（元）" width="160" />
      <el-table-column prop="message" label="核验范围与说明" min-width="300" show-overflow-tooltip />
    </el-table>
  </section>
</template>
<style scoped>.monitor-result{margin-bottom:24px;min-width:0}.monitor-result h3{font-size:16px}.monitor-result p{font-size:13px;color:#637582}</style>
