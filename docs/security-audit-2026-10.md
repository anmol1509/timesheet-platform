# Security, Data Protection & IP Protection Audit

**Scope:** `anmol1509/timesheet-platform` at commit `353a40d` (branch `main` / `claude/stoic-archimedes-8cxmzx`)
**Date:** 2026-10-13
**Stack:** Next.js 16.3.6 (App Router, `src/proxy.ts`), React 19, Prisma 7 / PostgreSQL, `jose` JWTs, Vercel hosting, Anthropic API, Twilio, Resend.

**Method:** I read the code by hand: `src/proxy.ts`, `src/lib/{auth,session,permissions,branch,password,passwordReset,rateLimit,uploads,attachments,storedImage,duplicateCheck}.ts`, the ESS and vendor portal auth (`src/lib/ess/*`, `src/lib/vendor/*`), the public API (`src/lib/api/*`, `src/app/api/v1`), the webhooks (`src/lib/webhooks/*`), all 63 `route.ts` handlers and the seed scripts. All 321 exported server actions were sorted by the guard they call. I also ran these checks:

- a production build (`next build --webpack`), then a look through the client chunks for source maps and business logic;
- `next start` with a forged session, to test URL-encoding bypasses of the path-based permission gate;
- `npm audit --omit=dev`.

No live database or production environment was used, so findings that depend on production data say so.

---

## 1. Executive Security Summary

| Area | Posture |
|---|---|
| Authentication (staff, ESS, vendor) | **Good basics, weak session lifecycle.** scrypt hashing, constant-time compares, OTP limits and DB re-checks on every request are all done well. But a staff JWT lasts 30 days and cannot be revoked: logout, a password change and a password reset all leave old tokens valid. There is no MFA. |
| Tenant isolation (Branch = customer company) | **Mostly good, with real gaps.** Server actions consistently check `isOutsideBranch` / `assert*InBranch`. Several **file-serving API routes and one shared helper skip the branch check**, which leaks documents, signatures/stamps and identity numbers across tenants. |
| Role-based access (module × action RBAC) | **Fragile by design.** 103 of 113 pages and many actions rely only on a gate driven by the URL path (`x-pathname`). It works for normal navigation, but it fails open when the header is missing, and some admin-only areas (Audit Log, Lookups) are open to every STAFF user. |
| Injection | **Good.** All DB access goes through Prisma. The raw SQL uses `Prisma.sql` with hard-coded identifiers. Letter HTML is sanitised with an allowlist. No SQL injection was found. |
| XSS | **One serious hole.** Uploaded files are stored with the browser-supplied MIME type and served **inline, without `nosniff`**, on the app origin. That is stored XSS. There are no security headers at all (CSP, frame-ancestors, HSTS). |
| Public API (`/api/v1`) | **Strong.** Keys are hashed and scoped, every query is pinned to the key's branch, responses use explicit field allowlists, pages are capped at 200 rows and each key is limited to 120 requests a minute. Treat it as the reference pattern for the rest of the app. |
| Secrets / config | **Good.** No secrets in the repo or its history, and `.env*` is ignored. Two problems: the seed creates a **default super-admin password if `SEED_ADMIN_PASSWORD` is unset**, and one secret (`SESSION_SECRET`) is used for five different purposes. |
| Dependencies | **Needs an upgrade.** `next@16.3.6` has 6 advisories (cache poisoning, draft-mode leak and others), fixed in 16.3.8 / 16.4.0. There are also transitive highs (sharp, fast-uri, brace-expansion…). |
| IP / anti-copying | **Reasonable for SaaS, but nothing beyond hosting.** The core engines (payroll, gratuity, WPS/SIF, settlement, importer AI) are server-only, and the production build has no source maps (verified: 0 `.map` files). There is no licence or domain locking, no watermarking of exports, no per-user export quotas, no `server-only` guard against accidentally bundling server logic, and `X-Powered-By: Next.js` is advertised. |

**Overall:** **Medium-High risk.** The architecture is sound. The problems are a small number of concrete, fixable gaps, mostly in file handling and in the implicit RBAC gate, that add up to stored XSS → admin takeover and cross-tenant document and PII leakage. Fixing the items in §2 removes most of the risk; a week of focused work should cover them.

### Severity table

| ID | Finding | Severity |
|---|---|---|
| C1 | Stored XSS via uploaded files served inline with attacker-chosen `Content-Type` | **Critical** |
| C2 | Cross-tenant IDOR on client and project document downloads | **High → Critical** (impact critical, needs a document id) |
| C3 | Default super-admin credentials in a seed that runs against production | **Critical *if present*** (verify) |
| H1 | Cross-tenant PII oracle in the duplicate check (passport / Emirates ID / IBAN / mobile) | High |
| H2 | Cross-tenant access to stored images (company **signatures, stamps**, letterheads) | High |
| H3 | Module RBAC enforced implicitly by URL path; fails open; admin pages open to STAFF | High |
| H4 | Non-revocable 30-day sessions; no MFA; single shared secret | High |
| H5 | No security headers (CSP, clickjacking, HSTS) | High |
| H6 | `next@16.3.6` with 6 published advisories | High |
| M1–M8 | Rate limiting, reset-link host poisoning, plaintext PII at rest, AI data processing, etc. | Medium |
| L1–L7 | Header quoting, non-constant-time cron compare, negative deductions, etc. | Low |

---

## 2. Critical Vulnerabilities & Immediate Fixes

### C1 — Stored XSS through uploaded documents (Critical)

**Where**

