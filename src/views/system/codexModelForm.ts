import type { CodexModelCatalog, CodexModelCatalogRequest, CodexModelOption } from '../../types/ai-config'

export interface CodexCatalogState {
  catalog: CodexModelCatalog | null
  loading: boolean
  error: string
}

interface CliSelection {
  cliType?: string
  cliRuntimeCommand?: string
  cliBuiltinConfigPath?: string
  cliPersonalConfigPath?: string
  id: number | null
  enabled: boolean
  cliCommand: string
  cliWorkingDirectory: string
  defaultModel: string
  defaultReasoningLevel: string
}

// 只兼容旧字典编码；新目录编码不做大小写或语义转换。
export function matchingEffort(model: CodexModelOption | undefined, value: string): string | undefined {
  const exact = model?.supportedReasoningEfforts.find(item => item.reasoningEffort === value)
  if (exact) return exact.reasoningEffort
  if (!['NONE', 'LOW', 'MEDIUM', 'HIGH', 'XHIGH', 'MAX', 'ULTRA'].includes(value)) return undefined
  return model?.supportedReasoningEfforts.find(item => item.reasoningEffort === value.toLowerCase())?.reasoningEffort
}

export function reasoningAfterModelChange(model: CodexModelOption, previous: string): string {
  return matchingEffort(model, previous) ?? model.defaultReasoningEffort
}

export function validateCliSelection(current: CliSelection, original: CliSelection | null,
  catalog: CodexModelCatalog | null): string {
  if (!current.enabled) return ''
  if (original?.id && original.enabled && current.id === original.id
    && current.cliCommand === original.cliCommand && current.cliWorkingDirectory === original.cliWorkingDirectory
    && current.cliType === original.cliType && current.cliRuntimeCommand === original.cliRuntimeCommand
    && current.cliBuiltinConfigPath === original.cliBuiltinConfigPath && current.cliPersonalConfigPath === original.cliPersonalConfigPath
    && current.defaultModel === original.defaultModel && current.defaultReasoningLevel === original.defaultReasoningLevel) return ''
  if (!catalog) return '请先成功加载 CLI 模型列表，再保存 CLI 配置'
  const model = catalog.models.find(item => item.model === current.defaultModel)
  if (!model || !matchingEffort(model, current.defaultReasoningLevel)) return '请选择当前 CLI 支持的模型和推理强度'
  return ''
}

export function createCodexCatalogLoader<T extends CodexModelCatalogRequest>(state: CodexCatalogState,
  fetchCatalog: (request: T) => Promise<CodexModelCatalog>,
  formatError: (error: unknown) => string) {
  let revision = 0
  function invalidate() {
    revision += 1
    state.catalog = null
    state.loading = false
    state.error = ''
  }
  async function load(request: T) {
    invalidate()
    const current = revision
    state.loading = true
    try {
      const catalog = await fetchCatalog(request)
      if (current === revision) state.catalog = catalog
    } catch (error) {
      if (current === revision) state.error = formatError(error)
    } finally {
      if (current === revision) state.loading = false
    }
  }
  return { invalidate, load }
}
