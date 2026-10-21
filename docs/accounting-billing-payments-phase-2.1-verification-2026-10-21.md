# LodgeCore Billing — Phase 2.1 Production-Readiness Verification

Date: 2026-10-21  
Scope: read-only Billing workspace in `apps/web`  
Status: verified and hardened; no migrations or financial writes introduced

## Outcome

The Phase 2 Billing workspace remains a read-only composition layer over Folios, City Ledger invoices and Event Invoices. Focused tests pass, Billing lint passes, and the direct web TypeScript check passes.

## Findings and corrections

### Financial correctness

- Folio receivables now use the existing `getFolioBalance` helper. Only the debit portion is presented as outstanding; guest credits are retained as history and are not added to receivables.
- Event Invoice outstanding balances use the exact decimal contract rather than JavaScript number arithmetic.
- Event Invoices linked to a City Ledger invoice are excluded from the standalone register query, preventing duplicate commercial-document representation in register totals.
- Event-linked City Ledger allocations are retained in source-aware detail history.
- Multi-currency overview metrics now return an unavailable metric (`null`) instead of aggregating incompatible currencies under the property base currency.

### Authorization and tenant isolation

- Every Billing scope still requires the authenticated organization context and permitted property scope.
- Billing read access is limited to the existing verified financial-role set. `ACCESS_REPORTS` was not used because it is assigned to operational roles and does not express financial-document visibility.
- Property-scoped assigned roles, including organization-wide roles, are resolved before access is granted.
- Detail and history queries retain property predicates, including related payments, allocations, refunds, credits, journals and audit records.

### Edge cases covered

- Empty/partial folio balances and credit history.
- City Ledger overdue status based on authoritative due dates.
- Event workflow status kept separate from settlement status.
- Decimal-string serialization.
- Multiple-currency metric refusal.
- Financial-role authorization boundary.
- Non-UUID event search values no longer become invalid UUID filters.

## Tests and checks

Executed from `apps/web`:

- Vitest focused suite: **4 files, 18 tests passed**.
- ESLint on Billing read-model, contract, route and page files: **passed**.
- `git diff --check`: **passed**.
- Direct `./node_modules/.bin/tsc --noEmit`: **passed**.

The repository `pnpm --filter web exec tsc --noEmit` wrapper could not run because the local pnpm signature verification failed while fetching the pinned pnpm release. The already-installed local TypeScript binary was used instead.

## Phase 2.2 hardening

- The register now uses a versioned, base64url-encoded cursor containing the normalized sort date, source, source ID and filter fingerprint.
- Ordering is deterministic: `sortDate DESC, source ASC, sourceId ASC`. Source-specific keyset predicates are applied before each bounded query, so tied timestamps do not depend on array order.
- A cursor cannot be reused with different filters. Invalid or mismatched cursors return `INVALID_CURSOR` rather than silently restarting from the first page.
- Register page size is capped at 100 and each source query requests at most one page plus one look-ahead row.
- Aging remains unavailable by design. No due date is invented for Folios or Event Invoices. Each aging bucket now declares `basis: UNAVAILABLE`, its `asOf` timestamp, and an empty eligible-source list.
- The overview `overdue` metric is explicitly labeled `CITY_LEDGER_DUE_DATE`; it does not imply a cross-source aging calculation.

## Known limitations for Phase 3 planning

- Overview aging remains explicitly unavailable rather than being inferred for sources without a single authoritative aging contract.
- Settlement-status filters that depend on normalized balances are applied after source retrieval; they should receive source-specific database predicates or an iterative keyset fetch before very large, heavily filtered registers are exposed.
- Database query-plan inspection was not executed because this verification did not connect to a database. It remains a deployment-readiness check.
- The register is read-only. Payment receipt, allocation, credit, refund and reconciliation mutations remain out of scope.

## Safety confirmation

- No Prisma migration was executed.
- No production data was changed.
- No Front Desk, POS, desktop/offline-sync, payment-posting or journal-posting behavior was modified.
- No new invoice, payment, receivables or general-ledger engine was introduced.
