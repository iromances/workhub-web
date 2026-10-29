export interface IntakeProcessEditableValues {
  plannedDevelopmentStartDate: string | null
  developmentStartedDate: string | null
  actualCompletedTime: string | null
  plannedTestingStartDate: string | null
  testingStartedDate: string | null
  actualTestingCompletedDate: string | null
  plannedReleaseDate: string | null
  releasedTime: string | null
  scheduledAcceptanceDate: string | null
  acceptanceTime: string | null
  actualEffort: string | null
  actualTestingEffort: string | null
  developmentEstimatedEffort: string | null
  testingEstimatedEffort: string | null
}

export interface IntakeProcessInfo {
  values: IntakeProcessEditableValues & { totalEstimatedEffort: string | null }
  estimatedEffortOverridden: boolean
}

export interface IntakeProcessInfoUpdateRequest {
  original: IntakeProcessInfo
  changes: Partial<IntakeProcessEditableValues>
}
