<script setup lang="ts">
import { computed } from 'vue'
import './agentReport.css'
import type { ReportOverview } from './agentReportPresentation'
import { agentReportOverview, renderAgentReport, renderReportOverview } from './agentReportPresentation'
const props = defineProps<{ text: string; formalOverview?: ReportOverview }>()
const overview = computed(() => renderReportOverview(props.formalOverview || agentReportOverview(props.text), Boolean(props.formalOverview)))
const report = computed(() => renderAgentReport(props.text))
</script>

<template>
  <div class="report-reading">
    <!-- Both values are produced exclusively by the escaped, restricted report renderer. -->
    <div v-html="overview" />
    <div class="report-body-heading">完整报告</div>
    <article class="agent-report" aria-label="完整报告" v-html="report" />
  </div>
</template>

<style scoped>
.report-reading { padding: 6px 0 16px; }
.report-body-heading { font-size: 12px; color: #637582; border-top: 1px solid #e5ebef; padding-top: 22px; margin-bottom: 18px; }
</style>
