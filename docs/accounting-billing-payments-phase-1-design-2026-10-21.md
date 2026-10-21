# LodgeCore Billing, Invoicing & Payments — Phase 1 Design

Implementation specification · 2026-10-21  
Status: Design and contract phase only  
Database migrations: none  
Financial writes: none

## 1. Objective and boundaries

Phase 1 defines the shared read model, lifecycle contracts, permissions, API contracts, accounting invariants, and Phase 2 scope for Billing, Invoicing & Payments.

The proposed Billing workspace is a read/query composition over existing financial records. It is not a new invoice aggregate, payment engine, receivables ledger, or GL posting service. Existing Front Desk, POS, City Ledger, Event Billing, Night Audit, and desktop/offline flows remain authoritative and unchanged.

Phase 2 may implement read-only Billing overview, invoice register, and document detail views using this contract. New financial write APIs and schema changes require a later authorization.

## 2. Verified source of truth

| Concept | Verified records | Authoritative service/path | Phase 1 treatment |
| --- | --- | --- | --- |
| Guest commercial balance | `Folio`, `FolioItem`, `FolioCredit`, `FolioCreditApplication` | Folio balance helpers and Front Desk payment path | Read folio counters and balance; classify credits separately |
| Guest receipt | `Payment` and its folio `FolioItem` | `/api/v1/payments`, `FolioPaymentAccountingService` | One payment row; do not count its folio item as another receipt |
| Corporate invoice | `CityLedgerInvoice` | City Ledger invoice and accounting services | Use `outstandingAmount`, `paidAmount`, and source status |
| Corporate receipt | `Payment` with `collectionSource=RECEIVABLES` plus `CityLedgerEntry` | City Ledger payment route and `CityLedgerAccountingService` | Join payment/entry by source references; show unapplied advance explicitly |
| Corporate allocation | `CityLedgerAllocation` | City Ledger allocate/unapply routes | Sum allocation rows; preserve receipt and journal history |
| Event invoice | `EventInvoice`, `EventInvoiceItem` | Event billing and approval routes | Keep `workflowStatus` separate from payment `status` |
| Refund | `Refund`, `RefundRequest`, related credit entries | Guest-credit/refund services and approval workflow | Display request and execution separately |
| Journal | `JournalEntry`, `JournalEntryLine` | `GeneralLedgerService` and reversal service | Link by `sourceType/sourceId`, reference, and explicit source IDs |
| Period control | `AccountingPeriod` | `AccountingPeriodService.validatePeriodOpen` | Read-only endpoints expose posting/period state when available |
| Authorization | `requireOrganizationContext`, `hasPermission`, route-specific role checks | Existing organization/property and role framework | Every query starts with tenant scope; capability mapping remains explicit |

### Verified discrepancies and design consequences

- `Payment.status` is a string with `PENDING`, `COMPLETED`, `FAILED`, and `REFUNDED` comments; provider verification is separate in `verificationStatus`. The unified UI must not imply that `COMPLETED` means bank reconciliation.
- `EventInvoice.workflowStatus` (`DRAFT` through `ISSUED`) is independent from `EventInvoice.status` (`UNPAID`, `PARTIAL`, `PAID`, and `VOID`). Both must be returned.
- `CityLedgerAllocation` has no idempotency key or version field. Phase 2 must be read-only for allocation until a later design approves a safe concurrency/idempotency strategy.
- `GeneralLedgerService.postJournal` accepts number-valued line amounts and creates a new journal entry per call. Phase 1 treats it as the existing posting authority and records the precision/idempotency risk for later hardening; it does not replace or silently wrap it.
- `CityLedgerInvoice` is an invoice-like AR document, but `Folio` is an operational guest account and `EventInvoice` is both a commercial document and event workflow record. They must not be flattened into one semantic entity.
- `RefundRequest` already has a unique idempotency key and approval status; `Refund` has its own optional idempotency key and execution status. Requests and completed refunds are separate register rows or linked lifecycle sections.

## 3. Unified Billing read model

The read model is a TypeScript/query result contract, not a persisted table.

```ts
type BillingDocumentSource = 'FOLIO' | 'CITY_LEDGER_INVOICE' | 'EVENT_INVOICE';

type BillingDocument = {
  source: BillingDocumentSource;
  sourceId: string;
  organizationId: string;
  propertyId: string;
  reference: string;
  customer: { kind: 'GUEST' | 'CORPORATE' | 'EVENT' | 'UNKNOWN'; id?: string; name: string };
  issueDate?: string;
  dueDate?: string;
  currency: string;
  grossAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  sourceStatus: string;
  settlementStatus: 'DRAFT' | 'ISSUED' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' | 'CREDITED';
  workflowStatus?: string;
  balanceAuthority: 'FOLIO_COUNTERS' | 'CITY_LEDGER_INVOICE' | 'EVENT_INVOICE';
  related: { paymentIds: string[]; allocationIds: string[]; creditIds: string[]; refundIds: string[]; journalIds: string[] };
};
```

