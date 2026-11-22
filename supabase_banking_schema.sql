-- ==============================================================================
-- INVOICE PRO: PHASE 3 BANKING & PAYMENTS POSTGRESQL DDL MIGRATION
-- Multi-account treasury, contra fund transfers, cheque lifecycle, statement import,
-- and double-entry bank reconciliation with RLS policies and audit integrity.
-- ==============================================================================

-- 1. BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_bank_acc_per_business UNIQUE (business_id, bank_name, account_number)
);

-- 2. CASH ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.cash_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('main_cash', 'petty_cash')),
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_cash_acc_per_business UNIQUE (business_id, name)
);

-- 3. FUND TRANSFERS TABLE (CONTRA VOUCHERS)
CREATE TABLE IF NOT EXISTS public.fund_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    transfer_date DATE NOT NULL,
    source_account_id UUID NOT NULL,
    source_account_type TEXT NOT NULL CHECK (source_account_type IN ('bank', 'cash')),
    destination_account_id UUID NOT NULL,
    destination_account_type TEXT NOT NULL CHECK (destination_account_type IN ('bank', 'cash')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    transfer_mode TEXT NOT NULL CHECK (transfer_mode IN ('bank_transfer', 'cash_deposit', 'cash_withdrawal', 'cheque', 'internal_transfer')),
    reference_number TEXT,
    narration TEXT,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_transfer_number_per_business UNIQUE (business_id, transfer_number),
    CONSTRAINT chk_source_dest_differ CHECK (source_account_id <> destination_account_id)
);

-- 4. CHEQUE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.cheque_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    cheque_number TEXT NOT NULL,
    cheque_date DATE NOT NULL,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    party_name TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    bank_name TEXT NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    cheque_type TEXT NOT NULL CHECK (cheque_type IN ('received', 'issued')),
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'issued', 'deposited', 'cleared', 'bounced', 'cancelled')),
    deposit_date DATE,
    clearance_date DATE,
    bounce_date DATE,
    bounce_reason TEXT,
    bank_charges NUMERIC(15, 2) DEFAULT 0.00,
    voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. BANK STATEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx')),
    import_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows_count INTEGER NOT NULL DEFAULT 0,
    duplicate_rows_count INTEGER NOT NULL DEFAULT 0,
    opening_balance NUMERIC(15, 2),
    closing_balance NUMERIC(15, 2),
    checksum TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. BANK STATEMENT LINES TABLE
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    value_date DATE,
    description TEXT NOT NULL,
    reference_number TEXT,
    withdrawal_amount NUMERIC(15, 2),
    deposit_amount NUMERIC(15, 2),
    balance_after NUMERIC(15, 2),
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    matched_voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
    matched_journal_line_id UUID REFERENCES public.journal_lines(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID,
    row_checksum TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_debit_or_credit CHECK (withdrawal_amount IS NOT NULL OR deposit_amount IS NOT NULL)
);

-- 7. BANK RECONCILIATIONS TABLE
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES public.bank_statements(id) ON DELETE SET NULL,
    reconciliation_date DATE NOT NULL,
    statement_closing_balance NUMERIC(15, 2) NOT NULL,
    book_closing_balance NUMERIC(15, 2) NOT NULL,
    unpresented_cheques_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    uncredited_deposits_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    bank_charges_not_in_books NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_not_in_books NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reconciled_balance NUMERIC(15, 2) NOT NULL,
    difference NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_balanced BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bank_accounts_biz ON public.bank_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_biz ON public.cash_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_biz_date ON public.fund_transfers(business_id, transfer_date);
CREATE INDEX IF NOT EXISTS idx_cheque_records_biz_status ON public.cheque_records(business_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_statements_acc ON public.bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_acc ON public.bank_statement_lines(bank_account_id, is_reconciled);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_checksum ON public.bank_statement_lines(bank_account_id, row_checksum);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_acc ON public.bank_reconciliations(bank_account_id, reconciliation_date);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheque_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

-- Dynamic tenant policy helper: authenticated users can access rows matching businesses they belong to
CREATE POLICY "Users can manage bank accounts for their businesses" ON public.bank_accounts
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage cash accounts for their businesses" ON public.cash_accounts
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage fund transfers for their businesses" ON public.fund_transfers
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage cheques for their businesses" ON public.cheque_records
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage bank statements for their businesses" ON public.bank_statements
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage statement lines for their businesses" ON public.bank_statement_lines
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage reconciliations for their businesses" ON public.bank_reconciliations
    FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
