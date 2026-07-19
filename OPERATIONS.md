# Operating the EC2 deployment

Quick reference for day-to-day work on the live server: shipping code changes,
restarting services, checking logs, and what to do when something's broken.

Server: `63.177.98.83` (Ubuntu 24.04), app at `https://crm.lightning-revenue.com`,
repo at `~/crm-app` on the server, user `ubuntu`.

For the initial from-scratch setup (installing Docker/Node/nginx/certbot,
first clone, first build), see `DEPLOY.md` instead — this file assumes all of
that is already done.

## Connecting

```bash
ssh -i "/path/to/CRM_PEM.pem" ubuntu@63.177.98.83
```

Every command below can also be run remotely in one line from your machine:

```bash
ssh -i "/path/to/CRM_PEM.pem" ubuntu@63.177.98.83 "cd ~/crm-app && <command>"
```

## Shipping a code change (the normal flow)

1. Push the change to `main` on GitHub from your machine, same as any commit.
2. On the server:

```bash
cd ~/crm-app
git pull origin main
npm ci                      # only if package.json/package-lock.json changed
npx prisma migrate deploy   # only if prisma/migrations has new files
npx prisma generate         # only if the schema changed
npm run build
pm2 restart crm-app
```

3. If a **worker's** code changed (`worker/*.ts` or anything it imports from
   `src/lib`), also rebuild the Docker images:

```bash
docker compose up -d --build
```

If nothing under `worker/` or its dependencies changed, skip this — no need to
rebuild workers for a UI-only change.

### One-liner for a typical "just ship the code" update

```bash
ssh -i "/path/to/CRM_PEM.pem" ubuntu@63.177.98.83 \
  "cd ~/crm-app && git pull origin main && npm ci && npx prisma migrate deploy && npx prisma generate && npm run build && pm2 restart crm-app"
```

## Restarting things

```bash
pm2 restart crm-app                        # the Next.js app only
docker compose restart <service>           # one worker, e.g. imap-poll-worker
docker compose restart                     # all workers + postgres + redis
sudo systemctl reload nginx                # after editing nginx config
```

## Checking status / logs

```bash
pm2 status                                 # is the app running?
pm2 logs crm-app --lines 50 --nostream     # recent app logs (out + error)
pm2 logs crm-app --err --lines 50 --nostream   # just errors

docker compose ps                          # container status
docker compose logs -f <service>           # tail one worker's logs live
docker compose logs <service> --tail 50    # last 50 lines, no follow
```

## Environment variables (`.env`)

Lives at `~/crm-app/.env` on the server, **not** committed to git. To change a
value:

```bash
nano ~/crm-app/.env
pm2 restart crm-app --update-env    # --update-env is required, or PM2 keeps the old values
```

If you add a brand-new variable the Docker workers also need, they pick it up
automatically from `.env` via `docker-compose.yml`'s `${VAR}` references — just
`docker compose up -d` again (no rebuild needed for env-only changes).

## Database migrations

Always `migrate deploy`, never `migrate dev`, on the server — `dev` is
interactive and expects a TTY:

```bash
cd ~/crm-app
npx prisma migrate deploy
npx prisma generate
pm2 restart crm-app   # if the app was already running against the old client
```

## Rolling back a bad deploy

```bash
cd ~/crm-app
git log --oneline -5              # find the last good commit
git checkout <good-commit-hash> -- .    # or: git reset --hard <hash> if you're sure
npm ci && npx prisma generate && npm run build
pm2 restart crm-app
```

Prefer `git revert <bad-commit>` + push from your machine over resetting
directly on the server, so the fix is tracked in history and the next
`git pull` on the server doesn't fight with local changes.

## Common gotchas specific to this app

- **New `.env` vars need `pm2 restart crm-app --update-env`** — a plain
  `pm2 restart` keeps the old environment.
- **Schema changes need both `migrate deploy` and `generate`, then a rebuild** —
  a stale Prisma Client after a schema change causes confusing runtime errors
  about missing fields/models.
- **Worker code isn't picked up by `pm2 restart`** — workers run in Docker,
  entirely separate from the PM2-managed Next.js process. Use
  `docker compose up -d --build` for worker changes.
- **`AUTH_URL` must stay correct** in `.env` — if the domain ever changes, update
  `AUTH_URL` there and add the new callback URL in Google Cloud Console, or
  Google sign-in breaks with `redirect_uri_mismatch`.
- Pages under `(app)` and `settings` have `export const dynamic = "force-dynamic"`
  in their layouts — don't remove it, or Next.js will prerender them as static
  HTML and the auth middleware won't run on repeat visits.

## Useful one-off checks

```bash
# Confirm the app is actually serving over HTTPS with a valid redirect for logged-out users
curl -s -D - -o /dev/null https://crm.lightning-revenue.com/dashboards | head -6
# Expect: 307 Temporary Redirect, location: /login

# Confirm Auth.js is generating the right callback URLs (not localhost)
curl -s https://crm.lightning-revenue.com/api/auth/providers

# Check disk space (Postgres/Redis volumes, npm/docker build cache can add up)
df -h /

# Check memory (workers + app + Postgres + Redis all share this box)
free -h
```
