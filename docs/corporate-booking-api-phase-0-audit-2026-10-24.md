# LodgeCore Corporate Booking API — Phase 0 Architecture Audit

Status: re-audited 2026-10-24; implementation verified with focused tests and TypeScript checks

Scope: availability, pricing, booking creation, cancellation, payment confirmation, tenant authorization, subscription entitlements, corporate records, audit/outbox synchronization, and the smallest safe first corporate-booking slice.

The re-audit covers the in-progress implementation and the compatibility hardening completed in this pass. No production-data write was performed.

## Executive conclusion

LodgeCore already has most of the transaction-critical booking primitives required for a corporate channel:

- `AuthoritativeAvailabilityService` is the shared availability authority.
- `ReservationPricingService` produces nightly rates and an immutable pricing snapshot.
- `SharedReservationService` is the existing reservation creation boundary and already supports `corporateAccountId`.
- The public Booking Engine uses expiring hashed holds, serializable hold-to-reservation conversion, idempotency records, and payment webhook confirmation.
- Existing `Property → Organization`, `Subscription → Entitlement`, `AuditLog`, `OutboxEvent`, folio, city-ledger, and payment models provide the relevant platform boundaries.

The implementation now has one transaction path for corporate booking: partner credentials or standalone publishable-key applications resolve to a corporate principal, the principal uses the shared corporate quote/rate services, booking calls `SharedReservationService`, and payment settlement posts through the existing City Ledger/Payment/GL pipeline. `CorporateAccount` remains the PMS operational record; partner/API identity, contract versions, rate rules, quotes, and applications are separate authorization/commercial records.

The re-audit found no second reservation or accounting implementation in the corporate channels. The distinction between `/api/v1/corporate/*` and `/api/v1/public/corporate/*` is intentional: the former is authenticated partner/portal access and the latter is the publishable-key standalone-site adapter. Both call the same domain services and produce the same PMS records.

The safest next step is a thin vertical slice that reuses the existing public booking services and adds only the minimum corporate authorization and quote/contract persistence needed to make the flow auditable and replay-safe.

## 1. Verified reuse map

| Capability | Existing implementation | Finding | Reuse decision |
|---|---|---|---|
| Inventory | `packages/db/src/availability.ts` | Counts active rooms, blocks, overlapping reservations, and active booking holds. `assertAvailable` and `findAssignableRoom` are reusable. | Reuse unchanged behind a corporate adapter. |
| Rate calculation | `apps/website/src/lib/booking-engine/pricing-service.ts` | Resolves `SeasonalRate → Rate → RoomType.baseRate`; supports rate-plan deposit policy and immutable nightly snapshot. | Reuse as the base resolver; add corporate eligibility/contract overlay before calling it or extend it with an explicit entitlement input. |
| Public availability | `apps/website/src/app/api/v1/public/availability/route.ts` | Publishable-key scoped, Booking Engine entitlement checked, public rates only, 30-second cache header. | Do not expose directly to corporate callers; extract shared query/service logic. |
| Hold creation | `apps/website/src/app/api/v1/public/hold/route.ts` | Availability assertion and quote snapshot are created in one transaction; raw token is returned, SHA-256 hash is stored. | Reuse for corporate holds, with corporate scope and quote identity attached. |
| Reservation creation | `apps/website/src/lib/services/reservation-service.ts` and `apps/website/src/app/api/v1/public/reservations/route.ts` | Shared service creates guest, reservation, reservation guest/room, rate snapshot, and audit data. Public route revalidates inventory and snapshot at serializable isolation. | Corporate booking must call this service; no parallel `reservation.create` implementation. |
| Idempotency | `BookingRequest` in Prisma plus `X-Idempotency-Key` at public reservation route | Existing key returns the completed reservation; processing/failed states are explicit. | Extend scope to partner + operation and bind the request fingerprint to prevent key reuse with different payloads. |
| Cancellation | `apps/website/src/app/api/v1/public/cancel/route.ts` and `booking-engine/cancellation-service.ts` | Calculates penalty, updates reservation/rooms, queues refunds, writes `AuditLog`, emits notification. | Extract an authenticated shared cancellation service; preserve policy calculation. |
| Payment | Booking payment intent/webhook routes and provider adapters | Webhooks verify provider callbacks and update pending booking/payment state; refund reconciliation exists. | Corporate `PREPAID` must use the same verified webhook path; never trust a client payment status. |
| PMS synchronization | `OutboxEvent`, notification engine, OTA outbox processor, and existing reservation flows | The reservation remains in the PMS schema and can participate in existing operational/reporting paths. | Add corporate event metadata and an outbox event transactionally with the reservation where partner delivery is required. |
| Tenant authorization | `organization-access.ts`, `property-access.ts`, `hasEntitlement`/`requireEntitlement` | Authenticated staff scope is server-derived from organization membership, roles, staff property access, and active entitlements. | Corporate API needs a separate server-side partner context; never accept organization/property scope from the request body. |

