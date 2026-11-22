# InvoicePro Memory & Architectural Blueprint

## Current System State

| Component / Module | Status | Technical Details & Notes |
| :--- | :--- | :--- |
| **Sales Invoices** | ✅ Active | Support for Tax Invoice, Proforma, Credit Note, Debit Note, Quotations, Bill of Supply. |
| **Purchase Invoices** | ✅ Active | Support for Tax Invoice, Reverse Charge, Import. |
| **Expenses Module** | ✅ Active | Integrated into the Sidebar navigation between Reports and Settings. Categories tracked, receipt upload supported. |
| **GST Engine** | ✅ Active | Complete Indian GST calculations (CGST, SGST, IGST, Cess, Round-off). Tested with 5 core edge cases. |
| **PDF Themes** | ✅ Active | 6 premium themes (Classic, Minimal Modern, 80mm Thermal, Elegant Serif, Bold Impact, Monochrome) cross-bound to live preview & jsPDF. |
| **Database Sync** | ⏳ In Progress | Hybrid LocalStorage + Supabase architecture. Setup ready, migration flow triggered on first authenticated session. |
| **Auth System** | ✅ Active | Supabase Auth (Email/Password & Magic Links) with a dedicated Auth Screen/Banner. |

## Last Executed Task

| Task | Status | Completion Details |
| :--- | :--- | :--- |
| **JSX Syntax Error Fixes** | ✅ Completed | Fixed unclosed modal backdrop `div` (line 3979) in `src/App.tsx` and balanced the outer layout div tree. |
| **TypeScript Type & Icon Fixes** | ✅ Completed | Resolved type mismatch in `setExpenses`, imported missing `Receipt` icon, fixed argument order in `uploadAsset` call, and cast `import.meta` to bypass Vite env type errors. |
| **Verification & Compilation** | ✅ Completed | Ran `npx tsc --noEmit` which completed successfully with **zero compilation errors**. |

## Architectural Blueprint

### Monolith Structure (`src/App.tsx`)
InvoicePro utilizes a hybrid single-page architecture where the primary layout, navigation router, form builders, invoice previewers, and core business states are managed within the main component tree. 

### Hybrid Database Architecture
1. **Unauthenticated Session (Local Mode)**: Read/write operations target browser `localStorage` across 4 primary keys:
   - `invoicepro_invoices`
   - `invoicepro_parties`
   - `invoicepro_items`
   - `invoicepro_expenses`
2. **Authenticated Session (Cloud Sync Mode)**: Prioritizes real-time Supabase remote reads and writes. On first authenticated session, a one-time migration routine automatically uploads existing `localStorage` arrays to corresponding Supabase tables to prevent data loss.

---
*Document last updated: 2026-06-26 21:20 Local Time*
