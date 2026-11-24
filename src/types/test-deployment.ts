export interface TestDeploymentRequest { bindingId: string; intakeIds: number[]; previousId?: string }
export interface TestDeploymentBinding {
 id: string; businessLineCode: string; systemName: string; environmentCode: string;
 jobName: string; deployTarget: string; serverAddress: string; publicBranch: string;
}
export interface TestDeployment {
 id: string; intakeId: number; status: string; buildNumber: number | null; buildUrl: string | null;
 actualSha: string | null; message: string | null; createdAt: string;
 plan: { binding: TestDeploymentBinding; branch: string; expectedSha: string | null;
 sources: { intakeId: number; name: string; branch: string; sha: string }[] };
}