| Upload (MIME type is not validated, `file.type` is stored as-is) | Served by (inline, stored type, **no `nosniff`**) |
|---|---|
| `src/app/(app)/clients/actions.ts:302` `addClientDocumentAction` | `src/app/api/client-documents/[id]/route.ts:20-25` |
| `src/app/(app)/projects/actions.ts:286` `addProjectDocumentAction` | `src/app/api/project-documents/[id]/route.ts:20-25` |
| `src/lib/attachments.ts:65` `uploadAttachmentAction` (suppliers, bills, expenses, onboarding) | `src/app/api/attachments/[id]/route.ts:23-28` |
| `src/app/(app)/suppliers/new/actions.ts:84` | `src/app/api/attachments/[id]/route.ts` |

The vendor portal uploads (`src/app/vendor/(portal)/*/actions.ts`) do check an `ALLOWED` list. The employee `Document` route uses `contentDispositionFor()` from `src/lib/uploads.ts`, which is safe. So the correct pattern already exists in the codebase; these four paths just don't use it.

**Attack:** a low-privilege STAFF user (anyone with write access to Clients, Projects, Onboarding, Finance or Suppliers) uploads `contract.html` with `Content-Type: text/html`. When a branch admin or the **platform super admin** (who sees every tenant) opens the attachment, the script runs on the app origin with the victim's session cookie attached. The cookie is `httpOnly`, but the script doesn't need to read it: it can call any server action or API as the victim. For example it can:

- create an API key with `employees:pii` and `payroll:read`;
- change a worker's WPS IBAN;
- create a new admin user;
- read every tenant's data, if the victim is a super admin.

**Fix (all four routes and all four upload paths):**
1. Validate on upload by sniffing the magic bytes, and store a canonical MIME type (snippet §6.1).
2. Serve every stored file through `contentDispositionFor()`, and add `Content-Security-Policy: sandbox` to every file response (§6.2). With that header, an HTML file can't run script even if one slips through.
3. Clean up existing rows: `UPDATE "ClientDocument" SET "mimeType"='application/octet-stream' WHERE "mimeType" NOT IN (...allowlist...)`, and the same for `ProjectDocument` and `Attachment`.

### C2 — Cross-tenant IDOR on client and project documents (High → Critical)

**Where:** `src/app/api/client-documents/[id]/route.ts` and `src/app/api/project-documents/[id]/route.ts`

```ts
const doc = await prisma.clientDocument.findUnique({ where: { id } });   // no branch check
```

Any signed-in user of **any tenant** who has the `view` permission on Clients or Projects in their own tenant can download another tenant's contracts, trade licences, TRN certificates, LPOs and permits, given the document id. CUIDs are hard to guess, but ids leak through the following:

- audit-log entries (`entityId`);
- URLs in browser history and `Referer` headers;
- shared links;
- support tickets.

Every other file route (`documents`, `attachments`, `upload`, `employees/[id]/photo`) has the check. These two were missed.

**Fix:** join through the parent record and apply `isOutsideBranch` (snippet §6.2).

### C3 — Default super-admin credentials (Critical if present; verify now)

**Where:** `prisma/seed.ts:12-26`

```ts
const email = process.env.SEED_ADMIN_EMAIL ?? "demo@manpowersync.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
...
console.log(`Created super admin user ${email} / ${password}`);
```

The comment on line 39 says *"this seed also runs against production"*. If it ever ran without `SEED_ADMIN_PASSWORD`, production has a `SUPER_ADMIN` with a well-known password, and that password is also printed to the deploy logs.

**Immediate action:**
1. Check production: `SELECT id, email, "createdAt" FROM "User" WHERE role='SUPER_ADMIN';`. Rotate the password of any seed-created account, and check `AuditLog` for activity by it.
2. Make the seed refuse to run with a default in production (snippet §6.7).

---

## 3. High-Severity Findings

### H1 — Cross-tenant identity oracle in the duplicate check

**Where:** `src/lib/duplicateCheck.ts:13-41` (`employeeDuplicates`). It is called from:

- `employees/[id]/actions.ts:273`
- `employees/new/actions.ts:317`
- `onboarding/add-employee-actions.ts:78`

The query searches **all** `Employee` rows with no `branchId` filter. It returns *"This Emirates ID already belongs to **{name} ({employee code})**"* to the user. Anyone who can create or edit an employee can therefore test any passport, Emirates ID, mobile number or IBAN against every customer company on the platform and get back the holder's name and employer code. This is a personal-data disclosure under UAE PDPL / GDPR-style rules.

The vendor portal already avoids exactly this leak: `vendor/(portal)/workers/actions.ts:50-55` has the comment *"Searching every tenant would tell a supplier…"*. `partnerDuplicates` in the same file is branch-scoped too.

**Fix:** pass `branchId` and add `AND "branchId" = ${branchId}`, the same way `partnerDuplicates` does (§6.5). If you need platform-wide fraud detection (the same IBAN at two companies), run it as a **super-admin-only** report, never as a warning shown to tenant users.

### H2 — Stored images readable across tenants (signatures and stamps)

**Where:** `src/app/api/images/[id]/route.ts`. Any signed-in user can fetch any `StoredImage` by id. That table holds avatars and logos, but also **`Branch.signature`, `Branch.stamp`, `Branch.letterheadImage`, `Supplier.signature` and `Supplier.stamp`**. A company's authorised signature and seal let someone forge letters, NOCs and salary certificates. The response is also cached for a year (`max-age=31536000, immutable`), so a revoked image stays in browser caches.

**Fix:** resolve who owns the image (user, branch or supplier relation) and apply the branch check. Serve signatures and stamps only to admins of that branch, since only PDF generation needs them, and that happens server-side.

### H3 — RBAC enforced implicitly by URL path

