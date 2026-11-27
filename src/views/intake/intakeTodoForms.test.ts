import type { IntakeAttachment } from '../../types/work-item'
import {
  buildIntakeTodoPath,
  buildIntakeTodoScreenshotsPath,
  buildIntakeTodoStatusPath,
  buildIntakeTodosPath,
} from '../../api/intakeTodoPaths'
import {
  countActiveIntakeTodos,
  formatActiveTodoLabel,
  formatTodoTabLabel,
  pickPastedTodoScreenshots,
  pickTodoScreenshotFiles,
  resolveTodoScreenshotChange,
  splitTodoScreenshots,
  validateIntakeTodoEditableForm,
  validateIntakeTodoStatusForm,
} from './intakeTodoForms'

assert(buildIntakeTodosPath(9) === '/intake/9/todos', '待办列表和新增路径应包含需求 ID')
assert(buildIntakeTodoPath(9, 101) === '/intake/9/todos/101', '待办编辑路径应包含需求 ID 和待办 ID')
assert(buildIntakeTodoPath(9, 101) === '/intake/9/todos/101', '待办删除路径应复用单条待办路径')
assert(buildIntakeTodoStatusPath(9, 101) === '/intake/9/todos/101/status', '待办状态路径应追加 status')
assert(buildIntakeTodoScreenshotsPath(9, 101) === '/intake/9/todos/101/screenshots', '待办截图路径应追加 screenshots')

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

function fakeFile(name: string, type: string) {
  return { name, type } as File
}

const picked = pickTodoScreenshotFiles([
  fakeFile('error.png', 'image/png'),
  fakeFile('notes.pdf', 'application/pdf'),
  fakeFile('scene.jpeg', 'image/jpeg'),
])
assert(picked.files.length === 2 && picked.ignored === 1, '待办截图只接收图片，并统计被忽略的非图片数量')

function clipboard(text: string, ...types: string[]) {
  return {
    getData: () => text,
    items: types.map((type) => ({ kind: 'file', type, getAsFile: () => fakeFile('image', type) })),
  }
}

assert(pickPastedTodoScreenshots(clipboard('', 'image/png', 'image/jpeg')).length === 2, '剪贴板只有图片时全部接收为截图')
assert(pickPastedTodoScreenshots(clipboard('说明文字', 'image/png')).length === 0, '剪贴板带文本时不截取图片，交给输入框正常粘贴')
assert(pickPastedTodoScreenshots(clipboard('')).length === 0, '剪贴板没有图片时不产生截图')
assert(pickPastedTodoScreenshots(null).length === 0, '没有剪贴板数据时不产生截图')

const change = resolveTodoScreenshotChange(
  [{ id: 1 }, { id: 2 }, { id: 3 }],
  [2, 3],
  [fakeFile('new.png', 'image/png')],
)
assert(
  change.removedIds.length === 1 && change.removedIds[0] === 1 && change.files.length === 1,
  '编辑待办时只删除弹框中移除的截图，并保留新增文件',
)
assert(
  resolveTodoScreenshotChange([{ id: 1 }], [1], []).removedIds.length === 0,
  '已有截图全部保留时不产生删除',
)

const shot = (id: number): IntakeAttachment => ({
  id,
  category: '截图',
  fileName: `截图${id}.png`,
  contentType: 'image/png',
  downloadUrl: `/api/attachments/${id}/download`,
  previewable: true,
  createdAt: '2026-06-04T10:00:00',
})
const shots = (count: number) => Array.from({ length: count }, (_, index) => shot(index + 1))
assert(splitTodoScreenshots(shots(0)).visible.length === 0, '没有截图时不展示缩略图')
const splitFour = splitTodoScreenshots(shots(4))
assert(splitFour.visible.length === 4 && splitFour.hiddenCount === 0, '不超过 4 张时全部展示且不出现「+N」')
const splitSix = splitTodoScreenshots(shots(6))
assert(
  splitSix.visible.length === 3 && splitSix.hiddenCount === 3 && splitSix.visible[2].id === 3,
  '超过 4 张时展示前 3 张，「+N」收起其余数量',
)
assert(splitTodoScreenshots(shots(5)).hiddenCount === 2, '刚好超出 1 张时同样收起到「+N」')

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}
