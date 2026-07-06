<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { fetchLoginLogs, fetchOperationLogs } from '@/api/system'
import type { SysLoginLog, SysOperationLog } from '@/types/system'

const activeTab = ref('login')
const loginLoading = ref(false)
const operationLoading = ref(false)
const loginLogs = ref<SysLoginLog[]>([])
const operationLogs = ref<SysOperationLog[]>([])
const loginFilters = reactive({
  userName: '',
  loginResult: '',
})
const operationFilters = reactive({
  operatorUserName: '',
  permissionCode: '',
  result: '',
})

async function loadLoginLogs() {
  loginLoading.value = true
  try {
    loginLogs.value = await fetchLoginLogs({
      userName: loginFilters.userName || undefined,
      loginResult: loginFilters.loginResult || undefined,
      limit: 200,
    })
  } catch (error) {
    ElMessage.error('加载登录日志失败')
    console.error(error)
  } finally {
    loginLoading.value = false
  }
}

async function loadOperationLogs() {
  operationLoading.value = true
  try {
    operationLogs.value = await fetchOperationLogs({
      operatorUserName: operationFilters.operatorUserName || undefined,
      permissionCode: operationFilters.permissionCode || undefined,
      result: operationFilters.result || undefined,
      limit: 200,
    })
  } catch (error) {
    ElMessage.error('加载操作日志失败')
    console.error(error)
  } finally {
    operationLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadLoginLogs(), loadOperationLogs()])
})
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">权限审计</h1>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="登录日志" name="login">
        <el-form inline class="filter-form" @submit.prevent="loadLoginLogs">
          <el-form-item label="用户名">
            <el-input v-model="loginFilters.userName" clearable placeholder="用户名" @keyup.enter="loadLoginLogs" />
          </el-form-item>
          <el-form-item label="结果">
            <el-select v-model="loginFilters.loginResult" clearable style="width: 140px">
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadLoginLogs">查询</el-button>
          </el-form-item>
        </el-form>
        <el-table v-loading="loginLoading" :data="loginLogs">
          <el-table-column prop="occurredAt" label="时间" width="170" />
          <el-table-column prop="userName" label="用户名" width="140" />
          <el-table-column prop="loginResult" label="结果" width="100" />
          <el-table-column prop="failReason" label="失败原因" min-width="200" show-overflow-tooltip />
          <el-table-column prop="ip" label="IP" width="140" />
          <el-table-column prop="userAgent" label="User-Agent" min-width="260" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="operation">
        <el-form inline class="filter-form" @submit.prevent="loadOperationLogs">
          <el-form-item label="操作人">
            <el-input v-model="operationFilters.operatorUserName" clearable placeholder="操作人" @keyup.enter="loadOperationLogs" />
          </el-form-item>
          <el-form-item label="权限点">
            <el-input v-model="operationFilters.permissionCode" clearable placeholder="权限点" @keyup.enter="loadOperationLogs" />
          </el-form-item>
          <el-form-item label="结果">
            <el-select v-model="operationFilters.result" clearable style="width: 140px">
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadOperationLogs">查询</el-button>
          </el-form-item>
        </el-form>
        <el-table v-loading="operationLoading" :data="operationLogs">
          <el-table-column prop="occurredAt" label="时间" width="170" />
          <el-table-column prop="operatorUserName" label="操作人" width="130" />
          <el-table-column prop="permissionCode" label="权限点" width="180" show-overflow-tooltip />
          <el-table-column prop="actionType" label="动作" width="150" />
          <el-table-column prop="targetType" label="对象" width="130" />
          <el-table-column prop="targetId" label="对象 ID" width="110" />
          <el-table-column prop="result" label="结果" width="90" />
          <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
          <el-table-column prop="ip" label="IP" width="140" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.filter-form {
  margin-top: 12px;
}
</style>
