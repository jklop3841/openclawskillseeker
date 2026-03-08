# OpenClaw机械外骨骼

给 OpenClaw 穿上一层真正可用的机械外骨骼。

`OpenClaw机械外骨骼` 是一个本地 sidecar 应用，用来把技能安装、接入、验证、回滚这条链路产品化。它不修改 OpenClaw 本体，默认走 whitelist-first，只把技能装进隔离目录，再把可验证的技能目录接入 OpenClaw。

## 现在能做什么

- 一键安装并接入经过验证的 `calendar` 技能
- 支持最小安全演示包 `demo-safe`
- 自动检测环境、安装、接入、验证
- 严格校验 `SKILL.md`、`.clawhub/origin.json`、`.clawhub/lock.json`
- 接入失败时给出人话解释，而不是只吐技术错误
- 提供本地回滚入口，避免把 OpenClaw 主环境搞乱

## 产品定位

- `sidecar`：独立于 OpenClaw core
- `whitelist-first`：默认不绕过 suspicious 技能门禁
- `isolated install`：技能先落到隔离目录
- `auditable`：文件级验证，不靠“看起来像成功”
- `windows-first`：兼容 `clawhub.cmd` 和桌面应用分发

## 黄金路径

当前版本已经冻结了一条可演示、可复现、可解释的主链路：

1. `validate-skill calendar`
2. `install-skill calendar`
3. `verify-pack-layout --verbose`

这条链已经真实跑通，证明了四件事：

1. 不改 OpenClaw 本体
2. 技能隔离安装
3. 默认安全策略有效
4. 结果可验证、可审计

## 桌面版

当前仓库已经包含桌面壳源码，产品名为 `OpenClaw机械外骨骼`。

本地启动预览：

```powershell
Set-Location D:\AI\backlup
npm install
npm run start:desktop
```

应用首页会直接展示：

- 环境状态
- `一键安装并接入 Calendar`
- `安装 demo-safe 演示包`
- `撤销上次接入`
- 普通用户可读的成功 / 失败说明

## 安装证据

成功安装后，隔离目录中应当至少出现：

- `<targetDir>\.clawhub\lock.json`
- `<targetDir>\skills\calendar\SKILL.md`
- `<targetDir>\skills\calendar\.clawhub\origin.json`

## 适合谁

- 想更安全地给 OpenClaw 加技能的用户
- 不想自己手动 patch config 的用户
- 希望先看见“真实落盘和验证结果”再接入的团队
- 想把 OpenClaw 技能接入做成可演示产品的人

## 还不是什么

- 还不是 hosted registry
- 还不是完整商业技能市场
- 还不是 OpenClaw 的替代品
- 还不是零依赖、零环境要求的最终大众版

## 报告与验证

安装报告会写到：

- `~/.openclaw-skill-center/reports`

CLI 和桌面版都会输出用户可读摘要，包括：

- 装了什么
- 跳过了什么
- 为什么跳过
- 文件落在哪里
- 如何确认成功

## 文档

- [Quick Demo Guide](/D:/AI/backlup/docs/DEMO.md)
- [Install Guide](/D:/AI/backlup/docs/INSTALL.md)
- [Operations](/D:/AI/backlup/docs/OPERATIONS.md)
- [One-Page Overview](/D:/AI/backlup/docs/ONE_PAGER.md)
- [GitHub Homepage Copy](/D:/AI/backlup/docs/GITHUB_HOME.md)
- [Sales Page Draft](/D:/AI/backlup/docs/SALES_PAGE.md)
- [Failure Explanation Templates](/D:/AI/backlup/docs/FAILURE_PLAYBOOK.md)

## 开发

```powershell
npm install
npm run typecheck
npm test
npm run build
```
