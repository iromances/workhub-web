export interface AiProviderConfig {
  id: number
  providerCode: string
  providerName: string
  channelType: 'API' | 'CLI' | string
  vendor?: string
  modelProvider: string
  defaultModel?: string
  defaultReasoningLevel?: string
  defaultSpeedMode?: string
  apiProtocol?: string
  apiBaseUrl?: string
  apiKey?: string
  cliCommand?: string
  cliWorkingDirectory?: string
  connectTimeoutSeconds?: number
  readTimeoutSeconds?: number
  callTimeoutSeconds?: number
  siteUrl?: string
  appName?: string
  enabled: boolean
  remark?: string
}

export interface AiProviderConfigRequest {
  id?: number | null
  providerCode: string
  providerName: string
  channelType: 'API' | 'CLI' | string
  vendor?: string
  modelProvider: string
  defaultModel?: string
  defaultReasoningLevel?: string
  defaultSpeedMode?: string
  apiProtocol?: string
  apiBaseUrl?: string
  apiKey?: string
  cliCommand?: string
  cliWorkingDirectory?: string
  connectTimeoutSeconds?: number
  readTimeoutSeconds?: number
  callTimeoutSeconds?: number
  siteUrl?: string
  appName?: string
  enabled: boolean
  remark?: string
}

export interface AiProviderProbeResult {
  providerId: number
  providerCode: string
  model: string
  success: boolean
  durationMs: number
  message: string
}

export interface AiProviderConnectionTestResult {
  success: boolean
  channelType: 'API' | 'CLI' | string
  model: string
  elapsedMillis: number
  message: string
}

export interface AiUseCaseConfig {
  id: number
  useCaseCode: string
  useCaseName: string
  domain: string
  description?: string
  providerConfigId: number
  providerCode?: string
  providerName?: string
  channelType?: string
  vendor?: string
  modelProvider?: string
  model?: string
  reasoningLevel?: string
  speedMode?: string
  timeoutSeconds?: number | null
  effectiveModel?: string
  effectiveReasoningLevel?: string
  effectiveSpeedMode?: string
  effectiveTimeoutSeconds?: number
  modelSource?: 'USE_CASE' | 'PROVIDER' | 'NONE' | string
  reasoningLevelSource?: 'USE_CASE' | 'PROVIDER' | 'NONE' | string
  speedModeSource?: 'USE_CASE' | 'PROVIDER' | 'NONE' | string
  timeoutSecondsSource?: 'USE_CASE' | 'PROVIDER' | 'NONE' | string
  jsonSchemaEnabled: boolean
  schemaClasspath?: string
  promptTemplate: string
  promptVariablesDesc?: string
  promptVersion?: number
  promptChecksum?: string
  enabled: boolean
  remark?: string
}

export interface AiUseCaseConfigRequest {
  id?: number | null
  useCaseCode: string
  useCaseName: string
  domain: string
  description?: string
  providerConfigId: number | null
  model?: string
  reasoningLevel?: string
  speedMode?: string
  timeoutSeconds?: number | null
  jsonSchemaEnabled: boolean
  schemaClasspath?: string
  promptTemplate: string
  promptVariablesDesc?: string
  promptVersion?: number
  promptChecksum?: string
  enabled: boolean
  remark?: string
}

export interface AiUseCaseQuery {
  page: number
  pageNum?: number
  pageSize: number
  domain?: string
  providerConfigId?: number
  channelType?: string
  vendor?: string
  modelProvider?: string
  enabled?: boolean
  keyword?: string
}

export interface AiUseCaseManagePage {
  current: number
  size: number
  total: number
  pages: number
  records: AiUseCaseConfig[]
  items: AiUseCaseConfig[]
}

export interface DictOption {
  id?: number
  type: string
  desc?: string
  code: string
  name: string
}

export interface AiProviderGroup {
  key: string
  vendor: string
  modelProvider: string
  groupName: string
  api?: AiProviderConfig
  cli?: AiProviderConfig
  enabledCount: number
}

export interface CodexModelCatalogRequest {
  cliCommand: string
  cliWorkingDirectory?: string
  forceRefresh?: boolean
}

export interface CodexModelOption {
  model: string
  displayName: string
  isDefault: boolean
  defaultReasoningEffort: string
  supportedReasoningEfforts: Array<{ reasoningEffort: string; description: string }>
}

export interface CodexModelCatalog {
  models: CodexModelOption[]
  fetchedAt: string
  cached: boolean
}
