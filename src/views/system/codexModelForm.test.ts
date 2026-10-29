import type { CodexModelCatalog } from '../../types/ai-config'
import { createCodexCatalogLoader, matchingEffort, reasoningAfterModelChange, validateCliSelection, type CodexCatalogState } from './codexModelForm'

let checks = 0
function equal(actual: unknown, expected: unknown, message: string) {
  checks += 1
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)}`)
}
const model = { model: 'CaseModel', displayName: 'Model', isDefault: true, defaultReasoningEffort: 'ultra',
  supportedReasoningEfforts: [{ reasoningEffort: 'minimal', description: '' }, { reasoningEffort: 'ultra', description: '' },
    { reasoningEffort: 'futureEffort', description: '' }] }
const catalog: CodexModelCatalog = { models: [model], fetchedAt: '2026-09-23T00:00:00Z', cached: false }
const saved = { id: 1, enabled: true, cliCommand: 'codex', cliWorkingDirectory: '/repo', defaultModel: 'old-model', defaultReasoningLevel: 'HIGH' }

equal(matchingEffort(model, 'ULTRA'), 'ultra', '历史 ULTRA 仅匹配 ultra')
equal(matchingEffort({ ...model, supportedReasoningEfforts: [{ reasoningEffort: 'xhigh', description: '' }] }, 'ULTRA'), undefined, '禁止 ULTRA 匹配 xhigh')
equal(matchingEffort(model, 'futureEffort'), 'futureEffort', '新强度原值匹配')
equal(reasoningAfterModelChange(model, 'minimal'), 'minimal', '切换模型保留支持的强度')
equal(reasoningAfterModelChange(model, 'high'), 'ultra', '不支持的强度切换至模型默认值')
equal(validateCliSelection(saved, saved, null), '', '查询失败允许原配置保存其他字段')
equal(validateCliSelection(saved, saved, catalog), '', '下架历史配置不自动清空')
equal(!!validateCliSelection({ ...saved, cliWorkingDirectory: '/other' }, saved, null), true, '环境改变必须重新查询')
equal(!!validateCliSelection({ ...saved, id: null }, null, null), true, '新建未查询不能保存')
equal(validateCliSelection({ ...saved, enabled: false }, null, null), '', '禁用 CLI 不阻塞 API 保存')
equal(validateCliSelection({ ...saved, defaultModel: 'CaseModel', defaultReasoningLevel: 'futureEffort' }, saved, catalog), '', '允许有效的新组合')
equal(!!validateCliSelection({ ...saved, defaultModel: 'CaseModel', defaultReasoningLevel: 'high' }, saved, catalog), true, '阻止无效组合')

async function testLoading() {
  const state: CodexCatalogState = { catalog: null, loading: false, error: '' }
  const completions: Array<{ resolve: (value: CodexModelCatalog) => void; reject: (error: Error) => void }> = []
  const loader = createCodexCatalogLoader(state, () => new Promise((resolve, reject) => completions.push({ resolve, reject })),
    error => (error as Error).message)
  const first = loader.load({ cliCommand: 'codex', cliWorkingDirectory: '/a' })
  equal(state.loading, true, '加载状态')
  loader.invalidate() // 输入命令/目录变更或关闭弹框。
  const second = loader.load({ cliCommand: 'codex', cliWorkingDirectory: '/b' })
  completions[0]!.resolve({ ...catalog, fetchedAt: 'old' })
  await first
  equal(state.catalog, null, '旧请求结果不能覆盖新环境')
  equal(state.loading, true, '旧请求结束不能关闭新请求加载状态')
  completions[1]!.resolve(catalog)
  await second
  equal(state.catalog, catalog, '新请求生效且保留编码')
  equal(state.loading, false, '加载完成')
  const failed = loader.load({ cliCommand: 'codex', forceRefresh: true })
  completions[2]!.reject(new Error('查询超时'))
  await failed
  equal(state.error, '查询超时', '展示失败原因')
  equal(state.catalog, null, '失败不冒充缓存成功')
  const retry = loader.load({ cliCommand: 'codex', forceRefresh: true })
  completions[3]!.resolve(catalog)
  await retry
  equal(state.error, '', '重试成功清除错误')
  const closing = loader.load({ cliCommand: 'codex' })
  loader.invalidate()
  completions[4]!.reject(new Error('过期失败'))
  await closing
  equal(state.error, '', '关闭弹框后的错误不影响新状态')
  equal(saved.defaultReasoningLevel, 'HIGH', '加载不改变历史配置')
  console.log(`Codex 模型表单：${checks} 项检查通过`)
}
void testLoading()
