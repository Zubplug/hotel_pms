# LodgeCore Master Implementation Plan
**Document Type:** Engineering Execution Guide  
**Last Updated:** August 2026  

---

## Overview
This document serves as the exact step-by-step execution plan to build all missing features identified in the `LodgeCore_Full_Functionality_Guide.md` and `LodgeCore_Feature_Catalog.md`. 

The execution is split into **4 Phases**. Each phase explicitly maps to the 13 sections of the Functionality Guide to ensure 100% feature coverage.

---

## 🟢 Phase 1: Procurement, Inventory & Point of Sale (POS)
*The critical Food & Beverage engine. This must be built first to establish the revenue flow outside of room sales.*

**Covers Functionality Guide Sections:**
*   Section 2 (Point of Sale & Restaurant Management)
*   Section 3 (Inventory, Stock & Procurement)

**1. Database Schema (`packages/db`)**
*   **Inventory:** `Supplier`, `Warehouse`, `StockItem`, `PurchaseOrder`, `GoodsReceivedNote`, `StockTransaction`.
*   **POS:** `PosOutlet`, `ProductCategory`, `PosProduct`, `RecipeIngredient`, `PosSession`, `PosOrder`, `PosPayment`.

**2. Web Frontend (`apps/web`)**
*   Build the Inventory management dashboard (PO creation, Stock adjustments).
*   Build the Menu engineering dashboard (Recipes, Costings, Pricing Tiers).

**3. Desktop App (`apps/desktop`)**
*   Extend the local SQLite database to store `LocalPosOrder` and `LocalPosProduct`.
*   Build the touch-optimized POS terminal UI for offline order taking.
*   Integrate ESC/POS USB receipt printing for kitchen dockets.
*   Update the `SyncEngine` to push offline POS orders to the cloud.

---

## 🟡 Phase 2: Native Finance & FIRS Compliance
*The hotel ERP. This phase relies on Phase 1 being completed so that POS revenue can flow into the General Ledger.*

**Covers Functionality Guide Sections:**
*   Section 6 (Native Finance & Hotel Accounting / ERP)
*   Section 6.6 (Tax & Fiscal Compliance)

**1. Database Schema (`packages/db`)**
*   `LedgerAccount` (Chart of Accounts), `JournalEntry`, `JournalEntryLine`.
*   `CityLedgerInvoice`, `SupplierInvoice`.
*   `TaxClass`, `WithholdingTaxLog`.

**2. Backend Logic (`apps/web/src/app/api`)**
*   Build the automated double-entry engine: Every folio payment or POS sale automatically creates balanced debit/credit journal entries.

**3. Web Frontend (`apps/web`)**
*   Build the Finance Controller dashboard.
*   Build automated FIRS VAT calculation and export reports.
*   Build the Trial Balance and Departmental P&L views.

---

## 🟠 Phase 3: Facility Operations (Security, Complaints, Fuel)
*The physical property management extensions.*

**Covers Functionality Guide Sections:**
*   Section 4.4 & 4.5 (Guest Complaints & Visitor Management)
*   Section 5.3 (Generator & Fuel Tracking)
*   Section 13 (Night Security & Safety)

**1. Database Schema (`packages/db`)**
*   `GuestComplaint` (with SLA tracking).
*   `VisitorLog`, `FuelDelivery`, `GeneratorRuntime`, `SecurityPatrolLog`, `IncidentReport`.

**2. Web Frontend (`apps/web`)**
*   Build dashboards for security incidents and fuel consumption tracking.

**3. Mobile App (Staff App - New Repo)**
*   Build the Security module: Scan QR codes at checkpoints to generate `SecurityPatrolLog` entries.
*   Build the Maintenance module: Snap photos of faults and update tickets from the field.

---

## 🔵 Phase 4: HR, Staff Management & CRM Extensions
*The final polish focusing on people and advanced revenue.*

**Covers Functionality Guide Sections:**
*   Section 7 (Guest Experience, Loyalty & Staff Biometrics)
*   Section 8 (Gift Vouchers & Corporate Portals)
*   Section 9 (Revenue Management & Rate Shopping)

**1. Database Schema (`packages/db`)**
*   `StaffShift`, `BiometricAttendanceLog`, `Timesheet`.
*   `LoyaltyTier`, `GiftVoucher`, `CorporateAccount`.

**2. Hardware Agent (`hardware-agent`)**
*   Integrate fingerprint scanner SDKs for biometric clock-in.

**3. Web Frontend (`apps/web`)**
*   Build the HR shift scheduling interface with conflict detection.
*   Build the Corporate Booking portal.

---

## Execution Rules
1. **Database First:** No frontend UI will be built until the Prisma schema for that module is fully designed, generated, and pushed.
2. **Offline Parity:** Any feature required for live physical operations (Front Desk, POS) must have its schema replicated in `apps/desktop` for offline capability.
3. **Audit Trails:** All financial and security models must include strict audit logging referencing the performing user.
