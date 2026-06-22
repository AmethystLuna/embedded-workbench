# 嵌入式工作台

嵌入式 C/C++ 固件开发工具箱。4 个代理、8 个技能，覆盖 FreeRTOS、中断、NVM 存储、Keil MDK（AC5/AC6）、ARMCLANG、HardFault 分析、状态机、架构原则及 LVGL 陷阱。

## 组件

### 代理 (4)

| 代理 | 模型 | 说明 |
| ------ | ------ | ------ |
| `architecture-steward` | opus | 只读规划：设计包、模块边界、切片拆分 |
| `design-reviewer` | sonnet | 设计文档事实核查：逐条核验声称与代码库事实 |
| `execution-worker` | haiku | 计划 → 审批 → 实施循环，含 `Bash` 编译验证 |
| `quality-coordinator` | sonnet | 实现审查：Bug 发现、合规检查、结束完整性 |

### 技能 (8)

| 技能 | 说明 |
| ------ | ------ |
| `embedded-workbench` | 引导技能：工作流、策略、子代理映射、文档模板 |
| `debug-methodology` | 8 条调试铁律、修复准则、迭代调试案例研究 |
| `embedded-firmware-dev` | FreeRTOS、中断、NVM 存储、异步生命周期、边界分析、架构原则、LVGL 陷阱 |
| `keil-mdk-build` | UV4 CLI、ARM Compiler 5/6、.map 分析、合并打包、HardFault 分析 |
| `c-cpp-dev` | C/C++ 代码生成、风格、内存布局、重构 |
| `state-machine-design` | 状态模型、重试、超时、转换门控 |
| `powershell-safety` | PowerShell 语法、引号、文件编码、安全规则 |
| `fact-verification` | 文档声称与代码库事实的交叉验证 |

### 深度参考

`embedded-firmware-dev` 和 `debug-methodology` 包含深度参考资料：12 条架构原则、嵌入式模式（GIF 定时器安全、状态锁存、异步生命周期）、LVGL 陷阱，以及 7 轮迭代调试案例研究。

## 安装

**开发安装：**

```text
将整个目录复制到 ~/.claude/plugins/dev/embedded-workbench/
```

**启用插件**（在 `~/.claude/settings.json` 中）：

```json
{
  "enabledPlugins": {
    "embedded-workbench@dev": true
  }
}
```

## 使用

在 `~/.claude/CLAUDE.md` 或项目 `CLAUDE.md` 中：

```markdown
使用 `Skill("embedded-workbench")` 加载工作流与策略。
领域指导通过 `Skill("embedded-firmware-dev")`、`Skill("c-cpp-dev")` 等按需加载。
```

## 依赖

- Claude Code v2.1+
- 无外部依赖
