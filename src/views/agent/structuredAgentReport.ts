import type { StructuredReport } from '@/types/agentReport'
export type { StructuredReport } from '@/types/agentReport'
export interface ReportContext { businessLines?: { businessLineCode: string; businessLineName: string }[] }
const labels: Record<string, string> = { NORMAL: '检查范围内正常', ISSUES_FOUND: '发现问题', INCONCLUSIVE: '尚不能下结论', PASS: '通过', FAIL: '未通过', PARTIAL: '部分完成', NOT_VERIFIED: '未验证', NOT_APPLICABLE: '不适用', VERIFIED: '已验证', INFERRED: '推断', UNVERIFIED: '待核实', OPEN: '待处理', RESOLVED: '已解决', UNKNOWN: '未知', UNASSESSED: '未定级' }
const tones: Record<string, string> = { NORMAL: 'success', PASS: 'success', VERIFIED: 'success', RESOLVED: 'success', FAIL: 'danger', P0: 'danger', P1: 'danger', ISSUES_FOUND: 'danger', PARTIAL: 'warning', INFERRED: 'warning', OPEN: 'warning', P2: 'warning', NOT_VERIFIED: 'muted', UNVERIFIED: 'muted', INCONCLUSIVE: 'muted' }
const escape = (value: unknown) => String(value ?? '未记录').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const text = (value: unknown) => escape(value).replace(/\n/g, '<br>')
const badge = (value: string) => `<span class="report-status report-status--${tones[value] || 'neutral'}">${escape(labels[value] || value)}</span>`

/** Only split narrative boundaries outside quoted text, code, brackets and URLs. */
export function reportNarrative(value: unknown): string {
  const source = String(value ?? '未记录')
  const parts: string[] = []
  const closers: string[] = []
  const pairs: Record<string, string> = { '（': '）', '(': ')', '[': ']', '【': '】', '「': '」', '『': '』', '“': '”', '‘': '’' }
  let buffer = '', quote = '', code = '', token = false
  let lineStart = 0
  const flush = () => { if (buffer.trim()) parts.push(buffer.trim()); buffer = '' }
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    if (c === '`') {
      const fence = source.startsWith('```', i) ? '```' : '`'
      if (!code) code = fence
      else if (code === fence) code = ''
      buffer += fence; i += fence.length - 1; continue
    }
    if (code) { buffer += c; continue }
    if (quote) { buffer += c; if (c === quote && source[i - 1] !== '\\') quote = ''; continue }
    if (c === '"' || (c === "'" && !/[a-z]/i.test(source[i - 1] || ''))) { quote = c; buffer += c; continue }
    if (closers.length) { if (pairs[c]) closers.push(pairs[c]!); else if (c === closers.at(-1)) closers.pop(); buffer += c; continue }
    if (/^https?:\/\//.test(source.slice(i, i + 8))) token = true
    if (/[\s，。；]/.test(c)) token = false
    const sql = /(?:^|[：:])\s*(?:SELECT|WITH|UPDATE|INSERT|DELETE|CREATE|ALTER)\b/i.test(source.slice(lineStart, lineStart + 120))
    const previous = source[i - 1] || ''
    const marker = !token && !sql && (
      /^[①-⑳]/.test(c) ||
      ((i === 0 || /[\s：；;。]/.test(previous) || (previous === ':' && !/\d/.test(source[i - 2] || ''))) && /^(?:\d+[、.)）](?!\d)|[（(]\d+[）)]|[一二三四五六七八九十]+、|第[一二三四五六七八九十]+[，、：:]|[-*•]\s)/.test(source.slice(i)))
    )
    if (marker) flush()
    if (pairs[c]) { closers.push(pairs[c]!); buffer += c; continue }
    buffer += c
    if (c === '\n') lineStart = i + 1
    if (c === '\n' || (!token && !sql && /[；;]/.test(c))) flush()
    else if (!token && !sql && c === '。') flush()
  }
  flush()
  if (!parts.length) return '<p>无记录</p>'
  if (parts.length === 1) return `<p>${text(parts[0])}</p>`
  return `<ul class="report-points">${parts.map(p => `<li>${text(p)}</li>`).join('')}</ul>`
}

