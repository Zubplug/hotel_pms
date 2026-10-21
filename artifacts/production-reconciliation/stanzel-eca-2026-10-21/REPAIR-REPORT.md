# Stanzel Grand Resort — ECA Receivables Repair Report

Date: 2026-10-21
Property: Stanzel Grand Resort (`9b8a4229-4059-42f4-9565-51cfdbe79046`)
Account: ECA (`732e1ebc-8add-45ee-b4d8-8c30338f2976`)
Currency: NGN

## Scope and safety status

- The ECA reconciliation section below is a historical reconciliation record.
- The separate refund-folio repair recorded below changed only the verified folio status metadata; no production balances, invoices, allocations, or journals were changed.
- `/accountant/receivables` remains city-ledger-only per the approved scope.
- A recovery export was created at `/private/tmp/stanzel-eca-reconciliation-2026-10-21/`.

## Transaction-level reconciliation

| Source | Amount (NGN) |
|---|---:|
| Transfer-in entries | 576,000.00 |
| Payment allocations | (550,000.00) |
| Expected open balance | 26,000.00 |
| Open invoice outstanding | 26,000.00 |
| Stored account balance | 362,000.00 |
| Unexplained stored-balance difference | 336,000.00 |

The invoice and allocation records agree: seven invoices are paid, and invoice `AR-RES-252461-83-699D5C30` has NGN 26,000 outstanding. The NGN 336,000 difference is therefore a stale or incorrectly updated `CityLedgerAccount.balance` value, not an unresolved invoice/payment allocation.

## Proposed repair

1. In a transaction, re-read the account, invoices, entries, and allocations and assert that the above totals have not changed.
2. Set the ECA subledger balance to NGN 26,000 only after the approved GL offset account is supplied.
3. Post a balanced, immutable adjustment journal for NGN 336,000 with a clear AR-reconciliation reference and source metadata.
4. Record an audit event containing the before/after balance, evidence export hashes, approving user, and journal ID.
5. Re-run the city-ledger, invoice, allocation, and GL-control reconciliation.

No adjustment journal is proposed until the authorized offset account is identified. The production repair must not use an arbitrary expense or suspense account.

## Posted repair

The authorized repair was subsequently posted atomically after approval:

- Journal: `JE-AR-RECON-ECA-20261021`
- Journal ID: `74c1ba0d-bddd-4ec4-baeb-967e74f95c14`
- Reference: `AR-RECONCILIATION-ECA-20261021-336000`
- Debit: `6700 Miscellaneous Operations` — NGN 336,000
- Credit: `1140 Accounts Receivable (City Ledger)` — NGN 336,000
- ECA balance after repair: NGN 26,000
- Entry-derived ECA balance after repair: NGN 26,000
- Remaining ECA drift: NGN 0.00
- Audit action: `AR_RECONCILIATION_POSTED`

The journal is balanced: total debits and credits are both NGN 336,000. The recovery export remains unchanged and is referenced by the audit record.

## Wider account-scan correction

A preliminary wider scan incorrectly reported Skippers and WCV as balance drifts because it used an invalid formula: it subtracted allocations from transfer entries instead of subtracting allocations from payment entries.

The corrected transaction-level review confirms:

| Account | Stored balance | Supported balance | Result |
|---|---:|---:|---|
| ECA | 26,000.00 | 26,000.00 open invoice | Repaired |
| Skippers / Walk-Outs | 214,500.00 | 214,500.00 open invoices | No repair required |
| WCV | (1,044,000.00) | (1,044,000.00) unapplied legacy corporate credit | No repair required |

WCV's negative balance is a valid corporate credit/prepayment position. Other unapplied corporate receipts remain in the application/advance workflow and were not incorrectly converted into receivable or expense adjustments.

## Production refund-folio closure repair

A read-only production scan identified 412 checked-out reservations with `OPEN` folios. Most were ordinary legacy zero-balance folios and were intentionally left untouched. The repair rule was narrowed to a folio that was simultaneously:

- linked to a `CHECKED_OUT` reservation;
- still `OPEN`;
- at an effectively zero balance; and
- associated with a `COMPLETED` refund.

Exactly one folio matched all four conditions:

| Folio | Reservation | Refund | Pre-repair state | Repair |
|---|---|---:|---|---|
| `FOL-466179` | `RES-970868-182` | NGN 33,000.00 | `OPEN`, balance NGN 0.00 | `CLOSED`, balance NGN 0.00 |

The repair was committed atomically on 2026-10-21 at 10:22:41 UTC. It incremented the folio version from 3 to 4, set `closedAt`, set `closedBy` to the authorized refund actor, and created audit action `FOLIO_REPAIRED_CLOSED_AFTER_COMPLETED_REFUND` with request ID `efd108d5-f002-43a3-88cb-e4fe2125523e`. No GL entry or payment amount was altered.

Post-repair verification found 0 checked-out open folios with a completed refund, including refunds linked through either the folio or its payment.

## Checked-out folio closure repair

Per the approved operational rule that checkout closes the guest folio, the remaining production population was repaired as a separate status-only batch:

