# LodgeCore Billing — Phase 4 Receivables & Allocation Visibility

Date: 2026-10-21  
Status: implemented and verified; read-only only

## Delivered

- `/accountant/billing/receivables` unified receivables view.
- `GET /api/v1/accountant/billing/receivables` read-only API.
- `apps/web/src/lib/services/receivables-read-model.ts` source and allocation adapter.
- Receivable navigation from the Billing overview and Accountant shell.

## Source and balance rules

- Folios use the existing `getFolioBalance` authority; only the debit balance is collectible debt.
- City Ledger invoices use `CityLedgerInvoice.outstandingAmount` and `paidAmount`.
- Linked Event Invoices remain represented through their City Ledger document and are not counted as a second receivable.
- Standalone Event Invoices retain source-specific paid/outstanding semantics.
- Guest credits and corporate unapplied advances are not added to collectible receivables.
- Aging remains unavailable where an authoritative due-date contract is absent.
- Amounts remain decimal strings; allocation variance is exposed rather than silently correcting either source.

## Allocation and linkage rules

Allocations remain distinct from receipts. City Ledger allocation rows are summed against the authoritative invoice paid amount and expose allocation IDs and receipt-entry IDs. A variance is returned when the allocation total does not equal the invoice paid amount.

Corporate Payment-to-CityLedgerEntry linkage is resolved only through normalized existing references:

- `RESOLVED` — exactly one matching entry.
- `MISSING_REFERENCE` — no usable payment reference or no match.
- `MALFORMED_REFERENCE` — invalid control characters or unsupported length.
- `AMBIGUOUS_REFERENCE` — multiple entries match, including conflicting payment reference and receipt number.

Unresolved relationships are shown as linkage exceptions and are never guessed. No direct relation or migration was added.

## Tests and checks

- Focused Vitest suite: **6 files, 30 tests passed**.
- Tests cover folio balance authority, allocation separation, duplicate/missing/malformed/ambiguous references, decimal behavior and authorization contracts.
- ESLint on new Phase 4 files: **passed**.
- Direct web TypeScript check: **passed**.
- `git diff --check`: **passed**.

The full lint command still reports pre-existing errors in `AccountantLayout.tsx` (inline component creation and existing `any`/unused imports); those were not modified or resolved as part of this phase.

## Safety confirmation

- No production migrations or data changes.
- No allocation, write-off, refund, journal, reconciliation or payment mutation endpoints.
- No desktop, Front Desk, POS or offline-sync behavior changes.
- Receivables and allocation data are bounded and property-scoped; database query-plan validation remains deployment-environment work.
