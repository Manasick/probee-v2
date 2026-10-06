# ProBee V2

ProBee V2 is a Next.js App Router + TypeScript storefront backed by Supabase Auth, PostgreSQL/RLS, Supabase Storage, secure checkout/payment RPCs, digital fulfillment, verified reviews, transactional email, and a staff/admin dashboard.

## Stack

- Next.js 16.3.8
- React 19.3.0
- TypeScript 5.9.3
- Supabase SSR 0.12.7
- Supabase JS 2.117.2
- Vitest 5.0.3
- Tailwind CSS 4.3.3

## Local setup

1. Install Node.js 22 or a currently supported Node.js 22 release.
2. Install dependencies:
   `npm install`
3. Copy `.env.example` to `.env.local`.
4. Fill the required public Supabase and site URL values.
5. Keep `EMAIL_PROVIDER=none` until a real transactional email provider is configured.
6. Start development:
   `npm run dev`

For reproducible production installs, commit the generated npm lockfile from a network-enabled development/CI environment and then use `npm ci`. This repository currently has no lockfile, so one must not be fabricated in an offline environment.

## Environment variables

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only transactional email variables:

- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `EMAIL_API_KEY`

Only `NEXT_PUBLIC_*` values may be exposed to browser code. Never put Supabase service-role keys, database passwords, OAuth secrets, or email API keys in `NEXT_PUBLIC_*` variables.

## Supabase setup

Apply the migrations in the exact filename order under `supabase/migrations/`.

The current migration sequence is:

1. `20261006170000_initial_schema.sql`
2. `20261006180000_dynamic_catalog.sql`
3. `20261006190000_admin_product_management.sql`
4. `20261006195000_product_media_storage.sql`
5. `20261006200000_secure_checkout.sql`
6. `20261006203000_manual_bank_transfer.sql`
7. `20261006210000_secure_digital_delivery.sql`
8. `20261006220000_transactional_email_foundation.sql`
9. `20261006221000_transactional_email_hardening.sql`
10. `20261006222000_verified_product_reviews.sql`
11. `20261006230000_full_admin_dashboard.sql`
12. `20261006240000_security_rls_hardening.sql`

Do not reorder, delete, squash, or rewrite historical migrations.

### Authentication

Production Supabase Auth configuration must include:

- Site URL = the production `NEXT_PUBLIC_SITE_URL`
- Production redirect URL for `/auth/confirm`
- Production callback URL for `/auth/callback`
- Password-recovery redirect to `/auth/callback?next=/reset-password`
- Email confirmation enabled when production account activation is required

Use exact production origins and paths. Do not add broad wildcard redirect URLs.

### Storage buckets

Create/apply policies for these private buckets:

- `product-media`
- `payment-proofs`
- `digital-products`

Do not make the private buckets public.

### Database security

Before production traffic:

- confirm RLS is enabled on all protected application tables
- confirm all security migrations have been applied
- confirm SECURITY DEFINER functions have the intended `search_path` hardening
- confirm staff/admin grants and revokes are present
- confirm direct customer mutations of financial/order/digital state remain blocked

## Payments

The current production payment method is manual bank transfer.

No online payment gateway is configured by default.

Administrator payment settings are stored through the existing protected settings workflow. Do not place payment credentials or customer secrets in source code.

## Transactional email

Keep:

`EMAIL_PROVIDER=none`

until a real provider is selected and configured.

When enabling a provider:

- set `EMAIL_PROVIDER` to the supported provider
- configure `EMAIL_FROM`
- optionally configure `EMAIL_REPLY_TO`
- store `EMAIL_API_KEY` only in the server environment

Email delivery is intentionally asynchronous from core checkout/payment request completion, and idempotency must remain enabled.

## Testing and validation

Run:

`npm run lint`

`npm run typecheck`

`npm test`

`npm run build`

The STEP 19 regression workflow also runs these checks in GitHub Actions.

No live Supabase credentials belong in public/unit-test workflows. Live RLS, Storage, concurrency, and browser E2E testing should use an isolated non-production environment.

## Production deployment

ProBee V2 can be deployed to a Next.js-compatible host such as Vercel or another managed Node.js platform.

Before deployment:

1. Generate and commit the npm lockfile from a network-enabled environment.
2. Set all required production environment variables in the deployment platform.
3. Apply all Supabase migrations in order.
4. Verify production Auth site/redirect configuration.
5. Verify all three Storage buckets are private and policies are applied.
6. Configure the chosen transactional email provider, or intentionally keep it disabled.
7. Run lint, typecheck, tests, and build.
8. Execute the production smoke-test checklist in this README and the deployment checklist below.
9. Verify the application hostname uses HTTPS.
10. Verify there are no production secrets in repository files or browser-exposed environment variables.

## Production smoke test

### Public

- Home loads without server errors.
- Products page returns only published + active catalog records.
- Category page returns the expected active category data.
- Product detail shows active plans, media, features, package inclusions, and public approved reviews.
- Catalog images load through optimized image delivery.
- Cart can add/remove/update valid items.

### Customer

- Signup succeeds with a valid email/password.
- Email confirmation reaches the configured production callback.
- Login and logout work.
- Password recovery returns to the configured reset flow.
- Account data belongs only to the current authenticated user.
- Checkout creates an order using authoritative database pricing.
- Manual bank-transfer details render only when enabled.
- Payment proof validation accepts supported files and rejects malformed/oversized uploads.
- Order status/payment status remain database-authoritative.
- Digital products appear only for eligible paid entitlements.
- Digital asset access redirects to a short-lived signed URL.
- Reviews can only be created/edited according to verified-purchase rules.

### Admin

- Unauthenticated users cannot access `/admin`.
- Customer users cannot access staff/admin operations.
- Managers retain only their intended operational permissions.
- Administrators can manage payment settings.
- Product/catalog changes are reflected in the customer catalog after normal cache/revalidation windows.
- Orders, payments, customers, reviews, digital delivery, email activity, and settings pages load with bounded pagination.
- Sensitive operations retain confirmation and server-side authorization.

## Deployment blockers / external validation

The repository audit cannot confirm these without the actual deployment/test environment:

- npm dependency installation in this offline environment
- generated lockfile contents
- lint execution with installed dependencies
- TypeScript execution with installed dependencies
- full Vitest execution with installed dependencies
- production build execution
- browser/mobile E2E profiling
- live Supabase RLS and Storage penetration tests
- real concurrency/idempotency tests against PostgreSQL
- production Auth/Storage/email configuration

Do not treat those as passed until they are executed successfully in the target environment.

## Useful commands

`npm run dev`

`npm run lint`

`npm run typecheck`

`npm test`

`npm run build`
