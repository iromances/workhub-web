import type { ApiResponse, PageResponse } from '@/types/http'
import type { ProjectDetail, ProjectGroup, ProjectInvolvedSystem, ProjectSummary } from '@/types/work-item'

import http from './http'

export async function fetchProjectPage(params?: { status?: string; keyword?: string; businessLine?: string; page?: number; pageSize?: number }): Promise<PageResponse<ProjectSummary>> {
  const response = await http.get<ApiResponse<PageResponse<ProjectSummary>>>('/projects', { params })
  return {
    ...response.data.data,
    items: response.data.data.items.map(normalizeProject),
  }
}

export async function fetchProjects(params?: { status?: string; keyword?: string; businessLine?: string }): Promise<ProjectSummary[]> {
  const response = await fetchProjectPage(params)
  return response.items
}

export async function fetchProjectDetail(id: number): Promise<ProjectDetail> {
  const response = await http.get<ApiResponse<ProjectDetail>>(`/projects/${id}`)
  return normalizeProject(response.data.data) as ProjectDetail
}

export async function fetchProjectGroupPage(params?: { keyword?: string; page?: number; pageSize?: number }): Promise<PageResponse<ProjectGroup>> {
  const response = await http.get<ApiResponse<PageResponse<ProjectGroup>>>('/projects/business-lines', { params })
  return {
    ...response.data.data,
    items: response.data.data.items.map(normalizeBusinessLine),
  }
}

export async function fetchProjectGroups(params?: { keyword?: string }): Promise<ProjectGroup[]> {
  const response = await fetchProjectGroupPage(params)
  return response.items
}

export interface ProjectCreateRequest {
  code: string
  name: string
  type: string
  group: string
  ownerUserName: string
  status: string
  description?: string
}

export async function createProject(request: ProjectCreateRequest): Promise<void> {
  await http.post<ApiResponse<unknown>>('/projects', toProjectPayload(request))
}

export async function updateProject(id: number, request: ProjectCreateRequest): Promise<ProjectDetail> {
  const response = await http.put<ApiResponse<ProjectDetail>>(`/projects/${id}`, toProjectPayload(request))
  return normalizeProject(response.data.data) as ProjectDetail
}

export async function deleteProject(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/projects/${id}`)
}

export interface ProjectGroupSaveRequest {
  groupName: string
  gitlabGroupName?: string
  description?: string
  enabled?: boolean
}

export async function createProjectGroup(request: ProjectGroupSaveRequest): Promise<ProjectGroup> {
  const response = await http.post<ApiResponse<ProjectGroup>>('/projects/business-lines', toBusinessLinePayload(request))
  return normalizeBusinessLine(response.data.data)
}

export async function updateProjectGroup(id: number, request: ProjectGroupSaveRequest): Promise<ProjectGroup> {
  const response = await http.put<ApiResponse<ProjectGroup>>(`/projects/business-lines/${id}`, toBusinessLinePayload(request))
  return normalizeBusinessLine(response.data.data)
}

export async function deleteProjectGroup(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/projects/business-lines/${id}`)
}

export interface ProjectInvolvedSystemSaveRequest {
  systemScope: 'PROJECT_GROUP' | 'BUSINESS_LINE' | 'MIDDLE_PLATFORM'
  projectGroup?: string
  businessLine?: string
  systemName: string
  description?: string
  enabled?: boolean
  sortOrder?: number
}

export async function fetchProjectInvolvedSystems(params?: {
  systemScope?: 'PROJECT_GROUP' | 'BUSINESS_LINE' | 'MIDDLE_PLATFORM'
  projectGroup?: string
  businessLine?: string
  enabledOnly?: boolean
  keyword?: string
}): Promise<ProjectInvolvedSystem[]> {
  const response = await http.get<ApiResponse<PageResponse<ProjectInvolvedSystem>>>('/projects/involved-systems', {
    params: toInvolvedSystemParams(params),
  })
  return response.data.data.items.map(normalizeInvolvedSystem)
}

export async function fetchSelectableProjectInvolvedSystems(projectGroup: string): Promise<ProjectInvolvedSystem[]> {
  const response = await http.get<ApiResponse<PageResponse<ProjectInvolvedSystem>>>('/projects/involved-systems/selectable', {
    params: { businessLine: projectGroup },
  })
  return response.data.data.items.map(normalizeInvolvedSystem)
}

