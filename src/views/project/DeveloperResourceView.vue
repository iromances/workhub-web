<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import {
  createDeveloperResource,
  deleteDeveloperResource,
  fetchDeveloperResources,
  updateDeveloperResource,
} from '@/api/system-config'
import type { DeveloperResource } from '@/types/work-item'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const developers = ref<DeveloperResource[]>([])
const filters = reactive({
  keyword: '',
})
const form = reactive({
  userName: '',
  displayName: '',
  enabled: true,
  remark: '',
})

async function loadDevelopers() {
  loading.value = true
  try {
    developers.value = await fetchDeveloperResources({
      keyword: filters.keyword || undefined,
    })
  } catch (error) {
    ElMessage.error('加载研发人员失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.userName = ''
  form.displayName = ''
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: DeveloperResource) {
  editingId.value = row.id
  form.userName = row.userName
  form.displayName = row.displayName
  form.enabled = row.enabled
  form.remark = row.remark || ''
  dialogVisible.value = true
}

async function submit() {
  if (!form.userName.trim() || !form.displayName.trim()) {
    ElMessage.warning('请填写研发人员用户名和名称')
    return
  }
  submitting.value = true
  try {
    const request = {
      userName: form.userName.trim(),
      displayName: form.displayName.trim(),
      enabled: form.enabled,
      remark: form.remark.trim() || undefined,
    }
    if (editingId.value) {
      await updateDeveloperResource(editingId.value, request)
    } else {
      await createDeveloperResource(request)
    }
    ElMessage.success('研发人员已保存')
    dialogVisible.value = false
    await loadDevelopers()
  } catch (error) {
    ElMessage.error('保存研发人员失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function deleteDeveloper(row: DeveloperResource) {
  try {
    await ElMessageBox.confirm(`确认删除研发人员 ${row.userName}？`, '删除研发人员', { type: 'warning' })
    await deleteDeveloperResource(row.id)
    ElMessage.success('研发人员已删除')
    await loadDevelopers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除研发人员失败')
      console.error(error)
    }
  }
}

onMounted(loadDevelopers)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">研发人员资源</h1>
        <p class="page-desc">维护任务评估负责人下拉框的独立人员资源，不和项目或业务线绑定。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增研发人员</el-button>
    </div>

    <el-form inline class="filter-form" @submit.prevent="loadDevelopers">
      <el-form-item label="关键字">
        <el-input
          v-model="filters.keyword"
          placeholder="用户名 / 名称"
          clearable
          @keyup.enter="loadDevelopers"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadDevelopers">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="developers">
      <el-table-column prop="userName" label="用户名" width="180" />
      <el-table-column prop="displayName" label="名称" width="180" />
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="deleteDeveloper(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" title="研发人员" width="520px">
    <el-form label-position="top">
      <el-form-item label="用户名">
        <el-input v-model="form.userName" placeholder="例如 zhangsan" />
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.displayName" placeholder="例如 张三" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="是否启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
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
</style>