**Design (`src/lib/auth.ts:35-46`):** `proxy.ts` stamps `x-pathname`, and `isBlockedByPermissions()` maps the path to a module. 103 pages call only `requireUserWithBranch()`, so the path→module table *is* the access control.

**Verified:** I ran a production build with a forged session against encoded and odd paths (`/%70ayroll`, `/pay%72oll`, `/payroll%2F`, `/%2Fpayroll`, `/payroll;x`). They all return 404, so **no URL-encoding bypass was found**. The weaknesses are structural:

1. **Fail-open.** `if (!pathname) return false;` (`auth.ts:37`). Any request that doesn't pass through the proxy's stamping branch is treated as allowed. That covers excluded matchers, the public, `/me` and `/vendor` branches, and future changes to the matcher.
2. **Paths outside every module are open to everyone.** `moduleForPath()` returns `null` for `/audit-log`, `/lookups`, `/approvals`, `/drafts`, `/import` and `/data-health`, so those pages must gate themselves. Two don't:
   - **`/audit-log`** (`src/app/(app)/audit-log/page.tsx:21`): any STAFF user, even one whose role is limited to "Camp manager", sees the last 500 audit entries for the whole branch. That includes before/after values of employee changes. Only pay fields are redacted. The permission model says the Audit Log is admin-only (`permissions.ts:12`); the CSV export route enforces that, but the page doesn't.
   - **`/lookups`** (`src/app/(app)/lookups/page.tsx`, `lookups/actions.ts`): any STAFF user can create, deactivate or delete branch master data, which is also documented as admin-only.
3. **Server actions inherit the permissions of whichever page they are invoked from.** An action ID that is imported by more than one page runs under the gate of whichever page you POST to. Example: `deleteAttachmentAction` (`src/lib/attachments.ts`) is imported by the Onboarding page. A user with Onboarding write access can delete **any** attachment in the branch, including supplier bills and expense receipts, because the action checks only the branch, not the attachment's entity type. Action IDs are public in the static chunks (verified: `createServerReference("60d6a2…")` in `/_next/static/chunks/*`, served with no auth), so anyone can craft these requests.

**Fix:**
- Make the gate fail closed.
- Give every page and action an **explicit** `requireView` / `requireWrite` / `requirePermission(target, action)` call.
- Add a CI check that fails when a `"use server"` export or a `page.tsx` has no explicit guard (§6.3).

### H4 — Session management

**Where:** `src/lib/session.ts`.

- **30-day HS256 JWT, stateless.** `clearSessionCookie()` on logout only deletes the browser's copy. A stolen or copied token keeps working for 30 days through logout, **password change** (`profile/actions.ts`), **admin password reset** (`settings/team/actions.ts`) and **email reset** (`login/reset-actions.ts`). Suspension (`isActive=false`) is enforced, which is good.
- *Remember me: off* produces a session cookie, but the JWT inside still has a 30-day `exp`.
- **No MFA** for SUPER_ADMIN or BRANCH_ADMIN accounts, which can mint API keys, export payroll and change IBANs.
- **One secret, five uses.** `SESSION_SECRET` signs staff, ESS and vendor JWTs, keys the OTP HMAC (`ess/otp.ts:14`) and derives the webhook encryption key (`webhooks/crypto.ts`). Token types are told apart only by the claims they carry (`userId` vs `kind`), with no `aud` / `typ`. One leak compromises everything, and rotating the secret breaks webhooks.

**Fix:**
- Add a `sessionVersion` column and check it per request (§6.4).
- Use a 12h absolute / 2h idle lifetime with sliding renewal.
- Add TOTP or WebAuthn for admins.
- Derive a separate key per purpose with HKDF, and set `aud` on each token type.

### H5 — No HTTP security headers

Verified against `next start`: the response has `X-Powered-By: Next.js` and **no** CSP, `X-Frame-Options` / `frame-ancestors`, HSTS, `Referrer-Policy` or `Permissions-Policy`. `next.config.ts` has no `headers()` and `vercel.json` has no `headers` either.

Consequences:

- **Clickjacking** works on approval and payroll buttons.
- Nothing limits the damage of an XSS such as C1.
- Tokens in URLs (`/login/reset?token=…`) can leak through `Referer`.

**Fix:** §6.6.

### H6 — Vulnerable dependencies

`npm audit --omit=dev` reports 15 issues (12 high, 3 moderate):

- **`next@16.3.6`** (direct): GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv, GHSA-f87g-xv8r-7p7x, GHSA-mcj8-r9mp-w47p, GHSA-cjq9-62q9-8jv4. Fixed in **≥16.3.8** (non-breaking `16.4.0` is available).
- Transitive: `sharp <0.35.5`, `fast-uri`, `brace-expansion`, `deepmerge-ts`, `nanoid`, `source-map-js`; and `uuid` via `exceljs`. `mysql2` comes in via `@prisma/dev` (dev tooling, not runtime).

**Fix:**
1. `npm i next@^16.4.0 eslint-config-next@^16.4.0`, then `npm audit fix`.
2. Turn on Dependabot or Renovate.
3. Add `npm audit --omit=dev --audit-level=high` to CI.

---

## 4. Data Privacy & Access Control Hardening

### 4.1 Multi-tenant isolation (Branch = customer company)

**What's already right:** branch scoping in server actions is consistent. I scanned every server action that updates or deletes by id and found none without a branch, ownership or self check. The public API pins every query to the key's branch, and the portals re-check `portalEnabled` / `essEnabled` on every request.

**Recommendations:**

