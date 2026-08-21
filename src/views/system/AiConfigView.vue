<script setup lang="ts">
import { ElMessage, type FormInstance } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createAiProvider,
  createAiUseCase,
  fetchAiProviders,
  fetchAiUseCaseDetail,
  fetchAiUseCases,
  fetchDictOptions,
  testAiProviderConnection,
  updateAiProvider,
  updateAiUseCase,
} from '@/api/ai-config'
import { useAuthStore } from '@/stores/auth'
import type {
  AiProviderConfig,
  AiProviderConfigRequest,
  AiProviderGroup,
  AiUseCaseConfig,
  AiUseCaseConfigRequest,
} from '@/types/ai-config'

interface OptionItem {
  code: string
  label: string
}

interface ChannelForm {
  id: number | null
  providerCode: string
  channelType: 'API' | 'CLI'
  enabled: boolean
  apiProtocol: string
  apiBaseUrl: string
  apiKey: string
  cliCommand: string
  cliWorkingDirectory: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  callTimeoutSeconds: number
  defaultModel: string
  defaultReasoningLevel: string
  defaultSpeedMode: string
  siteUrl: string
  appName: string
}

type ProviderChannelKey = 'api' | 'cli'
type ConnectionTestStatus = 'testing' | 'success' | 'error'

interface ConnectionTestFeedback {
  status: ConnectionTestStatus
  message: string
}

const authStore = useAuthStore()
const activeTab = ref<'useCase' | 'provider'>('useCase')
const providerLoading = ref(false)
const useCaseLoading = ref(false)
const providerSaving = ref(false)
const useCaseSaving = ref(false)
const providerDialogVisible = ref(false)
const providerChannelTab = ref<'API' | 'CLI'>('API')
const useCaseDialogVisible = ref(false)
const providerFormRef = ref<FormInstance>()
const useCaseFormRef = ref<FormInstance>()
const providerList = ref<AiProviderConfig[]>([])
const useCaseList = ref<AiUseCaseConfig[]>([])
const useCaseTotal = ref(0)
const providerTesting = reactive<Record<ProviderChannelKey, boolean>>({ api: false, cli: false })
const providerTestResults = reactive<Record<ProviderChannelKey, ConnectionTestFeedback | null>>({
  api: null,
  cli: null,
})

