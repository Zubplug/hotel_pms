# LodgeCore night-audit architecture audit

Audit date: 2026-10-13  
Scope: `/night-audit`, its status/execute APIs, the Prisma night-audit models, and the existing desktop posting path.

## Findings

### Existing production boundaries

- The repository is a pnpm/Turborepo monorepo. `apps/web` is the PMS web application; `apps/website` is the public booking surface; `apps/desktop` is the offline Front Desk/POS application; `packages/db` owns Prisma and the shared database client.
- `/night-audit` is mounted through `NightAuditLayout` and currently renders `apps/web/src/app/night-audit/client.tsx`. Dedicated control routes already exist for reconciliation, rooms, F&B, AR, city ledger, AP, reports, and history.
- The primary data endpoint is `GET /api/v1/night-audit/status`. It requires an authenticated user, a permitted role, organization context, and a property ID contained in the server-derived property scope. The execute endpoint repeats property scoping and requires the `night_audit:execute` permission (with the existing General Cashier exception).

### Source of truth

| Concern | Authoritative source | Current dashboard use |
|---|---|---|
| Property/business date | `Property.businessDate`, `Property.timezone` | Status endpoint and audit service |
| Audit lifecycle | `NightAudit.status`, timestamps, `Property.auditStatus` | Status endpoint and persisted execute flow |
| Room/occupancy controls | `Room`, active `ReservationRoom`, checked-in reservations | `getOperationalReview`, occupancy reconciliation |
| Revenue and folio activity | `FolioItem` scoped by `folio.propertyId` and `businessDate` | Status aggregates and financial snapshot |
| Payments/refunds | `FolioItem`, `Refund`, payment/session services | Status aggregates and cash controls |
| Cash/POS controls | `PosSession`, `FrontdeskSession`, cash movements, POS orders | `getSystemIntegrity`, `getCashReconciliation`, `getFnbControl` |
| GL evidence | `JournalEntry`, `NightAuditClosePackage`, balance snapshots | `closeControl`, accounting summary |
| Historical KPIs | completed `NightAudit` and its financial snapshot | bounded trend query |
| Exceptions | sync conflicts, transaction exceptions, operational/financial checks | deterministic insights and queues |

### Financial and safety controls already present

- Room-charge posting uses reservation/date operation keys and is designed for recovery without duplicate folio items.
- Audit start is serialized with a property-row lock. Stale in-progress runs are explicitly recovered; completed runs cannot be rerun.
- The business date remains unchanged while posting and is advanced only in the final completion transaction. Audit logs, close packages, journal links, and balance proof are persisted.
- The server blocks unresolved financial sync conflicts, open sessions/orders, unverified cash transactions, unverified complimentary transactions, and pending check-in bypasses according to the existing property controls.
- Desktop offline behavior is guarded by the same property audit status and remains outside the web UI.

### Defects and redesign gaps found

1. The overview performs a second managers-flash request and presents its currency as hardcoded NGN, even though the property has `baseCurrency`.
2. The overview does not make the business date, property-local time, timezone, last refresh, and stale-data state prominent enough for a financial close workspace.
3. `AuditReadiness` uses a visual progress bar with fixed widths; it is not a deterministic readiness percentage and can imply a level of readiness that is not calculated from the server checks.
4. The overview’s older sections duplicate information already returned by the status endpoint, making the critical path harder to scan.
5. The current page has no explicit client-side refresh timestamp and no visible indication when the last successful read is old or when a refresh failed after data was displayed.

### End-to-end flow traced

