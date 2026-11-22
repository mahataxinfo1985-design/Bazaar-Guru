-- ============================================================================
-- INVOICE PRO: PHASE 4 INVENTORY & FINANCIAL REPORTING DATABASE SCHEMA
-- PostgreSQL DDL with Foreign Keys, Constraints, Indexes & Row-Level Security
-- ============================================================================

-- 1. Warehouses / Godowns
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouse_code_business UNIQUE (business_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_business ON public.warehouses(business_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON public.warehouses(business_id, is_active);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own warehouses"
    ON public.warehouses
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 2. Enhanced Products Master (Extends or replaces items master)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    description TEXT,
    category TEXT,
    brand TEXT,
    item_type TEXT NOT NULL DEFAULT 'goods', -- 'goods', 'service', 'raw_material', etc.
    unit TEXT NOT NULL DEFAULT 'PCS',
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    wholesale_price NUMERIC(15, 2),
    min_selling_price NUMERIC(15, 2),
    tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    hsn_code TEXT NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cess NUMERIC(5, 2) DEFAULT 0.00,
    opening_stock NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    opening_stock_value NUMERIC(15, 2) DEFAULT 0.00,
    opening_stock_date DATE,
    min_stock_level NUMERIC(15, 3) DEFAULT 5.000,
    reorder_level NUMERIC(15, 3) DEFAULT 10.000,
    max_stock_level NUMERIC(15, 3),
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    track_batch BOOLEAN NOT NULL DEFAULT FALSE,
    track_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    stock_qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    average_cost NUMERIC(15, 2) DEFAULT 0.00,
    current_valuation NUMERIC(15, 2) DEFAULT 0.00,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_sku_business UNIQUE (business_id, sku),
    CONSTRAINT uq_product_barcode_business UNIQUE (business_id, barcode)
);

CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_hsn ON public.products(business_id, hsn_code);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own products"
    ON public.products
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 3. Immutable Stock Movement Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
    warehouse_name TEXT,
    movement_type TEXT NOT NULL, -- 'opening_stock', 'purchase', 'sales', 'sales_return', 'purchase_return', 'stock_adjustment', 'stock_transfer_in', 'stock_transfer_out', etc.
    quantity_in NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    quantity_out NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    quantity_change NUMERIC(15, 3) NOT NULL,
    running_balance NUMERIC(15, 3),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    date DATE NOT NULL,
    reference_type TEXT NOT NULL, -- 'invoice', 'purchase', 'credit_note', 'debit_note', 'transfer', 'adjustment', 'opening', 'manual'
    reference_id TEXT,
    reference_number TEXT,
    batch_id TEXT,
    batch_number TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON public.stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON public.stock_movements(business_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(business_id, date);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stock movements"
    ON public.stock_movements
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 4. Inventory Valuation Layers (for FIFO & Batch Tracking)
CREATE TABLE IF NOT EXISTS public.inventory_valuation_layers (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    warehouse_id TEXT REFERENCES public.warehouses(id),
    purchase_date DATE NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT,
    original_quantity NUMERIC(15, 3) NOT NULL,
    remaining_quantity NUMERIC(15, 3) NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL,
    total_cost NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_layers_business ON public.inventory_valuation_layers(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_layers_product ON public.inventory_valuation_layers(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inv_layers_date ON public.inventory_valuation_layers(business_id, purchase_date);

ALTER TABLE public.inventory_valuation_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own valuation layers"
    ON public.inventory_valuation_layers
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 5. Product Batches & Expiry Tracking
CREATE TABLE IF NOT EXISTS public.product_batches (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
    batch_number TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    purchase_reference TEXT,
    quantity_received NUMERIC(15, 3) NOT NULL,
    remaining_quantity NUMERIC(15, 3) NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(15, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_batch_warehouse UNIQUE (business_id, product_id, warehouse_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_business ON public.product_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_batches_product ON public.product_batches(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.product_batches(business_id, expiry_date);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own batches"
    ON public.product_batches
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 6. Stock Transfers (Inter-Warehouse Godown Transfers)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    date DATE NOT NULL,
    source_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
    destination_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'in_transit', 'cancelled'
    notes TEXT,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_transfer_number UNIQUE (business_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_transfers_business ON public.stock_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON public.stock_transfers(business_id, date);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stock transfers"
    ON public.stock_transfers
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);


-- 7. Stock Adjustments (Physical Count Reconciliation & Loss/Damage)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    adjustment_number TEXT NOT NULL,
    date DATE NOT NULL,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id),
    status TEXT NOT NULL DEFAULT 'posted', -- 'posted', 'draft', 'cancelled'
    narration TEXT,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_adjustment_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    journal_entry_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_adjustment_number UNIQUE (business_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_business ON public.stock_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_date ON public.stock_adjustments(business_id, date);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stock adjustments"
    ON public.stock_adjustments
    FOR ALL
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);
