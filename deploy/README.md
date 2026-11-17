# AWS EC2 deployment

This is the first-stage deployment for LodgeCore. It runs the three server-rendered
Next.js applications (`web`, `website`, and `hotel-stanzel`) on EC2 and keeps
PostgreSQL on Neon.

## On the EC2 host

Install Docker and Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in, then clone the repository into `/opt/hotel_pms`:

```bash
sudo mkdir -p /opt/hotel_pms
sudo chown "$USER":"$USER" /opt/hotel_pms
git clone YOUR_REPOSITORY_URL /opt/hotel_pms
cd /opt/hotel_pms
cp deploy/.env.aws.example deploy/.env.aws
chmod 600 deploy/.env.aws
cp deploy/nginx/conf.d/lodgecore.conf.example deploy/nginx/conf.d/lodgecore.conf
```

Edit both files. Replace the example hostnames and enter production secrets only
on the server. Do not put secrets into Git.

Build and start the applications:

```bash
docker compose -f deploy/docker-compose.aws.yml build
docker compose --env-file deploy/.env.aws -f deploy/docker-compose.aws.yml up -d
docker compose -f deploy/docker-compose.aws.yml ps
```

Apply Prisma migrations from a one-off application container only after taking a
Neon backup and verifying the target `DATABASE_URL`:

```bash
docker compose --env-file deploy/.env.aws -f deploy/docker-compose.aws.yml run --rm pms \
  pnpm --filter @hotel-pms/db exec prisma migrate deploy
```

The first deployment should be tested over HTTP using temporary DNS records.
After that, issue certificates with Certbot and change the Nginx configuration
to HTTPS. Do not change production DNS or disable Vercel until login, booking,
payments, uploads, desktop sync, webhooks, and cron jobs have passed.
