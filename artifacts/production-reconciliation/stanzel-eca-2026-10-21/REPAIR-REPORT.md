# Stanzel Grand Resort — ECA Receivables Repair Report

Date: 2026-10-21
Property: Stanzel Grand Resort (`9b8a4229-4059-42f4-9565-51cfdbe79046`)
Account: ECA (`732e1ebc-8add-45ee-b4d8-8c30338f2976`)
Currency: NGN

## Scope and safety status

- This is a read-only reconciliation report.
- No production rows, balances, invoices, allocations, or journals were changed.
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

## Recovery export hashes

```text
city-ledger-account.csv  87946a29c38842935089913c8e689ec96daca9f8ef84e18c27170414047990af
invoices.csv             28fe0339992b99cb86c6fa3efdbab13b5f76d34c004bfc161ca146d9d29c046d
entries.csv              cf9e931e74354290f212b20d4f99c87b52d3023cac0e80fddc57495a7a1afbc6
allocations.csv          6a51bb78a7f3195238c89d0146cbe604c159ae568e5296753c405e152d8c4894
```
