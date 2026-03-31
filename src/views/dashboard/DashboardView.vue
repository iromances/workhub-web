<script setup lang="ts">
const cards = [
  { label: '待整理事项', value: 12, note: '企微与人工录入统一进入待整理箱' },
  { label: '进行中工作项', value: 27, note: '跨项目集中查看当前推进项' },
  { label: '本周待发布', value: 4, note: '版本和工作项保持一致' },
  { label: '已挂起/阻塞', value: 3, note: '优先清理影响排期的阻塞项' },
]
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">工作台</h1>
        <p class="page-desc">当前脚手架阶段先提供核心导航和业务分区，后续接入真实接口和看板数据。</p>
      </div>
      <el-button type="primary">新建工作项</el-button>
    </div>

    <el-row :gutter="18">
      <el-col v-for="card in cards" :key="card.label" :span="6">
        <div class="page-card metric-card">
          <div class="metric-label">{{ card.label }}</div>
          <div class="metric-value">{{ card.value }}</div>
          <div class="metric-note">{{ card.note }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="18" class="dashboard-section">
      <el-col :span="14">
        <div class="page-card content-card">
          <h3>阶段性实施基线</h3>
          <el-timeline>
            <el-timeline-item timestamp="M1">初始化工程与登录体系</el-timeline-item>
            <el-timeline-item timestamp="M2">项目、迭代、版本、工作项主流程</el-timeline-item>
            <el-timeline-item timestamp="M3">企微待整理箱与人工整理</el-timeline-item>
            <el-timeline-item timestamp="M4">AI 整理建议与通知增强</el-timeline-item>
          </el-timeline>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="page-card content-card">
          <h3>核心规则</h3>
          <ul class="rule-list">
            <li>每个工作项必须归属项目。</li>
            <li>企微和人工录入内容先进入待整理箱。</li>
            <li>AI 只生成草稿，不直接写正式工作项。</li>
            <li>状态变更、指派、转版本都走动作接口。</li>
          </ul>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.metric-card,
.content-card {
  padding: 24px;
}

.metric-label {
  color: #64748b;
  font-size: 14px;
}

.metric-value {
  margin-top: 10px;
  font-size: 40px;
  font-weight: 800;
  color: #0f172a;
}

.metric-note {
  margin-top: 12px;
  color: #475569;
  line-height: 1.6;
}

.dashboard-section {
  margin-top: 18px;
}

h3 {
  margin-top: 0;
}

.rule-list {
  margin: 0;
  padding-left: 20px;
  color: #334155;
  line-height: 1.9;
}
</style>
