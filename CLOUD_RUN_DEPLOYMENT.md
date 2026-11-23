# Dira OS Cloud Run Deployment

This repository deploys the API to Google Cloud Run using the container under `apps/api/Dockerfile`.

## Prerequisites

- A Google Cloud account
- A Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated locally
- This GitHub repository
- MongoDB already hosted somewhere reachable from Cloud Run

## Required Google Cloud APIs

Enable these APIs in the target project:

- Cloud Run API
- Artifact Registry API
- IAM API
- IAM Service Account Credentials API
- Resource Manager API
- Secret Manager API

## Repository layout that matters

- API source: [`apps/api/src/main.ts`](./apps/api/src/main.ts)
- Dockerfile: [`apps/api/Dockerfile`](./apps/api/Dockerfile)
- Cloud Run workflow: [`.github/workflows/deploy-cloud-run.yml`](./.github/workflows/deploy-cloud-run.yml)
- API env template: [`apps/api/.env.example`](./apps/api/.env.example)

## Manual deployment

1. Enable APIs.

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com iamcredentials.googleapis.com cloudresourcemanager.googleapis.com secretmanager.googleapis.com
```

2. Create an Artifact Registry Docker repository if you do not already have one.

```bash
gcloud artifacts repositories create <AR_REPOSITORY> \
  --repository-format=docker \
  --location=<REGION> \
  --description="Dira OS API images"
```

3. Build and push the image from the repo root.

```bash
docker build -f apps/api/Dockerfile -t <REGION>-docker.pkg.dev/<PROJECT_ID>/<AR_REPOSITORY>/bizpro-api:<TAG> .
docker push <REGION>-docker.pkg.dev/<PROJECT_ID>/<AR_REPOSITORY>/bizpro-api:<TAG>
```

4. Deploy to Cloud Run.

```bash
gcloud run deploy bizpro-server \
  --image <REGION>-docker.pkg.dev/<PROJECT_ID>/<AR_REPOSITORY>/bizpro-api:<TAG> \
  --region <REGION> \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 10 \
  --cpu 1 \
  --memory 512Mi \
  --update-env-vars NODE_ENV=production,MONGODB_DB_NAME=vickins_business_os,JWT_EXPIRES_IN=7d \
  --update-secrets MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,SUPPORT_API_KEY=SUPPORT_API_KEY:latest,ADMIN_API_SIGNING_SECRET=ADMIN_API_SIGNING_SECRET:latest,PLATFORM_ERROR_INGEST_KEY=PLATFORM_ERROR_INGEST_KEY:latest
```

## Google Cloud setup for GitHub Actions

This project is configured for keyless GitHub Actions deployment:

- Project: `project-d12aa5f3-be97-4827-b63`
- Workload Identity pool/provider: `github-pool` / `github-provider`
- Provider condition: GitHub repository ID `1278269357` on `refs/heads/master`
- Deployer service account: `bizpro-cloud-run-deployer@project-d12aa5f3-be97-4827-b63.iam.gserviceaccount.com`
- Roles: Cloud Run Admin on the project, Artifact Registry Writer on the `bizpro-api` repository, and Service Account User on the Cloud Run runtime identity

The workflow contains the non-secret project and identity identifiers. It does not need a service-account key or GitHub Actions secret for Google Cloud authentication. The Cloud Run runtime identity already has project-level `roles/secretmanager.secretAccessor` access.

## GitHub deployment

For the existing Cloud Run service, the workflow targets project `project-d12aa5f3-be97-4827-b63`, region `me-central1`, Artifact Registry repository `bizpro-api`, and Cloud Run service `bizpro-server`. The repository and service have different names.

The workflow:

1. Triggers on pushes to the repository's `master` branch or by manual workflow dispatch.
2. Authenticates with Google Cloud using repository- and branch-restricted Workload Identity Federation.
3. Builds the API image from [`apps/api/Dockerfile`](./apps/api/Dockerfile).
4. Pushes the image to Artifact Registry.
5. Deploys the image to Cloud Run while updating only the environment values and secrets named in the workflow. Existing unrelated service settings are preserved.

## Vercel admin project configuration

The production admin project is `biz-pro-admin` at `https://biz-pro-admin.vercel.app`. Set these production variables in Vercel:

