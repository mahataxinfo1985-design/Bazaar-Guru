-- Supabase Database Schema for InvoicePro
-- Run this in the Supabase SQL Editor.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Business Profile)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

-- Trigger to create a profile automatically when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, gstin, address, state, phone, bank_name, bank_account, bank_ifsc, bank_branch, upi_id, terms_template)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'My Business'),
    new.email,
    '', '', '', '', '', '', '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Parties Table
CREATE TABLE IF NOT EXISTS public.parties (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  billing_address TEXT NOT NULL,
  shipping_address TEXT,
  state TEXT NOT NULL,
  outstanding_balance NUMERIC DEFAULT 0 NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Parties
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parties" 
  ON public.parties FOR SELECT 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own parties" 
  ON public.parties FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own parties" 
  ON public.parties FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can delete own parties" 
  ON public.parties FOR DELETE 
  TO authenticated 
  USING (auth.uid() = business_id);


-- 3. Items Table (Product Master)
CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hsn_code TEXT,
  unit TEXT NOT NULL,
  unit_price NUMERIC DEFAULT 0 NOT NULL,
  mrp NUMERIC DEFAULT 0 NOT NULL,
  gst_rate NUMERIC DEFAULT 0 NOT NULL,
  stock_qty NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own items" 
  ON public.items FOR SELECT 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own items" 
  ON public.items FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own items" 
  ON public.items FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can delete own items" 
  ON public.items FOR DELETE 
  TO authenticated 
  USING (auth.uid() = business_id);


-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  reference_number TEXT,
  po_number TEXT,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  party_id TEXT REFERENCES public.parties(id) ON DELETE SET NULL,
  party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0 NOT NULL,
  taxable_amount NUMERIC NOT NULL,
  cgst NUMERIC DEFAULT 0 NOT NULL,
  sgst NUMERIC DEFAULT 0 NOT NULL,
  igst NUMERIC DEFAULT 0 NOT NULL,
  cess NUMERIC DEFAULT 0 NOT NULL,
  round_off NUMERIC DEFAULT 0 NOT NULL,
  grand_total NUMERIC NOT NULL,
  amount_in_words TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  amount_received NUMERIC DEFAULT 0 NOT NULL,
  balance_due NUMERIC DEFAULT 0 NOT NULL,
  payment_status TEXT NOT NULL,
  notes TEXT,
  terms TEXT,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Active', 'Cancelled')),
  cancel_reason TEXT,
  deleted BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  auto_stock_addition BOOLEAN,
  
  -- Phase 1 Specific Fields
  bill_of_entry_number TEXT,
  port_details TEXT,
  reverse_charge_applicable BOOLEAN DEFAULT FALSE,
  delivery_date DATE,
  expected_return_date DATE,
  challan_status TEXT
);

-- Enable RLS for Invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" 
  ON public.invoices FOR SELECT 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own invoices" 
  ON public.invoices FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own invoices" 
  ON public.invoices FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can delete own invoices" 
  ON public.invoices FOR DELETE 
  TO authenticated 
  USING (auth.uid() = business_id);


-- 5. Invoice Items Table (Line Items)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES public.items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  hsn_code TEXT,
  qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  mrp NUMERIC,
  discount NUMERIC DEFAULT 0 NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  taxable_value NUMERIC NOT NULL,
  gst_rate NUMERIC NOT NULL,
  cgst NUMERIC DEFAULT 0 NOT NULL,
  sgst NUMERIC DEFAULT 0 NOT NULL,
  igst NUMERIC DEFAULT 0 NOT NULL,
  total NUMERIC NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  manufacturing_date DATE
);

-- Enable RLS for Invoice Items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items" 
  ON public.invoice_items FOR SELECT 
  TO authenticated 
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE business_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoice items" 
  ON public.invoice_items FOR INSERT 
  TO authenticated 
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE business_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoice items" 
  ON public.invoice_items FOR UPDATE 
  TO authenticated 
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE business_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own invoice items" 
  ON public.invoice_items FOR DELETE 
  TO authenticated 
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE business_id = auth.uid()
    )
  );


-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_mode TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  gst_amount NUMERIC DEFAULT 0,
  vendor_gstin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses" 
  ON public.expenses FOR SELECT 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own expenses" 
  ON public.expenses FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own expenses" 
  ON public.expenses FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = business_id);

CREATE POLICY "Users can delete own expenses" 
  ON public.expenses FOR DELETE 
  TO authenticated 
  USING (auth.uid() = business_id);


-- Create buckets for storage (for business logos, signatures, and receipts)
-- Note: These policies run against storage.objects
-- You can set these up in the Supabase Dashboard, or via SQL:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket 'business-assets'
CREATE POLICY "Authenticated users can upload business assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view business assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');

CREATE POLICY "Users can update own business assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own business assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
