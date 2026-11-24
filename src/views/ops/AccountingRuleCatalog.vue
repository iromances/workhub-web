<script setup lang="ts">
import { ref } from 'vue'
import { fetchAccountingRules, type AccountingRuleFamily } from '@/api/accounting'
const props = defineProps<{ configId: number }>()
const visible = ref(false), error = ref(''), rows = ref<AccountingRuleFamily[]>([])
async function open() { visible.value = true; error.value = ''; rows.value = []; try { rows.value = await fetchAccountingRules(props.configId) } catch { error.value = '规则目录读取失败' } }
</script>
<template>
  <el-button link type="primary" @click="open">查看规则与 SQL</el-button>
  <el-dialog v-model="visible" title="业务监测规则目录" width="900px" append-to-body>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <article v-for="family in rows" :key="family.code"><h3>{{ family.name }} · {{ family.checks.length }} 条规则</h3>
      <p>{{ family.sqlCodes.join('、') }}</p><ul><li v-for="rule in family.checks" :key="rule.id">{{ rule.name }}（{{ rule.id }}）</li></ul></article>
  </el-dialog>
</template>
<style scoped>p{overflow-wrap:anywhere;color:#64748b}article{border-top:1px solid #e2e8f0;margin-top:20px}</style>
