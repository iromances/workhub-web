import {
  buildIntakeTodoPath,
  buildIntakeTodoStatusPath,
  buildIntakeTodosPath,
} from '../../api/intakeTodoPaths'
import {
  countActiveIntakeTodos,
  formatActiveTodoLabel,
  formatTodoTabLabel,
  validateIntakeTodoEditableForm,
  validateIntakeTodoStatusForm,
} from './intakeTodoForms'

assert(buildIntakeTodosPath(9) === '/intake/9/todos', '待办列表和新增路径应包含需求 ID')
assert(buildIntakeTodoPath(9, 101) === '/intake/9/todos/101', '待办编辑路径应包含需求 ID 和待办 ID')
assert(buildIntakeTodoPath(9, 101) === '/intake/9/todos/101', '待办删除路径应复用单条待办路径')
assert(buildIntakeTodoStatusPath(9, 101) === '/intake/9/todos/101/status', '待办状态路径应追加 status')

assert(
  validateIntakeTodoEditableForm({ title: '  ', content: '', assigneeUserName: '', plannedAt: '' }) === '待办标题不能为空',
  '新增或编辑待办时标题必填',
)

assert(
  validateIntakeTodoEditableForm({ title: '确认方案', content: '', assigneeUserName: '', plannedAt: '' }) === '',
  '标题有效时待办编辑表单应通过校验',
)

assert(
  validateIntakeTodoStatusForm({ status: '', processResult: '', completedAt: '' }) === '待办状态不能为空',
  '状态更新时状态必填',
)

assert(
  validateIntakeTodoStatusForm({ status: '已完成', processResult: '  ', completedAt: '' }) === '待办完成时必须填写处理结果',
  '完成待办时处理结果必填',
)

assert(
  validateIntakeTodoStatusForm({ status: '已完成', processResult: '已同步给研发', completedAt: '' }) === '',
  '完成待办且填写处理结果时应通过校验',
)

assert(
  countActiveIntakeTodos([{ status: '待处理' }, { status: '处理中' }, { status: '已完成' }, { status: '已取消' }]) === 2,
  '仅待处理和处理中算未完成待办',
)

assert(formatActiveTodoLabel(2) === '待办 2', '待办标签应显示数量')
assert(formatTodoTabLabel(2) === '需求待办 2', '详情 Tab 应显示未完成待办数量')
assert(formatTodoTabLabel(0) === '需求待办', '没有未完成待办时 Tab 不显示数量')

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}
