import type { IntakeSummary } from '@/types/work-item'

import { formatDemandRatio } from './dashboardStats'
import type {
  BusinessLineDemandStats,
  DemandGroup,
} from './dashboardStats'

export interface ProjectProgressReportSummary {
  key: string
  label: string
  value: number
  statuses: string[]
}

export interface ProjectProgressReportDemand {
  id: number
  title: string
  businessLine: string
  demandStatus: string
  approvalCode: string
  proposerName: string
  receivedAt: string
}

export interface ProjectProgressReport {
  title: string
  generatedAt: string
  statusNote: string
  businessLineFilterLabel: string
  summary: ProjectProgressReportSummary[]
  businessLineStats: BusinessLineDemandStats[]
  recentDemands: ProjectProgressReportDemand[]
}

interface BuildProjectProgressReportParams {
  generatedAt: Date
  demandGroups: DemandGroup[]
  records: IntakeSummary[]
  businessLineStats: BusinessLineDemandStats[]
  businessLineFilterLabel?: string
}

const REPORT_WIDTH = 1280
const RECENT_DEMAND_LIMIT = 10

export function buildProjectProgressReport(params: BuildProjectProgressReportParams): ProjectProgressReport {
  const reportStatuses = new Set(params.demandGroups.flatMap((group) => group.statuses))
  return {
    title: '项目总体进度报告',
    generatedAt: formatDateTime(params.generatedAt),
    statusNote: '待上线包含待验收和待上线',
    businessLineFilterLabel: params.businessLineFilterLabel || '所有',
    summary: params.demandGroups.map((group) => ({
      key: group.key,
      label: group.label.replace('的需求', ''),
      value: params.records.filter((record) => group.statuses.includes(record.demandStatus)).length,
      statuses: group.statuses,
    })),
    businessLineStats: params.businessLineStats,
    recentDemands: params.records
      .filter((record) => reportStatuses.has(record.demandStatus))
      .sort((left, right) => sortableTime(right) - sortableTime(left))
      .slice(0, RECENT_DEMAND_LIMIT)
      .map((record) => ({
        id: record.id,
        title: resolveDemandTitle(record),
        businessLine: record.businessLine?.trim() || '未填写业务线',
        demandStatus: record.demandStatus || '-',
        approvalCode: record.approvalCode || '-',
        proposerName: record.proposerName || record.senderName || '-',
        receivedAt: formatDisplayTime(record.submittedTime || record.receivedAt),
      })),
  }
}

export function buildProjectProgressReportFileName(date: Date): string {
  const yyyy = String(date.getFullYear())
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  const hh = pad2(date.getHours())
  const mi = pad2(date.getMinutes())
  const ss = pad2(date.getSeconds())
  return `项目总体进度报告_${yyyy}${mm}${dd}_${hh}${mi}${ss}.png`
}

export async function downloadProjectProgressReportScreenshot(report: ProjectProgressReport, fileName: string): Promise<void> {
  const canvas = renderProjectProgressReportCanvas(report)
  const pngBlob = await canvasToBlob(canvas)
  const pngUrl = URL.createObjectURL(pngBlob)
  try {
    const link = document.createElement('a')
    link.href = pngUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(pngUrl)
  }
}

function renderProjectProgressReportCanvas(report: ProjectProgressReport): HTMLCanvasElement {
  const height = calculateReportHeight(report)
  const canvas = document.createElement('canvas')
  canvas.width = REPORT_WIDTH
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前浏览器不支持生成截图')
  }

  const panelX = 40
  const panelY = 40
  const panelWidth = REPORT_WIDTH - 80
  const contentX = 80
  const contentWidth = REPORT_WIDTH - 160
  let cursorY = 40

  context.textBaseline = 'top'
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, REPORT_WIDTH, height)
  drawRoundedRect(context, panelX, panelY, panelWidth, height - 80, 22, '#ffffff', '#e2e8f0')

  const headerGradient = context.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + 112)
  headerGradient.addColorStop(0, '#0f766e')
  headerGradient.addColorStop(1, '#0f172a')
  context.save()
  roundedRectPath(context, panelX, panelY, panelWidth, height - 80, 22)
  context.clip()
  context.fillStyle = headerGradient
  context.fillRect(panelX, panelY, panelWidth, 112)
  context.restore()

  drawText(context, report.title, contentX, 72, 34, 900, '#ffffff')
  drawText(context, `生成时间：${report.generatedAt} · ${report.statusNote}`, contentX, 120, 15, 500, '#ccfbf1')
  cursorY = 184

  drawSummaryCards(context, report.summary, contentX, cursorY, contentWidth)
  cursorY += 180

  drawSectionTitle(context, '业务线进度', `统计范围：${report.businessLineFilterLabel} · 口径：未启动 / 开发中 / 测试中 / 待上线`, contentX, cursorY, contentWidth)
  cursorY += 48
  cursorY = drawBusinessLineTable(context, report.businessLineStats, contentX, cursorY, contentWidth)
  cursorY += 32

  drawSectionTitle(context, '最近推进需求', `最多展示 ${RECENT_DEMAND_LIMIT} 条`, contentX, cursorY, contentWidth)
  cursorY += 48
  drawRecentDemands(context, report.recentDemands, contentX, cursorY, contentWidth)

  return canvas
}

function calculateReportHeight(report: ProjectProgressReport): number {
  const businessLineRows = Math.max(report.businessLineStats.length, 1)
  const demandRows = Math.max(report.recentDemands.length, 1)
  return 40 + 112 + 32 + 180 + 48 + 46 + businessLineRows * 46 + 32 + 48 + demandRows * 74 + 58
}

