# LodgeCore Billing — Phase 6.1 Verification Closure

Date: 2026-10-21  
Status: implementation verified where executable; database/static verification outstanding

## Closure assessment

Phase 6 implementation is present and the focused contract suite remains green. The seeded `EXECUTIVE` role was found to receive the full baseline permission set but was missing from the Billing-read allowlist; it has now been added with a regression assertion. This environment does not provide a reachable test database, so concurrent financial-effect behavior and production role assignments have not been demonstrated and the phase is not marked production-ready.

## Idempotency verification

Repository inspection confirms that available-cash submission:

- requires a stable request idempotency key at the route boundary;
- derives a property-scoped deterministic operation identity;
- uses the existing unique `PosCashMovement.operationId` inside the transaction that creates the deposit, moves cash, updates the bank balance, and posts the journal;
- returns the existing deposit for a matching retry; and
- rejects reuse with a different amount, bank account, or bank reference.

The required concurrent database test was not executed because no test database is configured and the configured Neon endpoint could not be reached. No financial write was attempted. Release verification still requires a disposable database fixture and two concurrent requests using the same key, plus post-commit retry and payload-conflict cases.

## Authorization verification

The transaction-exception route now authenticates before querying and delegates organization, property, and financial-role checks to the existing `getBillingScope` path. Gateway, Night Audit, and Front Desk reconciliation reports use the same financial-read scope while retaining their property predicates.

Static route inspection confirms that unauthorized requests are rejected before the sensitive exception query. HTTP regression tests for unauthenticated, organization-mismatched, unauthorized-property, insufficient-role, and authorized cases remain recommended for the controlled web test environment.

## Monetary comparison verification

The decimal contract tests cover exact zero, four-decimal fractional boundaries, and non-zero variance. Deposit verification and Night Audit proof status now use exact four-decimal zero comparisons without the previous `0.01` tolerance. Existing report fields retain numeric compatibility.

The four-decimal scale is an implementation policy and must be confirmed against every supported property currency before enabling reconciliation workflows broadly. No currency conversion or tolerance policy was introduced.

## Production role verification

A read-only role-count query was successfully executed against the configured production database. No user identities or financial records were retrieved. Assigned production roles observed include `ACCOUNTANT`, `GENERAL_CASHIER`, `NIGHT_AUDITOR`, `GENERAL_MANAGER`, `DIRECTOR`, and `SUPER_ADMIN`; all are included in the Billing-read allowlist. `FRONT_DESK`, `RECEPTIONIST`, and `CASHIER` assignments are present and remain intentionally excluded from these sensitive reports. No production role assignment was changed. `FRONT_DESK_MANAGER` remains unresolved and was not granted access.

## Static verification

Executed:

- Focused Vitest suite: **6 files, 31 tests passed**.
- `git diff --check`: passed.
- Targeted ESLint: completed, but existing legacy findings remain in touched files (`any` usage and the existing React state-in-effect finding). No clean lint result is claimed.
- Web TypeScript check with incremental compilation disabled: started but exceeded the execution window without diagnostics and was interrupted. It remains unverified, not passed.

## Release decision

Phase 6.1 closes the repository-side review and executable pure-contract checks, but not release verification. Before production release, run the database-backed concurrency/replay suite and complete TypeScript and lint triage in a controlled CI or development environment.

No migration, production-data change, financial write against production, statement-line model, or desktop/offline/POS change was made.
