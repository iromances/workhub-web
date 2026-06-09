<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notification'
import { menuItems } from '@/constants/menu'
import { useAuthStore } from '@/stores/auth'
import type { MenuItem } from '@/types/menu'
import type { NotificationItem } from '@/types/notification'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => String(route.meta.activeMenu || route.path))
const viewKey = computed(() => activeMenu.value)
const defaultOpeneds = computed(() =>
  menuItems
    .filter((item) => item.children?.length)
    .map((item) => item.path),
)
const navItems = ref<MenuItem[]>([])

const flattenedMenuItems = computed(() => {
  const items: MenuItem[] = []
  for (const item of menuItems) {
    if (item.children?.length) {
      items.push(...item.children)
    } else {
      items.push(item)
    }
  }
  return items
})

const currentPageTitle = computed(() => String(route.meta.title || '工作台'))
const notificationDrawerVisible = ref(false)
const notifications = ref<NotificationItem[]>([])
const unreadNotificationCount = ref(0)

function resolveMenuItem(path: string): MenuItem {
  const matched = flattenedMenuItems.value.find((item) => item.path === path)
  if (matched) {
    return matched
  }
  return {
    key: path,
    label: currentPageTitle.value,
    path,
  }
}

function rememberActiveMenu() {
  const item = resolveMenuItem(activeMenu.value)
  if (!navItems.value.some((navItem) => navItem.path === item.path)) {
    navItems.value.push(item)
  }
}

function closeNavItem(path: string) {
  if (navItems.value.length <= 1) {
    return
  }
  const closingIndex = navItems.value.findIndex((item) => item.path === path)
  if (closingIndex < 0) {
    return
  }
  const nextItems = navItems.value.filter((item) => item.path !== path)
  navItems.value = nextItems
  if (path === activeMenu.value) {
    const nextIndex = Math.min(closingIndex, nextItems.length - 1)
    router.push(nextItems[nextIndex].path)
  }
}

async function handleSelect(path: string) {
  if (path === route.path) {
    return
  }
  await router.push(path)
}

function logout() {
  authStore.signOut()
  router.push('/login')
}

async function loadNotifications() {
  try {
    const [items, count] = await Promise.all([
      fetchNotifications(),
      fetchUnreadNotificationCount(),
    ])
    notifications.value = items
    unreadNotificationCount.value = count
  } catch (error) {
    console.error(error)
  }
}

async function openNotifications() {
  notificationDrawerVisible.value = true
  await loadNotifications()
}

async function readNotification(item: NotificationItem) {
  if (!item.readFlag) {
    await markNotificationRead(item.id)
    await loadNotifications()
  }
}

async function readAllNotifications() {
  await markAllNotificationsRead()
  await loadNotifications()
}

async function copyNotificationContent(item: NotificationItem) {
  const text = [item.title, item.content].filter(Boolean).join('\n\n')
  if (!text) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  try {
    await copyTextToClipboard(text)
    ElMessage.success('站内信内容已复制')
  } catch (error) {
    ElMessage.error('复制站内信内容失败')
    console.error(error)
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const succeeded = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!succeeded) {
    throw new Error('execCommand copy failed')
  }
}

watch(activeMenu, rememberActiveMenu, { immediate: true })
onMounted(loadNotifications)
</script>

