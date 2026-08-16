# LodgeCore PMS
## Complete Functionality Reference Guide

**Document Type: Internal & Client Technical Reference | Edition 2025**

> *This document provides a comprehensive, function-by-function breakdown of every capability inside the LodgeCore Hospitality Operating System. It is intended for hotel General Managers, IT Managers, Operations Directors, and Finance Controllers evaluating the platform in detail.*

---

## Table of Contents
1. Core PMS — Front Desk & Reservations
2. Point of Sale (POS) & Restaurant Management
3. Inventory, Stock & Procurement
4. Housekeeping Management
5. Maintenance & Engineering
6. Native Finance & Hotel Accounting (ERP)
7. Guest Experience & CRM
8. Direct Booking Engine
9. Revenue Management & Analytics
10. Hardware & IoT Integrations
11. Enterprise Platform & Security
12. System Administration
13. Night Security & Safety

---

## 1. Core PMS — Front Desk & Reservations

### 1.1 Reservation Management
The reservation module is the entry point for every guest interaction.

| Function | Description |
| :--- | :--- |
| **New Reservation** | Create a reservation by selecting dates, room type, rate plan, number of guests, and payment method. The system auto-assigns a unique confirmation number. |
| **Walk-In Check-In** | Instantly create a reservation and check-in a guest simultaneously for unannounced arrivals. |
| **Phone/Manual Reservation** | Create reservations by phone with full guest detail capture including ID number, company, and special requests. |
| **Group Reservation** | Block multiple rooms under a single group code. Assign a group master folio for consolidated billing. |
| **Corporate Account Reservation** | Link a reservation to a pre-configured corporate account with negotiated rates auto-applied. |
| **Reservation Modification** | Change dates, room type, rate plan, or guest count on any existing reservation with a full history log. |
| **Reservation Cancellation** | Cancel with configurable cancellation policies (full refund, partial penalty, no refund). Cancellation reason is logged. |
| **No-Show Processing** | Mark a guest as a no-show. The system posts the no-show charge automatically per policy and releases the room. |
| **Waitlist Management** | When a room type is unavailable, place a guest on a waitlist. The system notifies the front desk when a matching room becomes available. |
| **Reservation Search** | Search reservations by name, confirmation number, company, room number, date, or phone number. |
| **Reservation History** | View the complete modification and cancellation history for any booking. |

### 1.2 Interactive Tape Chart (Room Calendar)
| Function | Description |
| :--- | :--- |
| **Visual Room Calendar** | A drag-and-drop calendar showing all rooms and their status (occupied, vacant, blocked) across any date range. |
| **Drag to Move** | Drag a reservation bar to a different room or different dates without re-entering data. |
| **Drag to Extend** | Pull the end of a reservation bar to extend the guest's stay. |
| **Quick Reservation** | Click any vacant cell on the tape chart to open a new reservation for that room and date instantly. |
| **Colour-Coded Status** | Each reservation displays in a different colour by status: Confirmed (blue), Checked-In (green), Due Out (orange), Blocked (grey). |
| **Room Filter** | Filter the tape chart by room type, floor, or wing to focus on a specific section of the property. |
| **Occupancy Indicator** | The tape chart header shows today's occupancy percentage at a glance. |

### 1.3 Check-In & Check-Out
| Function | Description |
| :--- | :--- |
| **Guest Check-In** | Verify guest identity, confirm reservation details, collect payment or deposit, assign room, and issue keycard — all in one workflow. |
| **Early Check-In** | Allow early check-in with a configurable early check-in fee automatically posted to the folio. |
| **Room Assignment** | Manually assign a specific room or let the system auto-assign based on guest preferences and room availability. |
| **ID Scan & Capture** | Capture guest passport or national ID details during check-in for regulatory compliance. |
| **Guest Check-Out** | Review the final folio with the guest, post any outstanding charges, collect final payment, and close the account. |
| **Late Check-Out** | Allow late check-out with an automatic late check-out fee posted to the folio per your policy. |
| **Express Check-Out** | For guests who have pre-authorised payment, close their folio without requiring their physical presence at the desk. |
| **Split Check-Out** | Allow part of the group to check out early while others remain. The folio is split accordingly. |

