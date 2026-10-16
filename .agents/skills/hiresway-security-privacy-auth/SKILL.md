---
name: hiresway-security-privacy-auth
description: >-
  Use this skill whenever handling user authentication, credentials, file uploads (resumes, spreadsheets), third-party network requests, or untrusted external HTML/text in HiresWay. Enforces strict zero-leakage, input sanitization, and defense-in-depth security.
---

# Skill E — Security, Privacy & Authentication

## Purpose
Protect user privacy, prevent credential exposure, and guard HiresWay against injection, malicious file payloads, and unsafe external data transfers.

---

## Security Principles

### 1. Zero Secret Exposure
- Never hardcode or bundle private API keys, service tokens, or private user passwords into client-side code, git history, or build output.
- All `.env` files and local credential overrides must be kept out of version control via `.gitignore`.
- Vite client variables (`VITE_*`) must ONLY contain public, non-sensitive endpoints.

### 2. Untrusted Input Sanitization
Treat all the following as **untrusted user input**:
- Resumes uploaded by the user (`.pdf`, `.docx`, `.txt`) parsed via `pdfjs-dist` or `mammoth`.
- Spreadsheets imported via `xlsx`.
- Scraped job descriptions and company websites.
- Direct user text input in cover letter and outreach editors.

**Rules:**
- Never render raw untrusted strings with `dangerouslySetInnerHTML` without rigorous DOM sanitization.
- Sanitize external URLs before rendering them as `<a href="...">` to prevent `javascript:` pseudoprotocols. Only allow `http:`, `https:`, and `mailto:`.

### 3. Client-Side Data Privacy
- HiresWay stores sensitive career profiles, notes, and application records.
- All data resides strictly in local browser storage (`IndexedDB`) unless the user explicitly configures an export or sync destination.
- Never transmit user profile data, resumes, or application history to unauthorized third-party telemetry or unverified endpoints.

### 4. Verified Security Controls Only
- Never state that "End-to-End Encryption" or "Role-Based Access Control" is active unless real cryptographic libraries or authorization handlers are demonstrably implemented and tested.
