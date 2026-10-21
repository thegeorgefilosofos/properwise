# Data retention & incident response — PROPERWISE

Two operational policies a buyer's due diligence expects: how long data is kept,
and what happens if there's a breach. Free to maintain; no tooling required.

## 1. Retention schedule

| Data | Retention | Mechanism |
|---|---|---|
| Account (auth) | Life of account; on deletion **removed from the database immediately**, from backups within 30 days (as `/privacy` states; the earlier «+30 days grace» was not what the code does) | `delete_my_account` → `erase_account`: deletes every `public` table with `user_id`, then the auth row |
| Property / financial records | Life of account | Cascade on account deletion |
| Tax-relevant records | Per Greek statutory periods (customer's obligation) | Retained while account active; exportable before deletion |
| Tenant / guest records | Controlled by the customer | Deleted on customer instruction or account deletion |
| Email outbox | Sent rows kept for audit; **stale/expired rows purged** | `drain_email_outbox` marks `expired` past 2 days |
| Marketing preferences and unsubscribes | Life of account; deleted with it (`/privacy`, «Χρόνος διατήρησης»; FK `on delete cascade`). The earlier «kept indefinitely» contradicted the published policy | Marketing is consent-only (6(1)(a)), not soft opt-in |
| Guest pre-check-in data | While the property exists; deleted with the property or the account. **Open:** automatic deletion after departure (DPIA action A4) | `purge_property_children`, `erase_account` |
| Withdrawal declarations (`withdrawal_requests`) | **Not yet defined** (DPIA action A6). Kept unlinked (`account_id = null`) after account deletion as proof of the exercised right | Migration `20261020120100_i_ypanaxorisi_echei_koumpi.sql` |
| Backups | **30-day** rolling window | `db-backup.yml` `retention-days: 30` |
| CI logs / Actions artifacts | Per GitHub defaults; backups encrypted | `BACKUP_PASSPHRASE` |

**Deletion propagation**: `delete_my_account` removes the auth user; every table
with a FK `on delete cascade` to `auth.users` is purged with it. Backups age out
within 30 days, so a deletion is fully effective across the estate within that window.
One deliberate exception: withdrawal declarations keep their row with `account_id = null`
(FK `on delete set null`), as evidence under GDPR 17(3)(e).

## 2. Incident (personal-data breach) response — runbook

GDPR Art. 33/34 clock: **notify the supervisory authority (HDPA, Greece) within 72
hours** of becoming aware of a breach likely to risk individuals' rights; notify
affected individuals without undue delay if the risk is high.

1. **Detect & contain** — revoke/rotate the affected credential immediately (see
   `key-rotation-policy.md`); the reference incident (a historically-committed
   `.env.local`) is documented in `acquisition-readiness.md` §9 as the template:
   rotate keys, purge from git history, verify.
2. **Assess** — what data, whose, how many, likelihood of harm. Use the RoPA to
   scope categories.
3. **Record** — log every breach (even non-notifiable ones) in an internal register:
   date, nature, categories, numbers, measures taken.
4. **Notify** — HDPA within 72h if notifiable; affected users if high risk, in
   plain Greek, with what happened and what they should do.
5. **Remediate & review** — close the root cause; update this runbook.

**Contacts**: HDPA (Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα), plus each
subprocessor's security contact (they must tell us of breaches on their side per
the DPA).

## 3. What's automated already
- **Deploy failures** open a GitHub issue (no silent failures).
- **Off-site encrypted backups** daily (free-tier DR net until Pro/PITR).
- **Secret hygiene**: secrets only in the deployment environment; `.env.local`
  gitignored; the one historical leak was rotated + purged (documented).