### 1.4 Folio & Billing
| Function | Description |
| :--- | :--- |
| **Individual Guest Folio** | Each guest has a personal digital bill that accumulates all charges throughout the stay. |
| **Master Group Folio** | Consolidate all charges for a group, company, or event onto one master invoice. |
| **Split Folio** | Split a guest's charges between two folios — for example, room charges to the company and personal charges to the guest. |
| **Charge Posting** | Manually post any charge (room service, telephone, parking, spa) directly to any folio. |
| **Charge Transfer** | Move a charge from one folio to another (e.g., transfer a meal charge from the guest's folio to the company master). |
| **Void Charge** | Void an incorrectly posted charge with a mandatory manager authorisation and audit log entry. |
| **Discount Posting** | Post a discount or adjustment to a folio with reason code and authorisation. |
| **Package Posting** | Automatically post inclusive package items (e.g., daily breakfast, airport transfers) to the folio on a recurring basis. |
| **Receipt Printing** | Print or email a final receipt, interim receipt, or pro-forma invoice at any point during the stay. |
| **Invoice Generation** | Generate a formal tax invoice for corporate clients, formatted with company address and VAT details. |

### 1.5 Automated Night Audit
| Function | Description |
| :--- | :--- |
| **Room Charge Posting** | Automatically posts the nightly room rate to every checked-in guest's folio at end of day. |
| **Package Rate Posting** | Automatically posts all recurring package inclusions (e.g., breakfast) to the relevant folios. |
| **Folio Balance Report** | Generates a report of all open folio balances before the day is closed. |
| **POS Reconciliation** | Reconciles all POS transactions for the day against the folio postings and payment records. |
| **Payment Reconciliation** | Balances all recorded payments (cash, card, bank transfer, city ledger) against the day's total revenue. |
| **Arrivals & Departures** | Identifies all guests who were expected to arrive or depart but did not, flagging them for manager review. |
| **Business Date Rollover** | Formally closes the current business date and opens the next, ensuring no transactions can be back-dated without an override. |
| **Night Audit Report** | Produces a comprehensive end-of-day summary report for the General Manager and Accountant. |

### 1.6 Rate & Pricing Management
| Function | Description |
| :--- | :--- |
| **Rate Plan Management** | Create unlimited rate plans: Rack Rate, Corporate Rate, Government Rate, Weekend Rate, OTA Rate, Package Rate. |
| **Seasonal Pricing** | Set different rates for different date ranges (e.g., Christmas rates, rainy season rates). |
| **Per-Room-Type Pricing** | Set different rates for Standard, Deluxe, Suite, and Executive rooms independently. |
| **Promotional Rates** | Create time-limited promotional rates with early-bird or last-minute discounts. |
| **Discount by Segment** | Automatically apply negotiated discounts for corporate accounts or loyalty members. |
| **Min/Max Stay Restrictions** | Set minimum or maximum night requirements on specific rates or dates. |
| **Blackout Dates** | Block certain dates from applying specific rate plans (e.g., no discounted rates during peak holidays). |

---

## 2. Point of Sale (POS) & Restaurant Management

### 2.1 POS Terminal Operations
| Function | Description |
| :--- | :--- |
| **Cashier Login/Shift** | Each cashier opens their shift with a declared opening float. All transactions are tied to that cashier's session. |
| **Opening Float** | Record the starting cash amount in the till at the beginning of each shift. |
| **Table Management** | Visual table layout of the restaurant or bar. See at a glance which tables are occupied, their order status, and total bill value. |
| **New Order** | Select a table, assign a waiter, and begin taking the order from the menu. |
| **Item Modifiers** | Apply item-level customisations: "No Ice", "Extra Spicy", "Double Shot" — printed on the kitchen ticket. |
| **Course Management** | Separate orders by course (Starter, Main, Dessert) and fire each course to the kitchen at the appropriate time. |
| **Order Transfer** | Transfer a table's active order to another table or waiter without data loss. |
| **Bill Printing** | Print an interim bill for the guest to review before payment. |
| **Payment Processing** | Accept payment by cash, card, bank transfer, or posting to room. |
| **Split Bill** | Split a table's bill equally or by specific items between multiple guests. |
| **Multi-Tender Payment** | Accept part of the bill in cash and the remainder by card in a single transaction. |
| **Direct-to-Room Posting** | Post the entire restaurant or bar bill to a checked-in guest's room folio with a single button. |
| **Cashier Closing** | At shift end, the cashier declares their closing cash. The system produces a variance report showing any cash over or short. |

### 2.2 Menu & Recipe Management
| Function | Description |
| :--- | :--- |
| **Menu Categories** | Organise items into categories: Starters, Mains, Desserts, Cocktails, Soft Drinks, Wine, etc. |
| **Item Creation** | Add items with name, description, price, photo, printer routing, and tax class. |
| **Recipe Management** | Link each menu item to a recipe that specifies exactly which stock items are consumed and in what quantity when the item is sold. |
| **Combo & Bundle Items** | Create meal deals (e.g., "Burger + Fries + Drink") that post as a single item but deduct multiple stock components. |
| **Price Tiers** | Set different prices for the same item at different outlets (e.g., pool bar vs. main restaurant). |
| **Happy Hour Rules** | Automatically apply discount pricing during configured time windows. |
| **Item Availability** | Mark items as "86'd" (out of stock) from the POS screen so waiters cannot order them. |
| **QR Code Digital Menu** | Guests scan a QR code placed at their table or in their room to browse the full F&B menu on their smartphone. The digital menu is always up-to-date, eliminating the need for physical printed menus and reducing operational costs. |
| **Online Pre-Order (Room Service)** | Guests can pre-order room service directly through the Guest App before or during their stay. Pre-orders are routed automatically to the kitchen at the selected delivery time, improving kitchen planning and reducing wait times. |

### 2.3 Kitchen Display System (KDS)
| Function | Description |
| :--- | :--- |
| **Order Routing** | Food orders automatically route to the kitchen screen; drink orders to the bar screen. |
| **Bump System** | Kitchen staff "bump" (dismiss) orders when they are plated and ready for collection. |
| **Order Timer** | Each order displays a running timer. Orders exceeding the target preparation time are highlighted in red. |
| **Course Firing** | Fire the next course from the POS when the previous course has been served, preventing the kitchen from preparing all courses simultaneously. |
| **Kitchen Printing** | Print a physical kitchen docket alongside the KDS screen for kitchens that prefer paper backup. |

### 2.4 POS Controls & Security
| Function | Description |
| :--- | :--- |
| **Void Approval** | A waiter cannot void a posted item without a manager PIN code. All voids are logged. |
| **Refund Authorisation** | Refunds require manager-level authorisation and reason code. |
| **Discount Authorisation** | Discounts above a configurable threshold require manager override. |
| **Cashier Accountability** | Every transaction is tied to the cashier who processed it. |
| **End-of-Day POS Report** | Outlet-level summary of all transactions, voids, discounts, and payment types for the day. |

---

## 3. Inventory, Stock & Procurement

### 3.1 Inventory Management
| Function | Description |
| :--- | :--- |
| **Product Catalogue** | Central catalogue of all stock items with unit of measure, category, supplier, and par levels. |
| **Real-Time Stock Levels** | View current stock quantities in every warehouse and outlet store in real time. |
| **Stock Movement Log** | A full history of every stock movement: received, consumed, transferred, adjusted, wasted. |
| **Low Stock Alerts** | Automatic email or in-app alert when any item falls below its configured minimum par level. |
| **Expiry Date Tracking** | Track best-before or expiry dates on perishable stock items. |
| **Stock Valuation** | View the monetary value of all stock on hand at any moment using FIFO or weighted-average cost. |

### 3.2 Procurement & Purchasing
| Function | Description |
| :--- | :--- |
| **Supplier Management** | Maintain a database of all suppliers with contact details, payment terms, and lead times. |
| **Purchase Orders (PO)** | Create and send Purchase Orders to suppliers directly from the system. |
| **PO Approval Workflow** | Purchase Orders above a configured value require management approval before being sent. |
| **Goods Received Note (GRN)** | When goods arrive, record the GRN against the original PO. Stock levels update automatically. |
| **Purchase vs. Received Variance** | The system highlights any differences between what was ordered on the PO and what was actually received. |
| **Supplier Invoice Matching** | Match a supplier invoice against the GRN to authorise payment in the Accounts Payable module. |

### 3.3 Stock Control
| Function | Description |
| :--- | :--- |
| **Multi-Warehouse Management** | Manage separate stock locations: Main Store, Kitchen, Bar, Housekeeping Store, Engineering Store. |
| **Stock Transfers** | Formally transfer stock between warehouses with a digital transfer document and authorisation. |
| **Internal Requisitions** | Departments submit digital requisition forms to the main store. Requests are approved and issued formally. |
| **POS Auto-Deduction** | Every sale at the POS automatically deducts the correct recipe components from the bar or kitchen stock. |
| **Stock Take / Physical Count** | Record a physical stock count and compare it against the system balance. Variances are posted as adjustments with reason codes. |
| **Wastage Recording** | Record spoiled or wasted stock with a reason code for management reporting. |

---

## 4. Housekeeping Management

### 4.1 Room Status Management
| Function | Description |
| :--- | :--- |
| **Live Room Status Board** | A real-time board showing every room's status: Vacant Clean, Vacant Dirty, Occupied Clean, Occupied Dirty, Out of Order, Out of Service. |
| **Automatic Status Update** | When a guest checks out, the room automatically changes to Vacant Dirty. When a room is assigned and the guest checks in, it changes to Occupied. |
| **Manual Status Override** | Supervisors can manually update any room's status with a reason. All changes are logged. |
| **Out of Order (OOO)** | Block a room from sale due to maintenance. The room is removed from the available inventory entirely until unblocked. |
| **Out of Service (OOS)** | Mark a room as temporarily out of service (e.g., deep cleaning) without removing it from inventory. |

### 4.2 Task Assignment & Scheduling
| Function | Description |
| :--- | :--- |
| **Automatic Task Generation** | At the start of each day, the system automatically generates Departure Clean tasks for all check-outs and Stayover Clean tasks for occupied rooms. |
| **Manual Task Assignment** | The housekeeping supervisor can manually assign specific rooms to specific attendants. |
| **VIP Room Priority** | VIP guest rooms are automatically flagged and prioritised at the top of the attendant's queue. |
| **Mobile Task Queue** | Room attendants view their assigned room queue on their mobile device and check off tasks as they complete them. |
| **Inspection Workflow** | After a room is marked Clean by the attendant, a supervisor must mark it Inspected before it becomes available for sale at the front desk. |
| **Turndown Service** | Schedule and track evening turndown service tasks separately from the main cleaning schedule. |

### 4.3 Housekeeping Controls
| Function | Description |
| :--- | :--- |
| **Linen Tracking** | Record linen issued to rooms and returns to the laundry for loss control. |
| **Minibar Check** | Log items consumed from the minibar during room cleaning. Charges are automatically posted to the guest's folio. |
| **Lost & Found** | Log items found in rooms with a photo, date, room number, and staff member who found it. |
| **Cleaning Time Tracking** | Track how long each attendant spends cleaning each room for productivity analysis. |
| **Housekeeping Productivity Report** | Supervisor report showing rooms cleaned per attendant, average cleaning time, and inspection pass rate. |

### 4.4 Guest Complaint Resolution
| Function | Description |
| :--- | :--- |
| **Complaint Logging** | Any staff member or front desk agent can log a guest complaint directly in LodgeCore, capturing the guest name, room number, complaint category, description, and timestamp. |
| **Assignment & Escalation** | Complaints are assigned to the responsible department or staff member. If unresolved within a configured SLA timeframe, the system automatically escalates to the department head or General Manager. |
| **SLA Timers** | Each complaint type carries a configurable SLA (e.g., noise complaint — resolved within 15 minutes; maintenance fault — resolved within 2 hours). The timer runs visibly on the front desk screen. |
| **Resolution & Closure** | The assigned staff member logs the corrective action taken. The complaint is marked closed only after a supervisor confirms resolution. |
| **Recurring Complaint Reports** | Management reports identify repeat complaint types and problematic rooms or departments over any period, enabling targeted operational improvements. |

### 4.5 Visitor Management System
| Function | Description |
| :--- | :--- |
| **Visitor Log Entry** | Security or reception staff record all non-guest visitors entering the hotel: full name, host (guest or staff member), purpose of visit, and contact number. |
| **Time In / Time Out** | The system records the exact time a visitor enters and exits the property. Open visits (no time-out recorded) are flagged for the security supervisor. |
| **Host Notification** | The system can notify the host (in-house guest or staff member) via the app when their visitor has been logged at the gate. |
| **Daily Visitor Log Report** | The security desk can generate a full daily report of all visitors, filterable by date, time, host, or purpose. Useful for incident investigation and regulatory compliance. |
| **Visitor Badge Printing** | Optional visitor badge printing at the security desk for easy visual identification on property. |

---

## 5. Maintenance & Engineering

### 5.1 Maintenance Ticketing
| Function | Description |
| :--- | :--- |
| **Fault Logging** | Any staff member (housekeeping, front desk, guest) can log a maintenance fault from their mobile device. |
| **Fault Categories** | Categorise faults: Electrical, Plumbing, HVAC, Furniture, General, Emergency. |
| **Priority Levels** | Set priority: Low, Medium, High, Emergency. Emergency tickets notify the maintenance team immediately. |
| **Automatic OOO Block** | When a fault is logged for a guest room, the system automatically places the room Out of Order at the front desk. |
| **Technician Assignment** | Maintenance manager assigns tickets to specific technicians. |
| **Status Tracking** | Track ticket status: Open, Assigned, In Progress, Completed, Verified. |
| **Resolution Logging** | Technician logs the resolution action taken, time spent, and parts used. |
| **OOO Release** | The OOO block is only released after a supervisor verifies the repair is complete and the room has been re-inspected by housekeeping. |

### 5.2 Preventive Maintenance
| Function | Description |
| :--- | :--- |
| **Scheduled Maintenance** | Create recurring maintenance tasks on a daily, weekly, monthly, or annual schedule (e.g., "Service Air Conditioner — Room 101 — Every 3 months"). |
| **Asset Register** | Maintain a register of all hotel equipment (AC units, generators, lifts, pool pumps) with purchase date, warranty, and service history. |
| **Service History Log** | Full history of all maintenance actions performed on each asset. |
| **Parts & Materials Tracking** | Log spare parts and materials used in each repair, deducting from the Engineering Store inventory. |

### 5.3 Generator & Fuel Tracking
| Function | Description |
| :--- | :--- |
| **Diesel Delivery Logging** | Record every diesel delivery: date, quantity delivered (litres), supplier, cost, and the staff member who received it. Deliveries are matched against the fuel tank register. |
| **Daily Generator Runtime** | Engineering staff log the daily start and stop times for each generator set. The system automatically calculates total runtime hours per day and cumulative hours per period. |
| **Fuel Consumption Calculation** | The system calculates the fuel consumption rate (litres per hour) for each generator based on runtime logs and delivery records, flagging abnormal consumption that may indicate theft or mechanical inefficiency. |
| **Low Fuel Threshold Alert** | Management configures a minimum fuel level threshold. When estimated fuel falls below this level, the system sends an automatic alert to the Engineering Manager and General Manager via email and in-app notification. |
| **Fuel Inventory Report** | Generate periodic reports showing opening fuel balance, deliveries received, estimated consumption, and closing balance — creating an accountable fuel register for audit purposes. |

---

## 6. Native Finance & Hotel Accounting (ERP)

### 6.1 Chart of Accounts
| Function | Description |
| :--- | :--- |
| **Chart of Accounts Setup** | Configure the hotel's complete chart of accounts with account codes, categories (Revenue, Expense, Asset, Liability, Equity), and descriptions. |
| **Department Mapping** | Map revenue and expense accounts to specific departments (Rooms, F&B, Laundry, Events, Other). |
| **Account Hierarchy** | Create parent and child account relationships for organised financial statements. |

### 6.2 General Ledger
| Function | Description |
| :--- | :--- |
| **Automated Journal Entries** | All PMS transactions (room revenue, POS sales, payments) automatically generate the correct double-entry journal entries. |
| **Manual Journal Entries** | Accountants can post manual adjusting or correcting entries with full audit trails. |
| **Recurring Journal Entries** | Set up recurring monthly entries (e.g., depreciation, prepaid insurance) that post automatically. |
| **Period Management** | Open and close accounting periods. Closed periods cannot be altered without an override from an authorised user. |
| **Trial Balance** | Generate a real-time trial balance showing debit and credit totals for every account. |
| **Profit & Loss Statement** | Full income statement broken down by department, showing Revenue, Cost of Sales, Gross Profit, Operating Expenses, and Net Profit. |
| **Balance Sheet** | Snapshot of the hotel's financial position showing Assets, Liabilities, and Equity at any date. |
| **Departmental P&L** | Separate P&L statements for Rooms, F&B, Laundry, and Events so management knows exactly which department is profitable. |
| **Cash Flow Report** | Cash movement report showing inflows and outflows for any period. |

### 6.3 Accounts Receivable (City Ledger)
| Function | Description |
| :--- | :--- |
| **City Ledger Account Setup** | Create city ledger accounts for corporate clients, travel agents, airlines, and embassies. |
| **Invoice Generation** | Generate formal tax invoices for all charges transferred to the city ledger. |
| **Payment Allocation** | Record payments received from corporate clients against their outstanding invoices. |
| **Aging Report** | View all outstanding debts by age: Current, 30 Days, 60 Days, 90 Days, Over 90 Days. |
| **Statement of Account** | Generate and email a statement of account to any corporate client. |
| **Credit Limit Management** | Set credit limits for each city ledger account. The system warns when a client approaches or exceeds their limit. |

### 6.4 Accounts Payable
| Function | Description |
| :--- | :--- |
| **Supplier Invoice Entry** | Record invoices received from all hotel suppliers. |
| **Invoice-GRN Matching** | Match supplier invoices against Goods Received Notes from the inventory module before approving payment. |
| **Payment Scheduling** | Schedule supplier payments by due date and available cash balance. |
| **Payment Run** | Generate a payment run report for the Finance Manager to authorise before bank transfers are made. |
| **Supplier Aging Report** | View all amounts owed to suppliers by age to manage cash flow. |

### 6.5 Bank & Cash Reconciliation
| Function | Description |
| :--- | :--- |
| **Bank Account Management** | Maintain multiple bank accounts (Operating Account, Tax Account, Petty Cash). |
| **Bank Statement Import** | Import bank statements and match transactions against LodgeCore payment records. |
| **Reconciliation Report** | Identify unmatched transactions, deposits in transit, and outstanding cheques. |
| **Cashier Reconciliation** | Daily cashier-level reconciliation of physical cash collected versus system records. |
| **Foreign Currency Reconciliation** | Reconcile transactions made in foreign currencies using the daily exchange rates recorded in the system. |

### 6.6 Tax & Fiscal Compliance
| Function | Description |
| :--- | :--- |
| **FIRS VAT Reporting** | Automatically generate VAT summary reports formatted for submission to the Federal Inland Revenue Service (FIRS). Reports break down VAT-eligible revenue by stream — room revenue, F&B revenue, and service charges — making returns straightforward and audit-ready. |
| **Tax Class Configuration** | Configure different tax rules for different revenue streams. Each revenue category (room, F&B, laundry, events) can be independently set to Standard-Rated (7.5% VAT), Zero-Rated, or Exempt, ensuring compliant invoicing across all service lines. |
| **Withholding Tax (WHT) Tracking** | Record and track WHT deductions applied to supplier payments. The system maintains a WHT register showing the supplier, invoice amount, WHT rate, amount deducted, and remittance status, supporting correct statutory reporting to FIRS. |
| **Tax Liability Report** | Generate a periodic tax liability summary covering VAT output, VAT input (recoverable), net VAT payable, and WHT deducted, giving the Finance Controller a complete picture of the hotel's tax position at any time. |

---

## 7. Guest Experience & CRM

### 7.1 Guest Profiles
| Function | Description |
| :--- | :--- |
| **Unified Guest Record** | A single, permanent record for every guest that persists across all their stays. |
| **Stay History** | Complete history of every check-in, check-out, room used, rate paid, and folio balance. |
| **Lifetime Value Tracking** | Running total of all revenue generated by a guest across all their stays. |
| **Preference Management** | Record preferences: room floor, pillow type, dietary needs, newspaper, preferred waiter. |
| **Special Occasions** | Log birthdays, anniversaries, and other dates for proactive service. |
| **Communication Log** | Record all interactions with a guest (phone calls, emails, complaints, special requests). |
| **VIP Flag** | Flag a guest as VIP to trigger automatic alerts and priority service at check-in. |
| **Do Not Disturb Flag** | Record guests who prefer minimal contact from housekeeping or the front desk. |
| **Blacklist Flag** | Flag a guest as blacklisted with a reason code. The system warns any staff who attempt to check them in. |

### 7.2 Automated Guest Communications
| Function | Description |
| :--- | :--- |
| **Booking Confirmation Email** | Automatically sent to the guest immediately after a reservation is created. |
| **Pre-Arrival Email** | Sent a configurable number of days before arrival with hotel information and upsell offers. |
| **Post-Checkout Thank You** | Sent after check-out with a satisfaction survey link and loyalty programme invitation. |
| **SMS Notifications** | Optional SMS messages at key guest journey milestones (booking, arrival, departure). |

### 7.3 Loyalty Programme
| Function | Description |
| :--- | :--- |
| **Tier Configuration** | Define loyalty tiers (e.g., Member, Silver, Gold, Platinum) with point thresholds for each tier. |
| **Points Earning** | Guests earn points for every Naira spent on rooms, F&B, spa, and other services. |
| **Points Redemption** | Guests redeem points for discounts, complimentary nights, or F&B credits. |
| **Automatic Tier Upgrade** | The system automatically upgrades a guest's tier when they cross the configured spending threshold. |
| **Tier Benefits** | Configure automatic benefits per tier: late check-out, room upgrade, complimentary breakfast, discount percentage. |

### 7.4 Staff Management

#### Biometric Attendance
| Function | Description |
| :--- | :--- |
| **Fingerprint / PIN Clock-In & Out** | All staff clock in and clock out using a fingerprint scanner or PIN at designated terminals. The system prevents buddy-punching and ensures every attendance record is attributable to the correct individual. |
| **Automated Timesheet Generation** | At the end of each pay period, LodgeCore generates payroll-ready timesheets for every staff member showing total hours worked, overtime hours, late arrivals, early departures, and absent days. |
| **Late Arrival & Absenteeism Tracking** | The system automatically flags late arrivals and unexplained absences in real time. Department heads receive alerts when a staff member has not clocked in within a configurable window after their shift start. |
| **Attendance Reports** | HR and department heads can generate attendance reports by individual, department, or date range for payroll processing, disciplinary review, or regulatory compliance. |

#### Staff Scheduling
| Function | Description |
| :--- | :--- |
| **Weekly Shift Roster** | Create and publish weekly shift rosters for all departments: Front Desk, Housekeeping, F&B, Maintenance, Security. Each shift specifies the staff member, role, date, start time, and end time. |
| **Conflict Detection** | The system automatically detects scheduling conflicts — for example, the same staff member assigned to two overlapping shifts — and notifies the scheduling manager before the roster is published. |
| **Roster Publishing** | Once approved, the roster is published and staff can view their upcoming schedule on the LodgeCore Staff App. |
| **Shift Swap Requests** | Staff can submit shift swap requests through the app. Swaps require manager approval before they take effect. |

#### Staff Performance Dashboard
| Function | Description |
| :--- | :--- |
| **Housekeeping KPIs** | Track rooms cleaned per shift per attendant, average cleaning time per room type, and inspection pass/fail rate. Supervisors can benchmark performance across the team. |
| **POS & F&B KPIs** | Track total transactions processed per waiter, average transaction value, voids and discounts per cashier, and upsell conversion. |
| **Maintenance KPIs** | Track maintenance tickets assigned, tickets resolved, average resolution time, and SLA compliance rate per technician. |
| **Department Leaderboard** | An at-a-glance dashboard ranking staff performance within each department, useful for recognition programmes and performance reviews. |

---

## 8. Direct Booking Engine

| Function | Description |
| :--- | :--- |
| **Public Booking Website** | A professional, mobile-responsive website branded with your hotel's name, logo, and photography. |
| **Real-Time Availability** | The booking engine reads live availability directly from the PMS. Guests can only book rooms that are genuinely available. |
| **Multi-Room Booking** | Guests can book multiple rooms in a single transaction. |
| **Rate Plan Display** | Show multiple rate plans to the guest (e.g., Flexible Rate, Non-Refundable Rate) so they can choose their preference. |
| **Room Package Display** | Display add-on packages (e.g., Romantic Package, Airport Transfer) that guests can include with their booking. |
| **Promo Code Entry** | Guests enter a promotional code at checkout to receive a configured discount. |
| **Secure Online Payment** | Guests pay a deposit or full amount securely via integrated payment gateway (Paystack, Flutterwave, Stripe). |
| **Instant PMS Sync** | On confirmation, the booking instantly creates a reservation in the PMS and sends a confirmation email to the guest. |
| **Cancellation Policy Display** | The cancellation policy is displayed clearly before payment so guests cannot dispute it. |
| **Booking Modification** | Guests can modify or cancel their booking online within the policy parameters. |
| **Gift Voucher Sales** | Sell hotel gift vouchers directly through the booking engine. Vouchers are issued with a unique code. The recipient enters the voucher code at checkout on a future booking or at the front desk to redeem it against their room folio or F&B charges. |
| **Corporate Booking Portal** | A dedicated, password-protected booking link for corporate clients. When a corporate user logs in, their pre-negotiated room rates are automatically applied — no promo code needed. Corporate bookings flow directly into the PMS and can be billed to the company's city ledger account. |

---

## 9. Revenue Management & Analytics

| Function | Description |
| :--- | :--- |
| **Daily Flash Report** | A concise morning report showing yesterday's occupancy, revenue, ADR (Average Daily Rate), and RevPAR. |
| **Occupancy Dashboard** | Real-time visual showing current occupancy, rooms available, rooms out of order, and housekeeping status. |
| **Revenue by Segment** | Break down revenue by booking source: direct, corporate, OTA, walk-in. |
| **Pickup Report** | Shows how many reservations have been made in the last 24 hours and for which future dates. |
| **Pace Report** | Compares current bookings for a future date against the same point in time last year. |
| **ADR & RevPAR Reporting** | Track Average Daily Rate and Revenue Per Available Room over any date range. |
| **Forecast Report** | Project expected occupancy and revenue for the next 30, 60, or 90 days based on current reservations on the books. |
| **Channel Performance** | Compare revenue, ADR, and booking volume by channel (OTA, direct, corporate, etc.). |
| **Rate Shopping** | Monitor competitor hotel rates on Booking.com and Expedia directly from the LodgeCore dashboard. The rate shopping panel displays your competitors' live published rates alongside your own, enabling your revenue manager to make informed, timely pricing decisions without switching between external tools. |
| **Long-Stay Report** | Automatically identifies guests with confirmed stays of 7 or more nights. The report enables the Revenue Manager and Front Office team to launch targeted upsell campaigns for long-stay guests — for example, offering complimentary laundry after 5 nights, a room upgrade, or a discounted meal package to enhance retention and satisfaction. |

---

## 10. Hardware & IoT Integrations

| Function | Description |
| :--- | :--- |
| **RFID Keycard Encoding** | Encode guest keycards directly from the check-in screen. Card is automatically programmed with room number and check-out date/time. |
| **Smart Lock Integration** | Compatible with leading smart lock systems (e.g., Deluns). Check-out automatically deactivates the guest's keycard. |
| **POS Hardware** | Support for receipt printers, cash drawers, barcode scanners, and touch-screen POS terminals. |
| **Kitchen Printers** | Route order dockets to designated printers in the kitchen, bar, or pastry section. |
| **ID Scanner** | Integrate document scanners for instant ID capture during check-in. |
| **Smart Thermostat** | Monitor and control room energy consumption through connected thermostat devices. |

---

## 11. Enterprise Platform & Security

### 11.1 Role-Based Access Control
| Function | Description |
| :--- | :--- |
| **User Role Management** | Create roles (Receptionist, Cashier, Waiter, Housekeeper, Accountant, Manager, GM, Administrator) with precise permissions. |
| **Module-Level Permissions** | Control exactly which modules and menu items each role can access. |
| **Action-Level Permissions** | Control specific actions: a Receptionist may view a folio but not void charges; only a Manager can void. |
| **Property-Level Isolation** | In a multi-property group, staff at Property A cannot see data from Property B unless explicitly granted cross-property access. |

### 11.2 Audit & Compliance
| Function | Description |
| :--- | :--- |
| **Immutable Audit Log** | Every transaction, edit, deletion, and login is permanently recorded with a timestamp and user ID. The log cannot be altered. |
| **Financial Audit Trail** | Every financial posting has a clear chain of entries showing the original transaction, any reversals, and who authorised them. |
| **Login History** | View all login attempts (successful and failed) for any user account. |
| **Session Management** | Automatically log out inactive sessions after a configurable timeout period. |

### 11.3 Multi-Property Management
| Function | Description |
| :--- | :--- |
| **Group Dashboard** | A single dashboard for the CEO or Group GM to view occupancy, revenue, and operational status across all properties simultaneously. |
| **Centralised Rate Management** | Set and update rates for all properties from a single admin console. |
| **Cross-Property Reporting** | Generate consolidated financial and operational reports across the entire portfolio. |
| **Property-Specific Configuration** | Each property retains its own chart of accounts, rate plans, room types, and staff roster. |

---

## 12. System Administration

| Function | Description |
| :--- | :--- |
| **Property Setup** | Configure hotel name, address, logo, tax registration numbers, and base currency. |
| **Room Type Configuration** | Define room types with descriptions, capacity, photos, and default rates. |
| **Room Configuration** | Map individual rooms to types, floors, and wings. Set attributes: smoking/non-smoking, connecting rooms, accessible rooms. |
| **Tax Configuration** | Configure VAT rates, tourism levies, and service charges per revenue category for compliant invoicing. |
| **Payment Method Setup** | Configure accepted payment methods: Cash, POS/Card, Bank Transfer, City Ledger, Complimentary. |
| **Reason Codes** | Configure reason codes for voids, discounts, adjustments, cancellations, and no-shows for management reporting. |
| **System Backup** | Automated daily backups to the cloud. On-Premise installations support local server backup configuration. |
| **Software Updates** | Cloud subscribers receive all software updates automatically with no downtime. On-Premise clients receive updates via the AMC. |
| **Data Export** | Export any report or data set to Excel, PDF, or CSV for external analysis. |

---

## 13. Night Security & Safety

### 13.1 Night Security Patrol Log
| Function | Description |
| :--- | :--- |
| **QR Code Patrol Points** | Unique QR codes are fixed at designated patrol checkpoints around the property (e.g., Main Gate, Car Park, Generator House, Pool Area, Back Entrance). Security staff scan each QR code during their rounds using the LodgeCore Security App. |
| **Automated Patrol Logging** | Each scan is automatically timestamped and attributed to the security officer who scanned it. The system builds a complete chronological patrol log without any manual data entry. |
| **Missed Patrol Alerts** | If a patrol checkpoint is not scanned within the expected interval, the system alerts the Security Supervisor or Night Manager, enabling immediate follow-up. |
| **Patrol Summary Reports** | Generate daily or weekly patrol summary reports showing the number of rounds completed, checkpoints visited, any missed checkpoints, and the time of each scan — providing full accountability for security operations. |

### 13.2 Incident Report Management
| Function | Description |
| :--- | :--- |
| **Incident Logging** | Security staff or management log security incidents directly in LodgeCore: incident type (theft, disturbance, damage, unauthorised access, fire), date, time, location, persons involved, and a detailed description. |
| **Photo Attachments** | Upload photos or documentary evidence directly to the incident report for a complete, evidence-backed record. |
| **Resolution Tracking** | Each incident is tracked through a defined workflow: Reported → Under Investigation → Action Taken → Resolved/Closed. The current status is visible to all authorised staff. |
| **Incident History Report** | Generate incident history reports by type, location, or date range. Recurring incident patterns can be identified for management action or insurance reporting. |
| **Notification to Management** | High-severity incidents (e.g., theft, fire, medical emergency) trigger immediate notifications to the GM and relevant department heads. |

### 13.3 Emergency Contact Directory
| Function | Description |
| :--- | :--- |
| **Centralised Contact List** | Maintain a configurable directory of emergency contacts directly within LodgeCore: Police, Fire Service, Nearest Hospital, Ambulance, PHCN/Electricity Provider, Gas Supplier, Water Board, and any other critical contacts. |
| **Accessible from Any Terminal** | The emergency contact directory is accessible from any LodgeCore terminal on the property — front desk, security desk, restaurant POS, or management workstation — so the right contact is always one click away during a crisis. |
| **Contact Categories** | Contacts are organised by category (Emergency Services, Utilities, Medical, Insurance, Key Suppliers) for rapid navigation under pressure. |
| **Update & Maintain** | The directory is updated by the System Administrator. All changes are logged. Stale contacts (not reviewed in over 90 days) are flagged for verification. |

---

*LodgeCore Hospitality Technology | www.getlodgecore.com | sales@getlodgecore.com | +234 (0) 708 509 4454*

*This document is confidential and intended solely for the named recipient. All features described are subject to the edition and modules subscribed. Roadmap features are subject to development timelines.*
