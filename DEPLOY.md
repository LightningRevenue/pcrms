# Deploying to EC2 from GitHub

This guide takes a fresh EC2 instance to a running CRM: Postgres, Redis, the four
background workers, and the Next.js app itself, all via Docker.

## 0. Before you start: secrets

`.env.example` in this repo currently has real-looking values checked in (an
`AUTH_SECRET` and a Google OAuth client secret), not placeholders. **Do not commit
that file as-is, and rotate both values before going further**:

- Generate a new `AUTH_SECRET`: `openssl rand -base64 32`
- In Google Cloud Console → APIs & Services → Credentials, create a new OAuth
  client secret for the existing client (or a new client), then delete/revoke the
  old one.

Everything below assumes you have fresh values ready to paste into `.env` on the
server — never reuse whatever is currently in `.env.example`.

## 1. Launch the EC2 instance

- **AMI**: Ubuntu 22.04 or 24.04 LTS
- **Size**: t3.medium minimum (Postgres + Redis + Next.js + 4 workers all running
  at once; t3.small will swap under load)
- **Security group inbound rules**:
  - 22 (SSH) — from your IP only
  - 80/443 (HTTP/HTTPS) — from anywhere, if serving the app directly from this box
  - Leave 5433 (Postgres) and 6380 (Redis) closed to the outside — the app and
    workers reach them over the Docker network, not the public internet

## 2. Install Docker on the instance

```bash
ssh ubuntu@<your-ec2-public-ip>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # picks up the group without needing to log out/in

docker --version
docker compose version
```

## 3. Clone the repo

```bash
git clone https://github.com/<your-org>/<your-repo>.git crm-app
cd crm-app
```

If the repo is private, use a GitHub personal access token in the URL, or set up
a deploy key first (`ssh-keygen`, add the public key as a deploy key on the repo,
then clone over SSH).

## 4. Configure environment variables

```bash
cp .env.example .env
nano .env   # or vim/your editor of choice
```

Fill in real values:

```bash
DATABASE_URL="postgresql://crm:crm@localhost:5433/crm"
REDIS_URL="redis://localhost:6380"

AUTH_SECRET="<paste the openssl rand -base64 32 value from step 0>"
AUTH_GOOGLE_ID="<your Google OAuth client ID>"
AUTH_GOOGLE_SECRET="<your NEW Google OAuth client secret>"
```

`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` come from the same Google Cloud OAuth
client used in dev — but add this EC2 instance's URL to the client's **Authorized
redirect URIs** first: `https://your-domain.com/api/auth/callback/google` (or
`http://<ec2-ip>:3000/api/auth/callback/google` if you're not on a domain yet).

## 5. Start Postgres, Redis, and the background workers

```bash
docker compose up -d
```

This builds and starts `postgres`, `redis`, `gmail-sync-worker`,
`import-worker`, `sequence-worker`, and `imap-poll-worker` — everything except
the Next.js app itself, which docker-compose.yml doesn't define a service for
yet (it's meant to run via `npm`/PM2 alongside, see step 7).

Check everything came up:

```bash
docker compose ps
```

All five containers should show `Up`. If one is missing, check its logs:

```bash
docker compose logs <service-name> --tail 50
```

## 6. Run database migrations

The app container needs Node + the repo checked out to run this — do it from
the host directly (Node 22+ required):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

npm ci
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` (not `migrate dev`) applies existing migrations without
prompting — the right command for a server, since it never tries to create a
new migration interactively.

## 7. Build and start the Next.js app

```bash
npm run build
```

Run it under a process manager so it survives reboots and SSH disconnects —
PM2 is the simplest option:

```bash
sudo npm install -g pm2
pm2 start npm --name crm-app -- start
pm2 save
pm2 startup   # follow the printed command to enable on-boot start
```

The app now listens on port 3000. Point a reverse proxy (nginx/Caddy) at it for
port 80/443 + TLS, or open port 3000 directly in the security group for a quick
test.

Minimal nginx reverse proxy, if you want one:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then `sudo certbot --nginx` for a free TLS cert if you have a domain pointed at
the instance.

## 8. First login

Open the app in a browser and sign in with Google. The **first account to sign
in becomes the workspace owner** and its email domain becomes the only domain
allowed to sign in afterward (see `src/lib/auth.ts`) — sign in with the account
you want as the primary workspace owner first.

## Redeploying after a `git push`

```bash
cd crm-app
git pull

npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart crm-app

docker compose up -d --build   # rebuilds any worker whose code changed
```

## Useful commands

```bash
docker compose ps                          # container status
docker compose logs -f <service>           # tail logs for one service
docker compose restart <service>           # restart one worker
docker compose down                        # stop everything (keeps volumes)
pm2 logs crm-app                           # tail Next.js app logs
pm2 restart crm-app                        # restart just the app
```

## Data persistence

Postgres and Redis data live in Docker named volumes (`pgdata`, `redisdata`) —
they survive `docker compose down` and container restarts, but **not**
`docker compose down -v` (which deletes volumes) or terminating the EC2
instance itself without an EBS snapshot. Back up the `pgdata` volume (or better,
switch to a managed RDS Postgres instance) before treating this as anything
beyond a test/staging environment.