1. **Fix C2, H1 and H2**, the three places where the branch check is missing.
2. **Fail closed when a non-super user has no branch.** `branchWhere(null)` returns `{}` (all branches). A STAFF or BRANCH_ADMIN with `branchId = null` would therefore see every tenant. Today that only happens through data errors, but it should be impossible. Guard it in `requireUserWithBranch()`:
   ```ts
   if (!isSuperAdmin && !user.branchId) redirect("/no-access");
   ```
3. **Add PostgreSQL row-level security as a second line of defence.** Set `app.branch_id` per transaction from a Prisma client extension, and add RLS policies on the tables that have a `branchId`. Then a missed `where` clause returns zero rows instead of another tenant's data.
4. **Add tenant-isolation tests.** For each `[id]` route and each action that takes an id, assert that a user from branch B gets 404 / an error for a branch-A record. The `src/lib/*.test.ts` harness already exists.

### 4.2 Sensitive data at rest

- Passport numbers, Emirates IDs, labour-card numbers, **WPS IBANs** and salaries are stored as plaintext columns. Identity-document scans are stored as `bytea` in the main database (`Document.fileData`, `Attachment.fileData`). Recommendations:
  - **Field-level encryption** (AES-256-GCM, with a KMS-held key that is *not* `SESSION_SECRET`) for `passportNumber`, `emiratesId`, `wpsIban`, `laborCardNumber` and `dateOfBirth`. Store a keyed HMAC alongside each for equality search (the duplicate checks).
  - Move file blobs to object storage (S3 / R2 / Vercel Blob) with SSE-KMS, private buckets and short-lived signed URLs. Database dumps and backups then stop containing every passport scan.
  - Confirm that database storage encryption and backup encryption are on with the Postgres provider.
- **IBAN change control:** changing a worker's `wpsIban` is the classic payroll-fraud move. Require a second approver (or at least notify the employee by SMS/ESS) when bank details change. Today the duplicate warning is the only control.

### 4.3 Third-party processing (AI)

Passport, visa and Emirates ID scans, receipts and timesheets go to the Anthropic API for extraction. These are sent from `api/documents/extract*`, `api/import/documents/*`, `api/expenses/extract-receipt` and the importer copilot.

- Make sure a DPA is in place and that the customer contracts / privacy notice list the AI sub-processor and the data location (relevant under UAE PDPL Art. 22-23 cross-border rules).
- Offer a **per-tenant switch** to turn AI extraction off.
- Log which records were sent (who, when, which document).

### 4.4 Secure session handling

See H4. In addition, keep `SameSite=Lax`, `HttpOnly` and `Secure` as they are now, and add the `__Host-` prefix to the cookie names (`__Host-session`, which forces `Path=/` and no `Domain`).

### 4.5 Medium-severity items