| Variable | Value |
| --- | --- |
| `ADMIN_API_BASE_URL` | `https://bizpro-server-u6vceulhlq-ww.a.run.app/api` |
| `ADMIN_PUBLIC_URL` | `https://biz-pro-admin.vercel.app` |
| `BETTER_AUTH_URL` | `https://biz-pro-admin.vercel.app` |
| `MONGODB_DB_NAME` | `vickins_business_os` |
| `MONGODB_URI` | Copy the `MONGODB_URI` value from Google Secret Manager |
| `BETTER_AUTH_SECRET` | Generate a new random value of at least 32 bytes |
| `ADMIN_API_SIGNING_SECRET` | Copy the matching Secret Manager value |
| `PLATFORM_ERROR_INGEST_KEY` | Copy the matching Secret Manager value |

Keep `ADMIN_API_SIGNING_SECRET` and `PLATFORM_ERROR_INGEST_KEY` identical in Vercel and Secret Manager. `SUPPORT_API_KEY` already exists in Vercel; confirm it matches the Secret Manager value if support endpoints are used.

## Environment variables

Required by the API:

- `MONGODB_URI`
- `JWT_SECRET`
- `SUPPORT_API_KEY`
- `ADMIN_API_SIGNING_SECRET` (at least 32 bytes; must match the Vercel admin signing secret)
- `PLATFORM_ERROR_INGEST_KEY` (at least 32 bytes; must match the Vercel error-ingest key)

Required or recommended defaults:

- `NODE_ENV=production`
- `MONGODB_DB_NAME=vickins_business_os`
- `JWT_EXPIRES_IN=7d`
- `PORT=8080` or Cloud Run's injected port

Optional:

- `TUMA_WEBHOOK_SECRET` (the Tuma webhook remains disabled until configured)
- `EXPO_PUSH_ACCESS_TOKEN`
- `CORS_ORIGINS`

Email delivery configuration and Cloud Run secret setup are documented in [`apps/api/EMAIL.md`](./apps/api/EMAIL.md). SMTP is disabled until `MAIL_ENABLED=true`; when enabled, add the provider settings to the Cloud Run service and store `SMTP_USER` / `SMTP_PASS` as Secret Manager-backed runtime secrets. No production SMTP secret has been provisioned by this repository change.

## Secrets

Store sensitive values outside the repository.

- Use Secret Manager for Cloud Run runtime secrets.
- Use GitHub secrets only for deployment authentication values such as the WIF provider and service account email.
- Never commit `.env`.

## MongoDB

The API still uses MongoDB/Mongoose and expects a reachable `MONGODB_URI`.

- Do not switch to local MongoDB inside Cloud Run.
- Use the same database architecture the API already has.
- Keep the MongoDB schema unchanged.

## Cloud Run

- Service name: `bizpro-server`
- Region: `me-central1`
- Artifact Registry repository: `bizpro-api`
- Port: `8080`
- Authentication: the workflow deploys the service as public with `--allow-unauthenticated`
- Minimum instances:
  - `0` saves cost but can cold-start after inactivity.
  - `1` keeps one instance warm and avoids sleep, but it costs more.
- Maximum instances: start with `10` unless your traffic or budget suggests otherwise.
- CPU/memory: `1 CPU` and `512Mi` is a reasonable starting point for the current Node API.
- Environment variables: keep the runtime secrets in Secret Manager and the non-secret defaults in the deploy command.

## Health checks

- Cloud Run uses the lightweight `/health` endpoint added in [`apps/api/src/main.ts`](./apps/api/src/main.ts)
- `/api/health` remains available for clients using the API prefix

## Custom domain

When you are ready to use `https://api.bizpro.co.ke` or another API domain:

1. Open Cloud Run in Google Cloud Console.
2. Select the `bizpro-api` service.
3. Add a custom domain mapping.
4. Verify the domain in Google Cloud if prompted.
5. Update DNS records at your registrar or DNS provider to point the domain at Cloud Run.

## Production URL

Deploy Cloud Run and validate it using its generated URL first:

```bash
gcloud run services describe bizpro-server --region me-central1 --format='value(status.url)'
curl -fsS "$(gcloud run services describe bizpro-server --region me-central1 --format='value(status.url)')/health"
```

The existing service URL is `https://bizpro-server-u6vceulhlq-ww.a.run.app`; set the Vercel admin project's `ADMIN_API_BASE_URL` to this URL with `/api` appended. The admin project also needs `MONGODB_URI`, `BETTER_AUTH_URL`, `ADMIN_PUBLIC_URL`, `BETTER_AUTH_SECRET`, `ADMIN_API_SIGNING_SECRET`, and `PLATFORM_ERROR_INGEST_KEY`. The admin signing and error-ingest keys must match their Secret Manager values. If you configure a custom API domain later, update the admin API base URL and mobile default API URL, then redeploy the clients.
