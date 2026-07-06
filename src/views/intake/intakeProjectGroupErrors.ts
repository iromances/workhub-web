const IGNORABLE_SYSTEM_OPTION_MESSAGES = new Set([
  '业务线不存在',
  '业务线不能为空',
])

export interface DevelopmentProjectGroupCandidateSource {
  draftProjectGroup?: string | null
  stageProjectGroup?: string | null
  rowBusinessLineCode?: string | null
  rowBusinessLine?: string | null
  rowProjectHint?: string | null
  detailBusinessLineCode?: string | null
  detailBusinessLine?: string | null
  detailProjectHint?: string | null
}

export function resolveDevelopmentProjectGroupCandidate(source: DevelopmentProjectGroupCandidateSource) {
  return cleanBusinessLineCandidate(source.draftProjectGroup)
    || cleanBusinessLineCandidate(source.stageProjectGroup)
    || cleanBusinessLineCandidate(source.detailBusinessLineCode)
    || cleanBusinessLineCandidate(source.rowBusinessLineCode)
    || cleanBusinessLineCandidate(source.detailBusinessLine)
    || cleanBusinessLineCandidate(source.rowBusinessLine)
}

export function shouldIgnoreDevelopmentSystemOptionsError(error: unknown) {
  const maybeError = error as { response?: { data?: { message?: string } }; message?: string }
  const message = maybeError.response?.data?.message || maybeError.message || ''
  return IGNORABLE_SYSTEM_OPTION_MESSAGES.has(message)
}

export function shouldReloadDevelopmentDraftAfterSaveError(_error: unknown) {
  return false
}

function cleanBusinessLineCandidate(value: string | null | undefined) {
  const cleaned = cleanBusinessValue(value)
  if (!cleaned || /[;；、]/.test(cleaned)) {
    return ''
  }
  return cleaned
}

function cleanBusinessValue(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized || normalized === '-' || normalized === '无' || ['null', 'undefined'].includes(normalized.toLowerCase())) {
    return ''
  }
  return normalized
}
