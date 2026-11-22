-- ====================================================================
-- BAZAAR-GURU / INVOICE PRO: COMPLETE SUPABASE RELATIONAL DATABASE SCHEMA
-- Version: 6.0.0
-- Master Migration Script: Identity, Multi-Tenancy, Catalog, Inventory,
-- Sales, Purchases, Banking, Double-Entry Accounting, Storage & RLS
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. IDENTITY & BUSINESSES (MULTI-TENANCY)
-- ====================================================================

-- User Profiles (Linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'User',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  active_business_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Businesses Table (Each tenant business)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,
  gstin TEXT,
  address TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  signature_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  bank_branch TEXT,
  terms_template TEXT,
  upi_id TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  financial_year_start DATE DEFAULT '2025-04-01',
  inventory_config JSONB DEFAULT '{"defaultValuationMethod": "weighted_average", "allowNegativeStock": false, "lowStockAlertThreshold": 5}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Business Members (Team & Access Control)
CREATE TABLE IF NOT EXISTS public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'salesperson', 'viewer')) DEFAULT 'owner',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_business_user UNIQUE (business_id, user_id)
);

-- Helper function to verify membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_business_member(b_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_members 
    WHERE business_id = b_id AND user_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 2. PARTIES (CUSTOMERS & SUPPLIERS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.parties (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  gstin TEXT,
  billing_address TEXT NOT NULL,
  shipping_address TEXT,
  state TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
  credit_limit NUMERIC(15, 2) DEFAULT 0.00,
  credit_period_days INTEGER DEFAULT 30,
  opening_balance NUMERIC(15, 2) DEFAULT 0.00,
  opening_balance_type TEXT CHECK (opening_balance_type IN ('debit', 'credit')) DEFAULT 'debit',
  outstanding_balance NUMERIC(15, 2) DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_parties_business ON public.parties(business_id);
CREATE INDEX IF NOT EXISTS idx_parties_type ON public.parties(business_id, type);

-- ====================================================================
-- 3. PRODUCTS, INVENTORY & WAREHOUSES
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_warehouse_code_business UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  category TEXT,
  brand TEXT,
  item_type TEXT NOT NULL DEFAULT 'goods', -- 'goods', 'service', etc.
  unit TEXT NOT NULL DEFAULT 'PCS',
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(15, 2) DEFAULT 0.00,
  mrp NUMERIC(15, 2) DEFAULT 0.00,
  wholesale_price NUMERIC(15, 2),
  min_selling_price NUMERIC(15, 2),
  tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  hsn_code TEXT NOT NULL,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  cess NUMERIC(5, 2) DEFAULT 0.00,
  opening_stock NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  opening_stock_value NUMERIC(15, 2) DEFAULT 0.00,
  stock_qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  min_stock_level NUMERIC(15, 3) DEFAULT 5.000,
  reorder_level NUMERIC(15, 3) DEFAULT 10.000,
  track_stock BOOLEAN NOT NULL DEFAULT TRUE,
  track_batch BOOLEAN NOT NULL DEFAULT FALSE,
  track_expiry BOOLEAN NOT NULL DEFAULT FALSE,
  warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backwards compatibility alias for items table if queried directly
CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hsn_code TEXT,
  unit TEXT NOT NULL DEFAULT 'PCS',
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  purchase_price NUMERIC(15, 2) DEFAULT 0.00,
  cost_price NUMERIC(15, 2) DEFAULT 0.00,
  mrp NUMERIC(15, 2),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  stock_qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  warehouse_name TEXT,
  movement_type TEXT NOT NULL,
  quantity_in NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  quantity_out NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  quantity_change NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  running_balance NUMERIC(15, 3),
  unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  reference_number TEXT,
  batch_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.product_batches (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  quantity NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
  mrp NUMERIC(15, 2),
  unit_cost NUMERIC(15, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  date DATE NOT NULL,
  source_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
  destination_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'completed',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  adjustment_number TEXT NOT NULL,
  date DATE NOT NULL,
  warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
  reason TEXT NOT NULL,
  total_loss_value NUMERIC(15, 2) DEFAULT 0.00,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 4. SALES, PURCHASES & INVOICES
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  reference_number TEXT,
  po_number TEXT,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  party_id TEXT NOT NULL,
  party_type TEXT NOT NULL,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  cgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  sgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  igst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  cess NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  round_off NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  amount_in_words TEXT,
  payment_mode TEXT,
  amount_received NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Unpaid', 'Partial')),
  notes TEXT,
  terms TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  cancel_reason TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_business_inv_num UNIQUE (business_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(business_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON public.invoices(business_id, party_id);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id TEXT,
  name TEXT NOT NULL,
  hsn_code TEXT NOT NULL,
  qty NUMERIC(15, 3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'PCS',
  unit_price NUMERIC(15, 2) NOT NULL,
  mrp NUMERIC(15, 2),
  discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  taxable_value NUMERIC(15, 2) NOT NULL,
  gst_rate NUMERIC(5, 2) NOT NULL,
  cgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  sgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  igst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  manufacturing_date DATE
);

CREATE INDEX IF NOT EXISTS idx_inv_items_invoice ON public.invoice_items(invoice_id);

-- ====================================================================
-- 5. BANKING & TREASURY
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT,
  account_number TEXT NOT NULL,
  ifsc_code TEXT,
  branch_name TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('savings', 'current', 'overdraft', 'cash_credit')),
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  overdraft_limit NUMERIC(15, 2) DEFAULT 0.00,
  upi_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('main_cash', 'petty_cash')),
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.fund_transfers (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  date DATE NOT NULL,
  source_account_id TEXT NOT NULL,
  source_account_type TEXT NOT NULL CHECK (source_account_type IN ('bank', 'cash')),
  destination_account_id TEXT NOT NULL,
  destination_account_type TEXT NOT NULL CHECK (destination_account_type IN ('bank', 'cash')),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  transfer_mode TEXT NOT NULL,
  reference_number TEXT,
  narration TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.cheque_records (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cheque_number TEXT NOT NULL,
  cheque_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  party_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('received', 'issued')),
  bank_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'deposited', 'pending_clearance', 'cleared', 'bounced', 'cancelled')),
  deposit_date DATE,
  clearing_date DATE,
  bounce_reason TEXT,
  bounce_charges NUMERIC(15, 2) DEFAULT 0.00,
  voucher_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  statement_from DATE,
  statement_to DATE,
  opening_balance NUMERIC(15, 2),
  closing_balance NUMERIC(15, 2),
  total_lines INT DEFAULT 0,
  reconciled_lines INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_number TEXT,
  debit NUMERIC(15, 2) DEFAULT 0.00,
  credit NUMERIC(15, 2) DEFAULT 0.00,
  balance NUMERIC(15, 2),
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'reconciled')),
  matched_voucher_id TEXT,
  reconciled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL,
  reconciliation_date DATE NOT NULL,
  book_balance NUMERIC(15, 2) NOT NULL,
  bank_statement_balance NUMERIC(15, 2) NOT NULL,
  unpresented_cheques_total NUMERIC(15, 2) DEFAULT 0.00,
  uncredited_deposits_total NUMERIC(15, 2) DEFAULT 0.00,
  difference NUMERIC(15, 2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'balanced' CHECK (status IN ('balanced', 'discrepancy')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 6. DOUBLE-ENTRY ACCOUNTING & LEDGERS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'locked', 'closed')) DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_biz_period UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype TEXT NOT NULL,
  parent_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  opening_balance_type TEXT CHECK (opening_balance_type IN ('debit', 'credit')) DEFAULT 'debit',
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_biz_account_code UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  party_id TEXT,
  narration TEXT,
  total_debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'posted',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.accounts(id),
  party_id TEXT,
  description TEXT,
  debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);

CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  voucher_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payment_in', 'payment_out')),
  party_id TEXT NOT NULL,
  date DATE NOT NULL,
  payment_mode TEXT NOT NULL,
  account_id TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 7. EXPENSES, DOCUMENTS & AUDIT TRAIL
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  gst_amount NUMERIC(15, 2) DEFAULT 0.00,
  vendor_gstin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.business_documents (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 8. SYNC & DEVICE REGISTRY
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.sync_devices (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'desktop',
  client_version TEXT NOT NULL DEFAULT '6.0.0',
  status TEXT NOT NULL DEFAULT 'active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sync_outbox_log (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  device_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheque_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_outbox_log ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and manage own profile
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Businesses: Members can select, Owners can insert/update
CREATE POLICY "businesses_select" ON public.businesses FOR SELECT TO authenticated 
  USING (owner_id = auth.uid() OR public.is_business_member(id));
CREATE POLICY "businesses_insert" ON public.businesses FOR INSERT TO authenticated 
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "businesses_update" ON public.businesses FOR UPDATE TO authenticated 
  USING (owner_id = auth.uid() OR public.is_business_member(id));

-- Business Members: Accessible to business members
CREATE POLICY "members_select" ON public.business_members FOR SELECT TO authenticated 
  USING (user_id = auth.uid() OR public.is_business_member(business_id));
CREATE POLICY "members_insert" ON public.business_members FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid() OR public.is_business_member(business_id));

-- Standard tenant isolation macro on all business-owned tables:
-- Allows ALL operations when user is an active member of the business
CREATE POLICY "parties_all" ON public.parties FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "products_all" ON public.products FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "items_all" ON public.items FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "product_batches_all" ON public.product_batches FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "stock_transfers_all" ON public.stock_transfers FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "stock_adjustments_all" ON public.stock_adjustments FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "invoices_all" ON public.invoices FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "invoice_items_all" ON public.invoice_items FOR ALL TO authenticated 
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE public.is_business_member(business_id) OR business_id = auth.uid()));
CREATE POLICY "bank_accounts_all" ON public.bank_accounts FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "cash_accounts_all" ON public.cash_accounts FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "fund_transfers_all" ON public.fund_transfers FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "cheque_records_all" ON public.cheque_records FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "bank_statements_all" ON public.bank_statements FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "bank_statement_lines_all" ON public.bank_statement_lines FOR ALL TO authenticated 
  USING (statement_id IN (SELECT id FROM public.bank_statements WHERE public.is_business_member(business_id) OR business_id = auth.uid()));
