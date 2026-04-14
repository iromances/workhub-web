import type { ApiResponse, PageResponse } from '@/types/http'
import type {
  PaymentChannelDetail,
  PaymentChannelSaveRequest,
  PaymentChannelSummary,
  PaymentMerchantDetail,
  PaymentMerchantParam,
  PaymentMerchantParamSaveRequest,
  PaymentMerchantSaveRequest,
  PaymentMerchantSummary,
  PaymentProjectBinding,
  PaymentProjectBindingSaveRequest,
  PaymentPurposeOption,
  PaymentSecretSaveRequest,
  PaymentSecretSummary,
} from '@/types/payment'

import http from './http'

export async function fetchPaymentChannels(params?: {
  status?: string
  keyword?: string
}): Promise<PaymentChannelSummary[]> {
  const response = await http.get<ApiResponse<PageResponse<PaymentChannelSummary>>>('/payment/channels', { params })
  return response.data.data.items
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
}): Promise<PaymentMerchantSummary[]> {
  const response = await http.get<ApiResponse<PageResponse<PaymentMerchantSummary>>>('/payment/merchants', { params })
  return response.data.data.items
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

export async function fetchPaymentMerchantSecrets(merchantId: number): Promise<PaymentSecretSummary[]> {
  const response = await http.get<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets`)
  return response.data.data
}

export async function createPaymentMerchantSecret(merchantId: number,
                                                  request: PaymentSecretSaveRequest): Promise<PaymentSecretSummary[]> {
  const response = await http.post<ApiResponse<PaymentSecretSummary[]>>(`/payment/merchants/${merchantId}/secrets`, request)
  return response.data.data
}

export async function fetchPaymentBindings(params?: {
  projectId?: number
  merchantId?: number
  purposeCode?: string
  status?: string
}): Promise<PaymentProjectBinding[]> {
  const response = await http.get<ApiResponse<PageResponse<PaymentProjectBinding>>>('/payment/bindings', { params })
  return response.data.data.items
}

export async function createPaymentBinding(request: PaymentProjectBindingSaveRequest): Promise<PaymentProjectBinding> {
  const response = await http.post<ApiResponse<PaymentProjectBinding>>('/payment/bindings', request)
  return response.data.data
}

export async function updatePaymentBinding(id: number,
                                           request: PaymentProjectBindingSaveRequest): Promise<PaymentProjectBinding> {
  const response = await http.put<ApiResponse<PaymentProjectBinding>>(`/payment/bindings/${id}`, request)
  return response.data.data
}

export async function fetchPaymentPurposes(): Promise<PaymentPurposeOption[]> {
  const response = await http.get<ApiResponse<PaymentPurposeOption[]>>('/payment/purposes')
  return response.data.data
}
