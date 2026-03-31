import type { MenuItem } from '@/types/menu'

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/' },
  { key: 'projects', label: '项目管理', path: '/projects' },
  { key: 'work-items', label: '工作项', path: '/work-items' },
  { key: 'intake', label: '待整理箱', path: '/intake' },
]
