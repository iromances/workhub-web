<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createAiProvider,
  createAiUseCase,
  fetchAiProviders,
  fetchAiUseCaseDetail,
  fetchAiUseCases,
  fetchDictOptions,
  fetchCodexModels,
  fetchZCodeModels,
  testAiProviderConnection,
  updateAiProvider,
  deleteAiUseCase, updateAiUseCase,
} from '@/api/ai-config'
import { useAuthStore } from '@/stores/auth'
import type {
  AiProviderConfig,
  AiProviderConfigRequest,
  AiProviderGroup,
  AiUseCaseConfig,
  AiUseCaseConfigRequest,
  CodexModelCatalog,
} from '@/types/ai-config'

import { createCodexCatalogLoader, matchingEffort, reasoningAfterModelChange, validateCliSelection,
  type CodexCatalogState } from './codexModelForm'

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
  cliType: 'CODEX' | 'ZCODE'
  cliRuntimeCommand: string
  cliBuiltinConfigPath: string
  cliPersonalConfigPath: string
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
const useCaseEditTab = ref('basic')
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

interface CliCatalogRequest {
  cliType: 'CODEX' | 'ZCODE'
  cliCommand: string
  cliWorkingDirectory?: string
  cliRuntimeCommand?: string
  cliBuiltinConfigPath?: string
  cliPersonalConfigPath?: string
  forceRefresh?: boolean
}

function fetchCliCatalog(request: CliCatalogRequest) {
  const { cliType, cliRuntimeCommand, cliBuiltinConfigPath, cliPersonalConfigPath, ...common } = request
  return cliType === 'ZCODE'
    ? fetchZCodeModels({ cliCommand: common.cliCommand, forceRefresh: common.forceRefresh,
      cliRuntimeCommand, cliBuiltinConfigPath, cliPersonalConfigPath })
    : fetchCodexModels(common)
}

const cliCatalog = reactive<CodexCatalogState>({ catalog: null, loading: false, error: '' })
const cliCatalogLoader = createCodexCatalogLoader(cliCatalog, fetchCliCatalog,
  error => errorMessage(error, '加载 CLI 模型失败，请重试'))
const useCaseCliCatalog = reactive<CodexCatalogState>({ catalog: null, loading: false, error: '' })
const useCaseCliCatalogLoader = createCodexCatalogLoader(useCaseCliCatalog, fetchCliCatalog,
  error => errorMessage(error, '加载通道模型列表失败，请重试'))

/** 列表展示用名称表：按 CLI 配置签名去重，会话内每签名只请求一次；失败静默回退原始标识并允许下次重试 */
const cliModelCatalogs = new Map<string, Promise<CodexModelCatalog>>()
const cliModelNames = reactive<Record<string, string>>({})

function cliCatalogSignature(provider: AiProviderConfig) {
  return [resolvedCliType(provider), provider.cliCommand, provider.cliWorkingDirectory,
    provider.cliRuntimeCommand, provider.cliBuiltinConfigPath, provider.cliPersonalConfigPath].join('|')
}

function loadCliModelNames() {
  providerList.value.filter(item => item.channelType === 'CLI').forEach(item => {
    const signature = cliCatalogSignature(item)
    if (cliModelCatalogs.has(signature)) return
    const request = fetchCliCatalog({
      cliType: resolvedCliType(item),
      cliCommand: item.cliCommand || '',
      cliWorkingDirectory: item.cliWorkingDirectory,
      cliRuntimeCommand: item.cliRuntimeCommand,
      cliBuiltinConfigPath: item.cliBuiltinConfigPath,
      cliPersonalConfigPath: item.cliPersonalConfigPath,
    })
    cliModelCatalogs.set(signature, request)
    request.then(catalog => catalog.models.forEach(model => {
      cliModelNames[model.model] = model.displayName
    })).catch(() => cliModelCatalogs.delete(signature))
  })
}

