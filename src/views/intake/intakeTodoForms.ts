import type { IntakeAttachment } from '../../types/work-item'

export interface IntakeTodoEditableForm {
  title: string
  content: string
  assigneeUserName: string
  plannedAt: string
}

export interface IntakeTodoStatusForm {
  status: string
  processResult: string
  completedAt: string
}

export interface IntakeTodoStatusLike {
  status: string | null | undefined
}

const activeTodoStatuses = new Set(['待处理', '处理中'])

export function validateIntakeTodoEditableForm(form: IntakeTodoEditableForm) {
  if (!form.title.trim()) {
    return '待办标题不能为空'
  }
  return ''
}

export function validateIntakeTodoStatusForm(form: IntakeTodoStatusForm) {
  if (!form.status.trim()) {
    return '待办状态不能为空'
  }
  if (form.status === '已完成' && !form.processResult.trim()) {
    return '待办完成时必须填写处理结果'
  }
  return ''
}

export function isActiveIntakeTodoStatus(status: string | null | undefined) {
  return activeTodoStatuses.has(status || '')
}

export function countActiveIntakeTodos(todos: IntakeTodoStatusLike[]) {
  return todos.filter((todo) => isActiveIntakeTodoStatus(todo.status)).length
}

export function formatActiveTodoLabel(count: number | null | undefined) {
  return `待办 ${Math.max(count || 0, 0)}`
}

export function formatTodoTabLabel(count: number | null | undefined) {
  const normalized = Math.max(count || 0, 0)
  return normalized > 0 ? `需求待办 ${normalized}` : '需求待办'
}

export interface IntakeTodoScreenshotLike {
  id: number
}

interface TodoScreenshotClipboardItem {
  kind: string
  type: string
  getAsFile: () => File | null
}

interface TodoScreenshotClipboard {
  items: ArrayLike<TodoScreenshotClipboardItem>
  getData: (format: string) => string
}

/** 列表里每条待办的截图区最多排 4 格；超出时留最后一格给「+N」，保证不换行。 */
export const todoScreenshotThumbLimit = 4

/** 拆出列表直接展示的截图和被收起的数量。 */
export function splitTodoScreenshots(screenshots: IntakeAttachment[]) {
  const overflow = screenshots.length > todoScreenshotThumbLimit
  const visible = screenshots.slice(0, overflow ? todoScreenshotThumbLimit - 1 : todoScreenshotThumbLimit)
  return { visible, hiddenCount: screenshots.length - visible.length }
}

/** 待办截图只收图片；返回可接收的文件和被忽略的非图片数量。 */
export function pickTodoScreenshotFiles(files: File[]) {
  const images = files.filter((file) => file.type.startsWith('image/'))
  return { files: images, ignored: files.length - images.length }
}

/** 剪贴板带文本时按正常文本粘贴处理，不截取其中的图片。 */
export function pickPastedTodoScreenshots(clipboard: TodoScreenshotClipboard | null | undefined) {
  if (!clipboard || clipboard.getData('text/plain')) {
    return []
  }
  return Array.from(clipboard.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

/** 对比待办已有截图与弹框中保留的截图，得到要提交的删除与新增。 */
export function resolveTodoScreenshotChange(
  existing: IntakeTodoScreenshotLike[],
  keptIds: number[],
  newFiles: File[],
) {
  const kept = new Set(keptIds)
  return {
    removedIds: existing.map((item) => item.id).filter((id) => !kept.has(id)),
    files: newFiles,
  }
}
