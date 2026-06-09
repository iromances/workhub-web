import type { IntakeSummary } from '../../types/work-item'

import {
  buildAcceptanceDateDisplay,
  buildReleaseDateDisplay,
  buildTestingDateDisplay,
} from './intakeDateColumns'

const plannedOnly = record({
  plannedTestingStartDate: '2026/06/10',
  plannedReleaseDate: '2026/06/20',
  scheduledAcceptanceDate: '2026/06/18',
})

const testingPlanned = buildTestingDateDisplay(plannedOnly)
assert(testingPlanned.submitted.value === '2026/06/10', '无实际提测时应展示预估提测日期')
assert(testingPlanned.submitted.tag === '预估', '无实际提测时应标记预估')
assert(testingPlanned.completed.value === null, '无测试完成日期时完成值为空')

const delayedTesting = buildTestingDateDisplay(record({
  plannedTestingStartDate: '2026/06/10',
  testingStartedDate: '2026/06/12',
  actualTestingCompletedDate: '2026/06/14',
}))
assert(delayedTesting.submitted.value === '2026/06/12', '有实际提测时应优先展示实际提测日期')
assert(delayedTesting.submitted.tag === '延期', '实际提测晚于预估提测时应标记延期')
assert(delayedTesting.completed.value === '2026/06/14', '测试完成日期应独立展示')

const acceptanceScheduled = buildAcceptanceDateDisplay(plannedOnly)
assert(acceptanceScheduled.value === '2026/06/18', '无实际验收时应展示预约验收日期')
assert(acceptanceScheduled.tag === '预约', '预约验收日期应标记预约')

const acceptanceActual = buildAcceptanceDateDisplay(record({
  scheduledAcceptanceDate: '2026/06/18',
  acceptanceTime: '2026/06/19',
}))
assert(acceptanceActual.value === '2026/06/19', '有实际验收时应优先展示实际验收日期')
assert(acceptanceActual.tag === '', '实际验收日期不应标记预约')

const releasePlanned = buildReleaseDateDisplay(plannedOnly)
assert(releasePlanned.value === '2026/06/20', '无实际上线时应展示预估上线日期')
assert(releasePlanned.tag === '预估', '无实际上线时应标记预估')

const releaseDelayed = buildReleaseDateDisplay(record({
  plannedReleaseDate: '2026/06/20',
  releasedTime: '2026/06/22',
}))
assert(releaseDelayed.value === '2026/06/22', '有实际上线时应优先展示实际上线日期')
assert(releaseDelayed.tag === '延期', '实际上线晚于预估上线时应标记延期')

function record(overrides: Partial<IntakeSummary>): IntakeSummary {
  return {
    id: 1,
    sourceType: 'UPLOAD',
    sourceChannel: '人工录入',
    senderName: '张三',
    developmentOwnerUserName: null,
    receivedAt: '2026-06-05T10:00:00',
    demandStatus: '测试中',
    proposerName: null,
    approvalCode: null,
    submittedTime: null,
    requirementType: '研发需求',
    developmentBranchName: null,
    zentaoUrl: null,
    requirementDigest: null,
    department: null,
    requirementName: null,
    requirementSummary: null,
    businessLine: null,
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
    ...overrides,
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}
