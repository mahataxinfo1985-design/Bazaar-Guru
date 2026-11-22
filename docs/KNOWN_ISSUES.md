# Bazaar-Guru: Known Issues & Optimization Notes

This log details known non-critical behaviors, architectural constraints, and post-launch enhancement recommendations.

---

## 1. Non-Critical Observations

### Issue 1: Main Client Bundle Size (> 500 kB Warning)
- **Severity:** Low / Informational
- **Description:** Vite emits a chunk size warning during production build (`dist/assets/index-H5wS5qRU.js` is ~3.6 MB uncompressed, ~1.25 MB gzipped).
- **Cause:** Large third-party libraries including `jspdf`, `html2canvas-pro`, `xlsx`, and icons are currently bundled into the main entry bundle.
- **Impact:** Initial load time on slow 3G mobile connections may take 1-2 seconds.
- **Recommended Remediation:** Implement dynamic import code-splitting in `vite.config.ts`:
  ```typescript
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_pdf: ['jspdf', 'html2canvas', 'html2canvas-pro'],
          vendor_sheet: ['xlsx'],
        }
      }
    }
  }
  ```

---

### Issue 2: External GSTN Government Portal Live Filing
- **Severity:** Low / Informational
- **Description:** Bazaar-Guru generates complete, mathematically compliant GSTR-1, GSTR-3B, and Sales reports ready for JSON/Excel download. Direct one-click filing to the official GST portal requires an active GSP (GST Suvidha Provider) license and production API keys from GSTN.
- **Status:** By design for Phase 1. Users export standard GSTR returns from Bazaar-Guru and upload them directly to `gst.gov.in`.

---

### Issue 3: In-Memory Browser Storage Flush on Sign Out
- **Severity:** Informational
- **Description:** IndexedDB caching retains recent company records for fast load times. Upon clicking "Sign Out", memory caches are cleared. In multi-user shared workstation scenarios, users are advised to close their browser session to guarantee zero residual client cache.
