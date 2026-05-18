# TODO: Issue #60 号池管理 UI 与状态维护

> 创建日期：2026-05-18
> 基于 PRD v0.2：`docs/PRD/2026-05-18-Issue60-号池管理UI与状态维护PRD.md`
> 基于 FD v0.1：`docs/FD/2026-05-18-Issue60-号池管理UI与状态维护FD.md`
> 基于 TD v0.1：`docs/TD/2026-05-18-Issue60-号池管理UI与状态维护TD.md`
> 基于 TDD v0.1：`docs/TDD/2026-05-18-Issue60-号池管理UI与状态维护TDD.md`
> 目标版本：待定

> 会话约束（必须保持）：
> 1. 默认不启动服务，不额外跑测试
> 2. 每次推进都同步更新 `WORKSPACE.md`
> 3. 对用户的结果反馈统一通过 `寸止` MCP，不只落文档

---

## 任务概览

| 阶段 | 任务数 | 状态 |
|---|---:|---|
| Phase 0: 文档闭环与范围冻结 | 4 | ✅ 已完成 |
| Phase 1: 内部查询接口 MVP | 4 | ⏳ 待开发 |
| Phase 2: 单账号管理动作 MVP | 5 | ⏳ 待开发 |
| Phase 3: 前端号池管理页 MVP | 5 | ⏳ 待开发 |
| Phase 4: 增强项（强制释放 / 审计 / 最近流转） | 4 | ⏳ 待开发 |
| Phase 5: 测试与验收 | 5 | ⏳ 待开发 |

---

## Phase 0: 文档闭环与范围冻结

### Task 0.1：冻结最低必须需求

- [x] 明确最低必须是：池内/池外可见、移入、移出、`claimed` 保护
- [x] 不把需求泛化成完整运营后台

### Task 0.2：冻结增强项

- [x] 强制释放列为增强项
- [x] 审计列为增强项
- [x] 最近流转展示列为增强项

### Task 0.3：冻结暂不建议项

- [x] 不做强制完成
- [x] 不做“过期回收”人工按钮
- [x] 不做复杂批量策略

### Task 0.4：补齐文档链路

- [x] PRD 已完成
- [x] FD 已完成
- [x] TD 已完成
- [x] TDD 已完成
- [x] TODO 已完成

---

## Phase 1: 内部查询接口 MVP

### Task 1.1：新增内部号池管理查询路由

**建议文件**：
- `outlook_web/routes/pool_admin.py`
- `outlook_web/controllers/pool_admin.py`

- [ ] 新增 `GET /api/pool-admin/accounts`
- [ ] 仅允许登录态管理员访问

### Task 1.2：实现分页查询

**建议文件**：`outlook_web/repositories/pool_admin.py`

- [ ] 支持池内 / 池外筛选
- [ ] 支持按 `pool_status` 筛选
- [ ] 支持 provider / group / search
- [ ] 返回分页结构

### Task 1.3：补齐返回字段

- [ ] 返回 `pool_status`
- [ ] 返回 `claimed_by / claimed_at / lease_expires_at`
- [ ] 返回 `last_result / last_result_detail`

### Task 1.4：保持现有账号列表接口不被污染

- [ ] 不强行把全部号池管理参数塞进 `GET /api/accounts`

---

## Phase 2: 单账号管理动作 MVP

### Task 2.1：定义动作枚举

- [ ] `move_into_pool`
- [ ] `move_out_of_pool`
- [ ] `restore_available`
- [ ] `freeze`
- [ ] `retire`

### Task 2.2：实现单账号动作接口

- [ ] 新增 `POST /api/pool-admin/accounts/<id>/action`
- [ ] 统一参数校验与错误返回

### Task 2.3：实现允许状态校验

- [ ] `NULL -> available`
- [ ] `available / cooldown / used / frozen / retired -> NULL`
- [ ] 非法状态跳转明确报错

### Task 2.4：保护 `claimed`

- [ ] 通用动作禁止修改 `claimed`
- [ ] 返回稳定错误码/文案

### Task 2.5：写入基础审计（若本阶段一并做）

- [ ] 若决定把审计提前到 MVP，则至少记录动作、账号、前后状态；否则留到 Phase 4

---

## Phase 3: 前端号池管理页 MVP

### Task 3.1：新增页面入口

- [ ] 在主前端新增“号池管理”入口
- [ ] 与概览页职责分离
- [ ] 保持 `templates/index.html` 现有 `.page` + `navigate(page)` 集成方式

### Task 3.2：新增前端模块

**建议文件**：`static/js/features/pool_admin.js`

- [ ] 查询列表
- [ ] 渲染状态标签
- [ ] 执行动作并刷新
- [ ] 风格参考 `static/js/features/overview.js` 与现有账号列表交互模式

### Task 3.3：实现筛选栏

- [ ] 池内 / 池外
- [ ] `pool_status`
- [ ] provider / group / search

### Task 3.4：实现最小动作区

- [ ] 移入号池
- [ ] 移出号池
- [ ] 恢复可用（若本期纳入）

### Task 3.5：`claimed` 视觉保护

- [ ] 占用中状态单独标识
- [ ] 禁用不安全动作

---

## Phase 4: 增强项（强制释放 / 审计 / 最近流转）

### Task 4.1：强制释放

- [ ] 新增 `force_release` 动作
- [ ] 二次确认
- [ ] 与现有 pool 语义保持一致

### Task 4.2：最近流转展示

- [ ] 从 `account_claim_logs` 拉最近记录
- [ ] 在详情或侧栏展示

### Task 4.3：补强审计

- [ ] 记录操作者
- [ ] 记录前后状态
- [ ] 记录时间与原因

### Task 4.4：评估批量动作是否纳入

- [ ] 若纳入，仅覆盖安全动作
- [ ] `claimed` 默认不进批量

---

## Phase 5: 测试与验收

### Task 5.1：查询接口测试

- [ ] 池内/池外筛选
- [ ] `pool_status` 筛选
- [ ] 分页与搜索

### Task 5.2：动作接口测试

- [ ] 合法状态跳转
- [ ] 非法跳转拦截
- [ ] `claimed` 保护

### Task 5.3：前端交互测试

- [ ] 页面加载
- [ ] 动作成功反馈
- [ ] 动作失败反馈

### Task 5.4：增强项测试

- [ ] 强制释放
- [ ] 最近流转展示
- [ ] 审计写入

### Task 5.5：人工验收

- [ ] 看得见池内/池外
- [ ] 挪得动账号
- [ ] `claimed` 不被误改