## 2. Existing data model findings

### Reusable entities

- `Organization`, `Property`, `RoomType`, `Room`, `RoomBlock`, `RatePlan`, `Rate`, `SeasonalRate`, `CancellationPolicy`, `DepositPolicy`, and `NoShowPolicy` cover hotel inventory and base pricing.
- `Reservation` supports `source = CORPORATE`, `corporateAccountId`, `ratePlanId`, `ratePlanSnapshot`, payment/deposit fields, cancellation policies, and the normal PMS lifecycle.
- `CorporateAccount` already stores organization/property ownership, code, credit limit, deposit policy, optional city-ledger account, and an optional rate plan.
- `Folio`, `CityLedgerAccount`, and payment models can support later corporate credit billing, subject to credit-limit and authorization rules.
- `BookingEngineConfig`, `BookingSite`, `PublishableKey`, and `PropertyIntegration` cover the existing public Booking Engine channel, but are not a substitute for a corporate partner credential model.
- `BookingHold`, `BookingRequest`, and `BookingPaymentTransaction` provide existing hold, idempotency, and payment transaction seams.
- `AuditLog` and `OutboxEvent` are suitable existing traceability/synchronization primitives.

### Current gaps and risks

1. `CorporateAccount` is property-local and has no effective dates, covered-property relation, membership/booker/approver relation, contract status, room-type restriction, meal inclusion, blackout, minimum-stay, commission/net-rate treatment, or explicit priority/stacking rule.
2. `CorporateAccount.ratePlanId` is a single pointer. It cannot represent multiple contracts, date windows, rate-rule precedence, or a partner-specific entitlement without overloading `RatePlan`.
3. `RatePlan.type = CORPORATE` identifies a category but does not identify the eligible company or agency. `isPublic` is suitable for public Booking Engine filtering, not corporate authorization.
4. `BookingRequest.idempotencyKey` is currently the public booking seam. Corporate operations need a partner-scoped key, request fingerprint, operation type, and safe response replay semantics.
5. `OutboxEvent` has no visible uniqueness/idempotency key. Corporate partner webhooks must use a deterministic delivery/event identity at the delivery layer; repeated delivery must be safe.
6. The shared reservation service performs useful property ownership checks, but the corporate API must validate the corporate account, contract, partner, and property in one server-side scope before passing IDs into it.
7. The current pricing snapshot contains nightly prices and basic rate metadata, but a corporate quote must also snapshot contract identity, eligibility decision, taxes/fees/inclusions, cancellation terms, and quote expiry.

## 3. Existing API inventory

The verified public Booking Engine contract currently includes:

- `GET /api/v1/public/availability`
- `POST /api/v1/public/hold`
- `POST /api/v1/public/reservations`
- `POST /api/v1/public/cancel`
- payment intent, payment webhook, confirmation, manage, extend, refund-status, and booking-hold expiry routes.

These routes authenticate with `X-Publishable-Key`, resolve one property through `PropertyIntegration`, validate the Booking Engine entitlement (`ADDON_BOOKING_ENGINE`), apply origin/CORS controls, and use public rate plans. They are a public-site channel, not the proposed `/api/v1/corporate/...` contract.

