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
  purposeCodes: string[]
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

export interface PaymentMerchantCredential {
  id: number
  credentialKey: string
  credentialName: string
  credentialType: string
  maskedValue: string
  fingerprint: string
  status: string
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentMerchantCredentialSaveRequest {
  credentialKey?: string
  credentialName: string
  credentialType: string
  credentialValue: string
  status: string
  plainStorage?: boolean
  remark?: string
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
  purposeCodes: string[]
  parameters: PaymentMerchantParam[]
  secrets: PaymentSecretSummary[]
  credentials: PaymentMerchantCredential[]
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
  purposeCodes?: string[]
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

export interface PaymentSecretFileUploadRequest {
  secretName: string
  secretType: string
  fileValueType: 'TEXT' | 'BINARY'
  file: File
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

export interface PaymentBindingRelation {
  id: number
  bindingId: number
  merchantId: number
  merchantCode: string
  merchantName: string
  relationRole: string
  relationName: string | null
  priority: number
  remark: string | null
}

export interface PaymentBindingRelationSaveRequest {
  merchantId: number
  relationRole: string
  relationName?: string
  priority?: number
  remark?: string
}

export interface PaymentProjectBinding {
  id: number
  projectId: number | null
  businessLineCode: string
  businessLineName: string
  businessLine: string
  projectGroup: string
  projectCode: string | null
  projectName: string | null
  merchantId: number
  merchantCode: string
  merchantName: string
  channelId: number
  channelCode: string
  channelName: string
  environment: string
  purposeCode: string
  purposeCodes: string[]
  priority: number
  defaultBinding: boolean
  status: string
  remark: string | null
  relations: PaymentBindingRelation[]
  createdAt: string
  updatedAt: string
}

export interface PaymentProjectBindingSaveRequest {
  projectId?: number | null
  businessLine: string
  merchantId: number
  purposeCode: string
  purposeCodes?: string[]
  priority: number
  defaultBinding?: boolean
  status: string
  remark?: string
  relations?: PaymentBindingRelationSaveRequest[]
}
