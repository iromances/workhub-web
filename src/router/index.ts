import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          alias: ['/workspace'],
          meta: { title: '工作台', activeMenu: '/dashboard', permission: 'dashboard:view' },
        },
        {
          path: 'projects',
          redirect: '/projects/list',
        },
        {
          path: 'projects/list',
          name: 'project-list',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '项目列表', activeMenu: '/projects/list', permission: 'project:project:view' },
        },
        {
          path: 'projects/business-lines',
          name: 'project-business-lines',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '业务线', activeMenu: '/projects/business-lines', permission: 'project:business-line:view' },
        },
        {
          path: 'projects/systems',
          name: 'project-systems',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '中台系统管理', activeMenu: '/projects/systems', permission: 'project:system:view' },
        },
        {
          path: 'projects/developers',
          name: 'project-developers',
          component: () => import('@/views/project/DeveloperResourceView.vue'),
          meta: { title: '团队', activeMenu: '/projects/developers', permission: 'project:developer:view' },
        },
        {
          path: 'payment-config',
          name: 'payment-config',
          component: () => import('@/views/payment/PaymentConfigView.vue'),
          meta: { title: '支付配置', activeMenu: '/payment-config', permission: 'payment:config:view' },
        },
        {
          path: 'system-config',
          name: 'system-config',
          component: () => import('@/views/system/SystemConfigView.vue'),
          meta: { title: '系统配置', activeMenu: '/system-config', permission: 'system:config:view' },
        },
        {
          path: 'system/users',
          name: 'system-users',
          component: () => import('@/views/system/UserManagementView.vue'),
          meta: { title: '账号管理', activeMenu: '/system/users', permission: 'system:user:view' },
        },
        {
          path: 'system/roles',
          name: 'system-roles',
          component: () => import('@/views/system/RoleManagementView.vue'),
          meta: { title: '角色管理', activeMenu: '/system/roles', permission: 'system:role:view' },
        },
        {
          path: 'system/audits',
          name: 'system-audits',
          component: () => import('@/views/system/AuditLogView.vue'),
          meta: { title: '权限审计', activeMenu: '/system/audits', permission: 'system:audit:view' },
        },
        {
          path: 'ops',
          redirect: '/ops/monitors',
        },
        {
          path: 'ops/monitors',
          name: 'ops-monitors',
          component: () => import('@/views/ops/OpsMonitorView.vue'),
          meta: { title: '业务监测', activeMenu: '/ops/monitors', permission: 'ops:monitor:view' },
        },
        {
          path: 'ops/system-alerts',
          name: 'ops-system-alerts',
          component: () => import('@/views/ops/SystemAlertView.vue'),
          meta: { title: '系统预警', activeMenu: '/ops/system-alerts', permission: 'ops:system-alert:view' },
        },
        {
          path: 'ops/mcp-resources',
          name: 'ops-mcp-resources',
          component: () => import('@/views/mcp/McpResourceView.vue'),
          meta: { title: 'MCP', activeMenu: '/ops/mcp-resources', permission: 'ops:mcp-resource:view' },
        },
        {
          path: 'mcp-resources',
          redirect: '/ops/mcp-resources',
        },
        {
          path: 'demands',
          alias: ['/intake'],
          name: 'demands',
          component: () => import('@/views/intake/IntakeListView.vue'),
          meta: { title: '需求管理', activeMenu: '/demands', permission: 'intake:record:view' },
        },
        {
          path: 'work-items',
          name: 'work-items',
          component: () => import('@/views/work-item/WorkItemListView.vue'),
          meta: { title: '工作项', activeMenu: '/work-items', permission: 'work-item:view' },
        },
        {
          path: '403',
          name: 'forbidden',
          component: () => import('@/views/system/ForbiddenView.vue'),
          meta: { title: '无权限', activeMenu: '/403' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (to.meta.public) {
    return true
  }
  if (!authStore.isAuthenticated) {
    return '/login'
  }
  if (!authStore.profileLoaded) {
    await authStore.loadProfile()
  }
  const permission = to.meta.permission as string | undefined
  if (!authStore.hasPermission(permission)) {
    return '/403'
  }
  return true
})

export default router