The authenticated operational API uses session-derived organization/property context via `requireOrganizationContext` and `assertPropertyAccess`. That context cannot be reused for external corporate partners without introducing a partner credential context and explicit scope checks.

The implemented corporate contract includes properties, availability, account, applications, quotes, bookings, booking lookup, cancellation preview/action, payment initialization, invoices, and rate-negotiation routes. Staff-only partner, contract, rate, and corporate-account management remains under `apps/web`; external callers cannot create PMS accounts or activate rates directly. The standalone public adapter also exposes booking lookup and cancellation through the same application-token boundary.

## 4. Recommended first slice

Implement the following in one controlled slice, after design review:

1. **Partner context and entitlement gate** — resolve credential → partner → organization → permitted properties; require an explicit corporate/API entitlement (not Booking Engine access by implication); enforce status, expiry, revocation, scopes, and rate limit.
2. **Corporate eligibility service** — resolve the active corporate account/contract for the authenticated partner, property, dates, room type, occupancy, and booking channel. Reject ambiguity rather than silently selecting a rate.
3. **Quote service** — call authoritative availability and pricing, apply the selected corporate rule, calculate the complete server-side breakdown, snapshot contract/policy data, and persist an expiring quote bound to the partner and request inputs.
4. **Corporate hold/booking adapter** — revalidate the quote, inventory, property, contract, and price in a serializable transaction; call `SharedReservationService.createReservation` with `source: CORPORATE`, `corporateAccountId`, `createdByType: SYSTEM` or a dedicated integration actor, and the immutable snapshot.
5. **Payment/credit decision** — for prepaid, leave confirmation to the verified provider webhook; for credit, lock/check the contract credit limit and authorization rules transactionally before confirming.
6. **Audit/outbox** — record quote, contract selection, booking, cancellation, and credential events with partner/request IDs; emit a deterministic booking event for downstream delivery/reconciliation.

The first endpoint set should be narrower than the full proposal: properties, availability, quotes, quote lookup, booking creation, booking lookup, and cancellation preview/action. Modifications, invoices, agency commissions, approval workflows, and broad partner webhooks should follow after the first end-to-end flow is proven.

## 5. Minimum future schema proposal (not implemented)

Prefer these additions only after the service boundary and API contract are tested:

- `ApiPartner`: organization ownership, status, environment, permitted scopes, and permitted property relation.
- `ApiCredential`: partner relation, credential hash/prefix, environment, scopes, expiry, last-used/rotated/revoked metadata. Store no raw secret.
- `CorporateContract`: organization/company identity, status, effective dates, terms, billing/payment mode, and priority.
- `CorporateContractProperty`: contract-to-property scope.
- `CorporateMembership`: authorized booker/approver membership and roles.
- `CorporateRateRule`: contract, room type/rate plan, effective dates, restrictions, inclusions, tax treatment, and explicit priority/stacking policy.
- `BookingQuote`: partner/property/contract binding, canonical request fingerprint, expiry, immutable price/policy snapshot, status, and consumed reservation relation.
- `CorporateBookingReference`: reservation, partner, external reference, operation/idempotency identity, and reconciliation status.

Before adding all of these, verify whether existing `PropertyIntegration`, `PublishableKey`, `CorporateAccount`, `RatePlan`, `BookingRequest`, and `OutboxEvent` can safely absorb any field without changing their existing channel semantics.

## 6. Release-blocking test matrix

The first implementation must have automated coverage for:

- organization/property ID tampering and a partner credential scoped to one property;
- inactive, expired, revoked, wrong-environment, and insufficient-scope credentials;
- corporate contract date boundaries, blackout dates, room-type restrictions, occupancy, minimum stay, and conflicting rules;
- public rate versus corporate rate, tax/fee/inclusion totals, net versus gross treatment, and immutable quote snapshots;
- expired/consumed quote, quote payload mutation, rate drift, and inventory revalidation;
- concurrent final-room booking attempts, serializable retry behavior, and no duplicate reservation;
- duplicate idempotency key with the same payload and conflict with a different payload;
- prepaid payment failure/success/retry and verified webhook replay;
- credit-limit exhaustion and concurrent credit bookings;
- cancellation penalty, refund queueing, repeated cancellation, and booking visibility in PMS/front desk/reporting;
- outbox delivery retry, deterministic event identity, audit actor/request traceability, and reconciliation after partial failure.

