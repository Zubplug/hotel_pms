# Booking Engine implementation audit

Audit date: 2026-10-02  
Scope: current working tree compared with `Booking Engine — Revised Implementation Plan (v2)` and the task tracker.

## Executive result

The feature is substantially scaffolded, but it is not yet aligned or production-ready. The tracker overstates completion. The highest-risk issues are:

1. Public booking API and booking-engine services were initially duplicated in both apps; the intended boundary is now `apps/website` for the public site/API and `apps/web` for PMS operations.
2. `resolveBookingContext()` validates only slug, property activity/suspension, and `BookingEngineConfig.enabled`. It does not validate `BookingSite.status = PUBLISHED`, organization suspension, or the `ADDON_BOOKING_ENGINE` entitlement.
3. Payment webhook code does not compare the provider-verified amount/currency with the stored `BookingPaymentTransaction` before posting the payment.
4. Guest-facing responses expose internal identifiers and data: hold ID, reservation ID, room number, folio number, and folio details. The plan explicitly prohibits raw reservation/folio identifiers in public responses.
5. Phase 9 is not complete: the reservation and webhook routes still contain TODOs for guest confirmation/payment emails, and cancellation explicitly still has a guest-email TODO.
6. The catalog is already changed to `active: true, sellable: true`, although activation is supposed to be the final step after E2E verification.
7. No booking-specific automated tests were found, and the attempted pnpm validation commands hung without returning a result; typecheck/test status is therefore unverified.

## Phase 2 audit findings

### Reservation and `createdBy`

- `Reservation.createdBy` is nullable and `ReservationCreatedByType` exists with `STAFF`, `GUEST`, `SYSTEM`, and `OTA`.
- `SharedReservationService` bypasses staff validation for non-`STAFF` actors and protects discount/complimentary paths with a staff-only check.
- The booking reservation route still passes `createdBy: systemActorId` while setting `createdByType: 'GUEST'`. This conflicts with the schema comment and plan, which specify `createdBy = null` for guest bookings.
- The “system actor” is a `User`, not a `Staff` record. The plan calls for a designated inactive system staff account because `Payment.receivedBy` is a required staff UUID. The implementation relies on the absence of a database FK and uses the user UUID instead. That is not the agreed transitional design and should be reconciled with accounting/audit assumptions.

### `ReservationRoom` and unassigned inventory

- `ReservationRoom.roomId` is nullable, so unassigned reservations are representable.
- The authoritative booking availability service counts active `ReservationRoom` rows by room type, including rows without a physical room assignment.
- The service counts one row per reservation-room record, but the booking hold model has `quantity` and the hold/reservation flow currently creates only quantity `1`; multi-room quantity is not implemented.
- The service is not the PMS-wide availability authority yet: existing Front Desk/inventory paths still contain separate reservation/room-block queries.

### Room blocks

- `RoomBlock` is attached to physical rooms and has no status field in the current schema. The new service treats every overlapping block as active.
- This matches the observed current schema, but the plan’s “status = ACTIVE” rule cannot be enforced until status semantics are added or the audit confirms that all rows are inherently active.

### Rates and seasonal rates

- `ReservationPricingService` exists and resolves seasonal rate, rate-plan/day-of-week rate, then room-type base rate.
- It does not implement the plan’s complete quote contract: taxes and fees are absent, quote IDs/HMAC-signed server-side quote records are absent, and currency is inferred from the first rate/base room type rather than validated against a property/accounting currency.
- `isSnapshotStillValid()` computes a current quote but only compares subtotal; it does not compare the nightly breakdown, currency, deposit, or payment mode.

### Folio/payment/accounting

- The webhook creates a native `Payment`, updates the open room folio, and calls `FolioPaymentAccountingService`; this is directionally aligned with the no-parallel-accounting requirement.
- The webhook verifies with Paystack directly, but does not validate `verifiedAmount === bpt.amount` and `verifiedCurrency === bpt.currency` before creating the Payment.
- The webhook uses `PAYSTACK_SECRET_KEY` as the webhook HMAC secret and only implements Paystack in `apps/web`; the configured provider/account factory is not consistently used at the API boundary.
- Payment initialization accepts a raw `reservationId` and `guestEmail`, rather than the signed reservation token described by the plan. It also returns the internal booking transaction ID.

### Notifications and Resend

- Branded email functions exist in `apps/website/src/lib/email/booking-emails.ts`, including confirmation, receipt, and cancellation templates.
- The actual `apps/web` reservation route has `TODO Phase 9: send guest confirmation email`; the payment webhook has `TODO Phase 9: send guest payment receipt email`; the cancellation route has `TODO Phase 9: send guest cancellation confirmation email`.
- Therefore the templates are present, but the required production wiring is not complete.

### Night audit, outbox, and sync

- The hold-expiry cron exists and is scheduled every two minutes in `apps/web/vercel.json`.
- The cron route has no visible `CRON_SECRET`/signature validation and is described only as deployment-level protected. This needs explicit verification before production exposure.
- No booking-specific outbox/retry flow was found for guest emails; current guest email calls are not wired, while staff notifications are fire-and-forget.

## Phase-by-phase tracker assessment

