export interface DevelopmentProjectGroupCandidateSource {
  rowBusinessLineCode?: string | null
  rowBusinessLine?: string | null
  detailBusinessLineCode?: string | null
  detailBusinessLine?: string | null
}

export function resolveDevelopmentProjectGroupCandidate(source: DevelopmentProjectGroupCandidateSource) {
  return cleanBusinessLineCandidate(source.detailBusinessLineCode)
    || cleanBusinessLineCandidate(source.rowBusinessLineCode)
    || cleanBusinessLineCandidate(source.detailBusinessLine)
    || cleanBusinessLineCandidate(source.rowBusinessLine)
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
