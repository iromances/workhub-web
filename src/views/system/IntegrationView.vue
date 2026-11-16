<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createIntegrationSystem,
  fetchIntegrationApis,
  fetchIntegrationSystem,
  fetchIntegrationSystemConfig,
  fetchIntegrationSystems,
  probeIntegrationSystem,
  saveIntegrationSystemConfig,
  updateIntegrationSystem,
} from '@/api/integration'
import { useAuthStore } from '@/stores/auth'
import {
  AUTH_TYPE_LABELS,
  INTEGRATION_METHOD_LABELS,
} from '@/types/integration'
import type {
  IntegrationApiCatalog,
  IntegrationCapability,
  IntegrationHttpMethod,
  IntegrationSystem,
  IntegrationSystemConfig,
  IntegrationSystemDetail,
} from '@/types/integration'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const systems = ref<IntegrationSystem[]>([])
const probingId = ref<number | null>(null)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<IntegrationSystemDetail | null>(null)
const editingCapabilities = ref(false)
const savingCapabilities = ref(false)
const capabilityRows = ref<IntegrationCapability[]>([])

const configLoading = ref(false)
const configSystem = ref<IntegrationSystemConfig | null>(null)
const savingConfig = ref(false)
const zentaoForm = reactive({ baseUrl: '', account: '', password: '' })
const jenkinsRows = ref<Array<{
  id: string
  name: string
  baseUrl: string
  userName: string
  apiToken: string
  enabled: boolean
  tokenConfigured: boolean
}>>([])

const API_CATALOG_SYSTEMS = ['ZENTAO', 'JENKINS', 'GITLAB']
const apiCatalog = ref<IntegrationApiCatalog | null>(null)
const apisLoading = ref(false)
const apiFilter = reactive({ resourceGroup: '', httpMethod: '', keyword: '', page: 1, pageSize: 20 })

function methodTagType(method: string): 'success' | 'primary' | 'warning' | 'danger' | 'info' {
  if (method === 'GET') return 'success'
  if (method === 'POST') return 'primary'
  if (method === 'PUT') return 'warning'
  if (method === 'DELETE') return 'danger'
  return 'info'
}

async function loadApis(page = apiFilter.page) {
  if (!detail.value || !API_CATALOG_SYSTEMS.includes(detail.value.systemCode)) {
    return
  }
  apisLoading.value = true
  apiFilter.page = page
  try {
    apiCatalog.value = await fetchIntegrationApis(detail.value.id, {
      resourceGroup: apiFilter.resourceGroup || undefined,
      httpMethod: apiFilter.httpMethod || undefined,
      keyword: apiFilter.keyword.trim() || undefined,
      page: apiFilter.page,
      pageSize: apiFilter.pageSize,
    })
  } catch (error) {
    ElMessage.error('加载官方接口目录失败')
    console.error(error)
  } finally {
    apisLoading.value = false
  }
}

function resetApiFilter() {
  apiFilter.resourceGroup = ''
  apiFilter.httpMethod = ''
  apiFilter.keyword = ''
  loadApis(1)
}

function onApiPageSizeChange(size: number) {
  apiFilter.pageSize = size
  loadApis(1)
}

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  systemCode: '',
  systemName: '',
  integrationMethod: 'REST_API' as IntegrationSystem['integrationMethod'],
  authType: 'PAT' as IntegrationSystem['authType'],
  configGroups: [] as string[],
  enabled: true,
  sortOrder: 0,
  remark: '',
})

const canCreate = computed(() => authStore.hasAnyPermission(['system:integration:create']))
const canUpdate = computed(() => authStore.hasAnyPermission(['system:integration:update']))

