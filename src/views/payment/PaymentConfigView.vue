<script setup lang="ts">
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createPaymentBinding,
  createPaymentChannel,
  createPaymentMerchant,
  createPaymentMerchantSecret,
  createPaymentMerchantSecretFromFile,
  fetchPaymentBindings,
  fetchPaymentChannelDetail,
  fetchPaymentChannels,
  fetchPaymentMerchantDetail,
  fetchPaymentMerchants,
  fetchPaymentPurposes,
  savePaymentMerchantCredential,
  savePaymentMerchantParam,
  updatePaymentBinding,
  updatePaymentChannel,
  updatePaymentMerchant,
  updatePaymentMerchantCredential,
  updatePaymentMerchantParam,
} from '@/api/payment'
import { fetchProjectGroups, fetchProjects } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import type {
  PaymentChannelDetail,
  PaymentChannelSaveRequest,
  PaymentChannelSummary,
  PaymentMerchantDetail,
  PaymentMerchantCredential,
  PaymentMerchantParam,
  PaymentMerchantSaveRequest,
  PaymentMerchantSummary,
  PaymentProjectBinding,
  PaymentPurposeOption,
} from '@/types/payment'
import type { ProjectGroup, ProjectSummary } from '@/types/work-item'

const authStore = useAuthStore()
const loadingChannels = ref(false)
const loadingMerchants = ref(false)
const detailLoading = ref(false)
const detailBindingsLoading = ref(false)
const submitting = ref(false)
const activeTab = ref('channels')

const channels = ref<PaymentChannelSummary[]>([])
const merchants = ref<PaymentMerchantSummary[]>([])
const channelOptions = ref<PaymentChannelSummary[]>([])
const merchantOptions = ref<PaymentMerchantSummary[]>([])
const projects = ref<ProjectSummary[]>([])
const businessLines = ref<ProjectGroup[]>([])
const purposes = ref<PaymentPurposeOption[]>([])

const channelPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const merchantPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const selectedMerchantId = ref<number | null>(null)
const selectedMerchantDetail = ref<PaymentMerchantDetail | null>(null)
const selectedMerchantBindings = ref<PaymentProjectBinding[]>([])
const bindingDialogLockedMerchantId = ref<number | null>(null)

const channelDialogVisible = ref(false)
const merchantDialogVisible = ref(false)
const merchantDetailDialogVisible = ref(false)
const bindingDialogVisible = ref(false)
const paramDialogVisible = ref(false)
const credentialDialogVisible = ref(false)
const secretDialogVisible = ref(false)
const secretUploadFiles = ref<UploadUserFile[]>([])

const editingChannelId = ref<number | null>(null)
const editingMerchantId = ref<number | null>(null)
const editingBindingId = ref<number | null>(null)
const editingParamId = ref<number | null>(null)
const editingCredentialId = ref<number | null>(null)

const channelFilters = reactive({
  channelId: undefined as number | undefined,
  status: '',
})

const merchantFilters = reactive({
  keyword: '',
  status: '',
  channelId: undefined as number | undefined,
  businessLine: '',
  projectId: undefined as number | undefined,
  purposeCode: '',
})

const channelForm = reactive<PaymentChannelSaveRequest>({
  code: '',
  name: '',
  vendorName: '',
  status: 'ACTIVE',
  description: '',
})

const merchantForm = reactive<PaymentMerchantSaveRequest>({
  channelId: 0,
  merchantCode: '',
  merchantName: '',
  environment: 'PROD',
  status: 'ACTIVE',
  appId: '',
  settlementSubject: '',
  purposeCodes: [],
  remark: '',
})

const bindingForm = reactive({
  projectId: null as number | null,
  projectGroup: '',
  merchantId: 0,
  purposeCodes: [] as string[],
  priority: 1,
  defaultBinding: true,
  status: 'ACTIVE',
  remark: '',
  relations: [] as Array<{
    merchantId: number
    relationRole: string
    relationName: string
    priority: number
    remark: string
  }>,
})

const paramForm = reactive({
  paramKey: '',
  paramValue: '',
  valueType: 'TEXT',
  sensitive: false,
  remark: '',
})

const secretForm = reactive({
  secretName: '',
  secretType: 'PRIVATE_KEY',
  inputMode: 'TEXT' as 'TEXT' | 'FILE',
  secretValue: '',
  fileValueType: 'TEXT' as 'TEXT' | 'BINARY',
  file: null as File | null,
  activateNow: true,
  validFrom: '',
  validTo: '',
  remark: '',
})

const credentialForm = reactive({
  credentialKey: '',
  credentialName: '',
  credentialType: 'PASSWORD',
  credentialValue: '',
  status: 'ACTIVE',
  remark: '',
})

const environmentOptions = ['PROD', 'UAT', 'SIT', 'TEST']
const statusOptions = ['ACTIVE', 'INACTIVE']
const valueTypeOptions = ['TEXT', 'JSON', 'URL', 'NUMBER', 'CERT', 'PEM']
const secretTypeOptions = ['API_KEY', 'API_SECRET', 'PRIVATE_KEY', 'PUBLIC_KEY', 'CERTIFICATE', 'CERT_PASSWORD', 'SIGN_SECRET', 'APP_SECRET']
const credentialTypeOptions = ['USERNAME', 'PASSWORD', 'TRADE_PASSWORD', 'AES_KEY', 'SIGN_KEY', 'PRIVATE_KEY_PASSWORD', 'CERT_PASSWORD', 'TOKEN', 'OTHER_SECRET']
const relationRoleOptions = [
  { code: 'MAIN', name: '主商户' },
  { code: 'SHARED_AGREEMENT', name: '共享协议商户' },
  { code: 'NORMAL_SPLIT', name: '正常分账商户' },
  { code: 'COMPENSATION_REPURCHASE', name: '代偿回购分账商户' },
  { code: 'SPLIT_RECEIVER', name: '被分账商户' },
  { code: 'REFUND_MAIN', name: '退款主户' },
  { code: 'SUB_MERCHANT', name: '子商户' },
]
const canCreateChannel = computed(() => authStore.hasAnyPermission(['payment:channel:create', 'payment:config:manage']))
const canUpdateChannel = computed(() => authStore.hasAnyPermission(['payment:channel:update', 'payment:config:manage']))
const canCreateMerchant = computed(() => authStore.hasAnyPermission(['payment:merchant:create', 'payment:config:manage']))
const canUpdateMerchant = computed(() => authStore.hasAnyPermission(['payment:merchant:update', 'payment:config:manage']))
const canManageParam = computed(() => authStore.hasAnyPermission(['payment:param:manage', 'payment:config:manage']))
const canManageCredential = computed(() => authStore.hasAnyPermission(['payment:credential:manage', 'payment:config:manage']))
const canManageBinding = computed(() => authStore.hasAnyPermission(['payment:binding:manage', 'payment:config:manage']))
const canCreateSecret = computed(() => authStore.hasAnyPermission(['payment:secret:create', 'payment:secret:manage']))