### Source adapters

1. `FOLIO`: reference is `folioNumber`; gross amount is authoritative folio charge total; paid amount is authoritative `totalPayments`; signed balance is derived by the existing folio balance helper so guest credit is not shown as AR.
2. `CITY_LEDGER_INVOICE`: reference is `invoiceNumber`; amounts and status come from `CityLedgerInvoice`; allocation rows are related through `CityLedgerAllocation.invoiceId`; corporate excess remains an unapplied receipt/advance.
3. `EVENT_INVOICE`: reference is the existing event invoice identifier until a verified display-number field exists; gross, paid, and currency come from `EventInvoice`; `workflowStatus` and payment `status` are both retained; linked City Ledger invoice is a related document, not a second amount.

### Duplicate prevention

- Register identity is `(source, sourceId)`, never invoice number alone.
- A linked `EventInvoice`/`CityLedgerInvoice` pair renders as one primary event document with a linked AR document reference; amounts are not summed twice.
- A payment is counted once by `Payment.id`. Its `FolioItem` is a posting/detail representation, not another receipt.
- A City Ledger receipt is counted once by `Payment.id` or, where the existing route has only the subledger entry, once by `CityLedgerEntry.id`; the query must select one canonical representation and expose the other as a link.
- Allocation totals are presentation data and never generate journal rows during reads.

### Query scope and consistency

Every query requires `organizationId` from `requireOrganizationContext`, a requested `propertyId` contained in `ctx.propertyIds`, and explicit date/currency/status filters. Monetary values are returned as decimal strings. Paginated registers should use a stable `(createdAt, sourceId)` cursor or a documented source-specific ordering; offset pagination must not mix unstable union ordering.

Overview metrics must declare:

- property scope;
- currency scope, with no cross-currency sum;
- date basis (`issueDate`, `businessDate`, `createdAt`, or `dueDate`);
- inclusion of issued/posted records only;
- treatment of voids, reversals, credits, unapplied advances, and refunds.

## 4. Lifecycle and state-transition contract

These are normalized presentation states. Adapters map them to existing source fields; they do not update source states.

