/**
 * embedded-workbench — DeepSeek Harness native plugin for the Embedded
 * Workbench toolbox. Injects the session-start gate text (1% Rule, Red
 * Flags, Plan Verification Gate, skills roster) into the first model step
 * of every agent session, mirroring the SessionStart hook the Claude Code
 * plugin installs. The 7 skills themselves are discovered by dsh's
 * `skill-filesystem` provider and need no code.
 *
 * Injection follows the mechanism of @deepseek-ai/dsh-agent-instructions:
 * fold the context message into the `agent/pre-step` waterfall decision so
 * the text enters durable context before the first request. The default
 * gate text is the dsh-shaped twin of `hooks/session-start-content.md` in
 * the plugin root — same content, with Claude tool names mapped to the dsh
 * catalog (`skill` tool, `exit_plan_mode`) — and stays in sync with it;
 * deployments override via Config.
 *
 * @module embedded-workbench-dsh
 */
import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
export const name = 'embedded-workbench';
const GATE_PLUGIN_ID = 'embedded-workbench';
const DEFAULT_GATE_CONTENT = `<EXTREMELY_IMPORTANT>
Plugin embedded-workbench is active. You have access to embedded C/C++ firmware development skills (custom agents are not ported to dsh — parallel multi-agent work uses the native subagent tooling when needed).

**Skills** — load with the skill tool when the task matches:

| Skill | Use when | NOT for |
|-------|----------|---------|
| debug-methodology | Debugging crashes, HardFault, logs, or sensor anomalies | Fault-register triage (use hardfault-triage) |
| c-cpp-dev | Writing or refactoring embedded C/C++ code on ARM targets | Formatting-only, simple reads, C# or non-embedded |
| embedded-firmware-dev | FreeRTOS, ISR, NVM storage, async lifecycle, boundary analysis | Documentation-only RTOS references |
| keil-mdk-build | Keil MDK/ARMCLANG builds, .map analysis, build diagnostics | Non-Keil builds (Makefile, CMake, IAR, GCC-only) |
| state-machine-design | Async protocols, retries, ACK/NACK, timeout logic in embedded firmware | Generic network protocol design (TCP/HTTP/MQTT) |
| hardfault-triage | Processor exception triage, fault registers, stack frames, PC-to-source | — |

> **⚠️ logicprobe 已拆分为独立插件 / moved to a standalone plugin** (v0.6.0):
> The design-doc & plan claim-verification skill (logic-primitive verification, adversarial probing, refactoring regression detection) now lives in its own plugin: <https://github.com/AmethystLuna/logicprobe>
> Install it for dsh by copying its skills/ to ~/.agents/skills/ (or via its dsh bundle once published). Without it, the Plan Verification Gate below degrades to manual confirmation mode.

**1% Rule**: If there is even a 1% chance a skill applies to your task, invoke it before responding. If the skill turns out to be wrong for the situation, discard it and move on. The cost of loading a skill is trivial compared to the cost of a preventable mistake.

**Red Flags** — if you think any of these, STOP. You are rationalizing:

| You think | Reality |
|-----------|---------|
| "This is just a quick fix" | Quick fixes break things. A 3-line design check costs 30 seconds. |
| "I already understand this code" | You are looking at one file. The blast radius may span 5 modules. |
| "The skill is overkill for this" | Simple things become complex. Check for skills. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can just read the file directly" | Skills have patterns and pitfalls you will not discover by reading. |
| "I remember this skill content" | Skills evolve. Always load the current version. |
| "I've explored enough, time to exit plan mode" | The exit_plan_mode tool is the verification gate. Have you loaded the logicprobe skill (独立插件 / standalone plugin)? Every plan must pass this gate before exit. |
| "This plan is too simple for logicprobe" | The skill auto-classifies depth. You don't decide. |
| "I already read the code, I know the file paths are correct" | Load the logicprobe skill (外部插件), run Phase 0, append the "## Plan Verification" block. |

**Plan Verification Gate**: Before calling exit_plan_mode (or presenting a plan for approval), either load the logicprobe skill (standalone plugin — install separately if missing) OR inform the user "此计划未经 logicprobe 验证，是否需要核查？" Silent skip is not an option.

To load workflows and engineering policies: load the embedded-workbench skill.

**Proactive features**: When you see state machines, protocol refactoring, behavioral claims ("always"/"never"), or multi-module tasks — suggest verification, adversarial probing, or parallel subagents BEFORE the user asks. Most users do not know these exist.
</EXTREMELY_IMPORTANT>`;
export const Config = z.object({
    enabled: z.boolean().default(true),
    gateContent: z.string().default(DEFAULT_GATE_CONTENT),
});
function gateMessage(text) {
    return createUserMessage({
        content: [{ type: 'text', text }],
        // `form` omitted — an undeclared context is the documented default.
        source: { kind: 'plugin', plugin: GATE_PLUGIN_ID },
    });
}
function isGateMessage(message) {
    return message.source.kind === 'plugin' && message.source.plugin === GATE_PLUGIN_ID;
}
/**
 * Model-visible catalog entry (cordis_inspect_list / cordis_inspect_query):
 * lets the model read this plugin's runtime status without guessing. Mirrors
 * the registration pattern of the official dsh-tool-cordis host providers.
 */
function inspectProvider(config) {
    return {
        manifest: {
            id: 'embedded-workbench',
            description: 'Session-start gate injection for the Embedded Workbench toolbox — folds the 1% Rule / Red Flags / Plan Verification Gate text into the first model step of every agent session.',
            methods: [
                {
                    name: 'status',
                    description: 'Read whether the gate injection is active and how large the injected gate text is.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                    },
                    outputSchema: {
                        type: 'object',
                        description: 'Gate-injection plugin status.',
                        properties: {
                            enabled: { type: 'boolean', description: 'Whether the gate folds into the first model step.' },
                            gateContentLength: { type: 'integer', description: 'Length in characters of the injected gate text.' },
                        },
                        required: ['enabled', 'gateContentLength'],
                        additionalProperties: false,
                    },
                },
            ],
        },
        query: async (method) => {
            if (method === 'status') {
                return {
                    enabled: config.enabled,
                    gateContentLength: config.gateContent.length,
                };
            }
            return null;
        },
    };
}
export function apply(ctx, config) {
    // Catalog visibility is optional: register only when the inspect registry
    // service is mounted (web profile), so headless assemblies without it keep
    // the gate injection working.
    const inspect = ctx.get('cordisInspect');
    if (inspect !== undefined) {
        ctx.effect(() => inspect.register(inspectProvider(config)), 'embedded-workbench: inspect provider');
    }
    if (!config.enabled)
        return;
    ctx.on('agent/pre-step', async ({ messages, step }, next) => {
        const decision = await next();
        // Gate only the first real step; a no-step first entry stays untouched.
        if (decision.kind === 'reject')
            return decision;
        if (step !== 1 || decision.messages.length === 0)
            return decision;
        // Never re-inject when the gate text is already in the batch.
        if (decision.messages.some(isGateMessage))
            return decision;
        const gate = gateMessage(config.gateContent);
        // Fold the gate right after the claimed batch, mirroring the ordering
        // dsh-agent-instructions uses (direct prompt first, driver context last).
        let lastClaimedIndex = -1;
        for (let i = 0; i < decision.messages.length; i++) {
            if (messages.includes(decision.messages[i]))
                lastClaimedIndex = i;
        }
        const entered = [...decision.messages];
        entered.splice(lastClaimedIndex + 1, 0, gate);
        return { kind: 'enter', messages: entered };
    });
}
