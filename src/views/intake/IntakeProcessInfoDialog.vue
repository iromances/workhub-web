<script setup lang="ts">
import { isAxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'

import { fetchIntakeProcessInfo, updateIntakeProcessInfo } from '@/api/intakeProcessInfo'
import type { IntakeProcessInfo, IntakeProcessEditableValues } from '@/types/intakeProcessInfo'
import { buildProcessChanges, processFieldGroups } from './intakeProcessInfoForm'

const emit = defineEmits<{ saved: [id: number] }>()
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const clearEstimatesRequested = ref(false)
const intakeId = ref<number | null>(null)
const original = ref<IntakeProcessInfo | null>(null)
const form = reactive<Partial<IntakeProcessEditableValues>>({})
let requestToken = 0

async function open(id: number) {
  const token = ++requestToken
  intakeId.value = id
  original.value = null
  clearEstimatesRequested.value = false
  Object.keys(form).forEach((key) => delete form[key as keyof IntakeProcessEditableValues])
  errorMessage.value = ''
  visible.value = true
  loading.value = true
  try {
    const info = await fetchIntakeProcessInfo(id)
    if (token !== requestToken) return
    original.value = info
    for (const group of processFieldGroups) {
      for (const field of group.fields) form[field.name] = info.values[field.name]
    }
  } catch (error) {
    if (token === requestToken) errorMessage.value = message(error, '加载过程信息失败，请重新打开后重试')
  } finally {
    if (token === requestToken) loading.value = false
  }
}

async function save() {
  if (!original.value || intakeId.value === null || saving.value) return
  const id = intakeId.value
  saving.value = true
  errorMessage.value = ''
  try {
    await updateIntakeProcessInfo(id, {
      original: original.value,
      changes: buildProcessChanges(original.value.values, form, clearEstimatesRequested.value),
    })
    ElMessage.success('过程信息已保存')
    visible.value = false
    emit('saved', id)
  } catch (error) {
    errorMessage.value = message(error, '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

function clearEstimates() {
  form.developmentEstimatedEffort = null
  form.testingEstimatedEffort = null
  clearEstimatesRequested.value = true
}

function message(error: unknown, fallback: string) {
  return isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message : fallback
}

defineExpose({ open })
</script>

<template>
  <el-dialog v-model="visible" title="编辑过程信息" width="760px" :close-on-click-modal="false"
    :close-on-press-escape="!saving" :show-close="!saving" @closed="requestToken++">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="process-error" />
    <el-skeleton :loading="loading" animated :rows="8">
      <el-form v-if="original" label-position="top" :disabled="saving">
        <section v-for="group in processFieldGroups" :key="group.title" class="process-group">
          <h3>{{ group.title }}</h3>
          <div class="process-grid">
            <el-form-item v-for="field in group.fields" :key="field.name" :label="field.label">
              <el-date-picker v-if="field.date" v-model="form[field.name]" type="date"
                value-format="YYYY-MM-DD" format="YYYY-MM-DD" clearable placeholder="未填写" style="width: 100%" />
              <el-input v-else v-model="form[field.name]" clearable placeholder="例如 8h 或 1d" />
            </el-form-item>
          </div>
        </section>
        <div class="process-total">
          当前总预估工时：<strong>{{ original.values.totalEstimatedEffort || '未填写' }}</strong>
          <el-tag v-if="original.estimatedEffortOverridden" size="small" type="info">已人工调整</el-tag>
          <el-button link type="primary" :disabled="saving" @click="clearEstimates">清空预估</el-button>
          <p>总预估工时在保存后按开发和测试预估合计。1 天按 8 小时计算。清空表示未填写。</p>
        </div>
      </el-form>
    </el-skeleton>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="loading || !original" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.process-error { margin-bottom: 16px; }
.process-group h3 { margin: 12px 0; font-size: 14px; }
.process-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
.process-total { padding: 12px; background: var(--el-fill-color-light); border-radius: 6px; }
.process-total .el-tag { margin-left: 8px; }
.process-total p { margin: 8px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
@media (max-width: 600px) { .process-grid { grid-template-columns: 1fr; } }
</style>
