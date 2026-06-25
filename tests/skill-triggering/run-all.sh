#!/usr/bin/env bash
# Run all skill-triggering tests
# Usage: ./run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local skill="$2"
    local prompt="$3"
    local expect="$4"

    echo "=== $name ==="
    if "$SCRIPT_DIR/run-test.sh" "$skill" "$SCRIPT_DIR/prompts/$prompt" "$expect"; then
        PASS=$((PASS + 1))
        echo ""
    else
        FAIL=$((FAIL + 1))
        echo ""
    fi
}

# Positive tests (should trigger)
echo "===== POSITIVE TESTS (should trigger) ====="
echo ""
run_test "HardFault crash → hardfault-triage" "hardfault-triage" "hardfault-crash.txt" "trigger"
run_test "State machine retry → state-machine-design" "state-machine-design" "state-machine-retry.txt" "trigger"
run_test "Keil build error → keil-mdk-build" "keil-mdk-build" "keil-build.txt" "trigger"
run_test "Design doc review → fact-verification" "fact-verification" "design-review-fact-verify.txt" "trigger"
run_test "Explicit skill request → hardfault-triage" "hardfault-triage" "explicit-hardfault.txt" "trigger"
run_test "FreeRTOS ISR boundary → embedded-firmware-dev" "embedded-firmware-dev" "freertos-isr-boundary.txt" "trigger"

# Negative tests (should NOT trigger)
echo "===== NEGATIVE TESTS (should NOT trigger) ====="
echo ""
run_test "Read config.h → NOT c-cpp-dev" "c-cpp-dev" "read-config-no-skill.txt" "no-trigger"
run_test "Fix Makefile → NOT keil-mdk-build" "keil-mdk-build" "makefile-no-skill.txt" "no-trigger"
run_test "Format code → NOT c-cpp-dev" "c-cpp-dev" "format-code-no-skill.txt" "no-trigger"
run_test "Desktop C++ crash → NOT c-cpp-dev" "c-cpp-dev" "desktop-cpp-no-skill.txt" "no-trigger"

# Multi-skill load order test
echo "===== LOAD ORDER TESTS ====="
echo ""
run_test "Debug → StateMachine load order" "debug-methodology" "multi-skill-load-order.txt" "trigger"

echo "===== SUMMARY ====="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total:  $((PASS + FAIL))"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
