import type { MenuItem } from '@/types/menu'

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/dashboard', permission: 'dashboard:view' },
  { key: 'demands', label: '需求管理', path: '/demands', permission: 'intake:record:view' },
  {
    key: 'ops',
    label: '运维',
    path: '/ops',
    children: [
      { key: 'ops-monitors', label: '业务监测', path: '/ops/monitors', permission: 'ops:monitor:view' },
      { key: 'ops-system-alerts', label: '系统预警', path: '/ops/system-alerts', permission: 'ops:system-alert:view' },
      { key: 'ops-mcp-resources', label: 'MCP', path: '/ops/mcp-resources', permission: 'ops:mcp-resource:view' },
    ],
  },
  {
    key: 'projects',
    label: '项目管理',
    path: '/projects',
    children: [
      { key: 'project-list', label: '项目列表', path: '/projects/list', permission: 'project:project:view' },
      { key: 'project-business-lines', label: '业务线', path: '/projects/business-lines', permission: 'project:business-line:view' },
      { key: 'project-systems', label: '中台系统管理', path: '/projects/systems', permission: 'project:system:view' },
      { key: 'project-developers', label: '团队', path: '/projects/developers', permission: 'project:developer:view' },
      { key: 'payment-config', label: '支付配置', path: '/payment-config', permission: 'payment:config:view' },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    path: '/system',
    children: [
      { key: 'system-config', label: '系统配置', path: '/system-config', permission: 'system:config:view' },
      { key: 'system-users', label: '账号管理', path: '/system/users', permission: 'system:user:view' },
      { key: 'system-roles', label: '角色管理', path: '/system/roles', permission: 'system:role:view' },
      { key: 'system-audits', label: '权限审计', path: '/system/audits', permission: 'system:audit:view' },
    ],
  },
]
