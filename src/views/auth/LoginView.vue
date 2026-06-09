<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'admin123',
})

async function submit() {
  if (loading.value) {
    return
  }
  loading.value = true
  try {
    await authStore.signIn(form)
    await router.push('/')
  } finally {
    loading.value = false
  }
}

function handlePageKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }
  event.preventDefault()
  void submit()
}

onMounted(() => {
  window.addEventListener('keydown', handlePageKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handlePageKeydown)
})
</script>

<template>
  <div class="login-page">
    <div class="login-panel page-card">
      <div class="eyebrow">WORKHUB</div>
      <h1>项目与工作项协同平台</h1>
      <p>统一收口企微需求、运维事项和人工录入内容，先整理、再确认、再流转。</p>

      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="login-button">
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.25), transparent 26%),
    radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.18), transparent 24%),
    linear-gradient(180deg, #ecfeff 0%, #eff6ff 100%);
}

.login-panel {
  width: 480px;
  padding: 40px;
}

.eyebrow {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.08);
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

h1 {
  margin: 18px 0 10px;
  font-size: 32px;
  line-height: 1.2;
}

p {
  margin: 0 0 28px;
  color: #475569;
  line-height: 1.7;
}

.login-button {
  width: 100%;
  margin-top: 8px;
}
</style>
