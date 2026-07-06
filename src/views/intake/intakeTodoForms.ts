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
