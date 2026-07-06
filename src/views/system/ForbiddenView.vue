<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="forbidden-page">
    <div class="forbidden-code">403</div>
    <h1>无权限访问</h1>
    <p>当前账号没有进入该页面的权限。</p>
    <el-button type="primary" @click="router.push('/dashboard')">返回工作台</el-button>
  </section>
</template>

<style scoped>
.forbidden-page {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #1f2937;
}

.forbidden-code {
  font-size: 64px;
  font-weight: 700;
  color: #b42318;
}

h1 {
  margin: 0;
  font-size: 24px;
}

p {
  margin: 0 0 8px;
  color: #667085;
}
</style>