const selectedMerchantLabel = computed(() => {
  if (!selectedMerchantDetail.value) {
    return '未选择商户'
  }
  return `${selectedMerchantDetail.value.merchantCode} / ${selectedMerchantDetail.value.merchantName}`
})

function formatProjectOption(project: ProjectSummary) {
  return `${project.code} / ${project.name}`
}

function formatBusinessOption(business: { group: string; name: string; projectCount: number }) {
  return `${business.name} / ${business.projectCount} 个项目`
}

function formatBindingProjectName(binding: PaymentProjectBinding) {
  return binding.projectName || '业务线通用'
}

function formatBindingProjectCode(binding: PaymentProjectBinding) {
  return binding.projectCode || '未指定项目'
}

function formatMerchantOption(merchant: PaymentMerchantSummary) {
  return `${merchant.merchantCode} / ${merchant.merchantName}`
}

function formatPurposeOption(purpose: PaymentPurposeOption) {
  return `${purpose.name} / ${purpose.code}`
}

function formatPurposeNames(purposeCodes: string[] | null | undefined, purposeCode: string | null | undefined) {
  const codes = purposeCodes?.length ? purposeCodes : purposeCode ? [purposeCode] : []
  if (!codes.length) {
    return '-'
  }
  return codes
    .map((code) => purposes.value.find((purpose) => purpose.code === code)?.name || code)
    .join(' / ')
}

function formatRelationRole(role: string) {
  return relationRoleOptions.find((item) => item.code === role)?.name || role
}

function formatRelationNames(relations: PaymentProjectBinding['relations']) {
  if (!relations?.length) {
    return '-'
  }
  return relations
    .map((relation) => `${formatRelationRole(relation.relationRole)}：${relation.merchantName || relation.merchantCode}`)
    .join('；')
}

function errorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    response?: {
      status?: number
      data?: { message?: string }
      config?: { url?: string }
    }
    message?: string
  }
  return maybeError.response?.data?.message || maybeError.message || fallback
}

function logRequestError(context: string, error: unknown) {
  const maybeError = error as {
    response?: {
      status?: number
      data?: unknown
      config?: { url?: string }
    }
    message?: string
  }
  console.error(context, {
    message: maybeError.response?.data && typeof maybeError.response.data === 'object' && 'message' in maybeError.response.data
      ? (maybeError.response.data as { message?: string }).message
      : maybeError.message,
    status: maybeError.response?.status,
    url: maybeError.response?.config?.url,
    data: maybeError.response?.data,
  }, error)
}

function formatStatus(status: string | null | undefined) {
  if (status === 'ACTIVE') {
    return '启用'
  }
  if (status === 'INACTIVE') {
    return '停用'
  }
  return status || '-'
}

const bindingBusinessOptions = computed(() => {
  const projectCountByBusiness = new Map<string, { projectId: number; projectCount: number }>()
  for (const project of projects.value) {
    if (!project.businessLineCode) {
      continue
    }
    const existing = projectCountByBusiness.get(project.businessLineCode)
    if (existing) {
      existing.projectCount += 1
      continue
    }
    projectCountByBusiness.set(project.businessLineCode, { projectId: project.id, projectCount: 1 })
  }
  return businessLines.value.map((businessLine) => {
    const stats = projectCountByBusiness.get(businessLine.businessLineCode)
    return {
      group: businessLine.businessLineCode,
      name: businessLine.groupName,
      projectId: stats?.projectId || 0,
      projectCount: stats?.projectCount || 0,
    }
  })
})

const bindingFormProjects = computed(() => {
  if (!bindingForm.projectGroup) {
    return projects.value
  }
  return projects.value.filter((project) => project.businessLineCode === bindingForm.projectGroup)
})

const merchantFilterProjects = computed(() => {
  if (!merchantFilters.businessLine) {
    return projects.value
  }
  return projects.value.filter((project) => project.businessLineCode === merchantFilters.businessLine)
})

const selectedBindingMerchant = computed(() => {
  return merchantOptions.value.find((merchant) => merchant.id === bindingForm.merchantId) || null
})

const selectedBindingMerchantPurposeCodes = computed(() => {
  if (selectedMerchantDetail.value?.id === bindingForm.merchantId) {
    return selectedMerchantDetail.value.purposeCodes || []
  }
  return selectedBindingMerchant.value?.purposeCodes || []
})

const bindingPurposeOptions = computed(() => {
  const supportedCodes = new Set(selectedBindingMerchantPurposeCodes.value)
  if (!supportedCodes.size) {
    return []
  }
  return purposes.value.filter((purpose) => supportedCodes.has(purpose.code))
})

async function loadBaseOptions() {
  const [projectItems, businessLineItems, purposeItems, channelItems, merchantItems] = await Promise.all([
    fetchProjects(),
    fetchProjectGroups(),
    fetchPaymentPurposes(),
    fetchPaymentChannels({ status: 'ACTIVE', page: 1, pageSize: 1000 }),
    fetchPaymentMerchants({ status: 'ACTIVE', page: 1, pageSize: 1000 }),
  ])
  projects.value = projectItems
  businessLines.value = businessLineItems
  purposes.value = purposeItems
  channelOptions.value = channelItems.items
  merchantOptions.value = merchantItems.items
}

