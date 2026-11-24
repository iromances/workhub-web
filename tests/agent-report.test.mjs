import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const sourceUrl = new URL('../src/views/agent/agentReportPresentation.ts', import.meta.url)
const css = readFileSync(new URL('../src/views/agent/agentReport.css', import.meta.url), 'utf8')
const source = readFileSync(sourceUrl, 'utf8').replace("import reportStyles from './agentReport.css?raw'", `const reportStyles = ${JSON.stringify(css)}`)
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { renderAgentReport, agentReportOverview, buildAgentReportDocument, selectReportRun } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('formats report headings, emphasis, lists, tables, quotes and code without losing text', () => {
  const html = renderAgentReport('# 报告\n\n## 结论\n**需关注**\n\n- 第一项\n- 第二项\n\n3. 第三项\n\n| 指标 | 值 |\n| --- | --- |\n| 次数 | 0 |\n\n> 待核实\n\n```sql\nselect a < 2;\n```')
  for (const expected of ['<h1>报告</h1>', '<h2>结论</h2>', '<strong>需关注</strong>', '<li>第一项</li>', '<ol start="3">', '<th scope="col">指标</th>', '<td>0</td>', '<blockquote>待核实</blockquote>', 'select a &lt; 2;']) assert.ok(html.includes(expected), expected)
})

