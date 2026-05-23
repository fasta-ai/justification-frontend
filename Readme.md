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

### Deployment History

| Date | Revision | Notes |
|------|----------|-------|
| 2026-05-23 | `justification-app-00002-msp` | Added `eg-upload` page, sidebar nav, type fixes. Build failed initially due to npm/pnpm lockfile mismatch; fixed by running `pnpm install` to sync lockfiles. |

### Service URL

https://justification-app-1018446741568.us-central1.run.app
