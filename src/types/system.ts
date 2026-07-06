export interface SysUser {
  id: number
  userName: string
  displayName: string
  email?: string
  mobile?: string
  wecomUserid?: string
  avatarUrl?: string
  status: string
  mustChangePassword: boolean
  loginFailCount: number
  lockedUntil?: string
  lastLoginAt?: string
  lastLoginIp?: string
  roleCodes: string[]
  createdAt?: string
  updatedAt?: string
}

export interface SysUserSaveRequest {
  userName: string
  displayName: string
  email?: string
  mobile?: string
  wecomUserid?: string
  avatarUrl?: string
  status?: string
}

export interface SysUserCreateResponse {
  user: SysUser
  initialPassword: string
}

export interface SysRole {
  id: number
  roleCode: string
  roleName: string
  roleType: string
  enabled: boolean
  builtIn: boolean
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface SysRoleSaveRequest {
  roleCode: string
  roleName: string
  enabled?: boolean
  remark?: string
}

export interface SysPermission {
  permissionCode: string
  permissionName: string
  permissionType: string
  parentCode?: string
  routePath?: string
  sortOrder: number
  enabled: boolean
  children?: SysPermission[]
}

export interface SysLoginLog {
  id: number
  userName: string
  loginResult: string
  failReason?: string
  ip?: string
  userAgent?: string
  occurredAt: string
}

export interface SysOperationLog {
  id: number
  operatorUserName: string
  permissionCode?: string
  actionType: string
  targetType: string
  targetId?: string
  beforeSnapshot?: string
  afterSnapshot?: string
  result: string
  errorMessage?: string
  ip?: string
  occurredAt: string
}
