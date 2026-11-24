<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchTestBindings, fetchTestDeployments, submitTestDeployment } from '@/api/test-deployment'
import { fetchIntakeRecords } from '@/api/intake'
import type { TestDeployment, TestDeploymentBinding, TestDeploymentRequest } from '@/types/test-deployment'
import type { IntakeSummary } from '@/types/work-item'
const props = defineProps<{ intakeId: number; selectionOnly?: boolean; canPublish?: boolean; environmentCode?: string }>()
const emit = defineEmits<{ change: [request: TestDeploymentRequest | null, environmentCode: string | null] }>()
const allBindings = ref<TestDeploymentBinding[]>([])
/** 提供环境编码时仅展示该环境的测试发布目标 */
const bindings = computed(() => props.environmentCode
 ? allBindings.value.filter(b => (b.environmentCode ?? '').toUpperCase() === props.environmentCode!.toUpperCase())
 : allBindings.value)
const selected = ref('')
const others = ref<number[]>([])
const candidates = ref<IntakeSummary[]>([])
const history = ref<TestDeployment[]>([])
const busy = ref(false)
const error = ref('')
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
const binding = computed(() => bindings.value.find(b => b.id === selected.value))
const request = computed<TestDeploymentRequest | null>(() => binding.value
 ? { bindingId: binding.value.id, intakeIds: [props.intakeId, ...others.value] } : null)
