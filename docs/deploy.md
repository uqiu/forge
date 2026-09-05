# Continuous deployment

Every push to `main` runs the tests, builds an arm64 image, pushes it to GHCR,
and rolls it out to the home server:

```
push / merge to main
   ↓
release.yml → test (calls ci.yml)
   ↓
build arm64 image → push to ghcr.io/uqiu/forge:latest
   ↓
runner joins the tailnet → SSH into the server
   ↓
git pull + docker compose pull + up -d
   ↓
poll /api/health from the server; on failure, print container logs and fail
```

The image is built on GitHub's machines. The server only pulls a finished
image, so its CPU never compiles anything.

A manual run (Actions → *Publish and deploy* → Run workflow) redeploys without
a code change — that is the way to retry a failed deploy or roll back after
reverting.

## The reusable half

The deploy job lives in
[`.github/workflows/deploy-to-server.yml`](../.github/workflows/deploy-to-server.yml)
as a `workflow_call` workflow, so other projects deploy to the same server
without copying any of it:

```yaml
deploy:
  needs: publish
  uses: uqiu/forge/.github/workflows/deploy-to-server.yml@main
  with:
    dir: ~/myproject           # where the compose file lives on the server
    compose-dir: deploy        # omit when compose.yaml is at the top of `dir`
    health-url: http://127.0.0.1:8930/healthz
  secrets: inherit
```

It sits in Forge because Forge is public: a reusable workflow in a public
repository can be called from anywhere with no access configuration, while one
in a private repository has to grant access to each caller. Moving it to a
dedicated repo later is a file move plus one line per call site.

`diagnostics: true` adds `tailscale status` output when a deploy fails
mysteriously. Leave it off in public repositories — Actions logs there are
world-readable and that output lists every device on the tailnet.

## Per-repository setup

GitHub has no account-wide secrets for personal accounts, so each repository
needs its own copy. Six secrets, same values for every project:

| Secret | What it is |
|---|---|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client id, scoped to `tag:ci` |
| `TS_OAUTH_SECRET` | its secret |
| `DEPLOY_SSH_KEY` | private key of the deploy-only SSH keypair |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan <server>` output, pinning the fingerprint |
| `DEPLOY_HOST` | the server's tailnet hostname |
| `DEPLOY_USER` | the SSH user on the server |

The server directory is an input (`dir`), not a secret — it differs per project
and isn't sensitive. Override Forge's default with a `DEPLOY_DIR` repository
*variable* if the checkout isn't at `~/forge`.

Setting them from the CLI, signed in as the repository owner:

```bash
gh secret set TS_OAUTH_CLIENT_ID  -R uqiu/<repo> --body '...'
gh secret set TS_OAUTH_SECRET     -R uqiu/<repo> --body '...'
gh secret set DEPLOY_SSH_KEY      -R uqiu/<repo> < ~/.ssh/deploy_ed25519
gh secret set DEPLOY_KNOWN_HOSTS  -R uqiu/<repo> --body "$(ssh-keyscan <server> 2>/dev/null)"
gh secret set DEPLOY_HOST         -R uqiu/<repo> --body '<server>'
gh secret set DEPLOY_USER         -R uqiu/<repo> --body '<user>'
```

Secret *values* can't be read back out of GitHub, so keep the originals
wherever you generated them — copying a project means re-entering, not
exporting.

## One-time server setup

Already done for Forge; this is the checklist for the next project.

1. **Docker**

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER    # log back in for this to take effect
   ```

2. **The checkout.** The deploy runs `git fetch && git reset --hard origin/main`
   when the directory is a git checkout, so changes to `docker-compose.yml`
   reach the server on their own:

   ```bash
   git clone https://github.com/uqiu/forge.git ~/forge
   cd ~/forge && docker compose up -d
   ```

   A directory holding only a hand-copied compose file also works — the deploy
   skips the sync and just pulls the image — but then compose changes are on you.

3. **GHCR login**, only for private images (Forge's is public):

   ```bash
   echo '<classic PAT with read:packages>' | docker login ghcr.io -u uqiu --password-stdin
   ```

4. **A deploy-only SSH key.** Generate it locally, don't reuse a personal one:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/deploy_ed25519 -C 'github-actions deploy'
   ssh-copy-id -i ~/.ssh/deploy_ed25519.pub <user>@<server>
   ```

5. **Tailscale ACL.** `tag:ci` needs to reach port 22 on the server, and
   `sshd` has to listen on the tailscale interface.

## When a deploy fails

- **`tailscaled is NeedsLogin, not Running`** — the OAuth client is invalid or
  `tag:ci` isn't in the tailnet policy file.
- **SSH times out but the tailnet check passed** — the ACL doesn't allow
  `tag:ci → server:22`, or `sshd` isn't listening on the tailscale interface.
- **Health check times out** — the container logs are printed in the same step.
  The service is likely up but slow, or the image is broken; `docker compose
  logs` on the server has the rest.
