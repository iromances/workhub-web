export interface IntegrationCapability {
  id?: number
  capabilityCode: string
  capabilityName: string
  capabilityType: 'READ' | 'WRITE'
  implStatus: 'ACTIVE' | 'PLANNED'
  description?: string | null
  enabled: boolean
  sortOrder?: number | null
  remark?: string | null
}

export interface IntegrationConfigGroupStatus {
  group: string
  itemCount: number
  enabledCount: number
  secretConfigured: boolean
  prefixGroup: boolean
}

export interface IntegrationSystem {
  id: number
  systemCode: string
  systemName: string
  integrationMethod: 'REST_API' | 'REST_AND_LOCAL_GIT'
  authType: 'ACCOUNT_PASSWORD' | 'BASIC_API_TOKEN' | 'PAT'
  configGroups: string[]
  enabled: boolean
  sortOrder?: number | null
  remark?: string | null
  capabilityCount?: number
  updatedAt?: string | null
}

export interface IntegrationSystemDetail extends IntegrationSystem {
  capabilities: IntegrationCapability[]
  configGroupStatuses: IntegrationConfigGroupStatus[]
}

export interface IntegrationSystemSaveRequest {
  systemCode?: string
  systemName: string
  integrationMethod: IntegrationSystem['integrationMethod']
  authType: IntegrationSystem['authType']
  configGroups?: string[]
  enabled?: boolean
  sortOrder?: number
  remark?: string | null
  capabilities?: IntegrationCapability[]
}

export interface IntegrationProbeResult {
  ok: boolean
  message: string
  elapsedMs?: number | null
  probedAt?: string | null
}

export interface IntegrationZentaoConfig {
  baseUrl?: string | null
  account?: string | null
  passwordConfigured: boolean
}

export interface IntegrationJenkinsInstance {
  id: string
  name: string
  baseUrl: string
  userName: string
  enabled: boolean
  tokenConfigured: boolean
}

export interface IntegrationJenkinsConfig {
  instances: IntegrationJenkinsInstance[]
}

export interface IntegrationSystemConfig {
  systemCode: string
  zentao?: IntegrationZentaoConfig | null
  jenkins?: IntegrationJenkinsConfig | null
}

export interface IntegrationZentaoConfigSave {
  baseUrl: string
  account: string
  password?: string | null
}

export interface IntegrationJenkinsInstanceSave {
  id: string
  name: string
  baseUrl: string
  userName: string
  apiToken?: string | null
  enabled?: boolean
}

export interface IntegrationSystemConfigSaveRequest {
  zentao?: IntegrationZentaoConfigSave
  jenkins?: { instances: IntegrationJenkinsInstanceSave[] }
}

export type IntegrationHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface IntegrationApiEndpoint {
  id?: number
  systemCode?: string
  resourceGroup: string
  resourceGroupName?: string | null
  apiName: string
  httpMethod: IntegrationHttpMethod
  apiPath: string
  summary?: string | null
  platformUsed?: boolean | null
  sourceUrl?: string | null
  sourceNote?: string | null
  sortOrder?: number | null
}

export interface IntegrationApiGroupSummary {
  resourceGroup: string
  resourceGroupName?: string | null
  endpointCount: number
  platformUsedCount?: number | null
  sortOrder?: number | null
}

export interface IntegrationApiCatalog {
  systemCode: string
  total: number
  page: number
  pageSize: number
  items: IntegrationApiEndpoint[]
  resourceGroups: IntegrationApiGroupSummary[]
  sourceSummary: {
    fetchedAt?: string | null
    sources: Array<{ url: string; note?: string | null }>
  }
}

export interface IntegrationApiCatalogQuery {
  resourceGroup?: string
  httpMethod?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export const INTEGRATION_METHOD_LABELS: Record<IntegrationSystem['integrationMethod'], string> = {
  REST_API: 'REST API',
  REST_AND_LOCAL_GIT: 'REST API + 本地 Git',
}

export const AUTH_TYPE_LABELS: Record<IntegrationSystem['authType'], string> = {
  ACCOUNT_PASSWORD: '账号密码',
  BASIC_API_TOKEN: 'Basic + API Token',
  PAT: '私人访问令牌',
}
