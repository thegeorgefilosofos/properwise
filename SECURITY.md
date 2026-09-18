# Security Policy

PROPERWISE handles owners' property, tenant and financial data. We take security
reports seriously and welcome good-faith research.

## Reporting a vulnerability

Email **security@properwise.gr** with a step-by-step reproduction, what you
achieved, and the impact a malicious actor could have. Screenshots or a short
video help. Write in Greek or English — whichever suits you.

Please report privately first. **Do not** open a public issue for a suspected
vulnerability.

## What to expect

- **Acknowledgement** within 3 business days.
- **Assessment** (whether we reproduce it and how severe we rate it) within
  10 business days.
- Progress updates at least every 14 days until it is resolved.
- Public credit in the fix notes, if you want it.

There is **no bug bounty** — we say so up front rather than let you discover it
after the work.

## Safe harbour

We will not pursue legal action, nor ask third parties to, against research that
follows the rules below, and we will confirm in writing that it was authorised
if a third party comes after you. Under Greek law we treat such research as
authorised access under Article 370B of the Penal Code.

In return we ask that you:

- Give us **90 days** before publishing (we will agree a new date if a fix needs
  longer, never extend it unilaterally).
- Take **only the minimum proof**. Do not acquire, copy, delete or modify
  third-party data. If you hit personal data, stop and tell us.
- Do not degrade the service: **no DoS, no spam, no mass credential testing**.
- No social engineering of users or staff, and no physical access.
- Test on **your own account** — you can create as many as you like, for free.

## Scope

**In scope:** `properwise.gr` and its subdomains, the app, the public
link-based portals (guest check-in, accountant, tenant), and the public APIs.

**Out of scope:** third-party infrastructure (Supabase, Vercel, GitHub, Resend,
Anthropic, Google) — report those to the provider; findings from automated
scanner output with no demonstrated impact; missing headers with no exploitable
behaviour; and library-version reports with no exploit path.

## Full policy

- Machine-readable: [`/.well-known/security.txt`](https://properwise.gr/.well-known/security.txt) (RFC 9116)
- Human-readable: [properwise.gr/trust](https://properwise.gr/trust)

The three sources must agree; if you find them in conflict, that itself is worth
an email.
