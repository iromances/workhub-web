import {
  resolveDevelopmentProjectGroupCandidate,
  shouldIgnoreDevelopmentSystemOptionsError,
  shouldReloadDevelopmentDraftAfterSaveError,
} from './intakeProjectGroupErrors'

const missingBusinessLineError = {
  response: {
    data: {
      message: '业务线不存在',
    },
  },
}

assert(
  shouldIgnoreDevelopmentSystemOptionsError(missingBusinessLineError),
  '业务线不存在时，加载研发涉及系统清单应允许兜底为空列表',
)

const missingBusinessLineParameterError = {
  response: {
    data: {
      message: '业务线不能为空',
    },
  },
}

assert(
  shouldIgnoreDevelopmentSystemOptionsError(missingBusinessLineParameterError),
  '业务线为空时，加载研发涉及系统清单应允许兜底为空列表',
)

const networkError = new Error('Network Error')

assert(
  !shouldIgnoreDevelopmentSystemOptionsError(networkError),
  '网络或服务异常仍应提示加载研发涉及系统清单失败',
)

const invalidSystemTagError = {
  response: {
    data: {
      message: '涉及系统不在当前业务线或中台系统清单中：scf-payment',
    },
  },
}

assert(
  !shouldReloadDevelopmentDraftAfterSaveError(invalidSystemTagError),
  '保存失败时不应重拉服务端草稿覆盖用户当前编辑',
)

assert(
  resolveDevelopmentProjectGroupCandidate({
    draftProjectGroup: '',
    stageProjectGroup: '',
    rowProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailBusinessLineCode: 'BL000003',
    detailBusinessLine: '嘉泰资产平台',
  }) === 'BL000003',
  '研发任务业务线候选应优先使用规范业务线编码，不应从 projectHint 兜底',
)

assert(
  resolveDevelopmentProjectGroupCandidate({
    draftProjectGroup: '',
    stageProjectGroup: '',
    rowProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailBusinessLineCode: '',
    detailBusinessLine: '嘉泰资产平台',
  }) === '嘉泰资产平台',
  '没有业务线编码时应使用业务线名称',
)

assert(
  resolveDevelopmentProjectGroupCandidate({
    draftProjectGroup: '',
    stageProjectGroup: '',
    rowProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailProjectHint: '嘉泰资产平台；消费分期业务系统（信易通平台）；先行通资产平台',
    detailBusinessLineCode: '',
    detailBusinessLine: '',
  }) === '',
  '缺少规范业务线时不应把 projectHint 当业务线传给后端',
)

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}
