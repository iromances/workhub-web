import { resolveDevelopmentProjectGroupCandidate, shouldReloadDevelopmentDraftAfterSaveError } from './intakeProjectGroupErrors'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

for (const draftProjectGroup of ['优利卡货车驻车电池项目', '叶丽慧的系统开发_3.0', 'BL000001']) {
  const source = { draftProjectGroup, stageProjectGroup: 'BL000002', detailBusinessLineCode: 'BL000003', detailBusinessLine: '嘉泰消费分期' }
  assert(resolveDevelopmentProjectGroupCandidate(source) === 'BL000003', '草稿和表单不得覆盖需求业务线')
  assert(resolveDevelopmentProjectGroupCandidate({ ...source, detailBusinessLineCode: '', detailBusinessLine: '' }) === '', '需求无业务线时不得回退到草稿或表单')
}
assert(resolveDevelopmentProjectGroupCandidate({ rowBusinessLineCode: 'BL000005', detailBusinessLine: '旧名称' }) === 'BL000005', '列表编码优先于名称')
assert(resolveDevelopmentProjectGroupCandidate({ detailBusinessLine: ' 嘉泰消费分期 ' }) === '嘉泰消费分期', '兼容需求只有业务线名称')
assert(resolveDevelopmentProjectGroupCandidate({}) === '', '缺少业务线时返回空值')
assert(resolveDevelopmentProjectGroupCandidate({ detailBusinessLineCode: 'undefined', rowBusinessLine: '无' }) === '', '忽略无效占位符')
assert(resolveDevelopmentProjectGroupCandidate({ detailBusinessLineCode: 'BL000005' }) === 'BL000005', '切换需求后使用新需求业务线')
assert(!shouldReloadDevelopmentDraftAfterSaveError(new Error('保存失败')), '保存失败不能覆盖当前编辑')
console.log('业务线来源回归：通过')