## 7. Phase sequence and exit criteria

| Phase | Deliverable | Exit criterion |
|---|---|---|
| 0 | This reuse map and gap analysis | Services, authorization boundaries, schema gaps, and test risks are agreed. |
| 1 | Shared corporate-aware quote service | Same authoritative inventory and consistent server totals for public/corporate paths. |
| 2 | Corporate account/contract vertical slice | Eligible quote becomes one normal PMS reservation with no duplicate/overbooking. |
| 3 | Partner credentials, idempotency, rate limits, webhooks | Tenant isolation and retry tests pass; usage and audit are measurable. |
| 4 | OpenAPI, sandbox, onboarding | External developer can complete the test lifecycle without database access. |
| 5 | Pilot and controlled rollout | One-property monitored pilot passes payment, cancellation, reconciliation, and rollback checks. |

## Re-audit findings and release conditions

Verified:

- Corporate reservations use `source = CORPORATE`, normal PMS reservation/folio relationships, `corporateAccountId` where an approved account exists, and immutable quote/rate snapshots.
- Public/base rates are not substituted when a corporate contract rule is unavailable; an approved rule anchored to an active `CORPORATE` PMS rate plan is required.
- Partner credentials are hashed, environment-bound, scope-intersected with partner scopes, expiry/revocation checked, property-entitlement filtered, and rate-limited.
- Booking retries are scoped by principal and operation, fingerprint-checked, quote-consumed atomically, and retried once for serializable conflicts.
- Verified payment webhooks settle one native City Ledger payment and protect against duplicate gateway replay.
- Staff-created PMS accounts and direct PMS reservations remain available; the external API cannot silently convert or overwrite them.
- The Stanzel adapter preserves upstream status codes for validation, conflict, expiry, rate, payment, and server errors.
- `invoices:pay` now has a real invoice gateway endpoint and invoice-linked webhook settlement; `quotes:read` now supports both single-quote and list reads.
- Portal identity creation is serialized with a database advisory lock, PMS negotiations support both account and application identities, and contract activation/suspension/reinstatement transitions are explicit and audited.

Release-blocking operational work remains: apply and verify all pending Prisma migrations in each environment, provision Redis rate limiting in production, publish the OpenAPI contract/sandbox, add database-backed concurrency/payment-webhook tests, and complete the commercial exception register before enabling real account mappings.

## Decision

Do not create the full proposed schema or public corporate routes yet. Approve a service-first design for the thin vertical slice, with `CorporateAccount` retained as the existing PMS/customer record and a new contract/partner layer introduced only where the current model cannot express eligibility or external authorization safely.

## Corporate API commercial catalogue audit — 2026-10-24

Corporate API is now modelled as one dedicated recurring add-on, not as standalone website development and not as Booking Engine access:

- Product: `ADDON_CORPORATE_API`
- Unit: per property
- Recommended price: ₦150,000/month or ₦1,500,000/year per property
- Dependency: an active `MODULE_OPERATIONS` entitlement for each selected property
- Commercial controls: sellable, approval-required, online-only, marked recommended
- API authorization: only `ADDON_CORPORATE_API` grants corporate API access

The customer subscription catalogue and HQ Products & Pricing page are both backed by the same `BillingProduct` and `BillingPrice` records, so the add-on appears in both surfaces without a second product definition or checkout flow. The catalogue version is incremented to `2`; existing subscriptions and invoices are preserved by the versioned sync.

Production audit status: the configured Neon production endpoint was inspected for configuration but was unreachable from the audit environment. No production write was made. After deployment, run the guarded production sync with `APPLY_PRICING_CATALOG=1` and verify the resulting product and two prices before enabling customer purchase.