| Concept | Existing state fields | Normalized states | Allowed read interpretation |
| --- | --- | --- | --- |
| Commercial document | Folio status/balance; City Ledger invoice `status`; Event invoice `workflowStatus` + `status` | `DRAFT`, `ISSUED`, `UNPAID`, `PARTIAL`, `PAID`, `OVERDUE`, `VOID`, `CREDITED` | `OVERDUE` is derived only when due date has passed and authoritative outstanding amount is positive |
| Receipt | `Payment.status`, `verificationStatus`, `Refund.status` | `INITIATED`, `PENDING_VERIFICATION`, `CONFIRMED`, `POSTED`, `FAILED`, `REVERSED`, `REFUNDED` | Do not infer `RECONCILED` from any payment status |
| Allocation | City Ledger allocation rows; folio credit applications | `UNALLOCATED`, `PARTIAL`, `FULL` | Available amount is receipt/credit amount less valid allocations/applications |
| Refund request | `RefundRequestStatus` | `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `REJECTED`, `FAILED`, `CANCELLED`, `EXPIRED` | Request is not a completed refund |
| Reconciliation | Existing front-desk/gateway reports and verification controls | `IMPORTED`, `SUGGESTED`, `MATCHED`, `EXCEPTION`, `REVIEWED`, `CLOSED` | No persisted unified bank-session state exists yet; Phase 2 only displays existing evidence |

### State rules

- An issued document is not edited in the read model. Historical corrections must be represented by existing reversal, credit, refund, or adjustment records.
- `OVERDUE` is a query-time projection and must not be written as a new source status.
- Event approval (`workflowStatus`) must not be treated as invoice settlement.
- A posted receipt can remain unreconciled or unallocated.
- Allocation reversal preserves the original receipt and its original posting; it changes only allocation/subledger state through an authorized existing pathway.

## 5. Accounting posting and reversal matrix

| Event | Existing authority | Read-model representation | Phase 1 write decision |
| --- | --- | --- | --- |
| Folio charge/revenue | Folio/FolioItem and existing revenue/night-audit posting | Source document + linked `FolioItem`/journal lines | No new posting |
| Folio payment | `/api/v1/payments` + `FolioPaymentAccountingService` | One receipt, folio balance, linked journal references | Do not duplicate |
| Corporate invoice/routing | City Ledger services + GL mappings | Invoice, transfer entry, linked journal | Do not reissue |
| Corporate payment | City Ledger payment route + `CityLedgerAccountingService` | Receipt, allocations, unapplied advance, journal | Do not duplicate cash receipt |
| Event invoice issue | Event billing/approval/finalization path | Event document, workflow status, linked folio/City Ledger document | No new issue path |
| Deposit/advance | Existing folio/corporate advance records and mapped liability | Receipt/credit with unapplied amount and account treatment | Preserve existing mapping |
| Credit/refund | Existing guest-credit, refund-request, refund, and reversal services | Request, execution status, source and journal links | No generic refund endpoint |
| Journal reversal | `GeneralLedgerService.reverseJournal` | Original journal + reversal journal pair | Never mutate historical amounts in read model |
| Reconciliation difference | Existing control/reporting pathways | Exception signal only | No bank-session write model in Phase 1 |

The historical account mappings referenced by existing repair/revenue work remain resolved through `GLMappingService`; no account code is hard-coded in Billing.

## 6. Read-only API contract matrix

These contracts are for Phase 2 implementation. They are not implemented by this Phase 1 change.

| Endpoint | Method | Required scope | Canonical sources | Key query parameters | Response |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/accountant/billing/overview` | GET | `billing:view` + property scope | All three document adapters, payments, credits, exceptions | `propertyId`, `currency`, `from`, `to`, `asOf`, `status` | KPI cards, trend points, aging buckets, attention counts, scope metadata |
| `/api/v1/accountant/billing/invoices` | GET | `billing:view` + property scope | Folio, City Ledger invoices, Event invoices | `propertyId`, `source`, `status`, `debtor`, `q`, `from`, `to`, `cursor`, `limit` | `BillingDocument[]`, cursor, totals scoped to current filter |
| `/api/v1/accountant/billing/invoices/:source/:id` | GET | `billing:view` + property scope | One source record and related sources | none | Normalized document, source payload, payment/allocation/credit/refund/journal links, audit history |
| `/api/v1/accountant/billing/payments` | GET | `billing:view` + property scope | Payment plus canonical subledger links | `propertyId`, `status`, `method`, `source`, `q`, `from`, `to`, `cursor`, `limit` | Receipt rows with allocated/unapplied/reconciliation status |
| `/api/v1/accountant/billing/receivables` | GET | `receivables:view` + property scope | Folio balances, City Ledger invoices, credits | `propertyId`, `currency`, `asOf`, `bucket`, `debtor`, `cursor`, `limit` | Debtor rows, invoice rows, aging buckets, unapplied credits |
| `/api/v1/accountant/billing/invoices/:source/:id/journals` | GET | `billing:audit_view` + property scope | Journal source links and references | `propertyId` | Journal summary and line drill-down; sensitive fields filtered |

All endpoints return `scope: { organizationId, propertyId, currency, asOf, postingBasis }`, decimal strings, and stable source identity. Errors include `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_SCOPE`, and `INVALID_FILTER` without leaking cross-tenant existence.

## 7. Permissions and approval matrix

The current system has property-scoped roles, organization membership, explicit permission records, and route-specific role checks. Phase 2 must resolve actual permission names from seeded role data before wiring a Billing navigation or endpoint. The capability names below are design identifiers, not new roles.

| Capability | Accountant | General cashier | AR officer | Controller/manager | Night auditor | Super admin |
| --- | --- | --- | --- | --- | --- | --- |
| `billing:view` | yes | limited | yes | yes | read-only | subject to org scope |
| `billing:audit_view` | yes | no/sensitive subset | yes | yes | limited | subject to org scope |
| `billing:record_receipt` | permitted existing cashier/AR path | yes | yes | yes | no | subject to scope |
| `billing:allocate` | permitted role/path | no unless assigned | yes | yes | no | subject to scope |
| `billing:reverse_allocation` | controller approval or existing manager role | no | no without approval | yes | no | subject to scope |
| `billing:issue_invoice` | source-specific permission | no | permitted source-specific path | yes | no | subject to scope |
| `billing:credit_note` | no by default | no | request only | approve | no | subject to scope |
| `billing:refund_request` | existing approved workflow | request path only | request/track | approve/execute as configured | no | subject to scope |
| `billing:write_off` | no by default | no | request only | approve | no | subject to scope |
| `billing:reconciliation_close` | no by default | no | prepare/match | review/close | investigate | subject to scope |

Maker-checker is required for refunds, write-offs, credit notes, allocation reversals, and reconciliation close when configured approval rules apply. UI visibility is not authorization; server-side scope and capability checks are mandatory.

## 8. Financial invariant catalogue and test plan

