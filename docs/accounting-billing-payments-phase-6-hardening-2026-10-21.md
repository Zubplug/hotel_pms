# LodgeCore Billing — Phase 6 Security and Idempotency Hardening

Date: 2026-10-21  
Status: implemented; no migrations or production-data changes

## Outcome

Phase 6 addressed the highest-priority reconciliation risks without adding a statement-import model or changing desktop, Front Desk, POS, offline-sync, or general-ledger posting architecture.

## P0 — Transaction-exception authorization

`GET /api/v1/cash-management/transaction-exceptions` now requires an authenticated session and resolves access through the existing `getBillingScope` authorization path. The route therefore validates:

- authenticated user;
- organization membership;
- permitted property scope; and
- an existing financial Billing-read role.

The property predicate remains on the database query. Unauthorized callers receive `401` or `403` before exception records or related payment data are queried.

## P1 — Available-cash idempotency

Available-cash submission now requires an 8–128 character stable `idempotencyKey` from the caller. The key is scoped to the property and hashed into a deterministic deposit reference and operation identifier.

The existing unique `PosCashMovement.operationId` is used as the atomic financial-effect guard inside the same database transaction as:

- `BankDeposit` creation;
- source cash-account movement;
- bank-account balance movement; and
- the existing `GeneralLedgerService.postJournal` call.

A legitimate retry returns the original deposit. Reusing a key with a different amount, bank account, or bank reference returns a conflict. No global GL idempotency behavior was changed, and no schema migration was required.

The web submission control retains the same key for a retry and creates a fresh key for a new submission attempt.

## P2 — Exact reconciliation comparisons

Deposit verification now normalizes confirmed and expected amounts through the existing exact decimal contract and stores the calculated difference as a decimal string. Reconciliation is `RECONCILED` only when the exact four-decimal difference is zero; no `0.01` tolerance is applied.

Night Audit balance-proof status comparisons now use the same four-decimal exact-zero rule. Existing report fields remain numeric for compatibility, while status decisions are made from exact decimal differences. The resolution text declares the comparison policy.

This phase does not rewrite unrelated historical number-based accounting calculations or the general ledger service.

## P3 — Sensitive report access

Gateway reconciliation, Night Audit reconciliation/payment reports, and Front Desk reconciliation now use the existing Billing financial-read scope in addition to authentication and property filtering. `Payment.status` and provider comparison results remain report evidence only; they are not converted into bank reconciliation states.

Gateway report access continues to create the existing audit-log access record. No financial posting is performed by these report routes.

## Verification

Executed:

- Focused Vitest suite: **6 files, 31 tests passed**.
- Exact decimal contract tests: passed, including zero, fractional boundary, and non-zero variance cases.
- `git diff --check`: passed.
- Targeted ESLint invocation: completed with existing legacy findings in the touched report/service files, including pre-existing explicit `any` usage and the existing React state-in-effect finding. No clean lint result is claimed.

The direct web TypeScript check was started twice but produced no diagnostics before exceeding the available execution window and being interrupted. It is therefore reported as not completed, not as passed.

## Files changed

- Transaction-exception authorization route.
- Available-cash submission route and web control.
- Deposit verification route and `BankDepositService`.
- Night Audit balance-proof comparison helpers.
- Gateway, Night Audit, and Front Desk reconciliation report authorization.
- Shared decimal contract tests/helpers.

## Remaining risks and decisions

- A database-backed integration test against concurrent requests is still required in a controlled test environment. The implementation relies on the existing unique `PosCashMovement.operationId` constraint and transaction boundary; no production concurrency test was run here.
- Existing cash-account availability and some legacy service boundaries still use JavaScript numbers. This phase hardens the requested reconciliation comparisons but does not perform a broad financial arithmetic rewrite.
- Targeted lint findings and the long-running TypeScript check should be triaged separately from the security/idempotency changes.
- Gateway reconciliation still depends on the external provider and remains a provider-specific comparison report.
- Statement-line matching is still not recommended by default. It remains a separate product decision requiring import identity, line matching, fee/split handling, and audit lifecycle design.

## Safety confirmation

No Prisma migration was executed. No production database or financial record was changed. No new financial write endpoint, statement model, reconciliation-session model, or parallel posting service was introduced.
