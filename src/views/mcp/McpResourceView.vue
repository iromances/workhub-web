<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createMcpBastion,
  createMcpResource,
  deleteMcpResource,
  fetchMcpAudits,
  fetchMcpBastions,
  fetchMcpCatalog,
  fetchMcpResources,
  testMcpBastionConnection,
  testMcpDatabaseConnection,
  testMcpServerConnection,
  updateMcpBastion,
  updateMcpResource,
} from '@/api/mcp'
import { fetchProjectGroups, fetchSelectableProjectInvolvedSystems } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type {
  McpAuditEntry,
  McpBastion,
  McpBastionConnectionTestResult,
  McpBastionSaveRequest,
  McpCatalog,
  McpDatabaseConnectionTestResult,
  McpResource,
  McpResourceProfile,
  McpResourceSaveRequest,
  McpResourceType,
  McpServerConnectionTestResult,
} from '@/types/mcp'
import type { ProjectGroup, ProjectInvolvedSystem } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const databaseTesting = ref(false)
const databaseTestResult = ref<{
  status: 'testing' | 'success' | 'error'
  message: string
} | null>(null)
let databaseTestFormVersion = 0
const serverTesting = ref(false)
const serverTestResult = ref<{
  status: 'testing' | 'success' | 'error'
  message: string
} | null>(null)
let serverTestFormVersion = 0
const drawerVisible = ref(false)
const bastionDrawerVisible = ref(false)
const bastionSubmitting = ref(false)
const bastionTesting = ref(false)
const bastionTestResult = ref<{
  status: 'testing' | 'success' | 'error'
  message: string
} | null>(null)
const catalogVisible = ref(false)
const editingId = ref<number | null>(null)
const editingBastionId = ref<number | null>(null)
const activeTab = ref<'DATABASE' | 'BASTION' | 'SERVER' | 'AUDIT'>('DATABASE')
const resources = ref<McpResource[]>([])
const bastions = ref<McpBastion[]>([])
const bastionOptions = ref<McpBastion[]>([])
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

const bastionFilters = reactive({
  keyword: '',
  enabledOnly: false,
})

const auditPagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0,
})

