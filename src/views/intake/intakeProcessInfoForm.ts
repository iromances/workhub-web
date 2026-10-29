import type { IntakeProcessEditableValues } from '../../types/intakeProcessInfo'

interface ProcessField {
  name: keyof IntakeProcessEditableValues
  label: string
  date?: boolean
}

export const processFieldGroups: { title: string; fields: ProcessField[] }[] = [
  { title: '开发', fields: [
    { name: 'plannedDevelopmentStartDate', label: '预估开发日期', date: true },
    { name: 'developmentStartedDate', label: '实际开发开始日期', date: true },
    { name: 'actualCompletedTime', label: '实际开发完成日期', date: true },
  ] },
  { title: '提测', fields: [
    { name: 'plannedTestingStartDate', label: '预估提测日期', date: true },
    { name: 'testingStartedDate', label: '实际提测日期', date: true },
    { name: 'actualTestingCompletedDate', label: '实际测试完成日期', date: true },
  ] },
  { title: '上线与验收', fields: [
    { name: 'plannedReleaseDate', label: '预估上线日期', date: true },
    { name: 'releasedTime', label: '实际上线日期', date: true },
    { name: 'scheduledAcceptanceDate', label: '预约验收日期', date: true },
    { name: 'acceptanceTime', label: '实际验收日期', date: true },
  ] },
  { title: '工时', fields: [
    { name: 'developmentEstimatedEffort', label: '开发预估工时' },
    { name: 'testingEstimatedEffort', label: '测试预估工时' },
    { name: 'actualEffort', label: '实际开发工时' },
    { name: 'actualTestingEffort', label: '实际测试工时' },
  ] },
]

export function buildProcessChanges(original: IntakeProcessEditableValues, form: Partial<IntakeProcessEditableValues>, includeEstimates = false) {
  const changes: Partial<IntakeProcessEditableValues> = {}
  for (const { fields } of processFieldGroups) {
    for (const { name } of fields) {
      if (!(name in form)) continue
      const value = form[name]?.trim() || null
      if (value !== original[name]) changes[name] = value
    }
  }
  if (includeEstimates) {
    changes.developmentEstimatedEffort = form.developmentEstimatedEffort?.trim() || null
    changes.testingEstimatedEffort = form.testingEstimatedEffort?.trim() || null
  }
  return changes
}
