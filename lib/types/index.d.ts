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
 * Injection listens on agent/pre-step and appends the gate to the FIRST
 * model step that runs, once per session (guarded by the session's durable
 * history). Session-start inbox injection was dropped: a blank-session preset
 * switch (agentPreset.select -> recompose) can clear the inbox before the
 * first step, losing the gate for the whole session. The pre-step decision is
 * the durable path - anchored/bootstrap presets that strip first-step injected
 * reminders (skill catalog, AGENTS.md, gate plugins) simply defer this message
 * to the first step after their promotion, and the history guard re-injects it
 * there. The default gate text is the dsh-native adaptation of
 * `hooks/session-start-content.md`: behavior rules
 * (1% Rule / Red Flags / Plan Verification Gate) stay in sync, while
 * presentation is adapted to dsh's native skill catalog — no roster table
 * (the model sees skills in its catalog) and no install instructions (those
 * live in `.dsh/INSTALL.md`). Deployments override via Config.
 *
 * @module embedded-workbench-dsh
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "embedded-workbench";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    gateContent: string;
}
export declare const Config: z<Schemastery.ObjectS<{
    enabled: z<boolean, boolean>;
    gateContent: z<string, string>;
}>, Schemastery.ObjectT<{
    enabled: z<boolean, boolean>;
    gateContent: z<string, string>;
}>>;
export declare function apply(ctx: Context, config: Config): void;
