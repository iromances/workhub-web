<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createPaymentBinding,
  createPaymentChannel,
  createPaymentMerchant,
  createPaymentMerchantSecret,
  fetchPaymentBindings,
  fetchPaymentChannelDetail,
  fetchPaymentChannels,
  fetchPaymentMerchantDetail,
  fetchPaymentMerchants,
  fetchPaymentPurposes,
  savePaymentMerchantParam,
  updatePaymentBinding,
  updatePaymentChannel,
  updatePaymentMerchant,
  updatePaymentMerchantParam,
} from '@/api/payment'
import { fetchProjects } from '@/api/project'
import type {
  PaymentChannelDetail,
  PaymentChannelSaveRequest,
  PaymentChannelSummary,
  PaymentMerchantDetail,
  PaymentMerchantParam,
  PaymentMerchantSaveRequest,
  PaymentMerchantSummary,
  PaymentProjectBinding,
  PaymentPurposeOption,
} from '@/types/payment'
import type { ProjectSummary } from '@/types/work-item'

const loadingChannels = ref(false)
const loadingMerchants = ref(false)
const loadingBindings = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const activeTab = ref('channels')

const channels = ref<PaymentChannelSummary[]>([])
const merchants = ref<PaymentMerchantSummary[]>([])
const bindings = ref<PaymentProjectBinding[]>([])
const projects = ref<ProjectSummary[]>([])
const purposes = ref<PaymentPurposeOption[]>([])

const selectedMerchantId = ref<number | null>(null)
const selectedMerchantDetail = ref<PaymentMerchantDetail | null>(null)

const channelDialogVisible = ref(false)
const merchantDialogVisible = ref(false)
const bindingDialogVisible = ref(false)
const paramDialogVisible = ref(false)
const secretDialogVisible = ref(false)

const editingChannelId = ref<number | null>(null)
const editingMerchantId = ref<number | null>(null)
const editingBindingId = ref<number | null>(null)
const editingParamId = ref<number | null>(null)

const channelFilters = reactive({
  keyword: '',
  status: '',
})

const merchantFilters = reactive({
  keyword: '',
  status: '',
  channelId: undefined as number | undefined,
  projectId: undefined as number | undefined,
  purposeCode: '',
})

const bindingFilters = reactive({
  projectId: undefined as number | undefined,
  merchantId: undefined as number | undefined,
  purposeCode: '',
  status: '',
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
  remark: '',
})

const bindingForm = reactive({
  projectId: 0,
  merchantId: 0,
  purposeCode: '',
  priority: 1,
  defaultBinding: true,
  status: 'ACTIVE',
  remark: '',
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
  secretValue: '',
  activateNow: true,
  validFrom: '',
  validTo: '',
  remark: '',
})

const environmentOptions = ['PROD', 'UAT', 'SIT', 'TEST']
const statusOptions = ['ACTIVE', 'INACTIVE']
const valueTypeOptions = ['TEXT', 'JSON', 'URL', 'NUMBER', 'CERT', 'PEM']
const secretTypeOptions = ['API_KEY', 'API_SECRET', 'PRIVATE_KEY', 'PUBLIC_KEY', 'CERTIFICATE', 'CERT_PASSWORD', 'SIGN_SECRET', 'APP_SECRET']

const selectedMerchantLabel = computed(() => {
  if (!selectedMerchantDetail.value) {
    return '未选择商户'
  }
  return `${selectedMerchantDetail.value.merchantName} / ${selectedMerchantDetail.value.merchantCode}`
})

async function loadBaseOptions() {
  const [projectItems, purposeItems, channelItems] = await Promise.all([
    fetchProjects(),
    fetchPaymentPurposes(),
    fetchPaymentChannels({ status: 'ACTIVE' }),
  ])
  projects.value = projectItems
  purposes.value = purposeItems
  channels.value = channelItems
}

async function loadChannels() {
  loadingChannels.value = true
  try {
    channels.value = await fetchPaymentChannels({
      keyword: channelFilters.keyword || undefined,
      status: channelFilters.status || undefined,
    })
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
    merchants.value = await fetchPaymentMerchants({
      keyword: merchantFilters.keyword || undefined,
      status: merchantFilters.status || undefined,
      channelId: merchantFilters.channelId,
      projectId: merchantFilters.projectId,
      purposeCode: merchantFilters.purposeCode || undefined,
    })
  } catch (error) {
    ElMessage.error('加载支付商户失败')
    console.error(error)
  } finally {
    loadingMerchants.value = false
  }
}

