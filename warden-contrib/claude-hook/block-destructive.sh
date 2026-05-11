#!/bin/bash
# Warden Security Hook — Pre-tool-use hook blocking destructive bash commands
# Installed to ~/.claude/hooks/block-destructive.sh

set -e

HOOK_NAME="warden-block-destructive"
LOG_FILE="$HOME/.claude/hooks/blocked.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE" 2>/dev/null || true

# Read the command from stdin (Claude Code hooks pass the cmd line)
CMD_LINE=""
if [ ! -t 0 ]; then
    CMD_LINE=$(cat 2>/dev/null || echo "")
fi

# Merge all args into a single command string for pattern matching
FULL_CMD="${CMD_LINE:-$*}"

# Skip if empty
if [ -z "$FULL_CMD" ]; then
    exit 0
fi

# Dangerous patterns (case-insensitive where applicable)
PATTERNS=(
    "rm -rf[[:space:]]+/"
    "rm[[:space:]]+-rf[[:space:]]+--no-preserve-root"
    "DROP[[:space:]]+TABLE"
    "git[[:space:]]+push[[:space:]]+--force"
    "git[[:space:]]+push[[:space:]]+-f[[:space:]]"
    "TRUNCATE[[:space:]]+"
)

# Pattern for DELETE FROM that must have WHERE to pass
DELETE_NO_WHERE=1
if echo "$FULL_CMD" | grep -qiE "^[[:space:]]*DELETE[[:space:]]+FROM"; then
    if ! echo "$FULL_CMD" | grep -qiE "[[:space:]]+WHERE[[:space:]]+"; then
        # Log the blocked attempt
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        PROJECT_PATH="${PWD:-unknown}"
        echo "[$TIMESTAMP] BLOCKED | project=$PROJECT_PATH | command=$FULL_CMD" >> "$LOG_FILE"

        cat >&2 <<-EOF

        ╔══════════════════════════════════════════════════════╗
        ║  🛡️ WARDEN SECURITY HOOK: COMMAND BLOCKED          ║
        ╠══════════════════════════════════════════════════════╣
        ║  Pattern: DELETE FROM without WHERE clause          ║
        ║  Logged: $LOG_FILE            ║
        ║                                                      ║
        ║  Suggestion: If this is intentional, add a WHERE    ║
        ║  clause to make it explicit (e.g. WHERE 1=1)        ║
        ╚══════════════════════════════════════════════════════╝

EOF
        exit 1
    fi
fi

for pattern in "${PATTERNS[@]}"; do
    if echo "$FULL_CMD" | grep -qiE "$pattern"; then
        # Log the blocked attempt
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        PROJECT_PATH="${PWD:-unknown}"
        echo "[$TIMESTAMP] BLOCKED | project=$PROJECT_PATH | command=$FULL_CMD" >> "$LOG_FILE"

        # Print block message to stderr
        cat >&2 <<-EOF

        ╔══════════════════════════════════════════════════════╗
        ║  🛡️ WARDEN SECURITY HOOK: COMMAND BLOCKED          ║
        ╠══════════════════════════════════════════════════════╣
        ║  A destructive command was intercepted and           ║
        ║  prevented from executing.                          ║
        ║                                                      ║
        ║  Pattern flagged                                    ║
        ║  Logged to: $LOG_FILE            ║
        ║                                                      ║
        ║  To allow this command, disable the hook:            ║
        ║  mv ~/.claude/hooks/block-destructive.sh ~/.claude/  ║
        ╚══════════════════════════════════════════════════════╝

EOF
        exit 1
    fi
done

# Command is safe — pass through
exit 0
