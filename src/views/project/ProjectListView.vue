<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  createProject,
  createProjectGroup,
  createProjectInvolvedSystem,
  deleteProject,
  deleteProjectGroup,
  deleteProjectInvolvedSystem,
  fetchProjectInvolvedSystems,
  fetchProjectDetail,
  fetchProjectGroupPage,
  fetchProjectGroups,
  fetchProjectPage,
  syncProjectGroupInvolvedSystemsFromGit,
  updateProject,
  updateProjectGroup,
  updateProjectInvolvedSystem,
} from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type { ProjectGroup, ProjectInvolvedSystem, ProjectSummary } from '@/types/work-item'

const authStore = useAuthStore()
const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const syncingProjectGroupSystems = ref(false)
const projects = ref<ProjectSummary[]>([])
const total = ref(0)
const projectGroups = ref<ProjectGroup[]>([])
const businessLines = ref<ProjectGroup[]>([])
const businessLineTotal = ref(0)
const middlePlatformSystems = ref<ProjectInvolvedSystem[]>([])
const projectGroupSystems = ref<ProjectInvolvedSystem[]>([])
const createDialogVisible = ref(false)
const groupDialogVisible = ref(false)
const systemDialogVisible = ref(false)
const projectGroupSystemDialogVisible = ref(false)
const editingProjectId = ref<number | null>(null)
const editingGroupId = ref<number | null>(null)
const editingSystemId = ref<number | null>(null)
const currentSystemProjectGroupId = ref<number | null>(null)
const currentSystemProjectGroup = ref('')
const filters = reactive({
  keyword: '',
  businessLine: '',
  status: '',
})
const pagination = reactive({
  page: 1,
  pageSize: 10,
})
const businessLinePagination = reactive({
  page: 1,
  pageSize: 10,
})
const createForm = reactive({
  code: '',
  name: '',
  type: '业务项目',
  group: '',
  ownerUserName: '',
  status: '进行中',
  description: '',
})
const groupForm = reactive({
  groupName: '',
  gitlabGroupName: '',
  description: '',
})
const systemForm = reactive({
  systemScope: 'MIDDLE_PLATFORM' as 'PROJECT_GROUP' | 'MIDDLE_PLATFORM',
  projectGroup: '',
  systemName: '',
  description: '',
  enabled: true,
  sortOrder: 0,
})

const currentSection = computed(() => {
  if (route.name === 'project-business-lines') {
    return 'business-lines'
  }
  if (route.name === 'project-systems') {
    return 'systems'
  }
  return 'projects'
})

