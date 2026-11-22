-- ====================================================================
-- INVOICEPRO: DOUBLE-ENTRY ACCOUNTING & ATOMIC TRANSACTIONS SCHEMA
-- Phase 2: Complete Accounting Engine
-- Adds Chart of Accounts, Journals, Accounting Periods, Allocations, & RPCs
-- ====================================================================

-- 1. Accounting Periods Table (Financial Years)
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "FY 2024-25"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'locked', 'closed')) DEFAULT 'open',
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id),
  reopened_at TIMESTAMP WITH TIME ZONE,
  reopened_by UUID REFERENCES auth.users(id),
  reopen_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_business_period_name UNIQUE (business_id, name)
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounting periods" ON public.accounting_periods
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own accounting periods" ON public.accounting_periods
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);
CREATE POLICY "Users can update own accounting periods" ON public.accounting_periods
  FOR UPDATE TO authenticated USING (auth.uid() = business_id);


-- 2. Accounts Table (Chart of Accounts with Hierarchy)
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype TEXT NOT NULL,
  parent_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  opening_balance NUMERIC DEFAULT 0 NOT NULL,
  opening_balance_type TEXT CHECK (opening_balance_type IN ('debit', 'credit')) DEFAULT 'debit',
  opening_balance_date DATE,
  current_balance NUMERIC DEFAULT 0 NOT NULL,
  is_system BOOLEAN DEFAULT FALSE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_business_account_code UNIQUE (business_id, code)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);
CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE TO authenticated USING (auth.uid() = business_id AND is_system = FALSE);


-- 3. Journal Entries Table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'sales_invoice', 'purchase_invoice', 'payment_in', 'payment_out', 
    'expense', 'sales_return', 'purchase_return', 'opening_balance', 
    'journal_voucher', 'manual'
  )),
  source_id TEXT NOT NULL,
  party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  narration TEXT NOT NULL,
  total_debit NUMERIC NOT NULL,
  total_credit NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'posted', 'voided')) DEFAULT 'posted',
  period_id TEXT REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
  reversal_of TEXT REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_business_entry_number UNIQUE (business_id, entry_number)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries" ON public.journal_entries
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own journal entries" ON public.journal_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);
CREATE POLICY "Users can update own journal entries" ON public.journal_entries
  FOR UPDATE TO authenticated USING (auth.uid() = business_id);


-- 4. Journal Lines Table
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  description TEXT,
  debit NUMERIC DEFAULT 0 NOT NULL,
  credit NUMERIC DEFAULT 0 NOT NULL,
  CONSTRAINT check_positive_line_amounts CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT check_single_direction CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal lines" ON public.journal_lines
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own journal lines" ON public.journal_lines
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);


-- 5. Payment Vouchers Table
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voucher_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payment_in', 'payment_out')),
  party_id TEXT NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  payment_mode TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_business_voucher_number UNIQUE (business_id, voucher_number)
);

ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment vouchers" ON public.payment_vouchers
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own payment vouchers" ON public.payment_vouchers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);


-- 6. Payment Allocations Table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment allocations" ON public.payment_allocations
  FOR SELECT TO authenticated USING (auth.uid() = business_id);
CREATE POLICY "Users can insert own payment allocations" ON public.payment_allocations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);


