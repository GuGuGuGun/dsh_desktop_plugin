# DeepSeek Harness Desktop 插件

本插件将 DeepSeek Harness 自带的 Web UI 放进一个受限的 Electron 窗口。它不复制、不修改上游源码；Harness 仍负责 agent、会话、模型、工具、权限与持久化，插件只负责桌面窗口生命周期。

## 要求

- Node.js 22.19+ 或 24+
- DeepSeek Harness `@deepseek-ai/dsh` 0.1.0-rc.6
- pnpm 11

## 本地安装与运行

在仓库根目录执行：

```powershell
pnpm install
pnpm --filter dsh-plugin-desktop exec dsh plugin --profile web add .
pnpm --filter dsh-plugin-desktop exec dsh web
```

首次进入后，在 **Settings → Models** 中填写 DeepSeek API Key，再选择工作目录。关闭桌面窗口会结束本次 Harness 进程；在终端按 `Ctrl+C` 也会卸载插件并关闭窗口。

Electron 的安装脚本会下载对应平台的运行时。pnpm 若阻止该脚本，请只在信任本仓库后为 `electron` 放行构建，再重新安装依赖。

## 配置

插件默认使用 1280×840 窗口、15 秒启动超时，并在窗口关闭时结束 Harness。需要覆盖时，在 Web profile 的 `cordis.patch.yml` 中按同一行 id 配置：

```yaml
- id: desktop-shell
  config:
    width: 1440
    height: 900
    startupTimeoutMs: 30000
    startMaximized: false
    openDevTools: false
    exitHarnessOnClose: true
```

配置由 Schemastery 在插件加载时校验。窗口只接受 `http://127.0.0.1:<port>` 的 Harness 地址；Renderer 禁用 Node.js 集成，启用上下文隔离、进程沙箱和同源导航限制。

## 验证

```powershell
pnpm --filter dsh-plugin-desktop check
pnpm --filter dsh-plugin-desktop pack --dry-run
```

完整的架构、扩展点、开发步骤与兼容性说明见 [`docs/deepseek-harness-plugin-development.md`](docs/deepseek-harness-plugin-development.md)。
