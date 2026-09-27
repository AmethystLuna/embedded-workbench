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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ContextFormed } from '@deepseek-ai/dsh-llm';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'plugin:embedded-workbench': {
            kind: 'plugin:embedded-workbench';
        } & ContextFormed;
    }
}
export declare const name = "embedded-workbench";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    gateContent: string;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    gateContent: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    gateContent: z<string, string, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: Config): void;
