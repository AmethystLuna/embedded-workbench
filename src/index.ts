/**
 * embedded-workbench — DeepSeek Harness native plugin for the Embedded
 * Workbench toolbox. The 8 skills ship in this package's `skills/` directory
 * and are registered at apply time into dsh's `ctx.skills` registry through
 * the standard filesystem provider, so they appear in every session catalog
 * without a manual copy step. The plugin also folds a short gate text into the
 * first model step of every agent session, mirroring the SessionStart hook the
 * Claude Code plugin installs.
 *
 * Injection listens on agent/pre-step and appends the gate to the FIRST
 * model step that runs, once per session (guarded by the session's durable
 * history). Session-start inbox injection was dropped: a blank-session preset
 * switch (agentPreset.select -> recompose) can clear the inbox before the
 * first step, losing the gate for the whole session. The pre-step decision is
 * the durable path - anchored/bootstrap presets that strip first-step injected
 * reminders (skill catalog, AGENTS.md, gate plugins) simply defer this message
 * to the first step after their promotion, and the history guard re-injects it
 * there. The default gate text is the dsh-native adaptation of
 * `hooks/session-start-content.md`: the behavior rules stay in sync (the Plan
 * Verification Gate and the context-budget rule), while presentation is adapted
 * to dsh's native skill catalog — no roster table (the model sees skills in its
 * catalog) and no install instructions (those live in `.dsh/INSTALL.md`). The
 * payload is deliberately small: it carries the verification gate and the
 * budget rule, not the 1% Rule / Red Flags enforcement scaffolding, which
 * measurably pushes capable models into rigid phases and unnecessary fan-out.
 * Deployments override via Config.
 *
 * @module embedded-workbench-dsh
 */

import { fileURLToPath } from 'node:url'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import type { HostCordisInspectProviderRegistration } from '@deepseek-ai/dsh-cordis-host-runner'
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'

// DSH 0.1.7-alpha.1 (session format v4) retires the shared
// `{ kind: 'plugin', plugin }` wrapper: native admission rejects it in every
// declared durable message slot, and the official v3-to-v4 migration rewrites
// those historical rows to `plugin:<name>`. Declaring the producer-owned kind
// here keeps the write path and the history guard on one identity, and still
// compiles against the earlier releases that only declare `plugin`.
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'plugin:embedded-workbench': { kind: 'plugin:embedded-workbench' } & ContextFormed
  }
}

export const name = 'embedded-workbench'

// Skills are contributed through the registry service, which dsh-base always
// mounts before bundle rows such as this one apply.
export const inject = ['skills']

// Absolute path of the package's shipped skills directory. `lib/index.js`
// lives one level below the package root, so `../skills` from the module URL
// lands on `<package>/skills` regardless of where the package was installed.
const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url))

const GATE_PLUGIN_ID = 'embedded-workbench'

/** Producer-owned message source kind declared in `MessageSourceMap` above. */
const GATE_SOURCE_KIND: 'plugin:embedded-workbench' = 'plugin:embedded-workbench'

const DEFAULT_GATE_CONTENT = `<EXTREMELY_IMPORTANT>
Plugin embedded-workbench is active: embedded C/C++ firmware development skills are in your skill catalog. Load the one whose "Use when" matches before substantial work, with the skill tool.

**Plan Verification Gate**: before calling exit_plan_mode (or presenting a plan for approval), load the logicprobe skill — or the built-in fact-check skill when logicprobe is not installed — and append a "## Plan Verification" block to the plan. If you verify with neither, tell the user the plan is unverified before asking for approval; a silent skip is not an option. "This change is too small to check" and "I already read the code, the paths are right" are the two rationalizations this gate exists to catch.

**Context budget**: no token meter is visible to you, so never guess one. Act on what you can see — a pruned or spilled tool result means stop pulling it in whole, and a compaction checkpoint means move durable state into files. When a large step (many sources, a long sweep, several independent areas) shows no such signal, ask the user what to spend context on rather than deciding silently. If nobody can answer, take the reversible option and say so. When you do delegate, prefer \`subagent_fork\` over \`subagent\` if the sub-agent needs context you already built — its summary still lands here.

To load the workflows and engineering policies behind these skills: load the embedded-workbench skill.
</EXTREMELY_IMPORTANT>`

/** A schemastery field that may or may not carry `.volatile()`. */
interface LiveField {
  volatile?: () => unknown
}

/**
 * Declare a field as live where this host's schemastery can — `.volatile()`
 * arrived in 3.18.3 — and leave it an ordinary field where it cannot.
 *
 * The fallback is load-bearing, not defensive padding. `Config` below is built
 * while this module is still being evaluated, so an unconditional `.volatile()`
 * on a host shipping schemastery 3.18.2 (measured: dsh 0.1.5-rc.2 and
 * 0.1.5-rc.3) throws during import; the loader entry then fails and takes the
 * WHOLE plugin tree — and the host's boot — down with it. Degrading costs only
 * the Plugins-page switch, because the settings service projects nothing but
 * fields under a `.volatile()` node; the skills and the gate injection are
 * untouched. The returned schema keeps the plain field's static type; the
 * `Config` interface below carries the union the host actually hands over.
 */
function live<T>(field: T): T {
  const probe = field as T & LiveField
  return typeof probe.volatile === 'function' ? (probe.volatile() as T) : field
}

export interface Config {
  /**
   * The injection switch the Web client's Plugins page edits live: a `Volatile`
   * reference on a host whose schemastery supports one, an ordinary boolean on a
   * host that predates `.volatile()`. Read it through {@link injectionEnabled},
   * which accepts both shapes.
   */
  enabled: Volatile<boolean> | boolean
  gateContent: string
}

