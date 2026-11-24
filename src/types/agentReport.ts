export interface StructuredReport {
  reportType: 'INSPECTION' | 'CODE_REVIEW' | 'GENERAL'
  title: string
  conclusion: string
  assessment: 'NORMAL' | 'ISSUES_FOUND' | 'INCONCLUSIVE'
  scope: { businessLines: string[]; environments: string[]; window: { from: string | null; to: string | null; basis: string }; repositories: { name: string; branch: string | null; commit: string | null; baseline: string | null }[]; included: string[]; excluded: string[] }
  checks: { key: string; category: string; title: string; outcome: string; result: string }[]
  findings: { key: string; title: string; severity: string; verificationStatus: string; disposition: string; category: string; trigger: string; analysis: string; impact: string; recommendation: string }[]
  evidence: { key: string; targetType: string; targetKey: string | null; type: string; source: string; locator: string | null; observedAt: string | null; environment: string | null; verificationMethod: string; result: string; limitations: string }[]
  actions: { key: string; findingKey: string | null; priority: string; description: string; acceptanceCriteria: string; prerequisite: string }[]
  limitations: string[]
}
