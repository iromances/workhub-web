export interface PaymentChannelSummary {
  id: number
  code: string
  name: string
  vendorName: string
  status: string
}

export interface PaymentChannelDetail {
  id: number
  code: string
  name: string
  vendorName: string
  status: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentChannelSaveRequest {
  code: string
  name: string
  vendorName: string
  status: string
  description?: string
}

export interface PaymentMerchantSummary {
  id: number
  channelId: number
  channelCode: string
  channelName: string
  merchantCode: string
  merchantName: string
  environment: string
  appId: string | null
  status: string
}

export interface PaymentMerchantParam {
  id: number
  paramKey: string
  valueType: string
  sensitive: boolean
  displayValue: string
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentSecretSummary {
  id: number
  secretName: string
  secretType: string
  versionNo: number
  maskedValue: string
  fingerprint: string
  algorithm: string
  status: string
  validFrom: string | null
  validTo: string | null
  remark: string | null
  createdAt: string
}

export interface PaymentMerchantDetail {
  id: number
  channelId: number
  channelCode: string
  channelName: string
  merchantCode: string
  merchantName: string
  environment: string
  appId: string | null
  settlementSubject: string | null
  status: string
  remark: string | null
  parameters: PaymentMerchantParam[]
  secrets: PaymentSecretSummary[]
  createdAt: string
  updatedAt: string
}

export interface PaymentMerchantSaveRequest {
  channelId: number
  merchantCode: string
  merchantName: string
  environment: string
  status: string
  appId?: string
  settlementSubject?: string
  remark?: string
}

export interface PaymentMerchantParamSaveRequest {
  paramKey?: string
  paramValue: string
  valueType: string
  sensitive?: boolean
  remark?: string
}

export interface PaymentSecretSaveRequest {
  secretName: string
  secretType: string
  secretValue: string
  activateNow?: boolean
  validFrom?: string
  validTo?: string
  remark?: string
}

export interface PaymentPurposeOption {
  code: string
  name: string
  description: string
}

export interface PaymentProjectBinding {
  id: number
  projectId: number
  projectCode: string
  projectName: string
  merchantId: number
  merchantCode: string
  merchantName: string
  channelId: number
  channelCode: string
  channelName: string
  environment: string
  purposeCode: string
  priority: number
  defaultBinding: boolean
  status: string
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentProjectBindingSaveRequest {
  projectId: number
  merchantId: number
  purposeCode: string
  priority: number
  defaultBinding?: boolean
  status: string
  remark?: string
}
