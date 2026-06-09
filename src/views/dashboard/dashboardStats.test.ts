import type { IntakeSummary } from '@/types/work-item'

import {
  buildBusinessLineStats,
  demandGroups,
} from './dashboardStats'

const records = [
  record(1, '资产平台', '已收录', '研发需求'),
  record(2, '资产平台', '开发中', '研发需求'),
  record(3, '资产平台', '待验收', '数据提取/运维'),
  record(4, '资金平台', '测试中', '研发需求'),
  record(5, '资金平台', '待上线', '数据提取/运维'),
  record(6, '', '待上线', '数据提取/运维'),
  record(7, '资产平台', '已完成', '研发需求'),
]

const pendingRelease = demandGroups.find((group) => group.key === 'pending-release')
assert(pendingRelease !== undefined, '待上线分组应该存在')
assert(pendingRelease.statuses.includes('待验收'), '待上线统计应该包含待验收')
assert(!demandGroups.find((group) => group.key === 'testing')?.statuses.includes('待验收'), '测试中统计不应再包含待验收')

const stats = buildBusinessLineStats(records)

assert(stats.length === 3, `应该按业务线汇总 3 行，实际 ${stats.length}`)
assert(stats[0].businessLine === '资产平台', '业务线统计应按总量降序排列')
assert(stats[0].notStartedCount === 1, '未启动应该包含已收录')
assert(stats[0].developingCount === 1, '开发中应该只包含开发中')
assert(stats[0].testingCount === 0, '待验收不应该计入测试中')
assert(stats[0].pendingReleaseCount === 1, '待验收应该计入待上线')
assert(stats[0].totalCount === 3, '阶段合计应该只包含工作台四类进度')
assert(stats[0].demandCount === 4, '需求数应该包含该业务线所有需求')
assert(stats[0].demandRatio === 4 / 7, '需求占比应该等于业务线需求数除以总需求数')
assert(stats[1].businessLine === '资金平台', '第二行业务线应为资金平台')
assert(stats[1].testingCount === 1, '测试中应该包含测试中')
assert(stats[1].pendingReleaseCount === 1, '待上线应该包含待上线')
assert(stats[2].businessLine === '未填写业务线', '空业务线应该归入未填写业务线')
assert(stats[2].pendingReleaseCount === 1, '空业务线待上线应该正确计数')

const developmentStats = buildBusinessLineStats(records, 'DEVELOPMENT')
assert(developmentStats.length === 2, '研发需求筛选应只统计研发需求业务线')
assert(developmentStats[0].businessLine === '资产平台', '研发需求应按需求数排序')
assert(developmentStats[0].demandCount === 3, '研发需求数应包含已完成研发需求')
assert(developmentStats[0].demandRatio === 3 / 4, '研发需求占比应使用研发需求总数作分母')

const operationsStats = buildBusinessLineStats(records, 'OPERATIONS')
assert(operationsStats.length === 3, '数据运维筛选应只统计数据提取/运维需求')
assert(operationsStats.every((item) => item.demandCount === 1), '数据运维需求数应该按业务线分别统计')
assert(operationsStats.reduce((sum, item) => sum + item.demandRatio, 0) === 1, '数据运维需求占比合计应为 100%')

function record(id: number, businessLine: string, demandStatus: string, requirementType: string): IntakeSummary {
  return {
    id,
    sourceType: 'UPLOAD',
    sourceChannel: '人工录入',
    senderName: '张三',
    developmentOwnerUserName: null,
    receivedAt: '2026-06-04T10:00:00',
    demandStatus,
    proposerName: null,
    approvalCode: null,
    submittedTime: null,
    requirementType,
    developmentBranchName: null,
    zentaoUrl: null,
    requirementDigest: null,
    department: null,
    requirementName: null,
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
