import type { IntakeSummary } from '@/types/work-item'

import { buildBusinessLineStats, demandGroups } from './dashboardStats'
import {
  buildProjectProgressReport,
  buildProjectProgressReportFileName,
} from './dashboardReport'

const records = [
  record(1, '供应链科技', '已收录', '渠道上线', '2026-06-04T10:00:00'),
  record(2, '供应链科技', '开发中', '风控规则调整', '2026-06-03T10:00:00'),
  record(3, '供应链科技', '待验收', '支付对账', '2026-06-02T10:00:00'),
  record(4, '数智金融', '测试中', '账单规则统一', '2026-06-01T10:00:00'),
  record(5, '数智金融', '待上线', '资金归集', '2026-05-31T10:00:00'),
  record(6, '数智金融', '已完成', '历史已完成需求', '2026-06-04T11:00:00'),
]

const report = buildProjectProgressReport({
  generatedAt: new Date('2026-06-04T12:30:00'),
  demandGroups,
  records,
  businessLineStats: buildBusinessLineStats(records, 'DEVELOPMENT'),
  businessLineFilterLabel: '研发需求',
})

assert(report.title === '项目总体进度报告', '报告标题应固定')
assert(report.generatedAt === '2026-06-04 12:30:00', '报告应格式化生成时间')
assert(report.summary.length === 4, '报告应包含四个总体阶段统计')
assert(report.summary[0].value === 1, '未启动总数应正确')
assert(report.summary[2].value === 1, '测试中总数不应包含待验收')
assert(report.summary[3].value === 2, '待上线总数应包含待验收和待上线')
assert(report.businessLineFilterLabel === '研发需求', '报告应记录业务线统计筛选范围')
assert(report.businessLineStats.length === 2, '报告应包含业务线统计')
assert(report.businessLineStats.find((item) => item.businessLine === '供应链科技')?.demandCount === 3, '报告业务线统计应使用传入的筛选后需求数')
assert(report.recentDemands.length === 5, '最近推进需求不应包含已完成需求')
assert(report.recentDemands[0].title === '渠道上线', '最近需求应按时间倒序')
assert(report.statusNote === '待上线包含待验收和待上线', '报告应声明待上线口径')

const fileName = buildProjectProgressReportFileName(new Date('2026-06-04T12:30:00'))
assert(fileName === '项目总体进度报告_20260604_123000.png', '报告文件名应包含生成时间')

function record(id: number, businessLine: string, demandStatus: string, title: string, receivedAt: string): IntakeSummary {
  return {
    id,
    sourceType: 'UPLOAD',
    sourceChannel: '人工录入',
    senderName: '张三',
    developmentOwnerUserName: null,
    receivedAt,
    demandStatus,
    proposerName: '李四',
    approvalCode: `SP${id}`,
    submittedTime: null,
    requirementType: '研发需求',
    developmentBranchName: null,
    zentaoUrl: null,
    requirementDigest: title,
    department: null,
    requirementName: title,
    requirementSummary: null,
    businessLine,
    remark: null,
    totalEstimatedEffort: null,
    developmentEstimatedEffort: null,
    testingEstimatedEffort: null,
    plannedDueDate: null,
    plannedDevelopmentStartDate: null,
    plannedTestingStartDate: null,
    plannedReleaseDate: null,
    developmentStartedDate: null,
    actualEffort: null,
    testingStartedDate: null,
    actualCompletedTime: null,
    scheduledAcceptanceDate: null,
    actualTestingEffort: null,
    actualTestingCompletedDate: null,
    acceptanceTime: null,
    releasedTime: null,
    projectHint: null,
    involvedSystems: [],
    enrichmentStatus: null,
    status: 'CONFIRMED',
    convertedWorkItemId: null,
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}
