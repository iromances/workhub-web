<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createMcpResource,
  deleteMcpResource,
  fetchMcpAudits,
  fetchMcpCatalog,
  fetchMcpResources,
  updateMcpResource,
} from '@/api/mcp'
import { fetchProjectGroups, fetchSelectableProjectInvolvedSystems } from '@/api/project'
import type { McpAuditEntry, McpCatalog, McpResource, McpResourceProfile, McpResourceSaveRequest, McpResourceType } from '@/types/mcp'
import type { ProjectGroup, ProjectInvolvedSystem } from '@/types/work-item'

const loading = ref(false)
const submitting = ref(false)
const drawerVisible = ref(false)
const catalogVisible = ref(false)
const editingId = ref<number | null>(null)
const activeTab = ref<'DATABASE' | 'SERVER' | 'AUDIT'>('DATABASE')
const resources = ref<McpResource[]>([])
const audits = ref<McpAuditEntry[]>([])
const catalog = ref<McpCatalog | null>(null)
const businessLines = ref<ProjectGroup[]>([])
const systemOptions = ref<ProjectInvolvedSystem[]>([])
const editingPasswordConfigured = ref(false)
const editingSshPasswordConfigured = ref(false)
const editingSshBastionPasswordConfigured = ref(false)

const environmentOptions = [
  { label: '开发', value: 'dev' },
  { label: '测试', value: 'test' },
  { label: '准生产', value: 'staging' },
  { label: '生产', value: 'prod' },
]

const filters = reactive({
  resourceType: '' as McpResourceType | '',
  businessLineCode: '',
  environmentCode: '',
  keyword: '',
  enabledOnly: false,
})

const form = reactive<McpResourceSaveRequest>({
  resourceType: 'DATABASE',
  targetKey: '',
  businessLineCode: '',
  businessLineCodes: [],
  environmentCode: 'test',
  name: '',
  systemName: '',
  systemNames: [],
  host: '',
  port: 3306,
  databaseSchema: '',
  username: '',
  password: '',
  sshPassword: '',
  sshBastionEnabled: false,
  sshBastionHost: '',
  sshBastionPort: 22,
  sshBastionUser: '',
  sshBastionPassword: '',
  sshIdentityFile: '',
  allowedServices: [],
  allowedLogPaths: [],
  profiles: [],
  enabled: true,
  remark: '',
})

const databaseResources = computed(() => resources.value.filter((item) => item.resourceType === 'DATABASE'))
const serverResources = computed(() => resources.value.filter((item) => item.resourceType === 'SERVER'))
const catalogText = computed(() => (catalog.value ? JSON.stringify(catalog.value, null, 2) : ''))
const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))

async function loadBusinessLines() {
  try {
    businessLines.value = await fetchProjectGroups()
  } catch (error) {
    ElMessage.error('加载业务线失败')
    console.error(error)
  }
}

async function loadSystemOptions() {
  const businessLine = form.businessLineCodes[0]
  if (form.resourceType !== 'SERVER' || !businessLine) {
    systemOptions.value = []
    return
  }
  try {
    systemOptions.value = await fetchSelectableProjectInvolvedSystems(businessLine)
  } catch (error) {
    ElMessage.error('加载业务线系统失败')
    console.error(error)
  }
}

