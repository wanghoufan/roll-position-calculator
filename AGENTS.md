# AGENTS.md — 滚仓计算器

> 本文件是 Agent 的恢复入口。**完整交接文档见 `../docs/handoff/HANDOFF.md`**（含进展、下一步、根因分析、命令速查）。此处只放不看就会犯错的边界。

## 这是什么

纯前端、单文件、零依赖的「滚仓计算器」：滚仓推演表（涨幅 × 上一阶段杠杆 = 1，资产逐级翻倍）+ 本地历史记录 + 实盘记录（含图片、可编辑）。

## 怎么跑

> 命令按 macOS / Linux 写法；**Windows 把 `python3` 换成 `python`**。

```bash
# 本地预览（改完 outputs 必须重新 cp 再刷新）
cp "outputs/滚仓计算器.html" .preview/index.html
python3 -m http.server 8899 --directory .preview   # → http://127.0.0.1:8899/

# 代码校验（纯 Node，改完必须跑，期望 status: PASS）
cd work && node verify_calculator.mjs

# 部署（必须带团队 scope）
vercel deploy --prod --scope houfan --yes
```

## 技术栈与结构

- **单文件**：`outputs/滚仓计算器.html`（66,380 B，HTML + CSS + 原生 JS 全内嵌）。无框架、无构建、无网络请求、无依赖——**不要引入依赖或构建步骤**。
- 存储全本地：`localStorage`（历史/实盘文字/默认值）+ `IndexedDB`（图片）。不联网。
- `vercel.json`：构建时把中文文件名复制为 `public/index.html`，规避 URL 编码问题。

## 红线

- **未经用户明确说「提交 / 推送」，不得 `git commit` / `git push`；不得部署。**
- 删除、归档、重命名文件或清目录前**必须先列清单并取得确认**。
- `~/Downloads/大模型 HANDOFF` 文件夹**绝对不碰**。
- 部署被拦（CLI 显示 `UNKNOWN` / API `readyState=BLOCKED`）**不要反复重试**——先跑 `python3 ~/.workbuddy/skills/vercel-blocked-deploy-triage/scripts/diag_blocked_deploy.py` 拿真实报错。
- 本机 Vercel CLI 只有团队 `houfan` 一个 scope，**个人账号不可达**。
- 仓库已 public，`.env.local`（含 OIDC token）**未被跟踪，切勿提交**。
- 顶层文件夹的 `research/`、`deliverables/`、`PEPE、DOGE图片/` 是**另一个项目**（PEPE/DOGE 突破雷达），**不要混用或互拷**。

## 当前状态

功能开发完成，**已上线并线上实测通过**，代码无待修 Bug。线上：https://roll-position-calculator-houfan.vercel.app
下一步（用户未排期）：实盘记录导出/导入 JSON、图片备份。已知隐患：本机 git `user.email` 为空，仓库若改回私有会再次部署被拦。
