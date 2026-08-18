# 嵌入式工作台

<p align="center"><a href="README.en-US.md">English</a> · <strong>中文</strong></p>

嵌入式 C/C++ 固件开发工具箱 — 4 个代理、7 个技能，覆盖 FreeRTOS、中断、NVM 存储、Keil MDK（AC5/AC6）、ARMCLANG、HardFault 分析、状态机、架构原则、LVGL 陷阱。

**跨平台** — 支持 Claude Code、Codex CLI、Cursor、Kimi CLI、OpenCode、ZCode。基于 [Agent Skills](https://agentskills.io) 开放标准构建。

## 组件

### 代理 (4)

| 代理 | 说明 |
| ------ | ------ |
| `architecture-steward` | 只读规划：设计包、模块边界、切片拆分 |
| `design-reviewer` | 设计文档事实核查：逐条核验声称与代码库事实 |
| `execution-worker` | 计划 → 审批 → 实施循环，含编译验证 |
| `quality-coordinator` | 实现审查：Bug 发现、合规检查、结束完整性 |

### 技能 (8)

| 技能 | 说明 |
| ------ | ------ |
| `embedded-workbench` | 引导技能：工作流、策略、子代理映射、主动建议、跨平台工具映射、文档模板 |
| `debug-methodology` | 8 条调试铁律、修复准则、迭代调试案例研究 |
| `embedded-firmware-dev` | FreeRTOS、中断、NVM 存储、异步生命周期、边界分析、架构原则、LVGL 陷阱 |
| `keil-mdk-build` | UV4 CLI、ARM Compiler 5/6、.map 分析、合并打包、构建诊断 |
| `c-cpp-dev` | C/C++ 代码生成、风格、内存布局、重构 |
| `state-machine-design` | 状态模型、重试、超时、转换门控、实现模式 |
| `hardfault-triage` | 处理器异常分类 — 故障寄存器、栈帧、PC 定位源码、根因分类 |

`logicprobe`（文档与计划声称核查、逻辑原语验证、对抗性探测）**已拆分为独立插件** — 见下方[其他插件推荐](#其他插件推荐)。

> 技能内容大多来自作者个人嵌入式/固件开发工作经验和代码洁癖，按实际工程踩坑与约束沉淀，而非泛泛的模型生成内容。

### 深度参考

`embedded-firmware-dev`、`debug-methodology`、`state-machine-design`、`c-cpp-dev` 包含深度参考或代码示例。亮点：12 条架构原则、嵌入式模式（GIF 定时器安全、状态锁存、异步生命周期）、LVGL 陷阱、7 轮迭代调试案例研究、状态机实现模式、嵌入式 C 专项（volatile MMIO、链接器段、ISR 安全路径）。

## 安装

### Marketplace 安装（推荐）

在 `~/.claude/settings.json` 中添加 marketplace：

```json
{
  "extraKnownMarketplaces": {
    "embedded-workbench": {
      "source": { "source": "github", "repo": "AmethystLuna/embedded-workbench" }
    }
  }
}
```

然后通过 CLI 安装：

```bash
claude plugin install embedded-workbench@embedded-workbench
```

### 手动安装

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.claude/plugins/dev/embedded-workbench
```

然后在 `~/.claude/settings.json` 中启用：

```json
{
  "enabledPlugins": {
    "embedded-workbench@dev": true
  }
}
```

## DeepSeek Harness (dsh)

原生 dsh 支持以 cordis 插件 bundle 的形式提供，位于**仓库根**（根 `package.json` 声明了 `dsh.bundle`）：

- 技能遵循 Agent Skills 开放标准，被 dsh 的 `skill-filesystem` provider 原样发现——零代码。
- bundle 将首步门禁（1% Rule / Red Flags / Plan Verification Gate）注入每个 agent 会话的第一个模型步骤——是 Claude `SessionStart` hook 在 dsh 的原生对应物，并注册了模型可见的目录条目（`cordis_inspect`）。
- 4 个自定义 agent 有意不移植——dsh 原生 subagent 工具已覆盖并行多 agent 工作。

安装：参见 [`.dsh/INSTALL.md`](.dsh/INSTALL.md)（四种方式，从纯技能拷贝到 `dsh plugin add`）。

> DSH 安装注意：包名已使用 scoped 形式 `@amethystluna/embedded-workbench`。在 web profile 的 `package.json` 中，依赖键与 `dsh.profile.bundles` 必须写 `@amethystluna/embedded-workbench`；否则 dsh 加载器会因找不到 `node_modules/@amethystluna/embedded-workbench` 而启动失败。

## 使用

插件在会话首个模型步骤自动注入能力通知（含技能表、1% Rule、Red Flags 强化）。技能按需加载：

- 说"用 Multi-Agent Workflow"或调用 `Skill("embedded-workbench")` 加载完整工作流系统
- 领域技能在任务匹配其 `Use when` 描述时自动激活——NOT 子句防止误触发（如纯格式化不会加载 c-cpp-dev）
- Agent 在检测到状态机、行为声称或多模块任务时，主动建议验证、对抗探测和并行子代理
- 无需手动配置 CLAUDE.md

## Codex CLI

本插件同样支持 OpenAI Codex CLI。技能遵循 Agent Skills 标准，跨平台行为一致。代理以 Codex TOML 格式提供于 `.codex/agents/`。

### Codex 安装

```bash
# 添加 marketplace
codex plugin marketplace add AmethystLuna/embedded-workbench

# 安装
codex plugin install embedded-workbench
```

或手动安装：

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.codex/plugins/embedded-workbench
```

技能通过 `$skill-name` 调用（如 `$debug-methodology`），或由 Codex 根据任务上下文自动匹配。

## Cursor

Cursor 2.5+ 内置插件支持。`agents/` 中的代理自动发现。

### Cursor 安装

```bash
# 克隆到 Cursor 插件目录
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.cursor/plugins/embedded-workbench
```

或通过 Cursor 插件市场 UI 安装：`/add-plugin AmethystLuna/embedded-workbench`

## Kimi CLI

Kimi CLI 自动从 `.claude/skills/` 等标准路径发现技能。`.kimi-plugin/plugin.json` 为 Kimi 插件管理器注册插件。

### Kimi 安装

```bash
# 通过 Kimi 插件管理器
/plugins install https://github.com/AmethystLuna/embedded-workbench.git

# 或手动克隆
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.kimi/plugins/embedded-workbench
```

技能通过 `/skill:<name>` 调用（如 `/skill:debug-methodology`）。

## OpenCode

技能从 `.claude/skills/` 和 `.codex/skills/` 路径自动发现。在 `opencode.json` 中添加：

```json
{
  "plugin": ["embedded-workbench@git+https://github.com/AmethystLuna/embedded-workbench.git"]
}
```

或通过 `skop` 安装（兼容 Claude marketplace 清单）。详见 `.opencode/INSTALL.md`。

## ZCode（智谱 Z.AI）

ZCode 3.0+ 遵循 Agent Skills 标准。无插件商店，手动复制技能到 `.zcode/skills/`：

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git
cp -r embedded-workbench/skills/* .zcode/skills/
```

技能通过 `$skill-name` 调用。ZCode 也自动从 `.claude/skills/` 和 `.codex/skills/` 发现技能。详见 `.zcode/INSTALL.md`。

## 依赖

- Claude Code v2.1+ / Codex CLI 最新版 / Cursor 2.5+ / Kimi CLI 最新版 / OpenCode 最新版 / ZCode 3.0+
- DeepSeek Harness (dsh): dev preview — 已实测 mainline 2026-08-14（gate bundle 加载并注入会话成功）
- 无外部依赖

## 配置

在 DeepSeek Harness 中，bundle 支持以下配置：

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 设为 `false` 可关闭首步 Gate 注入。 |
| `gateContent` | string | 内置 gate 文本 | 覆盖注入到首轮模型上下文中的文本。 |

在 profile 的 `cordis.patch.yml` 中按 row id 覆盖：

```yaml
- insert:
    - id: embedded-workbench
      name: '@amethystluna/embedded-workbench'
      config:
        enabled: true
        gateContent: |
          ...
```

## 卸载

- 如果通过 DSH 插件管理器安装，请使用同一管理器从目标 profile 中移除 `embedded-workbench`。
- 如果手动复制过 `skills/*`，请删除复制到 `~/.agents/skills/` 或项目 `.dsh/skills/` 下的对应目录。
- 如果通过 `cordis.patch.yml` 添加，请删除 profile patch 中 `id: embedded-workbench` 对应的行，并重启 DSH。

## 权限与数据

- 插件运行时只读取包内自带的 `skills/` 目录，用于通过 DSH 标准 filesystem skill provider 注册技能。
- 它会在会话首轮向模型上下文注入配置好的 gate 文本。
- 它不读取凭据、不发起网络连接，也不会访问 DSH 会话上下文之外的用户数据。
- 实际使用技能时，模型会像使用其他编码技能一样，按用户指示读取项目文件。

## 故障排查

- 技能在 DSH 中不可见：确认 DSH 版本支持 `ctx.skills` / Agent Skills 发现，并在安装后重启 profile。
- Gate 未注入：检查 `enabled` 是否为 `false`，以及 profile patch 中是否存在 `id: embedded-workbench` 的行。
- 插件管理器拒绝安装：确认 `@deepseek-ai/*` 包声明在 `peerDependencies` 中，而不是 `dependencies`。
- 手动复制后 DSH 仍看不到技能：改用原生 bundle 安装（`dsh plugin add "github:AmethystLuna/embedded-workbench"`）。

## 开发

```bash
npm install
npm run typecheck
npm run build
```

运行 DSH 技能注册测试和触发测试：

```bash
node tests/dsh-skills-registration.test.mjs
bash tests/skill-triggering/run-all.sh
```

## 许可证与安全

本项目使用 MIT 许可证，见 [LICENSE](LICENSE)。

如发现安全漏洞，请**不要**公开创建 issue，应使用 GitHub Security Advisory 或 [SECURITY.md](SECURITY.md) 中的联系方式私下报告。

## 其他插件推荐

| 插件 | 简介 |
|------|------|
| [logicprobe](https://github.com/AmethystLuna/logicprobe) | 文档与计划声称核查——逻辑原语验证（7 结构 + 7 对抗探针）、重构回归检测。自本插件拆分；Plan Verification Gate 依赖它。 |
| [superpowers](https://github.com/obra/superpowers) | 原始 agent 纪律引擎——技能加载强制、Red Flags、子代理驱动开发。本插件的多项 agent 合规模式（1% Rule、Red Flags、`<SUBAGENT-STOP>`、指令优先级）均借鉴自 Superpowers。 |

## 致谢

本插件的 agent 合规架构借鉴自 Jesse Vincent 的 [Superpowers](https://github.com/obra/superpowers)（MIT License）。特别感谢以下设计模式的启发：

- **1% Rule** — agent 会抗拒加载技能，需要极端语言突破偏见的关键洞察
- **Red Flags 表** — 枚举 agent 的合理化借口以预先阻断
- **`<SUBAGENT-STOP>`** — 阻止子代理重复加载引导上下文
- **指令优先级** — 用户 > 技能 > 系统提示的分层架构
- **技能类型** — Rigid vs Flexible 分类体系
- **会话启动注入模式** — 在会话启动时注入能力上下文的 hook 机制
- **触发测试框架** — `tests/skill-triggering/` 的结构和方法论

Superpowers 是通用开发插件。Embedded Workbench 将相同的纪律模式应用到嵌入式 C/C++ 领域。
