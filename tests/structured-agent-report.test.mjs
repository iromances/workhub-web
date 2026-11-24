import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const source = readFileSync(new URL('../src/views/agent/structuredAgentReport.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { renderStructuredReport, structuredReportDocument, reportNarrative, reportWindow } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../workhub-server/workhub-service/src/test/resources/agent/report-v2.json', import.meta.url), 'utf8')).report
const css = readFileSync(new URL('../src/views/agent/agentReport.css', import.meta.url), 'utf8')
test('fixed sections show checks findings linked evidence actions and scope', () => {
  const html = renderStructuredReport(fixture)
  for (const value of ['总体结论', '范围', '检查项与结果', '问题总览', '未验证事项与适用边界', '验证结果', '后续行动与验收', '证据索引', 'findings-1', 'evidence-1', 'BL000005']) assert.ok(html.includes(value), value)
})
test('export and page render identical complete report, including long evidence', () => {
  const r = structuredClone(fixture)
  r.evidence[0].result = '完整证据'.repeat(30000)
  const body = renderStructuredReport(r)
  const document = structuredReportDocument(r, css)
  assert.ok(document.includes(body))
  assert.ok(body.includes(r.evidence[0].result))
})
test('all generated content is escaped including titles evidence and table cells', () => {
  const r = structuredClone(fixture)
  r.title = '<script>alert(1)</script>'
  r.findings[0].analysis = '<img src=x onerror=alert(1)>'
  r.evidence[0].locator = 'javascript:alert(1)'
  const html = structuredReportDocument(r, css)
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('href="javascript:'))
})
test('empty unknown report does not claim all checks passed', () => {
  const r = structuredClone(fixture)
  r.assessment = 'INCONCLUSIVE'
  r.checks = []; r.findings = []; r.evidence = []; r.actions = []
  assert.ok(renderStructuredReport(r).includes('尚不能下结论'))
  assert.ok(renderStructuredReport(r).includes('无记录'))
})
if (process.env.REPORT_PREVIEW_PATH) writeFileSync(process.env.REPORT_PREVIEW_PATH, structuredReportDocument(fixture, css))


test('FULL requires explicit report evidence; partial and missing dates stay distinct', () => {
  assert.equal(reportWindow({ from: null, to: null, basis: 'FULL（全量分析，查询与结论不受时间窗限制）' }), '全量分析（不限制时间范围）')
  assert.equal(reportWindow({ from: null, to: null, basis: '历史范围未知' }), '未记录时间范围')
  assert.equal(reportWindow({ from: null, to: null, basis: 'FULL' }), '未记录时间范围')
  assert.equal(reportWindow({ from: '2026-11-01', to: null, basis: 'FULL' }), '2026-11-01 — 结束时间未记录')
  assert.equal(reportWindow({ from: null, to: '2026-11-22', basis: '' }), '起始时间未记录 — 2026-11-22')
  assert.equal(reportWindow({ from: '2026-11-01', to: '2026-11-22', basis: 'FULL 不限制时间范围' }), '2026-11-01 — 2026-11-22')
})
test('business names and status counts are shared by page and export', () => {
  const r = structuredClone(fixture)
  r.scope.businessLines = ['BL000005', 'BL999999', '智能柜（BL000005）']
  r.checks = ['PASS', 'FAIL', 'PARTIAL', 'NOT_VERIFIED', 'NOT_APPLICABLE'].map((outcome, i) => ({ key: String(i), title: '检查', outcome, result: '情况一；情况二' }))
  const context = { businessLines: [{ businessLineCode: 'BL000005', businessLineName: '智能柜' }] }
  const html = renderStructuredReport(r, context)
  assert.ok(html.includes('智能柜（BL000005）、BL999999、智能柜（BL000005）'))
  for (const tone of ['success', 'danger', 'warning', 'muted', 'neutral']) assert.ok(html.includes('report-status--' + tone))
  assert.equal((html.match(/1 项/g) || []).length, 5)
  assert.ok(structuredReportDocument(r, css, context).includes(html))
})
test('narrative examples and enumerations become distinct complete items', () => {
  for (const input of ['第一，情况甲；第二，情况乙。', '样例：①慢查询；②通知失败。', '事项：1. 检查甲；2. 检查乙', '事项：（1）甲；（2）乙', '事项：一、甲；二、乙']) {
    const html = reportNarrative(input)
    assert.ok((html.match(/<li>/g) || []).length >= 2, input)
    const plain = html.replace(/<[^>]+>/g, '').replace(/\s/g, '')
    assert.equal(plain, input.replace(/\s/g, ''))
  }
})
test('quoted SQL logs URLs decimals times and bracketed caveats remain intact', () => {
  for (const value of ['SQL：SELECT 1; SELECT 2;', '日志：“失败;重试；仍未完成”', '链接 https://example.test/a;b?x=1.2', '金额 1.25，时间 19:15:06', '系统预警至 2026-11-22 19:15、XXL-JOB 全量', '说明（内部（情况甲）；情况乙）', '说明（线索；不是定论）', '`SELECT 1; SELECT 2;`', '```sql\nSELECT 1;\nSELECT 2;\n```']) {
    assert.ok(!reportNarrative(value).includes('<li>'), value)
  }
})
test('narrative fields throughout report are formatted without executing markup', () => {
  const r = structuredClone(fixture)
  const value = '情况甲；情况乙<script>alert(1)</script>'
  r.conclusion = value; r.scope.window.basis = value; r.scope.included = [value]; r.limitations = [value]
  r.checks[0].result = value; r.findings[0].analysis = value; r.evidence[0].result = value; r.actions[0].acceptanceCriteria = value
  const html = renderStructuredReport(r)
  assert.ok((html.match(/report-points/g) || []).length >= 8)
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
})