function drawSummaryCards(context: CanvasRenderingContext2D, summary: ProjectProgressReportSummary[], x: number, y: number, width: number) {
  const gap = 16
  const cardWidth = (width - gap * 3) / 4
  summary.forEach((item, index) => {
    const cardX = x + index * (cardWidth + gap)
    drawRoundedRect(context, cardX, y, cardWidth, 150, 16, '#f8fafc', '#e2e8f0')
    drawText(context, item.label, cardX + 20, y + 20, 15, 800, '#475569')
    drawText(context, String(item.value), cardX + 20, y + 54, 44, 900, '#0f172a')
    setFont(context, 12, 500)
    drawText(context, ellipsizeText(context, item.statuses.join(' / '), cardWidth - 40), cardX + 20, y + 116, 12, 500, '#64748b')
  })
}

function drawSectionTitle(context: CanvasRenderingContext2D, title: string, note: string, x: number, y: number, width: number) {
  drawText(context, title, x, y, 22, 900, '#0f172a')
  drawText(context, note, x + width - 320, y + 7, 13, 500, '#64748b')
}

function drawBusinessLineTable(context: CanvasRenderingContext2D, stats: BusinessLineDemandStats[], x: number, y: number, width: number): number {
  const columns = [260, 104, 104, 104, 104, 104, 104, width - 884]
  const headers = ['业务线', '未启动', '开发中', '测试中', '待上线', '阶段合计', '需求数', '需求占比']
  let cursorX = x
  context.fillStyle = '#f1f5f9'
  context.fillRect(x, y, width, 46)
  headers.forEach((header, index) => {
    strokeCell(context, cursorX, y, columns[index], 46)
    drawText(context, header, cursorX + (index === 0 ? 14 : columns[index] - context.measureText(header).width - 14), y + 14, 13, 900, '#475569')
    cursorX += columns[index]
  })

  const rows = stats.length ? stats : [{
    businessLine: '暂无业务线需求统计',
    notStartedCount: 0,
    developingCount: 0,
    testingCount: 0,
    pendingReleaseCount: 0,
    totalCount: 0,
    demandCount: 0,
    demandRatio: 0,
  }]
  let cursorY = y + 46
  rows.forEach((row) => {
    cursorX = x
    const values = [
      row.businessLine,
      row.notStartedCount,
      row.developingCount,
      row.testingCount,
      row.pendingReleaseCount,
      row.totalCount,
      row.demandCount,
      formatDemandRatio(row.demandRatio),
    ]
    values.forEach((value, index) => {
      strokeCell(context, cursorX, cursorY, columns[index], 46)
      const text = String(value)
      const displayText = index === 0 ? ellipsizeText(context, text, columns[index] - 28) : text
      const textX = index === 0 ? cursorX + 14 : cursorX + columns[index] - context.measureText(displayText).width - 14
      drawText(context, displayText, textX, cursorY + 15, 13, index === 0 ? 700 : 500, index === 0 ? '#0f172a' : '#334155')
      cursorX += columns[index]
    })
    cursorY += 46
  })
  return cursorY
}

function drawRecentDemands(context: CanvasRenderingContext2D, demands: ProjectProgressReportDemand[], x: number, y: number, width: number) {
  if (!demands.length) {
    drawRoundedRect(context, x, y, width, 74, 14, '#ffffff', '#cbd5e1')
    drawText(context, '当前没有待推进的需求', x + width / 2 - 70, y + 28, 14, 600, '#94a3b8')
    return
  }
  let cursorY = y
  demands.forEach((demand) => {
    drawRoundedRect(context, x, cursorY, width, 64, 14, '#ffffff', '#e2e8f0')
    drawText(context, ellipsizeText(context, demand.title, 760), x + 16, cursorY + 12, 15, 900, '#0f172a')
    const statusWidth = Math.max(context.measureText(demand.demandStatus).width + 24, 66)
    drawRoundedRect(context, x + width - statusWidth - 16, cursorY + 11, statusWidth, 24, 12, '#ccfbf1', '#5eead4')
    drawText(context, demand.demandStatus, x + width - statusWidth - 4, cursorY + 16, 12, 800, '#0f766e')
    const meta = `审批编号：${demand.approvalCode} · 提出人：${demand.proposerName} · 业务线：${demand.businessLine} · ${demand.receivedAt}`
    drawText(context, ellipsizeText(context, meta, width - 32), x + 16, cursorY + 40, 12, 500, '#64748b')
    cursorY += 74
  })
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, weight: number, color: string) {
  setFont(context, size, weight)
  context.fillStyle = color
  context.fillText(text, x, y)
}

function setFont(context: CanvasRenderingContext2D, size: number, weight: number) {
  context.font = `${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif`
}

function ellipsizeText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) {
    return text
  }
  let result = text
  while (result.length > 1 && context.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}...`
}

function strokeCell(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.strokeStyle = '#e2e8f0'
  context.lineWidth = 1
  context.strokeRect(x, y, width, height)
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  roundedRectPath(context, x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
  if (stroke) {
    context.strokeStyle = stroke
    context.lineWidth = 1
    context.stroke()
  }
}

function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const normalizedRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + normalizedRadius, y)
  context.lineTo(x + width - normalizedRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + normalizedRadius)
  context.lineTo(x + width, y + height - normalizedRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - normalizedRadius, y + height)
  context.lineTo(x + normalizedRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - normalizedRadius)
  context.lineTo(x, y + normalizedRadius)
  context.quadraticCurveTo(x, y, x + normalizedRadius, y)
  context.closePath()
}

function resolveDemandTitle(record: IntakeSummary): string {
  return record.requirementDigest || record.requirementName || record.approvalCode || '未命名需求'
}

function sortableTime(record: IntakeSummary): number {
  return new Date(record.submittedTime || record.receivedAt).getTime()
}

function formatDisplayTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ')
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('报告截图生成失败'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
