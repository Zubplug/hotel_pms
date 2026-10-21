# LodgeCore Billing — Phase 5 Reconciliation Audit

Date: 2026-10-21  
Status: audit complete; no reconciliation implementation changes made

## Executive conclusion

LodgeCore has several existing reconciliation controls, but they operate at different evidence levels and must not be flattened into one payment status:

1. `FrontdeskSession` and `PosSession` reconcile cashier custody and shift variance.
2. `BankDeposit` reconciles a cash deposit batch against a manually entered bank-confirmed amount.
3. The gateway report compares local gateway payments with live Paystack transactions.
4. Night Audit produces an operational and GL balance proof for a business date.

There is no `BankStatement`, statement-line, import-batch, or durable payment-to-bank-match model. Individual bank-line matching, duplicate statement import detection, fees, split deposits, and partial settlement evidence are therefore not supported as a general persisted capability.

## Capability matrix

| Capability | Existing source/workflow | Reliable evidence | Limitation | Recommendation |
| --- | --- | --- | --- | --- |
| Cashier custody | `FrontdeskSession`, `PosSession`, `PosCashMovement`, `ShiftControlAudit` | Expected/declared cash, session status, variance, handover state | Session-level, not individual bank evidence | Reuse for cash-up reporting |
| Bank deposit batch | `BankDeposit`, `BankDepositAllocation`, `CashHandover` | Expected amount, declared amount, bank-confirmed amount, difference, status | Manual amount confirmation; no statement lines or import identity | Reuse for deposit-level control |
| Bank submission | `BankDepositService.submitDeposit` / `submitAvailableCash` | Bank account, deposit date, bank reference, GL journal source `BANK_DEPOSIT` | No client idempotency key on available-cash submission; journal posting uses generated entries | Harden before write-enabled expansion |
| Deposit verification | `BankDepositService.startVerification` / `verifyAndReconcile` | `UNDER_RECONCILIATION`, `RECONCILED`, `EXCEPTION` and amount difference | Uses JavaScript number equality; no tolerance/Decimal policy; no statement evidence | Treat as manual deposit confirmation only |
| Gateway matching | `gateway-reconciliation` report and Paystack provider fetch | Local provider reference, amount/status comparison, missing local/provider rows | Live external dependency; report GET writes an audit log; no persisted match record; refund comparison uses gross payment amount | Keep provider-specific and read-only until evidence is persisted |
| Night Audit proof | `night-audit/reconciliation`, `NightAuditFinancialSnapshot`, `buildNightAuditBalanceProof` | Business-date source totals, payment groups, GL debit/credit balance, snapshot status | Recalculated report uses JavaScript numbers; not bank matching; source coverage is operational | Use as business-date control, not bank reconciliation |
| Transaction exceptions | `TransactionException`, cash-management exception APIs | Question reason, status, proposed resolution | Exception GET lacks authentication and organization/property authorization | Security fix required before broader exposure |
| Statement import | No matching Prisma model or route found | None | Duplicate lines, import retries, fees, split deposits and line-level matches cannot be represented | Schema may be justified later, after workflow design |

## Evidence state mapping

These are reporting interpretations of existing records, not new persisted states:

| Reporting state | Existing evidence | Audit interpretation |
| --- | --- | --- |
| Not reviewed | Deposit `DEPOSITED` or `UNDER_RECONCILIATION`; open/under-review session | Evidence exists but review is incomplete |
| Matched | Deposit `RECONCILED` with zero recorded difference; or a reconciled cash session where applicable | Matched only at that workflow’s evidence level |
| Partially matched | No general statement-line partial-match record exists | Unavailable; do not infer from partial payment allocation |
| Mismatched/disputed | Deposit `EXCEPTION`, non-zero `difference`, session variance/exception, or open `TransactionException` | Explicit exception evidence |
| Reversed/excluded | Reversed journal, cancelled/rejected deposit, refunded payment, or excluded operational record | Source-specific; not a common reconciliation state |
| Unknown | Payment has no explicit bank/cash evidence | Default for the Billing payment register |

`Payment.status = COMPLETED` is processing evidence only. It does not establish bank matching, deposit matching, or reconciliation.

## Duplicate and integrity audit

### Duplicate statement lines and repeated imports

