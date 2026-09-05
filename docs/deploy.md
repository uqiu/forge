# Continuous deployment

Every push to `main` runs the tests, builds an arm64 image, pushes it to GHCR,
and rolls it out to the home server:

```
push / merge to main
   ↓
release.yml → test (ci.yml)
   ↓
uqiu/cicd ship.yml → build arm64 image → ghcr.io/uqiu/forge:latest
   ↓
                   → runner joins the tailnet → SSH into the server
   ↓
                     git pull + docker compose pull + up -d
   ↓
                     poll /api/health; on failure, print logs and fail
```

The image is built on GitHub's machines. The server only pulls a finished
image, so its CPU never compiles anything.

A manual run (Actions → *Publish and deploy* → Run workflow) redeploys without
a code change — that is the way to retry a failed deploy or roll back after
reverting. Every build is tagged with its commit sha as well as `latest`, so a
rollback can pin `image: ghcr.io/uqiu/forge:<sha>` in compose.

## What lives where

Everything after the tests is shared with the other projects on the same box
and lives in **[uqiu/cicd](https://github.com/uqiu/cicd)** — the build, the
Tailscale hop, the SSH deploy, the health check, and the script that seeds the
six deploy secrets into a repository. Its README is the reference; go there to
add another project, to change how deploys work, or when one fails.

What's specific to Forge is the whole of `.github/workflows/release.yml`:

| | |
|---|---|
| Tests | `ci.yml` — frontend build + timer tests, pytest, a boot check |
| Server directory | `~/forge`, or a `DEPLOY_DIR` repository variable |
| Health check | `http://127.0.0.1:8081/api/health` |
| Build runner | `ubuntu-24.04-arm` — free for public repositories, and native aarch64 beats emulating it under QEMU |

`ci.yml` has no `push` trigger on purpose: `release.yml` calls it, so a main
push runs the tests once and ships only if they pass, rather than testing and
publishing in parallel and deploying a broken image.

## Server

Forge runs from the repository checkout at `~/forge`, with `docker-compose.yml`
at the top of it. The deploy syncs that checkout before pulling, so changes to
the compose file reach the server on their own.

State is the single `/data` volume — see the self-hosting section of the
README. Deploys don't touch it.
