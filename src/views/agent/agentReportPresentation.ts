import reportStyles from './agentReport.css?raw'

/** Report text remains authoritative. These helpers only format and excerpt it. */
export interface ReportMetric { label: string; value: string; context: string }
export interface ReportOverview { summary: string; summaryLabel: string; metrics: ReportMetric[] }

export function escapeReportHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function inline(text: string, depth = 0): string {
  if (depth > 4) return escapeReportHtml(text)
  // Raw HTML is never passed through; only these tokens can produce markup.
  const tokens = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*/g
  let html = '', offset = 0
  for (const match of text.matchAll(tokens)) {
    html += escapeReportHtml(text.slice(offset, match.index))
    if (match[1] !== undefined) html += `<code>${escapeReportHtml(match[1])}</code>`
    else if (match[2] !== undefined) {
      const href = match[3]!
      const safe = /^(?:https?:\/\/|#[\w-]+)/i.test(href)
      html += safe ? `<a href="${escapeReportHtml(href)}" target="_blank" rel="noopener noreferrer">${inline(match[2], depth + 1)}</a>` : escapeReportHtml(match[0])
    } else if (match[4] !== undefined || match[5] !== undefined) html += `<strong>${inline(match[4] ?? match[5]!, depth + 1)}</strong>`
    else html += `<em>${inline(match[6]!, depth + 1)}</em>`
    offset = match.index! + match[0].length
  }
  return html + escapeReportHtml(text.slice(offset))
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))
}
function tableDivider(line: string): boolean {
  return line.includes('|') && cells(line).every(cell => /^:?-{3,}:?$/.test(cell))
}
function heading(line: string): { level: number; text: string } | null {
  const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/)
  return match ? { level: match[1]!.length, text: match[2]! } : null
}
function plain(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()
}