test('escapes raw HTML and attributes and blocks executable and local links', () => {
  const html = renderAgentReport('<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n[x](javascript:alert) [x](data:text/html,evil) [x](file:///etc/passwd) [safe](https://example.com/"onmouseover="evil)')
  assert.ok(!/<(?:img|script)\b/.test(html))
  assert.ok(!/href="(?:javascript:|data:|file:)/.test(html))
  assert.ok(html.includes('href="https://example.com/&quot;onmouseover=&quot;evil"'))
  assert.ok(html.includes('rel="noopener noreferrer"'))
})

test('does not parse markdown inside a fence; an unclosed fence remains code', () => {
  const report = '~~~\n## 总体结论\n正常\n## 指标：999\n'
  assert.equal(agentReportOverview(report).summary, '')
  assert.equal(agentReportOverview(report).metrics.length, 0)
  assert.ok(renderAgentReport(report).includes('<pre><code>## 总体结论'))
})

test('extracts the complete explicit conclusion without rewriting contradictory business evidence', () => {
  const overview = agentReportOverview('# 叉车\n\n时间窗口：10:26—11:26\n\n## 总体结论\n任务已完成，账务未运行。\n\n仍有 23 条差异。\n\n## 系统预警：窗口内 0 条新增\n详情')
  assert.equal(overview.summaryLabel, '本轮结论')
  assert.equal(overview.summary, '任务已完成，账务未运行。\n\n仍有 23 条差异。')
  assert.deepEqual(overview.metrics, [{ label: '系统预警', value: '窗口内 0 条新增', context: '报告章节标题原文' }])
})

test('works for other employees and preserves units, window and unavailable values', () => {
  const overview = agentReportOverview('## 摘要\n研发自测完成。\n\n## 关键指标\n| 指标 | 本轮结果 | 单位 | 口径 |\n| --- | --- | --- | --- |\n| 通过用例 | 28 | 项 | 本次自测 |\n| 线上效果 | 未验证 | — | 待部署 |')
  assert.equal(overview.metrics[0].label, '通过用例')
  assert.equal(overview.metrics[0].value, '28')
  assert.match(overview.metrics[0].context, /单位：项/)
  assert.match(overview.metrics[0].context, /口径：本次自测/)
  assert.equal(overview.metrics[1].value, '未验证')
})

test('does not infer metrics or a healthy status from arbitrary prose or dates', () => {
  const overview = agentReportOverview('已完成。23 条历史差异，金额 23000 元。\n\n## 时间：2026-11-19 11:26\n未知')
  assert.equal(overview.summaryLabel, '报告摘录')
  assert.equal(overview.metrics.length, 0)
  assert.match(overview.summary, /历史差异/)
  assert.equal(agentReportOverview('').summary, '')
})

test('older single-paragraph reports gain sections and explicit measure excerpts without changing identifiers', () => {
  const text = '巡检窗口说明。 一、系统预警：窗口内新增0条（ops_system_alert_event）；两源一致。 二、账务监测：未配置任何场景，无法判断差异。 【需人工处理】请核实配置。'
  const html = renderAgentReport(text)
  assert.ok(html.includes('<h2>一、系统预警</h2>'))
  assert.ok(html.includes('ops_system_alert_event'))
  const overview = agentReportOverview(text)
  assert.equal(overview.summary, '巡检窗口说明。')
  assert.equal(overview.metrics.length, 2)
  assert.equal(overview.metrics[1].value, '未配置任何场景，无法判断差异。')
})

test('unstructured report excerpt is bounded and the complete report remains available', () => {
  const text = '文'.repeat(1000)
  assert.equal(agentReportOverview(text).summary.length, 361)
  assert.ok(renderAgentReport(text).includes(text))
})

test('cabinet bullet report promotes inline conclusion and long numbered section labels', () => {
  const report = '【智能柜巡检报告】窗口说明。\n\n■ 总体结论：窗口内持续慢 SQL；账务未覆盖，需人工决策。\n\n■ 一、系统预警（workhub.ops_system_alert_event，按 created_at 增量）：共70条新预警，全部 ERROR 级。\n\n1. SLOW_SQL 64 条。'
  const overview = agentReportOverview(report)
  assert.equal(overview.summaryLabel, '本轮结论')
  assert.equal(overview.summary, '窗口内持续慢 SQL；账务未覆盖，需人工决策。')
  assert.equal(overview.metrics.length, 1)
  assert.equal(overview.metrics[0].value, '共70条新预警，全部 ERROR 级。')
  const html = renderAgentReport(report)
  assert.ok(html.includes('<h2>总体结论</h2>'))
  assert.ok(!html.includes('<li></li>'))
  assert.ok(!html.includes('<p>■</p>'))
  assert.equal(agentReportOverview(report.replace(/■/g, '-')).summary, overview.summary)
  assert.ok(html.includes('SLOW_SQL 64 条。'))
})

test('export shares overview and body rendering and escapes report metadata', () => {
  const text = '## 结论\n**待核实**\n\n## 指标：未运行 1 次'
  const exported = buildAgentReportDocument('<script>x</script>', text, ['<img src=x>'])
  assert.ok(exported.includes(renderAgentReport(text)))
  assert.ok(exported.includes('本轮结论'))
  assert.ok(exported.includes('关键指标'))
  assert.ok(exported.includes(css.trim()))
  assert.ok(!exported.includes('<script>'))
  assert.ok(!exported.includes('<img'))
})

test('history prefers a completed run initially and preserves explicit running selections', () => {
  const runs = [{ id: 'new', status: 'RUNNING' }, { id: 'report', status: 'COMPLETED' }, { id: 'old', status: 'COMPLETED' }]
  assert.equal(selectReportRun(runs, ''), 'report')
  assert.equal(selectReportRun(runs, 'new'), 'new')
  assert.equal(selectReportRun(runs, 'old'), 'old')
  assert.equal(selectReportRun([{ id: 'failed', status: 'FAILED' }], ''), 'failed')
  assert.equal(selectReportRun([], ''), '')
})

const monitorSource = readFileSync(new URL('../src/views/agent/agentMonitorEvidence.ts', import.meta.url), 'utf8')
const monitorCompiled = ts.transpileModule(monitorSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { monitorEvidence, monitorOverview } = await import(`data:text/javascript;base64,${Buffer.from(monitorCompiled).toString('base64')}`)

test('formal metrics keep failed and skipped rules distinct and never add amounts', () => {
  const event = { kind: 'BUSINESS_MONITOR_RESULT', payloadJson: JSON.stringify({ monitorRunId: 4, run: { runNo: 'AS4', status: 'PARTIAL' }, rules: [
    { ruleCode: 'a', status: 'ERROR', differenceAmount: 150000 },
    { ruleCode: 'b', status: 'FAILED', differenceAmount: 4500000 },
    { ruleCode: 'c', status: 'SKIPPED', differenceAmount: 0 },
  ] }) }
  const evidence = monitorEvidence([event, event, { ...event, kind: 'CLI_RESULT' }])
  assert.equal(evidence.length, 1)
  const overview = monitorOverview(evidence)
  assert.equal(overview.metrics.find(x => x.label === '核验规则').value, '3')
  assert.equal(overview.metrics.find(x => x.label === '正常').value, '0')
  assert.equal(overview.metrics.find(x => x.label === '执行失败').value, '1')
  assert.equal(overview.metrics.find(x => x.label === '无样本或跳过').value, '1')
  const html = buildAgentReportDocument('报告', '历史原文保留', [], overview)
  assert.ok(html.includes('正式核对批次的规则结果'))
  assert.ok(html.includes('历史原文保留'))
  assert.ok(!html.includes('4650000'))
})

test('missing or malformed monitor evidence never means a clean run', () => {
  assert.equal(monitorOverview(monitorEvidence([{ kind: 'BUSINESS_MONITOR_RESULT', payloadJson: 'bad json' }])), undefined)
})

test('current monitor report sections become headings without changing content', () => {
  const html = renderAgentReport('【批次与范围】全量\n\n【计数】67 条规则\n\n【实际 SQL 审计入口】批次4')
  assert.ok(html.includes('<h2>批次与范围</h2>'))
  assert.ok(html.includes('<h2>计数</h2>'))
  assert.ok(html.includes('67 条规则'))
})
