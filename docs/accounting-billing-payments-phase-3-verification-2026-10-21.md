# LodgeCore Billing — Phase 3 Read-only Payments Register

Date: 2026-10-21  
Status: implemented and verified; read-only only

## Delivered

- `/accountant/billing/payments` read-only Payments Received register.
- `GET /api/v1/accountant/billing/payments` with property, source, status, method, currency, date, amount, search and stable cursor filters.
- Server-side `Payment` read model at `apps/web/src/lib/services/payment-read-model.ts`.
- Accountant navigation link and Billing overview link.

## Accounting contract

`Payment.id` is the canonical receipt identity. A payment is returned once even when it has:

- a Folio payment item;
- a corporate `CityLedgerEntry` and multiple `CityLedgerAllocation` rows;
- related journal lines, refund requests or refunds.

City Ledger entries and allocations are linked evidence. They are not additional receipts. Where the existing corporate flow has no direct Payment-to-entry foreign key, the verified source relationship uses the existing receipt/reference value and remains exposed through `cityLedgerEntryIds`.

The register keeps these states independent:

- `processingStatus` and `verificationStatus` from `Payment`;
- `allocationStatus`, `allocatedAmount` and `unappliedAmount` from City Ledger evidence;
- `postingStatus` from source-linked journal lines;
- `reconciliationStatus` from explicit front-desk session or transaction-exception evidence only;
- `refundStatus` from refund requests and completed refund records.

Completed or posted does not imply reconciled. Missing reconciliation evidence is `UNKNOWN`.

## Safeguards

- Organization and property scope reuse the Billing financial-role and property-scope checks.
- Every query includes the requested property predicate.
- Amounts are serialized as decimal strings and signed calculations use exact decimal helpers.
- Cursor pagination is versioned, filter-bound, ordered by `createdAt DESC, id ASC`, and capped at 100 rows.
- Search avoids treating arbitrary text as a UUID payment ID.
- No payment, allocation, refund, journal, reconciliation or offline-sync mutation was added.

## Tests and checks

- Focused Vitest suite: **5 files, 24 tests passed**.
- ESLint on the Phase 3 service, tests, route and affected Billing pages: **passed**.
- Direct web TypeScript check: **passed**.
- `git diff --check`: **passed**.

No database connection, migration, or production-data operation was used for this phase. Query-plan validation remains a deployment-environment task.

## Known limitation

Corporate Payment-to-CityLedgerEntry linkage is based on the existing receipt/reference convention because the schema has no direct foreign key. The register preserves that fallback identity explicitly; a future schema change is not part of Phase 3 and requires separate approval.
