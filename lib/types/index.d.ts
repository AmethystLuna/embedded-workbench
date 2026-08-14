/**
 * embedded-workbench — DeepSeek Harness native plugin for the Embedded
 * Workbench toolbox. Injects the session-start gate text (1% Rule, Red
 * Flags, Plan Verification Gate, skills roster) into the first model step
 * of every agent session, mirroring the SessionStart hook the Claude Code
 * plugin installs. The 7 skills themselves are discovered by dsh's
 * `skill-filesystem` provider and need no code.
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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "embedded-workbench";
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
