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