async function loadChannels() {
  loadingChannels.value = true
  try {
    const response = await fetchPaymentChannels({
      channelId: channelFilters.channelId,
      status: channelFilters.status || undefined,
      page: channelPagination.page,
      pageSize: channelPagination.pageSize,
    })
    channels.value = response.items
    channelPagination.total = response.total
  } catch (error) {
    ElMessage.error('加载支付渠道失败')
    console.error(error)
  } finally {
    loadingChannels.value = false
  }
}

async function loadMerchants() {
  loadingMerchants.value = true
  try {
    const response = await fetchPaymentMerchants({
      keyword: merchantFilters.keyword || undefined,
      status: merchantFilters.status || undefined,
      channelId: merchantFilters.channelId,
      businessLine: merchantFilters.businessLine || undefined,
      projectId: merchantFilters.projectId,
      purposeCode: merchantFilters.purposeCode || undefined,
      page: merchantPagination.page,
      pageSize: merchantPagination.pageSize,
    })
    merchants.value = response.items
    merchantPagination.total = response.total
  } catch (error) {
    ElMessage.error('加载支付商户失败')
    console.error(error)
  } finally {
    loadingMerchants.value = false
  }
}

function searchChannels() {
  channelPagination.page = 1
  void loadChannels()
}

function searchMerchants() {
  merchantPagination.page = 1
  void loadMerchants()
}

function handleMerchantBusinessLineChange() {
  if (!merchantFilters.businessLine || !merchantFilters.projectId) {
    return
  }
  const selectedProject = projects.value.find((project) => project.id === merchantFilters.projectId)
  if (selectedProject?.businessLineCode !== merchantFilters.businessLine) {
    merchantFilters.projectId = undefined
  }
}

function handleChannelPageChange(page: number) {
  channelPagination.page = page
  void loadChannels()
}

function handleChannelPageSizeChange(pageSize: number) {
  channelPagination.pageSize = pageSize
  channelPagination.page = 1
  void loadChannels()
}

function handleMerchantPageChange(page: number) {
  merchantPagination.page = page
  void loadMerchants()
}

function handleMerchantPageSizeChange(pageSize: number) {
  merchantPagination.pageSize = pageSize
  merchantPagination.page = 1
  void loadMerchants()
}

