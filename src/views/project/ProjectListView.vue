<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { createProject, fetchProjects } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type { ProjectSummary } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const projects = ref<ProjectSummary[]>([])
const createDialogVisible = ref(false)
const filters = reactive({
  keyword: '',
  status: '',
})
const createForm = reactive({
  code: '',
  name: '',
  type: '业务项目',
  ownerUserName: '',
  status: '进行中',
  description: '',
})

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await fetchProjects({
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
    })
  } catch (error) {
    ElMessage.error('加载项目列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function resetCreateForm() {
  createForm.code = ''
  createForm.name = ''
  createForm.type = '业务项目'
  createForm.ownerUserName = authStore.userName || ''
  createForm.status = '进行中'
  createForm.description = ''
}

function openCreateDialog() {
  resetCreateForm()
  createDialogVisible.value = true
}

async function submitCreate() {
  if (!createForm.code.trim() || !createForm.name.trim() || !createForm.type.trim() || !createForm.ownerUserName.trim()) {
    ElMessage.warning('请填写完整的项目编码、项目名称、类型和负责人')
    return
  }
  submitting.value = true
  try {
    await createProject({
      code: createForm.code.trim(),
      name: createForm.name.trim(),
      type: createForm.type.trim(),
      ownerUserName: createForm.ownerUserName.trim(),
      status: createForm.status.trim(),
      description: createForm.description.trim() || undefined,
    })
    ElMessage.success('项目已创建')
    createDialogVisible.value = false
    await loadProjects()
  } catch (error) {
    ElMessage.error('新增项目失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

onMounted(loadProjects)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目管理</h1>
        <p class="page-desc">所有工作项必须归属项目，运维事项也不例外。</p>
      </div>
      <el-button type="primary" @click="openCreateDialog">新增项目</el-button>
    </div>

    <el-form inline @submit.prevent="loadProjects">
      <el-form-item>
        <el-input v-model="filters.keyword" placeholder="按项目名称或编码搜索" clearable />
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 160px">
          <el-option label="规划中" value="规划中" />
          <el-option label="进行中" value="进行中" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadProjects">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="projects">
      <el-table-column prop="code" label="项目编码" width="150" />
      <el-table-column prop="name" label="项目名称" min-width="240" />
      <el-table-column prop="type" label="类型" width="120" />
      <el-table-column prop="ownerUserName" label="负责人" width="120" />
      <el-table-column prop="status" label="状态" width="120" />
    </el-table>
  </div>

  <el-dialog v-model="createDialogVisible" title="新增项目" width="560px">
    <el-form label-position="top">
      <el-form-item label="项目编码">
        <el-input v-model="createForm.code" placeholder="例如 WORKHUB" />
      </el-form-item>
      <el-form-item label="项目名称">
        <el-input v-model="createForm.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item label="项目类型">
        <el-select v-model="createForm.type" style="width: 100%">
          <el-option label="业务项目" value="业务项目" />
          <el-option label="平台项目" value="平台项目" />
          <el-option label="运维项目" value="运维项目" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="createForm.ownerUserName" placeholder="请输入负责人用户名" />
      </el-form-item>
      <el-form-item label="项目状态">
        <el-select v-model="createForm.status" style="width: 100%">
          <el-option label="规划中" value="规划中" />
          <el-option label="进行中" value="进行中" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="可选，补充项目说明" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCreate">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}
</style>