| ID | Contract | Test status in this phase |
| --- | --- | --- |
| FIN-01 | Retrying a financial event cannot create duplicate journal effects | Existing idempotency seams verified; integration test requires database fixture and is deferred |
| FIN-02 | Allocation total cannot exceed receipt available amount | Pure decimal/contract tests added; DB concurrency test deferred |
| FIN-03 | Allocation cannot exceed invoice outstanding amount | Pure contract tests added; route integration deferred |
| FIN-04 | Allocation does not create another cash receipt | Read-model contract; integration test deferred |
| FIN-05 | Posted documents/journals are not silently overwritten | Existing reversal path verified; API authorization test deferred |
| FIN-06 | Every mutation validates tenant, property, permission, and period | Existing route/service checks verified; cross-route matrix test deferred |
| FIN-07 | Corporate advances remain unapplied liability/credit treatment | Existing City Ledger service verified; regression fixture deferred |
| FIN-08 | Folio overpayment remains distinct from corporate advance | Existing endpoint behavior verified; pure policy test added |
| FIN-09 | Refunds use approved existing paths | Legacy refund endpoint verified disabled; workflow integration deferred |
| FIN-10 | Offline sync cannot duplicate payment/journal | Desktop sync code identified; end-to-end desktop test deferred |
| FIN-11 | Metrics reconcile to authoritative scoped records | Query implementation deferred to Phase 2 |
| FIN-12 | Decimal arithmetic is exact | Exact decimal helper tests added; existing GL number boundary remains a hardening risk |
| FIN-13 | Posted and reconciled are independent states | Pure contract test added |

Required integration tests for a later phase: two concurrent allocations, repeated gateway callback, closed-period posting, cross-property source IDs, offline replay, source-link duplicate aggregation, refund failure, and PDF authoritative-value matching.

## 9. Missing capability assessment

| Capability | Existing reuse | Decision |
| --- | --- | --- |
| Unified payment register | `Payment`, City Ledger entries/allocations, folio credits, refund records | Read-model union first; no new payment table |
| Invoice numbering | City Ledger invoice has property-scoped unique number; Event Invoice has no verified common number; folio number is unique | Phase 2 displays source references; numbering configuration requires separate approved design if common issuance is requested |
| Credit notes | No verified `CreditNote` model/lifecycle; existing credits/refunds/reversals have different meanings | Do not add in Phase 1; approve a source-specific credit-note contract before schema work |
| Bank reconciliation sessions | Existing operational/gateway reconciliation surfaces, no verified unified bank-session model | Phase 2 only exposes current evidence; new session/import schema is a later controlled change |
| Aging | City Ledger due dates and folio/business dates exist; event due date is not consistently represented | Compute only where authoritative due date exists; document fallback and never invent due dates |

## 10. Risks and unresolved decisions

1. Existing payment and journal services accept number-valued amounts. Decimal-safe boundaries and idempotent journal references need a later hardening decision.
2. Allocation rows lack an idempotency key/version guard. Allocation writes must not be added to the unified workspace until concurrency semantics are approved.
3. A single cross-source customer identity is not guaranteed. The read model must preserve source customer kind and IDs rather than attempt fuzzy merging.
4. Event invoices linked to City Ledger invoices need an explicit primary-document policy for exports and totals.
5. Existing permission names and role assignments must be queried from seed/configuration data before endpoint implementation.
6. A reconciliation session and credit-note schema may be justified, but neither is required for the first read-only workspace.

## 11. Phase 2 recommendation

Implement only:

1. A shared server-side query module that returns the normalized `BillingDocument` and receipt contracts above.
2. `/accountant/billing` overview with explicit scope metadata and live persisted metrics.
3. `/accountant/billing/invoices` register with source/status filters, cursor pagination, and source-preserving links.
4. `/accountant/billing/invoices/:source/:id` read-only detail with payments, allocations, credits, refunds, journal references, posting status, and audit history.
5. Focused query-contract tests and authorization tests using seeded or isolated fixtures.

Do not implement invoice issuance, payment recording, allocation mutation, credit notes, refunds, reconciliation imports, or migrations in Phase 2 without separate approval.

## 12. Phase 1 exit assessment

- Verified source map: complete.
- Unified read-model contract: complete.
- Lifecycle/state-transition contract: complete.
- Posting/reversal matrix: complete.
- Read-only API contract matrix: complete.
- Permission/approval matrix: complete as capability design; actual permission-name mapping remains a Phase 2 prerequisite.
- Invariant catalogue and test plan: complete; database/concurrency integrations are explicitly deferred.
- Schema-addition assessment: complete; no speculative additions recommended.

No migration was executed, no production data was changed, and no Billing UI or financial write API was implemented.
