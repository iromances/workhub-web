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
          name: 'projects',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '项目管理', activeMenu: '/projects' },
        },
        {
          path: 'payment-config',
          name: 'payment-config',
          component: () => import('@/views/payment/PaymentConfigView.vue'),
          meta: { title: '支付配置', activeMenu: '/payment-config' },
        },
        {
          path: 'work-items',
          name: 'work-items',
          component: () => import('@/views/work-item/WorkItemListView.vue'),
          meta: { title: '工作项', activeMenu: '/work-items' },
        },
        {
          path: 'demands',
          alias: ['/intake'],
          name: 'demands',
          component: () => import('@/views/intake/IntakeListView.vue'),
          meta: { title: '需求管理', activeMenu: '/demands' },
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