async function loadMerchantDetail(id: number) {
  detailLoading.value = true
  detailBindingsLoading.value = true
  selectedMerchantId.value = id
  try {
    const [detail, bindingPage] = await Promise.all([
      fetchPaymentMerchantDetail(id),
      fetchPaymentBindings({ merchantId: id, page: 1, pageSize: 1000 }),
    ])
    selectedMerchantDetail.value = detail
    selectedMerchantBindings.value = bindingPage.items
  } catch (error) {
    ElMessage.error('加载商户详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
    detailBindingsLoading.value = false
  }
}

async function loadSelectedMerchantBindings() {
  if (!selectedMerchantId.value) {
    selectedMerchantBindings.value = []
    return
  }
  detailBindingsLoading.value = true
  try {
    const response = await fetchPaymentBindings({
      merchantId: selectedMerchantId.value,
      page: 1,
      pageSize: 1000,
    })
    selectedMerchantBindings.value = response.items
  } catch (error) {
    ElMessage.error('加载商户项目用途绑定失败')
    console.error(error)
  } finally {
    detailBindingsLoading.value = false
  }
}

async function openMerchantDetailDialog(id: number) {
  merchantDetailDialogVisible.value = true
  await loadMerchantDetail(id)
}

function resetChannelForm() {
  editingChannelId.value = null
  channelForm.code = ''
  channelForm.name = ''
  channelForm.vendorName = ''
  channelForm.status = 'ACTIVE'
  channelForm.description = ''
}

async function openChannelDialog(id?: number) {
  resetChannelForm()
  if (id) {
    const detail = await fetchPaymentChannelDetail(id)
    editingChannelId.value = id
    channelForm.code = detail.code
    channelForm.name = detail.name
    channelForm.vendorName = detail.vendorName
    channelForm.status = detail.status
    channelForm.description = detail.description || ''
  }
  channelDialogVisible.value = true
}

async function submitChannel() {
  submitting.value = true
  try {
    if (editingChannelId.value) {
      await updatePaymentChannel(editingChannelId.value, channelForm)
      ElMessage.success('支付渠道已更新')
    } else {
      await createPaymentChannel(channelForm)
      ElMessage.success('支付渠道已新增')
    }
    channelDialogVisible.value = false
    await Promise.all([loadBaseOptions(), loadChannels(), loadMerchants()])
  } catch (error) {
    ElMessage.error('保存支付渠道失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function resetMerchantForm() {
  editingMerchantId.value = null
  merchantForm.channelId = channelOptions.value[0]?.id || 0
  merchantForm.merchantCode = ''
  merchantForm.merchantName = ''
  merchantForm.environment = 'PROD'
  merchantForm.status = 'ACTIVE'
  merchantForm.appId = ''
  merchantForm.settlementSubject = ''
  merchantForm.purposeCodes = []
  merchantForm.remark = ''
}

async function openMerchantDialog(id?: number) {
  resetMerchantForm()
  if (id) {
    const [detail, bindingPage] = await Promise.all([
      fetchPaymentMerchantDetail(id),
      fetchPaymentBindings({ merchantId: id, page: 1, pageSize: 1000 }),
    ])
    editingMerchantId.value = id
    selectedMerchantId.value = id
    selectedMerchantDetail.value = detail
    selectedMerchantBindings.value = bindingPage.items
    merchantForm.channelId = detail.channelId
    merchantForm.merchantCode = detail.merchantCode
    merchantForm.merchantName = detail.merchantName
    merchantForm.environment = detail.environment
    merchantForm.status = detail.status
    merchantForm.appId = detail.appId || ''
    merchantForm.settlementSubject = detail.settlementSubject || ''
    merchantForm.purposeCodes = [...(detail.purposeCodes || [])]
    merchantForm.remark = detail.remark || ''
  }
  merchantDialogVisible.value = true
}

async function submitMerchant() {
  submitting.value = true
  try {
    if (editingMerchantId.value) {
      await updatePaymentMerchant(editingMerchantId.value, merchantForm)
      ElMessage.success('支付商户已更新')
    } else {
      await createPaymentMerchant(merchantForm)
      ElMessage.success('支付商户已新增')
    }
    merchantDialogVisible.value = false
    await Promise.all([loadBaseOptions(), loadMerchants(), loadSelectedMerchantBindings()])
  } catch (error) {
    ElMessage.error('保存支付商户失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function resetBindingForm(lockedMerchantId?: number) {
  editingBindingId.value = null
  bindingDialogLockedMerchantId.value = lockedMerchantId || null
  const firstBusiness = bindingBusinessOptions.value[0]
  const firstMerchant = lockedMerchantId
    ? merchantOptions.value.find((merchant) => merchant.id === lockedMerchantId)
    : merchantOptions.value.find((merchant) => merchant.purposeCodes?.length) || merchantOptions.value[0]
  bindingForm.projectId = null
  bindingForm.projectGroup = firstBusiness?.group || ''
  bindingForm.merchantId = lockedMerchantId || firstMerchant?.id || 0
  const purposeCodes = lockedMerchantId && selectedMerchantDetail.value?.id === lockedMerchantId
    ? selectedMerchantDetail.value.purposeCodes || []
    : firstMerchant?.purposeCodes || []
  bindingForm.purposeCodes = purposeCodes[0] ? [purposeCodes[0]] : []
  bindingForm.priority = 1
  bindingForm.defaultBinding = true
  bindingForm.status = 'ACTIVE'
  bindingForm.remark = ''
  bindingForm.relations = []
}

function openBindingDialog(binding?: PaymentProjectBinding, lockedMerchantId?: number) {
  resetBindingForm(lockedMerchantId)
  if (binding) {
    editingBindingId.value = binding.id
    bindingForm.projectId = binding.projectId
    bindingForm.projectGroup = binding.businessLineCode || projects.value.find((project) => project.id === binding.projectId)?.businessLineCode || ''
    bindingForm.merchantId = lockedMerchantId || binding.merchantId
    bindingForm.purposeCodes = binding.purposeCodes?.length ? [...binding.purposeCodes] : [binding.purposeCode]
    bindingForm.priority = binding.priority
    bindingForm.defaultBinding = binding.defaultBinding
    bindingForm.status = binding.status
    bindingForm.remark = binding.remark || ''
    bindingForm.relations = (binding.relations || []).map((relation) => ({
      merchantId: relation.merchantId,
      relationRole: relation.relationRole,
      relationName: relation.relationName || '',
      priority: relation.priority || 1,
      remark: relation.remark || '',
    }))
    normalizeBindingPurposeCodesForMerchant()
  }
  bindingDialogVisible.value = true
}

function openBindingDialogForSelectedMerchant(binding?: PaymentProjectBinding) {
  if (!selectedMerchantId.value) {
    ElMessage.warning('请先选择商户')
    return
  }
  openBindingDialog(binding, selectedMerchantId.value)
}

function handleBindingBusinessChange(group: string) {
  bindingForm.projectId = null
}

function normalizeBindingPurposeCodesForMerchant() {
  const supportedCodes = selectedBindingMerchantPurposeCodes.value
  bindingForm.purposeCodes = bindingForm.purposeCodes.filter((code) => supportedCodes.includes(code))
  if (!bindingForm.purposeCodes.length && supportedCodes.length) {
    bindingForm.purposeCodes = [supportedCodes[0]]
  }
}

function handleBindingMerchantChange() {
  normalizeBindingPurposeCodesForMerchant()
}

async function submitBinding() {
  if (!bindingForm.projectGroup) {
    ElMessage.warning('请选择业务')
    return
  }
  const merchantId = bindingDialogLockedMerchantId.value || bindingForm.merchantId
  if (!merchantId) {
    ElMessage.warning('请选择商户')
    return
  }
  if (!selectedBindingMerchantPurposeCodes.value.length) {
    ElMessage.warning('当前商户未维护支持用途')
    return
  }
  normalizeBindingPurposeCodesForMerchant()
  if (!bindingForm.purposeCodes.length) {
    ElMessage.warning('请至少选择一个用途')
    return
  }
  submitting.value = true
  try {
    const payload = {
      projectId: bindingForm.projectId,
      businessLine: bindingForm.projectGroup,
      merchantId,
      purposeCode: bindingForm.purposeCodes[0],
      purposeCodes: [...bindingForm.purposeCodes],
      priority: bindingForm.priority,
      defaultBinding: bindingForm.defaultBinding,
      status: bindingForm.status,
      remark: bindingForm.remark,
      relations: bindingForm.relations
        .filter((relation) => relation.merchantId && relation.relationRole)
        .map((relation) => ({
          merchantId: relation.merchantId,
          relationRole: relation.relationRole,
          relationName: relation.relationName || undefined,
          priority: relation.priority,
          remark: relation.remark || undefined,
        })),
    }
    if (editingBindingId.value) {
      await updatePaymentBinding(editingBindingId.value, payload)
      ElMessage.success('业务支付绑定已更新')
    } else {
      await createPaymentBinding(payload)
      ElMessage.success('业务支付绑定已新增')
    }
    bindingDialogVisible.value = false
    await Promise.all([loadSelectedMerchantBindings(), loadMerchants()])
  } catch (error) {
    ElMessage.error('保存业务支付绑定失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function addBindingRelation() {
  bindingForm.relations.push({
    merchantId: merchantOptions.value[0]?.id || 0,
    relationRole: 'SHARED_AGREEMENT',
    relationName: '',
    priority: bindingForm.relations.length + 1,
    remark: '',
  })
}

function removeBindingRelation(index: number) {
  bindingForm.relations.splice(index, 1)
}

function openParamDialog(param?: PaymentMerchantParam) {
  if (!selectedMerchantId.value) {
    ElMessage.warning('请先选择商户')
    return
  }
  editingParamId.value = param?.id || null
  paramForm.paramKey = param?.paramKey || ''
  paramForm.paramValue = ''
  paramForm.valueType = param?.valueType || 'TEXT'
  paramForm.sensitive = param?.sensitive || false
  paramForm.remark = param?.remark || ''
  paramDialogVisible.value = true
}

async function submitParam() {
  if (!selectedMerchantId.value) {
    return
  }
  submitting.value = true
  try {
    if (editingParamId.value) {
      await updatePaymentMerchantParam(selectedMerchantId.value, editingParamId.value, paramForm)
      ElMessage.success('商户参数已更新')
    } else {
      await savePaymentMerchantParam(selectedMerchantId.value, paramForm)
      ElMessage.success('商户参数已新增')
    }
    paramDialogVisible.value = false
    await loadMerchantDetail(selectedMerchantId.value)
  } catch (error) {
    ElMessage.error('保存商户参数失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function openCredentialDialog(credential?: PaymentMerchantCredential) {
  if (!selectedMerchantId.value) {
    ElMessage.warning('请先选择商户')
    return
  }
  editingCredentialId.value = credential?.id || null
  credentialForm.credentialKey = credential?.credentialKey || ''
  credentialForm.credentialName = credential?.credentialName || ''
  credentialForm.credentialType = credential?.credentialType || 'PASSWORD'
  credentialForm.credentialValue = ''
  credentialForm.status = credential?.status || 'ACTIVE'
  credentialForm.remark = credential?.remark || ''
  credentialDialogVisible.value = true
}

async function submitCredential() {
  if (!selectedMerchantId.value) {
    return
  }
  submitting.value = true
  try {
    if (editingCredentialId.value) {
      await updatePaymentMerchantCredential(selectedMerchantId.value, editingCredentialId.value, {
        credentialKey: credentialForm.credentialKey,
        credentialName: credentialForm.credentialName,
        credentialType: credentialForm.credentialType,
        credentialValue: credentialForm.credentialValue,
        status: credentialForm.status,
        remark: credentialForm.remark,
      })
      ElMessage.success('敏感凭据已更新')
    } else {
      await savePaymentMerchantCredential(selectedMerchantId.value, {
        credentialKey: credentialForm.credentialKey,
        credentialName: credentialForm.credentialName,
        credentialType: credentialForm.credentialType,
        credentialValue: credentialForm.credentialValue,
        status: credentialForm.status,
        remark: credentialForm.remark,
      })
      ElMessage.success('敏感凭据已新增')
    }
    credentialDialogVisible.value = false
    await loadMerchantDetail(selectedMerchantId.value)
  } catch (error) {
    ElMessage.error('保存敏感凭据失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function openSecretDialog() {
  if (!selectedMerchantId.value) {
    ElMessage.warning('请先选择商户')
    return
  }
  secretForm.secretName = ''
  secretForm.secretType = 'PRIVATE_KEY'
  secretForm.inputMode = 'TEXT'
  secretForm.secretValue = ''
  secretForm.fileValueType = 'TEXT'
  secretForm.file = null
  secretUploadFiles.value = []
  secretForm.activateNow = true
  secretForm.validFrom = ''
  secretForm.validTo = ''
  secretForm.remark = ''
  secretDialogVisible.value = true
}

function handleSecretFileChange(file: UploadFile) {
  secretForm.file = file.raw || null
  secretUploadFiles.value = [file]
}

function handleSecretFileRemove() {
  secretForm.file = null
  secretUploadFiles.value = []
}

async function submitSecret() {
  if (!selectedMerchantId.value) {
    return
  }
  if (secretForm.inputMode === 'TEXT' && !secretForm.secretValue.trim()) {
    ElMessage.warning('请输入秘钥明文')
    return
  }
  if (secretForm.inputMode === 'FILE' && !secretForm.file) {
    ElMessage.warning('请先选择秘钥文件')
    return
  }
  submitting.value = true
  try {
    if (secretForm.inputMode === 'FILE' && secretForm.file) {
      await createPaymentMerchantSecretFromFile(selectedMerchantId.value, {
        secretName: secretForm.secretName,
        secretType: secretForm.secretType,
        fileValueType: secretForm.fileValueType,
        file: secretForm.file,
        activateNow: secretForm.activateNow,
        validFrom: secretForm.validFrom || undefined,
        validTo: secretForm.validTo || undefined,
        remark: secretForm.remark,
      })
    } else {
      await createPaymentMerchantSecret(selectedMerchantId.value, {
        secretName: secretForm.secretName,
        secretType: secretForm.secretType,
        secretValue: secretForm.secretValue,
        activateNow: secretForm.activateNow,
        validFrom: secretForm.validFrom || undefined,
        validTo: secretForm.validTo || undefined,
        remark: secretForm.remark,
      })
    }
    secretDialogVisible.value = false
    ElMessage.success('商户秘钥版本已新增')
    await loadMerchantDetail(selectedMerchantId.value)
  } catch (error) {
    ElMessage.error(errorMessage(error, '保存商户秘钥失败'))
    logRequestError('保存商户秘钥失败', error)
  } finally {
    submitting.value = false
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ')
}

async function loadPage() {
  try {
    await loadBaseOptions()
    await Promise.all([loadChannels(), loadMerchants()])
  } catch (error) {
    ElMessage.error('初始化支付配置页面失败')
    console.error(error)
  }
}

onMounted(loadPage)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">支付配置管理</h1>
        <p class="page-desc">统一管理支付渠道、商户账号、生产参数、秘钥版本以及项目用途绑定。</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="支付渠道" name="channels">
        <el-form inline @submit.prevent="searchChannels">
          <el-form-item label="渠道">
            <el-select v-model="channelFilters.channelId" placeholder="渠道" clearable filterable style="width: 220px">
              <el-option v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="channelFilters.status" placeholder="状态" clearable style="width: 140px">
              <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchChannels">查询</el-button>
            <el-button v-if="canCreateChannel" type="primary" plain @click="openChannelDialog()">新增渠道</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loadingChannels" :data="channels">
          <el-table-column prop="code" label="渠道编码" width="160" />
          <el-table-column prop="name" label="渠道名称" min-width="180" />
          <el-table-column prop="vendorName" label="厂商" width="160" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              {{ formatStatus(row.status) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button v-if="canUpdateChannel" link type="primary" @click="openChannelDialog(row.id)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="channelPagination.page"
            v-model:page-size="channelPagination.pageSize"
            :total="channelPagination.total"
            :page-sizes="[10, 20, 50, 100]"
            background
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handleChannelPageChange"
            @size-change="handleChannelPageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="商户账号与密钥" name="merchants">
        <div class="sub-card">
          <el-form inline @submit.prevent="searchMerchants">
            <el-form-item label="商户">
              <el-input
                v-model="merchantFilters.keyword"
                clearable
                placeholder="商户号 / 商户名"
                style="width: 220px"
              />
            </el-form-item>
            <el-form-item label="渠道">
              <el-select v-model="merchantFilters.channelId" placeholder="渠道" clearable style="width: 160px">
                <el-option v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="业务线">
              <el-select
                v-model="merchantFilters.businessLine"
                placeholder="业务线"
                clearable
                filterable
                style="width: 180px"
                @change="handleMerchantBusinessLineChange"
              >
                <el-option
                  v-for="businessLine in businessLines"
                  :key="businessLine.businessLineCode"
                  :label="businessLine.groupName"
                  :value="businessLine.businessLineCode"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="项目">
              <el-select v-model="merchantFilters.projectId" placeholder="项目" clearable filterable style="width: 260px">
                <el-option v-for="project in merchantFilterProjects" :key="project.id" :label="formatProjectOption(project)" :value="project.id">
                  <div class="project-option">
                    <span class="project-option-code">{{ project.code }}</span>
                    <span class="project-option-name">{{ project.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="用途">
              <el-select v-model="merchantFilters.purposeCode" placeholder="用途" clearable filterable style="width: 220px">
                <el-option v-for="purpose in purposes" :key="purpose.code" :label="formatPurposeOption(purpose)" :value="purpose.code">
                  <div class="purpose-option">
                    <span class="purpose-option-name">{{ purpose.name }}</span>
                    <span class="purpose-option-code">{{ purpose.code }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="merchantFilters.status" placeholder="状态" clearable style="width: 120px">
                <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchMerchants">查询</el-button>
              <el-button v-if="canCreateMerchant" type="primary" plain @click="openMerchantDialog()">新增商户</el-button>
            </el-form-item>
          </el-form>

          <el-table v-loading="loadingMerchants" :data="merchants" height="520">
            <el-table-column prop="merchantCode" label="商户号" width="160" />
            <el-table-column prop="merchantName" label="商户名称" min-width="180" />
            <el-table-column prop="channelName" label="渠道" width="140" />
            <el-table-column label="支持用途" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatPurposeNames(row.purposeCodes, null) }}
              </template>
            </el-table-column>
            <el-table-column prop="environment" label="环境" width="100" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                {{ formatStatus(row.status) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button link type="primary" @click="openMerchantDetailDialog(row.id)">详情</el-button>
                <el-button v-if="canUpdateMerchant" link type="primary" @click="openMerchantDialog(row.id)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-bar">
            <el-pagination
              v-model:current-page="merchantPagination.page"
              v-model:page-size="merchantPagination.pageSize"
              :total="merchantPagination.total"
              :page-sizes="[10, 20, 50, 100]"
              background
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="handleMerchantPageChange"
              @size-change="handleMerchantPageSizeChange"
            />
          </div>
        </div>
      </el-tab-pane>

    </el-tabs>
  </div>

  <el-dialog v-model="channelDialogVisible" :title="editingChannelId ? '编辑支付渠道' : '新增支付渠道'" width="560px">
    <el-form label-width="100px">
      <el-form-item label="渠道编码"><el-input v-model="channelForm.code" /></el-form-item>
      <el-form-item label="渠道名称"><el-input v-model="channelForm.name" /></el-form-item>
      <el-form-item label="厂商"><el-input v-model="channelForm.vendorName" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="channelForm.status" style="width: 100%">
          <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述"><el-input v-model="channelForm.description" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="channelDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitChannel">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="merchantDetailDialogVisible" title="商户详情" width="980px">
    <div class="detail-header">
      <div>
        <div class="detail-title">{{ selectedMerchantLabel }}</div>
      </div>
      <div class="detail-actions">
        <el-button v-if="canManageParam" size="small" type="primary" plain @click="openParamDialog()">新增参数</el-button>
        <el-button v-if="canManageCredential" size="small" type="primary" plain @click="openCredentialDialog()">新增凭据</el-button>
        <el-button v-if="canCreateSecret" size="small" type="primary" plain @click="openSecretDialog()">新增秘钥</el-button>
      </div>
    </div>

    <el-skeleton :loading="detailLoading" animated>
      <template #default>
        <template v-if="selectedMerchantDetail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="渠道">{{ selectedMerchantDetail.channelName }}</el-descriptions-item>
            <el-descriptions-item label="环境">{{ selectedMerchantDetail.environment }}</el-descriptions-item>
            <el-descriptions-item label="商户号">{{ selectedMerchantDetail.merchantCode }}</el-descriptions-item>
            <el-descriptions-item label="商户名称">{{ selectedMerchantDetail.merchantName }}</el-descriptions-item>
            <el-descriptions-item label="AppId">{{ selectedMerchantDetail.appId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="结算主体">{{ selectedMerchantDetail.settlementSubject || '-' }}</el-descriptions-item>
            <el-descriptions-item label="支持用途" :span="2">{{ formatPurposeNames(selectedMerchantDetail.purposeCodes, null) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ selectedMerchantDetail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div class="section-title">项目用途绑定</div>
          <el-table v-loading="detailBindingsLoading" :data="selectedMerchantBindings" size="small" empty-text="当前商户暂无项目用途绑定">
            <el-table-column label="业务" width="130" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.projectGroup || row.businessLineName || row.businessLine || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="项目" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="binding-project-cell">
                  <span class="binding-project-name">{{ formatBindingProjectName(row) }}</span>
                  <span class="binding-project-code">{{ formatBindingProjectCode(row) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="用途" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatPurposeNames(row.purposeCodes, row.purposeCode) }}
              </template>
            </el-table-column>
            <el-table-column label="默认" width="70">
              <template #default="{ row }">
                {{ row.defaultBinding ? '是' : '否' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                {{ formatStatus(row.status) }}
              </template>
            </el-table-column>
            <el-table-column label="关联商户" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatRelationNames(row.relations) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button v-if="canManageBinding" link type="primary" @click="openBindingDialogForSelectedMerchant(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="section-title">生产参数</div>
          <el-table :data="selectedMerchantDetail.parameters" size="small">
            <el-table-column prop="paramKey" label="参数名" min-width="120" />
            <el-table-column prop="valueType" label="类型" width="90" />
            <el-table-column prop="displayValue" label="显示值" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button v-if="canManageParam" link type="primary" @click="openParamDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="section-title">敏感凭据</div>
          <el-table :data="selectedMerchantDetail.credentials" size="small">
            <el-table-column prop="credentialName" label="名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="credentialType" label="类型" width="130" />
            <el-table-column prop="maskedValue" label="脱敏值" min-width="160" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                {{ formatStatus(row.status) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button v-if="canManageCredential" link type="primary" @click="openCredentialDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="section-title">秘钥版本</div>
          <el-table :data="selectedMerchantDetail.secrets" size="small">
            <el-table-column prop="secretName" label="名称" min-width="120" />
            <el-table-column prop="secretType" label="类型" width="110" />
            <el-table-column prop="versionNo" label="版本" width="70" />
            <el-table-column prop="maskedValue" label="脱敏值" min-width="160" show-overflow-tooltip />
          </el-table>
        </template>
        <el-empty v-else description="请选择商户查看详情" />
      </template>
    </el-skeleton>
  </el-dialog>

  <el-dialog v-model="merchantDialogVisible" :title="editingMerchantId ? '编辑支付商户' : '新增支付商户'" width="640px">
    <el-form label-width="110px">
      <el-form-item label="所属渠道">
        <el-select v-model="merchantForm.channelId" style="width: 100%">
          <el-option v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="商户号"><el-input v-model="merchantForm.merchantCode" /></el-form-item>
      <el-form-item label="商户名称"><el-input v-model="merchantForm.merchantName" /></el-form-item>
      <el-form-item label="环境">
        <el-select v-model="merchantForm.environment" style="width: 100%">
          <el-option v-for="environment in environmentOptions" :key="environment" :label="environment" :value="environment" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="merchantForm.status" style="width: 100%">
          <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="AppId"><el-input v-model="merchantForm.appId" /></el-form-item>
      <el-form-item label="结算主体"><el-input v-model="merchantForm.settlementSubject" /></el-form-item>
      <el-form-item label="支持用途">
        <el-select v-model="merchantForm.purposeCodes" multiple filterable style="width: 100%">
          <el-option v-for="purpose in purposes" :key="purpose.code" :label="formatPurposeOption(purpose)" :value="purpose.code">
            <div class="purpose-option">
              <span class="purpose-option-name">{{ purpose.name }}</span>
              <span class="purpose-option-code">{{ purpose.code }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="备注"><el-input v-model="merchantForm.remark" type="textarea" :rows="3" /></el-form-item>
      <template v-if="editingMerchantId">
        <div class="form-section-header">
          <span>项目用途绑定</span>
          <el-button v-if="canManageBinding" size="small" type="primary" plain @click="openBindingDialogForSelectedMerchant()">新增绑定</el-button>
        </div>
        <el-table
          v-loading="detailBindingsLoading"
          :data="selectedMerchantBindings"
          size="small"
          empty-text="当前商户暂无项目用途绑定"
        >
          <el-table-column label="业务" width="130" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.projectGroup || row.businessLineName || row.businessLine || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="项目" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="binding-project-cell">
                <span class="binding-project-name">{{ formatBindingProjectName(row) }}</span>
                <span class="binding-project-code">{{ formatBindingProjectCode(row) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="用途" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatPurposeNames(row.purposeCodes, row.purposeCode) }}
            </template>
          </el-table-column>
          <el-table-column label="默认" width="70">
            <template #default="{ row }">
              {{ row.defaultBinding ? '是' : '否' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              {{ formatStatus(row.status) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button v-if="canManageBinding" link type="primary" @click="openBindingDialogForSelectedMerchant(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="merchantDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitMerchant">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="bindingDialogVisible" :title="editingBindingId ? '编辑业务支付绑定' : '新增业务支付绑定'" width="920px">
    <el-form label-width="110px">
      <el-form-item label="业务">
        <el-select v-model="bindingForm.projectGroup" filterable style="width: 100%" @change="handleBindingBusinessChange">
          <el-option
            v-for="business in bindingBusinessOptions"
            :key="business.group"
            :label="formatBusinessOption(business)"
            :value="business.group"
          >
            <div class="business-option">
              <span class="business-option-name">{{ business.name }}</span>
              <span class="business-option-meta">{{ business.projectCount }} 个项目</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="项目">
        <el-select v-model="bindingForm.projectId" clearable filterable placeholder="不选表示业务线通用绑定" style="width: 100%">
          <el-option
            v-for="project in bindingFormProjects"
            :key="project.id"
            :label="formatProjectOption(project)"
            :value="project.id"
          >
            <div class="project-option">
              <span class="project-option-code">{{ project.code }}</span>
              <span class="project-option-name">{{ project.name }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="商户">
        <el-select
          v-model="bindingForm.merchantId"
          filterable
          style="width: 100%"
          :disabled="Boolean(bindingDialogLockedMerchantId)"
          @change="handleBindingMerchantChange"
        >
          <el-option
            v-for="merchant in merchantOptions"
            :key="merchant.id"
            :label="formatMerchantOption(merchant)"
            :value="merchant.id"
          >
            <div class="merchant-option">
              <span class="merchant-option-code">{{ merchant.merchantCode }}</span>
              <span class="merchant-option-name">{{ merchant.merchantName }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="用途">
        <el-select
          v-model="bindingForm.purposeCodes"
          multiple
          filterable
          :placeholder="selectedBindingMerchantPurposeCodes.length ? '选择商户支持的用途' : '当前商户未维护支持用途'"
          style="width: 100%"
        >
          <el-option v-for="purpose in bindingPurposeOptions" :key="purpose.code" :label="formatPurposeOption(purpose)" :value="purpose.code">
            <div class="purpose-option">
              <span class="purpose-option-name">{{ purpose.name }}</span>
              <span class="purpose-option-code">{{ purpose.code }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="优先级"><el-input-number v-model="bindingForm.priority" :min="1" /></el-form-item>
      <el-form-item label="默认绑定"><el-switch v-model="bindingForm.defaultBinding" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="bindingForm.status" style="width: 100%">
          <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="关联商户">
        <div class="relation-editor">
          <div v-for="(relation, index) in bindingForm.relations" :key="index" class="relation-row">
            <el-select v-model="relation.merchantId" filterable placeholder="商户">
              <el-option
                v-for="merchant in merchantOptions"
                :key="merchant.id"
                :label="formatMerchantOption(merchant)"
                :value="merchant.id"
              >
                <div class="merchant-option">
                  <span class="merchant-option-code">{{ merchant.merchantCode }}</span>
                  <span class="merchant-option-name">{{ merchant.merchantName }}</span>
                </div>
              </el-option>
            </el-select>
            <el-select v-model="relation.relationRole" placeholder="角色">
              <el-option v-for="role in relationRoleOptions" :key="role.code" :label="role.name" :value="role.code" />
            </el-select>
            <el-input v-model="relation.relationName" placeholder="关系名称" />
            <el-input-number v-model="relation.priority" :min="1" controls-position="right" />
            <el-input v-model="relation.remark" placeholder="备注" />
            <el-button v-if="canManageBinding" link type="danger" @click="removeBindingRelation(index)">删除</el-button>
          </div>
          <el-button v-if="canManageBinding" size="small" type="primary" plain @click="addBindingRelation">新增关联商户</el-button>
        </div>
      </el-form-item>
      <el-form-item label="备注"><el-input v-model="bindingForm.remark" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="bindingDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitBinding">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="paramDialogVisible" :title="editingParamId ? '编辑商户参数' : '新增商户参数'" width="560px">
    <el-form label-width="100px">
      <el-form-item label="参数名"><el-input v-model="paramForm.paramKey" :disabled="Boolean(editingParamId)" /></el-form-item>
      <el-form-item label="参数值"><el-input v-model="paramForm.paramValue" type="textarea" :rows="4" /></el-form-item>
      <el-form-item label="值类型">
        <el-select v-model="paramForm.valueType" style="width: 100%">
          <el-option v-for="item in valueTypeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="敏感参数"><el-switch v-model="paramForm.sensitive" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="paramForm.remark" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="paramDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitParam">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="credentialDialogVisible" :title="editingCredentialId ? '编辑敏感凭据' : '新增敏感凭据'" width="620px">
    <el-form label-width="110px">
      <el-form-item label="凭据键"><el-input v-model="credentialForm.credentialKey" :disabled="Boolean(editingCredentialId)" /></el-form-item>
      <el-form-item label="凭据名称"><el-input v-model="credentialForm.credentialName" /></el-form-item>
      <el-form-item label="凭据类型">
        <el-select v-model="credentialForm.credentialType" style="width: 100%">
          <el-option v-for="item in credentialTypeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="凭据明文"><el-input v-model="credentialForm.credentialValue" type="textarea" :rows="4" show-password /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="credentialForm.status" style="width: 100%">
          <el-option v-for="status in statusOptions" :key="status" :label="formatStatus(status)" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注"><el-input v-model="credentialForm.remark" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="credentialDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCredential">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="secretDialogVisible" title="新增商户秘钥版本" width="620px">
    <el-form label-width="110px">
      <el-form-item label="秘钥名称"><el-input v-model="secretForm.secretName" /></el-form-item>
      <el-form-item label="秘钥类型">
        <el-select v-model="secretForm.secretType" style="width: 100%">
          <el-option v-for="item in secretTypeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="录入方式">
        <el-radio-group v-model="secretForm.inputMode">
          <el-radio-button label="TEXT">手动输入</el-radio-button>
          <el-radio-button label="FILE">上传文件</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="secretForm.inputMode === 'TEXT'" label="秘钥明文">
        <el-input v-model="secretForm.secretValue" type="textarea" :rows="5" show-password />
      </el-form-item>
      <template v-else>
        <el-form-item label="文件内容">
          <el-radio-group v-model="secretForm.fileValueType">
            <el-radio-button label="TEXT">文本</el-radio-button>
            <el-radio-button label="BINARY">二进制</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="秘钥文件">
          <el-upload
            :auto-upload="false"
            :file-list="secretUploadFiles"
            :limit="1"
            :on-change="handleSecretFileChange"
            :on-remove="handleSecretFileRemove"
          >
            <el-button>选择文件</el-button>
          </el-upload>
        </el-form-item>
      </template>
      <el-form-item label="立即生效"><el-switch v-model="secretForm.activateNow" /></el-form-item>
      <el-form-item label="生效时间"><el-input v-model="secretForm.validFrom" placeholder="例如 2026-04-08T10:00:00" /></el-form-item>
      <el-form-item label="失效时间"><el-input v-model="secretForm.validTo" placeholder="例如 2026-12-31T23:59:59" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="secretForm.remark" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="secretDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitSecret">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.table-card {
  padding: 24px;
}

.sub-card {
  padding: 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  background: var(--el-fill-color-blank);
}

.detail-panel {
  min-height: 640px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.detail-subtitle {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.section-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.form-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0 10px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.relation-editor {
  width: 100%;
}

.relation-row {
  display: grid;
  grid-template-columns: minmax(160px, 1.4fr) minmax(150px, 1.1fr) minmax(120px, 1fr) 96px minmax(120px, 1fr) 48px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.merchant-option {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(140px, 1.1fr);
  gap: 16px;
  align-items: center;
}

.merchant-option-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  color: #0f172a;
}

.merchant-option-name {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-project-cell,
.binding-merchant-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

.binding-project-name,
.binding-project-code,
.binding-merchant-name,
.binding-merchant-code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-project-name,
.binding-merchant-name {
  color: #0f172a;
}

.binding-project-code,
.binding-merchant-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  color: #64748b;
  font-size: 12px;
}

.project-option,
.business-option,
.purpose-option {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(140px, 1.1fr);
  gap: 16px;
  align-items: center;
}

.project-option-code,
.purpose-option-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  color: #0f172a;
}

.project-option-name,
.business-option-meta,
.purpose-option-name {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.business-option-name {
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
