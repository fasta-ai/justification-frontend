## Deploy commands

### Prerequisites

- gcloud CLI installed
- Service account key: `rugged-ether-470308-c1-c754b01170f1.json`

### Authentication

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:$PATH
gcloud auth activate-service-account \
  --key-file=../rugged-ether-470308-c1-c754b01170f1.json \
  --project=rugged-ether-470308-c1
```

### Important: Use pnpm, not npm

This project uses pnpm (`"packageManager": "pnpm@10.17.1"`).
**Do not run `npm install`** — it will create a lockfile mismatch between
`package-lock.json` and `pnpm-lock.yaml`, causing Cloud Build buildpacks to fail
with exit code 51.

Always use:
```bash
pnpm install
```

### Deploy

```bash
npm run build
gcloud run deploy justification-app \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated
```

### Pre-deploy checklist (learned the hard way)

1. **`lib/utils.ts` must point at production.** `NEXT_PUBLIC_API_URL` is
   baked into the build from the `BACKEND_IP` constant. Before deploying,
   confirm it reads `35.240.222.126` — a local/LAN IP left there ships to
   production and breaks every API call (happened in revision 00006).
2. **Lockfiles in sync.** Run `pnpm install --lockfile-only` (pnpm
   10.17.1) after any `package.json` change and commit `pnpm-lock.yaml`.
3. **Backend contract.** If this release uses new/changed backend
   endpoints (e.g. the tiered `POST /datasets/match`), deploy the backend
   first and smoke-test through the Cloud Run URL afterwards:
   ```bash
   curl -s -X POST https://justification-app-1018446741568.us-central1.run.app/api/datasets/match \
     -H "Content-Type: application/json" \
     -d '{"productName":"Powered Stairclimber","limit":2}'
   # Expected: {"tier":"exact", ...}
   ```

### Deployment History

| Date | Revision | Notes |
|------|----------|-------|
| 2026-05-23 | `justification-app-00002-msp` | Added `eg-upload` page, sidebar nav, type fixes. Build failed initially due to npm/pnpm lockfile mismatch; fixed by running `pnpm install` to sync lockfiles. |
| 2026-07-11 | `justification-app-00006-tjm` | Tiered similar-cases client, replace-from-similar, audit-log view, auth token refresh, `/api/proxy` SSRF route removed. **Broken**: a local-dev `BACKEND_IP` (192.168.31.234) was accidentally included and shipped — all API calls failed. Rolled forward to 00007. |
| 2026-07-11 | `justification-app-00007-z6b` | Same release with `BACKEND_IP` restored to `35.240.222.126`. Verified end-to-end through the Cloud Run URL. |

### Service URL

https://justification-app-1018446741568.us-central1.run.app
