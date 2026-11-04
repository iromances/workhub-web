export const monitoringTools: Record<string, string> = {
  'monitor.business.status': '业务监测状态', 'monitor.business.detail': '业务运行详情',
  'monitor.accounting.status': '账务监测状态', 'monitor.accounting.detail': '账务规则结果',
  'monitor.accounting.runs': '账务历史运行', 'monitor.system.alerts': '系统预警', 'workhub.logs': '运行日志',
}
export const assessmentLabels: Record<string, string> = { PASS: '判断通过', FAIL: '判断未通过', INCONCLUSIVE: '暂无法判定' }
const constraints: Record<string, string> = {
  AGENT_NOT_PASS: 'Agent 尚未判断通过', HISTORICAL_DATA_PENDING: '历史数据仍待处置', EVIDENCE_MISSING: '尚无完整证据',
  INSUFFICIENT_DISTINCT_SAMPLES: '有效样本数量不足', OBSERVATION_WINDOW_INCOMPLETE: '连续观察时长不足', LATEST_DATA_STALE: '最新有效数据已过旧',
  OBSERVATION_OUTSIDE_DEPLOYED_WINDOW: '监测查询不在发布后的有效时间内', DATA_OUTSIDE_DEPLOYED_WINDOW: '数据不在发布后的有效时间内',
  DATA_TIMESTAMP_MISSING: '缺少业务数据时间', DATA_STALE_AT_QUERY: '查询时数据已过旧', TRUNCATED_EVIDENCE: '证据内容被截断',
  EXECUTION_SCOPE_UNVERIFIED: '执行范围尚未核实', MONITOR_NOT_EVALUATED: '监测项未完成有效执行', MONITOR_CONFIGURATION_UNVERIFIED: '监测配置尚未核实',
  MONITOR_QUERY_NOT_COMPLETED: '监测查询未完成', EXECUTION_NOT_AFTER_DEPLOYMENT: '执行时间与实际发布不匹配',
  RULE_NOT_EVALUATED: '规则尚未完成评估', RULE_EXECUTION_UNVERIFIED: '规则执行凭据未核实', RULE_RESULTS_INCOMPLETE: '规则结果不完整',
  QUERY_RESULTS_INCOMPLETE: '查询结果不完整', NO_BUSINESS_ACTIVITY: '查询范围内没有业务活动', DATA_OUTSIDE_QUERY_WINDOW: '数据超出查询范围',
  COLLECTION_COVERAGE_UNPROVEN: '采集区间尚未完整核实', SERVICE_ACTIVITY_COVERAGE_UNPROVEN: '目标服务活动覆盖不完整', NO_SERVICE_ACTIVITY: '目标服务没有有效活动',
  QUERY_WINDOW_UNVERIFIED: '查询时间范围未核实', COLLECTION_PROOF_INVALID: '采集证明无效', COLLECTION_SCOPE_UNAVAILABLE: '采集范围未启用或不可用',
  COLLECTOR_DISABLED: '采集器已停用', COLLECTION_RECEIPT_UNREADABLE: '采集回执无法核验', COLLECTION_PAGE_CHAIN_INCOMPLETE: '采集分页不完整',
  COLLECTION_PAGE_CHAIN_INVALID: '采集分页与定义不一致', COLLECTION_DEFINITION_CHANGED: '采集配置或分页链已变化',
  COLLECTION_EXECUTION_INVALID: '采集目标或执行时间不一致', COLLECTION_CONTENT_UNPROVEN: '采集内容缺少完整证明',
  COLLECTION_PROOF_LIMIT_EXCEEDED: '采集证明超过单次读取上限', COLLECTION_EVENT_INVALID: '采集事件不一致', UNRESOLVED_SERVICE: '日志所属服务未明确',
  FILTERED_CONTENT_UNPROVEN: '被过滤的日志缺少完整内容', QUERY_CONTENT_NOT_IN_COLLECTION: '查询包含未被本次采集证明的记录',
  QUERY_CONTENT_DIFFERS_FROM_COLLECTION: '查询记录与采集内容不一致', ACTIVITY_OUTSIDE_QUERY_WINDOW: '服务活动不在查询范围内',
  SERVICE_ACTIVITY_QUERY_FAILED: '服务活动查询失败', SERVICE_ACTIVITY_LIMIT_EXCEEDED: '服务活动核验超过单次上限',
}
export function constraintText(code: string): string { return constraints[code] || `需核对：${code}` }
export function duration(seconds: number): string {
  if (seconds === 0) return '0 秒'
  if (seconds % 86400 === 0) return `${seconds / 86400} 天`
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  return `${seconds} 秒`
}
export function sourcePermissions(tool: string): string[] {
  if (tool.startsWith('monitor.accounting.')) return ['ops:accounting:view', 'ops:accounting:manage']
  if (tool.startsWith('monitor.business.')) return ['ops:monitor:view', 'ops:monitor:manage']
  return ['ops:system-alert:view', 'ops:system-alert:manage']
}