const canCreate = computed(() => authStore.hasAnyPermission(['system:ai-config:create', 'system:ai-config:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['system:ai-config:update', 'system:ai-config:manage']))
const canTestConnection = computed(() => canCreate.value || canUpdate.value)
const activeProviderChannelKey = computed<ProviderChannelKey>(() => providerChannelTab.value === 'API' ? 'api' : 'cli')
const activeProviderChannel = computed<ChannelForm>(() => providerForm[activeProviderChannelKey.value])
const activeProviderTestResult = computed(() => providerTestResults[activeProviderChannelKey.value])
const anyProviderTesting = computed(() => providerTesting.api || providerTesting.cli)

const domainOptions = reactive<OptionItem[]>([])
const vendorOptions = reactive<OptionItem[]>([])
const modelProviderOptions = reactive<OptionItem[]>([])
const channelTypeOptions = reactive<OptionItem[]>([])
const reasoningOptions = reactive<OptionItem[]>([])
const speedOptions = reactive<OptionItem[]>([])
const modelOptions = reactive<OptionItem[]>([])
const apiProtocolOptions = reactive<OptionItem[]>([])

const useCaseQuery = reactive({
  page: 1,
  pageSize: 20,
  domain: '',
  channelType: '',
  vendor: '',
  modelProvider: '',
  enabled: undefined as boolean | undefined,
  keyword: '',
})

const providerForm = reactive({
  editing: false,
  groupName: '',
  vendor: '',
  modelProvider: 'OPENAI',
  api: createChannelForm('API'),
  cli: createChannelForm('CLI'),
  remark: '',
})

const useCaseForm = reactive({
  id: null as number | null,
  useCaseCode: '',
  useCaseName: '',
  domain: 'SYSTEM',
  description: '',
  providerConfigId: null as number | null,
  uiProviderVendor: '',
  uiProviderModelProvider: '',
  uiProviderChannelType: '',
  model: '',
  reasoningLevel: '',
  speedMode: '',
  timeoutSeconds: null as number | null,
  jsonSchemaEnabled: true,
  schemaClasspath: '',
  promptTemplate: '',
  promptVariablesDesc: '',
  promptVersion: 1,
  promptChecksum: '',
  enabled: true,
  remark: '',
})

const providerGroups = computed<AiProviderGroup[]>(() => {
  const groups = new Map<string, AiProviderGroup>()
  providerList.value.forEach((item) => {
    const key = `${item.vendor || ''}__${item.modelProvider || ''}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        vendor: item.vendor || '',
        modelProvider: item.modelProvider || '',
        groupName: providerGroupName(item.vendor || '', item.modelProvider || ''),
        enabledCount: 0,
      })
    }
    const group = groups.get(key)!
    if (item.channelType === 'API') {
      group.api = item
    }
    if (item.channelType === 'CLI') {
      group.cli = item
    }
    if (item.enabled) {
      group.enabledCount += 1
    }
    group.groupName = stripChannelSuffix(item.providerName) || group.groupName
  })
  return Array.from(groups.values()).sort((left, right) => left.groupName.localeCompare(right.groupName, 'zh-CN'))
})

const useCaseVendorOptions = computed(() => {
  const values = new Set(providerList.value.map((item) => item.vendor || ''))
  return Array.from(values).map((value) => ({ value, label: vendorText(value) }))
})

const useCaseModelProviderOptions = computed(() => {
  const vendor = useCaseForm.uiProviderVendor || ''
  const values = new Set<string>()
  providerList.value.forEach((item) => {
    if ((item.vendor || '') === vendor && item.modelProvider) {
      values.add(item.modelProvider)
    }
  })
  return Array.from(values)
})

const useCaseChannelOptions = computed(() => {
  const vendor = useCaseForm.uiProviderVendor || ''
  const modelProvider = useCaseForm.uiProviderModelProvider
  return providerList.value
    .filter((item) => (item.vendor || '') === vendor && item.modelProvider === modelProvider)
    .filter((item) => !requiresLocalRepository(useCaseForm.useCaseCode) || item.channelType === 'CLI')
    .map((item) => ({
      value: String(item.channelType || '').toUpperCase(),
      label: `${channelTypeText(item.channelType)}${item.enabled ? '' : '（停用）'}`,
      disabled: useCaseForm.enabled && !item.enabled,
      order: item.channelType === 'API' ? 1 : 2,
    }))
    .sort((left, right) => left.order - right.order)
})

const selectedProvider = computed(() => {
  if (!useCaseForm.providerConfigId) {
    return null
  }
  return providerList.value.find((item) => item.id === useCaseForm.providerConfigId) || null
})

const effectivePreview = computed(() => {
  const provider = selectedProvider.value
  return {
    model: useCaseForm.model || provider?.defaultModel || '-',
    modelSource: useCaseForm.model ? 'USE_CASE' : (provider?.defaultModel ? 'PROVIDER' : 'NONE'),
    reasoning: useCaseForm.reasoningLevel || provider?.defaultReasoningLevel || '-',
    reasoningSource: useCaseForm.reasoningLevel ? 'USE_CASE' : (provider?.defaultReasoningLevel ? 'PROVIDER' : 'NONE'),
    speed: useCaseForm.speedMode || provider?.defaultSpeedMode || '-',
    speedSource: useCaseForm.speedMode ? 'USE_CASE' : (provider?.defaultSpeedMode ? 'PROVIDER' : 'NONE'),
    timeout: useCaseForm.timeoutSeconds || provider?.callTimeoutSeconds || null,
    timeoutSource: useCaseForm.timeoutSeconds ? 'USE_CASE' : (provider?.callTimeoutSeconds ? 'PROVIDER' : 'NONE'),
  }
})

function createChannelForm(channelType: 'API' | 'CLI'): ChannelForm {
  return {
    id: null,
    providerCode: '',
    channelType,
    enabled: false,
    apiProtocol: 'OPENAI_COMPATIBLE',
    apiBaseUrl: '',
    apiKey: '',
    cliCommand: channelType === 'CLI' ? 'codex' : '',
    cliWorkingDirectory: '',
    connectTimeoutSeconds: 30,
    readTimeoutSeconds: 300,
    callTimeoutSeconds: channelType === 'CLI' ? 1800 : 600,
    defaultModel: '',
    defaultReasoningLevel: '',
    defaultSpeedMode: '',
    siteUrl: '',
    appName: '',
  }
}

async function loadDicts() {
  const mappings: Array<[string, OptionItem[]]> = [
    ['aiUseCaseDomain', domainOptions], ['aiVendor', vendorOptions],
    ['aiModelProvider', modelProviderOptions], ['aiChannelType', channelTypeOptions],
    ['aiReasoningLevel', reasoningOptions], ['aiSpeedMode', speedOptions],
    ['aiModel', modelOptions], ['aiApiProtocol', apiProtocolOptions],
  ]
  const results = await Promise.all(mappings.map(([type]) => fetchDictOptions(type)))
  results.forEach((rows, index) => mappings[index]![1].splice(0, mappings[index]![1].length,
    ...rows.map((row) => ({ code: row.code, label: row.name }))))
}

async function loadProviders() {
  providerLoading.value = true
  try {
    providerList.value = await fetchAiProviders()
  } catch (error) {
    ElMessage.error(errorMessage(error, '加载 AI 接入配置失败'))
  } finally {
    providerLoading.value = false
  }
}

async function loadUseCases() {
  useCaseLoading.value = true
  try {
    const page = await fetchAiUseCases({
      page: useCaseQuery.page,
      pageSize: useCaseQuery.pageSize,
      domain: useCaseQuery.domain || undefined,
      channelType: useCaseQuery.channelType || undefined,
      vendor: useCaseQuery.vendor || undefined,
      modelProvider: useCaseQuery.modelProvider || undefined,
      enabled: useCaseQuery.enabled,
      keyword: useCaseQuery.keyword || undefined,
    })
    useCaseList.value = page.items
    useCaseTotal.value = page.total
  } catch (error) {
    ElMessage.error(errorMessage(error, '加载 AI 场景配置失败'))
  } finally {
    useCaseLoading.value = false
  }
}

function reloadCurrent() {
  if (activeTab.value === 'provider') {
    loadProviders()
  } else {
    loadUseCases()
  }
}

function resetUseCaseQuery() {
  useCaseQuery.page = 1
  useCaseQuery.pageSize = 20
  useCaseQuery.domain = ''
  useCaseQuery.channelType = ''
  useCaseQuery.vendor = ''
  useCaseQuery.modelProvider = ''
  useCaseQuery.enabled = undefined
  useCaseQuery.keyword = ''
  loadUseCases()
}

function openProviderDialog(group?: AiProviderGroup) {
  providerForm.editing = false
  providerForm.groupName = ''
  providerForm.vendor = ''
  providerForm.modelProvider = 'OPENAI'
  providerForm.api = createChannelForm('API')
  providerForm.cli = createChannelForm('CLI')
  providerForm.remark = ''
  providerTestResults.api = null
  providerTestResults.cli = null
  if (group) {
    providerForm.editing = true
    providerForm.groupName = group.groupName
    providerForm.vendor = group.vendor
    providerForm.modelProvider = group.modelProvider || 'OPENAI'
    providerForm.api = channelFormFromRow('API', group.api)
    providerForm.cli = channelFormFromRow('CLI', group.cli)
    providerForm.remark = group.api?.remark || group.cli?.remark || ''
  }
  providerChannelTab.value = providerForm.api.enabled || !providerForm.cli.enabled ? 'API' : 'CLI'
  providerDialogVisible.value = true
}

function channelFormFromRow(channelType: 'API' | 'CLI', row?: AiProviderConfig): ChannelForm {
  const form = createChannelForm(channelType)
  if (!row) {
    return form
  }
  return {
    ...form,
    id: row.id,
    providerCode: row.providerCode || '',
    enabled: !!row.enabled,
    apiProtocol: row.apiProtocol || form.apiProtocol,
    apiBaseUrl: row.apiBaseUrl || '',
    apiKey: row.apiKey || '',
    cliCommand: row.cliCommand || form.cliCommand,
    cliWorkingDirectory: row.cliWorkingDirectory || '',
    connectTimeoutSeconds: row.connectTimeoutSeconds || form.connectTimeoutSeconds,
    readTimeoutSeconds: row.readTimeoutSeconds || form.readTimeoutSeconds,
    callTimeoutSeconds: row.callTimeoutSeconds || form.callTimeoutSeconds,
    defaultModel: row.defaultModel || '',
    defaultReasoningLevel: row.defaultReasoningLevel || '',
    defaultSpeedMode: row.defaultSpeedMode || '',
    siteUrl: row.siteUrl || '',
    appName: row.appName || '',
  }
}

async function saveProviderForm() {
  if (!providerForm.modelProvider) {
    ElMessage.warning('请选择模型厂商')
    return
  }
  if (!providerForm.api.enabled && !providerForm.cli.enabled) {
    ElMessage.warning('至少启用一个调用通道')
    return
  }
  if (providerForm.api.enabled && (!providerForm.api.apiProtocol || !providerForm.api.apiBaseUrl || !providerForm.api.apiKey)) {
    ElMessage.warning('请完整填写 API 通道协议、Base URL 和 API Key')
    providerChannelTab.value = 'API'
    return
  }
  const invalidDefault = [providerForm.api, providerForm.cli].find((channel) => channel.enabled &&
    (!channel.defaultModel || !channel.defaultReasoningLevel || !channel.defaultSpeedMode || !channel.callTimeoutSeconds))
  if (invalidDefault) {
    ElMessage.warning('请完整填写已启用通道的默认模型、默认推理强度、默认速度模式和总调用超时')
    providerChannelTab.value = invalidDefault.channelType
    return
  }
  if (providerForm.cli.enabled && !providerForm.cli.cliCommand) {
    ElMessage.warning('请填写 CLI 命令')
    providerChannelTab.value = 'CLI'
    return
  }
  providerSaving.value = true
  try {
    for (const payload of buildProviderPayloads()) {
      if (payload.id) {
        await updateAiProvider(payload.id, payload)
      } else {
        await createAiProvider(payload)
      }
    }
    ElMessage.success('AI 接入配置已保存')
    providerDialogVisible.value = false
    await loadProviders()
    await loadUseCases()
  } catch (error) {
    ElMessage.error(errorMessage(error, '保存 AI 接入配置失败'))
  } finally {
    providerSaving.value = false
  }
}

async function testProviderConnection() {
  const key = activeProviderChannelKey.value
  const channel = activeProviderChannel.value
  const validationMessage = validateProviderConnection(channel)
  if (validationMessage) {
    providerTestResults[key] = { status: 'error', message: validationMessage }
    return
  }
  providerTesting[key] = true
  providerTestResults[key] = { status: 'testing', message: `正在测试 ${channel.channelType} 通道，请稍候…` }
  try {
    const result = await testAiProviderConnection(buildProviderPayload(channel))
    providerTestResults[key] = {
      status: result.success ? 'success' : 'error',
      message: result.success
        ? `${result.channelType} 通道连接成功，耗时 ${result.elapsedMillis} ms`
        : `${result.channelType} 通道连接失败：${result.message}`,
    }
  } catch (error) {
    providerTestResults[key] = {
      status: 'error',
      message: errorMessage(error, `${channel.channelType} 通道连接测试失败`),
    }
  } finally {
    providerTesting[key] = false
  }
}

function buildProviderPayloads(): AiProviderConfigRequest[] {
  return [
    { channel: providerForm.api, label: 'API通道' },
    { channel: providerForm.cli, label: 'CLI通道' },
  ].flatMap(({ channel, label }) => {
    if (!channel.enabled && !channel.id) {
      return []
    }
    return [buildProviderPayload(channel, label)]
  })
}

function buildProviderPayload(channel: ChannelForm, label?: string): AiProviderConfigRequest {
  const groupName = providerForm.groupName.trim() || providerGroupName(providerForm.vendor, providerForm.modelProvider)
  const channelLabel = label || (channel.channelType === 'API' ? 'API通道' : 'CLI通道')
  return {
    id: channel.id,
    providerCode: channel.providerCode || buildProviderCode(channel.channelType),
    providerName: `${groupName} ${channelLabel}`,
    channelType: channel.channelType,
    vendor: providerForm.vendor || undefined,
    modelProvider: providerForm.modelProvider,
    defaultModel: channel.defaultModel || undefined,
    defaultReasoningLevel: channel.defaultReasoningLevel || undefined,
    defaultSpeedMode: channel.defaultSpeedMode || undefined,
    apiProtocol: channel.apiProtocol || undefined,
    apiBaseUrl: channel.apiBaseUrl || undefined,
    apiKey: channel.apiKey || undefined,
    cliCommand: channel.cliCommand || undefined,
    cliWorkingDirectory: channel.cliWorkingDirectory || undefined,
    connectTimeoutSeconds: channel.connectTimeoutSeconds,
    readTimeoutSeconds: channel.readTimeoutSeconds,
    callTimeoutSeconds: channel.callTimeoutSeconds,
    siteUrl: channel.siteUrl || undefined,
    appName: channel.appName || undefined,
    enabled: channel.enabled,
    remark: providerForm.remark || undefined,
  }
}

function validateProviderConnection(channel: ChannelForm): string {
  if (!channel.enabled) {
    return `请先启用 ${channel.channelType} 通道`
  }
  if (!providerForm.modelProvider) {
    return '请先选择模型厂商'
  }
  if (!channel.defaultModel) {
    return '请先选择默认模型'
  }
  if (channel.channelType === 'API') {
    if (!channel.apiProtocol || !channel.apiBaseUrl || !channel.apiKey) {
      return '请完整填写 API 协议、Base URL 和 API Key'
    }
  } else if (!channel.cliCommand) {
    return '请先填写 CLI 命令'
  }
  return ''
}

async function openUseCaseDialog(row: AiUseCaseConfig) {
  try {
    if (providerList.value.length === 0) {
      await loadProviders()
    }
    const detail = await fetchAiUseCaseDetail(row.id)
    resetUseCaseForm()
    Object.assign(useCaseForm, {
      id: detail.id,
      useCaseCode: detail.useCaseCode,
      useCaseName: detail.useCaseName,
      domain: detail.domain,
      description: detail.description || '',
      providerConfigId: detail.providerConfigId,
      model: detail.model || '',
      reasoningLevel: detail.reasoningLevel || '',
      speedMode: detail.speedMode || '',
      timeoutSeconds: detail.timeoutSeconds || null,
      jsonSchemaEnabled: detail.jsonSchemaEnabled,
      schemaClasspath: detail.schemaClasspath || '',
      promptTemplate: detail.promptTemplate || '',
      promptVariablesDesc: detail.promptVariablesDesc || '',
      promptVersion: detail.promptVersion || 1,
      promptChecksum: detail.promptChecksum || '',
      enabled: detail.enabled,
      remark: detail.remark || '',
    })
    syncUseCaseProviderFields()
    useCaseDialogVisible.value = true
  } catch (error) {
    ElMessage.error(errorMessage(error, '加载 AI 场景详情失败'))
  }
}

function resetUseCaseForm() {
  useCaseForm.id = null
  useCaseForm.useCaseCode = ''
  useCaseForm.useCaseName = ''
  useCaseForm.domain = 'SYSTEM'
  useCaseForm.description = ''
  useCaseForm.providerConfigId = null
  useCaseForm.uiProviderVendor = ''
  useCaseForm.uiProviderModelProvider = ''
  useCaseForm.uiProviderChannelType = ''
  useCaseForm.model = ''
  useCaseForm.reasoningLevel = ''
  useCaseForm.speedMode = ''
  useCaseForm.timeoutSeconds = null
  useCaseForm.jsonSchemaEnabled = true
  useCaseForm.schemaClasspath = ''
  useCaseForm.promptTemplate = ''
  useCaseForm.promptVariablesDesc = ''
  useCaseForm.promptVersion = 1
  useCaseForm.promptChecksum = ''
  useCaseForm.enabled = true
  useCaseForm.remark = ''
}

async function saveUseCaseForm() {
  if (!useCaseForm.useCaseCode.trim() || !useCaseForm.useCaseName.trim() || !useCaseForm.domain.trim()) {
    ElMessage.warning('请填写场景编码、场景名称和领域')
    return
  }
  if (!useCaseForm.providerConfigId) {
    ElMessage.warning('请选择接入配置')
    return
  }
  if (!useCaseForm.promptTemplate.trim()) {
    ElMessage.warning('请填写提示词模板')
    return
  }
  const payload: AiUseCaseConfigRequest = {
    id: useCaseForm.id,
    useCaseCode: useCaseForm.useCaseCode.trim(),
    useCaseName: useCaseForm.useCaseName.trim(),
    domain: useCaseForm.domain.trim(),
    description: useCaseForm.description.trim() || undefined,
    providerConfigId: useCaseForm.providerConfigId,
    model: useCaseForm.model || undefined,
    reasoningLevel: useCaseForm.reasoningLevel || undefined,
    speedMode: useCaseForm.speedMode || undefined,
    timeoutSeconds: useCaseForm.timeoutSeconds || undefined,
    jsonSchemaEnabled: useCaseForm.jsonSchemaEnabled,
    schemaClasspath: useCaseForm.schemaClasspath.trim() || undefined,
    promptTemplate: useCaseForm.promptTemplate,
    promptVariablesDesc: useCaseForm.promptVariablesDesc.trim() || undefined,
    promptVersion: useCaseForm.promptVersion,
    promptChecksum: useCaseForm.promptChecksum || undefined,
    enabled: useCaseForm.enabled,
    remark: useCaseForm.remark.trim() || undefined,
  }
  useCaseSaving.value = true
  try {
    if (useCaseForm.id) {
      await updateAiUseCase(useCaseForm.id, payload)
    } else {
      await createAiUseCase(payload)
    }
    ElMessage.success('AI 场景配置已保存')
    useCaseDialogVisible.value = false
    await loadUseCases()
  } catch (error) {
    ElMessage.error(errorMessage(error, '保存 AI 场景配置失败'))
  } finally {
    useCaseSaving.value = false
  }
}

function handleUseCaseProviderParamChange(changedField: 'vendor' | 'modelProvider' | 'channel') {
  if (changedField === 'vendor') {
    const modelProviders = useCaseModelProviderOptions.value
    if (!modelProviders.includes(useCaseForm.uiProviderModelProvider)) {
      useCaseForm.uiProviderModelProvider = modelProviders[0] || ''
    }
  }
  if (changedField === 'vendor' || changedField === 'modelProvider') {
    const channels = useCaseChannelOptions.value.filter((item) => useCaseForm.enabled ? !item.disabled : true)
    if (!channels.find((item) => item.value === useCaseForm.uiProviderChannelType)) {
      useCaseForm.uiProviderChannelType = channels[0]?.value || ''
    }
  }
  useCaseForm.providerConfigId = resolveUseCaseProviderConfigId()
}

function syncUseCaseProviderFields() {
  const provider = providerList.value.find((item) => item.id === useCaseForm.providerConfigId)
  if (!provider) {
    return
  }
  useCaseForm.uiProviderVendor = provider.vendor || ''
  useCaseForm.uiProviderModelProvider = provider.modelProvider || ''
  useCaseForm.uiProviderChannelType = String(provider.channelType || '').toUpperCase()
}

function resolveUseCaseProviderConfigId() {
  const vendor = useCaseForm.uiProviderVendor || ''
  const provider = providerList.value.find((item) => {
    return (item.vendor || '') === vendor &&
      item.modelProvider === useCaseForm.uiProviderModelProvider &&
      String(item.channelType || '').toUpperCase() === useCaseForm.uiProviderChannelType &&
      (item.enabled || !useCaseForm.enabled)
  })
  return provider?.id || null
}

function buildProviderCode(channelType: string) {
  return [
    providerForm.vendor || 'DIRECT',
    providerForm.modelProvider || 'MODEL',
    channelType,
  ].join('-').toLowerCase()
}

function providerGroupName(vendor: string, modelProvider: string) {
  const modelText = modelProviderText(modelProvider)
  return vendor ? `${vendorText(vendor)} ${modelText}` : `直连 ${modelText}`
}

function stripChannelSuffix(value?: string) {
  return String(value || '')
    .replace(/\s*API通道\s*$/, '')
    .replace(/\s*CLI通道\s*$/, '')
    .trim()
}

function optionText(options: OptionItem[], code?: string) {
  if (!code) {
    return '-'
  }
  return options.find((item) => item.code === code)?.label || code
}

function vendorText(value?: string) {
  return value ? optionText(vendorOptions, value) : '直连'
}

function modelProviderText(value?: string) {
  return optionText(modelProviderOptions, value)
}

function channelTypeText(value?: string) {
  return optionText(channelTypeOptions, value)
}

function domainText(value?: string) {
  return optionText(domainOptions, value)
}

function modelText(value?: string) {
  return optionText(modelOptions, value)
}

function reasoningText(value?: string) {
  return optionText(reasoningOptions, value)
}

function speedText(value?: string) {
  return optionText(speedOptions, value)
}

function sourceText(value?: string) {
  if (value === 'USE_CASE') return '任务覆盖'
  if (value === 'PROVIDER') return '通道默认'
  return '未配置'
}

function requiresLocalRepository(useCaseCode?: string) {
  return ['intake.clarification.analyze', 'intake.development.analyze', 'intake.development.adjust'].includes(useCaseCode || '')
}

function useCaseCapabilityText(useCaseCode?: string) {
  if (requiresLocalRepository(useCaseCode)) {
    return '本地仓库只读'
  }
  if (['intake.structured.extract', 'intake.sql-draft.generate'].includes(useCaseCode || '')) {
    return '文本 / 显式图片'
  }
  return '受控模型调用'
}

function shortChecksum(value?: string) {
  return value ? value.slice(0, 10) : '-'
}

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { message?: string } } }
  return response.response?.data?.message || fallback
}

onMounted(async () => {
  try {
    await loadDicts()
  } catch (error) {
    ElMessage.error(errorMessage(error, '加载 AI 配置字典失败'))
  }
  await loadProviders()
  await loadUseCases()
})
</script>

<template>
  <div class="page-card ai-config-page">
    <div class="page-header">
      <div>
        <p class="page-desc">统一维护 AI 接入通道、内置业务场景、模型参数、Schema 和提示词模板。</p>
      </div>
      <div class="header-actions">
        <el-button @click="reloadCurrent">刷新</el-button>
        <el-button v-if="activeTab === 'provider' && canCreate" type="primary" @click="openProviderDialog()">新增接入配置</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="ai-tabs">
      <el-tab-pane label="AI任务配置" name="useCase">
        <el-form inline class="filter-form" @submit.prevent="loadUseCases">
          <el-form-item label="领域">
            <el-select v-model="useCaseQuery.domain" clearable placeholder="全部" style="width: 120px" @change="loadUseCases">
              <el-option v-for="item in domainOptions" :key="item.code" :label="item.label" :value="item.code" />
            </el-select>
          </el-form-item>
          <el-form-item label="接入供应商">
            <el-select v-model="useCaseQuery.vendor" clearable filterable placeholder="全部" style="width: 150px" @change="loadUseCases">
              <el-option label="直连" value="" />
              <el-option v-for="item in vendorOptions" :key="item.code" :label="item.label" :value="item.code" />
            </el-select>
          </el-form-item>
          <el-form-item label="模型厂商">
            <el-select v-model="useCaseQuery.modelProvider" clearable filterable placeholder="全部" style="width: 150px" @change="loadUseCases">
              <el-option v-for="item in modelProviderOptions" :key="item.code" :label="item.label" :value="item.code" />
            </el-select>
          </el-form-item>
          <el-form-item label="通道">
            <el-select v-model="useCaseQuery.channelType" clearable placeholder="全部" style="width: 110px" @change="loadUseCases">
              <el-option v-for="item in channelTypeOptions" :key="item.code" :label="item.label" :value="item.code" />
            </el-select>
          </el-form-item>
          <el-form-item label="启停">
            <el-select v-model="useCaseQuery.enabled" clearable placeholder="全部" style="width: 110px" @change="loadUseCases">
              <el-option label="启用" :value="true" />
              <el-option label="停用" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键字">
            <el-input v-model="useCaseQuery.keyword" clearable placeholder="编码 / 名称" @keyup.enter="loadUseCases" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadUseCases">查询</el-button>
            <el-button @click="resetUseCaseQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="useCaseLoading" :data="useCaseList" border>
          <el-table-column label="状态" width="86" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="AI任务" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ row.useCaseName || row.useCaseCode }}</div>
              <div class="sub-text">{{ row.useCaseCode }}</div>
            </template>
          </el-table-column>
          <el-table-column label="领域" width="90" align="center">
            <template #default="{ row }">{{ domainText(row.domain) }}</template>
          </el-table-column>
          <el-table-column label="执行能力" width="130" align="center">
            <template #default="{ row }">{{ useCaseCapabilityText(row.useCaseCode) }}</template>
          </el-table-column>
          <el-table-column label="接入配置" min-width="230" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ row.providerName || row.providerCode || '-' }}</div>
              <div class="sub-text">{{ vendorText(row.vendor) }} / {{ modelProviderText(row.modelProvider) }} / {{ channelTypeText(row.channelType) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="模型" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ modelText(row.effectiveModel) }} <el-tag size="small" :type="row.modelSource === 'USE_CASE' ? 'warning' : 'info'">{{ sourceText(row.modelSource) }}</el-tag></div>
              <div class="sub-text">{{ reasoningText(row.effectiveReasoningLevel) }} / {{ speedText(row.effectiveSpeedMode) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="超时" width="90" align="right">
            <template #default="{ row }">
              <div>{{ row.effectiveTimeoutSeconds || '-' }}s</div>
              <div class="sub-text">{{ sourceText(row.timeoutSecondsSource) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="结构化" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.jsonSchemaEnabled ? 'warning' : 'info'">{{ row.jsonSchemaEnabled ? 'Schema' : '普通' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提示词" width="120" align="center">
            <template #default="{ row }">
              <div>v{{ row.promptVersion || 1 }}</div>
              <div class="sub-text">{{ shortChecksum(row.promptChecksum) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdate" link type="primary" @click="openUseCaseDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="useCaseQuery.page"
            v-model:page-size="useCaseQuery.pageSize"
            layout="total, sizes, prev, pager, next"
            :total="useCaseTotal"
            :page-sizes="[10, 20, 50, 100]"
            @change="loadUseCases"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="接入配置" name="provider">
        <el-table v-loading="providerLoading" :data="providerGroups" border>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabledCount > 0 ? 'success' : 'info'">{{ row.enabledCount }} 个通道</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="接入组合" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ row.groupName }}</div>
              <div class="sub-text">{{ vendorText(row.vendor) }} / {{ modelProviderText(row.modelProvider) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="接入供应商" width="130" align="center">
            <template #default="{ row }">{{ vendorText(row.vendor) }}</template>
          </el-table-column>
          <el-table-column label="模型厂商" width="130" align="center">
            <template #default="{ row }">{{ modelProviderText(row.modelProvider) }}</template>
          </el-table-column>
          <el-table-column label="API通道" min-width="250" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">
                <el-tag :type="row.api?.enabled ? 'success' : 'info'">{{ row.api?.enabled ? '启用' : '停用' }}</el-tag>
                <span class="inline-meta">{{ row.api?.apiProtocol || '-' }}</span>
              </div>
              <div class="sub-text">{{ row.api?.apiBaseUrl || '-' }}</div>
              <div class="sub-text">默认：{{ row.api?.defaultModel || '-' }} / {{ reasoningText(row.api?.defaultReasoningLevel) }} / {{ speedText(row.api?.defaultSpeedMode) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="CLI通道" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">
                <el-tag :type="row.cli?.enabled ? 'success' : 'info'">{{ row.cli?.enabled ? '启用' : '停用' }}</el-tag>
                <span class="inline-meta">{{ row.cli?.cliCommand || '-' }}</span>
              </div>
              <div class="sub-text">{{ row.cli?.cliWorkingDirectory || '-' }}</div>
              <div class="sub-text">默认：{{ row.cli?.defaultModel || '-' }} / {{ reasoningText(row.cli?.defaultReasoningLevel) }} / {{ speedText(row.cli?.defaultSpeedMode) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdate" link type="primary" @click="openProviderDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-dialog v-model="providerDialogVisible" :title="providerForm.editing ? '编辑接入配置' : '新增接入配置'" width="920px">
    <el-form ref="providerFormRef" label-position="top">
      <div class="form-grid provider-basic-grid">
        <el-form-item label="接入名称">
          <el-input v-model="providerForm.groupName" placeholder="留空按供应商和模型厂商生成" />
        </el-form-item>
        <el-form-item label="接入供应商">
          <el-select v-model="providerForm.vendor" clearable filterable placeholder="直连" style="width: 100%">
            <el-option v-for="item in vendorOptions" :key="item.code" :label="item.label" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型厂商">
          <el-select v-model="providerForm.modelProvider" filterable style="width: 100%">
            <el-option v-for="item in modelProviderOptions" :key="item.code" :label="item.label" :value="item.code" />
          </el-select>
        </el-form-item>
      </div>

      <el-tabs v-model="providerChannelTab" type="border-card" class="channel-tabs">
        <el-tab-pane name="API">
          <template #label>
            API 通道
            <el-tag class="tab-tag" :type="providerForm.api.enabled ? 'success' : 'info'">{{ providerForm.api.enabled ? '启用' : '停用' }}</el-tag>
          </template>
          <div class="channel-head">
            <div>
              <div class="main-text">API 通道</div>
              <div class="sub-text">协议、Base URL、API Key 和超时配置</div>
            </div>
            <el-switch v-model="providerForm.api.enabled" />
          </div>
          <div v-if="providerForm.api.enabled" class="channel-body">
            <div class="form-grid three-grid">
              <el-form-item label="API协议">
                <el-select v-model="providerForm.api.apiProtocol" filterable allow-create style="width: 100%">
                  <el-option v-for="item in apiProtocolOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="Base URL" class="wide-field">
                <el-input v-model="providerForm.api.apiBaseUrl" placeholder="例如 https://openrouter.ai/api/v1" />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="providerForm.api.apiKey" show-password />
              </el-form-item>
              <el-form-item label="应用名">
                <el-input v-model="providerForm.api.appName" placeholder="OpenRouter X-Title" />
              </el-form-item>
              <el-form-item label="站点URL">
                <el-input v-model="providerForm.api.siteUrl" placeholder="OpenRouter HTTP-Referer" />
              </el-form-item>
            </div>
            <div class="form-grid three-grid">
              <el-form-item label="默认模型">
                <el-select v-model="providerForm.api.defaultModel" filterable style="width: 100%">
                  <el-option v-for="item in modelOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认推理强度">
                <el-select v-model="providerForm.api.defaultReasoningLevel" filterable style="width: 100%">
                  <el-option v-for="item in reasoningOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认速度">
                <el-select v-model="providerForm.api.defaultSpeedMode" filterable style="width: 100%">
                  <el-option v-for="item in speedOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
            </div>
            <div class="form-grid three-grid">
              <el-form-item label="连接超时">
                <el-input-number v-model="providerForm.api.connectTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
              <el-form-item label="读取超时">
                <el-input-number v-model="providerForm.api.readTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
              <el-form-item label="总调用超时">
                <el-input-number v-model="providerForm.api.callTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
            </div>
          </div>
          <el-empty v-else description="API 通道未启用" :image-size="72" />
        </el-tab-pane>

        <el-tab-pane name="CLI">
          <template #label>
            CLI 通道
            <el-tag class="tab-tag" :type="providerForm.cli.enabled ? 'success' : 'info'">{{ providerForm.cli.enabled ? '启用' : '停用' }}</el-tag>
          </template>
          <div class="channel-head">
            <div>
              <div class="main-text">CLI 通道</div>
              <div class="sub-text">CLI 命令、工作目录和超时配置</div>
            </div>
            <el-switch v-model="providerForm.cli.enabled" />
          </div>
          <div v-if="providerForm.cli.enabled" class="channel-body">
            <div class="form-grid two-grid">
              <el-form-item label="CLI命令">
                <el-input v-model="providerForm.cli.cliCommand" placeholder="例如 codex" />
              </el-form-item>
              <el-form-item label="CLI工作目录">
                <el-input v-model="providerForm.cli.cliWorkingDirectory" />
              </el-form-item>
            </div>
            <div class="form-grid three-grid">
              <el-form-item label="默认模型">
                <el-select v-model="providerForm.cli.defaultModel" filterable style="width: 100%">
                  <el-option v-for="item in modelOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认推理强度">
                <el-select v-model="providerForm.cli.defaultReasoningLevel" filterable style="width: 100%">
                  <el-option v-for="item in reasoningOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认速度">
                <el-select v-model="providerForm.cli.defaultSpeedMode" filterable style="width: 100%">
                  <el-option v-for="item in speedOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
            </div>
            <div class="form-grid three-grid">
              <el-form-item label="连接超时">
                <el-input-number v-model="providerForm.cli.connectTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
              <el-form-item label="读取超时">
                <el-input-number v-model="providerForm.cli.readTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
              <el-form-item label="总调用超时">
                <el-input-number v-model="providerForm.cli.callTimeoutSeconds" :min="1" :max="7200" style="width: 100%" />
              </el-form-item>
            </div>
          </div>
          <el-empty v-else description="CLI 通道未启用" :image-size="72" />
        </el-tab-pane>
      </el-tabs>

      <el-form-item label="备注">
        <el-input v-model="providerForm.remark" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="provider-dialog-footer">
        <div class="connection-test-area">
          <el-button
            v-if="canTestConnection"
            :loading="providerTesting[activeProviderChannelKey]"
            :disabled="providerSaving || anyProviderTesting || !activeProviderChannel.enabled"
            @click="testProviderConnection"
          >测试连通性</el-button>
          <span
            v-if="activeProviderTestResult"
            class="connection-test-result"
            :class="`is-${activeProviderTestResult.status}`"
          >{{ activeProviderTestResult.message }}</span>
        </div>
        <div class="provider-dialog-actions">
          <el-button :disabled="anyProviderTesting" @click="providerDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="providerSaving"
            :disabled="anyProviderTesting"
            @click="saveProviderForm"
          >保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>

  <el-dialog v-model="useCaseDialogVisible" title="编辑AI任务" width="1120px" class="use-case-dialog">
    <el-form ref="useCaseFormRef" label-position="top">
      <div class="use-case-editor">
        <div class="use-case-side">
          <section class="editor-section">
            <h3>基础信息</h3>
            <el-form-item label="任务编码">
              <el-input v-model="useCaseForm.useCaseCode" disabled />
            </el-form-item>
            <el-form-item label="任务名称">
              <el-input v-model="useCaseForm.useCaseName" />
            </el-form-item>
            <el-form-item label="执行能力">
              <el-input :model-value="useCaseCapabilityText(useCaseForm.useCaseCode)" disabled />
            </el-form-item>
            <div class="form-grid two-grid">
              <el-form-item label="领域">
                <el-select v-model="useCaseForm.domain" filterable allow-create style="width: 100%">
                  <el-option v-for="item in domainOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="状态">
                <el-switch v-model="useCaseForm.enabled" active-text="启用" inactive-text="停用" />
              </el-form-item>
            </div>
            <el-form-item label="描述">
              <el-input v-model="useCaseForm.description" type="textarea" :rows="3" resize="none" />
            </el-form-item>
          </section>

          <section class="editor-section">
            <h3>调用参数</h3>
            <div class="form-grid three-grid compact-grid">
              <el-form-item label="接入供应商">
                <el-select v-model="useCaseForm.uiProviderVendor" clearable filterable placeholder="直连" style="width: 100%" @change="handleUseCaseProviderParamChange('vendor')">
                  <el-option v-for="item in useCaseVendorOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="模型厂商">
                <el-select v-model="useCaseForm.uiProviderModelProvider" filterable style="width: 100%" @change="handleUseCaseProviderParamChange('modelProvider')">
                  <el-option v-for="item in useCaseModelProviderOptions" :key="item" :label="modelProviderText(item)" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="通道">
                <el-select v-model="useCaseForm.uiProviderChannelType" style="width: 100%" @change="handleUseCaseProviderParamChange('channel')">
                  <el-option v-for="item in useCaseChannelOptions" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" />
                </el-select>
              </el-form-item>
            </div>
            <div v-if="selectedProvider" class="selected-provider">
              <el-tag :type="selectedProvider.enabled ? 'success' : 'info'">{{ channelTypeText(selectedProvider.channelType) }}</el-tag>
              <span>{{ selectedProvider.providerName }}</span>
              <span class="sub-text">{{ selectedProvider.providerCode }}</span>
              <span class="sub-text">默认：{{ selectedProvider.defaultModel || '-' }} / {{ reasoningText(selectedProvider.defaultReasoningLevel) }} / {{ speedText(selectedProvider.defaultSpeedMode) }} / {{ selectedProvider.callTimeoutSeconds || '-' }}s</span>
            </div>
            <div v-else class="unmatched-provider">当前参数没有匹配到已启用的接入配置，请先在“接入配置”中维护对应组合和通道。</div>
            <div class="section-subtitle">任务级覆盖（可选）</div>
            <el-form-item label="模型覆盖">
              <el-select v-model="useCaseForm.model" clearable filterable allow-create placeholder="留空继承通道默认模型" style="width: 100%">
                <el-option v-for="item in modelOptions" :key="item.code" :label="item.label" :value="item.code" />
              </el-select>
            </el-form-item>
            <div class="form-grid three-grid">
              <el-form-item label="推理强度覆盖">
                <el-select v-model="useCaseForm.reasoningLevel" clearable filterable placeholder="继承通道默认值" style="width: 100%">
                  <el-option v-for="item in reasoningOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="速度覆盖">
                <el-select v-model="useCaseForm.speedMode" clearable filterable placeholder="继承通道默认值" style="width: 100%">
                  <el-option v-for="item in speedOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="总调用超时覆盖">
                <el-input-number v-model="useCaseForm.timeoutSeconds" :min="1" :max="7200" placeholder="继承通道默认值" style="width: 100%" />
              </el-form-item>
            </div>
            <div class="effective-config-grid">
              <div><span>最终模型</span><strong>{{ effectivePreview.model }}</strong><em>{{ sourceText(effectivePreview.modelSource) }}</em></div>
              <div><span>最终推理</span><strong>{{ effectivePreview.reasoning }}</strong><em>{{ sourceText(effectivePreview.reasoningSource) }}</em></div>
              <div><span>最终速度</span><strong>{{ effectivePreview.speed }}</strong><em>{{ sourceText(effectivePreview.speedSource) }}</em></div>
              <div><span>最终超时</span><strong>{{ effectivePreview.timeout ? `${effectivePreview.timeout}s` : '-' }}</strong><em>{{ sourceText(effectivePreview.timeoutSource) }}</em></div>
            </div>
          </section>
        </div>

        <div class="use-case-main">
          <section class="editor-section">
            <h3>输出约束</h3>
            <div class="form-grid output-grid">
              <el-form-item label="结构化输出">
                <el-switch v-model="useCaseForm.jsonSchemaEnabled" active-text="Schema" inactive-text="普通文本" />
              </el-form-item>
              <el-form-item label="Schema路径">
                <el-input v-model="useCaseForm.schemaClasspath" placeholder="classpath 下的 JSON Schema 路径" />
              </el-form-item>
              <el-form-item label="提示词版本">
                <el-input :model-value="`v${useCaseForm.promptVersion || 1} ${shortChecksum(useCaseForm.promptChecksum)}`" disabled />
              </el-form-item>
            </div>
          </section>

          <section class="editor-section prompt-section">
            <h3>提示词</h3>
            <el-form-item label="变量说明">
              <el-input v-model="useCaseForm.promptVariablesDesc" type="textarea" :rows="3" resize="none" />
            </el-form-item>
            <el-form-item label="提示词模板">
              <el-input v-model="useCaseForm.promptTemplate" type="textarea" :autosize="{ minRows: 16, maxRows: 24 }" class="prompt-input" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="useCaseForm.remark" type="textarea" :rows="2" resize="none" />
            </el-form-item>
          </section>
        </div>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="useCaseDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="useCaseSaving" @click="saveUseCaseForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ai-config-page {
  padding: 24px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.ai-tabs {
  margin-top: 16px;
}

.filter-form {
  margin-bottom: 12px;
}

.main-text {
  color: #111827;
  font-weight: 600;
  line-height: 20px;
}

.sub-text {
  color: #8492a6;
  font-size: 12px;
  line-height: 18px;
}

.inline-meta {
  margin-left: 8px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.provider-basic-grid {
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr);
}

.two-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.three-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.wide-field {
  grid-column: span 2;
}

.channel-tabs {
  margin-bottom: 16px;
}

.tab-tag {
  margin-left: 8px;
}

.channel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.channel-body {
  padding: 16px 16px 2px;
}

.provider-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.connection-test-area,
.provider-dialog-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connection-test-area {
  min-width: 0;
  text-align: left;
}

.connection-test-result {
  overflow: hidden;
  max-width: 520px;
  color: #606266;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.use-case-dialog :deep(.el-dialog__body) {
  background: #f6f8fb;
}

.use-case-editor {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.use-case-side,
.use-case-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.editor-section {
  padding: 14px 14px 2px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.editor-section h3 {
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #edf0f3;
  color: #111827;
  font-size: 14px;
}

.compact-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.selected-provider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 14px;
  color: #4b5563;
  font-size: 12px;
}

.unmatched-provider {
  margin: 2px 0 14px;
  color: #b45309;
  font-size: 12px;
}

.section-subtitle {
  margin: 4px 0 12px;
  color: #303133;
  font-size: 13px;
  font-weight: 600;
}

.effective-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 4px 0 12px;
}

.effective-config-grid > div {
  display: grid;
  gap: 3px;
  padding: 9px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.effective-config-grid span,
.effective-config-grid em {
  color: #8492a6;
  font-size: 11px;
  font-style: normal;
}

.output-grid {
  grid-template-columns: 150px minmax(0, 1fr) 190px;
}

.prompt-input :deep(.el-textarea__inner) {
  min-height: 360px !important;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .use-case-editor,
  .provider-basic-grid,
  .output-grid {
    grid-template-columns: 1fr;
  }
}
</style>
