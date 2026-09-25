# Subprocessor register — PROPERWISE

The third parties that may process personal data on behalf of PROPERWISE, why,
and where. Maintained under GDPR Art. 28 (3)(d). Publish a summary of this list
on the website and notify customers before adding a new subprocessor.

> Status of this document: **factual inventory of what the stack uses today.**
> DPA column records whether a signed Data Processing Agreement is in place —
> execute the ones marked ☐ before onboarding real customer data at scale.

| Subprocessor | Purpose | Data categories | Region / residency | DPA |
|---|---|---|---|---|
| **Supabase** (Supabase Pte. Ltd) | Managed Postgres, Auth, Storage, Edge Functions — the primary platform | All application data: owner + tenant PII, property/financial data, documents, auth credentials (hashed) | **EU — Frankfurt, `eu-central-1`** | ✅ 23.09.2026 · DPA v1 (01.08.2026) + TIA archived. Counterparty **Supabase Pte. Ltd (Singapore)**; SCCs Module 2/3 deemed signed on ToS acceptance (§12.2), Irish law. Breach notice ≤48h to the account email; subscribed to subprocessor-change notices (30 days, objection within 5) |
| **Resend** (Plus Five Five, Inc.) | Transactional + lifecycle email delivery | Recipient email, name, message content | US (SCCs required) | ✅ 23.09.2026 · DPA of 31.12.2025, pre-signed via Docusign, archived. Counterparty **Plus Five Five, Inc.**; EU SCCs Module 2 (Irish law) plus EU-US DPF certification. Subprocessor changes notified 14 days ahead; breach notice without undue delay |
| **Anthropic** (Anthropic Ireland, Limited for EEA customers) | AI assistant, document scanning, market-data summarisation | Prompt content — user questions **plus** a standing context built once per session and attached to every message: property/financial data, tenant full name, up to 50 clients with full name, stay history, rating, blacklist flag and free-text stay notes, and up to 60 service contacts with name and role (`PropertyAssistant.tsx`, roster block). **Phone numbers and ΑΦΜ of clients and contacts are not sent**: only presence flags («έχει τηλέφωνο», «έχει ΑΦΜ»); a number the user types in a question is matched on the device and only the matching name is added (`lib/assistant/roster.ts`). **Whole documents and photos** are uploaded for scanning: leases, tenant ID documents, bills, loan papers (`app/api/anthropic/route.tsx:131`). This is third-party personal data leaving the EU — the assistant is not a low-egress surface. | US (SCCs required) | ✅ 23.09.2026 · Commercial Terms (17.06.2025) and DPA (24.02.2025) archived. Counterparty for EEA customers **Anthropic Ireland, Limited**. Commercial Terms §B: "Anthropic may not train models on Customer Content from Services." |
| **GitHub** (GitHub, Inc. / Microsoft) | Source control, CI/CD, encrypted DB-backup artifacts | Source code; backup artifacts contain customer data (encrypted when `BACKUP_PASSPHRASE` set) | US (SCCs required) | ✅ DPA signed (owner confirmation, 25.09.2026; archive the PDF in `docs/legal/executed-dpas/github.pdf`). Backups are GPG-encrypted (AES256, `backup-watchdog.yml` green on 22 and 23.09.2026), **but symmetrically, with `BACKUP_PASSPHRASE` stored as a GitHub Actions secret** (`db-backup.yml`): GitHub holds both ciphertext and key, so the encryption is not a supplementary measure against GitHub itself. Still open, as a supplementary measure: public-key encryption with the private key kept offline |
| **Creem** | Subscription billing & payments, merchant of record | Billing contact, card handled by Creem (PCI scope stays with them), subscription IDs | US/EU (SCCs) | DPA is an annex of the Merchant Terms, accepted on signup. Creem is an independent controller as merchant of record for checkout/tax data, processor for the rest. ☐ copy archived |
| **Vercel** (Vercel Inc.) | Application hosting and delivery — every request transits it en route to the database | Request metadata, IP; application traffic in transit | US — global edge network | Incorporated in the ToS, but covers Pro/Enterprise; Hobby is non-commercial use only. ☐ pending: the project moves to Pro before billing goes live (owner, 25.09.2026), then archive the DPA PDF |
| **Google** (Google LLC) | Google OAuth sign-in (`app/login/page.tsx`, `app/signup/page.tsx`). The contact dossier map is now a plain link the user clicks (`TabContacts.tsx`), no iframe; Google Fonts were removed 2026-07-27 | OAuth: email, name, IP | US | ✅ 23.09.2026 · Independent controller, nothing to sign. OAuth branding verified: home page, /privacy, /terms, authorized domain properwise.gr |
| **Sentry** *(env-gated, not live)* | Application error reporting — only active when `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` is set (`lib/observability/report.ts:79`) | Error message, stack trace, request URL — may incidentally contain identifiers | US/EU depending on org region | ☐ execute before enabling |
| Browser push services — **Google / Apple / Mozilla** *(live once VAPID keys are set)* | Web push delivery: the browser picks the service, the user opts in per device (`lib/push/*`, table `push_subscriptions`) | The device's push endpoint and the **ciphertext** of the notification. Content is encrypted end-to-end with keys the user's browser generates (RFC 8291) — the service relays a sealed envelope and cannot read amounts or vendors | US and EU (SCCs where US) | ☐ execute before enabling |
| Messaging providers — **Viber / WhatsApp (Meta) / Apple** *(planned, not live)* | Multichannel notification delivery | Phone number, short message content (no amounts/PII on lock screen by policy) | Various (SCCs) | ☐ execute per provider before go-live |

## Notes
- **Data residency**: the system of record (Supabase) is EU-hosted. Email/AI/repo
  subprocessors are US-based and require **Standard Contractual Clauses** (SCCs)
  plus a transfer-risk assessment.
- **Minimisation on egress**: the messaging layer's lock-screen rule (no amounts,
  no private names) holds. The AI path is only partly minimised: third-party
  phone numbers and ΑΦΜ stay on the device (`lib/assistant/roster.ts`), but
  names, stay notes, financials and scanned documents still go — see the
  Anthropic row. Do not describe the assistant as minimised anywhere public;
  `/trust` and `/privacy` state plainly what goes.
- **Nominatim removed**: address autocomplete was dropped from the contact form
  (its usage policy forbids client-side autocomplete) and its host left the CSP.
- **Silent paths are the dangerous ones.** Google Fonts and Maps were live for
  months without appearing here, because nobody chose them as a "subprocessor" —
  they arrived as a `<link>` tag. Before publishing a claim like "here is
  everyone", grep the CSP allowlist in `proxy.ts` and every external hostname in
  `app/` and `lib/`; the CSP is the honest inventory of who the browser talks to.
- **Adding a subprocessor**: update this table, execute the DPA/SCCs, and give
  customers advance notice with a right to object, per the DPA. The public
  summary is generated from one registry, `lib/legal/subprocessors.ts`
  (name, purpose, region, role, legal entity, active state, plus
  `TRANSFER_SAFEGUARDS`), which `/trust`, `/privacy` and `/terms` all read.
  This table and that file must change together.
