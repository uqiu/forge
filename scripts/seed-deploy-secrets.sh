#!/usr/bin/env bash
# Copies the home-server deploy secrets into a repository.
#
#   scripts/seed-deploy-secrets.sh uqiu/myproject
#
# GitHub's Actions secrets are write-only — the API takes a value encrypted
# with the repository's public key and never hands one back, so `gh secret
# list` shows names and nothing else. There is no exporting them from a
# repository that already has them; the values have to come from somewhere you
# kept them. That somewhere is the env file this script reads.
#
# Keep it at ~/.config/deploy-secrets.env, mode 600:
#
#   DEPLOY_HOST=my-server               # tailnet hostname
#   DEPLOY_USER=deploy                  # ssh user on the server
#   DEPLOY_SSH_KEY_FILE=~/.ssh/hub_deploy
#   TS_OAUTH_CLIENT_ID=k123...
#   TS_OAUTH_SECRET=tskey-client-...
#
# DEPLOY_KNOWN_HOSTS isn't stored — ssh-keyscan regenerates it, which also
# means a rebuilt server updates the pin instead of silently failing later.
set -euo pipefail

REPO=${1:-}
ENV_FILE=${DEPLOY_SECRETS_ENV:-$HOME/.config/deploy-secrets.env}

if [ -z "$REPO" ]; then
  echo "usage: $0 <owner/repo>" >&2
  exit 2
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "No secrets file at $ENV_FILE — see the header of this script." >&2
  exit 1
fi

perms=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")
if [ "$perms" != "600" ]; then
  echo "$ENV_FILE is mode $perms; it holds a Tailscale secret. chmod 600 it." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a && . "$ENV_FILE" && set +a

for var in DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY_FILE TS_OAUTH_CLIENT_ID TS_OAUTH_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "$ENV_FILE is missing $var" >&2
    exit 1
  fi
done

KEY_FILE=${DEPLOY_SSH_KEY_FILE/#\~/$HOME}
if [ ! -f "$KEY_FILE" ]; then
  echo "No SSH key at $KEY_FILE" >&2
  exit 1
fi

# Fail here rather than halfway through, with a clearer reason than the API's
# 403. Seeing a public repository is not the same as being able to write its
# secrets, so check the permission rather than the visibility.
perm=$(gh repo view "$REPO" --json viewerPermission --jq .viewerPermission 2>/dev/null || true)
if [ "$perm" != "ADMIN" ]; then
  who=$(gh api user --jq .login 2>/dev/null || echo '?')
  echo "Signed in as '$who', which has ${perm:-no access} on $REPO." >&2
  echo "Setting secrets needs ADMIN — switch accounts with \`gh auth switch\`." >&2
  exit 1
fi

echo "Scanning $DEPLOY_HOST for its host key…"
# Without `|| true` a failed scan aborts under `set -e` before the check below
# can explain why.
KNOWN_HOSTS=$(ssh-keyscan "$DEPLOY_HOST" 2>/dev/null || true)
if [ -z "$KNOWN_HOSTS" ]; then
  echo "ssh-keyscan got nothing from $DEPLOY_HOST — are you on the tailnet?" >&2
  exit 1
fi

# Values go over stdin, never as arguments: arguments are visible to anyone
# running `ps` while this runs.
set_secret() {
  printf '%s' "$2" | gh secret set "$1" -R "$REPO"
}

set_secret TS_OAUTH_CLIENT_ID "$TS_OAUTH_CLIENT_ID"
set_secret TS_OAUTH_SECRET "$TS_OAUTH_SECRET"
set_secret DEPLOY_SSH_KEY "$(cat "$KEY_FILE")"
set_secret DEPLOY_KNOWN_HOSTS "$KNOWN_HOSTS"
set_secret DEPLOY_HOST "$DEPLOY_HOST"
set_secret DEPLOY_USER "$DEPLOY_USER"

echo
echo "✅ six secrets set on $REPO"
echo "   The server directory is a workflow input (\`dir\`), not a secret."