export const Config = z.object({
  // Live so the Web Plugins page can flip the gate injection inside a running
  // session: dsh's settings service projects ONLY fields under a `.volatile()`
  // node and rejects writes to every other path. The price is that the injection
  // reads the reference per step instead of deciding once at mount, which is also
  // what lets a toggle take effect without remounting the row.
  //
  // On by default, but deliberately small: the payload carries the verification
  // gate and the context-budget rule only, so leaving it on costs a few hundred
  // tokens once per session rather than the ~900 of the previous payload.
  enabled: live(z.boolean().default(true)),
  // Not volatile, deliberately: the settings projection feeds a GUI form, and a
  // multi-kilobyte text field does not belong in one. Override it in the
  // profile's `cordis.patch.yml` row instead.
  gateContent: z.string().default(DEFAULT_GATE_CONTENT),
})

/**
 * Read the injection switch as a boolean, whichever shape this host produced.
 * @param config - the resolved plugin configuration.
 * @returns whether the gate may be injected.
 */
function injectionEnabled(config: Config): boolean {
  const value = config.enabled
  return typeof value === 'boolean' ? value : value.get()
}

function gateMessage(text: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text }],
    // `form` omitted — an undeclared context is the documented default.
    source: { kind: GATE_SOURCE_KIND },
  })
}

interface SessionEventLike {
  type: string
  data?: Record<string, unknown>
}

/**
 * Minimum session-store surface this plugin reads. DSH 0.1.2-alpha.4 replaced
 * the `Session.events` getter with on-demand reads (`seq`, `eventAt()`,
 * `snapshotEvents()`); releases up to 0.1.2-alpha.3 expose `events` as the
 * full log snapshot. Read through a structural union so one build serves every
 * declared DSH release.
 */
interface SessionEventSource {
  events?: readonly SessionEventLike[]
  snapshotEvents?: () => readonly SessionEventLike[]
}

function readSessionEvents(session: Session): readonly SessionEventLike[] {
  const source = session as unknown as SessionEventSource
  if (typeof source.snapshotEvents === 'function') {
    const snapshot = source.snapshotEvents()
    if (Array.isArray(snapshot)) return snapshot
  }
  if (Array.isArray(source.events)) return source.events
  return []
}

/**
 * Model-visible catalog entry (cordis_inspect_list / cordis_inspect_query):
 * lets the model read this plugin's runtime status without guessing. Mirrors
 * the registration pattern of the official dsh-tool-cordis host providers.
 */
function inspectProvider(config: Config): HostCordisInspectProviderRegistration {
  return {
    manifest: {
      id: 'embedded-workbench',
      description: 'Session-start gate injection for the Embedded Workbench toolbox — folds the Plan Verification Gate and the context-budget rule into the first model step of every agent session.',
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
          enabled: injectionEnabled(config),
          gateContentLength: config.gateContent.length,
        }
      }
      return null
    },
  }
}

export function apply(ctx: Context, config: Config): void {
  // Catalog visibility is optional: register only when the inspect registry
  // service is mounted, so headless assemblies without it keep the gate
  // injection working. The registry may be provided AFTER this row applies
  // (base-bundle rows can mount later), so registration is retried on the
  // first agent/session-start — by then the app is fully booted.
  let providerRegistered = false
  const registerProvider = (): void => {
    if (providerRegistered) return
    const inspect = ctx.get('cordisInspect')
    if (inspect === undefined) return
    try {
      ctx.effect(() => inspect.register(inspectProvider(config)), 'embedded-workbench: inspect provider')
      providerRegistered = true
    } catch (err) {
      console.warn('[embedded-workbench] inspect provider registration failed', err)
    }
  }
  registerProvider()
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
    })
  })
  // Injection listens unconditionally, including while the switch is off: the
  // switch is volatile, so `apply` runs once and the value behind it can turn on
  // later from the Web Plugins page. Returning early on a false value here would
  // freeze that decision for the lifetime of the mount, and turning the switch
  // back on could never take effect without a profile restart.
  //
  // Inject the gate once per session on the FIRST model step that runs,
  // instead of at session-start: session-start injection lands in the agent's
  // inbox, which a blank-session preset switch (agentPreset.select ->
  // recompose) can clear before the first step - the gate would then be lost
  // for the whole session. The pre-step decision is the durable path a
  // first-step injection takes: the gate is appended to the first step's
  // decision and enters session history there, so every later step (and a
  // resume) skips it. Anchored/bootstrap presets that strip first-step
  // injected reminders (skill catalog, AGENTS.md, gate plugins) simply defer
  // this message to the first step after their promotion - the history guard
  // re-injects it there, so the gate still lands exactly once per session.
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    registerProvider()
    if (!injectionEnabled(config)) return decision
    if (gateInHistory(agent.session)) return decision
    return {
      kind: 'enter',
      messages: [...decision.messages, gateMessage(config.gateContent)],
    }
  })
}

/**
 * Whether the gate already entered this session's durable history. The
 * pre-step listener re-appends the gate until it does; once a step committed
 * it, every later step (and a resume of a session that kept it) skips the
 * injection. A session whose gate was dropped before any step ran (e.g. an
 * inbox cleared by a blank-session preset switch) simply re-injects on the
 * first step that runs.
 */
function gateInHistory(session: Session): boolean {
  return readSessionEvents(session).some((event) => {
    if (event.type !== 'user/message') return false
    const source = event.data?.source as { kind?: string; plugin?: string } | undefined
    if (source === undefined) return false
    // The v4 producer-owned kind, plus the pre-v4 wrapper this bundle wrote
    // before DSH 0.1.7-alpha.1 retired it.
    return source.kind === GATE_SOURCE_KIND
      || (source.kind === 'plugin' && source.plugin === GATE_PLUGIN_ID)
  })
}