| Phase | Assessment | Evidence / gap |
|---|---|---|
| 1 Schema migration | Partial | Schema and manual SQL exist; Prisma validate was attempted but did not return in this environment. Migration is manual/additive and no verified applied migration status is available. |
| 2 Audit | Partial / missing artifact | Source was audited here; `phase2_audit.md` did not exist before this audit. Front Desk and accounting paths are not unified with the new services. |
| 3 Pricing service | Partial | Service exists, but no booking unit tests, taxes/fees, quote record/HMAC, or full snapshot comparison. |
| 4 Availability service | Partial | Service exists and includes unassigned reservations/holds, but uses application-level counts with `RepeatableRead`; no race/concurrency tests; not adopted by existing Front Desk flows. |
| 5 Entitlement guard | Not aligned | No `requireBookingEngineEntitlement()` call; no org suspension validation; no published-site validation in `resolveBookingContext()`. |
| 6 Public API | Partial / unsafe | Routes exist in both apps. Missing/weak token boundary, raw IDs in responses, missing amount/currency check, and inconsistent provider factory use. |
| 7 Paystack factory | Partial | Provider abstractions exist, but `apps/web` payment routes instantiate/use Paystack directly and do not consistently resolve configured booking accounts. |
| 8 System actor | Not aligned | User actor is used instead of the specified inactive Staff actor; guest reservation still stores the actor UUID despite the intended nullable guest field. |
| 9 Notification extension | Not complete | Email templates exist; all three required guest email integrations remain TODOs in the API routes. |
| 10 Security/rate limiting | Partial / unsafe | CORS and a 30/min in-memory IP limiter exist, but limits are not endpoint-specific/property-scoped, custom domains are not supported, early error responses often omit CORS, and public responses leak internal data. |
| 11 Hold cron | Implemented with security caveat | Batch expiry and two-minute schedule exist; cron authentication is not explicit. |
| 12 Portal UI | Partial | Website portal workspace exists. It checks entitlement for display, but save actions only verify org/property ownership and do not enforce the booking entitlement. The plan’s `apps/web` settings tree is not present as specified. |
| 13 Public UI | Not aligned | UI routes exist, but website server pages import Prisma and website also contains public API/services. This violates the strict UI-only/API-boundary decision. Route naming also differs from the revised plan (`rooms/guest/confirm` vs `availability/guest-details/payment`). |
| 14 Flutterwave | Partial / misplaced | Flutterwave booking provider exists in `apps/website`; the API boundary in `apps/web` does not clearly use it. End-to-end verification is absent. |
| 15 Custom domains | Deferred | No host-header routing or DNS verification implementation found; acceptable only if explicitly deferred. |
| 16 Catalog activation | Incorrect sequencing | `ADDON_BOOKING_ENGINE` is already active and sellable in `packages/db/prisma/catalog.ts`, before E2E verification. |

## Immediate blockers before calling this complete

1. Select one API owner (`apps/web`) and remove/migrate the duplicate API and database-backed booking services from `apps/website`.
2. Add entitlement, organization-suspension, and published-site checks to the shared context resolver and enforce the entitlement in portal mutations.
3. Replace public raw IDs with signed/opaque tokens throughout reservation and payment flows; remove room/folio/internal fields from confirmation responses.
4. Add verified amount and currency equality checks before payment posting, plus provider-specific webhook verification through the booking provider abstraction.
5. Wire all three guest email events after committed transactions, with retry/outbox semantics or an explicitly verified delivery mechanism.
6. Implement and run the required unit/integration/concurrency/replay tests.
7. Revert catalog activation to inactive/non-sellable until those checks pass, unless production activation was an intentional explicit decision outside this plan.

## Validation note

`pnpm --filter @hotel-pms/db exec prisma validate`, `pnpm --filter website type-check`, `pnpm --filter web exec tsc --noEmit`, and `pnpm test` were attempted. The package manager processes did not return usable output or exit status in this workspace, so this audit does not claim a clean validation result.

## Remediation completed in this pass

- Added entitlement and published-site enforcement to the canonical `apps/web` booking context resolver.
- Changed guest reservations to omit `createdBy`; booking payment/audit operations now use an inactive `Staff` system actor.
- Removed raw hold ID and reservation ID from the main guest booking responses; payment initialization now requires the confirmation token plus guest email.
- Added provider-verified payment amount/currency matching before folio posting.
- Added Resend-backed confirmation, payment receipt, and cancellation email dispatches in the canonical API routes.
- Added explicit `CRON_SECRET` authorization to hold expiry.
- Restored `ADDON_BOOKING_ENGINE` to inactive/non-sellable until final production activation.
- Added the optional property relation for `BookingPaymentAccount` and updated the manual SQL migration.
- Reworked canonical availability to return all exposed rate plans when no rate plan is supplied.
- Removed the website rewrite after the architecture clarification; browser booking API calls are handled directly by `apps/website`.
- Finalized the clarified ownership boundary: public booking routes, booking services, payment provider, and hold cron now live in `apps/website`; `apps/web` is PMS-only.
- Removed the duplicate public booking routes and booking-engine/payment implementation from `apps/web` after the ownership clarification; `apps/website` now contains the eight public booking routes and its hold-expiry cron.
- Activated `ADDON_BOOKING_ENGINE` in source and successfully synchronized the versioned catalog to the configured Neon database. Existing subscription IDs and invoices were preserved.
- `apps/web` TypeScript: PASS. `apps/website` TypeScript: PASS. Prisma schema validation: PASS.

## Remaining production prerequisites

- The website owns the public booking API and UI. `apps/web` remains the PMS/internal application.
- Full E2E, concurrency, payment replay, refund, and live Resend/Paystack tests still require a test database and provider credentials.
- Deployed environment variables still need verification in the hosting provider: `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PAYSTACK_SECRET_KEY` (and Flutterwave values if enabled). They are not present in the local process environment.