export async function syncProjectGroupInvolvedSystemsFromGit(groupId: number): Promise<ProjectInvolvedSystem[]> {
  const response = await http.post<ApiResponse<PageResponse<ProjectInvolvedSystem>>>(`/projects/business-lines/${groupId}/involved-systems/sync-git`)
  return response.data.data.items.map(normalizeInvolvedSystem)
}

export async function createProjectInvolvedSystem(request: ProjectInvolvedSystemSaveRequest): Promise<ProjectInvolvedSystem> {
  const response = await http.post<ApiResponse<ProjectInvolvedSystem>>('/projects/involved-systems', toInvolvedSystemPayload(request))
  return normalizeInvolvedSystem(response.data.data)
}

export async function updateProjectInvolvedSystem(id: number, request: ProjectInvolvedSystemSaveRequest): Promise<ProjectInvolvedSystem> {
  const response = await http.put<ApiResponse<ProjectInvolvedSystem>>(`/projects/involved-systems/${id}`, toInvolvedSystemPayload(request))
  return normalizeInvolvedSystem(response.data.data)
}

export async function deleteProjectInvolvedSystem(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/projects/involved-systems/${id}`)
}

function normalizeProject<T extends Partial<ProjectSummary>>(project: T): T & ProjectSummary {
  const businessLine = (project as { businessLine?: string; group?: string }).businessLine || (project as { group?: string }).group || ''
  return {
    ...project,
    businessLine,
    businessLineCode: (project as { businessLineCode?: string }).businessLineCode || businessLine,
    businessLineName: (project as { businessLineName?: string }).businessLineName || businessLine,
    group: businessLine,
  } as T & ProjectSummary
}

function normalizeBusinessLine<T extends Partial<ProjectGroup>>(businessLine: T): T & ProjectGroup {
  const name = (businessLine as { businessLineName?: string; groupName?: string }).businessLineName
    || (businessLine as { groupName?: string }).groupName
    || ''
  return {
    ...businessLine,
    businessLineName: name,
    groupName: name,
  } as T & ProjectGroup
}

function normalizeInvolvedSystem<T extends Partial<ProjectInvolvedSystem>>(system: T): T & ProjectInvolvedSystem {
  const businessLine = (system as { businessLine?: string; projectGroup?: string }).businessLine
    || (system as { projectGroup?: string }).projectGroup
    || ''
  const systemScope = ((system as { systemScope?: string }).systemScope === 'BUSINESS_LINE' ? 'PROJECT_GROUP' : (system as { systemScope?: string }).systemScope) as ProjectInvolvedSystem['systemScope']
  return {
    ...system,
    businessLine,
    projectGroup: businessLine,
    systemScope,
  } as T & ProjectInvolvedSystem
}

function toProjectPayload(request: ProjectCreateRequest) {
  return {
    code: request.code,
    name: request.name,
    type: request.type,
    businessLine: request.group,
    ownerUserName: request.ownerUserName,
    status: request.status,
    description: request.description,
  }
}

function toBusinessLinePayload(request: ProjectGroupSaveRequest) {
  return {
    businessLineName: request.groupName,
    gitlabGroupName: request.gitlabGroupName,
    description: request.description,
    enabled: request.enabled,
  }
}

function toInvolvedSystemParams(params?: {
  systemScope?: 'PROJECT_GROUP' | 'BUSINESS_LINE' | 'MIDDLE_PLATFORM'
  projectGroup?: string
  businessLine?: string
  enabledOnly?: boolean
  keyword?: string
}) {
  if (!params) {
    return undefined
  }
  return {
    ...params,
    systemScope: params.systemScope === 'PROJECT_GROUP' ? 'BUSINESS_LINE' : params.systemScope,
    businessLine: params.businessLine || params.projectGroup,
    projectGroup: undefined,
  }
}

function toInvolvedSystemPayload(request: ProjectInvolvedSystemSaveRequest) {
  return {
    ...request,
    systemScope: request.systemScope === 'PROJECT_GROUP' ? 'BUSINESS_LINE' : request.systemScope,
    businessLine: request.businessLine || request.projectGroup,
    projectGroup: undefined,
  }
}
