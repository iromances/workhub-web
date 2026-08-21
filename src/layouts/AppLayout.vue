<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDown, Bell } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import { changePassword } from '@/api/auth'
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
const visibleMenuItems = computed(() => filterMenuItems(menuItems))
const defaultOpeneds = computed(() =>
  visibleMenuItems.value
    .filter((item) => item.children?.length)
    .map((item) => item.path),
)
const navItems = ref<MenuItem[]>([])

const flattenedMenuItems = computed(() => {
  const items: MenuItem[] = []
  for (const item of visibleMenuItems.value) {
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
const passwordDialogVisible = ref(false)
const profileDialogVisible = ref(false)
const passwordSubmitting = ref(false)
const profileSubmitting = ref(false)
const avatarUploading = ref(false)
const notificationReadAllSubmitting = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const notifications = ref<NotificationItem[]>([])
const unreadNotificationCount = ref(0)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const profileForm = ref({
  displayName: '',
})

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

function filterMenuItems(items: MenuItem[]): MenuItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const children = filterMenuItems(item.children)
        return children.length ? { ...item, children } : null
      }
      return authStore.hasPermission(item.permission) ? item : null
    })
    .filter((item): item is MenuItem => Boolean(item))
}

function logout() {
  authStore.signOut()
  router.push('/login')
}

function handleUserCommand(command: string) {
  if (command === 'profile') {
    openProfileDialog()
    return
  }
  if (command === 'password') {
    openPasswordDialog()
    return
  }
  if (command === 'logout') {
    logout()
  }
}

function openProfileDialog() {
  profileForm.value = {
    displayName: authStore.displayName || authStore.userName,
  }
  profileDialogVisible.value = true
}

function openPasswordDialog() {
  passwordForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
  passwordDialogVisible.value = true
}

async function submitProfile() {
  if (!profileForm.value.displayName.trim()) {
    ElMessage.warning('请填写昵称')
    return
  }
  profileSubmitting.value = true
  try {
    await authStore.updateProfile({
      displayName: profileForm.value.displayName.trim(),
    })
    ElMessage.success('个人信息已保存')
    profileDialogVisible.value = false
  } catch (error) {
    ElMessage.error('保存个人信息失败')
    console.error(error)
  } finally {
    profileSubmitting.value = false
  }
}

function openAvatarPicker() {
  avatarInputRef.value?.click()
}

async function handleAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像文件不能超过 2MB')
    input.value = ''
    return
  }
  avatarUploading.value = true
  try {
    await authStore.uploadAvatar(file)
    ElMessage.success('头像已上传')
  } catch (error) {
    ElMessage.error('头像上传失败')
    console.error(error)
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

async function submitPassword() {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    ElMessage.warning('请填写旧密码和新密码')
    return
  }
  if (passwordForm.value.newPassword.length < 8) {
    ElMessage.warning('新密码至少 8 位')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  passwordSubmitting.value = true
  try {
    await changePassword({
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
    })
    ElMessage.success('密码已修改')
    passwordDialogVisible.value = false
    await authStore.loadProfile()
  } catch (error) {
    ElMessage.error('修改密码失败')
    console.error(error)
  } finally {
    passwordSubmitting.value = false
  }
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
  if (notifications.value.length === 0 || notificationReadAllSubmitting.value) {
    return
  }
  notificationReadAllSubmitting.value = true
  try {
    await markAllNotificationsRead()
    notifications.value = []
    unreadNotificationCount.value = 0
    ElMessage.success('站内信已全部标记为已读')
  } catch (error) {
    ElMessage.error('全部已读操作失败')
    console.error(error)
  } finally {
    notificationReadAllSubmitting.value = false
  }
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
        <template v-for="item in visibleMenuItems" :key="item.key">
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
        <div class="header-actions">
          <el-tooltip content="通知" placement="bottom">
            <el-badge :value="unreadNotificationCount" :hidden="unreadNotificationCount === 0">
              <el-button circle plain aria-label="通知" @click="openNotifications">
                <el-icon><Bell /></el-icon>
              </el-button>
            </el-badge>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleUserCommand">
            <button class="user-menu-trigger" type="button">
              <img
                v-if="authStore.avatarDisplayUrl"
                class="user-menu-avatar"
                :src="authStore.avatarDisplayUrl"
                alt=""
              >
              <span class="user-menu-name">{{ authStore.userName || '未登录' }}</span>
              <el-icon class="user-menu-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main">
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
        <el-button
          size="small"
          type="primary"
          plain
          :loading="notificationReadAllSubmitting"
          :disabled="notifications.length === 0"
          @click="readAllNotifications"
        >
          全部已读
        </el-button>
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

    <el-dialog v-model="profileDialogVisible" title="个人信息" width="420px">
      <el-form label-position="top">
        <el-form-item label="头像">
          <div class="profile-avatar-row">
            <img
              v-if="authStore.avatarDisplayUrl"
              class="profile-avatar-image"
              :src="authStore.avatarDisplayUrl"
              alt=""
            >
            <div v-else class="profile-avatar-placeholder">
              {{ (authStore.userName || 'WH').slice(0, 2).toUpperCase() }}
            </div>
            <div class="profile-avatar-actions">
              <el-button :loading="avatarUploading" @click="openAvatarPicker">上传头像</el-button>
              <span class="profile-avatar-meta">PNG、JPG、GIF、WebP，最大 2MB</span>
            </div>
            <input
              ref="avatarInputRef"
              class="profile-avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              @change="handleAvatarSelected"
            >
          </div>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input :model-value="authStore.userName" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="profileForm.displayName" maxlength="64" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="profileSubmitting" @click="submitProfile">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px">
      <el-form label-position="top">
        <el-form-item label="旧密码">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" @click="submitPassword">保存</el-button>
      </template>
    </el-dialog>
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

.header-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 12px;
}

.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(15, 118, 110, 0.24);
  border-radius: 8px;
  background: #f0fdfa;
  color: #0f766e;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.user-menu-avatar {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.user-menu-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-arrow {
  flex: 0 0 auto;
  font-size: 12px;
}

.profile-avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-avatar-image,
.profile-avatar-placeholder {
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: 50%;
}

.profile-avatar-image {
  object-fit: cover;
}

.profile-avatar-placeholder {
  display: grid;
  place-items: center;
  background: #f0fdfa;
  color: #0f766e;
  font-weight: 800;
}

.profile-avatar-actions {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.profile-avatar-meta {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.profile-avatar-input {
  display: none;
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
  min-width: 0;
  flex: 1 1 auto;
  gap: 8px;
  overflow-x: auto;
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
