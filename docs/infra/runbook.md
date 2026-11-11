# Operations runbook

How PROPERWISE is operated day to day. The guiding principle: **every change is
versioned code applied by CI; no one touches the production database or its secrets by
hand.**

## Shipping a change

1. Write the change on a branch — a migration under `supabase/migrations/`, an edge
   function under `supabase/functions/`, or app code.
2. Push. The `Supabase deploy` workflow (`.github/workflows/supabase-deploy.yml`)
   runs automatically when `supabase/**` or the workflow changes:
   - **Reconcile migration history** — reverts any orphaned remote-only version so
     the push never aborts (self-healing; bookkeeping only, never touches schema).
   - **Apply database migrations** — `supabase db push` (migrations are idempotent).
   - **Deploy Edge Functions** — `supabase functions deploy` ships *all* functions;
     each function's `verify_jwt` is declared in `supabase/config.toml`.
3. There is no manual deploy step and no always-on write credential — the CLI
   authenticates from short-lived GitHub Actions secrets.

## Adding a database migration

- Create `supabase/migrations/<UTC-timestamp>_<name>.sql`. One migration owns one
  logical change. Make it **idempotent** (`create ... if not exists`,
  `drop policy if exists`, guarded `do $$ ... $$`) so a re-apply is a safe no-op.
- Follow the RLS conventions in `docs/db/rls-conventions.md` (one `own_<table>`
  policy; org policies via `is_org_member`; reference tables read-only + service
  write; service-managed tables have no client policy).
- Push; CI applies it. Verify green in the Actions tab.

## Where secrets live (and who reads them)