const cellHtml = Symbol('report-cell')
type Cell = { [cellHtml]: string }
const narrative = (value: unknown): Cell => ({ [cellHtml]: reportNarrative(value) })
const status = (value: string): Cell => ({ [cellHtml]: badge(value) })
const table = (head: string[], rows: (unknown | Cell)[][]) => rows.length ? `<div class="report-table"><table><thead><tr>${head.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${v && typeof v === 'object' && cellHtml in v ? (v as Cell)[cellHtml] : text(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>无记录</p>'
const list = (items: string[]) => items.length ? `<div class="report-items">${items.map(v => `<div class="report-item">${reportNarrative(v)}</div>`).join('')}</div>` : '<p>无记录</p>'
export function reportWindow(window: StructuredReport['scope']['window']): string {
  if (window.from || window.to) return `${window.from || '起始时间未记录'} — ${window.to || '结束时间未记录'}`
  // Explicit report evidence only: current task defaults cannot describe a historical run.
  if (/(?:\bFULL\b|全量分析)/i.test(window.basis) && /(?:不受时间窗限制|不限制时间(?:范围|窗)|不限时间(?:范围|窗))/.test(window.basis)) return '全量分析（不限制时间范围）'
  return '未记录时间范围'
}
function businessLine(code: string, context: ReportContext): string {
  const name = context.businessLines?.find(b => b.businessLineCode === code)?.businessLineName
  return name && name !== code ? `${name}（${code}）` : code
}
/** Page and exported document share this escaped renderer. No model-generated HTML is trusted. */
export function renderStructuredReport(r: StructuredReport, context: ReportContext = {}): string {
  const evidence = (kind: string, key: string) => r.evidence.filter(e => e.targetType === kind && e.targetKey === key).map(e => e.key).join('、') || '未关联证据'
  const counts = ['PASS', 'FAIL', 'PARTIAL', 'NOT_VERIFIED', 'NOT_APPLICABLE'].map(outcome => {
    const count = r.checks.filter(c => c.outcome === outcome).length
    return count ? `<span>${badge(outcome)} ${count} 项</span>` : ''
  }).join('')
  return `<h1>${text(r.title)}</h1><h2>总体结论</h2><div class="report-overview">${badge(r.assessment)}${reportNarrative(r.conclusion)}</div>
    <h2>范围</h2>${table(['项目', '内容'], [['业务线', r.scope.businessLines.map(c => businessLine(c, context)).join('、')], ['环境', r.scope.environments.join('、')], ['时间范围', reportWindow(r.scope.window)], ['统计口径与实际覆盖', narrative(r.scope.window.basis)], ['包含范围', { [cellHtml]: list(r.scope.included) }], ['不含范围', { [cellHtml]: list(r.scope.excluded) }]])}
    ${r.scope.repositories.length ? table(['仓库', '分支', '提交', '基线'], r.scope.repositories.map(v => [v.name, v.branch, v.commit, v.baseline])) : ''}
    <h2>检查项与结果</h2><p class="report-note">逐项展示检查的核验结果，不代表任务运行状态。通过：已完成且符合检查要求；未通过：发现不符合项；部分完成：仍有未核实部分；未验证：尚无验证结论；不适用：本次范围无需检查。</p><div class="report-check-counts">${counts}</div>${table(['编号', '检查项', '状态', '结果', '证据'], r.checks.map(c => [c.key, c.title, status(c.outcome), narrative(c.result), evidence('CHECK', c.key)]))}
    <h2>问题总览</h2>${table(['编号', '优先级', '问题', '核验', '处理状态'], r.findings.map(f => [f.key, status(f.severity), f.title, status(f.verificationStatus), status(f.disposition)]))}
    ${r.findings.map(f => `<h3>${text(f.key)} · ${text(f.title)}</h3>${table(['项目', '内容'], [['触发条件', narrative(f.trigger)], ['原因分析', narrative(f.analysis)], ['影响', narrative(f.impact)], ['修复建议', narrative(f.recommendation)], ['证据', evidence('FINDING', f.key)]])}`).join('')}
    <h2>未验证事项与适用边界</h2>${list(r.limitations)}
    <h2>验证结果</h2>${table(['证据', '验证方法', '结果', '边界'], r.evidence.filter(e => e.type === 'TEST').map(e => [e.key, narrative(e.verificationMethod), narrative(e.result), narrative(e.limitations)]))}
    <h2>后续行动与验收</h2>${table(['编号', '优先级', '关联问题', '行动', '验收条件', '前置条件'], r.actions.map(a => [a.key, status(a.priority), a.findingKey, narrative(a.description), narrative(a.acceptanceCriteria), narrative(a.prerequisite)]))}
    <h2>证据索引</h2>${table(['编号', '来源与位置', '时间/环境', '结果', '适用边界'], r.evidence.map(e => [e.key, `${e.source}\n${e.locator || ''}`, `${e.observedAt || '未记录'} / ${e.environment || '未记录'}`, narrative(e.result), narrative(e.limitations)]))}`
}
export function structuredReportDocument(r: StructuredReport, css: string, context: ReportContext = {}): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(r.title)}</title><style>${css}</style><body style="margin:0;padding:24px;max-width:1200px;margin-inline:auto"><article class="agent-report">${renderStructuredReport(r, context)}</article></body></html>`
}
