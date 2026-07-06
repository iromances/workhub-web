<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createSystemUser,
  fetchSystemRoles,
  fetchSystemUserRoleIds,
  fetchSystemUsers,
  resetSystemUserPassword,
  updateSystemUser,
  updateSystemUserRoles,
  updateSystemUserStatus,
} from '@/api/system'
import { useAuthStore } from '@/stores/auth'
import type { SysRole, SysUser, SysUserSaveRequest } from '@/types/system'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const roleDialogVisible = ref(false)
const userDialogVisible = ref(false)
const oneTimePasswordVisible = ref(false)
const users = ref<SysUser[]>([])
const roles = ref<SysRole[]>([])
const editingUser = ref<SysUser | null>(null)
const roleEditingUser = ref<SysUser | null>(null)
const selectedRoleIds = ref<number[]>([])
const oneTimePassword = ref('')
const filters = reactive({
  keyword: '',
  status: '',
})
const form = reactive<SysUserSaveRequest>({
  userName: '',
  displayName: '',
  email: '',
  mobile: '',
  wecomUserid: '',
  avatarUrl: '',
  status: 'ACTIVE',
})

const roleOptions = computed(() => roles.value.map((role) => ({
  label: `${role.roleName} (${role.roleCode})`,
  value: role.id,
})))

const canCreate = computed(() => authStore.hasAnyPermission(['system:user:create', 'system:user:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['system:user:update', 'system:user:manage']))
const canUpdateStatus = computed(() => authStore.hasAnyPermission(['system:user:status', 'system:user:manage']))
const canResetPassword = computed(() => authStore.hasAnyPermission(['system:user:reset-password', 'system:user:manage']))
const canAssignRole = computed(() => authStore.hasAnyPermission(['system:user:assign-role', 'system:user:manage']))

async function loadUsers() {
  loading.value = true
  try {
    users.value = await fetchSystemUsers({
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
    })
  } catch (error) {
    ElMessage.error('加载账号失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  roles.value = await fetchSystemRoles()
}

function resetForm() {
  editingUser.value = null
  form.userName = ''
  form.displayName = ''
  form.email = ''
  form.mobile = ''
  form.wecomUserid = ''
  form.avatarUrl = ''
  form.status = 'ACTIVE'
}

function openCreate() {
  resetForm()
  userDialogVisible.value = true
}

function openEdit(row: SysUser) {
  editingUser.value = row
  form.userName = row.userName
  form.displayName = row.displayName
  form.email = row.email || ''
  form.mobile = row.mobile || ''
  form.wecomUserid = row.wecomUserid || ''
  form.avatarUrl = row.avatarUrl || ''
  form.status = row.status
  userDialogVisible.value = true
}

async function submitUser() {
  if (!form.userName?.trim() || !form.displayName?.trim()) {
    ElMessage.warning('请填写用户名和展示名')
    return
  }
  submitting.value = true
  try {
    if (editingUser.value) {
      await updateSystemUser(editingUser.value.id, normalizeUserRequest())
      ElMessage.success('账号已保存')
    } else {
      const result = await createSystemUser(normalizeUserRequest())
      oneTimePassword.value = result.initialPassword
      oneTimePasswordVisible.value = true
      ElMessage.success('账号已创建')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error('保存账号失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(row: SysUser) {
  const nextStatus = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await updateSystemUserStatus(row.id, nextStatus)
    ElMessage.success('账号状态已更新')
    await loadUsers()
  } catch (error) {
    ElMessage.error('更新账号状态失败')
    console.error(error)
  }
}

async function resetPassword(row: SysUser) {
  try {
    await ElMessageBox.confirm(`确认重置 ${row.displayName} 的密码？`, '重置密码', { type: 'warning' })
    oneTimePassword.value = await resetSystemUserPassword(row.id)
    oneTimePasswordVisible.value = true
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重置密码失败')
      console.error(error)
    }
  }
}

async function openRoles(row: SysUser) {
  roleEditingUser.value = row
  await loadRoles()
  selectedRoleIds.value = await fetchSystemUserRoleIds(row.id)
  roleDialogVisible.value = true
}

async function submitRoles() {
  if (!roleEditingUser.value) {
    return
  }
  submitting.value = true
  try {
    await updateSystemUserRoles(roleEditingUser.value.id, selectedRoleIds.value)
    ElMessage.success('账号角色已保存')
    roleDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error('保存账号角色失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function copyPassword() {
  await navigator.clipboard.writeText(oneTimePassword.value)
  ElMessage.success('一次性密码已复制')
}

function normalizeUserRequest(): SysUserSaveRequest {
  return {
    userName: form.userName.trim(),
    displayName: form.displayName.trim(),
    email: form.email?.trim() || undefined,
    mobile: form.mobile?.trim() || undefined,
    wecomUserid: form.wecomUserid?.trim() || undefined,
    avatarUrl: form.avatarUrl?.trim() || undefined,
    status: form.status || 'ACTIVE',
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles()])
})
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">账号管理</h1>
      </div>
      <el-button v-if="canCreate" type="primary" @click="openCreate">新增账号</el-button>
    </div>

    <el-form inline class="filter-form" @submit.prevent="loadUsers">
      <el-form-item label="关键字">
        <el-input v-model="filters.keyword" clearable placeholder="用户名 / 展示名" @keyup.enter="loadUsers" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable style="width: 140px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadUsers">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="users">
      <el-table-column prop="userName" label="用户名" width="140" />
      <el-table-column prop="displayName" label="展示名" width="150" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="220">
        <template #default="{ row }">
          <el-tag v-for="role in row.roleCodes" :key="role" class="role-tag" size="small">{{ role }}</el-tag>
          <span v-if="!row.roleCodes?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="170" />
      <el-table-column prop="lastLoginIp" label="登录 IP" width="130" />
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="canAssignRole" link type="primary" @click="openRoles(row)">角色</el-button>
          <el-button v-if="canResetPassword" link type="primary" @click="resetPassword(row)">重置密码</el-button>
          <el-button v-if="canUpdateStatus" link :type="row.status === 'ACTIVE' ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="userDialogVisible" title="账号" width="560px">
    <el-form label-position="top">
      <el-form-item label="用户名">
        <el-input v-model="form.userName" :disabled="Boolean(editingUser)" />
      </el-form-item>
      <el-form-item label="展示名">
        <el-input v-model="form.displayName" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="form.mobile" />
      </el-form-item>
      <el-form-item label="企业微信用户 ID">
        <el-input v-model="form.wecomUserid" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 100%">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="userDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitUser">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="roleDialogVisible" title="分配角色" width="520px">
    <el-select v-model="selectedRoleIds" multiple filterable style="width: 100%">
      <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
    </el-select>
    <template #footer>
      <el-button @click="roleDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitRoles">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="oneTimePasswordVisible" title="一次性密码" width="460px">
    <el-input :model-value="oneTimePassword" readonly>
      <template #append>
        <el-button @click="copyPassword">复制</el-button>
      </template>
    </el-input>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.filter-form {
  margin-top: 16px;
}

.role-tag {
  margin-right: 6px;
}
</style>