async function loadResources() {
  loading.value = true
  try {
    resources.value = await fetchMcpResources({
      resourceType: filters.resourceType || undefined,
      businessLineCode: filters.businessLineCode || undefined,
      environmentCode: filters.environmentCode || undefined,
      keyword: filters.keyword || undefined,
      enabledOnly: filters.enabledOnly,
    })
  } catch (error) {
    ElMessage.error('加载 MCP 资源失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadAudits() {
  loading.value = true
  try {
    audits.value = await fetchMcpAudits(100)
  } catch (error) {
    ElMessage.error('加载 MCP 审计失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function openCatalog() {
  try {
    catalog.value = await fetchMcpCatalog()
    catalogVisible.value = true
  } catch (error) {
    ElMessage.error('生成 MCP catalog 失败')
    console.error(error)
  }
}

function resetForm(type: McpResourceType) {
  editingId.value = null
  form.resourceType = type
  form.targetKey = ''
  form.businessLineCode = ''
  form.businessLineCodes = []
  form.environmentCode = 'dev'
  form.name = ''
  form.systemName = ''
  form.systemNames = []
  form.host = ''
  form.port = type === 'DATABASE' ? 3306 : 22
  form.databaseSchema = ''
  form.username = ''
  form.password = ''
  form.sshPassword = ''
  form.sshBastionEnabled = false
  form.sshBastionHost = ''
  form.sshBastionPort = 22
  form.sshBastionUser = ''
  form.sshBastionPassword = ''
  form.sshIdentityFile = ''
  form.allowedServices = []
  form.allowedLogPaths = []
  form.profiles = [defaultProfile(type)]
  form.enabled = true
  form.remark = ''
  editingPasswordConfigured.value = false
  editingSshPasswordConfigured.value = false
  editingSshBastionPasswordConfigured.value = false
}

function defaultProfile(type: McpResourceType): McpResourceProfile {
  if (type === 'DATABASE') {
    return {
      key: 'readonly',
      maxRows: 100,
      queryTimeoutSeconds: 10,
      maxResultBytes: 65536,
    }
  }
  return {
    key: 'diagnostic',
    maxOutputLines: 500,
    timeoutSeconds: 10,
  }
}

function openCreate(type: McpResourceType) {
  resetForm(type)
  drawerVisible.value = true
}

function openEdit(row: McpResource) {
  editingId.value = row.id
  form.resourceType = row.resourceType
  form.targetKey = row.targetKey
  form.businessLineCode = row.businessLineCode
  form.businessLineCodes = row.businessLineCodes?.length ? [...row.businessLineCodes] : [row.businessLineCode].filter(Boolean)
  form.environmentCode = row.environmentCode
  form.name = row.name
  form.systemName = row.systemName || ''
  form.systemNames = systemLabel(row)
  form.host = row.host
  form.port = row.port
  form.databaseSchema = row.databaseSchema || ''
  form.username = row.username || ''
  form.password = ''
  form.sshPassword = ''
  form.sshBastionEnabled = row.sshBastionEnabled
  form.sshBastionHost = row.sshBastionHost || ''
  form.sshBastionPort = row.sshBastionPort || 22
  form.sshBastionUser = row.sshBastionUser || ''
  form.sshBastionPassword = ''
  form.sshIdentityFile = row.sshIdentityFile || ''
  form.allowedServices = [...row.allowedServices]
  form.allowedLogPaths = [...row.allowedLogPaths]
  form.profiles = row.profiles.length ? row.profiles.map((profile) => ({ ...profile })) : [defaultProfile(row.resourceType)]
  form.enabled = row.enabled
  form.remark = row.remark || ''
  editingPasswordConfigured.value = row.passwordConfigured
  editingSshPasswordConfigured.value = row.sshPasswordConfigured
  editingSshBastionPasswordConfigured.value = row.sshBastionPasswordConfigured
  drawerVisible.value = true
}

function addProfile() {
  form.profiles.push(defaultProfile(form.resourceType))
}

function removeProfile(index: number) {
  if (form.profiles.length === 1) {
    ElMessage.warning('至少保留一个权限 profile')
    return
  }
  form.profiles.splice(index, 1)
}

function validateForm() {
  if (!form.targetKey.trim() || !form.businessLineCodes.length || !form.environmentCode.trim() || !form.name.trim() || !form.host.trim()) {
    ElMessage.warning('请填写目标 key、业务线、环境、名称和主机')
    return false
  }
  if (!form.port || form.port <= 0) {
    ElMessage.warning('端口必须大于 0')
    return false
  }
  if (form.resourceType === 'DATABASE') {
    if (!form.username?.trim()) {
      ElMessage.warning('数据库资源需填写用户名')
      return false
    }
    if (!form.password?.trim() && !editingPasswordConfigured.value) {
      ElMessage.warning('数据库资源需填写数据库密码')
      return false
    }
  }
  if (form.resourceType === 'SERVER') {
    if (!form.systemNames?.length) {
      ElMessage.warning('服务器资源需选择所属系统')
      return false
    }
    if (!form.username?.trim()) {
      ElMessage.warning('服务器资源需填写 SSH 用户')
      return false
    }
    if (!form.sshPassword?.trim() && !editingSshPasswordConfigured.value && !form.sshIdentityFile?.trim()) {
      ElMessage.warning('服务器资源需填写 SSH 密码或私钥文件')
      return false
    }
  }
  if (form.sshBastionEnabled) {
    if (!form.sshBastionUser?.trim()) {
      ElMessage.warning('选择走堡垒机时需填写堡垒机用户')
      return false
    }
    if (!form.sshBastionHost?.trim()) {
      ElMessage.warning('选择走堡垒机时需填写堡垒机主机')
      return false
    }
    if (!form.sshBastionPassword?.trim() && !editingSshBastionPasswordConfigured.value && !form.sshIdentityFile?.trim()) {
      ElMessage.warning('选择走堡垒机时需填写堡垒机密码或私钥文件')
      return false
    }
  }
  if (!form.profiles.length || form.profiles.some((profile) => !profile.key.trim())) {
    ElMessage.warning('请填写权限 profile')
    return false
  }
  return true
}

function requestFromForm(): McpResourceSaveRequest {
  return {
    resourceType: form.resourceType,
    targetKey: form.targetKey.trim(),
    businessLineCode: form.businessLineCodes[0],
    businessLineCodes: form.businessLineCodes,
    environmentCode: form.environmentCode.trim(),
    name: form.name.trim(),
    systemName: form.resourceType === 'SERVER' ? form.systemNames?.[0] : undefined,
    systemNames: form.resourceType === 'SERVER' ? form.systemNames?.filter(Boolean) || [] : undefined,
    host: form.host.trim(),
    port: Number(form.port),
    databaseSchema: form.databaseSchema?.trim() || undefined,
    username: form.username?.trim() || undefined,
    password: form.password?.trim() || undefined,
    sshPassword: form.sshPassword?.trim() || undefined,
    sshBastionEnabled: form.sshBastionEnabled,
    sshBastionHost: form.sshBastionEnabled ? form.sshBastionHost?.trim() || undefined : undefined,
    sshBastionPort: form.sshBastionEnabled ? form.sshBastionPort || undefined : undefined,
    sshBastionUser: form.sshBastionEnabled ? form.sshBastionUser?.trim() || undefined : undefined,
    sshBastionPassword: form.sshBastionEnabled ? form.sshBastionPassword?.trim() || undefined : undefined,
    sshIdentityFile: form.sshIdentityFile?.trim() || undefined,
    allowedServices: form.allowedServices?.filter(Boolean) || [],
    allowedLogPaths: form.allowedLogPaths?.filter(Boolean) || [],
    profiles: form.profiles.map((profile) => ({ ...profile, key: profile.key.trim() })),
    enabled: form.enabled,
    remark: form.remark?.trim() || undefined,
  }
}

async function submit() {
  if (!validateForm()) {
    return
  }
  submitting.value = true
  try {
    const request = requestFromForm()
    if (editingId.value) {
      await updateMcpResource(editingId.value, request)
    } else {
      await createMcpResource(request)
    }
    ElMessage.success('MCP 资源已保存')
    drawerVisible.value = false
    await loadResources()
  } catch (error) {
    ElMessage.error('保存 MCP 资源失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

async function remove(row: McpResource) {
  try {
    await ElMessageBox.confirm(`确认删除 MCP 目标 ${row.targetKey}？`, '删除 MCP 目标', { type: 'warning' })
    await deleteMcpResource(row.id)
    ElMessage.success('MCP 目标已删除')
    await loadResources()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除 MCP 目标失败')
      console.error(error)
    }
  }
}

function auditField(row: McpAuditEntry, key: string) {
  const value = row.fields[key]
  return value == null ? '' : String(value)
}

function businessLineLabel(row: McpResource) {
  return row.businessLineCodes?.length ? row.businessLineCodes : [row.businessLineCode].filter(Boolean)
}

function systemLabel(row: McpResource) {
  return row.systemNames?.length ? row.systemNames : ([row.systemName].filter(Boolean) as string[])
}

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadResources()])
})

watch(
  () => [form.resourceType, form.businessLineCodes.join('|')],
  async () => {
    if (form.resourceType !== 'SERVER') {
      form.systemName = ''
      form.systemNames = []
      systemOptions.value = []
      return
    }
    await loadSystemOptions()
    form.systemNames = form.systemNames?.filter((name) => systemOptions.value.some((item) => item.systemName === name)) || []
    form.systemName = form.systemNames[0] || ''
  },
)
</script>

<template>
  <div class="page-card mcp-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">MCP</h1>
        <p class="page-desc">按业务线、环境和资源目标维护 AI 只读数据库查询与服务器白名单日志权限。</p>
      </div>
      <div class="header-actions">
        <el-button @click="openCatalog">预览 Catalog</el-button>
        <el-button type="primary" @click="openCreate(activeTab === 'SERVER' ? 'SERVER' : 'DATABASE')">
          新增目标
        </el-button>
      </div>
    </div>

    <el-alert
      type="warning"
      show-icon
      :closable="false"
      title="生产环境只建议配置只读数据库账号、白名单服务和白名单日志路径；写库、重启服务、任意 SSH 命令不在范围内。"
    />

    <el-form inline class="filter-form" @submit.prevent="loadResources">
      <el-form-item label="业务线">
        <el-select v-model="filters.businessLineCode" placeholder="全部业务线" clearable filterable style="width: 220px">
          <el-option
            v-for="line in businessLineOptions"
            :key="line.id"
            :label="line.businessLineName"
            :value="line.businessLineName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="环境">
        <el-select v-model="filters.environmentCode" clearable placeholder="全部环境" style="width: 140px">
          <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字">
        <el-input v-model="filters.keyword" placeholder="目标 key / 名称 / 主机" clearable @keyup.enter="loadResources" />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="filters.enabledOnly" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadResources">查询</el-button>
      </el-form-item>
    </el-form>

    <el-tabs v-model="activeTab" class="mcp-tabs" @tab-change="activeTab === 'AUDIT' ? loadAudits() : loadResources()">
      <el-tab-pane label="数据库目标" name="DATABASE">
        <el-table v-loading="loading" :data="databaseResources">
          <el-table-column label="业务线" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="line in businessLineLabel(row)" :key="line" class="tag-gap" type="info">
                {{ line }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="targetKey" label="目标 key" width="180" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="host" label="主机" min-width="160" show-overflow-tooltip />
          <el-table-column prop="databaseSchema" label="Schema" width="140" />
          <el-table-column label="Profile" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="profile in row.profiles" :key="profile.key" class="tag-gap" type="info">
                {{ profile.key }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="服务器目标" name="SERVER">
        <el-table v-loading="loading" :data="serverResources">
          <el-table-column label="业务线" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="line in businessLineLabel(row)" :key="line" class="tag-gap" type="info">
                {{ line }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="targetKey" label="目标 key" width="180" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="系统" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="system in systemLabel(row)" :key="system" class="tag-gap" type="info">
                {{ system }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="host" label="主机" min-width="160" show-overflow-tooltip />
          <el-table-column label="服务白名单" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="service in row.allowedServices" :key="service" class="tag-gap" type="info">
                {{ service }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="日志路径白名单" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tag v-for="path in row.allowedLogPaths" :key="path" class="tag-gap" type="info">
                {{ path }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Profile" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="profile in row.profiles" :key="profile.key" class="tag-gap" type="info">
                {{ profile.key }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="审计记录" name="AUDIT">
        <el-table v-loading="loading" :data="audits">
          <el-table-column label="时间" width="190">
            <template #default="{ row }">{{ auditField(row, 'timestamp') }}</template>
          </el-table-column>
          <el-table-column label="工具" width="180">
            <template #default="{ row }">{{ auditField(row, 'tool') }}</template>
          </el-table-column>
          <el-table-column label="资源" width="110">
            <template #default="{ row }">{{ auditField(row, 'resourceType') }}</template>
          </el-table-column>
          <el-table-column label="目标" min-width="180">
            <template #default="{ row }">{{ auditField(row, 'targetKey') }}</template>
          </el-table-column>
          <el-table-column label="Profile" width="130">
            <template #default="{ row }">{{ auditField(row, 'profileKey') }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="auditField(row, 'status') === 'SUCCEEDED' ? 'success' : 'danger'">
                {{ auditField(row, 'status') || 'UNKNOWN' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时(ms)" width="120">
            <template #default="{ row }">{{ auditField(row, 'durationMillis') }}</template>
          </el-table-column>
          <el-table-column label="错误" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ auditField(row, 'error') }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-drawer v-model="drawerVisible" :title="editingId ? '编辑 MCP 目标' : '新增 MCP 目标'" size="680px">
    <el-form label-position="top" class="drawer-form" :hide-required-asterisk="false">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="资源类型" required>
            <el-segmented v-model="form.resourceType" :options="['DATABASE', 'SERVER']" :disabled="!!editingId" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="是否启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="业务线" required>
            <el-select v-model="form.businessLineCodes" multiple filterable style="width: 100%" placeholder="可选择多个业务线">
              <el-option
                v-for="line in businessLineOptions"
                :key="line.id"
                :label="line.businessLineName"
                :value="line.businessLineName"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="环境" required>
            <el-select v-model="form.environmentCode" style="width: 100%">
              <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="目标 key" required>
        <el-input v-model="form.targetKey" placeholder="workhub-db-test / workhub-server-test" />
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item v-if="form.resourceType === 'SERVER'" label="所属系统" required>
        <el-select v-model="form.systemNames" multiple filterable style="width: 100%" placeholder="选择当前业务线下的系统">
          <el-option
            v-for="system in systemOptions"
            :key="system.id"
            :label="system.systemName"
            :value="system.systemName"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="16">
          <el-form-item label="目标主机" required>
            <el-input v-model="form.host" placeholder="内网数据库或服务器地址" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="端口" required>
            <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <template v-if="form.resourceType === 'DATABASE'">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Schema">
              <el-input v-model="form.databaseSchema" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据库用户" required>
              <el-input v-model="form.username" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="数据库密码" required>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editingPasswordConfigured ? '已配置，留空则不修改' : '请输入数据库密码'"
          />
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="SSH 用户" required>
          <el-input v-model="form.username" placeholder="ops" />
        </el-form-item>
        <el-form-item label="SSH 密码" required>
          <el-input
            v-model="form.sshPassword"
            type="password"
            show-password
            :placeholder="editingSshPasswordConfigured ? '已配置，留空则不修改' : '请输入 SSH 密码'"
          />
        </el-form-item>
        <el-form-item label="服务白名单">
          <el-select
            v-model="form.allowedServices"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="允许 systemctl status / journalctl 读取的服务名"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="日志路径白名单">
          <el-select
            v-model="form.allowedLogPaths"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="允许 tail 读取的完整日志路径"
            style="width: 100%"
          />
        </el-form-item>
      </template>

      <el-divider content-position="left">堡垒机 / SSH</el-divider>
      <el-form-item label="连接方式">
        <el-switch
          v-model="form.sshBastionEnabled"
          active-text="走堡垒机"
          inactive-text="直连目标"
        />
      </el-form-item>
      <template v-if="form.sshBastionEnabled">
        <el-row :gutter="12">
        <el-col :span="16">
          <el-form-item label="堡垒机主机" required>
            <el-input v-model="form.sshBastionHost" placeholder="堡垒机地址" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="堡垒机端口">
            <el-input-number v-model="form.sshBastionPort" :min="1" :max="65535" style="width: 100%" />
          </el-form-item>
        </el-col>
        </el-row>
        <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="堡垒机用户" required>
            <el-input v-model="form.sshBastionUser" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="堡垒机密码" required>
            <el-input
              v-model="form.sshBastionPassword"
              type="password"
              show-password
              :placeholder="editingSshBastionPasswordConfigured ? '已配置，留空则不修改' : '需要堡垒机时填写'"
            />
          </el-form-item>
        </el-col>
        </el-row>
      </template>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="私钥文件">
            <el-input v-model="form.sshIdentityFile" placeholder="/Users/name/.ssh/key" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">权限 Profile</el-divider>
      <div v-for="(profile, index) in form.profiles" :key="index" class="profile-row">
        <el-input v-model="profile.key" placeholder="profile key" />
        <template v-if="form.resourceType === 'DATABASE'">
          <el-input-number v-model="profile.maxRows" :min="1" :max="10000" placeholder="行数" />
          <el-input-number v-model="profile.queryTimeoutSeconds" :min="1" :max="120" placeholder="超时" />
        </template>
        <template v-else>
          <el-input-number v-model="profile.maxOutputLines" :min="1" :max="5000" placeholder="行数" />
          <el-input-number v-model="profile.timeoutSeconds" :min="1" :max="120" placeholder="超时" />
        </template>
        <el-button text type="danger" @click="removeProfile(index)">删除</el-button>
      </div>
      <el-button @click="addProfile">新增 Profile</el-button>

      <el-form-item label="备注" class="remark-field">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-drawer>

  <el-dialog v-model="catalogVisible" title="MCP Catalog 预览" width="760px">
    <el-input :model-value="catalogText" type="textarea" :rows="22" readonly />
  </el-dialog>
</template>

<style scoped>
.mcp-page {
  padding: 24px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-form {
  margin-top: 16px;
}

.mcp-tabs {
  margin-top: 16px;
}

.tag-gap {
  margin-right: 6px;
}

.drawer-form {
  padding-right: 8px;
}

.profile-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 120px 120px 64px;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.remark-field {
  margin-top: 16px;
}
</style>
