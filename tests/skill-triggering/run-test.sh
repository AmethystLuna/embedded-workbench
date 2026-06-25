#!/usr/bin/env bash
# Trigger precision test for embedded-workbench skills
# Usage: ./run-test.sh <skill-name> <prompt-file> [expect: trigger|no-trigger]
#
# Tests whether a skill is triggered (or NOT triggered) by a natural prompt
# without explicitly mentioning the skill name.

set -e

SKILL_NAME="$1"
PROMPT_FILE="$2"
EXPECT="${3:-trigger}"
MAX_TURNS="${4:-3}"

if [ -z "$SKILL_NAME" ] || [ -z "$PROMPT_FILE" ]; then
    echo "Usage: $0 <skill-name> <prompt-file> [trigger|no-trigger] [max-turns]"
    echo "Example: $0 hardfault-triage prompts/hardfault-crash.txt trigger"
    echo "         $0 c-cpp-dev prompts/read-config.txt no-trigger"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

TIMESTAMP=$(date +%s)
OUTPUT_DIR="/tmp/embedded-workbench-tests/${TIMESTAMP}/skill-triggering/${SKILL_NAME}"
mkdir -p "$OUTPUT_DIR"

PROMPT=$(cat "$PROMPT_FILE")

echo "=== Skill Triggering Test ==="
echo "Skill: $SKILL_NAME"
echo "Expect: $EXPECT"
echo "Prompt file: $PROMPT_FILE"
echo "Max turns: $MAX_TURNS"
echo "Output dir: $OUTPUT_DIR"
echo ""

cp "$PROMPT_FILE" "$OUTPUT_DIR/prompt.txt"

LOG_FILE="$OUTPUT_DIR/claude-output.json"
cd "$OUTPUT_DIR"

echo "Running claude -p with naive prompt..."
timeout 300 claude -p "$PROMPT" \
    --plugin-dir "$PLUGIN_DIR" \
    --dangerously-skip-permissions \
    --max-turns "$MAX_TURNS" \
    --output-format stream-json \
    > "$LOG_FILE" 2>&1 || true

echo ""
echo "=== Results ==="

# Check if the specific skill was triggered
SKILL_PATTERN='"skill":"([^"]*:)?'"${SKILL_NAME}"'"'
if grep -q '"name":"Skill"' "$LOG_FILE" && grep -qE "$SKILL_PATTERN" "$LOG_FILE"; then
    TRIGGERED=true
else
    TRIGGERED=false
fi

if [ "$EXPECT" = "trigger" ] && [ "$TRIGGERED" = "true" ]; then
    echo "PASS: Skill '$SKILL_NAME' was triggered (expected)"
    exit 0
elif [ "$EXPECT" = "no-trigger" ] && [ "$TRIGGERED" = "false" ]; then
    echo "PASS: Skill '$SKILL_NAME' was NOT triggered (expected)"
    exit 0
elif [ "$EXPECT" = "trigger" ] && [ "$TRIGGERED" = "false" ]; then
    echo "FAIL: Skill '$SKILL_NAME' was NOT triggered (expected trigger)"
    echo ""
    echo "Skills actually triggered:"
    grep -o '"skill":"[^"]*"' "$LOG_FILE" 2>/dev/null | sort -u || echo "  (none)"
    exit 1
else
    echo "FAIL: Skill '$SKILL_NAME' WAS triggered (expected no-trigger)"
    exit 1
fi
