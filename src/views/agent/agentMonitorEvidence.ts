import type { AgentEvent } from '@/types/agent'
import type { ReportOverview } from './agentReportPresentation'

export interface MonitorRule { ruleCode: string; ruleName: string; status: string; anomalyCount: number; differenceAmount: string | number; message: string }
export interface MonitorEvidence { monitorRunId: number; run: { runNo: string; status: string }; rules: MonitorRule[] }
export function monitorEvidence(events: AgentEvent[]): MonitorEvidence[] {
  const batches = new Map<number, MonitorEvidence>()
  for (const event of events) {
    if (event.kind !== 'BUSINESS_MONITOR_RESULT') continue
    try {
      const value = JSON.parse(event.payloadJson) as MonitorEvidence
      if (Number.isSafeInteger(value.monitorRunId) && value.monitorRunId > 0 && value.run?.runNo && Array.isArray(value.rules)) batches.set(value.monitorRunId, value)
    } catch { /* 缺失的执行证据不推断为已通过。 */ }
  }
  return [...batches.values()]
}
export function monitorOverview(batches: MonitorEvidence[]): ReportOverview | undefined {
  if (!batches.length) return undefined
  const rules = batches.flatMap(batch => batch.rules)
  const counts = (status: string) => rules.filter(rule => rule.status === status).length
  const context = `来源：正式核对批次 ${batches.map(batch => batch.run.runNo).join('、')}`
  const labels = [['PASS', '正常'], ['WARN', '警告'], ['ERROR', '异常'], ['FAILED', '执行失败'], ['SKIPPED', '无样本或跳过']]
  return {
    summaryLabel: '本轮业务监测结论',
    summary: `已取得 ${batches.length} 个正式核对批次、${rules.length} 条规则结果。${labels.map(([status, label]) => `${label} ${counts(status!)} 条`).join('，')}。异常待核实，执行失败及无样本不算通过；各规则差额可能重叠，不合计为资金损失。`,
    metrics: [{ label: '核验规则', value: String(rules.length), context }, ...labels.map(([status, label]) => ({ label: label!, value: String(counts(status!)), context }))],
  }
}