async function loadSystems() {
  loading.value = true
  try {
    systems.value = await fetchIntegrationSystems()
  } catch (error) {
    ElMessage.error('加载系统集成台账失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function probe(row: IntegrationSystem) {
  probingId.value = row.id
  try {
    const result = await probeIntegrationSystem(row.id)
    if (result.ok) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error('测试连接请求失败')
    console.error(error)
  } finally {
    probingId.value = null
  }
}

async function openDetail(row: IntegrationSystem) {
  detailVisible.value = true
  detailLoading.value = true
  editingCapabilities.value = false
  configSystem.value = null
  zentaoForm.baseUrl = ''
  zentaoForm.account = ''
  zentaoForm.password = ''
  jenkinsRows.value = []
  apiCatalog.value = null
  apiFilter.resourceGroup = ''
  apiFilter.httpMethod = ''
  apiFilter.keyword = ''
  apiFilter.page = 1
  apiFilter.pageSize = 20
  try {
    detail.value = await fetchIntegrationSystem(row.id)
    await loadConfig(row)
    await loadApis(1)
  } catch (error) {
    ElMessage.error('加载集成系统详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
}

async function loadConfig(row: IntegrationSystem) {
  if (row.systemCode !== 'ZENTAO' && row.systemCode !== 'JENKINS') {
    return
  }
  configLoading.value = true
  try {
    configSystem.value = await fetchIntegrationSystemConfig(row.id)
    if (configSystem.value.zentao) {
      zentaoForm.baseUrl = configSystem.value.zentao.baseUrl ?? ''
      zentaoForm.account = configSystem.value.zentao.account ?? ''
    } else if (configSystem.value.jenkins) {
      jenkinsRows.value = configSystem.value.jenkins.instances.map(instance => ({
        id: instance.id,
        name: instance.name,
        baseUrl: instance.baseUrl,
        userName: instance.userName,
        apiToken: '',
        enabled: instance.enabled,
        tokenConfigured: instance.tokenConfigured,
      }))
    }
  } catch (error) {
    ElMessage.error('加载连接配置失败')
    console.error(error)
  } finally {
    configLoading.value = false
  }
}

function backendMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

async function saveZentaoConfig() {
  if (!detail.value) {
    return
  }
  if (!zentaoForm.baseUrl.trim() || !zentaoForm.account.trim()) {
    ElMessage.warning('禅道地址和账号不能为空')
    return
  }
  savingConfig.value = true
  try {
    configSystem.value = await saveIntegrationSystemConfig(detail.value.id, {
      zentao: {
        baseUrl: zentaoForm.baseUrl.trim(),
        account: zentaoForm.account.trim(),
        password: zentaoForm.password || null,
      },
    })
    zentaoForm.password = ''
    ElMessage.success('禅道连接配置已保存')
    await refreshDetail()
  } catch (error) {
    ElMessage.error(backendMessage(error, '保存禅道连接配置失败'))
    console.error(error)
  } finally {
    savingConfig.value = false
  }
}

function addJenkinsRow() {
  jenkinsRows.value.push({
    id: '',
    name: '',
    baseUrl: '',
    userName: '',
    apiToken: '',
    enabled: true,
    tokenConfigured: false,
  })
}

function removeJenkinsRow(index: number) {
  jenkinsRows.value.splice(index, 1)
}

async function saveJenkinsConfig() {
  if (!detail.value) {
    return
  }
  for (const row of jenkinsRows.value) {
    if (!row.id.trim() || !row.name.trim() || !row.baseUrl.trim() || !row.userName.trim()) {
      ElMessage.warning('Jenkins 实例的标识、名称、地址和账号不能为空')
      return
    }
    if (!row.apiToken && !row.tokenConfigured) {
      ElMessage.warning(`Jenkins 实例（${row.id}）尚未配置 API Token，请填写`)
      return
    }
  }
  if (jenkinsRows.value.length === 0) {
    ElMessage.warning('Jenkins 实例列表不能为空')
    return
  }
  savingConfig.value = true
  try {
    configSystem.value = await saveIntegrationSystemConfig(detail.value.id, {
      jenkins: {
        instances: jenkinsRows.value.map(row => ({
          id: row.id.trim(),
          name: row.name.trim(),
          baseUrl: row.baseUrl.trim(),
          userName: row.userName.trim(),
          apiToken: row.apiToken || null,
          enabled: row.enabled,
        })),
      },
    })
    jenkinsRows.value = configSystem.value.jenkins?.instances.map(instance => ({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      userName: instance.userName,
      apiToken: '',
      enabled: instance.enabled,
      tokenConfigured: instance.tokenConfigured,
    })) ?? []
    ElMessage.success('Jenkins 连接配置已保存')
    await refreshDetail()
  } catch (error) {
    ElMessage.error(backendMessage(error, '保存 Jenkins 连接配置失败'))
    console.error(error)
  } finally {
    savingConfig.value = false
  }
}

async function refreshDetail() {
  if (!detail.value) {
    return
  }
  try {
    detail.value = await fetchIntegrationSystem(detail.value.id)
  } catch (error) {
    console.error(error)
  }
}

function startEditCapabilities() {
  if (!detail.value) {
    return
  }
  capabilityRows.value = detail.value.capabilities.map(item => ({ ...item }))
  editingCapabilities.value = true
}

function addCapabilityRow() {
  capabilityRows.value.push({
    capabilityCode: '',
    capabilityName: '',
    capabilityType: 'READ',
    implStatus: 'ACTIVE',
    description: '',
    enabled: true,
    sortOrder: capabilityRows.value.length * 10 + 10,
  })
}

function removeCapabilityRow(index: number) {
  capabilityRows.value.splice(index, 1)
}

async function saveCapabilities() {
  if (!detail.value) {
    return
  }
  for (const row of capabilityRows.value) {
    if (!row.capabilityCode.trim() || !row.capabilityName.trim()) {
      ElMessage.warning('能力编码和名称不能为空')
      return
    }
  }
  savingCapabilities.value = true
  try {
    detail.value = await updateIntegrationSystem(detail.value.id, {
      systemName: detail.value.systemName,
      integrationMethod: detail.value.integrationMethod,
      authType: detail.value.authType,
      configGroups: detail.value.configGroups,
      enabled: detail.value.enabled,
      sortOrder: detail.value.sortOrder ?? 0,
      remark: detail.value.remark,
      capabilities: capabilityRows.value.map(row => ({
        capabilityCode: row.capabilityCode.trim(),
        capabilityName: row.capabilityName.trim(),
        capabilityType: row.capabilityType,
        implStatus: row.implStatus,
        description: row.description || null,
        enabled: row.enabled,
        sortOrder: row.sortOrder ?? 0,
        remark: row.remark || null,
      })),
    })
    editingCapabilities.value = false
    ElMessage.success('能力清单已保存')
    await loadSystems()
  } catch (error) {
    ElMessage.error('保存能力清单失败')
    console.error(error)
  } finally {
    savingCapabilities.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.systemCode = ''
  form.systemName = ''
  form.integrationMethod = 'REST_API'
  form.authType = 'PAT'
  form.configGroups = []
  form.enabled = true
  form.sortOrder = 0
  form.remark = ''
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: IntegrationSystem) {
  resetForm()
  editingId.value = row.id
  form.systemCode = row.systemCode
  form.systemName = row.systemName
  form.integrationMethod = row.integrationMethod
  form.authType = row.authType
  form.configGroups = [...row.configGroups]
  form.enabled = row.enabled
  form.sortOrder = row.sortOrder ?? 0
  form.remark = row.remark || ''
  dialogVisible.value = true
}

async function submit() {
  if (!form.systemName.trim() || (!editingId.value && !form.systemCode.trim())) {
    ElMessage.warning('请填写系统编码和系统名称')
    return
  }
  submitting.value = true
  try {
    const capabilities = editingId.value && detail.value && detail.value.id === editingId.value
      ? detail.value.capabilities.map(item => ({
        capabilityCode: item.capabilityCode,
        capabilityName: item.capabilityName,
        capabilityType: item.capabilityType,
        implStatus: item.implStatus,
        description: item.description,
        enabled: item.enabled,
        sortOrder: item.sortOrder ?? 0,
        remark: item.remark,
      }))
      : []
    const request = {
      systemCode: form.systemCode.trim().toUpperCase(),
      systemName: form.systemName.trim(),
      integrationMethod: form.integrationMethod,
      authType: form.authType,
      configGroups: form.configGroups.map(group => group.trim()).filter(Boolean),
      enabled: form.enabled,
      sortOrder: form.sortOrder,
      remark: form.remark.trim() || null,
      capabilities,
    }
    if (editingId.value) {
      // 编辑时系统编码不可修改，后端忽略该字段。
      await updateIntegrationSystem(editingId.value, request)
    } else {
      await createIntegrationSystem(request)
    }
    ElMessage.success('集成系统已保存')
    dialogVisible.value = false
    await loadSystems()
  } catch (error) {
    ElMessage.error('保存集成系统失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function gotoSystemConfig(group: string) {
  // 前缀组（如 gitlab.）在系统配置页为精确匹配，跳转时不带筛选；精确组直接预填定位。
  if (group.endsWith('.')) {
    router.push('/system-config')
    return
  }
  router.push({ path: '/system-config', query: { configGroup: group } })
}

onMounted(() => {
  if (route.query.systemCode) {
    ElMessage.info(`系统编码 ${route.query.systemCode} 的详情可在列表中打开`)
  }
  loadSystems()
})
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <p class="page-desc">
          可视化管理外部系统接入台账：集成方式、认证方式与接入能力目录；连接配置（地址、账号、Token）在系统配置中维护，此处仅展示配置状态。
        </p>
      </div>
      <el-button v-if="canCreate" type="primary" @click="openCreate">新增系统</el-button>
    </div>

    <el-table v-loading="loading" :data="systems">
      <el-table-column prop="systemName" label="系统名" min-width="160">
        <template #default="{ row }">
          <span>{{ row.systemName }}</span>
          <span class="system-code">{{ row.systemCode }}</span>
        </template>
      </el-table-column>
      <el-table-column label="集成方式" width="170">
        <template #default="{ row }">
          <el-tag type="primary">{{ INTEGRATION_METHOD_LABELS[row.integrationMethod as keyof typeof INTEGRATION_METHOD_LABELS] || row.integrationMethod }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="认证方式" width="170">
        <template #default="{ row }">
          <el-tag type="warning">{{ AUTH_TYPE_LABELS[row.authType as keyof typeof AUTH_TYPE_LABELS] || row.authType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="capabilityCount" label="能力数" width="90" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button
            link
            type="success"
            :loading="probingId === row.id"
            @click="probe(row)"
          >测试连接</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="detailVisible" :title="detail ? `集成系统：${detail.systemName}` : '集成系统详情'" width="960px" top="6vh">
    <div v-loading="detailLoading">
      <template v-if="detail">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="系统编码">{{ detail.systemCode }}</el-descriptions-item>
          <el-descriptions-item label="集成方式">{{ INTEGRATION_METHOD_LABELS[detail.integrationMethod] || detail.integrationMethod }}</el-descriptions-item>
          <el-descriptions-item label="认证方式">{{ AUTH_TYPE_LABELS[detail.authType] || detail.authType }}</el-descriptions-item>
          <el-descriptions-item label="启用">
            <el-tag :type="detail.enabled ? 'success' : 'info'">{{ detail.enabled ? '启用' : '停用' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="能力数">{{ detail.capabilities.length }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.remark || '—' }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="section-title">连接配置状态</h4>
        <el-table :data="detail.configGroupStatuses" size="small">
          <el-table-column prop="group" label="配置组" min-width="180" />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="row.prefixGroup ? 'info' : 'primary'" size="small">{{ row.prefixGroup ? '前缀聚合组' : '精确组' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="配置项" width="90">
            <template #default="{ row }">{{ row.itemCount }} 项（启用 {{ row.enabledCount }}）</template>
          </el-table-column>
          <el-table-column label="敏感值" width="120">
            <template #default="{ row }">
              <el-tag :type="row.secretConfigured ? 'success' : 'danger'" size="small">{{ row.secretConfigured ? '已配置' : '未配置' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="gotoSystemConfig(row.group)">去系统配置</el-button>
            </template>
          </el-table-column>
        </el-table>

        <template v-if="detail.systemCode === 'ZENTAO' && configSystem?.zentao">
          <h4 class="section-title">连接配置（禅道）</h4>
          <div v-loading="configLoading" class="credential-form">
            <el-form label-position="top" size="small">
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="后台地址">
                    <el-input v-model="zentaoForm.baseUrl" :disabled="!canUpdate" placeholder="如 http://zentao.example.com" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="账号">
                    <el-input v-model="zentaoForm.account" :disabled="!canUpdate" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="密码">
                    <el-input
                      v-model="zentaoForm.password"
                      type="password"
                      show-password
                      :disabled="!canUpdate"
                      :placeholder="configSystem.zentao.passwordConfigured ? '已配置，留空表示不修改' : '尚未配置，保存时必填'"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="密码状态">
                    <el-tag :type="configSystem.zentao.passwordConfigured ? 'success' : 'danger'" size="small">
                      {{ configSystem.zentao.passwordConfigured ? '已配置' : '未配置' }}
                    </el-tag>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
            <el-button v-if="canUpdate" type="primary" size="small" :loading="savingConfig" @click="saveZentaoConfig">保存禅道配置</el-button>
          </div>
        </template>

        <template v-else-if="detail.systemCode === 'JENKINS' && configSystem?.jenkins">
          <h4 class="section-title">连接配置（Jenkins 实例）</h4>
          <div v-loading="configLoading" class="credential-form">
            <el-table :data="jenkinsRows" size="small">
              <el-table-column label="实例标识" width="150">
                <template #default="{ row }">
                  <el-input v-model="row.id" :disabled="!canUpdate" size="small" placeholder="如 prod-jenkins" />
                </template>
              </el-table-column>
              <el-table-column label="名称" width="150">
                <template #default="{ row }">
                  <el-input v-model="row.name" :disabled="!canUpdate" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="后台地址" min-width="220">
                <template #default="{ row }">
                  <el-input v-model="row.baseUrl" :disabled="!canUpdate" size="small" placeholder="如 http://jenkins.example.com" />
                </template>
              </el-table-column>
              <el-table-column label="账号" width="140">
                <template #default="{ row }">
                  <el-input v-model="row.userName" :disabled="!canUpdate" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="API Token" width="200">
                <template #default="{ row }">
                  <el-input
                    v-model="row.apiToken"
                    type="password"
                    show-password
                    :disabled="!canUpdate"
                    size="small"
                    :placeholder="row.tokenConfigured ? '已配置，留空表示不修改' : '新增实例必填'"
                  />
                </template>
              </el-table-column>
              <el-table-column label="启用" width="70">
                <template #default="{ row }">
                  <el-switch v-model="row.enabled" :disabled="!canUpdate" size="small" />
                </template>
              </el-table-column>
              <el-table-column v-if="canUpdate" label="操作" width="70">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="removeJenkinsRow($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="canUpdate" class="credential-actions">
              <el-button size="small" @click="addJenkinsRow">添加实例</el-button>
              <el-button type="primary" size="small" :loading="savingConfig" @click="saveJenkinsConfig">保存 Jenkins 配置</el-button>
              <span class="credential-hint">Job 绑定仍在系统配置 agent.jenkins/policy 维护；删除仍被绑定引用的实例会被拒绝。</span>
            </div>
          </div>
        </template>

        <div class="capability-header">
          <h4 class="section-title">接入能力</h4>
          <div v-if="canUpdate && !editingCapabilities">
            <el-button size="small" type="primary" @click="startEditCapabilities">编辑能力</el-button>
          </div>
          <div v-else-if="editingCapabilities">
            <el-button size="small" @click="editingCapabilities = false">取消</el-button>
            <el-button size="small" type="primary" :loading="savingCapabilities" @click="saveCapabilities">保存能力</el-button>
          </div>
        </div>
        <el-table v-if="!editingCapabilities" :data="detail.capabilities" size="small">
          <el-table-column prop="capabilityCode" label="能力编码" width="170" />
          <el-table-column prop="capabilityName" label="能力名称" width="150" />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag :type="row.capabilityType === 'WRITE' ? 'warning' : 'info'" size="small">{{ row.capabilityType === 'WRITE' ? '写' : '读' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="实现状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.implStatus === 'PLANNED' ? 'warning' : 'success'" size="small">{{ row.implStatus === 'PLANNED' ? '规划中' : '已接入' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <template v-else>
          <el-table :data="capabilityRows" size="small">
            <el-table-column label="能力编码" width="170">
              <template #default="{ row }">
                <el-input v-model="row.capabilityCode" placeholder="如 create-task" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="能力名称" width="150">
              <template #default="{ row }">
                <el-input v-model="row.capabilityName" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-select v-model="row.capabilityType" size="small">
                  <el-option label="读" value="READ" />
                  <el-option label="写" value="WRITE" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="实现状态" width="110">
              <template #default="{ row }">
                <el-select v-model="row.implStatus" size="small">
                  <el-option label="已接入" value="ACTIVE" />
                  <el-option label="规划中" value="PLANNED" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="200">
              <template #default="{ row }">
                <el-input v-model="row.description" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="启用" width="70">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeCapabilityRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button class="add-capability" size="small" @click="addCapabilityRow">添加能力</el-button>
        </template>

      <template v-if="detail && API_CATALOG_SYSTEMS.includes(detail.systemCode)">
        <h4 class="section-title">官方接口目录（{{ apiCatalog?.total ?? 0 }} 条 · 官方文档快照，只读）</h4>
        <div v-loading="apisLoading">
          <div class="api-filter">
            <el-select
              v-model="apiFilter.resourceGroup"
              clearable
              filterable
              placeholder="资源组（全部）"
              size="small"
              style="width: 240px"
              @change="loadApis(1)"
            >
              <el-option
                v-for="group in apiCatalog?.resourceGroups ?? []"
                :key="group.resourceGroup"
                :label="`${group.resourceGroupName || group.resourceGroup}（${group.endpointCount}${group.platformUsedCount ? ' · 平台已用 ' + group.platformUsedCount : ''}）`"
                :value="group.resourceGroup"
              />
            </el-select>
            <el-select v-model="apiFilter.httpMethod" clearable placeholder="方法（全部）" size="small" style="width: 120px" @change="loadApis(1)">
              <el-option v-for="method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']" :key="method" :label="method" :value="method" />
            </el-select>
            <el-input
              v-model="apiFilter.keyword"
              placeholder="接口名称/路径关键词"
              size="small"
              style="width: 220px"
              clearable
              @keyup.enter="loadApis(1)"
              @clear="loadApis(1)"
            />
            <el-button size="small" type="primary" @click="loadApis(1)">查询</el-button>
            <el-button size="small" @click="resetApiFilter">重置</el-button>
          </div>
          <el-table :data="apiCatalog?.items ?? []" size="small">
            <el-table-column prop="apiName" label="接口名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="方法" width="84">
              <template #default="{ row }">
                <el-tag :type="methodTagType(row.httpMethod)" size="small">{{ row.httpMethod }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="请求路径" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">
                <code class="api-path">{{ row.apiPath }}</code>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.summary || row.sourceNote || row.resourceGroupName || '—' }}</template>
            </el-table-column>
            <el-table-column label="平台接入" width="92">
              <template #default="{ row }">
                <el-tag v-if="row.platformUsed" type="success" size="small">已接入</el-tag>
                <span v-else class="api-unused">—</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="api-footer">
            <el-pagination
              v-model:current-page="apiFilter.page"
              :page-size="apiFilter.pageSize"
              :page-sizes="[20, 50, 100]"
              :total="apiCatalog?.total ?? 0"
              layout="total, sizes, prev, pager, next"
              size="small"
              @current-change="loadApis"
              @size-change="onApiPageSizeChange"
            />
            <span v-if="apiCatalog?.sourceSummary" class="api-source">
              来源：官方文档快照{{ apiCatalog.sourceSummary.sources.length ? `（${apiCatalog.sourceSummary.sources.length} 个来源）` : '' }}{{
                apiCatalog.sourceSummary.fetchedAt ? `，入库 ${apiCatalog.sourceSummary.fetchedAt.replace('T', ' ').slice(0, 16)}` : ''
              }}
            </span>
          </div>
        </div>
      </template>
      </template>
    </div>
  </el-dialog>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑集成系统' : '新增集成系统'" width="620px">
    <el-form label-position="top">
      <el-form-item label="系统编码（内置探针按编码分派，创建后不可修改）">
        <el-input v-model="form.systemCode" :disabled="!!editingId" placeholder="如 SONARQUBE，大写字母/数字/下划线" />
      </el-form-item>
      <el-form-item label="系统名称">
        <el-input v-model="form.systemName" />
      </el-form-item>
      <el-form-item label="集成方式">
        <el-select v-model="form.integrationMethod" style="width: 100%">
          <el-option v-for="(label, value) in INTEGRATION_METHOD_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="认证方式">
        <el-select v-model="form.authType" style="width: 100%">
          <el-option v-for="(label, value) in AUTH_TYPE_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关联配置组（可多选/输入，对应系统配置的分组；结尾带点的为前缀聚合组，如 gitlab.）">
        <el-select v-model="form.configGroups" multiple filterable allow-create default-first-option style="width: 100%" placeholder="如 zentao.base、gitlab.global" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
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

.system-code {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.section-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.capability-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-capability {
  margin-top: 8px;
}

.credential-form {
  margin-bottom: 8px;
}

.credential-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.credential-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.api-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.api-path {
  font-family: var(--el-font-family-mono, 'SFMono-Regular', Consolas, monospace);
  font-size: 12px;
}

.api-unused {
  color: var(--el-text-color-secondary);
}

.api-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.api-source {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
