<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { fetchProjects } from '@/api/project'
import type { ProjectSummary } from '@/types/work-item'

const loading = ref(false)
const projects = ref<ProjectSummary[]>([])
const filters = reactive({
  keyword: '',
  status: '',
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

onMounted(loadProjects)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目管理</h1>
        <p class="page-desc">所有工作项必须归属项目，运维事项也不例外。</p>
      </div>
      <el-button type="primary" disabled>新增项目</el-button>
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
</template>

<style scoped>
.table-card {
  padding: 24px;
}
</style>