const form = reactive<McpResourceSaveRequest>({
  resourceType: 'DATABASE',
  targetKey: '',
  publicResource: false,
  featureTags: [],
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
  bastionId: undefined,
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

const bastionForm = reactive<McpBastionSaveRequest>({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  identityFile: '',
  enabled: true,
  remark: '',
})

const databaseResources = computed(() => resources.value.filter((item) => item.resourceType === 'DATABASE'))
const serverResources = computed(() => resources.value.filter((item) => item.resourceType === 'SERVER'))
const enabledBastions = computed(() => bastionOptions.value.filter((item) => item.enabled))
const catalogText = computed(() => (catalog.value ? JSON.stringify(catalog.value, null, 2) : ''))
const businessLineOptions = computed(() => businessLines.value.filter((item) => item.enabled))
const canCreate = computed(() => authStore.hasAnyPermission(['ops:mcp-resource:create', 'ops:mcp-resource:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['ops:mcp-resource:update', 'ops:mcp-resource:manage']))
const canDelete = computed(() => authStore.hasAnyPermission(['ops:mcp-resource:delete', 'ops:mcp-resource:manage']))
const canTestBastion = computed(() => canCreate.value || canUpdate.value)
const canTestDatabase = computed(() => canCreate.value || canUpdate.value)
const canTestServer = computed(() => canCreate.value || canUpdate.value)
const resourceConnectionTesting = computed(() => databaseTesting.value || serverTesting.value)

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
  if (!businessLine) {
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

async function loadBastions() {
  loading.value = true
  try {
    bastions.value = await fetchMcpBastions({
      keyword: bastionFilters.keyword || undefined,
      enabledOnly: bastionFilters.enabledOnly,
    })
  } catch (error) {
    ElMessage.error('加载堡垒机失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadBastionOptions() {
  try {
    bastionOptions.value = await fetchMcpBastions({ enabledOnly: true })
  } catch (error) {
    ElMessage.error('加载可选堡垒机失败')
    console.error(error)
  }
}

async function loadActiveTab() {
  if (activeTab.value === 'AUDIT') {
    await loadAudits()
    return
  }
  if (activeTab.value === 'BASTION') {
    await loadBastions()
    return
  }
  await loadResources()
}

async function loadAudits() {
  loading.value = true
  try {
    const page = await fetchMcpAudits({
      pageNum: auditPagination.pageNum,
      pageSize: auditPagination.pageSize,
    })
    audits.value = page.items
    auditPagination.total = page.total
  } catch (error) {
    ElMessage.error('加载 MCP 审计失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleAuditPageChange(pageNum: number) {
  auditPagination.pageNum = pageNum
  await loadAudits()
}

async function handleAuditPageSizeChange(pageSize: number) {
  auditPagination.pageSize = pageSize
  auditPagination.pageNum = 1
  await loadAudits()
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
  form.publicResource = false
  form.featureTags = []
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
  form.bastionId = undefined
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
  databaseTestResult.value = null
  serverTestResult.value = null
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

function openBastionCreate() {
  editingBastionId.value = null
  bastionForm.name = ''
  bastionForm.host = ''
  bastionForm.port = 22
  bastionForm.username = ''
  bastionForm.password = ''
  bastionForm.identityFile = ''
  bastionForm.enabled = true
  bastionForm.remark = ''
  bastionTestResult.value = null
  bastionDrawerVisible.value = true
}

function openBastionEdit(row: McpBastion) {
  editingBastionId.value = row.id
  bastionForm.name = row.name
  bastionForm.host = row.host
  bastionForm.port = row.port
  bastionForm.username = row.username
  bastionForm.password = ''
  bastionForm.identityFile = row.identityFile || ''
  bastionForm.enabled = row.enabled
  bastionForm.remark = row.remark || ''
  bastionTestResult.value = null
  bastionDrawerVisible.value = true
}

function openEdit(row: McpResource) {
  editingId.value = row.id
  form.resourceType = row.resourceType
  form.targetKey = row.targetKey
  form.publicResource = row.publicResource
  form.featureTags = [...(row.featureTags || [])]
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
  form.bastionId = row.bastionId || undefined
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
  databaseTestResult.value = null
  serverTestResult.value = null
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
  if (!form.publicResource && !form.businessLineCodes.length) {
    ElMessage.warning('非公共资源请选择业务线')
    return false
  }
  if (!form.environmentCode.trim() || !form.host.trim()) {
    ElMessage.warning('请填写环境和主机')
    return false
  }
  if (editingId.value && (!form.targetKey?.trim() || !form.name?.trim())) {
    ElMessage.warning('请填写目标 key 和名称')
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
    if (!form.username?.trim()) {
      ElMessage.warning('服务器资源需填写 SSH 用户')
      return false
    }
    if (!form.sshPassword?.trim() && !editingSshPasswordConfigured.value && !form.sshIdentityFile?.trim()) {
      ElMessage.warning('服务器资源需填写 SSH 密码或私钥文件')
      return false
    }
    if (form.allowedLogPaths?.some((path) => !path.trim().startsWith('/'))) {
      ElMessage.warning('日志目录白名单必须填写绝对路径')
      return false
    }
  }
  if (form.resourceType === 'DATABASE' && form.sshBastionEnabled && !form.bastionId) {
    ElMessage.warning('选择走堡垒机时需选择已配置的堡垒机')
    return false
  }
  if (form.resourceType === 'SERVER' && form.sshBastionEnabled) {
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
    targetKey: editingId.value ? form.targetKey?.trim() || undefined : undefined,
    publicResource: form.publicResource,
    featureTags: form.featureTags?.map((tag) => tag.trim()).filter(Boolean) || [],
    businessLineCode: form.publicResource ? undefined : form.businessLineCodes[0],
    businessLineCodes: form.publicResource ? [] : form.businessLineCodes,
    environmentCode: form.environmentCode.trim(),
    name: editingId.value ? form.name?.trim() || undefined : undefined,
    systemName: form.systemNames?.[0],
    systemNames: form.systemNames?.filter(Boolean) || [],
    host: form.host.trim(),
    port: Number(form.port),
    databaseSchema: form.databaseSchema?.trim() || undefined,
    username: form.username?.trim() || undefined,
    password: form.password?.trim() || undefined,
    sshPassword: form.sshPassword?.trim() || undefined,
    sshBastionEnabled: form.sshBastionEnabled,
    bastionId: form.resourceType === 'DATABASE' && form.sshBastionEnabled ? form.bastionId : undefined,
    sshBastionHost: form.resourceType === 'SERVER' && form.sshBastionEnabled ? form.sshBastionHost?.trim() || undefined : undefined,
    sshBastionPort: form.resourceType === 'SERVER' && form.sshBastionEnabled ? form.sshBastionPort || undefined : undefined,
    sshBastionUser: form.resourceType === 'SERVER' && form.sshBastionEnabled ? form.sshBastionUser?.trim() || undefined : undefined,
    sshBastionPassword: form.resourceType === 'SERVER' && form.sshBastionEnabled ? form.sshBastionPassword?.trim() || undefined : undefined,
    sshIdentityFile: form.resourceType === 'SERVER' ? form.sshIdentityFile?.trim() || undefined : undefined,
    allowedServices: form.allowedServices?.filter(Boolean) || [],
    allowedLogPaths: form.allowedLogPaths?.map((path) => path.trim()).filter(Boolean) || [],
    profiles: form.profiles.map((profile) => ({ ...profile, key: profile.key.trim() })),
    enabled: form.enabled,
    remark: form.remark?.trim() || undefined,
  }
}

function validateDatabaseConnectionForm() {
  if (!form.host.trim() || !form.username?.trim()) {
    databaseTestResult.value = { status: 'error', message: '请填写数据库主机和用户' }
    return false
  }
  if (!form.port || form.port <= 0 || form.port > 65535) {
    databaseTestResult.value = { status: 'error', message: '端口必须在 1-65535 之间' }
    return false
  }
  if (!form.password?.trim() && !editingPasswordConfigured.value) {
    databaseTestResult.value = { status: 'error', message: '请填写数据库密码' }
    return false
  }
  if (form.sshBastionEnabled && !form.bastionId) {
    databaseTestResult.value = { status: 'error', message: '请选择已配置的堡垒机' }
    return false
  }
  return true
}

async function testDatabaseConnection() {
  if (!validateDatabaseConnectionForm()) {
    return
  }
  const testedFormVersion = databaseTestFormVersion
  databaseTesting.value = true
  databaseTestResult.value = {
    status: 'testing',
    message: form.sshBastionEnabled ? '正在通过堡垒机测试数据库连接…' : '正在测试数据库直连…',
  }
  try {
    const result: McpDatabaseConnectionTestResult = await testMcpDatabaseConnection({
      id: editingId.value || undefined,
      host: form.host.trim(),
      port: Number(form.port),
      databaseSchema: form.databaseSchema?.trim() || undefined,
      username: form.username?.trim() || '',
      password: form.password || undefined,
      sshBastionEnabled: Boolean(form.sshBastionEnabled),
      bastionId: form.sshBastionEnabled ? form.bastionId : undefined,
    })
    if (testedFormVersion === databaseTestFormVersion) {
      databaseTestResult.value = {
        status: result.success ? 'success' : 'error',
        message: result.success
          ? `${result.message}（耗时 ${result.durationMs} ms）`
          : `连接失败：${result.message}`,
      }
    }
  } catch (error) {
    if (testedFormVersion === databaseTestFormVersion) {
      databaseTestResult.value = {
        status: 'error',
        message: errorMessage(error, '数据库连接测试失败'),
      }
    }
  } finally {
    databaseTesting.value = false
  }
}

function validateServerConnectionForm() {
  if (!form.host.trim() || !form.username?.trim()) {
    serverTestResult.value = { status: 'error', message: '请填写服务器主机和 SSH 用户' }
    return false
  }
  if (!form.port || form.port <= 0 || form.port > 65535) {
    serverTestResult.value = { status: 'error', message: '服务器端口必须在 1-65535 之间' }
    return false
  }
  if (!form.sshPassword?.trim() && !editingSshPasswordConfigured.value && !form.sshIdentityFile?.trim()) {
    serverTestResult.value = { status: 'error', message: '请填写服务器 SSH 密码或私钥文件' }
    return false
  }
  if (form.sshBastionEnabled) {
    if (!form.sshBastionHost?.trim() || !form.sshBastionUser?.trim()) {
      serverTestResult.value = { status: 'error', message: '请填写堡垒机主机和用户' }
      return false
    }
    if (!form.sshBastionPort || form.sshBastionPort <= 0 || form.sshBastionPort > 65535) {
      serverTestResult.value = { status: 'error', message: '堡垒机端口必须在 1-65535 之间' }
      return false
    }
    if (!form.sshBastionPassword?.trim()
      && !editingSshBastionPasswordConfigured.value
      && !form.sshIdentityFile?.trim()) {
      serverTestResult.value = { status: 'error', message: '请填写堡垒机密码或私钥文件' }
      return false
    }
  }
  return true
}

async function testServerConnection() {
  if (!validateServerConnectionForm()) {
    return
  }
  const testedFormVersion = serverTestFormVersion
  serverTesting.value = true
  serverTestResult.value = {
    status: 'testing',
    message: form.sshBastionEnabled ? '正在通过堡垒机测试服务器连接…' : '正在测试服务器 SSH 直连…',
  }
  try {
    const result: McpServerConnectionTestResult = await testMcpServerConnection({
      id: editingId.value || undefined,
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username?.trim() || '',
      sshPassword: form.sshPassword || undefined,
      sshIdentityFile: form.sshIdentityFile?.trim() || undefined,
      sshBastionEnabled: Boolean(form.sshBastionEnabled),
      sshBastionHost: form.sshBastionEnabled ? form.sshBastionHost?.trim() || undefined : undefined,
      sshBastionPort: form.sshBastionEnabled ? Number(form.sshBastionPort) : undefined,
      sshBastionUser: form.sshBastionEnabled ? form.sshBastionUser?.trim() || undefined : undefined,
      sshBastionPassword: form.sshBastionEnabled ? form.sshBastionPassword || undefined : undefined,
    })
    if (testedFormVersion === serverTestFormVersion) {
      serverTestResult.value = {
        status: result.success ? 'success' : 'error',
        message: result.success
          ? `${result.message}（耗时 ${result.durationMs} ms）`
          : `连接失败：${result.message}`,
      }
    }
  } catch (error) {
    if (testedFormVersion === serverTestFormVersion) {
      serverTestResult.value = {
        status: 'error',
        message: errorMessage(error, '服务器连接测试失败'),
      }
    }
  } finally {
    serverTesting.value = false
  }
}

function validateBastionForm() {
  if (!bastionForm.name.trim() || !bastionForm.host.trim() || !bastionForm.username.trim()) {
    ElMessage.warning('请填写堡垒机名称、主机和用户')
    return false
  }
  if (!bastionForm.port || bastionForm.port <= 0 || bastionForm.port > 65535) {
    ElMessage.warning('堡垒机端口必须在 1-65535 之间')
    return false
  }
  const existing = editingBastionId.value
    ? bastions.value.find((item) => item.id === editingBastionId.value)
    : undefined
  if (!bastionForm.password?.trim() && !bastionForm.identityFile?.trim() && !existing?.passwordConfigured) {
    ElMessage.warning('请填写堡垒机密码或私钥文件')
    return false
  }
  return true
}

function validateBastionConnectionForm() {
  if (!bastionForm.host.trim() || !bastionForm.username.trim()) {
    bastionTestResult.value = { status: 'error', message: '请填写堡垒机主机和用户' }
    return false
  }
  if (!bastionForm.port || bastionForm.port <= 0 || bastionForm.port > 65535) {
    bastionTestResult.value = { status: 'error', message: '端口必须在 1-65535 之间' }
    return false
  }
  const existing = editingBastionId.value
    ? bastions.value.find((item) => item.id === editingBastionId.value)
    : undefined
  if (!bastionForm.password?.trim() && !bastionForm.identityFile?.trim() && !existing?.passwordConfigured) {
    bastionTestResult.value = { status: 'error', message: '请填写密码或私钥文件' }
    return false
  }
  return true
}

async function submitBastion() {
  if (!validateBastionForm()) {
    return
  }
  bastionSubmitting.value = true
  try {
    const request: McpBastionSaveRequest = {
      name: bastionForm.name.trim(),
      host: bastionForm.host.trim(),
      port: Number(bastionForm.port),
      username: bastionForm.username.trim(),
      password: bastionForm.password?.trim() || undefined,
      identityFile: bastionForm.identityFile?.trim() || undefined,
      enabled: bastionForm.enabled,
      remark: bastionForm.remark?.trim() || undefined,
    }
    if (editingBastionId.value) {
      await updateMcpBastion(editingBastionId.value, request)
    } else {
      await createMcpBastion(request)
    }
    ElMessage.success('堡垒机已保存')
    bastionDrawerVisible.value = false
    await Promise.all([loadBastions(), loadBastionOptions()])
  } catch (error) {
    ElMessage.error('保存堡垒机失败')
    console.error(error)
  } finally {
    bastionSubmitting.value = false
  }
}

async function testBastionConnection() {
  if (!validateBastionConnectionForm()) {
    return
  }
  bastionTesting.value = true
  bastionTestResult.value = {
    status: 'testing',
    message: '正在测试连接，请稍候…',
  }
  try {
    const result: McpBastionConnectionTestResult = await testMcpBastionConnection({
      id: editingBastionId.value || undefined,
      host: bastionForm.host.trim(),
      port: Number(bastionForm.port),
      username: bastionForm.username.trim(),
      password: bastionForm.password?.trim() || undefined,
      identityFile: bastionForm.identityFile?.trim() || undefined,
    })
    bastionTestResult.value = {
      status: result.success ? 'success' : 'error',
      message: result.success
        ? `连接成功（耗时 ${result.durationMs} ms）`
        : `连接失败：${result.message}`,
    }
  } catch (error) {
    bastionTestResult.value = {
      status: 'error',
      message: errorMessage(error, '连接测试失败'),
    }
  } finally {
    bastionTesting.value = false
  }
}

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { message?: string } } }
  return response.response?.data?.message || fallback
}

watch(
  () => [
    bastionForm.host,
    bastionForm.port,
    bastionForm.username,
    bastionForm.password,
    bastionForm.identityFile,
  ],
  () => {
    if (!bastionTesting.value) {
      bastionTestResult.value = null
    }
  },
)

watch(
  () => [
    form.host,
    form.port,
    form.databaseSchema,
    form.username,
    form.password,
    form.sshBastionEnabled,
    form.bastionId,
  ],
  () => {
    databaseTestFormVersion += 1
    databaseTestResult.value = null
  },
)

watch(
  () => [
    form.host,
    form.port,
    form.username,
    form.sshPassword,
    form.sshIdentityFile,
    form.sshBastionEnabled,
    form.sshBastionHost,
    form.sshBastionPort,
    form.sshBastionUser,
    form.sshBastionPassword,
  ],
  () => {
    serverTestFormVersion += 1
    serverTestResult.value = null
  },
)

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

function auditExecution(row: McpAuditEntry) {
  return auditField(row, 'sql')
    || auditField(row, 'sshCommand')
    || auditField(row, 'command')
    || auditField(row, 'commandKey')
}

function auditTimeParts(row: McpAuditEntry) {
  const raw = auditField(row, 'timestamp')
  if (!raw) {
    return { date: '-', time: '', raw: '' }
  }
  const parsed = /^\d+$/.test(raw) ? new Date(Number(raw)) : new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return { date: raw, time: '', raw }
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`,
    raw,
  }
}

function businessLineLabel(row: McpResource) {
  if (row.publicResource) {
    return ['公共资源']
  }
  const codes = row.businessLineCodes?.length ? row.businessLineCodes : [row.businessLineCode].filter(Boolean)
  return codes.map((code) => {
    const line = businessLineOptions.value.find((item) => item.businessLineCode === code)
    return line?.businessLineName ? `${code} · ${line.businessLineName}` : code
  })
}

function systemLabel(row: McpResource) {
  return row.systemNames?.length ? row.systemNames : ([row.systemName].filter(Boolean) as string[])
}

onMounted(async () => {
  await Promise.all([loadBusinessLines(), loadResources(), loadBastions(), loadBastionOptions()])
})

watch(
  () => [form.resourceType, form.businessLineCodes.join('|')],
  async () => {
    await loadSystemOptions()
    form.systemNames = form.systemNames?.filter((name) => systemOptions.value.some((item) => item.systemName === name)) || []
    form.systemName = form.systemNames[0] || ''
  },
)

watch(
  () => form.publicResource,
  (publicResource) => {
    if (publicResource) {
      form.businessLineCode = ''
      form.businessLineCodes = []
      form.systemName = ''
      form.systemNames = []
      systemOptions.value = []
    }
  },
)
</script>

<template>
  <div class="page-card mcp-page">
    <div class="mcp-toolbar">
      <el-form
        v-if="activeTab !== 'BASTION' && activeTab !== 'AUDIT'"
        inline
        class="filter-form"
        @submit.prevent="loadResources"
      >
        <el-form-item label="业务线">
          <el-select
            v-model="filters.businessLineCode"
            placeholder="全部业务线"
            clearable
            filterable
            class="business-line-filter"
          >
            <el-option
              v-for="line in businessLineOptions"
              :key="line.id"
              :label="`${line.businessLineCode} · ${line.businessLineName}`"
              :value="line.businessLineCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="环境">
          <el-select v-model="filters.environmentCode" clearable placeholder="全部环境" class="environment-filter">
            <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            placeholder="目标 key / 名称 / 主机"
            clearable
            class="keyword-filter"
            @keyup.enter="loadResources"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="filters.enabledOnly" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadResources">查询</el-button>
        </el-form-item>
      </el-form>

      <el-form v-else-if="activeTab === 'BASTION'" inline class="filter-form" @submit.prevent="loadBastions">
        <el-form-item label="关键字">
          <el-input
            v-model="bastionFilters.keyword"
            placeholder="名称 / 主机 / 用户"
            clearable
            class="keyword-filter"
            @keyup.enter="loadBastions"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="bastionFilters.enabledOnly" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadBastions">查询</el-button>
        </el-form-item>
      </el-form>

      <div class="header-actions">
        <el-button @click="openCatalog">预览 Catalog</el-button>
        <el-button
          v-if="canCreate && activeTab !== 'AUDIT'"
          type="primary"
          @click="activeTab === 'BASTION' ? openBastionCreate() : openCreate(activeTab === 'SERVER' ? 'SERVER' : 'DATABASE')"
        >
          {{ activeTab === 'BASTION' ? '新增堡垒机' : '新增目标' }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="loadActiveTab">
      <el-tab-pane label="数据库目标" name="DATABASE">
        <el-table v-loading="loading" :data="databaseResources">
          <el-table-column label="业务线" min-width="210">
            <template #default="{ row }">
              <el-tooltip :content="businessLineLabel(row).join('、')" placement="top">
                <div class="compact-tags">
                  <el-tag size="small" type="info" disable-transitions>{{ businessLineLabel(row)[0] }}</el-tag>
                  <span v-if="businessLineLabel(row).length > 1" class="compact-tags__more">
                    +{{ businessLineLabel(row).length - 1 }}
                  </span>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="targetKey" label="目标 key" width="180" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="资源特征" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="tag in row.featureTags" :key="tag" class="tag-gap" type="warning">{{ tag }}</el-tag>
              <span v-if="!row.featureTags?.length">-</span>
            </template>
          </el-table-column>
          <el-table-column label="系统" min-width="160">
            <template #default="{ row }">
              <el-tooltip :content="systemLabel(row).length ? systemLabel(row).join('、') : '全部系统'" placement="top">
                <div class="compact-tags">
                  <el-tag size="small" type="info" disable-transitions>{{ systemLabel(row)[0] || '全部系统' }}</el-tag>
                  <span v-if="systemLabel(row).length > 1" class="compact-tags__more">
                    +{{ systemLabel(row).length - 1 }}
                  </span>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column prop="host" label="主机" min-width="160" show-overflow-tooltip />
          <el-table-column prop="databaseSchema" label="Schema" width="140" />
          <el-table-column label="连接方式" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.sshBastionEnabled ? row.bastionName || '堡垒机未配置' : '直连目标' }}
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
              <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="堡垒机" name="BASTION">
        <el-table v-loading="loading" :data="bastions">
          <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="host" label="主机" min-width="180" show-overflow-tooltip />
          <el-table-column prop="port" label="端口" width="90" />
          <el-table-column prop="username" label="用户" min-width="150" show-overflow-tooltip />
          <el-table-column label="凭据" width="110">
            <template #default="{ row }">
              <el-tag :type="row.passwordConfigured || row.identityFile ? 'success' : 'danger'">
                {{ row.passwordConfigured || row.identityFile ? '已配置' : '未配置' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button v-if="canUpdate" link type="primary" @click="openBastionEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="服务器目标" name="SERVER">
        <el-table v-loading="loading" :data="serverResources">
          <el-table-column label="业务线" min-width="210">
            <template #default="{ row }">
              <el-tooltip :content="businessLineLabel(row).join('、')" placement="top">
                <div class="compact-tags">
                  <el-tag size="small" type="info" disable-transitions>{{ businessLineLabel(row)[0] }}</el-tag>
                  <span v-if="businessLineLabel(row).length > 1" class="compact-tags__more">
                    +{{ businessLineLabel(row).length - 1 }}
                  </span>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="环境" width="90">
            <template #default="{ row }">
              {{ environmentOptions.find((item) => item.value === row.environmentCode)?.label || row.environmentCode }}
            </template>
          </el-table-column>
          <el-table-column prop="targetKey" label="目标 key" width="180" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="资源特征" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="tag in row.featureTags" :key="tag" class="tag-gap" type="warning">{{ tag }}</el-tag>
              <span v-if="!row.featureTags?.length">-</span>
            </template>
          </el-table-column>
          <el-table-column label="系统" min-width="160">
            <template #default="{ row }">
              <el-tooltip :content="systemLabel(row).length ? systemLabel(row).join('、') : '全部系统'" placement="top">
                <div class="compact-tags">
                  <el-tag size="small" type="info" disable-transitions>{{ systemLabel(row)[0] || '全部系统' }}</el-tag>
                  <span v-if="systemLabel(row).length > 1" class="compact-tags__more">
                    +{{ systemLabel(row).length - 1 }}
                  </span>
                </div>
              </el-tooltip>
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
          <el-table-column label="日志目录白名单" min-width="220" show-overflow-tooltip>
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
              <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="审计记录" name="AUDIT">
        <el-table v-loading="loading" :data="audits">
          <el-table-column label="时间" width="145">
            <template #default="{ row }">
              <el-tooltip :content="auditTimeParts(row).raw" placement="top" :disabled="!auditTimeParts(row).raw">
                <div class="audit-time">
                  <span>{{ auditTimeParts(row).date }}</span>
                  <span v-if="auditTimeParts(row).time" class="audit-time__clock">{{ auditTimeParts(row).time }}</span>
                </div>
              </el-tooltip>
            </template>
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
          <el-table-column label="执行内容" min-width="320" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="audit-execution">{{ auditExecution(row) }}</span>
            </template>
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

        <div class="audit-pagination">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="auditPagination.total"
            :current-page="auditPagination.pageNum"
            :page-size="auditPagination.pageSize"
            :page-sizes="[20, 50, 100]"
            @current-change="handleAuditPageChange"
            @size-change="handleAuditPageSizeChange"
          />
        </div>
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
        <el-col :span="8">
          <el-form-item label="公共资源">
            <el-switch v-model="form.publicResource" active-text="是" inactive-text="否" />
          </el-form-item>
        </el-col>
        <el-col v-if="!form.publicResource" :span="8">
          <el-form-item label="业务线" required>
            <el-select v-model="form.businessLineCodes" multiple filterable style="width: 100%" placeholder="可选择多个业务线">
              <el-option
                v-for="line in businessLineOptions"
                :key="line.id"
                :label="`${line.businessLineCode} · ${line.businessLineName}`"
                :value="line.businessLineCode"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="form.publicResource ? 16 : 8">
          <el-form-item label="环境" required>
            <el-select v-model="form.environmentCode" style="width: 100%">
              <el-option v-for="item in environmentOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="资源特征">
        <el-select
          v-model="form.featureTags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="例如：禅道、合同系统、支付"
          style="width: 100%"
        />
        <div class="form-tip">这些标签会随 MCP 目录返回，帮助 AI 识别资源用途。</div>
      </el-form-item>
      <el-alert
        v-if="!editingId"
        class="generated-target-alert"
        title="目标 key 和名称将在保存后自动生成"
        type="info"
        show-icon
        :closable="false"
      />
      <el-row v-else :gutter="12">
        <el-col :span="12">
          <el-form-item label="目标 key" required>
            <el-input v-model="form.targetKey" placeholder="请输入唯一目标 key" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" placeholder="请输入目标名称" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="!form.publicResource" label="所属系统">
        <el-select v-model="form.systemNames" multiple filterable style="width: 100%" placeholder="不选择则默认覆盖所选业务线下所有系统">
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
            placeholder="留空表示不限制服务名"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="日志目录白名单">
          <el-select
            v-model="form.allowedLogPaths"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="填写多个绝对目录；留空表示不限制日志路径"
            style="width: 100%"
          />
          <div class="form-tip">读取日志时可指定任一白名单目录下的具体服务日志文件。</div>
        </el-form-item>
      </template>

      <el-divider content-position="left">连接方式</el-divider>
      <el-form-item label="连接方式">
        <el-switch v-model="form.sshBastionEnabled" active-text="走堡垒机" inactive-text="直连目标" />
      </el-form-item>
      <template v-if="form.resourceType === 'DATABASE'">
        <el-form-item v-if="form.sshBastionEnabled" label="堡垒机" required>
          <el-select
            v-model="form.bastionId"
            filterable
            placeholder="请选择已启用的堡垒机"
            style="width: 100%"
          >
            <el-option
              v-for="bastion in enabledBastions"
              :key="bastion.id"
              :label="`${bastion.name} · ${bastion.host}:${bastion.port} · ${bastion.username}`"
              :value="bastion.id"
            />
          </el-select>
        </el-form-item>
      </template>
      <template v-else-if="form.sshBastionEnabled">
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
      <el-row v-if="form.resourceType === 'SERVER'" :gutter="12">
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
      <div class="resource-drawer-footer">
        <div class="connection-test-area">
          <el-button
            v-if="form.resourceType === 'DATABASE' && canTestDatabase"
            :loading="databaseTesting"
            :disabled="submitting"
            @click="testDatabaseConnection"
          >测试连接</el-button>
          <span
            v-if="form.resourceType === 'DATABASE' && databaseTestResult"
            class="connection-test-result database-connection-result"
            :class="`is-${databaseTestResult.status}`"
          >{{ databaseTestResult.message }}</span>
          <el-button
            v-if="form.resourceType === 'SERVER' && canTestServer"
            :loading="serverTesting"
            :disabled="submitting"
            @click="testServerConnection"
          >测试连接</el-button>
          <span
            v-if="form.resourceType === 'SERVER' && serverTestResult"
            class="connection-test-result database-connection-result"
            :class="`is-${serverTestResult.status}`"
          >{{ serverTestResult.message }}</span>
        </div>
        <div class="resource-drawer-actions">
          <el-button :disabled="resourceConnectionTesting" @click="drawerVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="resourceConnectionTesting"
            @click="submit"
          >保存</el-button>
        </div>
      </div>
    </template>
  </el-drawer>

  <el-drawer
    v-model="bastionDrawerVisible"
    :title="editingBastionId ? '编辑堡垒机' : '新增堡垒机'"
    size="560px"
  >
    <el-form label-position="top" class="drawer-form" :hide-required-asterisk="false">
      <el-row :gutter="12">
        <el-col :span="16">
          <el-form-item label="名称" required>
            <el-input v-model="bastionForm.name" placeholder="例如：生产堡垒机" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="是否启用">
            <el-switch v-model="bastionForm.enabled" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="16">
          <el-form-item label="主机" required>
            <el-input v-model="bastionForm.host" placeholder="堡垒机地址" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="端口" required>
            <el-input-number v-model="bastionForm.port" :min="1" :max="65535" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="用户" required>
        <el-input v-model="bastionForm.username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="bastionForm.password"
          type="password"
          show-password
          :placeholder="editingBastionId ? '已配置时留空表示不修改' : '密码或私钥文件至少填写一项'"
        />
      </el-form-item>
      <el-form-item label="私钥文件">
        <el-input v-model="bastionForm.identityFile" placeholder="/Users/name/.ssh/key" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="bastionForm.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="bastion-drawer-footer">
        <div class="connection-test-area">
          <el-button
            v-if="canTestBastion"
            :loading="bastionTesting"
            :disabled="bastionSubmitting"
            @click="testBastionConnection"
          >测试连接</el-button>
          <span
            v-if="bastionTestResult"
            class="connection-test-result"
            :class="`is-${bastionTestResult.status}`"
          >{{ bastionTestResult.message }}</span>
        </div>
        <div class="bastion-drawer-actions">
          <el-button :disabled="bastionTesting" @click="bastionDrawerVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="bastionSubmitting"
            :disabled="bastionTesting"
            @click="submitBastion"
          >保存</el-button>
        </div>
      </div>
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

.mcp-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px 16px;
  min-width: 0;
}

.filter-form :deep(.el-form-item) {
  margin: 0;
}

.business-line-filter {
  width: 220px;
}

.environment-filter {
  width: 140px;
}

.keyword-filter {
  width: 220px;
}

.header-actions {
  display: flex;
  flex: none;
  gap: 8px;
  margin-left: auto;
}

.audit-time {
  display: inline-flex;
  flex-direction: column;
  line-height: 1.35;
  white-space: nowrap;
}

.audit-time__clock {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.audit-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 1280px) {
  .mcp-toolbar {
    flex-wrap: wrap;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

.bastion-drawer-footer,
.resource-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.connection-test-area,
.bastion-drawer-actions,
.resource-drawer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.connection-test-result {
  overflow: hidden;
  max-width: 290px;
  color: #606266;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.database-connection-result {
  max-width: 420px;
}

.connection-test-result.is-testing {
  color: #409eff;
}

.connection-test-result.is-success {
  color: #67c23a;
}

.connection-test-result.is-error {
  color: #f56c6c;
}

.tag-gap {
  margin-right: 6px;
}

.form-tip {
  width: 100%;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.compact-tags {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  white-space: nowrap;
  cursor: default;
}

.compact-tags .el-tag {
  max-width: calc(100% - 34px);
}

.compact-tags :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-tags__more {
  flex: none;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.drawer-form {
  padding-right: 8px;
}

.generated-target-alert {
  margin-bottom: 16px;
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