<template>
  <el-container class="layout-shell">
    <el-aside class="layout-aside" width="250px">
      <div class="brand-box">
        <div class="brand-badge">WH</div>
        <div>
          <div class="brand-title">WorkHub</div>
          <div class="brand-subtitle">需求与项目协同中台</div>
        </div>
      </div>

      <el-menu
        :default-active="activeMenu"
        :default-openeds="defaultOpeneds"
        class="menu-panel"
        @select="handleSelect"
      >
        <template v-for="item in menuItems" :key="item.key">
          <el-sub-menu v-if="item.children?.length" :index="item.path">
            <template #title>{{ item.label }}</template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.key"
              :index="child.path"
            >
              {{ child.label }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            {{ item.label }}
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div class="header-title">{{ currentPageTitle }}</div>
        <div class="header-actions">
          <el-badge :value="unreadNotificationCount" :hidden="unreadNotificationCount === 0">
            <el-button plain @click="openNotifications">通知</el-button>
          </el-badge>
          <el-tag type="success" effect="dark">{{ authStore.userName || '未登录' }}</el-tag>
          <el-button type="primary" plain @click="logout">退出</el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <nav class="navigation-tabs" aria-label="已访问页面导航">
          <div
            v-for="item in navItems"
            :key="item.path"
            class="navigation-tab"
            :class="{ 'is-active': item.path === activeMenu }"
          >
            <button class="navigation-tab-label" type="button" @click="handleSelect(item.path)">
              {{ item.label }}
            </button>
            <button
              v-if="navItems.length > 1"
              class="navigation-tab-close"
              type="button"
              aria-label="关闭导航项"
              @click="closeNavItem(item.path)"
            >
              ×
            </button>
          </div>
        </nav>

        <router-view v-slot="{ Component }">
          <KeepAlive>
            <component :is="Component" :key="viewKey" />
          </KeepAlive>
        </router-view>
      </el-main>
    </el-container>

    <el-drawer v-model="notificationDrawerVisible" title="站内信" size="420px">
      <div class="notification-toolbar">
        <el-button size="small" @click="loadNotifications">刷新</el-button>
        <el-button size="small" type="primary" plain @click="readAllNotifications">全部已读</el-button>
      </div>
      <el-empty v-if="notifications.length === 0" description="暂无站内信" />
      <div v-else class="notification-list">
        <article
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'is-unread': !item.readFlag }"
        >
          <div class="notification-title-row">
            <span class="notification-title">{{ item.title }}</span>
            <span class="notification-actions">
              <el-button v-if="!item.readFlag" link type="primary" size="small" @click="readNotification(item)">已读</el-button>
              <el-button link type="primary" size="small" @click="copyNotificationContent(item)">复制</el-button>
            </span>
          </div>
          <span class="notification-meta">{{ item.businessLineCode || '-' }} · {{ item.environmentCode || '-' }} · {{ item.createdAt }}</span>
          <span class="notification-content">{{ item.content || '' }}</span>
        </article>
      </div>
    </el-drawer>
  </el-container>
</template>

<style scoped>
.layout-shell {
  min-height: 100vh;
}

.layout-aside {
  padding: 24px 18px;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  background:
    linear-gradient(180deg, rgba(15, 118, 110, 0.96), rgba(15, 23, 42, 0.96)),
    #0f172a;
}

.brand-box {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.brand-badge {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #34d399, #22c55e);
  color: #052e16;
  font-weight: 800;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
}

.brand-subtitle {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.menu-panel {
  border-right: none;
  background: transparent;
}

:deep(.menu-panel .el-menu-item) {
  margin-bottom: 10px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.82);
}

:deep(.menu-panel .el-sub-menu__title) {
  margin-bottom: 10px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.82);
}

:deep(.menu-panel .el-sub-menu__title:hover),
:deep(.menu-panel .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08);
}

:deep(.menu-panel .el-sub-menu .el-menu) {
  background: transparent;
}

:deep(.menu-panel .el-sub-menu .el-menu-item) {
  height: 42px;
  margin-left: 12px;
  padding-left: 34px !important;
}

:deep(.menu-panel .el-menu-item.is-active) {
  background: rgba(52, 211, 153, 0.18);
  color: #dcfce7;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
}

.header-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  text-align: left;
  user-select: text;
}

.notification-item.is-unread {
  border-color: rgba(220, 38, 38, 0.32);
  background: #fff7ed;
}

.notification-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.notification-actions {
  display: inline-flex;
  flex-shrink: 0;
  gap: 8px;
  user-select: none;
}

.notification-title {
  font-size: 14px;
  font-weight: 700;
  user-select: text;
}

.notification-meta {
  color: #64748b;
  font-size: 12px;
  user-select: text;
}

.notification-content {
  white-space: pre-wrap;
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
  user-select: text;
  cursor: text;
}

.layout-main {
  padding: 28px;
}

.navigation-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.navigation-tab {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  height: 34px;
  max-width: 220px;
  padding: 0 6px 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  color: #475569;
  font-size: 13px;
  line-height: 1;
}

.navigation-tab-label {
  overflow: hidden;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigation-tab:hover {
  border-color: rgba(15, 118, 110, 0.34);
  color: #0f766e;
}

.navigation-tab.is-active {
  border-color: rgba(15, 118, 110, 0.32);
  background: #f0fdfa;
  color: #0f766e;
  font-weight: 700;
}

.navigation-tab-close {
  display: inline-grid;
  width: 16px;
  height: 16px;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.navigation-tab-close:hover {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}
</style>
