# Vickins Business OS

Production-style monorepo for an offline-first Android POS and business OS for Kenyan SMEs.

## Structure

- `apps/mobile` - React Native + TypeScript + SQLite
- `apps/api` - NestJS + MongoDB
- `apps/admin` - Next.js support dashboard
- `packages/shared` - shared types, enums, constants, theme tokens, and Zod contracts

## Local Setup

```bash
pnpm install
pnpm dev
```

## Testing

Run the workspace checks from the repo root:

```bash
pnpm typecheck
pnpm build
```

For the API specifically:

```bash
pnpm --filter @vbo/api start:dev
```

Then open `http://localhost:3000/api/health`.

For the admin dashboard:

```bash
pnpm --filter @vbo/admin dev
```

For mobile, use Expo:

```bash
pnpm --filter @vbo/mobile start
```

## Environment Files

- `apps/mobile` - configure sync endpoint if you change the default API URL
- `apps/api/.env.example` - MongoDB, JWT, support-key, and webhook settings
- `apps/admin/.env.example` - API base URL and support key for the admin dashboard

For Expo on a real device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, for example `http://192.168.1.20:3000/api`.

## Notes

- The mobile app boots into onboarding when no business exists locally.
- All core actions write to SQLite first and enqueue sync events.
- The API exposes sync push/pull endpoints, reports, devices, subscriptions, and webhook reconciliation scaffolding.
- Receipt actions in POS support copy, share, and optional Bluetooth thermal printing when the native printer module is installed.

## Production Deployment

Recommended hosting split:

- `apps/admin` on Vercel
- `apps/api` on Render, Fly.io, Railway, or any Docker host
- MongoDB on Atlas
- `apps/mobile` through Expo EAS Build

Why this split:

- Vercel is excellent for the Next.js admin dashboard.
- The API is a long-lived NestJS service and is better on a persistent container platform than on short-lived serverless functions.
- The mobile app is released through signed Android/iOS builds, not web hosting.

### API

Use the Render blueprint in `render.yaml` or the Dockerfile in `apps/api/Dockerfile`:

```bash
corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm --filter @vbo/shared build
pnpm --filter @vbo/api build
pnpm --filter @vbo/api start:prod
```

Health check: `GET /api/health`

The Render service is configured to build and start from the repo root, so the shared package is compiled before the API boots.
If you created the service manually in Render, make sure its build command matches the snippet above and does not fall back to `pnpm run build`.

Required env vars:

- `MONGODB_URI`
- `MONGODB_DB_NAME` if your URI does not already include a database path
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SUPPORT_API_KEY`
- `TUMA_WEBHOOK_SECRET`
- `PORT` when your host provides one

MongoDB will create the database on first write. The API now performs a startup bootstrap write to a `system_state` collection so a fresh Atlas cluster is initialized automatically.

### Admin

Deploy `apps/admin` to Vercel.

Required env vars:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPPORT_API_KEY`

### Mobile

Use Expo EAS Build with `apps/mobile/eas.json`.

Example production build:

```bash
cd apps/mobile
eas build -p android --profile production
```

If you publish iOS later, keep the same bundle identifier in `apps/mobile/app.json`.
