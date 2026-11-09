#!/bin/sh
# SessionStart hook: put the Node version from .nvmrc on PATH for Bash tool calls,
# so commands need no nvm boilerplate. Silent no-op if nvm or CLAUDE_ENV_FILE is missing.
[ -n "$CLAUDE_ENV_FILE" ] || exit 0
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] || exit 0
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
cd "${CLAUDE_PROJECT_DIR:-.}" && nvm use >/dev/null 2>&1 || exit 0
echo "export PATH=\"$(dirname "$(command -v node)"):\$PATH\"" >> "$CLAUDE_ENV_FILE"