| ID | Finding | Where | Fix |
|---|---|---|---|
| M1 | **Rate limiting is in memory, per serverless instance.** Login has a per-email lockout (shared through the DB), but **no per-IP throttle**: credential stuffing across many emails is unthrottled, and the per-email lockout lets anyone lock a known admin out for 15 minutes. | `src/lib/rateLimit.ts`, `src/app/login/actions.ts` | Move to Redis/Upstash or a Postgres-backed limiter. Add a per-IP limit plus exponential back-off; consider CAPTCHA after N failures; use Vercel Firewall rate-limit rules on `/login` and `/api/*`. |
| M2 | **Public `POST /api/demo-requests`** has no rate limit or CAPTCHA, so it can be used to spam the DB and flood the sales inbox. | `src/app/api/demo-requests/route.ts` | Per-IP limit, Turnstile/hCaptcha, honeypot field. |
| M3 | **Reset links built from the `Host` header** when `NEXT_PUBLIC_APP_URL` is unset, which allows reset-link poisoning. | `src/app/login/reset-actions.ts:48` | Require `NEXT_PUBLIC_APP_URL` in production (throw if missing); never derive links from request headers. |
| M4 | **`deleteAttachmentAction` / `uploadAttachmentAction`** don't check module permission against the attachment's `entityType`, and they pass a client-supplied `revalidate` path to `revalidatePath`. | `src/lib/attachments.ts` | Map `entityType` → permission target and call `requirePermission(target, "delete" \| "create")`. Accept `revalidate` only from an allowlist of prefixes. |
| M5 | **Password policy:** minimum 8 characters, no breached-password check, no forced change of temporary passwords set by admins. | `settings/team/actions.ts`, `profile/actions.ts` | 12+ characters, an HIBP k-anonymity check, and a `mustChangePassword` flag. |
| M6 | **Insider bulk export:** `/api/audit-log/export` returns up to 50,000 rows; payroll, finance and deployment CSV exports have no quota and no per-user alerting. | `src/app/api/*/export` | Per-user daily export quota; audit *every* export (payroll does, most others don't); alert admins on unusual volume. |
| M7 | **Plaintext PII and documents at rest.** | see 4.2 | see 4.2 |
| M8 | **AI sub-processor disclosure / opt-out.** | see 4.3 | see 4.3 |

### 4.6 Low-severity items

| ID | Finding | Where |
|---|---|---|
| L1 | `Content-Disposition: filename="${raw filename}"` isn't sanitised (quote injection; a CR/LF makes the response throw). | `api/client-documents`, `api/project-documents`, `api/attachments`, `api/upload/[id]/download` |
| L2 | Cron bearer token compared with `!==` (not constant time). | `api/cron/*/route.ts` |
| L3 | JWTs have no `aud`/`iss`/`typ`; the token type is inferred from the shape of its claims. | `session.ts`, `ess/token.ts`, `vendor/token.ts` |
| L4 | `/api/generate` accepts negative `deductions` / `gasDeductions` (`z.number()`), so a "deduction" can *raise* pay on a generated timesheet. | `src/app/api/generate/route.ts:20-21` |
| L5 | Login timing reveals whether an account exists (scrypt runs only for known emails). | `src/app/login/actions.ts:35` |
| L6 | `X-Forwarded-For` is trusted for the OTP and reset IP limits. That is fine on Vercel, which overwrites the header, but it becomes spoofable behind any other proxy. | `ess/otp.ts`, `reset-actions.ts`, `api/auth.ts` |
| L7 | The ESS logo route and the images route serve the stored `mimeType`; it's safe today because images are magic-byte sniffed, but the routes don't enforce it themselves. | `me/logo`, `api/images` |

---

## 5. Anti-Copying & IP Defense Recommendations

### 5.1 What a competitor can see today (verified against a production build)

| Asset | Exposure |
|---|---|
| Payroll engine, gratuity / EOSB, WPS SIF writer, final settlement, pay-days logic, importer and AI prompts, document extraction prompts | **Server-only. Not in client chunks.** Only UI labels appear (e.g. "Monthly basic for gratuity (AED)"). |
| Source maps | **None shipped** (`find .next/static -name '*.map'` → 0). |
| Client chunks (8.7 MB) | Downloadable **without logging in** from `/_next/static/chunks/*`. They contain the UI and the form schemas, and also: the full permission matrix and role presets (`lib/permissions.ts`); absent/gas deduction formulas (`lib/deductions.ts`, used by `companies/[id]/generate/review-client.tsx`); onboarding stages; compliance rules; finance constants; approval-limit logic; the importer column keys; all **server action IDs**. |
| Framework fingerprint | `X-Powered-By: Next.js` header. |
| Data schema | Only exposed through the authenticated UI and the scoped public API (which uses explicit field allowlists, so it's good). |

### 5.2 Keep proprietary logic server-side

1. **Add the `server-only` package and import it at the top of every module that holds proprietary logic or secrets.** That means `payroll*.ts`, `gratuity.ts`, `settlement.ts`, `wps.ts`, `payDays*.ts`, `importer/**`, `assistant*.ts`, `api/**`, `webhooks/**`, `db.ts`, `notifications/**` and `ess|vendor/session.ts`. Any future accidental client import then **fails the build** instead of quietly shipping the code. No file in the repo uses it today.
   ```ts
   // src/lib/payroll.ts
   import "server-only";
   ```
2. **Move the client-side calculations to the server.** `calculateAbsentDeduction` / `calculateGasDeduction` run in the browser, and the server then trusts the numbers it is sent (L4). Have the review screen call a server action that returns the computed deductions, keep only display code on the client, and re-validate bounds on save.
3. **Split constants from logic.** Where a client component needs a label list (e.g. `payItems.ts` categories, `payables.ts` status labels), put just those constants in `*.labels.ts` files so the rest of the module can't be pulled into the bundle.
4. **Don't send the full permission matrix to every client.** Send the computed `viewableModules(subject)` list to the shell. Only the Roles editor (admins only) needs `MODULES` / `ROLE_PRESETS`.
5. **Obfuscation:** for a hosted SaaS I *don't* recommend JavaScript obfuscators (javascript-obfuscator etc.). They slow the app down, break React/RSC tooling, and are reversible. The value is in the server-side engines and the data, and those are already off the client. Minification (on by default) plus no source maps plus keeping logic server-side is the right trade-off.

### 5.3 Production build hardening

```ts
// next.config.ts (additions)
const nextConfig: NextConfig = {
  poweredByHeader: false,               // drop "X-Powered-By: Next.js"
  productionBrowserSourceMaps: false,   // explicit; default today, but pin it
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      allowedOrigins: ["login.manpowersync.com"], // explicit CSRF origin allowlist
    },
  },
  async headers() { return securityHeaders; },   // see §6.6
};
```

- **Error monitoring:** if you add Sentry or similar, upload source maps to the monitoring service and **delete them from the deploy output** (`hideSourceMaps: true` / `sourcemaps.deleteSourcemapsAfterUpload: true`).
- **Environment protection:**
  - Mark `SESSION_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `TWILIO_*`, `RESEND_API_KEY` and `CRON_SECRET` as **Sensitive** in Vercel (write-only).
  - Give Preview deployments a **separate** database and secrets.
  - Turn on **Vercel Deployment Protection** for preview URLs, which otherwise expose a full working copy of the app.
- **Fail fast on missing config:** at startup (e.g. in `instrumentation.ts`), throw in production if `SESSION_SECRET` is shorter than 32 bytes, or if `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` or `DATABASE_URL` is missing.
- **Only `NEXT_PUBLIC_APP_URL` reaches the client.** I checked this. Keep it that way, with a lint rule that rejects new `NEXT_PUBLIC_*` names except from an allowlist.

### 5.4 API access controls & anti-scraping

The public `/api/v1` is already well designed. Bring the internal surface up to the same standard:

1. **Global edge rate limits (Vercel Firewall / WAF):**
   - `/login`, `/me/login`, `/vendor/login`: 10/min per IP;
   - `/api/*`: 300/min per IP;
   - `/api/*/export`, `/api/payroll/*`: 20/hour per user;
   - turn on **Bot Protection / Attack Challenge Mode** for the marketing host.
2. **Move `rateLimit()` to a shared store** (Upstash Redis `@upstash/ratelimit`) so limits hold across instances. Add per-user budgets on `/api/search` (cheap to call, and useful for enumeration), on the PDF generators (CPU-heavy) and on all exports.
3. **Export controls:**
   - require the `export` permission explicitly;
   - write an `AuditLog` entry for **every** export: user, filters, row count, IP;
   - set a daily row quota per user;
   - send admins a notification when it is exceeded.
4. **Watermark exports and generated documents:**
   - *Visible:* a PDF footer "Generated for {tenant} by {user} · {timestamp} · ref {exportId}".
   - *Invisible:* set the PDF `/Producer` and `/Keywords` metadata to a signed export id (`@react-pdf/renderer` supports `<Document keywords=…>`). For CSV/XLSX, add a hidden sheet or trailing metadata row with an HMAC of `{tenant, user, ts}`.
   - Leaked files can then be traced to the account that exported them.
5. **Canary / honeytoken records:** seed each tenant with a few unique fake employees and suppliers, plus a webhook or alert when they show up in an API response, an export or an external search. These detect bulk exfiltration and a cloned dataset.
6. **Keep Developers / API keys admin-only and plan-gated** (as today), and add key IP-allowlisting as a Pro feature.

### 5.5 Licensing, domain locking & unauthorised hosting

**There is no licence-key validation, domain locking or watermarking of the deployment in the codebase today.** For a SaaS that only you host, that is acceptable: the protection is that the code never leaves your infrastructure. It becomes essential if you ever:

- ship on-prem or private-cloud builds to customers;
- give source code to contractors or resellers;
- or are worried about a leaked repo or Vercel project being stood up elsewhere.

Recommended layers:

1. **Host allowlist in the proxy.** It also protects against Host-header attacks such as M3.
   ```ts
   const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? "").split(",").filter(Boolean);
   if (process.env.NODE_ENV === "production" && ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(request.headers.get("host") ?? "")) {
     return new NextResponse("Unlicensed host", { status: 421 });
   }
   ```
2. **Signed licence file for any distributed build.** Use an Ed25519-signed JSON, checked at boot and daily, containing `{ licensee, allowedHosts, maxBranches, maxEmployees, features, expiresAt }`. The **public** key is compiled into the build and the private key stays with you. If the licence is invalid or expired, the app goes read-only rather than stopping hard, to avoid data-loss disputes.
3. **Optional phone-home:** a daily call to a licence endpoint reporting the host, version and counts. That detects clones and enables remote revocation.
4. **Build fingerprinting:** inject `BUILD_ID` and a per-customer `LICENSEE_ID` at build time (`env` in `next.config.ts`). Embed them in PDF metadata and HTTP response headers (e.g. `X-Build: …`), so any copy you find can be attributed.
5. **Legal layer:** add a proprietary `LICENSE` file (the repo has none) and a copyright header in source files. Put NDA and IP-assignment terms in contractor agreements.

### 5.6 Source repository & supply chain

- Keep the GitHub repo **private**, enable **branch protection** on `main` (required reviews and status checks), **secret scanning + push protection**, **Dependabot**, and add a `CODEOWNERS` entry for `src/lib/{auth,session,permissions,branch}.ts`, `src/proxy.ts` and `prisma/`.
- Review who has access to the GitHub org, the Vercel team, the database console and the Anthropic/Twilio/Resend accounts. Rotate `SESSION_SECRET` (with a migration plan for webhook secrets) when someone with access leaves.
- Pin GitHub Actions to commit SHAs if you add CI. Run CI on `npm ci` with `--ignore-scripts` where possible (there is a `postinstall` hook).

---

## 6. Remediation Code Snippets

### 6.1 One upload validator, used everywhere (fixes C1 at write time)

```ts
// src/lib/uploads.ts — add
import "server-only";

/** Real type from magic bytes. Anything we can't positively identify is refused. */
export function sniffUpload(buf: Buffer): string | null {
  const s = (o: number, sig: number[]) => sig.every((b, i) => buf[o + i] === b);
  if (s(0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";                  // %PDF
  if (s(0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (s(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (s(0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (s(0, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString().startsWith("ftyphei")) return "image/heic";
  if (s(0, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";                  // .docx / .xlsx container
  if (s(0, [0xd0, 0xcf, 0x11, 0xe0])) return "application/x-ole";                 // legacy .doc / .xls
  return null;
}

const OFFICE_CONTAINER: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/zip",
  "application/msword": "application/x-ole",
  "application/vnd.ms-excel": "application/x-ole",
};

/** Validates a File and returns { buffer, mimeType, filename } safe to store, or an error message. */
export async function acceptUpload(file: File, maxBytes: number):
  Promise<{ ok: true; buffer: Buffer; mimeType: string; filename: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > maxBytes) return { ok: false, error: "That file is too large." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffUpload(buffer);
  let mimeType: string | null = null;
  if (sniffed && INLINE_SAFE.has(sniffed)) mimeType = sniffed;
  // Office documents: keep the declared office type only when the bytes are the matching container.
  else if (sniffed && OFFICE_CONTAINER[file.type] === sniffed) mimeType = file.type;
  if (!mimeType || !isAcceptedUploadType(mimeType)) {
    return { ok: false, error: "Upload a PDF, image, Word or Excel file." };
  }
  return { ok: true, buffer, mimeType, filename: safeFilename(file.name) };
}
```

The key rule is that **the stored `mimeType` comes from the server-side allowlist and the file's bytes, never from `file.type` alone.**

Then use it in each of the four upload paths, for example:

```ts
// src/app/(app)/clients/actions.ts — addClientDocumentAction
const accepted = await acceptUpload(file, MAX_UPLOAD_BYTES);
if (!accepted.ok) return { error: accepted.error };
await prisma.clientDocument.create({
  data: { clientId, type, filename: accepted.filename, fileData: accepted.buffer, mimeType: accepted.mimeType, expiryDate, uploadedById: user.id },
});
```

### 6.2 Safe, tenant-checked file serving (fixes C1 at read time, plus C2)

```ts
// src/lib/uploads.ts — strengthen the shared header builder
export function contentDispositionFor(mimeType: string, filename: string) {
  const safe = safeFilename(filename);
  const inline = INLINE_SAFE.has(mimeType);
  return {
    "Content-Type": isAcceptedUploadType(mimeType) ? mimeType : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "X-Content-Type-Options": "nosniff",
    // Even if something hostile is stored, it can't run script or reach our origin.
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; plugin-types application/pdf",
    "Cache-Control": "private, no-store",
  };
}
```

```ts
// src/app/api/client-documents/[id]/route.ts — replacement
import { NextResponse } from "next/server";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { contentDispositionFor } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("partners.clients", "view");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const doc = await prisma.clientDocument.findUnique({
    where: { id },
    include: { client: { select: { branchId: true } } },
  });
  // Same 404 for "missing" and "another tenant's", so ids can't be probed.
  if (!doc || isOutsideBranch(doc.client.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(doc.fileData), { headers: contentDispositionFor(doc.mimeType, doc.filename) });
}
```

Apply the same change to `project-documents/[id]` (join `project.branchId`, target `projects.projects`), to `attachments/[id]` (it already has the branch check; swap in `contentDispositionFor`), to `upload/[id]/download` and to `vendor/(portal)/files/[id]`.

### 6.3 Fail-closed, explicit authorisation

(The CI guard below deliberately fails on today's code: about 60 actions rely only on `requireUserWithBranch()` and the path gate. Treat that failing list as the migration backlog.)

```ts
// src/lib/auth.ts
export async function isBlockedByPermissions(user: UserWithRole): Promise<boolean> {
  const h = await headers();
  const pathname = h.get("x-pathname");
  const subject = subjectOf(user);
  // Unrestricted users (admins / legacy staff) pass; anyone with an access role is refused when we can't tell where they are.
  if (!pathname) return subject.role === "STAFF" && !!subject.permissions;
  ...
}

/** Admin-only pages that live outside the module map. */
export async function requireAdminPage() {
  const user = await requireUser();
  if (user.role === "STAFF") redirect("/no-access");
  return user;
}
```

```ts
// src/app/(app)/audit-log/page.tsx  and  src/app/(app)/lookups/page.tsx (+ every action in lookups/actions.ts)
await requireAdminPage();
```

A CI guard, so a new action or page can't ship without an explicit check:

```ts
// scripts/check-guards.test.ts  (run by `npm test`)
import { test } from "node:test";
import assert from "node:assert";
import { globSync, readFileSync } from "node:fs";

// Explicit guards, plus the file-local helpers that wrap them (ownTemplate, manageable, guard, loadLetterSupplier…).
// A new local helper must be added here deliberately, which forces a review of what it checks.
const GUARD = /\b(requireView|requireWrite|requirePermission|requireAdmin|requireAdminPage|requireSuperAdmin|requireImporter|getVendor|getEssEmployee|ownTemplate|manageable|editableRole|loadEditableBranch|loadLetterSupplier|guard|openOffer)\(/;
const PUBLIC_OK = new Set(["src/app/login/actions.ts", "src/app/login/reset-actions.ts", "src/app/me/login/actions.ts", "src/app/vendor/login/actions.ts"]);

test("every server action calls an explicit guard", () => {
  for (const f of globSync("src/**/*.ts")) {
    const src = readFileSync(f, "utf8");
    if (!src.trimStart().startsWith('"use server"') || PUBLIC_OK.has(f)) continue;
    const parts = src.split(/\nexport async function (\w+)/);
    for (let i = 1; i < parts.length; i += 2) {
      assert.ok(GUARD.test(parts[i + 1]), `${f}::${parts[i]} has no explicit guard`);
    }
  }
});
```

### 6.4 Revocable sessions

```prisma
// prisma/schema.prisma — model User
sessionVersion Int @default(0)
```

```ts
// src/lib/session.ts
export type SessionPayload = { userId: string; sv: number; activeBranchId?: string | null; remember?: boolean };

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "staff+jwt" })
    .setAudience("staff")
    .setIssuedAt()
    .setExpirationTime(payload.remember ? "7d" : "12h")
    .sign(purposeKey("staff-session"));
}
// verify: jwtVerify(token, purposeKey("staff-session"), { audience: "staff", typ: "staff+jwt" })
```

```ts
// src/lib/auth.ts — getCurrentUser
if (!user || !user.isActive || user.sessionVersion !== session.sv) return null;
```

```ts
// password change / admin reset / email reset / "sign out everywhere" / role change:
await prisma.user.update({ where: { id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
```

```ts
// src/lib/keys.ts — one root secret, separate key per purpose
import { hkdfSync } from "crypto";
export const purposeKey = (purpose: string) =>
  new Uint8Array(hkdfSync("sha256", process.env.SESSION_SECRET!, "manpowersync", purpose, 32));
// purposes: "staff-session", "ess-session", "vendor-session", "otp-hmac" ("webhook-signing-secret" already exists)
```

### 6.5 Tenant-scoped duplicate check (fixes H1)

```ts
// src/lib/duplicateCheck.ts
export async function employeeDuplicates(f: { branchId: string | null; emiratesId?: string | null; /* … */ excludeId?: string | null }) {
  const not = f.excludeId ? Prisma.sql`AND id <> ${f.excludeId}` : Prisma.empty;
  const scope = f.branchId ? Prisma.sql`AND "branchId" = ${f.branchId}` : Prisma.empty; // super admin "all branches" only
  const find = (column: "emiratesId" | "passportNumber" | "mobileNumber" | "wpsIban", test: Prisma.Sql) =>
    prisma.$queryRaw<Hit[]>(Prisma.sql`SELECT id, name, "employeeIdNo" FROM "Employee"
      WHERE ${Prisma.raw(`"${column}"`)} IS NOT NULL AND ${test} ${not} ${scope} LIMIT 3`);
  // …unchanged…
}
// callers: employeeDuplicates({ branchId: employee.branchId, … })
```

### 6.6 Security headers

```ts
// next.config.ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",           // move to nonces via proxy.ts when feasible (see Next docs: CSP with nonces)
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",                        // in-app PDF preview
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // …existing config…
};
```

Roll the CSP out as `Content-Security-Policy-Report-Only` for a week first, and check the reports for the marketing analytics and any CDN fonts before enforcing it.

### 6.7 Seed refuses defaults in production

```ts
// prisma/seed.ts
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password || password.length < 14) {
  throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of 14+ characters; no defaults are used.");
}
...
console.log(`Created super admin user ${email}`); // never log the password
```

### 6.8 Images route scoped to the owner's tenant (fixes H2)

```ts
// src/app/api/images/[id]/route.ts
const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
const image = await prisma.storedImage.findUnique({
  where: { id },
  select: {
    data: true, mimeType: true,
    userAvatars: { select: { branchId: true }, take: 1 },
    branchLogos: { select: { id: true }, take: 1 },
    branchSignatures: { select: { id: true }, take: 1 },
    branchStamps: { select: { id: true }, take: 1 },
    branchLetterheads: { select: { id: true }, take: 1 },
    supplierSignatures: { select: { branchId: true }, take: 1 },
    supplierStamps: { select: { branchId: true }, take: 1 },
  },
});
if (!image) return notFound();
const owner =
  image.branchLogos[0]?.id ?? image.branchSignatures[0]?.id ?? image.branchStamps[0]?.id ?? image.branchLetterheads[0]?.id ??
  image.supplierSignatures[0]?.branchId ?? image.supplierStamps[0]?.branchId ?? image.userAvatars[0]?.branchId ?? null;
const sensitive = image.branchSignatures.length + image.branchStamps.length + image.supplierSignatures.length + image.supplierStamps.length > 0;
if (isOutsideBranch(owner, branchId, isSuperAdmin)) return notFound();
if (sensitive && user.role === "STAFF") return notFound();
return new NextResponse(new Uint8Array(image.data), {
  headers: { "Content-Type": image.mimeType, "X-Content-Type-Options": "nosniff", "Cache-Control": sensitive ? "private, no-store" : "private, max-age=86400" },
});
```

### 6.9 Shared-store rate limiting

```ts
// src/lib/rateLimit.ts — drop-in replacement backed by Upstash
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
const limiters = new Map<string, Ratelimit>();
export async function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const id = `${limit}/${windowMs}`;
  if (!limiters.has(id)) limiters.set(id, new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`) }));
  const r = await limiters.get(id)!.limit(key);
  return { allowed: r.success, remaining: r.remaining, retryAfter: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)) };
}
// login: await rateLimit(`login-ip:${ip}`, { limit: 20, windowMs: 15 * 60_000 }) before the per-email check
```

---

## 7. Remediation Plan

| When | Items |
|---|---|
| **Today** | C3 check in production and rotate if needed; upgrade `next` to ≥16.3.8 (H6); add `Content-Security-Policy: sandbox` + `nosniff` to the four file routes (fastest C1 mitigation); branch-check the client/project document routes (C2). |
| **This week** | Upload validation everywhere (C1); scope the duplicate check (H1); scope the images route (H2); admin guards on Audit Log and Lookups (H3); security headers (H5); seed hardening; `server-only` imports. |
| **This month** | `sessionVersion` + shorter sessions + per-purpose keys (H4); admin MFA; shared-store rate limits and edge WAF rules (M1, M2); `NEXT_PUBLIC_APP_URL` required (M3); attachment permission mapping (M4); guard-coverage CI test; tenant-isolation tests; export audit and quotas; watermarking. |
| **This quarter** | Field-level encryption for identity and bank numbers; move blobs to encrypted object storage; Postgres RLS; IBAN-change approval; AI sub-processor opt-out; licence/host-allowlist framework if on-prem is planned. |

## 8. Controls Already Done Well

These patterns are worth keeping, and copying to the places above that lack them:

- `src/lib/api/*`: hashed API keys, explicit scopes, branch pinning, field allowlists, a separate PII scope, a 200-row page cap, per-key rate limits, uniform errors that don't reveal whether a key exists.
- `src/lib/webhooks/safeUrl.ts` + `http.ts`: an SSRF guard covering IPv4/IPv6/NAT64/6to4/Teredo, **DNS pinning** to the checked address, no redirect following, capped reply size; signing secrets encrypted with AES-GCM.
- `src/lib/ess/otp.ts`: HMAC-hashed codes, per-phone, per-IP and per-challenge limits, consistent "same answer" replies that don't reveal registered numbers, and the attempt counted before the comparison.
- ESS and vendor sessions re-checked against the DB on every request; the vendor file route checks ownership per entity type.
- `src/lib/storedImage.ts`: magic-byte sniffing with SVG refused. `src/lib/uploads.ts#contentDispositionFor` is the right serving pattern.
- Branch checks in server actions (no unscoped update or delete by id found); importer restricted to admins with batch ownership checked.
- Letter HTML allowlist sanitiser; merge values HTML-escaped.
- Password reset: 256-bit token hashed at rest, single use, 1h TTL, responses that don't reveal whether an account exists, IP and email limits.
- No secrets in the repo or its history; production build ships no source maps; app domain `robots.txt` disallows indexing.
