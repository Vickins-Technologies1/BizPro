# Dira OS Commerce architecture assessment and foundation

## Existing architecture assessment

Dira OS is a NestJS API backed by MongoDB through Mongoose. The API is mounted below
`/api`, and existing modules are organized by domain under `apps/api/src/modules`.
Business tenancy is represented by `businessId` (the persisted organization identifier)
and is enforced in service queries. Branch-aware reads and writes use the existing
`BranchScope` helpers. Owner users may select a branch; non-owner users are restricted
to their assigned branch.

The existing system already provides:

- `Business`, `Branch`, `User`, JWT authentication, role/permission guards, and rate
  limiting for login.
- `Product`, `Category`, `Brand`, `Supplier`, purchase orders, stock transfers, and
  stock adjustments. `Product.stockOnHand` and `StockMovement` are the existing stock
  source of truth.
- `Sale` with embedded historical line-item pricing, `Customer`, payments, finance,
  and transaction support through `runInTransaction`.
- `AuditLog`, inbound provider webhook logging, offline sync, notifications, and
  MongoDB schema/index conventions.

Commerce therefore does not create a second organization, product, inventory, or
customer model. The Commerce API uses `businessId` as `organizationId`, reads the
existing `Product` records, treats existing `Supplier` records as vendors, and adds
only the missing future-commerce relationships and workflow state.

## Integration decisions

### Products and vendors

`Supplier` remains the internal vendor record. The Commerce vendor service exposes it
through a vendor-shaped API and adds a `VendorProduct` relationship so one product may
have several suppliers without overwriting `Product.buyingPrice`. The relationship
stores vendor SKU, vendor cost, currency, minimum order quantity, lead time,
availability, status, and metadata.

Products gain backward-compatible catalog metadata: `productSource`, `visibility`,
description, images, and `reservedQuantity`. Existing product records default to
`INTERNAL` and `INTERNAL` visibility. `buyingPrice` remains the internal cost and
`sellingPrice` remains the internal selling price.

### Inventory and reservations

`Product.stockOnHand` remains authoritative. `reservedQuantity` is kept on that same
product/branch record so reservation checks are atomic and do not introduce a second
quantity ledger. Sellable quantity is calculated as `stockOnHand - reservedQuantity`.
Reservation records are lifecycle records only. Reserve, release, commit, and expiry
operations use conditional atomic updates and a transaction where the deployment
supports MongoDB transactions.

### Commerce orders

`CommerceOrder` is separate from the existing POS `Sale` because external orders have
different lifecycle, payment, fulfillment, and idempotency requirements. Order items
store product name, SKU, selling price, vendor cost, discount, tax, vendor, and subtotal
snapshots. This preserves historical accuracy. A future checkout can later convert a
confirmed order into the existing sales/finance workflow without changing the public
Commerce contract.

### External API

The versioned external surface is `/api/v1/commerce`. It is protected by a credential
guard using a stored hash, expiration/revocation checks, organization ownership, scope
checks, and a credential-based in-process rate-limit abstraction. It does not reuse
internal JWT endpoints and never returns vendor cost, secret material, or raw Mongoose
documents.

Supported foundation routes are documented in the API section below. Internal
credential and webhook-management routes remain JWT/role protected.

### Webhooks, events, audit, and idempotency

Commerce webhook endpoints and delivery records support event subscriptions, HMAC
signatures, delivery attempts, retry timestamps, status, event IDs, and secret
rotation. Commerce operations publish through a small event service so future
notifications, reporting, and webhooks can subscribe without coupling controllers to
transport. Important mutations write to the existing `AuditLog` collection.

POST orders and reservations accept `Idempotency-Key`; request hashes and responses are
stored per business, credential, operation, and key. A repeated key with a different
payload is rejected, while a repeated identical request returns the original result.

## External API contract

All list routes use `page` and `limit` (maximum 100) and return `items`, `page`,
`limit`, `total`, and `totalPages`. Product listing supports search, category, brand,
SKU, availability, price range, vendor, status, and branch filters. Public catalog
responses expose safe image URLs and selling prices only.

| Method | Route | Scope |
| --- | --- | --- |
| GET | `/api/v1/commerce/products` | `products:read` |
| GET | `/api/v1/commerce/products/:id` | `products:read` |
| GET | `/api/v1/commerce/categories` | `products:read` |
| GET | `/api/v1/commerce/inventory` | `inventory:read` |
| GET | `/api/v1/commerce/vendors` | `vendors:read` |
| POST | `/api/v1/commerce/orders` | `orders:write` |
| GET | `/api/v1/commerce/orders/:id` | `orders:read` |
| POST | `/api/v1/commerce/inventory/reservations` | `inventory:reserve` |
| DELETE | `/api/v1/commerce/inventory/reservations/:id` | `inventory:reserve` |

These are foundation APIs only. No storefront, customer registration, cart, checkout
UI, vendor dashboard, payment UI, delivery tracking, promotions, or marketplace pages
are included.

## Security and review points

Every Commerce query includes the credential's `businessId`; route parameters cannot
select another business. Branch filters are checked against the credential's allowed
branch set when present. Public responses use explicit DTO mapping. Input DTOs are
validated by Nest's global whitelist pipe, and regex searches are escaped. Secret
values are stored hashed and are only returned once at credential creation. Webhook
signatures include a timestamp and event ID to support replay protection.

The simple rate limiter is intentionally process-local for the current deployment. It
is a replaceable abstraction; a distributed store can be introduced when multiple API
instances require shared limits.

## Migration and future Marketplace notes

MongoDB schema changes are additive and use defaults, so existing product and supplier
records remain valid. No destructive migration is required. Deployments should ensure
MongoDB transactions are available before relying on reservation/order atomicity.

Before Marketplace implementation, review customer identity ownership, payment capture
and refund boundaries, stock allocation policy for branch-wide products, delivery
providers, webhook delivery workers, and the conversion boundary between Commerce
orders and POS sales/invoices.
