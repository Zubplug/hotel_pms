# AWS EC2 deployment

This deployment runs the three server-rendered Next.js applications (`web`,
`website`, and `hotel-stanzel`) on EC2 and keeps PostgreSQL on Neon.

Production does not build application images. GitHub Actions builds immutable
images on a GitHub-hosted runner, publishes them to Amazon ECR, and the AWS
deployment runner only pulls and starts the requested commit SHA. This keeps
the production host out of the memory-intensive build path.

## Required GitHub configuration

Configure these repository variables and secrets before enabling the workflow:

- Variable `AWS_ACCOUNT_ID`: the AWS account ID containing the ECR repositories.
- Variable `AWS_REGION`: normally `eu-north-1`.
- Secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: temporary IAM user
  credentials with permission to push only to the three `lodgecore-*` ECR
  repositories. These are a temporary fallback until GitHub OIDC is available.
- Secret `BUILD_AUTH_SECRET`: the same Auth.js build secret used by production.

The preferred production configuration is GitHub OIDC using
`AWS_ECR_PUBLISH_ROLE_ARN`. Do not add that role assumption step until the AWS
OIDC provider is available. Rotate and remove the temporary access key secrets
after migrating to OIDC.

The EC2 instance role must be allowed to authenticate to ECR and pull images.
The deployment runner also needs `aws`, Docker Compose, and the existing
`lodgecore-aws` label. Do not put ECR credentials in Git or in `.env.aws`.

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
on the server. Do not put secrets into Git. The deployment workflow supplies
`PMS_IMAGE`, `WEBSITE_IMAGE`, and `STANZEL_IMAGE` from the immutable commit SHA.

For a manual deployment, set the three image variables explicitly and start the
applications:

```bash
export PMS_IMAGE=ACCOUNT.dkr.ecr.eu-north-1.amazonaws.com/lodgecore-pms:COMMIT_SHA
export WEBSITE_IMAGE=ACCOUNT.dkr.ecr.eu-north-1.amazonaws.com/lodgecore-website:COMMIT_SHA
export STANZEL_IMAGE=ACCOUNT.dkr.ecr.eu-north-1.amazonaws.com/lodgecore-stanzel:COMMIT_SHA
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.eu-north-1.amazonaws.com
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
