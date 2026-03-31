<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { menuItems } from '@/constants/menu'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)

function handleSelect(path: string) {
  router.push(path)
}

function logout() {
  authStore.signOut()
  router.push('/login')
}
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
        class="menu-panel"
        @select="handleSelect"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.key"
          :index="item.path"
        >
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div>
          <div class="header-title">{{ route.meta.title ?? 'WorkHub' }}</div>
          <div class="header-subtitle">以项目归口，用待整理箱承接企微和人工录入</div>
        </div>

        <div class="header-actions">
          <el-tag type="success" effect="dark">{{ authStore.userName || '未登录' }}</el-tag>
          <el-button type="primary" plain @click="logout">退出</el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
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

:deep(.menu-panel .el-menu-item.is-active) {
  background: rgba(52, 211, 153, 0.18);
  color: #dcfce7;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 84px;
  padding: 0 28px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.header-subtitle {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.layout-main {
  padding: 28px;
}
</style>
