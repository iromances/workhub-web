import type { MenuItem } from '@/types/menu'

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/dashboard', permission: 'dashboard:view' },
  { key: 'agents', label: '数字员工', path: '/agents', permission: 'agent:view' },
  {
    key: 'demands',
    label: '需求管理',
    path: '/demands',
    children: [
      { key: 'demands-list', label: '需求清单', path: '/demands/list', permission: 'intake:record:view' },
      { key: 'demands-board', label: '需求看板', path: '/demands/board', permission: 'intake:record:view' },
    ],
  },
  {
    key: 'ops',
    label: '运维',
    path: '/ops',
    children: [
      { key: 'ops-monitors', label: '业务监测', path: '/ops/monitors', permission: 'ops:monitor:view' },
      { key: 'ops-accounting', label: '账务监测', path: '/ops/accounting', permission: 'ops:accounting:view' },
      { key: 'ops-system-alerts', label: '系统预警', path: '/ops/system-alerts', permission: 'ops:system-alert:view' },
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
      { key: 'system-ai-config', label: 'AI配置', path: '/system/ai-config', permission: 'system:ai-config:view' },
      { key: 'system-users', label: '账号管理', path: '/system/users', permission: 'system:user:view' },
      { key: 'system-roles', label: '角色管理', path: '/system/roles', permission: 'system:role:view' },
      { key: 'system-audits', label: '权限审计', path: '/system/audits', permission: 'system:audit:view' },
      { key: 'system-integrations', label: '系统集成', path: '/system/integrations', permission: 'system:integration:view' },
      { key: 'system-jobs', label: 'Job 管理', path: '/system/jobs', permission: 'ops:job:view' },
      { key: 'system-mcp-resources', label: 'MCP', path: '/system/mcp-resources', permission: 'ops:mcp-resource:view' },
      { key: 'system-function-call', label: 'Function Call', path: '/system/function-call', permission: 'ops:function-call:view' },
    ],
  },
]