| Secret | Home | Read by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | app env / `.env.local` | the browser (RLS-gated) |
| `ANTHROPIC_API_KEY` (app) | app host env / `.env.local` | `app/api/anthropic` (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | injected by Supabase | edge functions only |
| `RESEND_API_KEY`, cron secrets, messaging tokens, `ANTHROPIC_API_KEY` (fns) | Supabase → Edge Functions → Secrets | edge functions only |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | GitHub → Actions secrets | CI only |

Rule: a secret never lives in the repo. `.env.local` is gitignored. Rotate a secret
in its home; edge functions pick up the service-role key automatically.

## Backups & restore

The repository is **public**, so Actions artifacts and logs are public too. Backups
therefore never go to artifacts: they live in a private Supabase Storage bucket.

- **Where.** Bucket `db-backups`, private, with no storage policy for `anon` or
  `authenticated` (only the service role reads it), in the database's region
  (`eu-central-1`, Frankfurt). One folder per run, `YYYY-MM-DDTHHMMSSZ`: a second
  run on the same day never writes into a sealed folder. Every file is stored as
  parts of at most 45 MB (`roles.sql.gpg.part-000`, …), because the free plan
  accepts up to 50 MB per object. On Sundays (and on manual runs with `files`) all
  six buckets of the project go in as `files.tar.gpg.part-*`: `lease-documents`,
  `property-files`, `inventory-docs`, `maintenance-photos`, `inventory-photos`,
  `avatars`. `manifest.json` is uploaded **last** and lists every part with size
  and sha256. A folder without a manifest is not a backup.
- **Who writes.** `Database backup` (`.github/workflows/db-backup.yml`), daily 02:00
  UTC and on demand, one run at a time (`concurrency: db-backup`), in **two jobs**:
  - `backup` (database secrets, only `contents: read`): dump; health check (key
    tables in the schema; no key table with 0 rows where production has rows;
    every file decrypts back byte for byte; data dump not below half of the last
    good one); upload; manifest last. Its last step, retention, runs **always**,
    even if a step before it failed: it deletes folders that reached 30 days but
    never the last good database backup or the last good files set, and deletes
    nothing if no manifest can be read.
  - `artifacts` (always, only `actions: write`, no secrets): deletes leftover
    `supabase-backup-*` artifacts from the old public setup.
- **Legitimate shrink.** If data really went down by more than half (bulk delete,
  cleanup of test accounts), the size check keeps failing. After confirming the
  cause: **Actions → Database backup → Run workflow** with `allow_shrink` ticked.
  The log says the override was used. Never tick it to silence a failure you
  have not explained.
- **Who checks.** `Backup watchdog` (05:00 UTC) opens an issue if the last sealed
  run is older than 48 h, a part is missing or has the wrong size, a sha256 of
  the database parts does not match, any unencrypted `.sql` exists, or the latest
  files set is incomplete or older than 8 days. `Backup restore drill` (3rd of
  each month, Postgres 17.6) checks every part against the manifest, decrypts the
  latest run, restores it into a throwaway Postgres, compares row counts of the
  key tables and checks the latest files set.
- **60 days without activity.** GitHub disables scheduled workflows in a public
  repository after 60 days without repository activity (docs.github.com, Actions,
  «Disabling and enabling a workflow»). It disables the watchdog
  too, because it is also scheduled, so **the watchdog does not catch this
  case.** What does: any push to the repository resets the count; the Actions
  page shows "This scheduled workflow is disabled" next to `Database backup`. If
  backups stop and no issue appears, check that page first and press **Enable
  workflow** on all three backup workflows. An external heartbeat (for example a
  Sentry cron monitor pinged by `db-backup.yml`) would catch it independently; it
  is not set up yet.
- **Keys.** No extra secret: the service-role key is fetched at run time from the
  Management API with `SUPABASE_ACCESS_TOKEN` (`scripts/backup/service-key.sh`) and
  masked in the log. Supabase has no read-only storage key, so the drill runs with
  `VAULT_READONLY=1` and `vault.mjs` refuses anything but download and list. Logs
  print counts and sizes only, never object paths.
- **Restore.**
  1. Get the service-role key (Dashboard → Project Settings → API keys) and run
     `SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=… node scripts/backup/vault.mjs latest`.
  2. `node scripts/backup/vault.mjs get-joined <folder> data.sql.gpg data.sql.gpg` (same
     for `roles`, `schema`, and `files.tar.gpg`). It checks every part's sha256.
  3. `gpg --decrypt -o data.sql data.sql.gpg` with `BACKUP_PASSPHRASE`.
  4. `psql "<connection>" -f roles.sql`, then `-f schema.sql`, then
     `-f data.sql` (roles only on a fresh project).
  5. Files: decrypt `files.tar.gpg`, untar, and upload per bucket.
- ⚠ **Same provider.** The backup lives in the same Supabase project as the
  database. It covers a bad migration or an accidental delete, not the loss of the
  project or the account. Next step: a second destination with another provider
  (Cloudflare R2 or AWS S3), which needs an account the owner opens. Supabase
  **Pro** adds managed daily backups and point-in-time recovery.
- **Passphrase.** After the move from public artifacts (10/11/2026) the
  `BACKUP_PASSPHRASE` must be rotated: the old encrypted files were downloadable by
  anyone. Backups made before the rotation open only with the old phrase.

## Incident response — leaked secret

The reference procedure (executed once for a `.env.local` that had been committed):

1. **Rotate/revoke the key immediately** in its provider — rotation is the real fix;
   scrubbing history alone is not enough once a key is exposed.
2. **Untrack & purge** — `git rm --cached <file>`, then rewrite history to remove it
   from every commit (`git filter-branch --index-filter 'git rm --cached
   --ignore-unmatch <file>' --prune-empty -- <refs>`), verify the working tree is
   byte-identical, and force-push.
3. **Confirm** the old credential no longer appears in any provider list.

## What to watch

- **Actions tab** — the deploy workflow must be green; it self-heals migration
  history but a real migration error will show here.
- **Supabase → Advisors** — run Security + Performance advisors periodically; close
  findings as a hardening migration.
- **Cron** — `select * from cron.job_run_details order by end_time desc` shows recent
  scheduled-job outcomes (rate updates, reminders, outbox drain).

## Related docs

`security-and-automation.md` · `rls-conventions.md` · `security-audit-2026-07.md` ·
`acquisition-readiness.md` · `../../supabase/README.md`

## Η τροφοδοσία επιτοκίων: πώς ελέγχεται ότι ζει

Η `market-data-daily` τρέχει κάθε πρωί στις 08:00 UTC, καλεί τη
`market-data-updater` και γράφει στον `public.market_rates` οκτώ επιτόκια, το
καθένα με τη δική του ημερομηνία παρατήρησης και πηγή (στήλη `provenance`).

**Δεν χρειάζεται καμία χειροκίνητη ρύθμιση.** Το κοινό μυστικό παράγεται από τη
μετανάστευση `20260901120000` και η διεύθυνση της συνάρτησης χτίζεται από το
`functions_base_url` του vault, με εφεδρεία τη διεύθυνση της παραγωγής. Και τα
δύο ήταν, ώς τότε, σιωπηλά σημεία αποτυχίας: η εργασία δεν έβγαζε σφάλμα,
απλώς δεν έστελνε τίποτα.

### Μία ερώτηση που λέει αν όλα στέκουν

```sql
select
  (select count(*) from pg_extension where extname = 'pg_cron')        as pg_cron,
  (select count(*) from pg_extension where extname = 'pg_net')         as pg_net,
  (select count(*) from public.cron_secrets where name = 'email_cron') as koino_mystiko,
  (select count(*) from cron.job where jobname = 'market-data-daily')  as ergasia,
  (select max(updated_at) from public.market_rates)                    as teleftaia_grammi,
  (select count(*) from jsonb_object_keys(
     (select provenance from public.market_rates
       where provenance is not null order by updated_at desc limit 1))) as times_me_taftotita;
```

Οι τέσσερις πρώτες στήλες πρέπει να είναι `1`. Η τελευταία πρέπει να είναι `8`:
τόσα επιτόκια φέρνει ένα πλήρες πέρασμα. Λιγότερα σημαίνει ότι κάποιες σειρές
δεν απάντησαν — δεν είναι σφάλμα από μόνο του, γιατί η προηγούμενη τιμή κρατά τη
θέση της με την ΠΑΛΙΑ της ημερομηνία, αλλά αν μένει έτσι για μέρες αξίζει έλεγχος.

Επαληθεύτηκε στην παραγωγή την 01/09/2026: και οι πέντε στήλες σωστές.

### Οι εργασίες που ΔΕΝ ξέρει το αποθετήριο

Το `supabase db dump` δεν κατεβάζει εργασίες pg_cron: ζουν στο σχήμα `cron`.
Οποια φτιαχτεί από το ταμπλό δεν υπάρχει πουθενά στον κώδικα και δεν την ελέγχει
κανείς. Την 01/09/2026 βρέθηκαν τέσσερις τέτοιες, ανάμεσά τους μία που
αποτύγχανε κάθε μέρα με ανυποκατάστατο πρότυπο στη διεύθυνση και μία που έγραφε
παλιά επιτόκια στον ίδιο πίνακα μία ώρα πριν από τη σωστή εργασία.

Η λίστα ελέγχεται περιοδικά· ό,τι δεν αντιστοιχεί σε μετανάστευση είναι ύποπτο:

```sql
select j.jobname, j.schedule, j.active,
       max(r.end_time) as teleftaia,
       (array_agg(r.status order by r.end_time desc))[1] as katastasi,
       (array_agg(left(coalesce(r.return_message,''), 80) order by r.end_time desc))[1] as minima
  from cron.job j left join cron.job_run_details r on r.jobid = j.jobid
 group by j.jobname, j.schedule, j.active order by j.jobname;
```

### Πρώτο πέρασμα κατά παραγγελία

```sql
select net.http_post(
  url     := coalesce(
               (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url'),
               'https://aromvduuxtcrzmwwvnej.supabase.co') || '/functions/v1/market-data-updater',
  headers := jsonb_build_object('Content-Type','application/json',
               'x-cron-secret', (select secret from public.cron_secrets where name = 'email_cron')),
  body    := '{}'::jsonb, timeout_milliseconds := 120000);
```

Μετά από λίγα δευτερόλεπτα:

```sql
select updated_at, euribor_3m, jsonb_pretty(provenance)
  from public.market_rates order by updated_at desc limit 1;
```

### Τι δείχνει η οθόνη όταν κάτι λείπει

Καμία τιμή δεν εμφανίζεται ως «σημερινή» χωρίς παρατήρηση. Οταν η `provenance`
είναι κενή, η λωρίδα επιτοκίων της καρτέλας Δάνειο δείχνει τιμή ΧΩΡΙΣ
ημερομηνία: η απουσία λέγεται με απουσία, όχι με παύλα και όχι με «σήμερα».
Οταν μια τιμή έχει παλιώσει πέρα από το όριο του είδους της (πέντε ημέρες για
Euribor, τετρακόσιες για επιτόκιο πολιτικής που αλλάζει σπάνια, εβδομήντα πέντε
για τα ελληνικά μέσα), η ημερομηνία της υπογραμμίζεται διακεκομμένα.
