<script setup lang="ts">
import type { AgentReleaseVerificationPlan } from '@/types/agentRelease'
import { monitoringTools as tools, duration } from './agentVerificationPresentation'

defineProps<{ plan?: AgentReleaseVerificationPlan | null }>()
</script>

<template>
  <section class="verification-plan">
    <h4>业务效果复查标准</h4>
    <el-alert v-if="!plan" title="本计划未包含业务复查标准。请由 Agent 补充后重新准备发布计划，当前不能批准。" type="warning" :closable="false" show-icon />
    <template v-else>
      <p class="muted">以下标准由 Agent 提出，随本次发布方案一起审核。修改标准需重新准备计划；实际复查结果另行核验。</p>
      <article v-for="(check, index) in plan.checks" :key="check.id" class="check">
        <h5>{{ index + 1 }}. {{ tools[check.toolCode] || check.toolCode }} · {{ check.scope.businessLineCode }} / {{ check.scope.environmentCode }}</h5>
        <dl>
          <dt>监测对象与范围</dt><dd>{{ check.monitoringItem }}</dd>
          <dt>通过条件</dt><dd>{{ check.passCondition }}</dd>
          <dt>观察时长</dt><dd>{{ duration(check.observationSeconds) }}</dd>
          <dt>采样要求</dt><dd>每 {{ duration(check.sampleIntervalSeconds) }} 采样，至少 {{ check.minimumSamples }} 份有效样本</dd>
          <dt>数据新鲜度</dt><dd>数据年龄不超过 {{ duration(check.maxDataAgeSeconds) }}</dd>
          <dt>证据要求</dt><dd>{{ check.evidenceRequirements }}</dd>
        </dl>
      </article>
      <dl class="handling"><dt>历史数据处置</dt><dd>{{ plan.historicalDataHandling }}</dd><dt>复查失败处理</dt><dd>{{ plan.failureHandling }}</dd></dl>
    </template>
  </section>
</template>

<style scoped>
.verification-plan { margin: 18px 0; }
.muted { color: #64748b; font-size: 12px; line-height: 1.7; }
.check { padding: 12px; margin: 10px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; }
h5 { margin: 0 0 12px; font-size: 14px; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px 12px; line-height: 1.7; }
dt { color: #64748b; }
dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.handling { padding: 0 12px; }
@media (max-width: 520px) { dl { grid-template-columns: 1fr; gap: 4px; } dd { margin-bottom: 10px; } }
</style>
