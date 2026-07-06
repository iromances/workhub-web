import type { ProjectProgressReport, ProjectProgressReportDemand, ProjectProgressReportReleasedDemand, ProjectProgressReportSummary } from '@/types/work-item'

export interface ReportDemandStatusTheme {
  color: string
  background: string
  border: string
}

const REPORT_WIDTH = 1280

const statusThemes: Record<string, ReportDemandStatusTheme> = {
  已收录: { color: '#35566d', background: '#eaf4fb', border: '#bfd8eb' },
  待澄清: { color: '#7c3aed', background: '#f3ecff', border: '#d8c2ff' },
  待处理: { color: '#8a4b00', background: '#fff6df', border: '#f2d28a' },
  处理中: { color: '#0f766e', background: '#e2f8f2', border: '#aee5d6' },
  待评估: { color: '#9a5b00', background: '#fff3dc', border: '#f3d18f' },
  待排期: { color: '#0f4db8', background: '#e8f0ff', border: '#bed2ff' },
  待设计: { color: '#5e3ab3', background: '#f1eafe', border: '#d7c6fb' },
  开发中: { color: '#0f4db8', background: '#e8f0ff', border: '#bed2ff' },
  测试中: { color: '#0f766e', background: '#ddf9f2', border: '#ace9db' },
  待验收: { color: '#b45309', background: '#fff1e4', border: '#f5cda5' },
  待上线: { color: '#a61b58', background: '#fde7f1', border: '#f3bfd4' },
}

const defaultStatusTheme: ReportDemandStatusTheme = {
  color: '#516071',
  background: '#eef2f6',
  border: '#d7dee6',
}

export function resolveReportDemandStatusTheme(status: string | null | undefined): ReportDemandStatusTheme {
  return statusThemes[status || ''] || defaultStatusTheme
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

  drawSectionTitle(context, '本周上线需求', `按实际上线日期统计，共 ${report.weeklyReleasedDemands.length} 条`, contentX, cursorY, contentWidth)
  cursorY += 48
  drawWeeklyReleasedDemands(context, report.weeklyReleasedDemands, contentX, cursorY, contentWidth)
  cursorY += Math.max(report.weeklyReleasedDemands.length, 1) * 78 + 32

  drawSectionTitle(context, '未上线需求', `展示全部未上线需求，共 ${report.pendingReleaseDemands.length} 条`, contentX, cursorY, contentWidth)
  cursorY += 48
  drawPendingReleaseDemands(context, report.pendingReleaseDemands, contentX, cursorY, contentWidth)

  return canvas
}

function calculateReportHeight(report: ProjectProgressReport): number {
  const releasedRows = Math.max(report.weeklyReleasedDemands.length, 1)
  const demandRows = Math.max(report.pendingReleaseDemands.length, 1)
  return 40 + 112 + 32 + 180 + 48 + releasedRows * 78 + 32 + 48 + demandRows * 78 + 58
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

function drawPendingReleaseDemands(context: CanvasRenderingContext2D, demands: ProjectProgressReportDemand[], x: number, y: number, width: number) {
  if (!demands.length) {
    drawRoundedRect(context, x, y, width, 74, 14, '#ffffff', '#cbd5e1')
    drawText(context, '当前没有未上线需求', x + width / 2 - 63, y + 28, 14, 600, '#94a3b8')
    return
  }
  let cursorY = y
  demands.forEach((demand) => {
    const theme = resolveReportDemandStatusTheme(demand.demandStatus)
    const statusWidth = Math.max(context.measureText(demand.demandStatus).width + 24, 66)
    drawRoundedRect(context, x, cursorY, width, 68, 14, '#ffffff', '#e2e8f0')
    drawCircle(context, x + 22, cursorY + 22, 6, theme.color)
    drawText(context, ellipsizeText(context, demand.title, width - statusWidth - 92), x + 38, cursorY + 13, 15, 900, '#0f172a')
    drawRoundedRect(context, x + width - statusWidth - 16, cursorY + 11, statusWidth, 26, 13, theme.background, theme.border)
    drawText(context, demand.demandStatus, x + width - statusWidth - 4, cursorY + 17, 12, 800, theme.color)
    const meta = `审批编号：${demand.approvalCode} · 提出人：${demand.proposerName} · 业务线：${demand.businessLine} · ${demand.receivedAt}`
    drawText(context, ellipsizeText(context, meta, width - 38), x + 38, cursorY + 43, 12, 500, '#64748b')
    cursorY += 78
  })
}

function drawWeeklyReleasedDemands(context: CanvasRenderingContext2D, demands: ProjectProgressReportReleasedDemand[], x: number, y: number, width: number) {
  if (!demands.length) {
    drawRoundedRect(context, x, y, width, 74, 14, '#ffffff', '#cbd5e1')
    drawText(context, '本周没有已上线需求', x + width / 2 - 63, y + 28, 14, 600, '#94a3b8')
    return
  }
  let cursorY = y
  demands.forEach((demand) => {
    const theme = resolveReportDemandStatusTheme(demand.demandStatus)
    const statusWidth = Math.max(context.measureText(demand.demandStatus).width + 24, 66)
    drawRoundedRect(context, x, cursorY, width, 68, 14, '#ffffff', '#e2e8f0')
    drawCircle(context, x + 22, cursorY + 22, 6, '#16a34a')
    drawText(context, ellipsizeText(context, demand.title, width - statusWidth - 92), x + 38, cursorY + 13, 15, 900, '#0f172a')
    drawRoundedRect(context, x + width - statusWidth - 16, cursorY + 11, statusWidth, 26, 13, theme.background, theme.border)
    drawText(context, demand.demandStatus, x + width - statusWidth - 4, cursorY + 17, 12, 800, theme.color)
    const meta = `审批编号：${demand.approvalCode} · 提出人：${demand.proposerName} · 业务线：${demand.businessLine} · 上线日期：${demand.releasedTime}`
    drawText(context, ellipsizeText(context, meta, width - 38), x + 38, cursorY + 43, 12, 500, '#64748b')
    cursorY += 78
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

function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = fill
  context.fill()
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
