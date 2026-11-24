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
| Email outbox | Rows in `pending`/`dispatched` never touched. Final rows (`sent`, `expired`, `skipped`, `failed`): content (`params`) and name cleared after **90 days**; the row itself (address + `dedup_key`) stays so a one-time email is not re-sent, and is deleted after **400 days** only when its key is tied to a closed period (year/quarter/month/day). Deleted in full with the account | `private.prune_logs()`, pg_cron `logs-retention-prune` daily 02:29 UTC (migration 20261116172000) |
| Reminder log (`notification_log`) | **13 months**, except: each user's first row (signup funnel metric), `overdue` rows of events still pending (else the reminder is re-sent). Deleted with the account (FK cascade) | Same job |
| Health checks (`health_checks`), cron run log (`cron.job_run_details`) | **30 days** / **14 days**; operational, no personal data | Same job |
| Marketing preferences and unsubscribes | Life of account; deleted with it (`/privacy`, «Χρόνος διατήρησης»; FK `on delete cascade`). The earlier «kept indefinitely» contradicted the published policy | Marketing is consent-only (6(1)(a)), not soft opt-in |
| Guest pre-check-in data | While the property exists; deleted with the property or the account. **Open:** automatic deletion after departure (DPIA action A4) | `purge_property_children`, `erase_account` |
| Withdrawal declarations (`withdrawal_requests`) | **Not yet defined** (DPIA action A6). Kept unlinked (`account_id = null`) after account deletion as proof of the exercised right | Migration `20261020120100_i_ypanaxorisi_echei_koumpi.sql` |
| Accountant access requests (`accountant_invites`, approved by George 21/10/2026) | Unanswered or withdrawn: **90 days**, then purged. «Όχι» from an account: until that account is deleted. Objection via support: only an unsalted SHA-256 of the address (pseudonymised, not anonymous), kept indefinitely as proof of the objection (GDPR 17(3), 21); the address is deleted from invites and from the email outbox | `private.accountant_invite_retention()` (mirrored by `ACCOUNTANT_INVITE_RETENTION_DAYS` for the email), daily `accountant-invites-prune` → `prune_accountant_invites()`, `accountant_invite_optout()` |
| myDATA docs, pending | `MYDATA_PENDING_DAYS` (90) days from fetch, then deleted; the Inbox warns `MYDATA_EXPIRY_NOTICE_DAYS` (14) days before. An undone auto-filing counts again from the undo (`fetched_at = now()`, Κ-5) | `private.mydata_prune()`, `mydata_auto_undo` |
| myDATA docs, dismissed | Issuer, amounts, date, series, number and title cleared at the decision; MARK, client AFM and decision kept `MYDATA_DECIDED_DAYS` (400) days | `private.mydata_minimize()`; `mydata_prune()` |
| myDATA docs, filed, linked or cancelled by issuer | `MYDATA_DECIDED_DAYS` days from the decision or cancellation, or until the consent ends, whichever is first. The expense itself follows the expenses policy | `mydata_prune()`; `private.mydata_revoke()` deletes every doc of the consent |
| myDATA quarantine (MARK and reason code only) | `MYDATA_QUARANTINE_DAYS` (90) days after it was last requested, or until the consent ends (Κ-12) | `mydata_prune()`, `mydata_revoke()` |
| myDATA access log | `MYDATA_LOG_MONTHS` (24) months; deleted with the client account; kept without the accountant when the accountant deletes the account | `mydata_prune()`, FK cascade / set null |
| myDATA consents, revoked (proof of consent, Art. 7(1)) | **5 years** after revocation (owner decision 24/11/2026; `MYDATA_REVOKED_YEARS`, `interval '5 years'`; anchor: Civil Code art. 937). Operational fields cleared at revocation. Kept when the ACCOUNTANT deletes the account (`accountant_id … on delete set null`, revoked with reason `accountant_deleted`, Κ-3); deleted immediately with the client account | `mydata_prune()`, trigger `mydata_accountant_gone` |
| myDATA paused consents | Revoked after `MYDATA_PAUSE_DAYS` (90) days of pause | `mydata_prune()` |
| myDATA ignored providers (issuer AFM) | Until account deletion | FK cascade |
| myDATA AFM confirmations | Until the accountant–client link is dead, deleted at the next daily prune (Κ-4); or with either account | `mydata_prune()` |
| myDATA joint-controller acceptance (version, time) | Life of the accountant's connection row | FK cascade with the accountant account |
| Accountant's AADE key | **Not stored** (Ε2, owner decision 24/11/2026). Held only in the browser tab's memory and in the edge-function call that uses it; never written to the database, Vault, logs or backups | `scripts/guard-mydata-key.mjs`; migration `20261124100000` drops `mydata_key_store`, `mydata_key_read`, `mydata_key_remove`, `private.mydata_vault` and the `mydata-sync-*` cron jobs |
| Backups | **30-day** rolling window, private Supabase bucket `db-backups` (Frankfurt) | `db-backup.yml` `KEEP_DAYS: '30'` |
| CI logs / Actions artifacts | Per GitHub defaults; no backup is uploaded as an artifact since #521 | `db-backup.yml` deletes leftover `supabase-backup-*` |

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

### 2α. myDATA: ένδειξη ότι κλειδί λογιστή διέρρευσε

