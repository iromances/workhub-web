import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  PaymentChannelDetail,
  PaymentChannelSaveRequest,
  PaymentChannelSummary,
  PaymentMerchantDetail,
  PaymentMerchantCredential,
  PaymentMerchantCredentialSaveRequest,
  PaymentMerchantParam,
  PaymentMerchantParamSaveRequest,
  PaymentMerchantSaveRequest,
  PaymentMerchantSummary,
  PaymentProjectBinding,
  PaymentProjectBindingSaveRequest,
  PaymentPurposeOption,
  PaymentSecretFileUploadRequest,
  PaymentSecretSaveRequest,
  PaymentSecretSummary,
} from '@/types/payment'

import http from './http'

export async function fetchPaymentChannels(params?: {
  channelId?: number
  status?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<PaymentChannelSummary>> {
  const response = await http.get<ApiResponse<PageResponse<PaymentChannelSummary>>>('/payment/channels', { params })
  return response.data.data
}

export async function fetchPaymentChannelDetail(id: number): Promise<PaymentChannelDetail> {
  const response = await http.get<ApiResponse<PaymentChannelDetail>>(`/payment/channels/${id}`)
  return response.data.data
}

export async function createPaymentChannel(request: PaymentChannelSaveRequest): Promise<PaymentChannelDetail> {
  const response = await http.post<ApiResponse<PaymentChannelDetail>>('/payment/channels', request)
  return response.data.data
}

export async function updatePaymentChannel(id: number, request: PaymentChannelSaveRequest): Promise<PaymentChannelDetail> {
  const response = await http.put<ApiResponse<PaymentChannelDetail>>(`/payment/channels/${id}`, request)
  return response.data.data
}

export async function fetchPaymentMerchants(params?: {
  status?: string
  channelId?: number
  projectId?: number
  purposeCode?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<PaymentMerchantSummary>> {
  const response = await http.get<ApiResponse<PageResponse<PaymentMerchantSummary>>>('/payment/merchants', { params })
  return response.data.data
}

export async function fetchPaymentMerchantDetail(id: number): Promise<PaymentMerchantDetail> {
  const response = await http.get<ApiResponse<PaymentMerchantDetail>>(`/payment/merchants/${id}`)
  return response.data.data
}

export async function createPaymentMerchant(request: PaymentMerchantSaveRequest): Promise<PaymentMerchantDetail> {
  const response = await http.post<ApiResponse<PaymentMerchantDetail>>('/payment/merchants', request)
  return response.data.data
}

export async function updatePaymentMerchant(id: number, request: PaymentMerchantSaveRequest): Promise<PaymentMerchantDetail> {
  const response = await http.put<ApiResponse<PaymentMerchantDetail>>(`/payment/merchants/${id}`, request)
  return response.data.data
}

export async function savePaymentMerchantParam(merchantId: number,
                                               request: PaymentMerchantParamSaveRequest): Promise<PaymentMerchantParam[]> {
  const response = await http.post<ApiResponse<PaymentMerchantParam[]>>(`/payment/merchants/${merchantId}/params`, request)
  return response.data.data
}

export async function updatePaymentMerchantParam(merchantId: number,
                                                 paramId: number,
                                                 request: PaymentMerchantParamSaveRequest): Promise<PaymentMerchantParam[]> {
  const response = await http.put<ApiResponse<PaymentMerchantParam[]>>(`/payment/merchants/${merchantId}/params/${paramId}`, request)
  return response.data.data
}

export async function savePaymentMerchantCredential(merchantId: number,
                                                    request: PaymentMerchantCredentialSaveRequest): Promise<PaymentMerchantCredential[]> {
  const response = await http.post<ApiResponse<PaymentMerchantCredential[]>>(`/payment/merchants/${merchantId}/credentials`, request)
  return response.data.data
}

export async function updatePaymentMerchantCredential(merchantId: number,
                                                      credentialId: number,
                                                      request: PaymentMerchantCredentialSaveRequest): Promise<PaymentMerchantCredential[]> {
  const response = await http.put<ApiResponse<PaymentMerchantCredential[]>>(
    `/payment/merchants/${merchantId}/credentials/${credentialId}`,
    request,
  )
  return response.data.data
}

export async function fetchPaymentMerchantSecrets(merchantId: number): Promise<PaymentSecretSummary[]> {
  const response = await http.get<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets`)
  return response.data.data
}

export async function createPaymentMerchantSecret(merchantId: number,
                                                  request: PaymentSecretSaveRequest): Promise<PaymentSecretSummary[]> {
  const response = await http.post<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets`, request)
  return response.data.data
}

export async function createPaymentMerchantSecretFromFile(merchantId: number,
                                                          request: PaymentSecretFileUploadRequest): Promise<PaymentSecretSummary[]> {
  const formData = new FormData()
  formData.append('secretName', request.secretName)
  formData.append('secretType', request.secretType)
  formData.append('fileValueType', request.fileValueType)
  formData.append('file', request.file)
  formData.append('activateNow', String(request.activateNow ?? true))
  if (request.validFrom) {
    formData.append('validFrom', request.validFrom)
  }
  if (request.validTo) {
    formData.append('validTo', request.validTo)
  }
  if (request.remark) {
    formData.append('remark', request.remark)
  }
  const response = await http.post<ApiResponse<PaymentSecretSummary[]>>(
    `/payment/merchants/${merchantId}/secrets/file`,
    formData,
  )
  return response.data.data
}

export async function fetchPaymentBindings(params?: {
  projectId?: number
  projectGroup?: string
  businessLine?: string
  merchantId?: number
  purposeCode?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<PaymentProjectBinding>> {
  const response = await http.get<ApiResponse<PageResponse<PaymentProjectBinding>>>('/payment/bindings', {
    params: {
      ...params,
      businessLine: params?.businessLine || params?.projectGroup,
      projectGroup: undefined,
    },
  })
  return {
    ...response.data.data,
    items: response.data.data.items.map(normalizePaymentBinding),
  }
}

export async function createPaymentBinding(request: PaymentProjectBindingSaveRequest): Promise<PaymentProjectBinding> {
  const response = await http.post<ApiResponse<PaymentProjectBinding>>('/payment/bindings', request)
  return normalizePaymentBinding(response.data.data)
}

export async function updatePaymentBinding(id: number,
                                           request: PaymentProjectBindingSaveRequest): Promise<PaymentProjectBinding> {
  const response = await http.put<ApiResponse<PaymentProjectBinding>>(`/payment/bindings/${id}`, request)
  return normalizePaymentBinding(response.data.data)
}

export async function fetchPaymentPurposes(): Promise<PaymentPurposeOption[]> {
  const response = await http.get<ApiResponse<PaymentPurposeOption[]>>('/payment/purposes')
  return response.data.data
}

function normalizePaymentBinding<T extends Partial<PaymentProjectBinding>>(binding: T): T & PaymentProjectBinding {
  const businessLine = (binding as { businessLine?: string; projectGroup?: string }).businessLine
    || (binding as { projectGroup?: string }).projectGroup
    || ''
  return {
    ...binding,
    businessLine,
    businessLineCode: (binding as { businessLineCode?: string }).businessLineCode || businessLine,
    businessLineName: (binding as { businessLineName?: string }).businessLineName || businessLine,
    projectGroup: businessLine,
  } as T & PaymentProjectBinding
}