-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_accounts_business_code ON public.accounts(business_id, code);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON public.accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_business_date ON public.journal_entries(business_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON public.journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_party ON public.journal_lines(party_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_party ON public.payment_vouchers(business_id, party_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_inv ON public.payment_allocations(invoice_id);


-- ====================================================================
-- ATOMIC STORED PROCEDURES (RPCs)
-- ====================================================================

-- A. Atomic Journal Entry Poster with Invariant & Period Checks
CREATE OR REPLACE FUNCTION public.post_journal_entry_atomic(
  p_entry JSONB,
  p_lines JSONB,
  p_business_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_entry_id TEXT;
  v_entry_number TEXT;
  v_date DATE;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_line RECORD;
  v_period RECORD;
  v_acc RECORD;
BEGIN
  v_entry_id := p_entry->>'id';
  v_entry_number := p_entry->>'entryNumber';
  v_date := (p_entry->>'date')::DATE;

  -- 1. Check Idempotency
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE id = v_entry_id OR (business_id = p_business_id AND entry_number = v_entry_number)) THEN
    RETURN jsonb_build_object('success', true, 'entryId', v_entry_id, 'message', 'Already posted');
  END IF;

  -- 2. Validate Accounting Period Lock
  SELECT * INTO v_period FROM public.accounting_periods 
  WHERE business_id = p_business_id AND start_date <= v_date AND end_date >= v_date;
  
  IF FOUND AND v_period.status != 'open' THEN
    RAISE EXCEPTION 'Cannot post to % accounting period: %', v_period.status, v_period.name;
  END IF;

  -- 3. Calculate and Validate Line Totals
  FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
    id TEXT, accountId TEXT, partyId TEXT, description TEXT, debit NUMERIC, credit NUMERIC
  )
  LOOP
    -- Validate Account is Active
    SELECT * INTO v_acc FROM public.accounts WHERE id = v_line.accountId AND business_id = p_business_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found for business %', v_line.accountId, p_business_id;
    END IF;
    IF NOT v_acc.is_active THEN
      RAISE EXCEPTION 'Account % (%) is inactive. Postings rejected.', v_acc.name, v_acc.code;
    END IF;

    v_total_debit := v_total_debit + COALESCE(v_line.debit, 0);
    v_total_credit := v_total_credit + COALESCE(v_line.credit, 0);
  END LOOP;

  -- Verify Debit == Credit
  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry out of balance. Debits: %, Credits: %', v_total_debit, v_total_credit;
  END IF;

  -- 4. Insert Entry
  INSERT INTO public.journal_entries (
    id, business_id, entry_number, date, source_type, source_id,
    party_id, narration, total_debit, total_credit, status,
    period_id, reversal_of, created_at, created_by
  ) VALUES (
    v_entry_id, p_business_id, v_entry_number, v_date,
    p_entry->>'sourceType', p_entry->>'sourceId',
    p_entry->>'partyId', p_entry->>'narration',
    v_total_debit, v_total_credit, 'posted',
    v_period.id, p_entry->>'reversalOf', NOW(), p_business_id
  );

  -- 5. Insert Lines
  FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
    id TEXT, accountId TEXT, partyId TEXT, description TEXT, debit NUMERIC, credit NUMERIC
  )
  LOOP
    INSERT INTO public.journal_lines (
      id, entry_id, business_id, account_id, party_id, description, debit, credit
    ) VALUES (
      v_line.id, v_entry_id, p_business_id, v_line.accountId, v_line.partyId,
      v_line.description, COALESCE(v_line.debit, 0), COALESCE(v_line.credit, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'entryId', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Atomic Sales Invoice & Journal Creation
CREATE OR REPLACE FUNCTION public.create_sales_invoice_atomic(
  p_invoice JSONB,
  p_items JSONB,
  p_journal JSONB,
  p_journal_lines JSONB,
  p_business_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_inv_id TEXT;
  v_inv_number TEXT;
  v_party_id TEXT;
  v_grand_total NUMERIC;
  v_balance_due NUMERIC;
  v_item RECORD;
  v_post_res JSONB;
BEGIN
  v_inv_id := p_invoice->>'id';
  v_inv_number := p_invoice->>'invoiceNumber';
  v_party_id := p_invoice->>'partyId';
  v_grand_total := (p_invoice->>'grandTotal')::NUMERIC;
  v_balance_due := (p_invoice->>'balanceDue')::NUMERIC;

  -- 1. Idempotency Check
  IF EXISTS (SELECT 1 FROM public.invoices WHERE id = v_inv_id OR (business_id = p_business_id AND invoice_number = v_inv_number)) THEN
    RETURN jsonb_build_object('success', true, 'invoiceId', v_inv_id, 'message', 'Already exists');
  END IF;

  -- 2. Insert Invoice
  INSERT INTO public.invoices (
    id, business_id, invoice_number, reference_number, po_number, type, date, due_date,
    party_id, party_type, subtotal, discount, taxable_amount, cgst, sgst, igst, cess,
    round_off, grand_total, amount_in_words, payment_mode, amount_received, balance_due,
    payment_status, notes, terms, status, created_at, updated_at
  ) VALUES (
    v_inv_id, p_business_id, v_inv_number, p_invoice->>'referenceNumber', p_invoice->>'poNumber',
    p_invoice->>'type', (p_invoice->>'date')::DATE, (p_invoice->>'dueDate')::DATE,
    v_party_id, p_invoice->>'partyType', (p_invoice->>'subtotal')::NUMERIC,
    (p_invoice->>'discount')::NUMERIC, (p_invoice->>'taxableAmount')::NUMERIC,
    (p_invoice->>'cgst')::NUMERIC, (p_invoice->>'sgst')::NUMERIC, (p_invoice->>'igst')::NUMERIC,
    (p_invoice->>'cess')::NUMERIC, (p_invoice->>'roundOff')::NUMERIC, v_grand_total,
    p_invoice->>'amountInWords', p_invoice->>'paymentMode', (p_invoice->>'amountReceived')::NUMERIC,
    v_balance_due, p_invoice->>'paymentStatus', p_invoice->>'notes', p_invoice->>'terms',
    p_invoice->>'status', NOW(), NOW()
  );

  -- 3. Insert Items and decrease inventory
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    id TEXT, itemId TEXT, name TEXT, hsnCode TEXT, qty NUMERIC, unit TEXT,
    unitPrice NUMERIC, mrp NUMERIC, discount NUMERIC, discountType TEXT,
    taxableValue NUMERIC, gstRate NUMERIC, cgst NUMERIC, sgst NUMERIC, igst NUMERIC, total NUMERIC
  )
  LOOP
    INSERT INTO public.invoice_items (
      id, invoice_id, item_id, name, hsn_code, qty, unit, unit_price, mrp,
      discount, discount_type, taxable_value, gst_rate, cgst, sgst, igst, total
    ) VALUES (
      v_item.id, v_inv_id, v_item.itemId, v_item.name, v_item.hsnCode, v_item.qty, v_item.unit,
      v_item.unitPrice, v_item.mrp, v_item.discount, v_item.discountType,
      v_item.taxableValue, v_item.gstRate, v_item.cgst, v_item.sgst, v_item.igst, v_item.total
    );

    IF v_item.itemId IS NOT NULL THEN
      UPDATE public.items 
      SET stock_qty = GREATEST(0, stock_qty - v_item.qty)
      WHERE id = v_item.itemId AND business_id = p_business_id;
    END IF;
  END LOOP;

  -- 4. Post Journal Entry Atomically
  IF p_journal IS NOT NULL THEN
    v_post_res := public.post_journal_entry_atomic(p_journal, p_journal_lines, p_business_id);
  END IF;

  -- 5. Update Party Outstanding Balance
  IF v_party_id IS NOT NULL AND v_balance_due > 0 THEN
    UPDATE public.parties
    SET outstanding_balance = outstanding_balance + v_balance_due
    WHERE id = v_party_id AND business_id = p_business_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'invoiceId', v_inv_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Atomic Payment Voucher Recording
CREATE OR REPLACE FUNCTION public.record_payment_voucher_atomic(
  p_voucher JSONB,
  p_allocations JSONB,
  p_journal JSONB,
  p_journal_lines JSONB,
  p_business_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher_id TEXT;
  v_party_id TEXT;
  v_amount NUMERIC;
  v_type TEXT;
  v_alloc RECORD;
  v_post_res JSONB;
BEGIN
  v_voucher_id := p_voucher->>'id';
  v_party_id := p_voucher->>'partyId';
  v_amount := (p_voucher->>'amount')::NUMERIC;
  v_type := p_voucher->>'type';

  -- 1. Insert Voucher
  INSERT INTO public.payment_vouchers (
    id, business_id, voucher_number, type, party_id, date,
    payment_mode, account_id, amount, reference_number, notes, status, created_at
  ) VALUES (
    v_voucher_id, p_business_id, p_voucher->>'voucherNumber', v_type, v_party_id,
    (p_voucher->>'date')::DATE, p_voucher->>'paymentMode', p_voucher->>'accountId',
    v_amount, p_voucher->>'referenceNumber', p_voucher->>'notes', 'completed', NOW()
  );

  -- 2. Process Allocations
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
    id TEXT, invoiceId TEXT, amount NUMERIC
  )
  LOOP
    INSERT INTO public.payment_allocations (
      id, voucher_id, invoice_id, business_id, amount, created_at
    ) VALUES (
      v_alloc.id, v_voucher_id, v_alloc.invoiceId, p_business_id, v_alloc.amount, NOW()
    );

    UPDATE public.invoices
    SET balance_due = GREATEST(0, balance_due - v_alloc.amount),
        amount_received = amount_received + v_alloc.amount,
        payment_status = CASE 
          WHEN (balance_due - v_alloc.amount) <= 0.01 THEN 'Paid' 
          ELSE 'Partial' 
        END,
        updated_at = NOW()
    WHERE id = v_alloc.invoiceId AND business_id = p_business_id;
  END LOOP;

  -- 3. Post Journal
  IF p_journal IS NOT NULL THEN
    v_post_res := public.post_journal_entry_atomic(p_journal, p_journal_lines, p_business_id);
  END IF;

  -- 4. Adjust Party Balance
  IF v_type = 'payment_in' THEN
    UPDATE public.parties
    SET outstanding_balance = outstanding_balance - v_amount
    WHERE id = v_party_id AND business_id = p_business_id;
  ELSE
    UPDATE public.parties
    SET outstanding_balance = outstanding_balance + v_amount
    WHERE id = v_party_id AND business_id = p_business_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'voucherId', v_voucher_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