Από το σχέδιο 05 του νομικού ελέγχου, προσαρμοσμένο στο Ε2: το κλειδί **δεν φυλάσσεται**,
οπότε δεν υπάρχει Vault ή αντίγραφο να διαρρεύσει. Ισχύει όταν υπάρχει ένδειξη ότι κλειδί
λογιστή πέρασε σε αρχείο καταγραφής, σε μήνυμα σφάλματος ή σε κώδικα πελάτη που
παραβιάστηκε. Τ0 = η στιγμή που μάθαμε με εύλογη βεβαιότητα. Οι 72 ώρες (33§1) μετρούν από Τ0.

Το κλειδί ανοίγει στην ΑΑΔΕ όλους τους πελάτες του λογιστή, ακόμη και όσους δεν είναι χρήστες μας.
Όποιος το έχει καλεί την ΑΑΔΕ απευθείας· **αυτές οι κλήσεις δεν φαίνονται στο αρχείο μας**.
Η μόνη πραγματική ανάσχεση είναι η ακύρωση του κλειδιού από τον λογιστή.

1. **Πάγωμα (Τ0 έως Τ0+1 ώρα).** Μυστικό `MYDATA_SYNC_ENABLED` της συνάρτησης άκρου σε `0`.
   Αν αφορά τον ρόλο υπηρεσίας: αλλαγή κλειδιού `service_role` και μυστικού JWT.
2. **Ειδοποίηση λογιστών (αμέσως, το αργότερο Τ0+24 ώρες, `MYDATA_BREACH_NOTICE_HOURS`).**
   Όσοι άντλησαν στο επίμαχο διάστημα (`scripts/db/mydata-contacts.sql`, μόνο ανάγνωση).
   Να διαγράψουν την εγγραφή τους στο myDATA REST API (που ακυρώνει το κλειδί) και να κάνουν
   νέα (FAQ ΑΑΔΕ «Εξουσιοδοτήσεις», ερ. 5· η ερ. 3 και η ερ. 5 διαφωνούν για το αν το ίδιο
   όνομα χρήστη ξαναχρησιμοποιείται). Αλλαγή κλειδιού χωρίς διαγραφή: δεν βρέθηκε. Το μήνυμα
   λέει τι έγινε, τι δεν ξέρουμε, ότι δίνουμε το αρχείο πρόσβασης και ότι οι κλήσεις εκτός
   Υπηρεσίας δεν φαίνονται σε αυτό. Είναι η ειδοποίηση του Όρου «Σύνδεση myDATA», Παραβίαση.
3. **Έρευνα (από Τ0).** Γραμμές `key_used` και `sync_fetch` του `mydata_access_log` στο
   διάστημα· ποιος τις ξεκίνησε (`actor_id`)· ποια ΑΦΜ ζητήθηκαν· αν επηρεάστηκαν και τα
   `mydata_docs`.
4. **Κρίση (ως Τ0+48 ώρες).** Διαρροή του κλειδιού είναι παραβίαση της εμπιστευτικότητας
   (4 σημ. 12). Η κρίση γράφεται και όταν δεν γίνεται γνωστοποίηση (33§5).
5. **Γνωστοποίηση στην ΑΠΔΠΧ (ως Τ0+72 ώρες).** Περιστατικό στην Υπηρεσία: εμείς, για την
   άντληση ως από κοινού υπεύθυνοι και για τους λογαριασμούς των χρηστών μας. Περιστατικό στην
   πλευρά του λογιστή: ο λογιστής· εμείς δίνουμε χρονολόγιο και αρχείο. Πελάτες του λογιστή
   που δεν είναι χρήστες μας: ο λογιστής. Αν ένας δεν γνωστοποιήσει εμπρόθεσμα, ο άλλος
   γνωστοποιεί για τη δική του πλευρά. Σταδιακή συμπλήρωση (33§4), λόγος καθυστέρησης.
6. **Ενημέρωση υποκειμένων (34), αν ο κίνδυνος είναι υψηλός.** Εμείς τους χρήστες μας,
   ο λογιστής τους υπόλοιπους πελάτες του. Εξαιρέσεις του 34§3· η ακύρωση του κλειδιού
   καλύπτει μόνο το μέλλον.
7. **Επαναφορά.** `MYDATA_SYNC_ENABLED=1` μόνο αφού βρεθεί και διορθωθεί η αιτία. Δεν υπάρχει
   φυλαγμένο κλειδί για να αλλάξει κατάσταση.
8. **Καταγραφή (33§5).** Τ0, ώρα παγώματος, ποιοι λογιστές ειδοποιήθηκαν και πότε, ποιοι
   επιβεβαίωσαν ακύρωση, τι βρέθηκε στο αρχείο, η κρίση, ο αριθμός πρωτοκόλλου, ποιοι
   ενημερώθηκαν.

**Contacts**: HDPA (Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα), plus each
subprocessor's security contact (they must tell us of breaches on their side per
the DPA).

## 3. What's automated already
- **Deploy failures** open a GitHub issue (no silent failures).
- **Off-site encrypted backups** daily (free-tier DR net until Pro/PITR).
- **Secret hygiene**: secrets only in the deployment environment; `.env.local`
  gitignored; the one historical leak was rotated + purged (documented).
