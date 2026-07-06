<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createSystemConfig,
  fetchSystemConfigs,
  updateSystemConfig,
} from '@/api/system-config'
import { useAuthStore } from '@/stores/auth'
import type { SysConfigItem } from '@/types/work-item'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const configs = ref<SysConfigItem[]>([])
const filters = reactive({
  configGroup: '',
  keyword: '',
})
const form = reactive({
  configGroup: 'gitlab.',
  configKey: 'repoUrl',
  configName: '',
  valueType: 'TEXT',
  value: '',
  enabled: true,
  remark: '',
})
const canCreate = computed(() => authStore.hasAnyPermission(['system:config:create', 'system:config:manage']))
const canUpdate = computed(() => authStore.hasAnyPermission(['system:config:update', 'system:config:manage']))

async function loadConfigs() {
  loading.value = true
  try {
    configs.value = await fetchSystemConfigs({
      configGroup: filters.configGroup || undefined,
      keyword: filters.keyword || undefined,
    })
  } catch (error) {
    ElMessage.error('加载系统配置失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.configGroup = 'gitlab.'
  form.configKey = 'repoUrl'
  form.configName = ''
  form.valueType = 'TEXT'
  form.value = ''
  form.enabled = true
  form.remark = ''
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: SysConfigItem) {
  editingId.value = row.id
  form.configGroup = row.configGroup
  form.configKey = row.configKey
  form.configName = row.configName
  form.valueType = row.valueType
  form.value = ''
  form.enabled = row.enabled
  form.remark = row.remark || ''
  dialogVisible.value = true
}

async function submit() {
  if (!form.configGroup.trim() || !form.configKey.trim() || !form.configName.trim()) {
    ElMessage.warning('请填写配置分组、配置键和配置名称')
    return
  }
  submitting.value = true
  try {
    const request = {
      configGroup: form.configGroup.trim(),
      configKey: form.configKey.trim(),
      configName: form.configName.trim(),
      valueType: form.valueType,
      value: form.value.trim() || undefined,
      enabled: form.enabled,
      remark: form.remark.trim() || undefined,
    }
    if (editingId.value) {
      await updateSystemConfig(editingId.value, request)
    } else {
      await createSystemConfig(request)
    }
    ElMessage.success('系统配置已保存')
    dialogVisible.value = false
    await loadConfigs()
  } catch (error) {
    ElMessage.error('保存系统配置失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

onMounted(loadConfigs)
</script>

<template>
  <div class="page-card table-card">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统配置</h1>
        <p class="page-desc">配置 GitLab 仓库地址、Access Token 等系统参数；敏感值只脱敏展示。</p>
      </div>
      <el-button v-if="canCreate" type="primary" @click="openCreate">新增配置</el-button>
    </div>

    <el-alert
      type="info"
      show-icon
      :closable="false"
      title="GitLab 配置约定：configGroup 使用 gitlab.业务线；configKey 使用 repoUrl 和 accessToken。accessToken 的 valueType 请选择 SECRET。"
    />

    <el-form inline class="filter-form" @submit.prevent="loadConfigs">
      <el-form-item label="配置分组">
        <el-input
          v-model="filters.configGroup"
          placeholder="配置分组，例如 gitlab.供应链科技"
          clearable
          @keyup.enter="loadConfigs"
        />
      </el-form-item>
      <el-form-item label="关键字">
        <el-input
          v-model="filters.keyword"
          placeholder="配置键 / 名称"
          clearable
          @keyup.enter="loadConfigs"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadConfigs">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="configs">
      <el-table-column prop="configGroup" label="配置分组" width="180" />
      <el-table-column prop="configKey" label="配置键" width="160" />
      <el-table-column prop="configName" label="配置名称" width="180" />
      <el-table-column prop="valueType" label="类型" width="100" />
      <el-table-column prop="value" label="配置值" min-width="260" show-overflow-tooltip />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" title="系统配置" width="620px">
    <el-form label-position="top">
      <el-form-item label="配置分组">
        <el-input v-model="form.configGroup" placeholder="例如 gitlab.供应链科技" />
      </el-form-item>
      <el-form-item label="配置键">
        <el-input v-model="form.configKey" placeholder="例如 repoUrl / accessToken" />
      </el-form-item>
      <el-form-item label="配置名称">
        <el-input v-model="form.configName" />
      </el-form-item>
      <el-form-item label="值类型">
        <el-select v-model="form.valueType" style="width: 100%">
          <el-option label="普通文本" value="TEXT" />
          <el-option label="敏感值" value="SECRET" />
        </el-select>
      </el-form-item>
      <el-form-item label="配置值">
        <el-input v-model="form.value" :placeholder="editingId && form.valueType === 'SECRET' ? '留空则保持原敏感值不变' : '请输入配置值'" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="是否启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-dialog>

</template>

<style scoped>
.table-card {
  padding: 24px;
}

.filter-form {
  margin-top: 16px;
}

</style>
