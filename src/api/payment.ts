import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  PaymentChannelDetail,
  PaymentChannelSaveRequest,
  PaymentChannelSummary,
  PaymentMerchantDetail,
  PaymentMerchantCredential,
  PaymentMerchantCredentialSaveRequest,
  PaymentMerchantParamFileUploadRequest,
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
  businessLine?: string
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

export async function deletePaymentMerchantParam(merchantId: number, paramId: number): Promise<PaymentMerchantParam[]> {
  const response = await http.delete<ApiResponse<PaymentMerchantParam[]>>(`/payment/merchants/${merchantId}/params/${paramId}`)
  return response.data.data
}

export async function savePaymentMerchantParamFromFile(merchantId: number,
                                                       request: PaymentMerchantParamFileUploadRequest): Promise<PaymentMerchantParam[]> {
  const formData = paramFileFormData(request)
  if (request.file) {
    formData.append('file', request.file)
  }
  const response = await http.post<ApiResponse<PaymentMerchantParam[]>>(`/payment/merchants/${merchantId}/params/file`, formData)
  return response.data.data
}

export async function updatePaymentMerchantParamFromFile(merchantId: number,
                                                         paramId: number,
                                                         request: PaymentMerchantParamFileUploadRequest): Promise<PaymentMerchantParam[]> {
  const formData = paramFileFormData(request)
  if (request.file) {
    formData.append('file', request.file)
  }
  const response = await http.put<ApiResponse<PaymentMerchantParam[]>>(`/payment/merchants/${merchantId}/params/${paramId}/file`, formData)
  return response.data.data
}

export async function downloadPaymentMerchantParamFile(merchantId: number, paramId: number): Promise<Blob> {
  const response = await http.get(`/payment/merchants/${merchantId}/params/${paramId}/file`, {
    responseType: 'blob',
  })
  return response.data
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

export async function downloadPaymentMerchantSecretFile(merchantId: number, secretId: number): Promise<Blob> {
  const response = await http.get(`/payment/merchants/${merchantId}/secrets/${secretId}/file`, {
    responseType: 'blob',
  })
  return response.data
}

export async function createPaymentMerchantSecret(merchantId: number,
                                                  request: PaymentSecretSaveRequest): Promise<PaymentSecretSummary[]> {
  const response = await http.post<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets`, request)
  return response.data.data
}

export async function updatePaymentMerchantSecret(merchantId: number,
                                                  secretId: number,
                                                  request: PaymentSecretSaveRequest): Promise<PaymentSecretSummary[]> {
  const response = await http.put<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets/${secretId}`, request)
  return response.data.data
}

export async function createPaymentMerchantSecretFromFile(merchantId: number,
                                                          request: PaymentSecretFileUploadRequest): Promise<PaymentSecretSummary[]> {
  const formData = secretFileFormData(request)
  if (request.file) {
    formData.append('file', request.file)
  }
  const response = await http.post<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets/file`, formData)
  return response.data.data
}

export async function updatePaymentMerchantSecretFromFile(merchantId: number,
                                                          secretId: number,
                                                          request: PaymentSecretFileUploadRequest): Promise<PaymentSecretSummary[]> {
  const formData = secretFileFormData(request)
  if (request.file) {
    formData.append('file', request.file)
  }
  const response = await http.put<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets/${secretId}/file`, formData)
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

function secretFileFormData(request: PaymentSecretFileUploadRequest) {
  const formData = new FormData()
  formData.append('secretName', request.secretName)
  formData.append('secretType', request.secretType)
  formData.append('fileValueType', request.fileValueType)
  formData.append('status', request.status)
  if (request.validFrom) {
    formData.append('validFrom', request.validFrom)
  }
  if (request.validTo) {
    formData.append('validTo', request.validTo)
  }
  if (request.remark) {
    formData.append('remark', request.remark)
  }
  return formData
}

function paramFileFormData(request: PaymentMerchantParamFileUploadRequest) {
  const formData = new FormData()
  if (request.paramKey) {
    formData.append('paramKey', request.paramKey)
  }
  formData.append('valueType', request.valueType)
  formData.append('fileValueType', request.fileValueType)
  if (request.remark) {
    formData.append('remark', request.remark)
  }
  return formData
}

function normalizePaymentBinding<T extends Partial<PaymentProjectBinding>>(binding: T): T & PaymentProjectBinding {
  const businessLine = (binding as { businessLine?: string; projectGroup?: string }).businessLine
    || (binding as { projectGroup?: string }).projectGroup
    || ''
  const businessLineCode = (binding as { businessLineCode?: string }).businessLineCode || businessLine
  return {
    ...binding,
    businessLine,
    businessLineCode,
    businessLineName: (binding as { businessLineName?: string }).businessLineName || businessLine,
    projectGroup: businessLineCode,
  } as T & PaymentProjectBinding
}
