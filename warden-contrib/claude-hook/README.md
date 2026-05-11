# 🛡️ Warden Block-Destructive Hook

A Claude Code `pre-tool-use` hook that intercepts dangerous bash commands before they execute.

## What it blocks

| Pattern | Example Blocked |
|---------|----------------|
| `rm -rf /` | `rm -rf /`, `rm -rf /*` |
| `rm --no-preserve-root` | `rm -rf --no-preserve-root /` |
| `DROP TABLE` | `DROP TABLE users;` |
| `git push --force` | `git push --force origin main` |
| `TRUNCATE` | `TRUNCATE transactions;` |
| `DELETE FROM` (no WHERE) | `DELETE FROM users;` |

Safe commands pass through normally. `DELETE FROM ... WHERE ...` is **allowed** (has a WHERE clause).

## Installation

```bash
mkdir -p ~/.claude/hooks
curl -o ~/.claude/hooks/block-destructive.sh <URL>/block-destructive.sh
chmod +x ~/.claude/hooks/block-destructive.sh
```

Or clone this repo:

```bash
git clone <this-repo> ~/.claude/hooks/warden-hook
ln -s ~/.claude/hooks/warden-hook/block-destructive.sh ~/.claude/hooks/block-destructive.sh
```

## How it works

1. Claude Code calls the hook before each bash tool execution
2. The hook scans the command string against known destructive patterns
3. If matched → logs to `~/.claude/hooks/blocked.log`, displays a warning, exits with 1
4. If safe → exits 0, command runs normally

## Log output format

```
[2026-05-11T04:50:00Z] BLOCKED | project=/home/user/project | command=rm -rf /
```

## Uninstall

```bash
rm ~/.claude/hooks/block-destructive.sh
rm -rf ~/.claude/hooks/warden-hook
```