function cliModelText(value?: string) {
  return value ? (cliModelNames[value] || value) : '-'
}
let originalCli: ChannelForm | null = null
const isZCode = computed(() => providerForm.cli.cliType === 'ZCODE')
const cliModels = computed(() => cliCatalog.catalog?.models ?? [])
const selectedCliModel = computed(() => cliModels.value.find(item => item.model === providerForm.cli.defaultModel))
const cliEfforts = computed(() => selectedCliModel.value?.supportedReasoningEfforts ?? [])
const cliModelMissing = computed(() => !!providerForm.cli.defaultModel && !selectedCliModel.value)
const cliEffortMissing = computed(() => !!providerForm.cli.defaultReasoningLevel
  && !matchingEffort(selectedCliModel.value, providerForm.cli.defaultReasoningLevel))
const cliReasoningValue = computed({
  get: () => matchingEffort(selectedCliModel.value, providerForm.cli.defaultReasoningLevel) ?? providerForm.cli.defaultReasoningLevel,
  set: (value: string) => { providerForm.cli.defaultReasoningLevel = value },
})

function invalidateCliCatalog() {
  cliCatalogLoader.invalidate()
}

function loadCliCatalog(forceRefresh = false) {
  if (!providerDialogVisible.value || !providerForm.cli.enabled) return
  void cliCatalogLoader.load({
    cliType: providerForm.cli.cliType,
    cliRuntimeCommand: providerForm.cli.cliRuntimeCommand,
    cliBuiltinConfigPath: providerForm.cli.cliBuiltinConfigPath,
    cliPersonalConfigPath: providerForm.cli.cliPersonalConfigPath,
    cliCommand: providerForm.cli.cliCommand,
    cliWorkingDirectory: providerForm.cli.cliWorkingDirectory,
    forceRefresh,
  })
}

function cliTypeChanged() {
  invalidateCliCatalog()
  providerForm.cli.cliCommand = isZCode.value ? 'zcode' : 'codex'
  providerForm.cli.defaultModel = ''
  providerForm.cli.defaultReasoningLevel = ''
  providerForm.cli.defaultSpeedMode = 'STANDARD'
  loadCliCatalog()
}

function cliEnabledChanged() {
  invalidateCliCatalog()
  loadCliCatalog()
}

function validateZCodeFormat(channel: ChannelForm) {
  if (!/^[^\s/$]+\/[^\s$]+$/.test(channel.defaultModel)) return '请填写 ZCode 的 Provider/Model 标识'
  if (!channel.defaultReasoningLevel.trim()) return '请填写 ZCode 模型支持的推理档位'
  if (channel.defaultSpeedMode !== 'STANDARD') return 'ZCode 速度使用标准模式'
  return ''
}

/** 仅接入配置弹框使用：目录选型校验依赖该弹框的 cliCatalog 与 originalCli */
function validateZCode(channel: ChannelForm) {
  if (!channel.enabled) return ''
  return validateZCodeFormat(channel) || validateCliSelection(channel, originalCli, cliCatalog.catalog)
}

function cliModelChanged() {
  if (selectedCliModel.value) {
    providerForm.cli.defaultReasoningLevel = reasoningAfterModelChange(
      selectedCliModel.value, providerForm.cli.defaultReasoningLevel)
  }
}

watch(providerDialogVisible, visible => {
  if (!visible) invalidateCliCatalog()
}, { flush: 'sync' })