No statement-line or import-batch model exists, so the repository cannot currently deduplicate imported bank evidence. `BankDeposit` is a manually assembled batch and has no statement-line identity or client-provided idempotency key.

### Duplicate deposit submission and journal posting

- `submitDeposit` is protected by the `PENDING_HANDOVER` status transition, so a second call after success is rejected.
- `startVerification` is protected by the `DEPOSITED` status transition.
- `verifyAndReconcile` accepts `UNDER_RECONCILIATION` and `EXCEPTION`; repeated exception reviews are allowed by design.
- `submitAvailableCash` creates a new deposit and posts a new `BANK_DEPOSIT` journal using generated identifiers. It has no request idempotency key, so a retried request can duplicate cash movement and journal effects if the first request commits before the client retries.
- `GeneralLedgerService.postJournal` validates accounting periods and balances but has no source/idempotency uniqueness check; it creates a fresh journal entry number each call.

### Partial settlements, fees and split deposits

`BankDeposit` stores one expected amount, one bank-confirmed amount and one difference. It can flag a difference, but cannot represent statement fees, multiple bank lines, partial line matches, or a split settlement with durable evidence. `BankDepositAllocation` allocates a deposit to cashier sessions, not bank statement lines.

### Reversals and offline/online overlap

Payment idempotency and offline sync use existing operation/idempotency conventions, while POS and Front Desk sessions provide separate custody controls. The audit found no unified bank-match record that could create a second receipt. However, deposit-level retries and the absence of GL source idempotency remain risks. Reversals are represented by source-specific payment/journal/deposit workflows, not a shared reconciliation lifecycle.

## Authorization and auditability

- Bank deposit mutation routes use `DEPOSIT_SUBMIT_ROLES` and `DEPOSIT_VERIFY_ROLES`, plus property scope.
- Front Desk session reconciliation uses a manager/finance role allowlist and property context.
- Gateway reconciliation uses `reports:read` plus property scope, which is broader than a dedicated financial-reconciliation capability and depends on an external provider call.
- Night Audit reconciliation and payment reports enforce property scope but do not consistently show a granular financial-report permission check.
- The `cash-management/transaction-exceptions` GET route reads by `propertyId` without authenticating the caller or resolving organization/property scope. This is a material tenant-isolation issue and should be fixed before exposing its data through a unified Billing surface.
- Bank deposit creation and submission produce cash movements and GL audit effects through existing services. Verification updates do not create a separate explicit audit-log event; the status transition and actor fields are the primary evidence.

## Accounting-period and posting controls

Deposit submission posts through `GeneralLedgerService`, which validates the accounting period and property scope. Reconciliation verification itself does not post a journal. Night Audit computes and compares posted GL totals but does not establish bank evidence. No new posting path is required for a future read-only reconciliation view.

## Minimum missing capability

A new reconciliation-session/statement model is not required merely to present the existing deposit, cashier, gateway and Night Audit evidence. It is genuinely required only if LodgeCore needs item-level bank statement import and matching. Such a future design would need, at minimum:

- property and organization scope;
- import batch identity and retry idempotency;
- statement-line identity, source reference, amount, currency, date and bank account;
- match links to canonical `Payment`, `BankDeposit`, `CashHandover` or other approved source records;
- partial/split/fee handling;
- explicit unmatched, matched, exception and reversed semantics;
- immutable audit history and closed-period policy;
- permissions separate from payment posting and deposit verification.

No schema change is recommended in Phase 5.

## Verification scope and limitations

Repository inspection covered the Prisma schema, Bank Deposit Service, cash handover/control services, Night Audit reconciliation routes, Front Desk reconciliation routes, gateway reconciliation, exception routes, permissions and GL posting path. No database connection, external provider call, migration, production-data operation, or financial mutation was performed.

The existing focused Billing tests remain the available executable regression suite. There are no dedicated Bank Deposit or reconciliation integration tests in the inspected test paths. Query-plan validation and live Paystack matching require a controlled deployment/test environment.

## Phase 5 exit assessment

The existing reconciliation capabilities and limitations are mapped. Payment completion is not treated as reconciliation. Duplicate matching/import risks, deposit retry risk, authorization gaps and the absence of statement-line evidence are documented. Phase 6 should begin with security/idempotency hardening and a decision on whether item-level statement matching is actually required; it should not introduce a reconciliation model by default.
