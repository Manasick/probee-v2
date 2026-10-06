# ProBee V2 STEP 19 — Testing Strategy

This directory contains the regression suite introduced for STEP 19.

## Executable local/CI coverage

- Unit tests cover cart normalization/merging/limits, authentication validation, safe redirects, catalog formatting, order/payment presentation, payment-proof validation, digital-delivery validation, and email-provider configuration.
- Regression tests verify critical API input contracts, route presence, authentication boundaries, error/loading boundaries, transactional-email idempotency/provider behavior, and security-sensitive source contracts.
- Security regression tests intentionally assert the STEP 18 authorization invariants instead of weakening RLS or using production data.
- The GitHub Actions workflow runs dependency installation, lint, TypeScript checking, the test suite, and the production build.

## Live integration coverage

A real Supabase integration suite is not executed from this repository state because no isolated test Supabase project/database/storage credentials are committed or available to the test runner.

The following require an isolated Supabase test environment before deployment:

- anonymous/customer/staff/manager/admin RLS matrix execution
- cross-customer IDOR/BOLA attempts against real tables/RPCs
- SECURITY DEFINER execute/authorization checks against the real database
- checkout transaction/idempotency races
- manual payment proof upload/storage-policy tests
- digital entitlement/storage signed-URL authorization
- review eligibility/moderation transitions
- transactional-email database claim/complete races
- real Storage MIME/magic-byte enforcement
- browser end-to-end customer and admin journeys

No production fixtures, customer credentials, payment information, or real emails belong in these tests.

## Production-safety rule

STEP 19 must never weaken RLS, expose private buckets, add bypass credentials, or seed fake data into the production Supabase project to make tests pass.
