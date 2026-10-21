# LodgeCore Billing, Invoicing & Payments — Phase 0 Audit

Date: 2026-10-21  
Scope: `apps/web`, `packages/db`, and the existing offline/front-desk financial paths  
Status: Read-only audit; no application or database changes made

## Executive finding

LodgeCore already has an authoritative accounting path. A new billing module must compose that path rather than introduce another receivables or posting engine.

The existing system separates some financial concepts correctly in storage and services, but the user experience is fragmented across Accountant, Front Desk, City Ledger, Night Audit, and Event Billing surfaces. The requested Billing, Invoicing & Payments workspace should therefore be an Accounting-shell experience over existing records first, followed by narrowly scoped additions where a capability is genuinely missing.

## Existing source-of-truth map

| Business concept | Current authoritative records/services | Current surfaces |
| --- | --- | --- |
| Guest folio charges and balance | `Folio`, `FolioItem`, `FolioCredit`, `FolioCreditApplication` | Front Desk folios, Accountant receivables, guest credits |
| Guest/foglio payment | `Payment` plus folio `PAYMENT` item; `FolioPaymentAccountingService`; `GeneralLedgerService` | `/api/v1/payments`, Front Desk payment flows, receipts |
| Corporate/city-ledger invoice | `CityLedgerInvoice`, `CityLedgerEntry`, `CityLedgerAllocation` | `/accountant/city-ledger/invoices`, account detail |
| Corporate receipt and allocation | `Payment` with `collectionSource=RECEIVABLES`, `CityLedgerEntry`, `CityLedgerAllocation`; `CityLedgerAccountingService` | `/api/v1/accountant/city-ledger/[accountId]/payment`, city-ledger payments |
| Event/conference billing | `EventInvoice`, `EventInvoiceItem`, linked folio/city-ledger records | Front Desk event invoices, F&B event accounting, approval center |
| Refund/guest credit | `Refund`, `RefundRequest`, `FolioCredit`, city-ledger credit entries, finance/refund services | Accountant refunds/guest credits and Front Desk guest-credit workflows |
| General ledger | `JournalEntry`, `JournalEntryLine`, `AccountingPeriod`; `GeneralLedgerService` | Accountant GL, revenue and accounting reports |
| GL account mappings | Property-scoped mappings resolved by `GLMappingService` | Financial account settings and posting services |
| Audit history | `AuditLog`, `FinancialAuditLog`, `SupervisorOverride` | Accountant audit and operational review surfaces |
| Offline continuity | Desktop local folio/payment/city-ledger mirrors and sync engine | LodgeCore Desktop Front Desk flows |

## Existing Accounting shell and routes

`apps/web/src/app/(dashboard)/accountant/layout.tsx` authenticates the user and enforces `MODULE_OPERATIONS` access with a property scope. It does not currently provide a dedicated nested Billing navigation shell. Accountant pages are currently separate routes under `/accountant`.

Relevant existing routes include:

- `/accountant` — live accountant command centre backed by `accountant-analytics`.
- `/accountant/revenue` — revenue reporting surface; should remain distinct.
- `/accountant/receivables` and `/accountant/statements` — existing receivable/report views.
- `/accountant/city-ledger`, `/accountant/city-ledger/invoices`, `/accountant/city-ledger/payments`, and account detail routes — corporate AR operations.
- `/accountant/guest-credits` and `/accountant/refunds` — credit/refund controls.
- `/accountant/cash-bank` and its deposits/expenses/handovers routes — treasury operations.
- `/accountant/audit`, `/accountant/gl`, `/accountant/settings`, and `/accountant/approval-center` — controls and accounting administration.
- `/frontdesk/folios`, `/frontdesk/event-invoices`, `/frontdesk/payments/receipt`, and `/frontdesk/reconciliation` — operational sources that must continue to work offline.

The requested `/accountant/billing/*` family is not currently present. It should be added as a composition layer with links into existing records, not as a second accounting shell.

## Financial lifecycle findings

### Strengths to reuse

- Payment writes use a unique `idempotencyKey` and the payment API returns an existing payment on retry.
- Folio payment posting uses a version-checked update inside a database transaction.
- Payment creation, folio balance movement, audit logging, and GL posting are grouped transactionally in the main folio payment path.
- Corporate AR payment flow already distinguishes applied amount from an unapplied corporate advance and posts those effects to separate mapped accounts.
- Corporate advance allocation is implemented transactionally in `CityLedgerAccountingService`.
- Refunds are intentionally routed through guest-credit/refund-request workflows; the legacy generic refund route is disabled.
- Journal posting resolves property mappings and respects accounting-period controls through the existing GL service.
- Property and organization boundaries are checked in the API paths and existing authorization utilities.

### Material gaps and risks

1. There is no single commercial invoice aggregate. City-ledger invoices, event invoices, and folios are separate records with different lifecycles and UI paths.
2. No `CreditNote` model or unified credit-note lifecycle was found. Existing reversal/refund/credit flows must be mapped before adding one.
3. Receipt allocation is split between city-ledger allocations and folio/guest-credit applications. A unified payment register must be a read model or carefully define links; it must not duplicate cash posting.
4. Existing payment lifecycle states are not a single shared state machine. Gateway payments, manual receipts, completed folio payments, refunds, and reconciliation have different status representations.
5. Reconciliation exists for front-desk/night-audit and gateway/reporting controls, but a property-scoped bank statement import/matching session model was not found.
6. The Accountant layout enforces module access but granular Billing navigation and per-operation capability mapping need to be established from the existing permission system.
7. The main folio payment endpoint currently rejects overpayments, while corporate AR permits controlled unapplied advances. Billing UX must expose this policy distinction rather than flatten it.
8. Some older/current service code constructs money through JavaScript numbers at service boundaries. New financial writes must retain the established Decimal database representation and avoid introducing floating-point calculations in persisted accounting decisions.

## Required invariants for Phase 1 design

- An invoice/document, payment/receipt, allocation, and journal entry remain distinct records linked by source references.
- Every posting path converges on `GeneralLedgerService` and existing property GL mappings.
- Issuance, payment receipt, allocation, credit, refund, and reconciliation each have independent state and audit history.
- Every financial mutation is property- and organization-scoped, validates closed-period policy, and is idempotent.
- Concurrent allocation cannot consume more than the invoice balance or available unapplied payment balance.
- POS, Front Desk, event billing, offline sync, and manual AR receipts cannot create duplicate cash or journal effects.
- Posted records are immutable; corrections are reversals, credit notes, refunds, or controlled adjustments.
- Dashboard totals are derived from persisted authoritative records and explicitly declare property, currency, date, and posting-status scope.

## Recommended implementation sequence

1. Define a read-only Billing workspace over existing City Ledger invoices, Event Invoices, folios, payments, credits, refunds, and posted journals.
2. Add contract/invariant tests for duplicate issue, duplicate callback, concurrent allocation, overpayment, closed period, property boundary, and offline sync.
3. Define the minimum missing domain additions: invoice-numbering configuration, a credit-note lifecycle if no equivalent is approved, and reconciliation sessions/import rows.
4. Implement write APIs only after the source mapping and permission matrix are approved.
5. Regression-test Front Desk, POS, Event Billing, Night Audit, offline sync, revenue reports, and refund account mappings before rollout.

## Phase 0 exit assessment

The source-of-truth inventory and initial gap list are complete. Phase 1 can begin with architecture and accounting-rule design. No Prisma migration has been executed and no production data has been changed.