async function loadProjects() {
  loading.value = true
  try {
    const response = await fetchProjectPage({
      keyword: filters.keyword || undefined,
      businessLine: filters.businessLine || undefined,
      status: filters.status || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    projects.value = response.items
    total.value = response.total
  } catch (error) {
    ElMessage.error('加载项目列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadProjects()
}

function handlePageChange(page: number) {
  pagination.page = page
  loadProjects()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  loadProjects()
}

async function loadProjectGroups() {
  try {
    projectGroups.value = await fetchProjectGroups()
  } catch (error) {
    ElMessage.error('加载业务线失败')
    console.error(error)
  }
}

async function loadBusinessLines() {
  try {
    const response = await fetchProjectGroupPage({
      page: businessLinePagination.page,
      pageSize: businessLinePagination.pageSize,
    })
    businessLines.value = response.items
    businessLineTotal.value = response.total
  } catch (error) {
    ElMessage.error('加载业务线失败')
    console.error(error)
  }
}

function handleBusinessLinePageChange(page: number) {
  businessLinePagination.page = page
  loadBusinessLines()
}

function handleBusinessLinePageSizeChange(pageSize: number) {
  businessLinePagination.pageSize = pageSize
  businessLinePagination.page = 1
  loadBusinessLines()
}

async function loadMiddlePlatformSystems() {
  try {
    middlePlatformSystems.value = await fetchProjectInvolvedSystems({
      systemScope: 'MIDDLE_PLATFORM',
    })
  } catch (error) {
    ElMessage.error('加载中台系统清单失败')
    console.error(error)
  }
}

async function loadProjectGroupSystems(projectGroup: string) {
  try {
    projectGroupSystems.value = await fetchProjectInvolvedSystems({
      systemScope: 'PROJECT_GROUP',
      projectGroup,
    })
  } catch (error) {
    ElMessage.error('加载业务线系统清单失败')
    console.error(error)
  }
}

function resetCreateForm() {
  editingProjectId.value = null
  createForm.code = ''
  createForm.name = ''
  createForm.type = '业务项目'
  createForm.group = ''
  createForm.ownerUserName = authStore.userName || ''
  createForm.status = '进行中'
  createForm.description = ''
}

function openCreateDialog() {
  resetCreateForm()
  createDialogVisible.value = true
}

async function openEditDialog(project: ProjectSummary) {
  resetCreateForm()
  try {
    const detail = await fetchProjectDetail(project.id)
    editingProjectId.value = detail.id
    createForm.code = detail.code
    createForm.name = detail.name
    createForm.type = detail.type
    createForm.group = detail.group
    createForm.ownerUserName = detail.ownerUserName
    createForm.status = detail.status
    createForm.description = detail.description || ''
    createDialogVisible.value = true
  } catch (error) {
    ElMessage.error('加载项目详情失败')
    console.error(error)
  }
}

function openGroupDialog() {
  editingGroupId.value = null
  groupForm.groupName = ''
  groupForm.gitlabGroupName = ''
  groupForm.description = ''
  groupDialogVisible.value = true
}

function openGroupEditDialog(group: ProjectGroup) {
  editingGroupId.value = group.id
  groupForm.groupName = group.groupName
  groupForm.gitlabGroupName = group.gitlabGroupName || ''
  groupForm.description = group.description || ''
  groupDialogVisible.value = true
}

function resetSystemForm(scope: 'PROJECT_GROUP' | 'MIDDLE_PLATFORM', projectGroup = '') {
  editingSystemId.value = null
  systemForm.systemScope = scope
  systemForm.projectGroup = projectGroup
  systemForm.systemName = ''
  systemForm.description = ''
  systemForm.enabled = true
  systemForm.sortOrder = 0
}

function openMiddleSystemDialog() {
  resetSystemForm('MIDDLE_PLATFORM')
  systemDialogVisible.value = true
}

function openSystemEditDialog(system: ProjectInvolvedSystem) {
  editingSystemId.value = system.id
  systemForm.systemScope = system.systemScope
  systemForm.projectGroup = system.projectGroup
  systemForm.systemName = system.systemName
  systemForm.description = system.description || ''
  systemForm.enabled = system.enabled
  systemForm.sortOrder = system.sortOrder
  systemDialogVisible.value = true
}

async function openProjectGroupSystemsDialog(group: ProjectGroup) {
  currentSystemProjectGroupId.value = group.id
  currentSystemProjectGroup.value = group.groupName
  projectGroupSystemDialogVisible.value = true
  await loadProjectGroupSystems(group.groupName)
}

function openProjectGroupSystemCreateDialog() {
  resetSystemForm('PROJECT_GROUP', currentSystemProjectGroup.value)
  systemDialogVisible.value = true
}

async function syncCurrentProjectGroupSystemsFromGit() {
  if (!currentSystemProjectGroupId.value) {
    ElMessage.warning('请先选择业务线')
    return
  }
  syncingProjectGroupSystems.value = true
  try {
    projectGroupSystems.value = await syncProjectGroupInvolvedSystemsFromGit(currentSystemProjectGroupId.value)
    ElMessage.success('Git 系统清单已同步')
  } catch (error) {
    ElMessage.error('同步 Git 系统清单失败')
    console.error(error)
  } finally {
    syncingProjectGroupSystems.value = false
  }
}

function formatBusinessLine(project: ProjectSummary) {
  const businessLine = project.businessLine?.trim()
  if (businessLine) {
    return businessLine
  }
  const code = project.businessLineCode?.trim()
  const name = project.businessLineName?.trim()
  if (code && name) {
    return `${code} / ${name}`
  }
  return code || name || '-'
}

function formatProjectGroupOption(item: ProjectGroup) {
  return `${item.groupName} / ${item.gitlabGroupName || '未配置 GitLab 组'}`
}

async function submitCreate() {
  if (!createForm.code.trim() || !createForm.name.trim() || !createForm.type.trim() || !createForm.group.trim() || !createForm.ownerUserName.trim()) {
    ElMessage.warning('请填写完整的项目编码、项目名称、类型、业务线和负责人')
    return
  }
  submitting.value = true
  try {
    const payload = {
      code: createForm.code.trim(),
      name: createForm.name.trim(),
      type: createForm.type.trim(),
      group: createForm.group.trim(),
      ownerUserName: createForm.ownerUserName.trim(),
      status: createForm.status.trim(),
      description: createForm.description.trim() || undefined,
    }
    if (editingProjectId.value) {
      await updateProject(editingProjectId.value, payload)
      ElMessage.success('项目已更新')
    } else {
      await createProject(payload)
      ElMessage.success('项目已创建')
    }
    createDialogVisible.value = false
    await loadProjects()
  } catch (error) {
    ElMessage.error('新增项目失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function handleDeleteProject(project: ProjectSummary) {
  try {
    await ElMessageBox.confirm(`确定删除项目“${project.name}”吗？已有业务数据引用的项目不会被删除。`, '删除项目', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteProject(project.id)
    ElMessage.success('项目已删除')
    await loadProjects()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除项目失败')
      console.error(error)
    }
  }
}

async function submitGroupCreate() {
  if (!groupForm.groupName.trim()) {
    ElMessage.warning('请填写业务线名称')
    return
  }
  submitting.value = true
  try {
    const payload = {
      groupName: groupForm.groupName.trim(),
      gitlabGroupName: groupForm.gitlabGroupName.trim() || undefined,
      description: groupForm.description.trim() || undefined,
      enabled: true,
    }
    if (editingGroupId.value) {
      await updateProjectGroup(editingGroupId.value, payload)
      ElMessage.success('业务线已更新')
    } else {
      await createProjectGroup(payload)
      ElMessage.success('业务线已创建')
    }
    groupDialogVisible.value = false
    await Promise.all([loadProjectGroups(), loadBusinessLines()])
  } catch (error) {
    ElMessage.error('新增业务线失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function handleDeleteGroup(group: ProjectGroup) {
  try {
    await ElMessageBox.confirm(`确定删除业务线“${group.groupName}”吗？已有项目或成员引用的业务线不会被删除。`, '删除业务线', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteProjectGroup(group.id)
    ElMessage.success('业务线已删除')
    await Promise.all([loadProjectGroups(), loadBusinessLines()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除业务线失败')
      console.error(error)
    }
  }
}

async function submitSystem() {
  if (!systemForm.systemName.trim()) {
    ElMessage.warning('请填写系统名称')
    return
  }
  if (systemForm.systemScope === 'PROJECT_GROUP' && !systemForm.projectGroup.trim()) {
    ElMessage.warning('业务线系统必须指定业务线')
    return
  }
  submitting.value = true
  try {
    const payload = {
      systemScope: systemForm.systemScope,
      projectGroup: systemForm.systemScope === 'PROJECT_GROUP' ? systemForm.projectGroup.trim() : undefined,
      systemName: systemForm.systemName.trim(),
      description: systemForm.description.trim() || undefined,
      enabled: systemForm.enabled,
      sortOrder: systemForm.sortOrder || 0,
    }
    if (editingSystemId.value) {
      await updateProjectInvolvedSystem(editingSystemId.value, payload)
      ElMessage.success('涉及系统已更新')
    } else {
      await createProjectInvolvedSystem(payload)
      ElMessage.success('涉及系统已创建')
    }
    systemDialogVisible.value = false
    if (systemForm.systemScope === 'PROJECT_GROUP') {
      await loadProjectGroupSystems(systemForm.projectGroup)
    } else {
      await loadMiddlePlatformSystems()
    }
  } catch (error) {
    ElMessage.error('保存涉及系统失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function handleDeleteSystem(system: ProjectInvolvedSystem) {
  try {
    await ElMessageBox.confirm(`确定删除涉及系统“${system.systemName}”吗？已被研发任务使用的系统不能删除。`, '删除涉及系统', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteProjectInvolvedSystem(system.id)
    ElMessage.success('涉及系统已删除')
    if (system.systemScope === 'PROJECT_GROUP') {
      await loadProjectGroupSystems(system.projectGroup)
    } else {
      await loadMiddlePlatformSystems()
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除涉及系统失败')
      console.error(error)
    }
  }
}

onMounted(async () => {
  await Promise.all([loadProjectGroups(), loadBusinessLines(), loadProjects(), loadMiddlePlatformSystems()])
})
</script>

<template>
  <div v-if="currentSection === 'projects'" class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目列表</h1>
        <p class="page-desc">所有工作项必须归属项目，运维事项也不例外。</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openCreateDialog">新增项目</el-button>
      </div>
    </div>

    <el-form inline @submit.prevent="handleSearch">
      <el-form-item label="关键字">
        <el-input
          v-model="filters.keyword"
          placeholder="按项目名称或编码搜索"
          clearable
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="业务线">
        <el-select v-model="filters.businessLine" placeholder="业务线" clearable filterable style="width: 220px">
          <el-option
            v-for="item in projectGroups"
            :key="item.id"
            :label="formatProjectGroupOption(item)"
            :value="item.groupName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 160px">
          <el-option label="规划中" value="规划中" />
          <el-option label="进行中" value="进行中" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="projects">
      <el-table-column label="业务线" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatBusinessLine(row) }}
        </template>
      </el-table-column>
      <el-table-column label="项目" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="project-cell">
            <span class="project-cell-name">{{ row.name }}</span>
            <span class="project-cell-code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="120" />
      <el-table-column prop="ownerUserName" label="负责人" width="120" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteProject(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </div>
  </div>

  <el-dialog v-model="createDialogVisible" :title="editingProjectId ? '编辑项目' : '新增项目'" width="560px">
    <el-form label-position="top">
      <el-form-item label="项目编码">
        <el-input v-model="createForm.code" placeholder="例如 WORKHUB-SERVER" />
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
      <el-form-item label="业务线">
        <el-select v-model="createForm.group" filterable allow-create default-first-option style="width: 100%" placeholder="请选择或输入项目所属业务线">
          <el-option
            v-for="item in projectGroups"
            :key="item.id"
            :label="formatProjectGroupOption(item)"
            :value="item.groupName"
          >
            <div class="project-group-option">
              <span class="project-group-option-name">{{ item.groupName }}</span>
              <span class="project-group-option-meta">{{ item.gitlabGroupName || '未配置 GitLab 组' }}</span>
            </div>
          </el-option>
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

  <div v-if="currentSection === 'business-lines'" class="page-card table-card project-group-card">
    <div class="section-header">
      <div>
        <h1 class="page-title">业务线</h1>
        <p class="section-desc">维护业务线与 GitLab 组名，AI 任务评估会用它辅助匹配代码仓库。</p>
      </div>
      <el-button @click="openGroupDialog">新增业务线</el-button>
    </div>
    <el-table :data="businessLines">
      <el-table-column prop="groupName" label="业务线" min-width="180" />
      <el-table-column prop="gitlabGroupName" label="GitLab 组名" min-width="220" show-overflow-tooltip />
      <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          {{ row.enabled ? '启用' : '停用' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openGroupEditDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="openProjectGroupSystemsDialog(row)">系统</el-button>
          <el-button link type="danger" @click="handleDeleteGroup(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        :current-page="businessLinePagination.page"
        :page-size="businessLinePagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="businessLineTotal"
        background
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handleBusinessLinePageChange"
        @size-change="handleBusinessLinePageSizeChange"
      />
    </div>
  </div>

  <div v-if="currentSection === 'systems'" class="page-card table-card project-group-card">
    <div class="section-header">
      <div>
        <h1 class="page-title">中台系统管理</h1>
        <p class="section-desc">所有业务线的研发任务都可以选择启用中的中台系统。</p>
      </div>
      <el-button @click="openMiddleSystemDialog">新增中台系统</el-button>
    </div>
    <el-table :data="middlePlatformSystems">
      <el-table-column prop="systemName" label="系统名称" min-width="180" />
      <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          {{ row.enabled ? '启用' : '停用' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openSystemEditDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteSystem(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="groupDialogVisible" :title="editingGroupId ? '编辑业务线' : '新增业务线'" width="520px">
    <el-form label-position="top">
      <el-form-item label="业务线名称">
        <el-input v-model="groupForm.groupName" placeholder="例如 数智金融" />
      </el-form-item>
      <el-form-item label="GitLab 组名">
        <el-input v-model="groupForm.gitlabGroupName" placeholder="例如 digital-finance 或 group/subgroup" />
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="groupForm.description" type="textarea" :rows="3" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="groupDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitGroupCreate">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="projectGroupSystemDialogVisible" :title="`业务线系统清单 - ${currentSystemProjectGroup}`" width="760px">
    <div class="dialog-toolbar">
      <el-button :loading="syncingProjectGroupSystems" @click="syncCurrentProjectGroupSystemsFromGit">从 Git 同步</el-button>
      <el-button type="primary" @click="openProjectGroupSystemCreateDialog">新增业务线系统</el-button>
    </div>
    <el-table :data="projectGroupSystems">
      <el-table-column prop="systemName" label="系统名称" min-width="180" />
      <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          {{ row.enabled ? '启用' : '停用' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openSystemEditDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteSystem(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog v-model="systemDialogVisible" :title="editingSystemId ? '编辑涉及系统' : '新增涉及系统'" width="520px">
    <el-form label-position="top">
      <el-form-item label="系统范围">
        <el-select v-model="systemForm.systemScope" style="width: 100%" :disabled="Boolean(editingSystemId)">
          <el-option label="业务线系统" value="PROJECT_GROUP" />
          <el-option label="中台系统" value="MIDDLE_PLATFORM" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="systemForm.systemScope === 'PROJECT_GROUP'" label="业务线">
        <el-input v-model="systemForm.projectGroup" disabled />
      </el-form-item>
      <el-form-item label="系统名称">
        <el-input v-model="systemForm.systemName" placeholder="例如 用户中心" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="systemForm.sortOrder" :min="0" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="systemForm.enabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="systemForm.description" type="textarea" :rows="3" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="systemDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitSystem">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.project-group-card {
  margin-top: 18px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.dialog-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.header-actions,
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  margin: 0;
  color: #111827;
  font-size: 20px;
}

.section-desc {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.project-group-option {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(140px, 1.1fr);
  gap: 16px;
  align-items: center;
}

.project-group-option-name {
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-group-option-meta {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-cell {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-cell-name {
  min-width: 0;
  color: #111827;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-cell-code {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 12px;
}
</style>
