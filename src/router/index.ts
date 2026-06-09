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
          meta: { title: '工作台', activeMenu: '/dashboard' },
        },
        {
          path: 'projects',
          redirect: '/projects/list',
        },
        {
          path: 'projects/list',
          name: 'project-list',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '项目列表', activeMenu: '/projects/list' },
        },
        {
          path: 'projects/business-lines',
          name: 'project-business-lines',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '业务线', activeMenu: '/projects/business-lines' },
        },
        {
          path: 'projects/systems',
          name: 'project-systems',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '中台系统管理', activeMenu: '/projects/systems' },
        },
        {
          path: 'projects/developers',
          name: 'project-developers',
          component: () => import('@/views/project/DeveloperResourceView.vue'),
          meta: { title: '研发人员资源', activeMenu: '/projects/developers' },
        },
        {
          path: 'payment-config',
          name: 'payment-config',
          component: () => import('@/views/payment/PaymentConfigView.vue'),
          meta: { title: '支付配置', activeMenu: '/payment-config' },
        },
        {
          path: 'system-config',
          name: 'system-config',
          component: () => import('@/views/system/SystemConfigView.vue'),
          meta: { title: '系统配置', activeMenu: '/system-config' },
        },
        {
          path: 'ops',
          redirect: '/ops/monitors',
        },
        {
          path: 'ops/monitors',
          name: 'ops-monitors',
          component: () => import('@/views/ops/OpsMonitorView.vue'),
          meta: { title: '业务监测', activeMenu: '/ops/monitors' },
        },
        {
          path: 'ops/system-alerts',
          name: 'ops-system-alerts',
          component: () => import('@/views/ops/SystemAlertView.vue'),
          meta: { title: '系统预警', activeMenu: '/ops/system-alerts' },
        },
        {
          path: 'ops/mcp-resources',
          name: 'ops-mcp-resources',
          component: () => import('@/views/mcp/McpResourceView.vue'),
          meta: { title: 'MCP', activeMenu: '/ops/mcp-resources' },
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
          meta: { title: '需求管理', activeMenu: '/demands' },
        },
        {
          path: 'work-items',
          name: 'work-items',
          component: () => import('@/views/work-item/WorkItemListView.vue'),
          meta: { title: '工作项', activeMenu: '/work-items' },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.public) {
    return true
  }
  if (!authStore.isAuthenticated) {
    return '/login'
  }
  return true
})

export default router
