# HiresWay — Production Build & Deployment Guide

## Overview
HiresWay is built with Vite and React 18, packaged into a highly optimized static bundle in the `dist` directory, and configured for deployment to **Cloudflare Pages**.

---

## Build Process

### 1. Compile TypeScript & Bundle Assets
```bash
npm run build
```
This runs `tsc && vite build`, outputting:
- `dist/index.html`
- `dist/assets/*.js` and `dist/assets/*.css`
- Static images & icons
- `dist/_redirects` (ensuring SPA client-side routes such as `/dashboard` and `/job-feed` resolve to `index.html` on refresh)

### 2. Output Verification
- Verify `dist/_redirects` contains:
  ```text
  /*    /index.html   200
  ```

---

## Cloudflare Pages Deployment

### Option A: Cloudflare CLI (`wrangler`)
```bash
# Authorize or set environment variable
$env:CLOUDFLARE_API_TOKEN = "<YOUR_TOKEN>"

# Deploy to existing Cloudflare Pages project
npx wrangler pages deploy dist --project-name "<PROJECT_NAME>"
```

### Option B: Git-Integrated Automated Deployment
If your Cloudflare Pages project is connected to a GitHub repository:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`
- Push your changes to the connected production branch (`main`).
