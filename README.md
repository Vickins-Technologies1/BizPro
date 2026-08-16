# BizPro

BizPro is an offline-first business operating system for Kenyan SMEs. It combines point of sale, inventory, finance, reporting, team access, and support tooling into one system so businesses can keep selling even when connectivity is unreliable.

## What BizPro Solves

- Sell quickly at the counter with a mobile POS built for daily operations.
- Keep stock, customers, expenses, and sales in one place.
- Work offline first, then sync changes back to the cloud when connection returns.
- Support different business types without forcing every company into the same workflow.
- Give owners, managers, and staff role-based access to the tools they need.

## Product Overview

BizPro is made up of three connected apps plus shared business logic:

- `apps/mobile` - the Android-first React Native workspace used by staff in the field or at the counter
- `apps/admin` - a Next.js support console for operational oversight
- `apps/api` - a NestJS backend that handles sync, reporting, subscriptions, devices, and webhooks
- `packages/shared` - shared types, validation, themes, constants, and industry definitions

## Core Capabilities

### Point of Sale

- Fast product search and basket building
- Discounts, tax handling, returns, and multiple payment lines
- Receipt preview, copy, PDF sharing, and Bluetooth thermal printing
- Saved POS drafts for interrupted sales

### Inventory and Catalog

- Product, brand, supplier, category, and stock management
- Stock transfers between branches
- Purchase orders and product detail views
- Barcode and SKU lookup

### Finance and Operations

- Sales, expenses, and finance screens
- Customer balances and collections
- Branch-aware reporting and summaries
- Employee and team access management

### Offline-First Sync

- Writes happen locally first
- Changes are queued while offline
- Sync runs automatically when the device reconnects
- The app shows pending sync state and queued actions

### Support and Admin Oversight

- Business coverage view
- Subscription status and plan posture
- Device trust and sync health
- Payment reconciliation logs

## Supported Business Types

BizPro is designed to adapt to several SME categories, including:

- Retail shops, boutiques, cosmetics, accessories, wines and spirits, and hardware
- Agrovet, farm, and feed store businesses
- Restaurants, cafes, bakeries, and bars
- Salons, spas, hotels, lodges, clinics, pharmacies, and dental clinics
- Garages, auto parts businesses, and service centers
- General service firms, consultancies, agencies, law firms, and accounting firms

## Industry Focus

The product is organized into industry modules so the dashboard, reports, and workflows can match the business type.

- Retail
- Food and beverage
- Beauty
- Hospitality
- Healthcare
- Agriculture
- Automotive
- Services
- Professional services

## Typical User Flow

1. Owner creates a business and chooses the business type.
2. Staff signs in on the mobile app.
3. The launchpad routes users to the right workspace based on role and permissions.
4. Staff sell goods or services, track inventory, capture payments, and issue receipts.
5. Offline actions queue locally and sync when the device reconnects.
6. Owners and support staff monitor performance, subscriptions, devices, and sync health from the admin console.

## Tech Stack

- Mobile: React Native, Expo, TypeScript, SQLite, Zustand
- API: NestJS, MongoDB, JWT auth, webhooks
- Admin: Next.js
- Shared layer: TypeScript, Zod, common business constants and industry definitions

## Local Development

```bash
pnpm install
pnpm dev
```

## Workspace Scripts

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm clean
```

## App Commands

### API

```bash
pnpm --filter @vbo/api start:dev
```

Health check:

```text
GET /api/health
```

### Admin

```bash
pnpm --filter @vbo/admin dev
```

### Mobile

```bash
pnpm --filter @vbo/mobile start
```

For a real Android device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, for example:

```text
http://192.168.1.20:3000/api
```

## Environment Files

- `apps/mobile/.env.example` - mobile sync endpoint and related runtime settings
- `apps/api/.env.example` - MongoDB, JWT, support key, and webhook secrets
- `apps/admin/.env.example` - support key for the admin dashboard

## Production Deployment

Recommended hosting split:

- `apps/admin` on Vercel
- `apps/api` on Render, Fly.io, Railway, or another Docker-capable host
- MongoDB on Atlas
- `apps/mobile` through Expo EAS Build

### API Deployment

The API is a long-lived NestJS service, so it should run on a persistent container platform.

Required env vars:

- `MONGODB_URI`
- `MONGODB_DB_NAME` if the URI does not already include a database path
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SUPPORT_API_KEY`
- `TUMA_WEBHOOK_SECRET`
- `PORT` when your host provides one

### Admin Deployment

The admin app calls `/api/*` through its own domain and relies on a server-side support key for access.

Required env vars:

- `SUPPORT_API_KEY`

### Mobile Deployment

Use Expo EAS Build for signed Android and iOS builds.

Example:

```bash
cd apps/mobile
eas build -p android --profile production
```

## Product Notes

- The mobile app opens onboarding when no business exists locally.
- Core actions are written to SQLite first, then queued for sync.
- The API includes sync push/pull endpoints, reports, devices, subscriptions, analytics, finance, audit, employees, suppliers, and webhook reconciliation support.
- Receipt actions support copy, share, and optional Bluetooth printing when the native printer module is installed.
- BizPro uses KES by default and includes plan tiers for lite, standard, and pro.

## Landing Page Summary

If you want a short homepage message, this is a strong starting point:

> BizPro is an offline-first business operating system for Kenyan SMEs. Sell faster, manage stock, track money, and keep your team in sync from one mobile-first platform.

Suggested hero bullets:

- Offline-first POS
- Inventory and finance in one app
- Branch and role-based access
- Built for Kenyan business workflows
- Support console for operations teams
