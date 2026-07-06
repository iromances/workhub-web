<script setup lang="ts">
import type { ElTree } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createSystemRole,
  deleteSystemRole,
  fetchSystemPermissions,
  fetchSystemRolePermissions,
  fetchSystemRoles,
  updateSystemRole,
  updateSystemRolePermissions,
  updateSystemRoleStatus,
} from '@/api/system'
import { useAuthStore } from '@/stores/auth'
import type { SysPermission, SysRole, SysRoleSaveRequest } from '@/types/system'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const roleDialogVisible = ref(false)
const permissionDialogVisible = ref(false)
const roles = ref<SysRole[]>([])
const permissions = ref<SysPermission[]>([])
const editingRole = ref<SysRole | null>(null)
const permissionEditingRole = ref<SysRole | null>(null)
const permissionTreeRef = ref<InstanceType<typeof ElTree>>()
const checkedPermissionCodes = ref<string[]>([])
const filters = reactive({
  keyword: '',
})
const form = reactive<SysRoleSaveRequest>({
  roleCode: '',
  roleName: '',
  enabled: true,
  remark: '',
})

const treeProps = {
  label: 'permissionName',
  children: 'children',
}

const permissionData = computed(() => permissions.value)
const canCreate = computed(() => authStore.hasAnyPermission(['system:role:create', 'system:role:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['system:role:update', 'system:role:manage']))
const canUpdateStatus = computed(() => authStore.hasAnyPermission(['system:role:status', 'system:role:manage']))
const canDelete = computed(() => authStore.hasAnyPermission(['system:role:delete', 'system:role:manage']))
const canAssignPermission = computed(() => authStore.hasAnyPermission(['system:role:assign-permission', 'system:role:manage']))

async function loadRoles() {
  loading.value = true
  try {
    roles.value = await fetchSystemRoles({ keyword: filters.keyword || undefined })
  } catch (error) {
    ElMessage.error('加载角色失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadPermissions() {
  permissions.value = await fetchSystemPermissions()
}

function resetForm() {
  editingRole.value = null
  form.roleCode = ''
  form.roleName = ''
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  roleDialogVisible.value = true
}

function openEdit(row: SysRole) {
  editingRole.value = row
  form.roleCode = row.roleCode
  form.roleName = row.roleName
  form.enabled = row.enabled
  form.remark = row.remark || ''
  roleDialogVisible.value = true
}

async function submitRole() {
  if (!form.roleCode.trim() || !form.roleName.trim()) {
    ElMessage.warning('请填写角色编码和角色名称')
    return
  }
  submitting.value = true
  try {
    const request = normalizeRoleRequest()
    if (editingRole.value) {
      await updateSystemRole(editingRole.value.id, request)
    } else {
      await createSystemRole(request)
    }
    ElMessage.success('角色已保存')
    roleDialogVisible.value = false
    await loadRoles()
  } catch (error) {
    ElMessage.error('保存角色失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function toggleRole(row: SysRole) {
  try {
    await updateSystemRoleStatus(row.id, !row.enabled)
    ElMessage.success('角色状态已更新')
    await loadRoles()
  } catch (error) {
    ElMessage.error('更新角色状态失败')
    console.error(error)
  }
}

async function removeRole(row: SysRole) {
  try {
    await ElMessageBox.confirm(`确认删除角色 ${row.roleName}？`, '删除角色', { type: 'warning' })
    await deleteSystemRole(row.id)
    ElMessage.success('角色已删除')
    await loadRoles()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除角色失败')
      console.error(error)
    }
  }
}

async function openPermissions(row: SysRole) {
  permissionEditingRole.value = row
  await loadPermissions()
  checkedPermissionCodes.value = await fetchSystemRolePermissions(row.id)
  permissionDialogVisible.value = true
  requestAnimationFrame(() => {
    permissionTreeRef.value?.setCheckedKeys(checkedPermissionCodes.value)
  })
}

async function submitPermissions() {
  if (!permissionEditingRole.value) {
    return
  }
  submitting.value = true
  try {
    const checked = permissionTreeRef.value?.getCheckedKeys(false).map(String) || []
    const halfChecked = permissionTreeRef.value?.getHalfCheckedKeys().map(String) || []
    await updateSystemRolePermissions(permissionEditingRole.value.id, [...new Set([...checked, ...halfChecked])])
    ElMessage.success('角色权限已保存')
    permissionDialogVisible.value = false
  } catch (error) {
    ElMessage.error('保存角色权限失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function normalizeRoleRequest(): SysRoleSaveRequest {
  return {
    roleCode: form.roleCode.trim(),
    roleName: form.roleName.trim(),
    enabled: form.enabled,
    remark: form.remark?.trim() || undefined,
  }
}

function permissionTypeLabel(type: string) {
  if (type === 'MENU') {
    return '菜单'
  }
  if (type === 'BUTTON') {
    return '按钮'
  }
  return '接口'
}

function permissionTypeTag(type: string) {
  if (type === 'MENU') {
    return 'success'
  }
  if (type === 'BUTTON') {
    return 'primary'
  }
  return 'info'
}

onMounted(async () => {
  await Promise.all([loadRoles(), loadPermissions()])
})
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">角色管理</h1>
      </div>
      <el-button v-if="canCreate" type="primary" @click="openCreate">新增角色</el-button>
    </div>

    <el-form inline class="filter-form" @submit.prevent="loadRoles">
      <el-form-item label="关键字">
        <el-input v-model="filters.keyword" clearable placeholder="角色编码 / 名称" @keyup.enter="loadRoles" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadRoles">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="roles">
      <el-table-column prop="roleCode" label="角色编码" width="180" />
      <el-table-column prop="roleName" label="角色名称" width="160" />
      <el-table-column label="内置" width="90">
        <template #default="{ row }">
          <el-tag :type="row.builtIn ? 'warning' : 'info'">{{ row.builtIn ? '内置' : '自定义' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="canAssignPermission" link type="primary" @click="openPermissions(row)">权限</el-button>
          <el-button v-if="canUpdateStatus" link :type="row.enabled ? 'warning' : 'success'" @click="toggleRole(row)">
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
          <el-button v-if="canDelete && !row.builtIn" link type="danger" @click="removeRole(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="roleDialogVisible" title="角色" width="560px">
    <el-form label-position="top">
      <el-form-item label="角色编码">
        <el-input v-model="form.roleCode" :disabled="Boolean(editingRole?.builtIn)" />
      </el-form-item>
      <el-form-item label="角色名称">
        <el-input v-model="form.roleName" />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="roleDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitRole">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="permissionDialogVisible" title="配置权限" width="640px">
    <el-tree
      ref="permissionTreeRef"
      :data="permissionData"
      :props="treeProps"
      node-key="permissionCode"
      show-checkbox
      default-expand-all
    >
      <template #default="{ data }">
        <span class="permission-node">
          <span class="permission-node-name">{{ data.permissionName }}</span>
          <el-tag class="permission-node-type" size="small" :type="permissionTypeTag(data.permissionType)" effect="plain">
            {{ permissionTypeLabel(data.permissionType) }}
          </el-tag>
          <span class="permission-node-code">{{ data.permissionCode }}</span>
        </span>
      </template>
    </el-tree>
    <template #footer>
      <el-button @click="permissionDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitPermissions">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.filter-form {
  margin-top: 16px;
}

.permission-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.permission-node-name {
  min-width: 120px;
}

.permission-node-code {
  color: #909399;
  font-size: 12px;
}
</style>
