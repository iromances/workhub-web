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
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('@/views/project/ProjectListView.vue'),
          meta: { title: '项目管理' },
        },
        {
          path: 'work-items',
          name: 'work-items',
          component: () => import('@/views/work-item/WorkItemListView.vue'),
          meta: { title: '工作项' },
        },
        {
          path: 'intake',
          name: 'intake',
          component: () => import('@/views/intake/IntakeListView.vue'),
          meta: { title: '待整理箱' },
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
