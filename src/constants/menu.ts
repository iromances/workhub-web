import type { MenuItem } from '@/types/menu'

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/dashboard' },
  { key: 'demands', label: '需求管理', path: '/demands' },
  {
    key: 'ops',
    label: '运维',
    path: '/ops',
    children: [
      { key: 'ops-monitors', label: '业务监测', path: '/ops/monitors' },
      { key: 'ops-system-alerts', label: '系统预警', path: '/ops/system-alerts' },
      { key: 'ops-mcp-resources', label: 'MCP', path: '/ops/mcp-resources' },
    ],
  },
  {
    key: 'projects',
    label: '项目管理',
    path: '/projects',
    children: [
      { key: 'project-list', label: '项目列表', path: '/projects/list' },
      { key: 'project-business-lines', label: '业务线', path: '/projects/business-lines' },
      { key: 'project-systems', label: '中台系统管理', path: '/projects/systems' },
      { key: 'project-developers', label: '研发人员资源', path: '/projects/developers' },
      { key: 'payment-config', label: '支付配置', path: '/payment-config' },
    ],
  },
  { key: 'system-config', label: '系统配置', path: '/system-config' },
]
