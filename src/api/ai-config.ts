import type { ApiResponse } from '@/types/http'
import type {
  AiProviderConfig,
  AiProviderConfigRequest,
  AiProviderConnectionTestResult,
  AiProviderProbeResult,
  AiUseCaseConfig,
  AiUseCaseConfigRequest,
  AiUseCaseQuery,
  AiUseCaseManagePage,
  DictOption,
} from '@/types/ai-config'

import http from './http'

export async function fetchAiProviders(): Promise<AiProviderConfig[]> {
  const response = await http.get<ApiResponse<AiProviderConfig[]>>('/manage/system/ai-provider/list')
  return response.data.data
}

export async function fetchAiProviderDetail(id: number): Promise<AiProviderConfig> {
  const response = await http.get<ApiResponse<AiProviderConfig>>(`/manage/system/ai-provider/${id}`)
  return response.data.data
}

export async function createAiProvider(request: AiProviderConfigRequest): Promise<AiProviderConfig> {
  const response = await http.post<ApiResponse<AiProviderConfig>>('/manage/system/ai-provider/save', request)
  return response.data.data
}

export async function updateAiProvider(id: number, request: AiProviderConfigRequest): Promise<AiProviderConfig> {
  const response = await http.post<ApiResponse<AiProviderConfig>>('/manage/system/ai-provider/save', { ...request, id })
  return response.data.data
}

export async function probeAiProvider(id: number, model: string): Promise<AiProviderProbeResult> {
  const response = await http.post<ApiResponse<AiProviderProbeResult>>(`/manage/system/ai-provider/${id}/probe`, { model })
  return response.data.data
}

export async function testAiProviderConnection(
  request: AiProviderConfigRequest,
): Promise<AiProviderConnectionTestResult> {
  const timeout = Math.max((request.callTimeoutSeconds || 600) * 1000 + 15_000, 30_000)
  const response = await http.post<ApiResponse<AiProviderConnectionTestResult>>(
    '/manage/system/ai-provider/test-connection',
    request,
    { timeout },
  )
  return response.data.data
}

export async function fetchAiUseCases(query: AiUseCaseQuery): Promise<AiUseCaseManagePage> {
  const response = await http.post<ApiResponse<AiUseCaseManagePage>>('/manage/system/ai-use-case/list', {
    ...query,
    pageNum: query.pageNum || query.page,
  })
  return response.data.data
}

export async function fetchAiUseCaseDetail(id: number): Promise<AiUseCaseConfig> {
  const response = await http.get<ApiResponse<AiUseCaseConfig>>(`/manage/system/ai-use-case/${id}`)
  return response.data.data
}

export async function createAiUseCase(request: AiUseCaseConfigRequest): Promise<AiUseCaseConfig> {
  const response = await http.post<ApiResponse<AiUseCaseConfig>>('/manage/system/ai-use-case/save', request)
  return response.data.data
}

export async function updateAiUseCase(id: number, request: AiUseCaseConfigRequest): Promise<AiUseCaseConfig> {
  const response = await http.post<ApiResponse<AiUseCaseConfig>>('/manage/system/ai-use-case/save', { ...request, id })
  return response.data.data
}

export async function fetchDictOptions(dictType: string): Promise<DictOption[]> {
  const response = await http.post<ApiResponse<DictOption[]>>('/dict/list', { dictType })
  return response.data.data
}
