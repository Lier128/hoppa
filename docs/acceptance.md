# 验收记录

> 对照 `docs/product/HOPPA_功能验收与数据埋点.xlsx` 的「测试用例」页逐条记录。
> 只写**实际执行过**的结果；未覆盖的项明确标「未执行」，不把计划写成结果。
> 执行环境：Windows 11 / Node 22.11.0 / Chrome（Playwright `channel: 'chrome'`）/ 2026-10-26。

## 自动化结果

```text
npm run typecheck   → 0 error
npm test            → 3 files / 47 tests passed
npm run build       → ✓ built in 13.7s
                       dist/index.html                 1.25 kB
                       dist/assets/index-*.css         98.79 kB (gzip 17.96)
                       dist/assets/react-*.js          50.82 kB (gzip 17.92)
                       dist/assets/icons-*.js          36.65 kB (gzip  8.32)
                       dist/assets/index-*.js         459.73 kB (gzip 140.43)
npm run test:e2e    → 18 passed（desktop 14 + mobile 4）
```

端到端用例文件：`e2e/flows.spec.ts`（桌面主流程）、`e2e/mobile.spec.ts`（375px 移动端）。
单元测试文件：`src/domain/rules.test.ts`、`src/store/reducer.test.ts`、`src/lib/date.test.ts`。

## 功能验收

| 用例 | 场景 | 结果 | 证据 |
|---|---|---|---|
| TC-001 | 首页浏览并进入活动详情 | ✅ 通过 | E2E「首页至少展示 6 条活动」+「参与与筛选」全流程 |
| TC-002 | 组合筛选（类型/时间/预算） | ✅ 通过 | E2E「搜索与品类筛选」+「组合筛选（时间 + 预算）」 |
| TC-003 | 无结果空状态与清除筛选 | ✅ 通过 | E2E 中空状态出现后点击「清除筛选」恢复列表；首页筛选区有独立空状态 |
| TC-004 | 创建有效活动并出现在列表 | ✅ 通过 | E2E「创建活动成功、跳转详情且刷新后仍在」 |
| TC-005 | 创建过去时间的活动 | ✅ 通过 | E2E「过去时间被拦截」；单测 `validateActivityDraft` |
| TC-006 | 申请加入有名额的活动 | ✅ 通过 | E2E「申请加入活动：留言 → 二次确认 → 提交成功」 |
| TC-007 | 重复申请被拦截 | ✅ 通过 | E2E「已有待审核申请时不再出现申请按钮」；单测 `canApply` duplicated |
| TC-008 | 满员活动不可申请 | ⚠️ 规则层通过，界面未单独演示 | 单测构造满员状态验证 `canApply` 返回 full、`canApprove` 拒绝；seed 中没有满员活动，界面未截图 |
| TC-009 | 组织者审核，通过人数不超上限 | ✅ 通过 | E2E「组织者通过申请后成员数增加」；单测 `canApprove` |
| TC-010 | 准备中 → 进行中 → 待评价 | ✅ 通过 | E2E「组织者推进状态」 |
| TC-011 | 评价唯一性 | ✅ 通过 | 单测 reducer「同一用户只保留一条评价」+ `canReview`；E2E 完成一次评价后跳转名片 |
| TC-012 | 刷新后活动与消息保留 | ✅ 通过 | E2E「创建活动…刷新后仍在」「群聊发送消息并刷新保留」 |
| TC-013 | 安全中心演示边界 | ✅ 通过 | E2E「演示紧急求助明确不拨号、不定位、不发送数据」 |
| TC-014 | 举报提交 | ✅ 通过 | E2E「安全中心可提交模拟举报并显示已记录」 |
| TC-015 | 375px 窄屏无横向溢出 | ✅ 通过 | E2E mobile 4 条：首页 / 详情 / 群聊 / 创建表单，`scrollWidth - clientWidth ≤ 0` |
| TC-016 | 重置演示数据 | ✅ 通过 | E2E「重置演示数据恢复初始状态」 |

## 埋点验收（本地模拟）

事件写入 `state.events`（上限 300 条），可在「演示工具」面板看到数量。

| 事件 | 状态 | 触发位置 |
|---|---|---|
| `home_view` | ✅ | 首页进入（StrictMode 去重） |
| `activity_card_impression` / `activity_card_click` | ✅ | ActivityCard（IntersectionObserver 曝光去重） |
| `filter_apply` | ✅ | 首页筛选、找搭子偏好提交/快捷放宽 |
| `activity_detail_view` | ✅ | 活动详情（含 source_page） |
| `join_apply_submit` / `join_apply_result` | ✅ | store.apply / decideApplication |
| `activity_create_submit` | ✅ | store.createActivity |
| `group_chat_open` / `message_send` | ✅ | 群聊进入 / 发送消息 |
| `activity_checkin_click` / `activity_complete` | ✅ | 签到 / 结束活动 |
| `review_submit` / `share_trip_card` | ✅ | 提交评价 / 复制名片文案 |
| `safety_center_open` / `report_submit` | ✅ | 安全中心 / 举报提交 |
| `my_activities_tab` | ✅ | 我的活动切换 Tab |
| `post_like_toggle` / `post_save_toggle` | ✅ | 同城内容点赞 / 收藏 |

> 埋点只用于验证「事件是否在正确时机触发、属性是否正确」，**不能**据此推导任何真实转化率（数据是 mock）。

## 未执行 / 未覆盖

1. **真实用户可用性测试**（3–5 人任务测试）：未执行，计划见 `docs/user-testing-plan.md`。
2. **真机兼容**：未在 iOS Safari / Android Chrome 真机验证；仅 Chrome 375/390px 视口。
3. **跨浏览器**：仅 Chrome；未跑 Firefox / Safari。
4. **无障碍审计工具**：未跑 axe 等自动化审计；已人工保证表单 label/aria、按钮可聚焦、错误 `role="alert"`。
5. **性能审计**：未做 Lighthouse；只做了构建体积与拆分检查（vendor 拆分后首屏 JS gzip ≈ 140 kB）。
6. **满员活动界面态**：规则层已覆盖，seed 未提供满员数据，界面态未截图。
