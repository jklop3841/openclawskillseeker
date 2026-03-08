# OpenClaw机械外骨骼 快速安装

这是给普通用户的最短安装说明。

## 1. 下载

从 GitHub Release 下载：

- `OpenClaw-Exoskeleton-Setup.exe`

## 2. 双击安装

直接双击 `OpenClaw-Exoskeleton-Setup.exe`。

安装器会自动：

- 解压应用到本地目录
- 创建桌面快捷方式
- 启动 `OpenClaw机械外骨骼`

## 3. 打开应用后做什么

第一次打开后，你只需要：

1. 等待环境检查完成
2. 点击 `一键安装并接入 Calendar`
3. 等待页面显示成功结果

## 4. 成功后做什么

如果页面显示已接入成功：

1. 重启 OpenClaw
2. 回到 OpenClaw 里测试日程能力

## 5. 如果失败

应用会直接告诉你失败在哪一步。

常见情况只有三类：

- `clawhub 未找到`
- `技能被安全策略跳过`
- `安装后未通过验证`

你不需要自己改配置文件，也不需要自己手动 patch OpenClaw。

## 6. 这款产品做什么

`OpenClaw机械外骨骼` 的作用是：

- 给 OpenClaw 更安全地安装技能
- 把技能装到隔离目录
- 自动接入 OpenClaw
- 自动验证技能文件是否完整

它不是 OpenClaw 本体，也不会直接修改 OpenClaw core。