/** Older agents also emit Chinese numbered sections in a single plain-text paragraph. */
export function normalizeAgentReport(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let fence: string | null = null
  return lines.map(line => {
    if (fence) {
      if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null
      return line
    }
    const opening = line.match(/^\s*(`{3,}|~{3,})/)
    if (opening) { fence = opening[1]!; return line }
    if (line.includes('|')) return line
    const summary = line.match(/^\s*(?:#{1,6}\s+|[-+*■●•▪]\s+)?(总体结论|本轮结论|结论|执行摘要|摘要|总结|summary|conclusion)[：:]\s*(.+)$/i)
    if (summary) return `## ${summary[1]}\n\n${summary[2]}`
    if (heading(line)) return line
    // A numbered section inside a bullet is still a section, not an empty bullet.
    return line.replace(/^\s*[-+*■●•▪]\s+(?=[一二三四五六七八九十]+、)/, '')
      .replace(/(^|\s)([一二三四五六七八九十]+、[^：:\n。]{2,120})[：:]/g, '\n\n## $2\n\n')
      .replace(/(?:^|\s)【(总体结论|本轮结论|结论|摘要|需人工处理|批次与范围|计数|高水位与未完成边界|实际 SQL 审计入口|重点三项逐项核实|其他非 PASS|交付物)】/g, '\n\n## $1\n\n')
  }).join('\n')
}

export function renderAgentReport(text: string): string {
  const lines = normalizeAgentReport(text).split('\n')
  const output: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) { i++; continue }
    const fence = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      const code: string[] = []
      const closing = new RegExp(`^\\s*${fence[1]![0]}{${fence[1]!.length},}\\s*$`)
      i++
      while (i < lines.length && !closing.test(lines[i]!)) code.push(lines[i++]!)
      if (i < lines.length) i++
      output.push(`<pre><code>${escapeReportHtml(code.join('\n'))}</code></pre>`)
      continue
    }
    const title = heading(line)
    if (title) { output.push(`<h${title.level}>${inline(title.text)}</h${title.level}>`); i++; continue }
    if (i + 1 < lines.length && line.includes('|') && tableDivider(lines[i + 1]!)) {
      const headers = cells(line)
      i += 2
      const rows: string[] = []
      while (i < lines.length && lines[i]!.trim() && lines[i]!.includes('|')) {
        const row = cells(lines[i++]!)
        rows.push(`<tr>${headers.map((_, index) => `<td>${inline(row[index] ?? '')}</td>`).join('')}</tr>`)
      }
      output.push(`<div class="report-table"><table><thead><tr>${headers.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`)
      continue
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { output.push('<hr>'); i++; continue }
    const list = line.match(/^\s*(?:([-+*])|\d+[.)])\s+(.+)/)
    if (list) {
      const ordered = !list[1], tag = ordered ? 'ol' : 'ul', items: string[] = []
      const matcher = ordered ? /^\s*\d+[.)]\s+(.+)/ : /^\s*[-+*]\s+(.+)/
      while (i < lines.length) {
        const item = lines[i]!.match(matcher)
        if (!item) break
        items.push(`<li>${inline(item[1]!)}</li>`); i++
      }
      const start = ordered ? ` start="${Number(line.trim().match(/^\d+/)?.[0]) || 1}"` : ''
      output.push(`<${tag}${start}>${items.join('')}</${tag}>`)
      continue
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i]!)) quote.push(inline(lines[i++]!.replace(/^\s*>\s?/, '')))
      output.push(`<blockquote>${quote.join('<br>')}</blockquote>`); continue
    }
    const paragraph = [inline(line)]
    i++
    while (i < lines.length && lines[i]!.trim() && !heading(lines[i]!) && !/^\s*(?:[-+*]\s|\d+[.)]\s|>|`{3,}|~{3,}|-{3,}$|\*{3,}$|_{3,}$)/.test(lines[i]!) && !(lines[i]!.includes('|') && tableDivider(lines[i + 1] ?? ''))) paragraph.push(inline(lines[i++]!))
    output.push(`<p>${paragraph.join('<br>')}</p>`)
  }
  return output.join('\n')
}

export function agentReportOverview(text: string): ReportOverview {
  // Do not extract apparent headings or numbers from code examples.
  const lines: string[] = []
  let fence: string | null = null
  for (const line of normalizeAgentReport(text).split('\n')) {
    if (fence) {
      if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null
      continue
    }
    const opening = line.match(/^\s*(`{3,}|~{3,})/)
    if (opening) { fence = opening[1]!; continue }
    lines.push(line)
  }
  const summaryAt = lines.findIndex(line => /^(?:总体结论|本轮结论|结论|执行摘要|摘要|总结|summary|conclusion)$/i.test(plain(heading(line)?.text ?? line).replace(/[：:]$/, '')))
  let summary = '', summaryLabel = '报告摘录'
  if (summaryAt >= 0) {
    const level = heading(lines[summaryAt]!)?.level ?? 6
    const body: string[] = []
    for (const line of lines.slice(summaryAt + 1)) {
      const next = heading(line)
      if (next && next.level <= level) break
      body.push(line)
    }
    summary = body.join('\n').trim()
    if (summary) summaryLabel = '本轮结论'
  }
  if (!summary) {
    const first = lines.findIndex(line => line.trim() && !heading(line) && !tableDivider(line))
    if (first >= 0) {
      const body: string[] = []
      for (const line of lines.slice(first)) {
        if (!line.trim() || heading(line)) break
        body.push(line)
      }
      summary = body.join('\n')
      if (summary.length > 360) summary = summary.slice(0, 360) + '…'
    }
  }
  const metrics: ReportMetric[] = []
  let section = ''
  for (let i = 0; i < lines.length && metrics.length < 6; i++) {
    const title = heading(lines[i]!)
    if (title) {
      section = plain(title.text)
      // Excerpt a complete, explicitly labelled value; never calculate or infer it.
      const pair = section.replace(/^[一二三四五六七八九十\d]+[、.)．]\s*/, '').match(/^(.{2,48}?)[：:]\s*(.{1,140})$/)
      if (pair && /\d/.test(pair[2]!) && !/https?:|\d{1,2}:\d{2}/.test(pair[2]!)) metrics.push({ label: pair[1]!, value: pair[2]!, context: '报告章节标题原文' })
      // A numbered section may explicitly state its measure in the first sentence.
      if (!pair && /^[一二三四五六七八九十\d]+[、.)．]/.test(section)) {
        const firstLine = lines.slice(i + 1).find(line => line.trim()) ?? ''
        const firstSentence = plain(firstLine).match(/^[^。\n]+[。]?/)?.[0] ?? ''
        if (!heading(firstLine) && firstSentence.length <= 180 && /\d+\s*(?:条|次|项|个|笔|元|%|ms|秒|毫秒|用例)|未运行|未配置|未验证/.test(firstSentence)) {
          metrics.push({ label: section.replace(/^[一二三四五六七八九十\d]+[、.)．]\s*/, ''), value: firstSentence, context: '报告章节首句原文；完整统计口径见下文' })
        }
      }
    }
    if (!lines[i]!.includes('|') || !tableDivider(lines[i + 1] ?? '')) continue
    const headers = cells(lines[i]!).map(plain)
    const labelAt = headers.findIndex(cell => /^(指标|指标名称|关键指标|metric)$/i.test(cell))
    const valueAt = headers.findIndex(cell => /^(数值|值|结果|本轮|本轮结果|当前值|value)$/i.test(cell))
    if (labelAt < 0 || valueAt < 0) continue
    i += 2
    while (i < lines.length && lines[i]!.includes('|') && metrics.length < 6) {
      const row = cells(lines[i]!).map(plain)
      if (row[labelAt] && row[valueAt]) metrics.push({ label: row[labelAt]!, value: row[valueAt]!, context: [section, ...row.map((value, index) => index !== labelAt && index !== valueAt && value ? `${headers[index] ?? '备注'}：${value}` : '')].filter(Boolean).join(' · ') || '报告指标表原文' })
      i++
    }
    i--
  }
  return { summary, summaryLabel, metrics }
}

