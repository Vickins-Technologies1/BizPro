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
gcloud run deploy bizpro-api \
  --image <REGION>-docker.pkg.dev/<PROJECT_ID>/<AR_REPOSITORY>/bizpro-api:<TAG> \
  --region <REGION> \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 10 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars NODE_ENV=production,MONGODB_DB_NAME=vickins_business_os,JWT_EXPIRES_IN=7d \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,SUPPORT_API_KEY=SUPPORT_API_KEY:latest
```

## Google Cloud setup for GitHub Actions

Run the following once, replacing the placeholders. These commands create the deployer service account, grant it the permissions used by the workflow, and configure keyless GitHub authentication.

```bash
export PROJECT_ID=<PROJECT_ID>
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export REGION=<REGION>
export GITHUB_REPOSITORY=<GITHUB_OWNER>/<GITHUB_REPOSITORY>
export DEPLOYER_SA=bizpro-cloud-run-deployer
export WIF_POOL=github-pool
export WIF_PROVIDER=github-provider

gcloud config set project "$PROJECT_ID"
gcloud iam service-accounts create "$DEPLOYER_SA" \
  --display-name="Dira OS Cloud Run deployer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud iam workload-identity-pools create "$WIF_POOL" \
  --location=global \
  --display-name="GitHub Actions pool"
gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
  --location=global \
  --workload-identity-pool="$WIF_POOL" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_REPOSITORY}'"

gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPOSITORY}"

echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
echo "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
```

Add the two printed values to GitHub as the Actions secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT_EMAIL`. Add `GCP_PROJECT_ID`, `GCP_REGION`, `GAR_REPOSITORY`, and `CLOUD_RUN_SERVICE` as repository variables.

Create the runtime secrets before the first deployment. The command reads each value interactively so secrets are not placed in shell history:

```bash
for SECRET_NAME in MONGODB_URI JWT_SECRET SUPPORT_API_KEY; do
  printf "Enter value for %s: " "$SECRET_NAME"
  read -r SECRET_VALUE
  printf '%s' "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" --data-file=- 2>/dev/null || \
    printf '%s' "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-
  unset SECRET_VALUE
done
```

## GitHub deployment

The workflow at [`.github/workflows/deploy-cloud-run.yml`](./.github/workflows/deploy-cloud-run.yml) expects these GitHub configuration values:

- Secret `GCP_WORKLOAD_IDENTITY_PROVIDER`
- Secret `GCP_SERVICE_ACCOUNT_EMAIL`
- Variable `GCP_PROJECT_ID`
- Variable `GCP_REGION`
- Variable `GAR_REPOSITORY`
- Variable `CLOUD_RUN_SERVICE`

The workflow:

1. Triggers on pushes to the `production` branch.
2. Authenticates with Google Cloud using Workload Identity Federation.
3. Builds the API image from [`apps/api/Dockerfile`](./apps/api/Dockerfile).
4. Pushes the image to Artifact Registry.
5. Deploys the image to Cloud Run.

## Environment variables

Required by the API:

- `MONGODB_URI`
- `JWT_SECRET`
- `SUPPORT_API_KEY`

Required or recommended defaults:

- `NODE_ENV=production`
- `MONGODB_DB_NAME=vickins_business_os`
- `JWT_EXPIRES_IN=7d`
- `PORT=8080` or Cloud Run's injected port

Optional:

- `TUMA_WEBHOOK_SECRET` (the Tuma webhook remains disabled until configured)
- `EXPO_PUSH_ACCESS_TOKEN`
- `CORS_ORIGINS`

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

- Service name: `bizpro-api`
- Region: choose the same region you configured in `GCP_REGION`
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
gcloud run services describe bizpro-api --region <REGION> --format='value(status.url)'
curl -fsS "$(gcloud run services describe bizpro-api --region <REGION> --format='value(status.url)')/health"
```

The admin proxy and mobile default API URL use the Cloud Run service URL. If you configure a custom domain later, update those two values and redeploy the clients.
