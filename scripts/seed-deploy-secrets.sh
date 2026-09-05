#!/usr/bin/env bash
# Copies the home-server deploy secrets into a repository.
#
#   scripts/seed-deploy-secrets.sh uqiu/myproject
#   scripts/seed-deploy-secrets.sh uqiu/myproject --from me@my-server
#
# GitHub's Actions secrets are write-only — the API takes a value encrypted
# with the repository's public key and never hands one back, so `gh secret
# list` shows names and nothing else. A new repository means re-entering the
# values, which is the friction that makes people skip setting up deployment.
#
# So the values live in one place and this script applies them. The server
# itself is the natural place: you can read it over SSH, a new laptop needs no
# setup, and the runner — which must never read it — can't, because reaching
# the server is exactly what these secrets unlock.
#
# On the server:
#
#   mkdir -p ~/.deploy-secrets && chmod 700 ~/.deploy-secrets
#   cat > ~/.deploy-secrets/env <<'EOF'
#   DEPLOY_HOST=my-server            # tailnet hostname
#   DEPLOY_USER=deploy               # ssh user for the deploy key
#   TS_OAUTH_CLIENT_ID=k123...
#   TS_OAUTH_SECRET=tskey-client-...
#   EOF
#   chmod 600 ~/.deploy-secrets/env
#
# The SSH private key can sit beside it as ~/.deploy-secrets/ssh_key, or stay
# local and be named by DEPLOY_SSH_KEY_FILE in the env file. Keeping it on the
# server adds little exposure — that key only opens the machine an attacker
# would already be on — and it means a new laptop needs nothing but SSH access.
#
# --from is remembered in ~/.config/deploy-secrets.source, so later runs are
# just the repository name. Set DEPLOY_SECRETS_ENV to a local file to skip the
# server entirely.
set -euo pipefail

REPO=''
FROM=''
while [ $# -gt 0 ]; do
  case $1 in
    --from) FROM=${2:-}; shift 2 ;;
    -h | --help) sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) REPO=$1; shift ;;
  esac
done

if [ -z "$REPO" ]; then
  echo "usage: $0 <owner/repo> [--from user@host]" >&2
  exit 2
fi

SOURCE_FILE=$HOME/.config/deploy-secrets.source
REMOTE_DIR=${DEPLOY_SECRETS_DIR:-'~/.deploy-secrets'}

# Everything read out of the store lands in one 700 directory that is deleted
# on the way out, however we exit — nothing sensitive is left in /tmp.
WORK=$(mktemp -d)
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

if [ -n "${DEPLOY_SECRETS_ENV:-}" ]; then
  # An explicit local file wins; used for testing and for working offline.
  if [ ! -f "$DEPLOY_SECRETS_ENV" ]; then
    echo "No secrets file at $DEPLOY_SECRETS_ENV" >&2
    exit 1
  fi
  perms=$(stat -f '%Lp' "$DEPLOY_SECRETS_ENV" 2>/dev/null || stat -c '%a' "$DEPLOY_SECRETS_ENV")
  if [ "$perms" != "600" ]; then
    echo "$DEPLOY_SECRETS_ENV is mode $perms; it holds a Tailscale secret. chmod 600 it." >&2
    exit 1
  fi
  cp "$DEPLOY_SECRETS_ENV" "$WORK/env"
else
  if [ -z "$FROM" ] && [ -f "$SOURCE_FILE" ]; then
    FROM=$(tr -d '[:space:]' < "$SOURCE_FILE")
  fi
  if [ -z "$FROM" ]; then
    echo "Don't know where the secrets live. Pass --from user@host once and" >&2
    echo "it will be remembered in $SOURCE_FILE." >&2
    exit 1
  fi
  echo "Reading the secret store from $FROM:$REMOTE_DIR"
  if ! ssh -o BatchMode=yes "$FROM" "cat $REMOTE_DIR/env" > "$WORK/env" 2>/dev/null; then
    echo "Couldn't read $REMOTE_DIR/env on $FROM." >&2
    echo "Are you on the tailnet, and does the file exist? (see the header of this script)" >&2
    exit 1
  fi
  # Optional: the key may live on the server too.
  ssh -o BatchMode=yes "$FROM" "cat $REMOTE_DIR/ssh_key" > "$WORK/ssh_key" 2>/dev/null || true
  [ -s "$WORK/ssh_key" ] || rm -f "$WORK/ssh_key"
  mkdir -p "$(dirname "$SOURCE_FILE")"
  printf '%s\n' "$FROM" > "$SOURCE_FILE"
fi

# shellcheck disable=SC1091
set -a && . "$WORK/env" && set +a

for var in DEPLOY_HOST DEPLOY_USER TS_OAUTH_CLIENT_ID TS_OAUTH_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "The env file is missing $var" >&2
    exit 1
  fi
done

if [ -f "$WORK/ssh_key" ]; then
  KEY_FILE=$WORK/ssh_key
elif [ -n "${DEPLOY_SSH_KEY_FILE:-}" ]; then
  KEY_FILE=${DEPLOY_SSH_KEY_FILE/#\~/$HOME}
else
  echo "No SSH key: neither $REMOTE_DIR/ssh_key nor DEPLOY_SSH_KEY_FILE." >&2
  exit 1
fi
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
# can explain why. Scanning each time also means a rebuilt server re-pins
# instead of failing a deploy months later on a fingerprint mismatch.
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
echo "   Next: point a workflow at ship.yml — see docs/deploy.md."
