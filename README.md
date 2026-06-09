# WorkHub Web

WorkHub 前端仓库，承载项目管理、需求登记、迭代/版本规划、企微收件箱、工作项全生命周期跟踪、支付接入配置管理等界面能力。

当前阶段先沉淀项目边界与实施基线，后续开发默认遵循以下文档：

- `docs/project-charter.md`
- `docs/frontend-architecture.md`
- `docs/implementation-roadmap.md`

前端职责边界：

- 本地账号密码登录
- 项目、迭代、版本、工作项、跟踪记录管理界面
- 企微待整理箱与人工整理录入界面
- AI 整理结果确认界面
- 状态流转、指派、提醒、查询与看板

当前技术方向：

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Element Plus
- Axios

当前已落地的最小可运行骨架：

- 登录页
- 主布局
- 工作台
- 项目管理页
- 工作项页
- 待整理箱页
- 支付配置页
- 业务监测页
- 系统预警页
- MCP 页
- 基础路由守卫
- Axios 请求层

## 启动方式

```bash
npm install
npm run dev
```

默认前端地址：

- `http://127.0.0.1:9529`

默认后端 API 地址：

- `http://127.0.0.1:8080/api`

默认演示账号：

- 用户名：`admin`
- 密码：`admin123`

注意：

- 未经文档更新，不新增“绕过待整理箱直接自动建正式需求”的能力。
- 未经文档更新，不引入前端直连第三方能力，统一走后端 API。
- UI 和交互以可维护、可追踪、面向后台运营为优先，不追求展示型页面。
