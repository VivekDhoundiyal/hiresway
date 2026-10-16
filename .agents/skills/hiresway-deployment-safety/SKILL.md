---
name: hiresway-deployment-safety
description: >-
  Use this skill whenever building, configuring, debugging, or executing deployments for HiresWay on Cloudflare Workers/Pages or GitHub. Enforces safe Git operations, asset verification, SPA fallback routing, and honest deployment status reporting.
---

# Skill H — Deployment & Release Safety

## Purpose
Ensure that HiresWay builds reliably, deploys without runtime or routing regressions, and preserves git history and user configurations across every release.

---

## Deployment Architecture

HiresWay is configured for **Cloudflare Workers Static Assets** (Assets-only Worker):

```text
[Repository origin/main]
           ↓
[Cloudflare Workers CI / Git Build]
           ↓
[Build Step: npm run build]
  ├── tsc compiles TypeScript
  └── vite build outputs static assets to ./dist
           ↓
[Deploy Step: npx wrangler deploy]
  ├── Reads wrangler.jsonc
  ├── Uploads static files from ./dist
  └── Configures "not_found_handling": "single-page-application"
           ↓
[Live Edge Hosting on *.workers.dev or custom domain]
```

---

## Critical Deployment Rules

### 1. `wrangler.jsonc` Integrity
- HiresWay must retain `wrangler.jsonc` at repository root:
  ```jsonc
  {
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "hiresway",
    "compatibility_date": "2024-09-23",
    "assets": {
      "directory": "./dist",
      "not_found_handling": "single-page-application"
    }
  }
  ```
- **Never delete or omit `assets.directory`**; doing so triggers Wrangler's automatic Vite 6 adapter and crashes the build.
- **Do not add a `/* /index.html 200` rule to `_redirects`**; it causes Cloudflare error `100324: Infinite loop detected`. Single-page application fallback is handled natively by `not_found_handling: "single-page-application"`.

### 2. Pre-Push Verification Checklist
Before pushing any commit to `main`:
1. Run `npm run build` locally and ensure it exits with code 0.
2. Confirm `dist/index.html` and `dist/assets/` are cleanly generated.
3. If Wrangler CLI is available, test the asset payload with:
   ```bash
   npx wrangler deploy --dry-run
   ```

### 3. Git Safety Rules
- **NEVER** use `git push --force` or `--force-with-lease` on production branches (`main`).
- **NEVER** run destructive git resets (`git reset --hard`) or discard uncommitted user changes.
- Check `.gitignore` before every commit to ensure `.env`, API credentials, and build logs are not tracked.
- A local build success is **not** a production deployment confirmation. Only report deployment success after Cloudflare confirms deployment and the live URL has been validated.
