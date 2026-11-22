# Bazaar-Guru: Production Deployment Checklist

Use this checklist prior to executing the initial production deployment.

---

## 1. Supabase Infrastructure Preparation

- [ ] **Database Migrations:**
  - Execute `supabase_schema.sql` (core profiles, parties, items, invoices, expenses).
  - Execute `supabase_accounting_schema.sql` (periods, accounts, journals, vouchers).
  - Execute `supabase_banking_schema.sql` (bank accounts, transfers, cheques, reconciliations).
  - Execute `supabase_inventory_schema.sql` (warehouses, products, movements, valuation layers).
  - Execute `supabase_sync_schema.sql` (device registrations, outbox, conflicts).
- [ ] **Row Level Security (RLS) Verification:**
  - Verify all 29 tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Verify policies restrict `SELECT`, `INSERT`, `UPDATE`, `DELETE` to `auth.uid() = user_id`.
- [ ] **Storage Buckets:**
  - Verify bucket `business-assets` exists and has public read enabled.
  - Verify bucket `business-documents` exists with authenticated private access.

---

## 2. Authentication & OAuth Setup

- [ ] **Google OAuth Provider:**
  - Enabled in Supabase Dashboard -> Authentication -> Providers -> Google.
  - Client ID and Client Secret configured from Google Cloud Console.
  - Authorized JavaScript Origins configured: `https://your-domain.com`.
  - Authorized Redirect URI configured: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
- [ ] **Redirect URLs:**
  - Set Site URL in Supabase Auth to `https://your-domain.com`.
  - Add `https://your-domain.com/**` to Additional Redirect URLs.
- [ ] **Email Templates:**
  - Configure Custom SMTP (e.g. Resend, SendGrid, Amazon SES) for password recovery and invite emails.

---

## 3. Environment Variables Configuration

Create production environment configuration on hosting platform:

```env
# Server
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com

# Frontend Public Variables (Safe for client bundle)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-production-anon-key>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-production-anon-key>

# Backend Private Variables (Never expose to client bundle)
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SECRET_KEY=<your-production-service-role-key>
```

---

## 4. Build & Pre-Flight Testing

- [ ] Run type checking:
  ```bash
  npm run lint
  ```
  Expected: Exit code 0 (No type errors).
- [ ] Run automated test suite:
  ```bash
  npm run test
  npm run test:gst
  ```
  Expected: 135/135 tests pass.
- [ ] Compile production build:
  ```bash
  npm run build
  ```
  Expected: `dist/index.html` and `dist/server.cjs` generated without errors.

---

## 5. Server & Hosting Execution

- [ ] Start command:
  ```bash
  node dist/server.cjs
  ```
- [ ] Verify health check:
  ```bash
  curl https://your-domain.com/api/health
  # {"status":"ok","app":"Bazaar-Guru","environment":"production"}
  ```
- [ ] Verify HTTP security headers:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
