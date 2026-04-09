

## Plan: Fix PPTX report generation

### Problems
1. **Build errors**: `pptx.write("arraybuffer")` uses wrong API — pptxgenjs v4+ expects `pptx.write({ outputType: "arraybuffer" })`.
2. **CORS error**: Firebase Storage blocks uploads from the preview domain. The `storage.ts` file uses Firebase Storage which isn't configured for CORS from this origin.
3. **Reportes page** uses Firestore subcollection `clientes/{id}/reportes` to list past reports — this depends on the upload succeeding.

### Solution
Remove Firebase Storage upload entirely. Instead:
- Generate PPTX and download directly in the browser via `pptx.writeFile({ fileName })` (already called but after the failing upload).
- Remove the `uploadReportePptx` calls and the `storage.ts` import from both `SimilitudDialog.tsx` and `ClienteDetalle.tsx`.
- Save report metadata to Firestore (without `downloadUrl`/`storagePath`) so the Reportes page can still list generated reports, or simplify Reportes to just show a "generate" action.
- Fix the `pptx.write("arraybuffer")` calls — since we're removing the upload, these lines get deleted entirely.
- Delete `src/lib/reports/storage.ts` (no longer needed).

### Files to change
1. **`src/components/SimilitudDialog.tsx`** — Remove `uploadReportePptx` import/call, keep only `pptx.writeFile({ fileName })`.
2. **`src/pages/ClienteDetalle.tsx`** — Same: remove upload call, keep `writeFile`.
3. **`src/lib/reports/storage.ts`** — Delete file.
4. **`src/pages/Reportes.tsx`** — Simplify to remove download URL references since files are downloaded directly. Could show a history log or placeholder.

