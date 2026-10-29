import type { IntakeProcessEditableValues } from '../../types/intakeProcessInfo'
import { buildProcessChanges, processFieldGroups } from './intakeProcessInfoForm'

const original = Object.fromEntries(processFieldGroups.flatMap((group) => group.fields.map((field) => [field.name, null]))) as unknown as IntakeProcessEditableValues
original.actualEffort = '8h'
original.releasedTime = '2026-09-18'

assertEqual(buildProcessChanges(original, { ...original }), {}, '未修改不得提交整表覆盖')
assertEqual(buildProcessChanges(original, { actualEffort: '   ', actualTestingEffort: '0h' }),
  { actualEffort: null, actualTestingEffort: '0h' }, '清空与零工时必须区分')
assertEqual(buildProcessChanges(original, { releasedTime: '2026-09-21' }),
  { releasedTime: '2026-09-21' }, '只提交指定日期，不清空缺省字段')
assertEqual(buildProcessChanges(original, { actualEffort: ' 1d ' }),
  { actualEffort: '1d' }, '保留单位供后端校验和换算')
assertEqual(buildProcessChanges(original, { ...original, totalEstimatedEffort: '999h', demandStatus: '开发中' } as IntakeProcessEditableValues),
  {}, '只读总工时和状态不能混入提交')
assertEqual(buildProcessChanges(original, { ...original }, true),
  { developmentEstimatedEffort: null, testingEstimatedEffort: null }, '只有旧总工时的记录也要显式提交清空')
assertEqual(original.actualEffort, '8h', '编辑不能修改原始冲突检测快照')
assertEqual(original.releasedTime, '2026-09-18', '原日期快照保持不变')

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}

console.log('过程信息表单：8 项检查通过')