CREATE POLICY "bank_reconciliations_all" ON public.bank_reconciliations FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "accounting_periods_all" ON public.accounting_periods FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "accounts_all" ON public.accounts FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "journal_entries_all" ON public.journal_entries FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "journal_lines_all" ON public.journal_lines FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "payment_vouchers_all" ON public.payment_vouchers FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "payment_allocations_all" ON public.payment_allocations FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "expenses_all" ON public.expenses FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "business_documents_all" ON public.business_documents FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "audit_events_all" ON public.audit_events FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "sync_devices_all" ON public.sync_devices FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());
CREATE POLICY "sync_outbox_log_all" ON public.sync_outbox_log FOR ALL TO authenticated USING (public.is_business_member(business_id) OR business_id = auth.uid());

-- ====================================================================
-- 10. AUTH TRIGGER (PROFILE & DEFAULT BUSINESS CREATION)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_biz_id UUID;
  v_biz_name TEXT;
BEGIN
  v_biz_name := COALESCE(new.raw_user_meta_data->>'business_name', new.raw_user_meta_data->>'full_name', 'My Business');

  -- Create Business
  INSERT INTO public.businesses (owner_id, name, email)
  VALUES (new.id, v_biz_name, new.email)
  RETURNING id INTO v_biz_id;

  -- Create Membership
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (v_biz_id, new.id, 'owner');

  -- Create Profile
  INSERT INTO public.profiles (id, name, email, active_business_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Business Owner'),
    new.email,
    v_biz_id
  )
  ON CONFLICT (id) DO UPDATE SET active_business_id = v_biz_id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 11. STORAGE BUCKETS CONFIGURATION
-- ====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('business-logos', 'business-logos', true),
  ('business-documents', 'business-documents', false),
  ('invoice-attachments', 'invoice-attachments', false),
  ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;