watch(request, value => emit('change', value, binding.value?.environmentCode ?? null), { immediate: true })
async function search(query: string) {
 const version = generation
 try {
  const page = await fetchIntakeRecords({ requirementName: query, page: 1, pageSize: 100 })
  if (version !== generation) return
  candidates.value = page.items.filter(row => row.id !== props.intakeId
   && row.businessLineCode === binding.value?.businessLineCode
   && ['开发中', '开发完成', '测试中'].includes(row.demandStatus))
 } catch (e) { if (version === generation) error.value = e instanceof Error ? e.message : '读取需求失败' }
}
function active(status: string) { return ['PENDING','PREPARING','SUBMITTING','QUEUED','RUNNING','UNKNOWN'].includes(status) }
function statusName(status: string) {
 return ({ PENDING:'待发布', PREPARING:'准备分支', SUBMITTING:'提交构建', QUEUED:'排队中', RUNNING:'构建发布中',
 SUCCESS:'流水线成功', FAILED:'失败', UNKNOWN:'待人工核实', ABORTED:'已取消', VERSION_MISMATCH:'版本不符' } as Record<string,string>)[status] ?? status
}
function reload() { clearTimeout(timer); void refresh() }
async function refresh(version = generation) {
 try {
  const rows = await fetchTestDeployments(props.intakeId)
  if (version !== generation) return
  history.value = rows
  if (rows.some(row => active(row.status) && row.status !== 'UNKNOWN'))
   timer = setTimeout(() => void refresh(version), 5000)
 } catch (e) { if (version === generation) error.value = e instanceof Error ? e.message : '读取发布记录失败' }
}
/** 环境切换或重新加载后仅在匹配绑定中重选，并清空合测需求 */
watch(bindings, list => {
 selected.value = list[0]?.id ?? ''
 others.value = []
})
watch(() => props.intakeId, async id => {
 const version = ++generation
 clearTimeout(timer); allBindings.value=[]; selected.value=''; others.value=[]; history.value=[]; error.value=''
 try {
  const values = await fetchTestBindings(id)
  if (version !== generation) return
  allBindings.value = values
  if (!props.selectionOnly) await refresh(version)
 } catch (e) { if (version === generation) error.value = e instanceof Error ? e.message : '读取测试目标失败' }
}, { immediate: true })
async function publish(previous?: TestDeployment) {
 const payload = previous ? { bindingId: previous.plan.binding.id,
  intakeIds: previous.plan.sources.map(s => s.intakeId), previousId: previous.id } : request.value
 if (!payload) return
 const target = previous?.plan.binding ?? binding.value!
 const branchText = previous ? previous.plan.branch : others.value.length ? '从 master 新建测试分支并合入所选开发分支' : '本需求开发分支'
 const currentId = props.intakeId
 const version = generation
 try {
  await ElMessageBox.confirm(`测试目标：${target.systemName} / ${target.serverAddress}。发布分支：${branchText}。Jenkins 会执行现有脚本平台步骤。`,
   previous ? '合入修复并重新发布测试' : '发布测试', { type: 'warning', confirmButtonText:'确认发布测试', cancelButtonText:'取消' })
 } catch { return }
 if (version !== generation) return
 busy.value=true
 try {
  await submitTestDeployment(currentId, payload)
  if (version !== generation) return
  ElMessage.success('已登记测试发布，正在准备分支')
  clearTimeout(timer); await refresh(version)
 } catch (e) { if (version === generation) error.value=e instanceof Error ? e.message : '提交失败' }
 finally { busy.value=false }
}
onBeforeUnmount(() => { generation++; clearTimeout(timer) })
</script>
<template>
 <section class="test-deployment-panel">
  <h4 v-if="!selectionOnly">测试发布</h4>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <el-empty v-if="!bindings.length && !error" description="当前需求尚未绑定测试发布目标" :image-size="40" />
  <template v-if="bindings.length">
   <el-form-item label="测试目标">
    <el-select v-model="selected" style="width:100%" @change="others=[]">
     <el-option v-for="b in bindings" :key="b.id" :value="b.id" :label="`${b.systemName} · ${b.environmentCode} · ${b.serverAddress}`" />
    </el-select>
   </el-form-item>
   <el-form-item label="一起测试的需求">
    <el-select v-model="others" multiple filterable remote :remote-method="search" style="width:100%" placeholder="留空只测本需求；输入名称添加合测需求">
     <el-option v-for="row in candidates" :key="row.id" :value="row.id" :label="`${row.approvalCode || row.id} · ${row.requirementName}`" />
    </el-select>
   </el-form-item>
   <p class="test-note">{{ others.length ? '新建批次会从 master 创建测试分支，再合入各需求开发分支。' : '使用本需求的远程开发分支发布测试。' }} Bug 修复仍在开发分支，使用下方“合入修复并重新发布”沿用原测试分支。</p>
   <el-button v-if="!selectionOnly && canPublish" type="primary" :loading="busy" :disabled="history.some(r => active(r.status))" @click="publish()">发布测试</el-button>
  </template>
  <template v-if="!selectionOnly">
   <el-button :disabled="busy" @click="reload">刷新发布记录</el-button>
   <div v-for="row in history" :key="row.id" class="test-release">
    <strong>{{ statusName(row.status) }}</strong> · {{ row.plan.binding.systemName }} · {{ row.createdAt }}
    <p>测试分支：{{ row.plan.branch }}</p>
    <p v-for="source in row.plan.sources" :key="source.intakeId">{{ source.name }}：{{ source.branch }} / {{ source.sha.slice(0,8) }}</p>
    <p v-if="row.plan.expectedSha">预期版本：{{ row.plan.expectedSha }} <span v-if="row.actualSha">实际版本：{{ row.actualSha }}</span></p>
    <p>{{ row.message }}</p>
    <el-link v-if="row.buildUrl" :href="row.buildUrl" target="_blank" type="primary">查看 Jenkins {{ row.buildNumber ? '#'+row.buildNumber : '队列' }}</el-link>
    <el-button v-if="canPublish && !active(row.status)" :disabled="busy || history.some(r => active(r.status))" @click="publish(row)">合入修复并重新发布</el-button>
   </div>
  </template>
 </section>
</template>
<style scoped>
.test-deployment-panel{padding:12px 0}.test-note{color:var(--el-text-color-secondary);font-size:13px;line-height:1.6}
.test-release{margin-top:12px;padding:12px;border:1px solid var(--el-border-color);border-radius:6px;overflow-wrap:anywhere}
.test-release p{margin:6px 0;font-size:13px}
</style>
