# 嵌入式工作台

<p align="center"><a href="README.en-US.md">English</a> · <strong>中文</strong></p>

嵌入式 C/C++ 固件开发工具箱 — 4 个代理、8 个技能，覆盖 FreeRTOS、中断、NVM 存储、Keil
MDK（AC5/AC6）、ARMCLANG、HardFault 分析、状态机、架构原则、LVGL 陷阱。

**跨平台** — 支持 Claude Code、Codex CLI、Cursor、Kimi CLI、OpenCode、ZCode、DeepSeek Harness (dsh)。基于 [Agent Skills](https://agentskills.io) 开放标准构建。

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
| `fact-check` | 声称核查回退：逐条对照代码库核实 API 名、文件路径、枚举值、数量与机制可行性；logicprobe 未安装时由 Plan Verification Gate 使用 |

`logicprobe`（文档与计划声称核查技能）**已拆分为独立插件** — 见下方[其他插件推荐](#其他插件推荐)。未安装时，Plan Verification Gate 回退到本插件自带的 `fact-check` 技能，只有行为/模型类声称降级为人工确认。

> 技能内容大多来自作者个人嵌入式/固件开发工作经验和代码洁癖，按实际工程踩坑与约束沉淀，而非泛泛的模型生成内容。

### 深度参考

`embedded-firmware-dev`、`debug-methodology`、`state-machine-design`、`c-cpp-dev` 包含深度参考或代码示例。亮点：12 条架构原则、嵌入式模式（GIF 定时器安全、状态锁存、异步生命周期）、LVGL 陷阱、7 轮迭代调试案例研究、状态机实现模式、嵌入式 C 专项（volatile MMIO、链接器段、ISR 安全路径）。

## 安装

### Claude Code 安装（推荐）

在 **Claude Code** 的 `~/.claude/settings.json` 中添加 marketplace：

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

### Claude Code 手动安装

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
- bundle 把一段**精简后**的首步门禁（Plan Verification Gate + 上下文预算规则）注入每个 agent 会话的第一个模型步骤（`enabled`，默认开启）——是 Claude `SessionStart` hook 在 dsh 的原生对应物；模型可见的目录条目（`cordis_inspect`）始终注册。为什么载荷里不再有 1% Rule / Red Flags，见[设计取舍与反馈](#设计取舍与反馈)。
- 4 个自定义 agent 有意不移植——dsh 原生 subagent 工具已覆盖并行多 agent 工作。

安装（原生 bundle，推荐）：

```bash
# 从 npm 安装（包名 dsh-embedded-workbench）
dsh plugin --profile web add dsh-embedded-workbench
# 或从 GitHub 源码安装
dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
# 未全局安装 dsh 时可用 npx
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-embedded-workbench
```

安装后重启 profile，运行 `dsh --profile web --dump-config` 应看到 `id: embedded-workbench` 且 `enabled: true`。更多方式（纯技能拷贝、项目级等）见 [`.dsh/INSTALL.md`](.dsh/INSTALL.md)。

> DSH 安装注意：npm 包名为 `dsh-embedded-workbench`（无 scope）。在 web profile 的 `package.json` 中，依赖键与 `dsh.profile.bundles` 必须写 `dsh-embedded-workbench`；否则 dsh 加载器会因找不到 `node_modules/dsh-embedded-workbench` 而启动失败。

## 使用

技能按需加载，不依赖注入：

- 调用 `Skill("embedded-workbench")` 加载工作流与工程策略——技能内部按风险比例选择轻量或完整路径，不强制固定阶段
- 领域技能在任务匹配其 `Use when` 描述时自动激活——NOT 子句防止误触发（如纯格式化不会加载 c-cpp-dev）
- Agent 在检测到状态机、行为声称或多模块任务时，主动建议验证、对抗探测和并行子代理
- 无需手动配置 CLAUDE.md

插件还会在会话首个模型步骤注入一段**精简**门禁（约 400 token），只含两件事：Plan Verification Gate，以及上下文预算规则（看不到读数就不要猜；工作量大且无信号时问用户，由用户决断）。设 `enabled: false` 可完全关闭。

## 设计取舍与反馈

这一版做了一次**基于证据的回退**，理由写在下面，欢迎质疑。

**背景**：我们逐个核对了 8 个受支持 harness 的官方文档（Codex 还对照了源码），发现一个此前想当然的前提是错的——**8 家里有 7 家根本不向模型暴露任何上下文预算读数**（Claude Code、Copilot CLI、Cursor、OpenCode、Kimi CLI、ZCode、dsh 都只把 token 数给用户界面；只有 Codex 有一个 `get_context_remaining` 工具，且默认关闭）。也就是说，让模型"按预算自行判断要不要委派/切窗口"，本身没有依据。

**因此分两步处理**：

1. **不再用"关掉注入"控制成本，改为"瘦身"**。首步门禁现在只保留两块：**Plan Verification Gate**（未核查就必须告诉用户，不许静默跳过）和**上下文预算规则**（看不到读数就不要猜；工作量大且无信号时问用户）。载荷从约 1,400 token 降到约 400 token（Claude 侧 −72%，dsh 侧 −58%，实测值），并且默认开启。
2. **验证门禁保留，强制执行脚手架退场**。原来的 1% Rule 与 9 行 Red Flags 表从**注入载荷**中移除：它们属于"强制纪律"，而社区实证显示这类提示会被能力较强的模型字面执行，产生僵硬阶段、多余提问，以及五行任务拉起六七个 agent 的 10–15× 开销（见 [obra/superpowers#1120](https://github.com/obra/superpowers/issues/1120)、[openai/codex#22005](https://github.com/openai/codex/issues/22005)、[#20366](https://github.com/openai/codex/issues/20366)）。完整表格仍保留在 `Skill("embedded-workbench")` 正文里——需要纪律时纪律还在，只是不再对所有人默认施压。工作流选择也从固定 agent 串场改为**按风险比例**。

**有意保留的**：Plan Verification Gate 的语义没有削弱（logicprobe → 未安装则内置 `fact-check` → 两者都没用就必须告知用户）。按 [Superpowers Lite](https://github.com/BB-84C/superpowers-lite) 的原则，安全、权限与**验证**门禁是应当保留的一类，按比例裁掉的应该是流程仪式。

**已知的不确定**：各 harness 的预算接口变动很快，我们只在 2026-09-25 核对过一次；[`platform-tool-mapping.md`](skills/embedded-workbench/references/platform-tool-mapping.md) 里凡厂商未公开的格子都明确标为 `UNVERIFIED`，没有靠类比填空。

**有不同意见？** 这些取舍（尤其"Red Flags 从载荷退场"和"门禁默认开"）是可讨论的判断，不是定论。欢迎到 [Issues](https://github.com/AmethystLuna/embedded-workbench/issues) 提出——写清你用的模型档位、harness 和反例，我们倾向按证据调整。

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
- DeepSeek Harness (dsh): dev preview — 已逐版本实测至 0.1.7-rc.2（2026-09-25，install / mount / start / uninstall 与会话日志证据见 [DSH-COMPATIBILITY.md](DSH-COMPATIBILITY.md)）
- 无外部依赖

## 配置

在 DeepSeek Harness 中，bundle 支持以下配置：

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 设为 `false` 可完全关闭首步 Gate 注入；技能注册不受影响。 |
| `gateContent` | string | 内置 gate 文本 | 覆盖注入到首轮模型上下文中的文本。 |

在 profile 的 `cordis.patch.yml` 中按 row id 覆盖（下面的例子自定义 Gate 文本）：

```yaml
- insert:
    - id: embedded-workbench
      name: 'dsh-embedded-workbench'
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
| [logicprobe](https://github.com/AmethystLuna/logicprobe) | 声称核查技能：逐条核验设计文档、架构规格、重构计划中的可验证声称与代码库是否一致，行为类声称升级为可执行模型验证。自本插件拆分；Plan Verification Gate 优先使用它，未安装时回退到内置 `fact-check` 技能。 |
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
