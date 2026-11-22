# Bazaar-Guru: End-to-End Test Coverage Matrix

This document outlines the test suites, verification vectors, and coverage details across all modules of Bazaar-Guru.

---

## 1. Test Architecture & Runners

- **Test Framework:** Node.js native test runner (`node:test`, `node:assert`)
- **TypeScript Runner:** `tsx`
- **Execution Script:** `npm run test` (Runs all `tests/**/*.test.ts`), `npm run test:gst`
- **Total Test Suites:** 7 files
- **Total Assertions / Subtests:** 135 tests
- **Execution Time:** ~2.2 seconds

---

## 2. Test Coverage Matrix

### Module 1: Double-Entry Accounting Engine (`tests/accounting_engine.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 | Journal entry validation | Unit / Logic | PASS |
| 1.2 | Unbalanced entry rejection ($Dr \neq Cr$) | Invariant Check | PASS |
| 1.3 | Inactive account posting rejection | Validation | PASS |
| 2.1 | Credit Sales Invoice double-entry generation | Integration | PASS |
| 2.2 | Cash Sales with discount double-entry generation | Integration | PASS |
| 3.1 | Sales Return (Credit Note) journal reversal | Invariant Check | PASS |
| 4.1 | Purchase Bill journal generation (ITC + AP) | Integration | PASS |
| 4.2 | Debit Note journal generation | Integration | PASS |
| 5.1 | Payment In voucher journal (Bank Dr, AR Cr) | Integration | PASS |
| 5.2 | Payment Out voucher journal (AP Dr, Bank Cr) | Integration | PASS |
| 6.1 | Operating Expense journal generation | Integration | PASS |
| 7.1 | FIFO Payment Allocation across invoices | Algorithm | PASS |
| 8.1 | Trial Balance invariant verification ($\Delta = 0$) | Release Gate | PASS |
| 9.1 | Financial Year locking & closed period protection | Security / Rule | PASS |
| 10.1 | Historical transaction migration idempotency | Migration | PASS |

---

### Module 2: Banking, Receipts & Cashbook (`tests/phase3_banking.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 - 1.4 | Customer receipts, FIFO allocation, advance receipts, cancellation | Financial E2E | PASS (4/4) |
| 2.1 - 2.3 | Supplier bill payments, direct expenses, loan repayments | Financial E2E | PASS (3/3) |
| 3.1 - 3.4 | Masking bank numbers, overdraft limits, self-transfer rejection, Contra | Security & Logic | PASS (4/4) |
| 4.1 - 4.2 | Cheque lifecycle, bounced cheque reversal & bank charge posting | Invariant Check | PASS (2/2) |
| 5.1 - 5.2 | CSV bank statement parser, duplicate line detection, BRS verification | Integration | PASS (2/2) |
| 6.1 | Cashbook & Bankbook registers with running balance | Reporting | PASS (1/1) |
| 7.1 - 7.2 | Overdue ageing buckets (0-30, 31-60, 61-90, 90+), WhatsApp reminder template | Business Logic | PASS (2/2) |
| 8.1 | Banking voucher double-entry invariants | Release Gate | PASS (1/1) |

---

### Module 3: Inventory Valuation & Reports (`tests/phase4_inventory_reports.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 - 1.2 | Physical tracking exclusions (goods vs services/non-stock) | Catalog Rule | PASS (2/2) |
| 2.1 - 2.4 | Stock reconstruction from ledger, stock summary, low-stock detection | Inventory E2E | PASS (4/4) |
| 3.1 - 3.4 | Weighted Average Cost (WAC), FIFO layers, negative stock policy | Valuation Logic | PASS (4/4) |
| 4.1 - 4.2 | COGS double-entry journals (Dr 5010, Cr 1400) and return reversals | Accounting Link | PASS (2/2) |
| 5.1 - 5.2 | Multi-warehouse transfers, stock availability checks | Warehouse Logic | PASS (2/2) |
| 6.1 - 6.2 | Batch tracking, near-expiry alerts, FIFO batch deduction | Batch Logic | PASS (2/2) |
| 7.1 | Stock adjustment vouchers (damage, write-off) | Stock Ledger | PASS (1/1) |
| 8.1 - 8.7 | Financial Reports: Trial Balance, P&L, Balance Sheet, Cash Flow, Daybook, GL, Item Margins | Core Reporting | PASS (7/7) |