async function loadBindings() {
  loadingBindings.value = true
  try {
    bindings.value = await fetchPaymentBindings({
      projectId: bindingFilters.projectId,
      merchantId: bindingFilters.merchantId,
      purposeCode: bindingFilters.purposeCode || undefined,
      status: bindingFilters.status || undefined,
    })
  } catch (error) {
    ElMessage.error('加载项目支付绑定失败')
    console.error(error)
  } finally {
    loadingBindings.value = false
  }
}

async function loadMerchantDetail(id: number) {
  detailLoading.value = true
  selectedMerchantId.value = id
  try {
    selectedMerchantDetail.value = await fetchPaymentMerchantDetail(id)
  } catch (error) {
    ElMessage.error('加载商户详情失败')
    console.error(error)
  } finally {
    detailLoading.value = false
  }
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
    await Promise.all([loadChannels(), loadMerchants()])
  } catch (error) {
    ElMessage.error('保存支付渠道失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function resetMerchantForm() {
  editingMerchantId.value = null
  merchantForm.channelId = channels.value[0]?.id || 0
  merchantForm.merchantCode = ''
  merchantForm.merchantName = ''
  merchantForm.environment = 'PROD'
  merchantForm.status = 'ACTIVE'
  merchantForm.appId = ''
  merchantForm.settlementSubject = ''
  merchantForm.remark = ''
}

async function openMerchantDialog(id?: number) {
  resetMerchantForm()
  if (id) {
    const detail = await fetchPaymentMerchantDetail(id)
    editingMerchantId.value = id
    merchantForm.channelId = detail.channelId
    merchantForm.merchantCode = detail.merchantCode
    merchantForm.merchantName = detail.merchantName
    merchantForm.environment = detail.environment
    merchantForm.status = detail.status
    merchantForm.appId = detail.appId || ''
    merchantForm.settlementSubject = detail.settlementSubject || ''
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
    await loadMerchants()
  } catch (error) {
    ElMessage.error('保存支付商户失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

function resetBindingForm() {
  editingBindingId.value = null
  bindingForm.projectId = projects.value[0]?.id || 0
  bindingForm.merchantId = merchants.value[0]?.id || 0
  bindingForm.purposeCode = purposes.value[0]?.code || ''
  bindingForm.priority = 1
  bindingForm.defaultBinding = true
  bindingForm.status = 'ACTIVE'
  bindingForm.remark = ''
}

function openBindingDialog(binding?: PaymentProjectBinding) {
  resetBindingForm()
  if (binding) {
    editingBindingId.value = binding.id
    bindingForm.projectId = binding.projectId
    bindingForm.merchantId = binding.merchantId
    bindingForm.purposeCode = binding.purposeCode
    bindingForm.priority = binding.priority
    bindingForm.defaultBinding = binding.defaultBinding
    bindingForm.status = binding.status
    bindingForm.remark = binding.remark || ''
  }
  bindingDialogVisible.value = true
}

async function submitBinding() {
  submitting.value = true
  try {
    const payload = {
      projectId: bindingForm.projectId,
      merchantId: bindingForm.merchantId,
      purposeCode: bindingForm.purposeCode,
      priority: bindingForm.priority,
      defaultBinding: bindingForm.defaultBinding,
      status: bindingForm.status,
      remark: bindingForm.remark,
    }
    if (editingBindingId.value) {
      await updatePaymentBinding(editingBindingId.value, payload)
      ElMessage.success('项目支付绑定已更新')
    } else {
      await createPaymentBinding(payload)
      ElMessage.success('项目支付绑定已新增')
    }
    bindingDialogVisible.value = false
    await loadBindings()
  } catch (error) {
    ElMessage.error('保存项目支付绑定失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
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

function openSecretDialog() {
  if (!selectedMerchantId.value) {
    ElMessage.warning('请先选择商户')
    return
  }
  secretForm.secretName = ''
  secretForm.secretType = 'PRIVATE_KEY'
  secretForm.secretValue = ''
  secretForm.activateNow = true
  secretForm.validFrom = ''
  secretForm.validTo = ''
  secretForm.remark = ''
  secretDialogVisible.value = true
}

async function submitSecret() {
  if (!selectedMerchantId.value) {
    return
  }
  submitting.value = true
  try {
    await createPaymentMerchantSecret(selectedMerchantId.value, {
      secretName: secretForm.secretName,
      secretType: secretForm.secretType,
      secretValue: secretForm.secretValue,
      activateNow: secretForm.activateNow,
      validFrom: secretForm.validFrom || undefined,
      validTo: secretForm.validTo || undefined,
      remark: secretForm.remark,
    })
    secretDialogVisible.value = false
    ElMessage.success('商户秘钥版本已新增')
    await loadMerchantDetail(selectedMerchantId.value)
  } catch (error) {
    ElMessage.error('保存商户秘钥失败')
    console.error(error)
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
    await Promise.all([loadChannels(), loadMerchants(), loadBindings()])
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
        <el-form inline @submit.prevent="loadChannels">
          <el-form-item>
            <el-input v-model="channelFilters.keyword" placeholder="渠道编码 / 名称 / 厂商" clearable />
          </el-form-item>
          <el-form-item>
            <el-select v-model="channelFilters.status" placeholder="状态" clearable style="width: 140px">
              <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadChannels">查询</el-button>
            <el-button type="primary" plain @click="openChannelDialog()">新增渠道</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loadingChannels" :data="channels">
          <el-table-column prop="code" label="渠道编码" width="160" />
          <el-table-column prop="name" label="渠道名称" min-width="180" />
          <el-table-column prop="vendorName" label="厂商" width="160" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openChannelDialog(row.id)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="商户账号与密钥" name="merchants">
        <el-row :gutter="18">
          <el-col :span="14">
            <div class="sub-card">
              <el-form inline @submit.prevent="loadMerchants">
                <el-form-item>
                  <el-input v-model="merchantFilters.keyword" placeholder="商户号 / 商户名称" clearable />
                </el-form-item>
                <el-form-item>
                  <el-select v-model="merchantFilters.channelId" placeholder="渠道" clearable style="width: 160px">
                    <el-option v-for="item in channels" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="merchantFilters.projectId" placeholder="项目" clearable style="width: 180px">
                    <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="merchantFilters.purposeCode" placeholder="用途" clearable style="width: 160px">
                    <el-option v-for="purpose in purposes" :key="purpose.code" :label="purpose.name" :value="purpose.code" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="merchantFilters.status" placeholder="状态" clearable style="width: 120px">
                    <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="loadMerchants">查询</el-button>
                  <el-button type="primary" plain @click="openMerchantDialog()">新增商户</el-button>
                </el-form-item>
              </el-form>

              <el-table v-loading="loadingMerchants" :data="merchants" height="520" @row-click="loadMerchantDetail($event.id)">
                <el-table-column prop="merchantCode" label="商户号" width="160" />
                <el-table-column prop="merchantName" label="商户名称" min-width="180" />
                <el-table-column prop="channelName" label="渠道" width="140" />
                <el-table-column prop="environment" label="环境" width="100" />
                <el-table-column prop="status" label="状态" width="100" />
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button link type="primary" @click.stop="openMerchantDialog(row.id)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-col>

          <el-col :span="10">
            <div class="sub-card detail-panel">
              <div class="detail-header">
                <div>
                  <div class="detail-title">商户详情</div>
                  <div class="detail-subtitle">{{ selectedMerchantLabel }}</div>
                </div>
                <div class="detail-actions">
                  <el-button size="small" type="primary" plain @click="openParamDialog()">新增参数</el-button>
                  <el-button size="small" type="primary" plain @click="openSecretDialog()">新增秘钥</el-button>
                </div>
              </div>

              <el-skeleton :loading="detailLoading" animated>
                <template #default>
                  <template v-if="selectedMerchantDetail">
                    <el-descriptions :column="1" border size="small">
                      <el-descriptions-item label="渠道">{{ selectedMerchantDetail.channelName }}</el-descriptions-item>
                      <el-descriptions-item label="商户号">{{ selectedMerchantDetail.merchantCode }}</el-descriptions-item>
                      <el-descriptions-item label="商户名称">{{ selectedMerchantDetail.merchantName }}</el-descriptions-item>
                      <el-descriptions-item label="环境">{{ selectedMerchantDetail.environment }}</el-descriptions-item>
                      <el-descriptions-item label="AppId">{{ selectedMerchantDetail.appId || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="结算主体">{{ selectedMerchantDetail.settlementSubject || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="备注">{{ selectedMerchantDetail.remark || '-' }}</el-descriptions-item>
                    </el-descriptions>

                    <div class="section-title">生产参数</div>
                    <el-table :data="selectedMerchantDetail.parameters" size="small">
                      <el-table-column prop="paramKey" label="参数名" min-width="120" />
                      <el-table-column prop="valueType" label="类型" width="90" />
                      <el-table-column prop="displayValue" label="显示值" min-width="160" show-overflow-tooltip />
                      <el-table-column label="操作" width="80">
                        <template #default="{ row }">
                          <el-button link type="primary" @click="openParamDialog(row)">编辑</el-button>
                        </template>
                      </el-table-column>
                    </el-table>

                    <div class="section-title">秘钥版本</div>
                    <el-table :data="selectedMerchantDetail.secrets" size="small">
                      <el-table-column prop="secretName" label="名称" min-width="120" />
                      <el-table-column prop="secretType" label="类型" width="110" />
                      <el-table-column prop="versionNo" label="版本" width="70" />
                      <el-table-column prop="maskedValue" label="脱敏值" min-width="140" show-overflow-tooltip />
                    </el-table>
                  </template>
                  <el-empty v-else description="请选择左侧商户查看详情" />
                </template>
              </el-skeleton>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="项目用途绑定" name="bindings">
        <el-form inline @submit.prevent="loadBindings">
          <el-form-item>
            <el-select v-model="bindingFilters.projectId" placeholder="项目" clearable style="width: 180px">
              <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="bindingFilters.merchantId" placeholder="商户" clearable style="width: 200px">
              <el-option
                v-for="merchant in merchants"
                :key="merchant.id"
                :label="`${merchant.merchantName} / ${merchant.merchantCode}`"
                :value="merchant.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="bindingFilters.purposeCode" placeholder="用途" clearable style="width: 160px">
              <el-option v-for="purpose in purposes" :key="purpose.code" :label="purpose.name" :value="purpose.code" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="bindingFilters.status" placeholder="状态" clearable style="width: 120px">
              <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadBindings">查询</el-button>
            <el-button type="primary" plain @click="openBindingDialog()">新增绑定</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loadingBindings" :data="bindings">
          <el-table-column prop="projectName" label="项目" min-width="160" />
          <el-table-column prop="merchantName" label="商户" min-width="180" />
          <el-table-column prop="channelName" label="渠道" width="140" />
          <el-table-column prop="purposeCode" label="用途编码" width="150" />
          <el-table-column prop="priority" label="优先级" width="90" />
          <el-table-column prop="defaultBinding" label="默认" width="80">
            <template #default="{ row }">
              <el-tag :type="row.defaultBinding ? 'success' : 'info'">{{ row.defaultBinding ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openBindingDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
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
          <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述"><el-input v-model="channelForm.description" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="channelDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitChannel">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="merchantDialogVisible" :title="editingMerchantId ? '编辑支付商户' : '新增支付商户'" width="640px">
    <el-form label-width="110px">
      <el-form-item label="所属渠道">
        <el-select v-model="merchantForm.channelId" style="width: 100%">
          <el-option v-for="item in channels" :key="item.id" :label="item.name" :value="item.id" />
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
          <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </el-select>
      </el-form-item>
      <el-form-item label="AppId"><el-input v-model="merchantForm.appId" /></el-form-item>
      <el-form-item label="结算主体"><el-input v-model="merchantForm.settlementSubject" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="merchantForm.remark" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="merchantDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitMerchant">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="bindingDialogVisible" :title="editingBindingId ? '编辑项目支付绑定' : '新增项目支付绑定'" width="620px">
    <el-form label-width="110px">
      <el-form-item label="项目">
        <el-select v-model="bindingForm.projectId" style="width: 100%">
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="商户">
        <el-select v-model="bindingForm.merchantId" style="width: 100%">
          <el-option
            v-for="merchant in merchants"
            :key="merchant.id"
            :label="`${merchant.merchantName} / ${merchant.merchantCode}`"
            :value="merchant.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="用途">
        <el-select v-model="bindingForm.purposeCode" style="width: 100%">
          <el-option v-for="purpose in purposes" :key="purpose.code" :label="`${purpose.name} (${purpose.code})`" :value="purpose.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级"><el-input-number v-model="bindingForm.priority" :min="1" /></el-form-item>
      <el-form-item label="默认绑定"><el-switch v-model="bindingForm.defaultBinding" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="bindingForm.status" style="width: 100%">
          <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </el-select>
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

  <el-dialog v-model="secretDialogVisible" title="新增商户秘钥版本" width="620px">
    <el-form label-width="110px">
      <el-form-item label="秘钥名称"><el-input v-model="secretForm.secretName" /></el-form-item>
      <el-form-item label="秘钥类型">
        <el-select v-model="secretForm.secretType" style="width: 100%">
          <el-option v-for="item in secretTypeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="秘钥明文"><el-input v-model="secretForm.secretValue" type="textarea" :rows="5" show-password /></el-form-item>
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
</style>
