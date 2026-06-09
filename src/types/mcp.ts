export type McpResourceType = 'DATABASE' | 'SERVER'

export interface McpResourceProfile {
  key: string
  maxRows?: number | null
  queryTimeoutSeconds?: number | null
  maxResultBytes?: number | null
  maxOutputLines?: number | null
  timeoutSeconds?: number | null
}

export interface McpResource {
  id: number
  resourceType: McpResourceType
  targetKey: string
  businessLineCode: string
  businessLineCodes: string[]
  environmentCode: string
  name: string
  systemName: string | null
  systemNames: string[]
  host: string
  port: number
  databaseSchema: string | null
  username: string | null
  passwordConfigured: boolean
  sshPasswordConfigured: boolean
  sshBastionEnabled: boolean
  sshBastionHost: string | null
  sshBastionPort: number | null
  sshBastionUser: string | null
  sshBastionPasswordConfigured: boolean
  sshIdentityFile: string | null
  allowedServices: string[]
  allowedLogPaths: string[]
  profiles: McpResourceProfile[]
  enabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface McpResourceSaveRequest {
  resourceType: McpResourceType
  targetKey: string
  businessLineCode?: string
  businessLineCodes: string[]
  environmentCode: string
  name: string
  systemName?: string
  systemNames?: string[]
  host: string
  port: number
  databaseSchema?: string
  username?: string
  password?: string
  sshPassword?: string
  sshBastionEnabled?: boolean
  sshBastionHost?: string
  sshBastionPort?: number
  sshBastionUser?: string
  sshBastionPassword?: string
  sshIdentityFile?: string
  allowedServices?: string[]
  allowedLogPaths?: string[]
  profiles: McpResourceProfile[]
  enabled: boolean
  remark?: string
}

export interface McpCatalog {
  businessLines: Array<Record<string, unknown>>
  environments: Array<Record<string, unknown>>
  databaseTargets: Array<Record<string, unknown>>
  serverTargets: Array<Record<string, unknown>>
}

export interface McpAuditEntry {
  fields: Record<string, unknown>
}
