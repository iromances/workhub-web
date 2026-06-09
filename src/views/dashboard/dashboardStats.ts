import type { IntakeSummary } from '@/types/work-item'

export type DemandTypeFilter = 'ALL' | 'DEVELOPMENT' | 'OPERATIONS'

export interface DemandGroup {
  key: string
  label: string
  statuses: string[]
  note: string
  className: string
  tagClass: string
}

export interface DemandTypeFilterOption {
  value: DemandTypeFilter
  label: string
}

export interface BusinessLineDemandStats {
  businessLine: string
  notStartedCount: number
  developingCount: number
  testingCount: number
  pendingReleaseCount: number
  totalCount: number
  demandCount: number
  demandRatio: number
}

export const businessLineDemandTypeOptions: DemandTypeFilterOption[] = [
  { value: 'ALL', label: '所有' },
  { value: 'DEVELOPMENT', label: '研发需求' },
  { value: 'OPERATIONS', label: '数据运维需求' },
]

export const demandGroups: DemandGroup[] = [
  {
    key: 'not-started',
    label: '未启动的需求',
    statuses: ['已收录', '待澄清', '待评估', '待排期', '待设计'],
    note: '已进入需求台账，但还未开始研发或执行',
    className: 'metric-card--idle',
    tagClass: 'stage-tag--idle',
  },
  {
    key: 'developing',
    label: '开发中的需求',
    statuses: ['开发中'],
    note: '已指定研发人员或执行人，正在推进实现',
    className: 'metric-card--developing',
    tagClass: 'stage-tag--developing',
  },
  {
    key: 'testing',
    label: '测试中的需求',
    statuses: ['测试中'],
    note: '已进入测试验证',
    className: 'metric-card--testing',
    tagClass: 'stage-tag--testing',
  },
  {
    key: 'pending-release',
    label: '待上线的需求',
    statuses: ['待验收', '待上线'],
    note: '等待业务验收或上线发布闭环',
    className: 'metric-card--release',
    tagClass: 'stage-tag--release',
  },
]

const notStartedStatuses = new Set(demandGroups.find((group) => group.key === 'not-started')?.statuses ?? [])
const developingStatuses = new Set(demandGroups.find((group) => group.key === 'developing')?.statuses ?? [])
const testingStatuses = new Set(demandGroups.find((group) => group.key === 'testing')?.statuses ?? [])
const pendingReleaseStatuses = new Set(demandGroups.find((group) => group.key === 'pending-release')?.statuses ?? [])

export function buildBusinessLineStats(records: IntakeSummary[], demandType: DemandTypeFilter = 'ALL'): BusinessLineDemandStats[] {
  const filteredRecords = filterRecordsByDemandType(records, demandType)
  const totalDemandCount = filteredRecords.length
  const statsByBusinessLine = new Map<string, BusinessLineDemandStats>()

  for (const record of filteredRecords) {
    const businessLine = record.businessLine?.trim() || '未填写业务线'
    const stats = statsByBusinessLine.get(businessLine) ?? {
      businessLine,
      notStartedCount: 0,
      developingCount: 0,
      testingCount: 0,
      pendingReleaseCount: 0,
      totalCount: 0,
      demandCount: 0,
      demandRatio: 0,
    }

    stats.demandCount += 1

    if (notStartedStatuses.has(record.demandStatus)) {
      stats.notStartedCount += 1
      stats.totalCount += 1
    } else if (developingStatuses.has(record.demandStatus)) {
      stats.developingCount += 1
      stats.totalCount += 1
    } else if (testingStatuses.has(record.demandStatus)) {
      stats.testingCount += 1
      stats.totalCount += 1
    } else if (pendingReleaseStatuses.has(record.demandStatus)) {
      stats.pendingReleaseCount += 1
      stats.totalCount += 1
    }

    statsByBusinessLine.set(businessLine, stats)
  }

  return [...statsByBusinessLine.values()]
    .map((stats) => ({
      ...stats,
      demandRatio: totalDemandCount === 0 ? 0 : stats.demandCount / totalDemandCount,
    }))
    .filter((stats) => stats.demandCount > 0)
    .sort((left, right) => {
      const demandDiff = right.demandCount - left.demandCount
      if (demandDiff !== 0) {
        return demandDiff
      }
      const totalDiff = right.totalCount - left.totalCount
      if (totalDiff !== 0) {
        return totalDiff
      }
      return left.businessLine.localeCompare(right.businessLine, 'zh-Hans-CN')
    })
}

export function filterRecordsByDemandType(records: IntakeSummary[], demandType: DemandTypeFilter): IntakeSummary[] {
  if (demandType === 'DEVELOPMENT') {
    return records.filter((record) => record.requirementType === '研发需求')
  }
  if (demandType === 'OPERATIONS') {
    return records.filter((record) => record.requirementType === '数据提取/运维')
  }
  return records
}

export function formatDemandRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
