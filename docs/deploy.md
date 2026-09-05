# Continuous deployment

Every push to `main` runs the tests, builds an arm64 image, pushes it to GHCR,
and rolls it out to the home server:

```
push / merge to main
   ↓
release.yml → test (calls ci.yml)
   ↓
ship.yml → build arm64 image → push to ghcr.io/uqiu/forge:latest
   ↓
        → runner joins the tailnet → SSH into the server
   ↓
          git pull + docker compose pull + up -d
   ↓
          poll /api/health from the server; on failure, print logs and fail
```

The image is built on GitHub's machines. The server only pulls a finished
image, so its CPU never compiles anything.

A manual run (Actions → *Publish and deploy* → Run workflow) redeploys without
a code change — that is the way to retry a failed deploy or roll back after
reverting.

## Adding a new project

Everything after the tests is shared, so a new project needs three things.

**1. A workflow.** Copy `release.yml` and change three values:

```yaml
name: Publish and deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      tag:
        description: Additional image tag (e.g. v0.1.0).
        required: false

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  test:
    uses: ./.github/workflows/ci.yml      # your own tests

  ship:
    needs: test
    uses: uqiu/forge/.github/workflows/ship.yml@main
    with:
      dir: ~/myproject                    # where it lives on the server
      health-url: http://127.0.0.1:8930/healthz
      tag: ${{ inputs.tag }}
    secrets: inherit
```

Other inputs, all optional: `compose-dir` (when compose.yaml isn't at the top
of `dir`), `dockerfile`, `context`, `platforms`, `build-args`, `runner`,
`health-timeout`, `auto-clone`, `diagnostics`.

**Public repositories should set `runner: ubuntu-24.04-arm`.** GitHub's arm64
runners are free for public repositories and build the image natively; the
default x86 runner emulates aarch64 under QEMU, which is several times slower.
Private repositories don't get them for free, hence the default.

**2. The secrets:**

```bash
scripts/seed-deploy-secrets.sh uqiu/myproject
```

**3. Nothing on the server** — the first deploy clones the repository into
`dir` itself. That needs a public repository (it clones over anonymous HTTPS);
for a private one, clone it there once by hand and the deploy takes over.

Pick a port no other service on the box uses, and bind it to `127.0.0.1` in
compose so only the reverse proxy and tailnet reach it.

### ship.yml or deploy-to-server.yml

`ship.yml` is build-and-deploy. When there is nothing to build — a redeploy, or
an image built elsewhere — call the deploy half on its own:

```yaml
uses: uqiu/forge/.github/workflows/deploy-to-server.yml@main
```

Both live in Forge because Forge is public: a reusable workflow in a public
repository can be called from anywhere with no access configuration, while one
in a private repository has to grant access to each caller. Moving them to a
dedicated repo later is a file move plus one line per call site.

They are pinned at `@main`, so a fix to the deploy logic reaches every project
on its next run with nothing to re-commit.

`diagnostics: true` adds `tailscale status` output when a deploy fails
mysteriously. Leave it off in public repositories — Actions logs there are
world-readable and that output lists every device on the tailnet.

## The secrets

Six, the same values for every project:

| Secret | What it is |
|---|---|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client id, scoped to `tag:ci` |
| `TS_OAUTH_SECRET` | its secret |
| `DEPLOY_SSH_KEY` | private key of the deploy-only SSH keypair |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan <server>` output, pinning the fingerprint |
| `DEPLOY_HOST` | the server's tailnet hostname |
| `DEPLOY_USER` | the SSH user on the server |

The server directory is a workflow input (`dir`), not a secret — it differs per
project and isn't sensitive. Forge additionally honours a `DEPLOY_DIR`
repository *variable* if its checkout isn't at `~/forge`.

**Actions secrets are write-only.** GitHub takes a value encrypted with the
repository's public key and offers no way to read one back; `gh secret list`
returns names and timestamps only. There is no copying them out of a repository
that already has them — so they have to live somewhere you control.

That somewhere is the server. You can read it over SSH, a new laptop needs no
setup, and the runner — which must never read it — can't, because reaching the
server is precisely what these secrets unlock. Set it up once:

```bash
mkdir -p ~/.deploy-secrets && chmod 700 ~/.deploy-secrets
cat > ~/.deploy-secrets/env <<'EOF'
DEPLOY_HOST=my-server
DEPLOY_USER=deploy
TS_OAUTH_CLIENT_ID=k123...
TS_OAUTH_SECRET=tskey-client-...
EOF
chmod 600 ~/.deploy-secrets/env
cp ~/.ssh/hub_deploy ~/.deploy-secrets/ssh_key   # optional; see below
chmod 600 ~/.deploy-secrets/ssh_key
```

Then, from any machine with SSH access:

```bash
scripts/seed-deploy-secrets.sh uqiu/myproject --from me@my-server
scripts/seed-deploy-secrets.sh uqiu/otherproject     # --from is remembered
```

`DEPLOY_KNOWN_HOSTS` isn't stored — the script runs `ssh-keyscan` at the time,
so a rebuilt server re-pins instead of failing a deploy months later with a
fingerprint mismatch. Values are piped over stdin rather than passed as
arguments, which would be visible in `ps`.

Keeping the deploy key in the store is optional; name a local file with
`DEPLOY_SSH_KEY_FILE` in the env file instead if you'd rather it never leave
your laptop. On the server it adds little exposure — that key only opens the
machine an attacker would already be on — and it means a new laptop needs
nothing but SSH access.

If you've lost a value: the Tailscale OAuth **client id** is visible in the
admin console, but the **secret** is shown once at creation — generate a new
client (scoped to `tag:ci`) and delete the old one. The SSH key is whatever
`ssh-copy-id` put in the server's `authorized_keys`.

## One-time server setup

Already done; this is the record of what it took.

1. **Docker**

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER    # log back in for this to take effect
   ```

2. **GHCR login**, only needed for private images:

   ```bash
   echo '<classic PAT with read:packages>' | docker login ghcr.io -u uqiu --password-stdin
   ```

3. **A deploy-only SSH key.** Generate it locally, don't reuse a personal one:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/deploy_ed25519 -C 'github-actions deploy'
   ssh-copy-id -i ~/.ssh/deploy_ed25519.pub <user>@<server>
   ```

4. **Tailscale ACL.** `tag:ci` needs to reach port 22 on the server, and
   `sshd` has to listen on the tailscale interface.

5. **A Tailscale OAuth client** scoped to `tag:ci`, for the runner to join the
   tailnet.

## When a deploy fails

- **`tailscaled is NeedsLogin, not Running`** — the OAuth client is invalid or
  `tag:ci` isn't in the tailnet policy file.
- **SSH times out but the tailnet check passed** — the ACL doesn't allow
  `tag:ci → server:22`, or `sshd` isn't listening on the tailscale interface.
- **Health check times out** — the container logs are printed in the same step.
  The service is likely up but slow, or the image is broken; `docker compose
  logs` on the server has the rest.
- **A deploy fixed the code but the container is still broken** — roll back to
  a known image: every build is also tagged with its commit sha, so
  `docker run ghcr.io/uqiu/<repo>:<sha>` or a pinned `image:` in compose works
  while you sort it out.