- Candidates: 411 open folios linked to `CHECKED_OUT` reservations across Stanzel Grand Resort and Bally’s Place.
- Distribution: 369 Stanzel folios and 42 Bally’s folios.
- Balance mix: 378 zero-balance folios, 12 debit-balance folios, and 21 credit-balance folios.
- Net balance before repair: NGN (140,800.00).
- Updated: all 411 folios to `CLOSED`.
- Preserved: every existing `balance`, payment, charge, credit, invoice, and GL record.
- Audit trail: 411 `FOLIO_CLOSED_AFTER_CHECKOUT_REPAIR` records under request ID `c6d3cce9-5be3-4db8-b2e8-3e8ad7cf3b92`.

Final production verification: 0 open folios remain for checked-out reservations. The 33 non-zero balances were closed without being zeroed or written off; they remain available for receivables/credit workflows.

## Current debt and credit verification

The current checked-out, closed, non-zero folios were reconciled against their source counters rather than relying on the cached balance alone:

- 24 positive folios totaling NGN 1,002,021.27 agree exactly with `totalCharges - totalPayments` and are genuine guest debt.
- 21 negative folios totaling NGN 783,800.00 agree exactly with available `FolioCredit.remainingAmount` and are genuine guest credits.
- One positive folio is fully transferred to City Ledger.
- One positive folio has only a partial City Ledger transfer: NGN 5,000 transferred against a NGN 28,000 balance.
- The remaining 23 positive exposures have no complete City Ledger transfer.
- None of the 21 guest-credit folios has a corresponding `REFUND_OWED` City Ledger entry.

This confirms that the remaining issue is settlement routing, not balance calculation. No additional production transfer or GL posting was made by this verification.

## Checkout settlement repair

The verified checkout exceptions were repaired using the existing property accounts and the shared city-ledger accounting service:

- 24 genuine debit folios totaling NGN 1,002,021.27 were routed to `Skippers / Walk-Outs` through `TRANSFER_IN` entries and AR invoices.
- 21 genuine credit folios totaling NGN 783,800.00 were routed to `Pending Guest Refunds` through `REFUND_OWED` entries.
- Each folio received an offsetting folio item and was normalized to balance `0.00` without changing the underlying charge/payment history.
- 45 audit records were created under request prefix `checkout-settlement-repair-2026-10-21:`.
- 45 balanced AR GL journals were posted: 90 lines, total debits equal total credits, with zero journal imbalance.
- Final verification: no checked-out closed folio remains with a non-zero balance.

The 45 transfers are settlement routing, not debt forgiveness or credit cancellation. Positive balances remain collectible in the Skipper city ledger; negative balances remain payable through the guest refund workflow.

## Approved legacy settlement posting

The approved instruction was to clear only the 45 entries created by the checkout repair on 2026-10-21, excluding older records with similar references. The posting was restricted to the exact repair batch window (`2026-10-21T11:27:00Z` through `2026-10-21T11:34:30Z`) and validated against the expected totals before posting.

- 24 asserted historical Skipper collections were posted as settled PAYMENT entries totaling NGN 1,002,021.27; all 24 linked invoices are `PAID` with NGN 0.00 outstanding.
- 21 asserted historical guest refunds were allocated and posted as settled `REFUND_OWED` entries totaling NGN 783,800.00.
- A dedicated asset control account, `1190 Legacy Settlement Clearing`, was created for each affected property because no suitable existing clearing account was available. `6700 Miscellaneous Operations` was not used.
- 45 balanced GL journals and 90 lines were posted under the `legacy-checkout-settlement-2026-10-21-` reference family. Total debits and credits are both NGN 1,785,821.27; journal imbalance is NGN 0.00.
- 45 `LEGACY_SETTLEMENT_POSTED` audit records were created. Each record identifies the original entry, settlement type, clearing account, and actor.

The clearing account remains an explicit control balance pending documentary support or final accounting disposition; this posting does not claim to independently prove a bank collection or an external refund. The resulting net clearing balances are NGN 708,021.27 debit for Stanzel Grand Resort and NGN 489,800.00 credit for Bally’s Place.

## Approved corporate legacy refund settlements

Following explicit approval that the historical corporate refunds had already been paid, the open payment entries for the requested accounts were settled:

- Worldwide Commercial Venture LTD (WCV-LTD): NGN 1,044,000.00.
- EZIENYI BROTHERS ASSOCIATION: NGN 60,000.00 across two payments, including the residual NGN 30,000.00 on a partially allocated payment.
- Total: NGN 1,104,000.00.

The existing EZIENYI invoice allocation was preserved and the residual payment amounts were allocated without changing the invoice history. Each payment was marked `SETTLED`, and both corporate account balances are now NGN 0.00. Three balanced GL journals were posted: debit `2300 Advanced Deposits` and credit `1190 Legacy Settlement Clearing`, with total debits and credits of NGN 1,104,000.00. Three `LEGACY_CORPORATE_REFUND_SETTLEMENT_POSTED` audit records were created.

The WCV historical open `ADJUSTMENT` reversal record remains untouched because it is not an open payment or refund obligation; it is retained as part of the original correction trail.

## Recovery export hashes

```text
city-ledger-account.csv  87946a29c38842935089913c8e689ec96daca9f8ef84e18c27170414047990af
invoices.csv             28fe0339992b99cb86c6fa3efdbab13b5f76d34c004bfc161ca146d9d29c046d
entries.csv              cf9e931e74354290f212b20d4f99c87b52d3023cac0e80fddc57495a7a1afbc6
allocations.csv          6a51bb78a7f3195238c89d0146cbe604c159ae568e5296753c405e152d8c4894
```
