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
