import type { MenuItem } from '@/types/menu'

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/dashboard' },
  { key: 'payment-config', label: '支付配置', path: '/payment-config' },
  { key: 'projects', label: '项目管理', path: '/projects' },
  { key: 'work-items', label: '工作项', path: '/work-items' },
  { key: 'demands', label: '需求管理', path: '/demands' },
]