---

### Module 4: Backup & Cryptographic Storage (`tests/phase5_offline_sync_backup.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 - 1.5 | Dependency sorting, idempotency keys, remapping temporary IDs | Sync Logic | PASS (5/5) |
| 2.1 - 2.2 | Conflict resolution (server-wins, manual resolution) | Sync Rules | PASS (2/2) |
| 3.1 - 3.2 | Reproducible SHA-256 calculation and tamper detection | Cryptography | PASS (2/2) |
| 4.1 - 4.4 | Authentic v3.0 backup validation, corrupted backup rejection, v2.0 upgrade | Storage Integrity | PASS (4/4) |
| 5.1 | Environment and device detection | System | PASS (1/1) |

---

### Module 5: Business Workspace & Workflows (`tests/phase6_business_workspace.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 - 1.5 | Product pricing hierarchy (MSP <= Price <= MRP), composite costs, HSN lookup | Catalog Rules | PASS (5/5) |
| 2.1 - 2.2 | Bulk CSV product import with duplicate SKU detection, CSV export | Data I/O | PASS (2/2) |
| 3.1 - 3.4 | GSTIN & PAN validation, PIN code check, duplicate party detection, credit limit | Tax & Compliance | PASS (4/4) |
| 4.1 - 4.4 | Quotation -> Sales Order -> Delivery Challan -> Invoice workflow conversions | Workflow E2E | PASS (4/4) |
| 5.1 | Purchase Order -> Goods Receipt Note (GRN) workflow conversion | Workflow E2E | PASS (1/1) |
| 6.1 - 6.2 | Sales Return (Credit Note) and Purchase Return (Debit Note) processing | Returns Logic | PASS (2/2) |
| 7.1 - 7.3 | Consecutive document numbering, Indian Financial Year calculation | Numbering | PASS (3/3) |
| 8.1 - 8.3 | Role-Based Access Control (Owner, Staff, Accountant permissions) | Authorization | PASS (3/3) |
| 9.1 | System Notification Center (low stock and overdue AR triggers) | Notifications | PASS (1/1) |
| 10.1 - 10.2 | Document storage, 5MB file size limit enforcement | Storage | PASS (2/2) |
| 11.1 | Multi-entity global search across invoices, parties, items | Search | PASS (1/1) |
| 12.1 | Immutable audit trail logging and filtering | Audit | PASS (1/1) |

---

### Module 6: End-to-End Production Readiness & Security (`tests/e2e_production_readiness.test.ts`)
| Test Case | Description | Verification Type | Status |
|---|---|:---:|:---:|
| 1.1 - 1.2 | Public landing page gate, unauthenticated access blocking | Routing Gate | PASS (2/2) |
| 2.1 - 2.3 | Email regex, password length enforcement, memory store purge on Sign Out | Auth Security | PASS (3/3) |
| 3.1 - 3.2 | Strict tenant isolation, cross-tenant data modification rejection | Multi-Tenancy | PASS (2/2) |
| 4.1 - 4.4 | Intrastate, Interstate, Tax-Inclusive reverse, Round-off legal bounds | GST Engine | PASS (4/4) |
| 5.1 - 5.3 | WAC calculation, FIFO layers consumption, stock balance reconstruction | Inventory E2E | PASS (3/3) |
| 6.1 - 6.3 | Double-Entry Invariants, Trial Balance $\Delta = 0.00$, Balance Sheet identity | Accounting Gate | PASS (3/3) |
| 7.1 - 7.2 | Authentic v3.0 backup SHA-256 verification, tampered payload rejection | Cryptography | PASS (2/2) |
| 8.1 - 8.2 | Client bundle secrets check, standard GSTIN & PAN format validation | AppSec | PASS (2/2) |
| 9.1 - 9.2 | Scale benchmark: 1,000 item search (< 50ms) and 1,000 journal Trial Balance (< 100ms) | Performance | PASS (2/2) |
