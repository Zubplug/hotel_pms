# Corporate Contract Commercial Exception Register

Status: open commercial review register

Scope: contract/API/website conversion readiness only. This is not a finding that the existing PMS-direct corporate accounts are invalid.

Source: read-only compatibility audit of the configured LodgeCore database on 2026-10-24.

No account, rate plan, City Ledger record, contract, migration, or financial record was changed.

## Review rules

- Existing `CorporateAccount`, `ratePlanId`, and City Ledger relationships remain unchanged.
- The audited accounts are treated as `PMS_DIRECT_LEGACY` accounts unless a later reviewed mapping says otherwise.
- PMS-direct staff bookings may continue using the existing CorporateAccount, legacy RatePlan and City Ledger workflow.
- Intended booking channels must be recorded separately: `PMS_DIRECT`, `STANDALONE_CORPORATE_WEBSITE`, `CORPORATE_API`, or a reviewed combination.
- Corporate API and website access remain disabled for an account until identity, contract, approval, and property scope are explicitly mapped.
- `MISSING_RATE` means missing coverage for a future contract-backed API/website offer; it does not mean a walk-in PMS account is unusable.
- Missing information is recorded as `NOT RECORDED`, not inferred.
- No public or room base rate may be substituted for a missing negotiated rate.
- No legacy rate plan is treated as an approved contract without commercial approval evidence.
- Contract onboarding requires an explicit owner, approver, effective dates, terms, and room-type coverage.

## Property context

- Audited corporate accounts: 13
- Audited property: Stanzel Grand Resort
- Active room types: 5 — DULUXE, EXECUTIVE, STANDARD, SUPERIOR, STANZEL SUITE
- Property base currency: NGN
- Supported currencies: NGN, USD
- Observed corporate City Ledger currency: NGN

## Account review register

The observed accounts were created for direct PMS operations, including staff-entered corporate/walk-in reservations. Their existing rate plans must not be exposed to the Corporate API or standalone corporate website merely because they are linked to a CorporateAccount. Contract-backed channel access requires a separate commercial review and explicit identity mapping.

| Account | Current rate-plan state | Observed coverage | Primary review status | Commercial owner | Approver | Contract dates | Terms decision |
|---|---|---|---|---|---|---|---|
| ALHAJI IDRIS MAMMAN DURKWA | `CORP-ALHAJIID-01` | All 5 active room types at NGN 30,000; effective 2026-10-24 | `REQUIRES_REVIEW` — no approval evidence | NOT RECORDED | NOT RECORDED | NOT RECORDED | Currency confirmed as NGN; tax, inclusions, deposit, cancellation, occupancy and stay terms unresolved |
| Academy Union of Polytechnic (ASUUP) | `CORP-ASUUP-01` | DULUXE, EXECUTIVE, STANDARD and SUPERIOR at NGN 26,000; STANZEL SUITE missing | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Missing room rate and all commercial terms require confirmation |
| CAP PLC PAINTERS TRAINING | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| CAP PLC SALES CAPABILITY | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| ECA | `CORP-ECARATE-01` | SUPERIOR at NGN 30,000; other active room types missing | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Missing room rates and commercial terms require confirmation |
| EZIENYI BROTHERS ASSOCIATION | Shared `WCV-CORP` | STANDARD and SUPERIOR at NGN 30,000; other active room types missing | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Resolve whether shared plan is intentional; confirm account-specific terms |
| FAMILY WORSHIP CENTER | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| NG EAGLE | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| NIGERIA INSTITUTE OF STRATEGIC STUDIES | `CORP-NISSRATE-02` | STANDARD and SUPERIOR at NGN 25,000; other active room types missing | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Missing room rates and commercial terms require confirmation |
| NNPC GROUP | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| THE PRAISE CHURCH GWARINPA | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| UNIVERSAL BASIC EDUCATION (UBEC) | No rate plan | No negotiated rates observed | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Do not use public/base pricing as a substitute |
| Worldwide Commercial Venture LTD | Shared `WCV-CORP` | STANDARD and SUPERIOR at NGN 30,000; other active room types missing | `MISSING_RATE` and `REQUIRES_REVIEW` | NOT RECORDED | NOT RECORDED | NOT RECORDED | Resolve shared-plan ownership and account-specific terms |

## Shared and unassigned plans

### Shared plan: `WCV-CORP`

The same corporate rate plan is linked to Worldwide Commercial Venture LTD and EZIENYI Brothers Association. The current records do not establish whether:

- the companies intentionally share identical commercial terms;
- one account was linked to the wrong plan;
- separate contract versions are required; or
- the plan should be replaced by account-specific rules.

Decision required before contract conversion: commercial owner and property approver must confirm ownership, scope, effective dates, room coverage, and terms.

### Unassigned plan: `CORP-NISSRATE-01`

An active corporate rate plan exists without a Corporate Account link. It must remain unassigned until its intended account and approval evidence are confirmed. It must not be exposed through the Corporate API or standalone corporate booking flow.

## Terms checklist for each account

The commercial reviewer must complete these fields before approval:

- Intended booking channels: PMS direct, standalone corporate website, Corporate API, or combination
- Whether the existing PMS-direct flow must remain the only enabled channel
- Authorized corporate owner and contact
- Property and contract reference
- Effective start and end dates
- Covered room types
- Minimum and maximum adults, children, and total occupancy
- Minimum and maximum stay
- Lead-time and advance-booking limits
- Weekday/weekend applicability
- Blackout dates
- Currency
- Tax treatment
- Meal and other inclusions
- Deposit or prepaid requirement
- Pay-later eligibility and City Ledger credit terms
- City Ledger account, currency, advance-payment and invoice-allocation arrangement
- Cancellation and no-show policy
- Authorized property approver
- Legacy compatibility or contract migration decision

## Technical conversion gate

No account may be converted to an approved contract until the register has:

1. A completed commercial owner and approver.
2. Complete applicable room-type pricing.
3. Explicit effective dates and restrictions.
4. Confirmed currency and policy terms.
5. Resolved shared or unassigned rate-plan findings.
6. Recorded approval evidence.
7. A reviewed contract-version snapshot.
8. An explicit channel decision and, where applicable, approved corporate identity mapping.

Until then, existing PMS records remain unchanged and corporate contract-backed pricing remains unavailable for that account.
