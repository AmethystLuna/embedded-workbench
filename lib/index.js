/**
 * embedded-workbench — DeepSeek Harness native plugin for the Embedded
 * Workbench toolbox. Injects the session-start gate text (1% Rule, Red
 * Flags, Plan Verification Gate, skills roster) into the first model step
 * of every agent session, mirroring the SessionStart hook the Claude Code
 * plugin installs. The 7 skills ship in this package's `skills/` directory
 * and are registered at apply time into dsh's `ctx.skills` registry through
 * the standard filesystem provider, so they appear in every session catalog
 * without a manual copy step.
 *
 * Injection listens on the official `agent/session-start` lifecycle event
 * (once before the first turn) and seeds the gate via `agent.inject`, so
 * the text enters durable context before the first request — the dsh-native
 * counterpart of the Claude SessionStart matcher (startup|clear|compact;
 * resume keeps the gate already in history). The default gate text is the
 * dsh-native adaptation of `hooks/session-start-content.md`: behavior rules
 * (1% Rule / Red Flags / Plan Verification Gate) stay in sync, while
 * presentation is adapted to dsh's native skill catalog — no roster table
 * (the model sees skills in its catalog) and no install instructions (those
 * live in `.dsh/INSTALL.md`). Deployments override via Config.
 *
 * @module embedded-workbench-dsh
 */
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem';
export const name = 'embedded-workbench';
// Skills are contributed through the registry service, which dsh-base always
// mounts before bundle rows such as this one apply.
export const inject = ['skills'];
// Absolute path of the package's shipped skills directory. `lib/index.js`
// lives one level below the package root, so `../skills` from the module URL
// lands on `<package>/skills` regardless of where the package was installed.
const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url));
const GATE_PLUGIN_ID = 'embedded-workbench';
const DEFAULT_GATE_CONTENT = `<EXTREMELY_IMPORTANT>
Plugin embedded-workbench is active. You have embedded C/C++ firmware development skills — names and "Use when" triggers are in your skill catalog; load them with the skill tool. No custom agents in dsh: use the native subagent tooling for parallel work.

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
| "I've explored enough, time to exit plan mode" | The exit_plan_mode tool is the verification gate. Have you loaded the logicprobe skill? Every plan must pass this gate before exit. |
| "This plan is too simple for logicprobe" | The skill auto-classifies depth. You don't decide. |
| "I already read the code, I know the file paths are correct" | Load the logicprobe skill, run Phase 0, append the "## Plan Verification" block. |

**Plan Verification Gate**: Before calling exit_plan_mode (or presenting a plan for approval), either load the logicprobe skill (a separate plugin — if it is missing from your skill catalog, tell the user to install it) OR inform the user "此计划未经 logicprobe 验证，是否需要核查？" Silent skip is not an option.

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
    // service is mounted, so headless assemblies without it keep the gate
    // injection working. The registry may be provided AFTER this row applies
    // (base-bundle rows can mount later), so registration is retried on the
    // first agent/session-start — by then the app is fully booted.
    let providerRegistered = false;
    const registerProvider = () => {
        if (providerRegistered)
            return;
        const inspect = ctx.get('cordisInspect');
        if (inspect === undefined)
            return;
        try {
            ctx.effect(() => inspect.register(inspectProvider(config)), 'embedded-workbench: inspect provider');
            providerRegistered = true;
        }
        catch (err) {
            console.warn('[embedded-workbench] inspect provider registration failed', err);
        }
    };
    registerProvider();
    // Ship the bundled skills through the registry: reuse the standard
    // filesystem provider over this package's own `skills/` directory, so
    // catalog discovery, frontmatter parsing, and SKILL.md loading behave
    // exactly like project/user skills while the plugin stays self-contained.
    // Registration lands in the global registry layer (this row mounts at the
    // profile root), so every agent preset sees the skills. `registerProvider`
    // returns the effect disposer; its teardown unregisters and invalidates.
    ctx.skills.registerProvider((control) => {
        return new FileSystemSkillProvider(ctx, control, {
            providerName: 'embedded-workbench',
            includeDefaultRoots: false,
            customSkillDirs: [SKILLS_DIR],
        });
    });
    if (!config.enabled)
        return;
    // Inject the gate exactly once per session lifecycle — the dsh-native
    // counterpart of the Claude SessionStart matcher (startup|clear|compact).
    // `agent.inject` seeds the message into the next step's claimed batch, so
    // it enters durable context before the first request. Resume is skipped:
    // the gate is already part of the resumed history.
    ctx.on('agent/session-start', ({ agent, source }) => {
        registerProvider();
        if (source === 'resume')
            return;
        agent.inject(gateMessage(config.gateContent));
    });
}