const useCaseForm = reactive({
  id: null as number | null,
  useCaseCode: '',
  useCaseName: '',
  domain: 'SYSTEM',
  description: '',
  providerConfigId: null as number | null,
  uiProviderVendor: '',
  uiProviderModelProvider: '',
  uiProviderSelection: '',
  capability: null as string | null,
  allowedChannelTypes: null as string[] | null,
  allowedCliTypes: null as string[] | null,
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

function resolvedCliType(row: AiProviderConfig): 'CODEX' | 'ZCODE' {
  return row.cliType || (/^zcode(?:$|[.-])/.test((row.cliCommand || '').split('/').pop() || '') ? 'ZCODE' : 'CODEX')
}

function providerOrder(row: AiProviderConfig) {
  return row.channelType === 'API' ? 0 : resolvedCliType(row) === 'CODEX' ? 1 : 2
}

const providerGroups = computed<AiProviderGroup[]>(() => {
  const groups = new Map<string, AiProviderGroup>()
  const ordered = [...providerList.value].sort((a, b) => providerOrder(a) - providerOrder(b) || a.id - b.id)
  ordered.forEach((item) => {
    const baseKey = `${item.vendor || ''}__${item.modelProvider || ''}`
    const existing = groups.get(baseKey)
    const occupied = item.channelType === 'API' ? existing?.api : existing?.cli
    const key = occupied ? `${baseKey}__${item.id}` : baseKey
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

/** 按后端下发的场景能力判断通道是否可选；未注册场景（能力字段为空）不做限制 */
function useCaseChannelAllowed(item: AiProviderConfig): boolean {
  if (!useCaseForm.allowedChannelTypes && !useCaseForm.allowedCliTypes) return true
  if (useCaseForm.allowedChannelTypes && !useCaseForm.allowedChannelTypes.includes(item.channelType)) return false
  if (item.channelType === 'CLI' && useCaseForm.allowedCliTypes
    && !useCaseForm.allowedCliTypes.includes(resolvedCliType(item))) return false
  return true
}

const useCaseVendorOptions = computed(() => {
  const values = new Set(providerList.value.filter(useCaseChannelAllowed).map((item) => item.vendor || ''))
  return Array.from(values).map((value) => ({ value, label: vendorText(value) }))
})

const useCaseModelProviderOptions = computed(() => {
  const vendor = useCaseForm.uiProviderVendor || ''
  const values = new Set<string>()
  providerList.value.forEach((item) => {
    if ((item.vendor || '') === vendor && item.modelProvider && useCaseChannelAllowed(item)) {
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
    .filter(useCaseChannelAllowed)
    .map((item) => ({
      value: String(item.id),
      label: `${item.channelType === 'CLI' ? resolvedCliType(item) === 'ZCODE' ? 'GLM ZCode CLI' : 'Codex CLI' : channelTypeText(item.channelType)} · ${item.providerName}${item.enabled ? '' : '（停用）'}`,
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

const selectedProviderIsZCode = computed(() => !!selectedProvider.value && selectedProvider.value.channelType === 'CLI' && resolvedCliType(selectedProvider.value) === 'ZCODE')
const useCaseSpeedOptions = computed(() => speedOptions.filter(item => !selectedProviderIsZCode.value || item.code === 'STANDARD'))

/** 模型/强度覆盖可选值跟随所选通道：CLI 用目录真实列表，API 用系统字典，通道默认值始终兜底可选 */
const useCaseModelOptions = computed(() => {
  const provider = selectedProvider.value
  const merged = new Map<string, string>()
  const addOption = (code?: string, label?: string) => {
    if (code && !merged.has(code)) merged.set(code, label || code)
  }
  if (provider?.channelType === 'CLI') {
    (useCaseCliCatalog.catalog?.models ?? []).forEach(item => addOption(item.model, item.displayName))
  } else {
    modelOptions.forEach(item => addOption(item.code, item.label))
  }
  addOption(provider?.defaultModel, provider?.defaultModel)
  return Array.from(merged, ([code, label]) => ({ code, label }))
})

/** 强度覆盖可选值：CLI 通道取当前生效模型（覆盖模型，未填则通道默认模型）支持的档位 */
const useCaseEffectiveCliModel = computed(() => {
  const provider = selectedProvider.value
  if (provider?.channelType !== 'CLI') return undefined
  const modelId = useCaseForm.model || provider.defaultModel || ''
  return useCaseCliCatalog.catalog?.models.find(item => item.model === modelId)
})

const useCaseReasoningOptions = computed<(OptionItem & { title?: string })[]>(() => {
  const model = useCaseEffectiveCliModel.value
  if (!model) return reasoningOptions.map(item => ({ ...item }))
  return model.supportedReasoningEfforts.map(item => ({
    code: item.reasoningEffort, label: item.reasoningEffort, title: item.description,
  }))
})

const useCaseReasoningMissing = computed(() => {
  const model = useCaseEffectiveCliModel.value
  if (!model || !useCaseForm.reasoningLevel) return false
  return !matchingEffort(model, useCaseForm.reasoningLevel)
})

watch(useCaseEffectiveCliModel, model => {
  if (!model || !useCaseForm.reasoningLevel) return
  if (!matchingEffort(model, useCaseForm.reasoningLevel)) {
    useCaseForm.reasoningLevel = reasoningAfterModelChange(model, useCaseForm.reasoningLevel)
  }
})

function loadUseCaseCliCatalog() {
  const provider = selectedProvider.value
  if (!useCaseDialogVisible.value || !provider || provider.channelType !== 'CLI') return
  void useCaseCliCatalogLoader.load({
    cliType: resolvedCliType(provider),
    cliCommand: provider.cliCommand || '',
    cliWorkingDirectory: provider.cliWorkingDirectory,
    cliRuntimeCommand: provider.cliRuntimeCommand,
    cliBuiltinConfigPath: provider.cliBuiltinConfigPath,
    cliPersonalConfigPath: provider.cliPersonalConfigPath,
  })
}

watch(useCaseDialogVisible, visible => {
  if (!visible) useCaseCliCatalogLoader.invalidate()
}, { flush: 'sync' })

/** 覆盖项留空即继承通道默认，这里把默认值直接展示在输入框提示里 */
const inheritModelPlaceholder = computed(() => {
  const raw = selectedProvider.value?.defaultModel
  return '留空继承通道默认模型'
})
const inheritReasoningPlaceholder = computed(() => {
  const raw = selectedProvider.value?.defaultReasoningLevel
  if (!raw) return '继承通道默认值'
  return selectedProvider.value?.channelType === 'CLI' ? `默认：${raw}` : `默认：${reasoningText(raw)}`
})
const inheritSpeedPlaceholder = computed(() => {
  const raw = selectedProvider.value?.defaultSpeedMode
  return raw ? `默认：${speedText(raw)}` : '继承通道默认值'
})
const inheritTimeoutPlaceholder = computed(() => {
  const raw = selectedProvider.value?.callTimeoutSeconds
  return raw ? `默认：${raw}s` : '继承通道默认值'
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
    cliType: 'CODEX',
    cliRuntimeCommand: '',
    cliBuiltinConfigPath: '',
    cliPersonalConfigPath: '',
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
    loadCliModelNames()
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
  invalidateCliCatalog()
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
  originalCli = { ...providerForm.cli }
  providerDialogVisible.value = true
  loadCliCatalog()
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
    cliType: resolvedCliType(row),
    cliRuntimeCommand: row.cliRuntimeCommand || '',
    cliBuiltinConfigPath: row.cliBuiltinConfigPath || '',
    cliPersonalConfigPath: row.cliPersonalConfigPath || '',
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
  const cliValidation = isZCode.value ? validateZCode(providerForm.cli) : validateCliSelection(providerForm.cli, originalCli, cliCatalog.catalog)
  if (cliValidation) {
    ElMessage.warning(cliValidation)
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
    cliType: channel.channelType === 'CLI' ? channel.cliType : undefined,
    cliRuntimeCommand: channel.cliRuntimeCommand || undefined,
    cliBuiltinConfigPath: channel.cliBuiltinConfigPath || undefined,
    cliPersonalConfigPath: channel.cliPersonalConfigPath || undefined,
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
  } else if (channel.cliType === 'ZCODE') {
    return validateZCode(channel)
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
      capability: detail.capability ?? null,
      allowedChannelTypes: detail.allowedChannelTypes ?? null,
      allowedCliTypes: detail.allowedCliTypes ?? null,
    })
    syncUseCaseProviderFields()
    useCaseEditTab.value = 'basic'
    useCaseDialogVisible.value = true
    loadUseCaseCliCatalog()
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
  useCaseForm.uiProviderSelection = ''
  useCaseForm.capability = null
  useCaseForm.allowedChannelTypes = null
  useCaseForm.allowedCliTypes = null
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

const useCaseDeleting = ref(false)

async function removeUseCase(row: AiUseCaseConfig) {
  const registered = Boolean(row.capability)
  try {
    await ElMessageBox.confirm(
      registered
        ? `确定删除「${row.useCaseName || row.useCaseCode}」？该任务为平台功能依赖，删除后相关流程将不可用，可重新创建恢复。`
        : `确定删除「${row.useCaseName || row.useCaseCode}」？删除后可重新创建恢复。`,
      '删除 AI 任务',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch { return }
  useCaseDeleting.value = true
  try {
    await deleteAiUseCase(row.id, row.version)
    ElMessage.success('AI 任务已删除')
    await loadUseCases()
  } catch (error) {
    ElMessage.error(errorMessage(error, '删除 AI 任务失败'))
  } finally {
    useCaseDeleting.value = false
  }
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
  if (selectedProviderIsZCode.value) {
    const validation = validateZCodeFormat({ ...createChannelForm('CLI'), enabled: true,
      defaultModel: useCaseForm.model || selectedProvider.value?.defaultModel || '',
      defaultReasoningLevel: useCaseForm.reasoningLevel || selectedProvider.value?.defaultReasoningLevel || '',
      defaultSpeedMode: useCaseForm.speedMode || selectedProvider.value?.defaultSpeedMode || '' })
    if (validation) { ElMessage.warning(validation); return }
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
    if (!channels.find((item) => item.value === useCaseForm.uiProviderSelection)) {
      useCaseForm.uiProviderSelection = channels[0]?.value || ''
    }
  }
  useCaseForm.providerConfigId = resolveUseCaseProviderConfigId()
  loadUseCaseCliCatalog()
}

function syncUseCaseProviderFields() {
  const provider = providerList.value.find((item) => item.id === useCaseForm.providerConfigId)
  if (!provider) {
    return
  }
  useCaseForm.uiProviderVendor = provider.vendor || ''
  useCaseForm.uiProviderModelProvider = provider.modelProvider || ''
  useCaseForm.uiProviderSelection = String(provider.id)
}

function resolveUseCaseProviderConfigId() {
  const vendor = useCaseForm.uiProviderVendor || ''
  const provider = providerList.value.find((item) => {
    return (item.vendor || '') === vendor &&
      item.modelProvider === useCaseForm.uiProviderModelProvider &&
      String(item.id) === useCaseForm.uiProviderSelection &&
      useCaseChannelAllowed(item) &&
      (item.enabled || !useCaseForm.enabled)
  })
  return provider?.id || null
}

function buildProviderCode(channelType: string) {
  return [
    providerForm.vendor || 'DIRECT',
    providerForm.modelProvider || 'MODEL',
    channelType,
    ...(channelType === 'CLI' && isZCode.value ? ['ZCODE'] : []),
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

/** 使用场景表模型列：CLI 绑定行查目录名称表，API 行走字典 */
function effectiveModelText(row: AiUseCaseConfig) {
  return row.channelType === 'CLI' ? cliModelText(row.effectiveModel) : modelText(row.effectiveModel)
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

function allowedChannelSummary() {
  const channelTypes = useCaseForm.allowedChannelTypes || []
  return channelTypes
    .map((type) => {
      if (type === 'CLI' && useCaseForm.allowedCliTypes?.length) {
        return useCaseForm.allowedCliTypes.map((cli) => (cli === 'CODEX' ? 'Codex CLI' : 'GLM ZCode CLI')).join(' / ')
      }
      return channelTypeText(type)
    })
    .join('、')
}

const unmatchedProviderMessage = computed(() => {
  const vendor = useCaseForm.uiProviderVendor || ''
  const comboChannels = providerList.value
    .filter((item) => (item.vendor || '') === vendor && item.modelProvider === useCaseForm.uiProviderModelProvider)
  if (comboChannels.length === 0) {
    return '当前供应商与模型厂商组合下没有接入通道，请先在“接入配置”中维护对应组合和通道。'
  }
  if (!comboChannels.some(useCaseChannelAllowed)) {
    return `该场景能力仅允许 ${allowedChannelSummary()} 通道，当前组合下没有符合条件的通道，请更换组合或先在“接入配置”中维护对应通道。`
  }
  return '当前组合下的通道均已停用，请先在“接入配置”中启用后再选择。'
})

function useCaseCapabilityText(capability?: string | null) {
  if (capability === 'LOCAL_REPOSITORY_READ') return '本地仓库只读'
  if (capability === 'IMAGE_INPUT') return '文本 / 显式图片'
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
            <template #default="{ row }">{{ useCaseCapabilityText(row.capability) }}</template>
          </el-table-column>
          <el-table-column label="接入配置" min-width="230" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ row.providerName || row.providerCode || '-' }}</div>
              <div class="sub-text">{{ vendorText(row.vendor) }} / {{ modelProviderText(row.modelProvider) }} / {{ channelTypeText(row.channelType) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="模型" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">{{ effectiveModelText(row) }} <el-tag size="small" :type="row.modelSource === 'USE_CASE' ? 'warning' : 'info'">{{ sourceText(row.modelSource) }}</el-tag></div>
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
          <el-table-column label="操作" width="124" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdate" link type="primary" @click="openUseCaseDialog(row)">编辑</el-button>
              <el-button v-if="canUpdate" link type="danger" :loading="useCaseDeleting" @click="removeUseCase(row)">删除</el-button>
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
        <div class="provider-toolbar">
          <el-button v-if="canCreate" type="primary" @click="openProviderDialog()">新增接入配置</el-button>
        </div>
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
              <div class="sub-text">默认：{{ modelText(row.api?.defaultModel) }} / {{ reasoningText(row.api?.defaultReasoningLevel) }} / {{ speedText(row.api?.defaultSpeedMode) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="CLI通道" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="main-text">
                <el-tag :type="row.cli?.enabled ? 'success' : 'info'">{{ row.cli?.enabled ? '启用' : '停用' }}</el-tag>
                <el-tag v-if="row.cli?.cliType === 'ZCODE'" size="small">ZCode</el-tag>
                <span class="inline-meta">{{ row.cli?.cliCommand || '-' }}</span>
              </div>
              <div class="sub-text">{{ row.cli?.cliWorkingDirectory || '-' }}</div>
              <div class="sub-text" :title="row.cli?.defaultModel || ''">默认：{{ cliModelText(row.cli?.defaultModel) }} / {{ reasoningText(row.cli?.defaultReasoningLevel) }} / {{ speedText(row.cli?.defaultSpeedMode) }}</div>
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
            <el-switch v-model="providerForm.cli.enabled" @change="cliEnabledChanged" />
          </div>
          <div v-if="providerForm.cli.enabled" class="channel-body">
            <el-form-item label="CLI 类型">
              <el-select v-model="providerForm.cli.cliType" @change="cliTypeChanged" style="width: 100%">
                <el-option label="Codex" value="CODEX" /><el-option label="GLM ZCode" value="ZCODE" />
              </el-select>
            </el-form-item>
            <div class="channel-head">
              <span class="sub-text" v-if="cliCatalog.loading">正在读取 {{ isZCode ? 'ZCode' : 'Codex' }} 模型列表…</span>
            </div>
            <el-alert v-if="cliCatalog.error" :title="cliCatalog.error" type="error" :closable="false" show-icon />
            <el-alert v-else-if="cliCatalog.catalog && (cliModelMissing || cliEffortMissing)"
              title="原配置的模型或推理强度当前不可选，已保留原值，请核对后选择。" type="warning" :closable="false" show-icon />
            <div class="form-grid two-grid">
              <el-form-item label="CLI命令">
                <el-input v-model="providerForm.cli.cliCommand" :placeholder="isZCode ? 'zcode 或已安装 zcode.cjs 的绝对路径' : '例如 codex'" @input="invalidateCliCatalog" @change="loadCliCatalog()" />
              </el-form-item>
              <el-form-item v-if="!isZCode" label="CLI工作目录">
                <el-input v-model="providerForm.cli.cliWorkingDirectory" @input="invalidateCliCatalog" @change="loadCliCatalog()" />
              </el-form-item>
            </div>
            <div v-if="isZCode" class="form-grid two-grid">
              <el-form-item label="Node 程序（CJS 分发）"><el-input v-model="providerForm.cli.cliRuntimeCommand" @input="invalidateCliCatalog" @change="loadCliCatalog()" placeholder="留空使用 node；填写已有兼容版本的程序路径" /></el-form-item>
              <el-form-item label="内置 Provider 定义"><el-input v-model="providerForm.cli.cliBuiltinConfigPath" @input="invalidateCliCatalog" @change="loadCliCatalog()" placeholder="已安装分发包中的 zcode-builtin.json；Mac App CJS 可自动定位" /></el-form-item>
              <el-form-item label="个人 Provider 配置"><el-input v-model="providerForm.cli.cliPersonalConfigPath" @input="invalidateCliCatalog" @change="loadCliCatalog()" placeholder="留空使用服务用户 ~/.zcode/v2/provider_config.json" /></el-form-item>
            </div>
            <div class="form-grid three-grid">
              <el-form-item>
                <template #label>
                  <span class="model-label">默认模型
                    <el-icon class="model-refresh" :class="{ 'is-loading': cliCatalog.loading }"
                      title="刷新模型" @click="loadCliCatalog(true)"><Refresh /></el-icon>
                    <span v-if="cliCatalog.catalog && !cliCatalog.loading" class="sub-text">{{ cliCatalog.catalog.cached ? '使用最近查询结果' : '模型列表已更新' }} · {{ new Date(cliCatalog.catalog.fetchedAt).toLocaleTimeString() }}</span>
                  </span>
                </template>
                <el-select v-model="providerForm.cli.defaultModel" filterable style="width: 100%"
                  :loading="cliCatalog.loading" :disabled="!cliCatalog.catalog || cliCatalog.loading" @change="cliModelChanged">
                  <el-option v-if="cliModelMissing" :value="providerForm.cli.defaultModel"
                    :label="providerForm.cli.defaultModel + (cliCatalog.catalog ? '（当前不可选）' : '（原配置）')" disabled />
                  <el-option v-for="item in cliModels" :key="item.model" :label="item.displayName" :value="item.model" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认推理强度">
                <el-select v-model="cliReasoningValue" filterable style="width: 100%"
                  :disabled="!selectedCliModel || cliCatalog.loading">
                  <el-option v-if="cliEffortMissing" :value="providerForm.cli.defaultReasoningLevel"
                    :label="providerForm.cli.defaultReasoningLevel + (cliCatalog.catalog ? '（当前不可选）' : '（原配置）')" disabled />
                  <el-option v-for="item in cliEfforts" :key="item.reasoningEffort"
                    :label="item.reasoningEffort" :value="item.reasoningEffort" :title="item.description" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认速度">
                <el-select v-model="providerForm.cli.defaultSpeedMode" :disabled="isZCode" filterable style="width: 100%">
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
      <div class="use-case-tabs-card">
        <el-tabs v-model="useCaseEditTab" class="use-case-tabs">
          <el-tab-pane label="基础信息" name="basic">
            <div class="form-grid two-grid">
              <el-form-item label="任务编码">
                <el-input v-model="useCaseForm.useCaseCode" disabled />
              </el-form-item>
              <el-form-item label="任务名称">
                <el-input v-model="useCaseForm.useCaseName" />
              </el-form-item>
            </div>
            <el-form-item label="执行能力">
              <el-input :model-value="useCaseCapabilityText(useCaseForm.capability)" disabled />
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
            <el-form-item label="备注">
              <el-input v-model="useCaseForm.remark" type="textarea" :rows="2" resize="none" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="调用参数" name="invocation">
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
                <el-select v-model="useCaseForm.uiProviderSelection" style="width: 100%" @change="handleUseCaseProviderParamChange('channel')">
                  <el-option v-for="item in useCaseChannelOptions" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" />
                </el-select>
              </el-form-item>
            </div>
            <div v-if="!selectedProvider" class="unmatched-provider">{{ unmatchedProviderMessage }}</div>
            <div class="section-subtitle">任务级覆盖（可选）</div>
            <el-form-item label="模型覆盖">
              <el-select v-model="useCaseForm.model" clearable filterable allow-create :placeholder="inheritModelPlaceholder"
                :loading="selectedProvider?.channelType === 'CLI' && useCaseCliCatalog.loading" style="width: 100%">
                <el-option v-for="item in useCaseModelOptions" :key="item.code" :label="item.label" :value="item.code" />
              </el-select>
            </el-form-item>
            <el-alert v-if="useCaseCliCatalog.error" :title="useCaseCliCatalog.error" type="warning" :closable="false" />
            <div class="form-grid three-grid">
              <el-form-item label="推理强度覆盖">
                <el-select v-if="selectedProvider?.channelType === 'CLI'" v-model="useCaseForm.reasoningLevel" clearable filterable
                  :allow-create="selectedProviderIsZCode" :placeholder="inheritReasoningPlaceholder"
                  :loading="useCaseCliCatalog.loading" style="width: 100%">
                  <el-option v-if="useCaseReasoningMissing" :value="useCaseForm.reasoningLevel"
                    :label="`${useCaseForm.reasoningLevel}${useCaseCliCatalog.catalog ? '（当前不可选）' : '（原配置）'}`" disabled />
                  <el-option v-for="item in useCaseReasoningOptions" :key="item.code" :label="item.label" :value="item.code" :title="item.title" />
                </el-select>
                <el-select v-else v-model="useCaseForm.reasoningLevel" clearable filterable :placeholder="inheritReasoningPlaceholder" style="width: 100%">
                  <el-option v-for="item in reasoningOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="速度覆盖">
                <el-select v-model="useCaseForm.speedMode" clearable filterable :placeholder="inheritSpeedPlaceholder" style="width: 100%">
                  <el-option v-for="item in useCaseSpeedOptions" :key="item.code" :label="item.label" :value="item.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="总调用超时覆盖">
                <el-input-number v-model="useCaseForm.timeoutSeconds" :min="1" :max="7200" :placeholder="inheritTimeoutPlaceholder" style="width: 100%" />
              </el-form-item>
            </div>
          </el-tab-pane>

          <el-tab-pane label="提示词" name="prompt">
            <el-form-item label="变量说明">
              <el-input v-model="useCaseForm.promptVariablesDesc" type="textarea" :rows="3" resize="none" />
            </el-form-item>
            <el-form-item label="提示词模板">
              <el-input v-model="useCaseForm.promptTemplate" type="textarea" :autosize="{ minRows: 16, maxRows: 24 }" class="prompt-input" />
            </el-form-item>
            <el-form-item label="提示词版本">
              <el-input :model-value="`v${useCaseForm.promptVersion || 1} ${shortChecksum(useCaseForm.promptChecksum)}`" disabled />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="输出约束" name="output">
            <div class="form-grid two-grid">
              <el-form-item label="结构化输出">
                <el-switch v-model="useCaseForm.jsonSchemaEnabled" active-text="Schema" inactive-text="普通文本" />
              </el-form-item>
              <el-form-item label="Schema路径">
                <el-input v-model="useCaseForm.schemaClasspath" placeholder="classpath 下的 JSON Schema 路径" />
              </el-form-item>
            </div>
            <div class="output-hint">结构化输出关闭时忽略 Schema 路径；提示词模板的输出要求请在"提示词"页签维护。</div>
          </el-tab-pane>
        </el-tabs>
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

.provider-toolbar {
  display: flex;
  justify-content: flex-start;
  padding-bottom: 12px;
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

.model-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.model-refresh {
  cursor: pointer;
  color: var(--el-color-primary);
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

.use-case-tabs-card {
  padding: 0 16px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.use-case-tabs-card :deep(.el-tabs__header) {
  margin-bottom: 16px;
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

.output-hint {
  margin-top: 2px;
  color: #8492a6;
  font-size: 12px;
}

.prompt-input :deep(.el-textarea__inner) {
  min-height: 360px !important;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .provider-basic-grid,
  .form-grid.two-grid,
  .form-grid.three-grid {
    grid-template-columns: 1fr;
  }
}
</style>