export function selectReportRun<T extends { id: string; status: string }>(runs: T[], selectedId: string): string {
  if (runs.some(run => run.id === selectedId)) return selectedId
  return (runs.find(run => run.status === 'COMPLETED') ?? runs[0])?.id ?? ''
}

export const agentReportStyles = reportStyles

export function renderReportOverview(overview: ReportOverview, formal = false): string {
  const summary = overview.summary ? `<section class="report-overview"><div class="report-eyebrow">${escapeReportHtml(overview.summaryLabel)}</div><div class="agent-report">${renderAgentReport(overview.summary)}</div></section>` : ''
  const metrics = overview.metrics.length ? `<div class="report-section-label">关键指标 <span class="report-note">${formal ? '正式核对批次的规则结果' : '报告原文摘录，最多 6 项'}</span></div><div class="report-metrics">${overview.metrics.map(metric => `<section class="report-metric"><div class="report-metric-label">${escapeReportHtml(metric.label)}</div><div class="report-metric-value">${escapeReportHtml(metric.value)}</div><div class="report-metric-context">${escapeReportHtml(metric.context)}</div></section>`).join('')}</div>` : '<p class="report-note">报告未单列可识别的关键指标，请以完整报告中的数值和统计口径为准。</p>'
  return summary + metrics
}

export function buildAgentReportDocument(title: string, text: string, metadata: string[], formalOverview?: ReportOverview): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeReportHtml(title)}</title><style>body{margin:0;background:#f3f6f7;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}main{max-width:1080px;margin:32px auto;padding:36px;background:#fff;border-radius:14px}header{border-bottom:1px solid #e2e8ec;padding-bottom:20px;margin-bottom:24px}header h1{font-size:22px;color:#203e46}.meta{color:#637582;font-size:12px;line-height:1.8}@media(max-width:640px){main{margin:0;padding:20px;border-radius:0}}@media print{body{background:white}main{margin:0;padding:0}}${agentReportStyles}</style></head><body><main><header><h1>${escapeReportHtml(title)}</h1><div class="meta">${metadata.map(escapeReportHtml).join('<br>')}</div></header>${renderReportOverview(formalOverview || agentReportOverview(text), Boolean(formalOverview))}<article class="agent-report">${renderAgentReport(text)}</article></main></body></html>`
}