- Reservations and `ReservationRoom` provide arrival/departure, room assignment, and checked-in occupancy state. `getOperationalReview` compares expected movement and active room assignments without changing either record.
- Room charges are created by `executeNightAudit` for eligible checked-in stays. The operation key is date/reservation scoped; corporate stays route to the existing city-ledger folio rules. Rate breakdown, tax, package, amenity, housekeeping, and lease/event billing are delegated to their existing services.
- POS and front-desk activity reaches the web database through their existing session/order/payment models and offline push routes. `getSystemIntegrity`, `getCashReconciliation`, and `getFnbControl` expose open sessions, orders, sync conflicts, unverified transactions, handovers, and outlet controls.
- Payments and refunds are distinct from recognized revenue. The status route reports folio activity, completed refunds, payment totals, cashier/POS variances, and open transaction exceptions independently.
- Posting closes with `postNightAuditJournal` and `buildNightAuditBalanceProof`; the run stores a `NightAuditFinancialSnapshot`, `NightAuditClosePackage`, journal links, account balance snapshots, and a content hash before the property date advances.
- The close is recorded in `AuditLog` and `HotelActivityEvent`. The property-row lock and unique `(propertyId, businessDate)` run constraint protect concurrent starts; posting failures set the run/property to `FAILED` and preserve recovery state.

### Security and desktop boundary

- Tenant isolation is enforced through `requireOrganizationContext` and server-derived `propertyIds`; the execute route additionally checks `night_audit:execute` and the existing role exception.
- Historical/report endpoints must continue to validate property scope server-side. Client-supplied property IDs are not trusted.
- Desktop hardware and offline SQLite behavior remain in `apps/desktop`, `apps/web/src/lib/desktop`, and sync push routes. The web dashboard only reads their server-confirmed state and must not force, discard, or rewrite pending events.

### Missing capabilities intentionally not invented

- The current status contract does not provide a persisted historical-date selector, per-record cashier/folio drawer payloads, budget/forecast comparisons, provider-bank settlement evidence, or a persisted insight assignment/resolution workflow.
- The current contract also does not expose a server-authenticated supervisor approval dialog payload. Existing acknowledgement and execute gates remain the only supported override path.
- These gaps require new server contracts and acceptance tests; the overview will link to existing reports/control pages rather than present decorative or simulated actions.

## Implementation plan

### Phase A — safe overview redesign (this pass)

- Keep the existing API and server-side calculations.
- Add an operational header that clearly separates property-local time from business date, shows audit state, base currency, and refresh freshness.
- Make status and close evidence the first-class overview controls.
- Use `baseCurrency` for every supported monetary display and remove presentation-only assumptions.
- Keep all existing drill-down links, wizard, resolution actions, and report routes intact.
- Make readiness rows explicitly evidence-based and include the existing open POS-order and accounting-exception controls so the UI cannot imply clearance while those records remain open.

### Phase B — follow-up hardening

- Add server-backed historical business-date read-only selection to the status endpoint and UI.
- Add typed detail endpoints/drawers for cashier, folio, reconciliation, and exception records rather than loading broad lists into the overview.
- Add deterministic calculation tests for occupancy/ADR/RevPAR, cash variance, business-date boundaries, and snapshot provenance.
- Add explicit stale/reconnect behavior if the existing realtime/cache layer is adopted.

### Phase C — verification

- Run web lint/typecheck and targeted night-audit tests.
- Review the diff for tenant/property scope and unchanged desktop sync paths.
- Do not apply a schema migration in this UI pass: the required night-audit close-package, snapshot, and acknowledgement models already exist and are additive migrations in the repository.

### Phase A result

- Delivered the overview hardening in `apps/web/src/app/night-audit/client.tsx`, `status-banner.tsx`, and `audit-readiness.tsx`.
- Status and manager-flash reads are explicitly uncached so the displayed freshness timestamp corresponds to a server read rather than a browser cache hit.
- The status banner now says `Server verified` rather than implying a realtime subscription.
- Readiness evidence now includes open POS orders and persisted accounting transaction exceptions, and a completed audit with warnings is labelled `Closed with findings`.
- Existing execute, resolution, report, acknowledgement, close-package, and offline-sync paths were not changed.

## Known limitations

- A complete cashier/folio/reconciliation drawer workflow and historical date selector require additional server-backed endpoints and should not be simulated in the overview.
- The local workspace does not provide production credentials or a safe live database verification context; no production close or migration is claimed here.
