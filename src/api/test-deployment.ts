import http from './http'
import type { ApiResponse } from '@/types/http'
import type { TestDeployment, TestDeploymentBinding, TestDeploymentRequest } from '@/types/test-deployment'
export async function fetchTestBindings(id: number) {
 return (await http.get<ApiResponse<TestDeploymentBinding[]>>(`/intake/${id}/test-deployments/bindings`)).data.data
}
export async function fetchTestDeployments(id: number) {
 return (await http.get<ApiResponse<TestDeployment[]>>(`/intake/${id}/test-deployments`)).data.data
}
export async function submitTestDeployment(id: number, request: TestDeploymentRequest) {
 return (await http.post<ApiResponse<TestDeployment>>(`/intake/${id}/test-deployments`, request)).data.data
}
