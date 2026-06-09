import type { IntakeSummary } from '../../types/work-item'

export interface IntakeDateDisplayItem {
  value: string | null
  tag: '' | '预估' | '延期' | '预约'
  type: 'info' | 'danger'
}

export interface IntakeTestingDateDisplay {
  submitted: IntakeDateDisplayItem
  completed: IntakeDateDisplayItem
}

export function buildTestingDateDisplay(row: IntakeSummary): IntakeTestingDateDisplay {
  const submittedActual = cleanBusinessValue(row.testingStartedDate)
  const submittedPlanned = cleanBusinessValue(row.plannedTestingStartDate)
  const completed = cleanBusinessValue(row.actualTestingCompletedDate)
  const delayed = compareBusinessDate(submittedActual, submittedPlanned) > 0
  return {
    submitted: {
      value: submittedActual || submittedPlanned,
      tag: submittedActual ? (delayed ? '延期' : '') : (submittedPlanned ? '预估' : ''),
      type: delayed ? 'danger' : 'info',
    },
    completed: {
      value: completed,
      tag: '',
      type: 'info',
    },
  }
}

export function buildAcceptanceDateDisplay(row: IntakeSummary): IntakeDateDisplayItem {
  const accepted = cleanBusinessValue(row.acceptanceTime)
  const scheduled = cleanBusinessValue(row.scheduledAcceptanceDate)
  return {
    value: accepted || scheduled,
    tag: accepted ? '' : (scheduled ? '预约' : ''),
    type: 'info',
  }
}

export function buildReleaseDateDisplay(row: IntakeSummary): IntakeDateDisplayItem {
  const released = cleanBusinessValue(row.releasedTime)
  const planned = cleanBusinessValue(row.plannedReleaseDate)
  const delayed = compareBusinessDate(released, planned) > 0
  return {
    value: released || planned,
    tag: released ? (delayed ? '延期' : '') : (planned ? '预估' : ''),
    type: delayed ? 'danger' : 'info',
  }
}

function cleanBusinessValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '-' || trimmed === '未填写' || trimmed === '无') {
    return null
  }
  return trimmed
}

function compareBusinessDate(left: string | null | undefined, right: string | null | undefined) {
  const leftDate = normalizeBusinessDate(left)
  const rightDate = normalizeBusinessDate(right)
  if (!leftDate || !rightDate) {
    return 0
  }
  return leftDate.localeCompare(rightDate)
}

function normalizeBusinessDate(value: string | null | undefined) {
  const normalized = value?.trim().replace(/-/g, '/').replace('T', ' ')
  if (!normalized) {
    return null
  }
  const matched = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!matched) {
    return null
  }
  const [, year, month, day] = matched
  return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
}
