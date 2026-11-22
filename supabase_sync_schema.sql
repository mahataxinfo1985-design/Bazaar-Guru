-- ====================================================================
-- INVOICE PRO: PHASE 5 — OFFLINE-FIRST, SYNC & CONFLICT SCHEMA
-- Tables, RLS Policies, Indexes and Atomic Batch Sync Function
-- ====================================================================

-- 1. Sync Devices Table
CREATE TABLE IF NOT EXISTS public.sync_devices (
    id TEXT PRIMARY KEY, -- inv_dev_UUID
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'desktop', -- desktop, laptop, mobile, tablet
    client_version TEXT NOT NULL DEFAULT '5.0.0',
    user_agent TEXT,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending_approval')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_synced_at TIMESTAMPTZ,
    sync_checkpoint JSONB DEFAULT '{"lastServerSeq": 0}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_devices_business ON public.sync_devices(business_id);
CREATE INDEX IF NOT EXISTS idx_sync_devices_status ON public.sync_devices(status);

ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage devices for their businesses"
    ON public.sync_devices
    FOR ALL
    USING (
        business_id IN (
            SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
    );

-- 2. Sync Outbox Log (Idempotency and Audit)
CREATE TABLE IF NOT EXISTS public.sync_outbox_log (
    id TEXT PRIMARY KEY, -- op_...
    idempotency_key TEXT NOT NULL UNIQUE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES public.sync_devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    payload_hash TEXT,
    status TEXT NOT NULL DEFAULT 'synced',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    server_seq BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_idempotency ON public.sync_outbox_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_business ON public.sync_outbox_log(business_id);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON public.sync_outbox_log(entity_type, entity_id);

ALTER TABLE public.sync_outbox_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync logs for their businesses"
    ON public.sync_outbox_log
    FOR ALL
    USING (
        business_id IN (
            SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
    );

-- 3. Sync Conflicts Table
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    operation_id TEXT REFERENCES public.sync_outbox_log(id) ON DELETE SET NULL,
    device_id TEXT REFERENCES public.sync_devices(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    local_payload JSONB NOT NULL,
    server_payload JSONB NOT NULL,
    field_differences JSONB,
    status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'dismissed')),
    resolution_strategy TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    final_payload JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_business ON public.sync_conflicts(business_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON public.sync_conflicts(status);

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conflicts for their businesses"
    ON public.sync_conflicts
    FOR ALL
    USING (
        business_id IN (
            SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
    );

-- 4. Sync Checkpoints Table
CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES public.sync_devices(id) ON DELETE CASCADE,
    last_server_seq BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (business_id, device_id)
);

-- ====================================================================
-- 5. ATOMIC BATCH TRANSACTION SYNCHRONIZATION FUNCTION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.sync_batch_transactions(
    p_business_id UUID,
    p_device_id TEXT,
    p_operations JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_device_status TEXT;
    v_op JSONB;
    v_idempotency_key TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_op_type TEXT;
    v_op_id TEXT;
    v_payload JSONB;
    v_results JSONB := '[]'::jsonb;
    v_existing_log RECORD;
    v_seq BIGINT;
    v_debit_sum NUMERIC;
    v_credit_sum NUMERIC;
    v_line JSONB;
BEGIN
    -- 1. Validate device authorization
    SELECT status INTO v_device_status 
    FROM public.sync_devices 
    WHERE id = p_device_id AND business_id = p_business_id;

    IF v_device_status IS NULL THEN
        -- Auto-register device if not present
        INSERT INTO public.sync_devices (id, business_id, device_name, status)
        VALUES (p_device_id, p_business_id, 'Synced Device', 'active');
    ELSIF v_device_status = 'revoked' THEN
        RAISE EXCEPTION 'Device authorization has been revoked. Synchronization rejected for device %', p_device_id;
    END IF;

    -- 2. Process each operation sequentially
    FOR v_op IN SELECT * FROM jsonb_array_elements(p_operations)
    LOOP
        v_op_id := v_op->>'id';
        v_idempotency_key := v_op->>'idempotencyKey';
        v_entity_type := v_op->>'entityType';
        v_entity_id := v_op->>'entityId';
        v_op_type := v_op->>'operationType';
        v_payload := v_op->'payload';

        -- Idempotency check: Has this operation already been applied?
        SELECT * INTO v_existing_log 
        FROM public.sync_outbox_log 
        WHERE idempotency_key = v_idempotency_key;

        IF FOUND THEN
            v_results := v_results || jsonb_build_object(
                'operationId', v_op_id,
                'idempotencyKey', v_idempotency_key,
                'status', 'duplicate_ignored',
                'message', 'Operation already applied previously.',
                'serverSeq', v_existing_log.server_seq
            );
            CONTINUE;
        END IF;

        -- Accounting balance check for journal entries
        IF v_entity_type = 'journal_entry' AND v_payload ? 'lines' THEN
            v_debit_sum := 0;
            v_credit_sum := 0;
            FOR v_line IN SELECT * FROM jsonb_array_elements(v_payload->'lines')
            LOOP
                v_debit_sum := v_debit_sum + COALESCE((v_line->>'debitAmount')::numeric, 0);
                v_credit_sum := v_credit_sum + COALESCE((v_line->>'creditAmount')::numeric, 0);
            END LOOP;

            IF abs(v_debit_sum - v_credit_sum) > 0.01 THEN
                v_results := v_results || jsonb_build_object(
                    'operationId', v_op_id,
                    'status', 'failed',
                    'error', format('Double-entry imbalance detected. Total Debits: %s, Total Credits: %s', v_debit_sum, v_credit_sum)
                );
                CONTINUE;
            END IF;
        END IF;

        -- Record operation in outbox log
        INSERT INTO public.sync_outbox_log (
            id,
            idempotency_key,
            business_id,
            device_id,
            entity_type,
            entity_id,
            operation_type,
            payload,
            status,
            applied_at
        ) VALUES (
            v_op_id,
            v_idempotency_key,
            p_business_id,
            p_device_id,
            v_entity_type,
            v_entity_id,
            v_op_type,
            v_payload,
            'synced',
            timezone('utc'::text, now())
        ) RETURNING server_seq INTO v_seq;

        v_results := v_results || jsonb_build_object(
            'operationId', v_op_id,
            'idempotencyKey', v_idempotency_key,
            'status', 'synced',
            'serverSeq', v_seq,
            'appliedAt', timezone('utc'::text, now())
        );
    END LOOP;

    -- Update device checkpoint
    INSERT INTO public.sync_checkpoints (business_id, device_id, last_server_seq, updated_at)
    VALUES (p_business_id, p_device_id, COALESCE(v_seq, 0), timezone('utc'::text, now()))
    ON CONFLICT (business_id, device_id) 
    DO UPDATE SET 
        last_server_seq = GREATEST(public.sync_checkpoints.last_server_seq, EXCLUDED.last_server_seq),
        updated_at = EXCLUDED.updated_at;

    -- Update device last seen
    UPDATE public.sync_devices
    SET last_seen_at = timezone('utc'::text, now()),
        last_synced_at = timezone('utc'::text, now())
    WHERE id = p_device_id;

    RETURN v_results;
END;
$$;
