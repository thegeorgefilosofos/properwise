-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΛΟΓΙΣΤΗΣ ΦΕΡΝΕΙ ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΤΟΥ ΠΕΛΑΤΗ ΑΠΟ ΤΟ myDATA, ΜΕ ΤΗΝ ΑΔΕΙΑ ΤΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- ΕΓΚΡΙΣΗ ΙΔΙΟΚΤΗΤΗ: 23/11/2026 (σχέδιο «Σύνδεση ΑΑΔΕ χωρίς export/upload»,
-- ενότητα Α και «Πίνακας περιπτώσεων»), μαζί με αυτή τη μετανάστευση.
--
-- ΠΗΓΗ (προστατευμένη διαδρομή, άρα γραμμένη ρητά):
--   ΑΑΔΕ, «myDATA REST API — Τεκμηρίωση για χρήστες ERP», έκδοση v2.0.2
--   (09/2026), https://www.aade.gr/sites/default/files/2026-09/
--   myDATA%20API%20Documentation%20v2.0.2_official_erp_1.pdf
--     §4.1  κεφαλίδες `aade-user-id` και `Ocp-Apim-Subscription-Key`: τα
--           διαπιστευτήρια ανήκουν στον ΧΡΗΣΤΗ που καλεί, εδώ στον λογιστή.
--     §4.2  RequestDocs: «Για την περίπτωση που η μέθοδος κληθεί από τρίτο
--           πρόσωπο (όπως εκπρόσωπος Ν.Π. ή λογιστής), ο ΑΦΜ της οντότητας
--           […] αποστέλλεται μέσω της παραμέτρου entityVatNumber». Παράμετρος
--           mark: επιστρέφονται ΜΑΡΚ μεγαλύτερα από αυτόν (σταδιακός
--           συγχρονισμός)· nextPartitionKey / nextRowKey: σελιδοποίηση.
--   ΑΑΔΕ, «FAQs myDATA REST API — Εξουσιοδοτήσεις» (02/2023): ο λογιστής
--   καλεί με ΔΙΚΟ ΤΟΥ κλειδί, για ΑΦΜ που τον έχουν εξουσιοδοτήσει στο myAADE.
--   Αρα ένα κλειδί ανά λογιστή, όχι ανά πελάτη, όπως λέει και το σχέδιο.
--   Σχήμα απάντησης: requestedInvoicesDoc-v2.0.2.xsd (ΜΑΡΚ: xs:long· ποσά:
--   AmountType, xs:decimal με 2 δεκαδικά, ≥ 0).
--   ΓΚΠΔ (Κανονισμός 2016/679): άρθρο 6§1(α) και 7§3 (συγκατάθεση, ανακλητή
--   όσο εύκολα δόθηκε), 5§1(γ) (ελαχιστοποίηση: μόνο τα πεδία της δαπάνης,
--   κανένα ολόκληρο XML), 5§1(ε) (όριο διατήρησης), 5§2 και 30 (λογοδοσία:
--   αρχείο πρόσβασης), 17 (διαγραφή με την ανάκληση).
--
-- ΤΟ ΑΥΣΤΗΡΟ ΟΡΙΟ (ιδιοκτήτης): συγχρονίζεται ΜΟΝΟ πελάτης που (α) είναι χρήστης
-- PROPERWISE, (β) έχει συνδέσει ΑΥΤΟΝ τον λογιστή μέσα στο PROPERWISE
-- (`accountant_link_live`, ο ίδιος έλεγχος που κρατά όλη την πύλη) και (γ) έχει
-- πατήσει «Επιτρέπω». Ποτέ οι άλλοι πελάτες του λογιστή. Ο έλεγχος γίνεται ΣΤΗ
-- ΒΑΣΗ σε κάθε κλήση (`mydata_consent_live` και ξανά μέσα στην εγγραφή), όχι
-- μόνο στην οθόνη.
--
-- ΤΟ ΚΛΕΙΔΙ. Ζει στο Supabase Vault, κρυπτογραφημένο. Η αναφορά του σε ιδιωτικό
-- πίνακα (`private.mydata_vault`), εκτός PostgREST. Το διαβάζει ΜΟΝΟ ο ρόλος
-- υπηρεσίας (`mydata_key_read`), δηλαδή η συνάρτηση άκρου. Καμία συνάρτηση που
-- φτάνει ο `authenticated` δεν το επιστρέφει, δεν το γράφει σε μήνυμα σφάλματος
-- και δεν το καταγράφει. Τα σφάλματα στη βάση είναι κωδικοί από κλειστό
-- κατάλογο (`mydata_error_codes`), ποτέ κείμενο.
--
-- ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν καταχωρεί τίποτα μόνο του: κάθε παραστατικό περιμένει τον
-- ιδιοκτήτη στα Εισερχόμενα, «Για έλεγχο». Η αυτόματη καταχώρηση γνωστών
-- κατηγοριών είναι η επόμενη φάση (PR-Α2). Δεν κρατά ολόκληρο το XML.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. ΒΟΗΘΟΙ ──────────────────────────────────────────────────────────────
-- Το ΑΦΜ με το ψηφίο ελέγχου της ΑΑΔΕ, ίδιος κανόνας με το lib/core/greek.ts.
create or replace function private.mydata_afm_ok(p text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select p ~ '^[0-9]{9}$' and p <> '000000000' and (
    (  substr(p,1,1)::int * 256 + substr(p,2,1)::int * 128 + substr(p,3,1)::int * 64
     + substr(p,4,1)::int * 32  + substr(p,5,1)::int * 16  + substr(p,6,1)::int * 8
     + substr(p,7,1)::int * 4   + substr(p,8,1)::int * 2) % 11 % 10
  ) = substr(p,9,1)::int
$$;

-- Ο κλειστός κατάλογος των κωδικών σφάλματος· ίδιος με το ERROR_CODES του
-- supabase/functions/_shared/mydata.ts.
create or replace function private.mydata_error_codes()
returns text[]
language sql immutable
set search_path = ''
as $$
  select array['auth','forbidden','rate','server','empty','bad_request','http','network','timeout',
               'parse','aade_error','no_key','no_afm','not_linked','config','unknown']
$$;

-- Πότε ξαναδοκιμάζεται πελάτης μετά από αποτυχίες στη σειρά: 15, 30, 60…
-- λεπτά, ως 6 ώρες. Ίδιος κανόνας με το `nextRetryAt` του mydataEngine.ts.
create or replace function private.mydata_retry_after(p_failures int)
returns interval
language sql immutable
set search_path = ''
as $$
  select make_interval(mins => least(15 * power(2, greatest(p_failures - 1, 0))::int, 360))
$$;

-- ── 1. Η ΣΥΝΔΕΣΗ ΤΟΥ ΛΟΓΙΣΤΗ ──────────────────────────────────────────────
create table if not exists public.mydata_connections (
  accountant_id   uuid primary key references auth.users (id) on delete cascade,
  aade_user_id    text not null,
  has_key         boolean not null default false,
  status          text not null default 'active',
  last_sync_at    timestamptz,
  last_sync_new   integer not null default 0,
  last_error_code text,
  lease_id        uuid,
  lease_at        timestamptz,
  last_manual_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_connections_status_known') then
    alter table public.mydata_connections add constraint mydata_connections_status_known
      check (status in ('active', 'invalid', 'removed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_connections_user_shape') then
    alter table public.mydata_connections add constraint mydata_connections_user_shape
      check (length(aade_user_id) between 1 and 100 and aade_user_id !~ '\s');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_connections_error_known') then
    alter table public.mydata_connections add constraint mydata_connections_error_known
      check (last_error_code is null or last_error_code = any (private.mydata_error_codes()));
  end if;
end $c$;

-- Το `updated_at` το γράφει η βάση, όπως σε κάθε πίνακα (rls-probe.sql).
drop trigger if exists mydata_connections_updated_at on public.mydata_connections;
create trigger mydata_connections_updated_at before update on public.mydata_connections
  for each row execute function public.update_updated_at_column();

comment on table public.mydata_connections is
  'Η σύνδεση myDATA του λογιστή: user id της ΑΑΔΕ, αν υπάρχει κλειδί (το ίδιο ζει στο Vault), κατάσταση και τελευταίος συγχρονισμός. Κανένα μυστικό.';

-- Η αναφορά στο μυστικό του Vault. Ιδιωτικό σχήμα: δεν το βλέπει το PostgREST.
create table if not exists private.mydata_vault (
  accountant_id uuid primary key references auth.users (id) on delete cascade,
  secret_id     uuid not null
);

-- Οταν φεύγει η αναφορά (αφαίρεση κλειδιού ή διαγραφή λογαριασμού με
-- cascade), φεύγει και το μυστικό. Αλλιώς θα έμενε ορφανό στο Vault.
create or replace function private.mydata_vault_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end $$;

drop trigger if exists mydata_vault_drop on private.mydata_vault;
create trigger mydata_vault_drop after delete on private.mydata_vault
  for each row execute function private.mydata_vault_drop();

-- ── 2. Η ΣΥΝΑΙΝΕΣΗ ΤΟΥ ΠΕΛΑΤΗ ──────────────────────────────────────────────
create table if not exists public.mydata_consents (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references auth.users (id) on delete cascade,
  accountant_id   uuid not null references auth.users (id) on delete cascade,
  afm             text not null,
  window_from     date not null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoke_reason   text,
  last_mark       bigint not null default 0,
  resume          jsonb,
  status          text not null default 'pending',
  last_sync_at    timestamptz,
  last_new        integer not null default 0,
  last_error_code text,
  failures        integer not null default 0,
  next_retry_at   timestamptz
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_afm_ok') then
    alter table public.mydata_consents add constraint mydata_consents_afm_ok check (private.mydata_afm_ok(afm));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_status_known') then
    alter table public.mydata_consents add constraint mydata_consents_status_known
      check (status in ('pending', 'ok', 'forbidden', 'error'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_reason_known') then
    alter table public.mydata_consents add constraint mydata_consents_reason_known
      check (revoke_reason is null or revoke_reason in ('client', 'unlinked', 'link_revoked', 'switched'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_error_known') then
    alter table public.mydata_consents add constraint mydata_consents_error_known
      check (last_error_code is null or last_error_code = any (private.mydata_error_codes()));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_no_self') then
    alter table public.mydata_consents add constraint mydata_consents_no_self check (client_id <> accountant_id);
  end if;
end $c$;

-- ΕΝΑΣ ΕΝΕΡΓΟΣ ΛΟΓΙΣΤΗΣ-ΣΥΓΧΡΟΝΙΣΤΗΣ ΑΝΑ ΠΕΛΑΤΗ. Δύο θα ζητούσαν τα ίδια
-- παραστατικά δύο φορές και θα μάλωναν για τον ίδιο ΜΑΡΚ.
create unique index if not exists mydata_consents_one_active
  on public.mydata_consents (client_id) where revoked_at is null;
create index if not exists mydata_consents_accountant
  on public.mydata_consents (accountant_id) where revoked_at is null;

comment on table public.mydata_consents is
  'Η άδεια του πελάτη να φέρνει ο λογιστής του τα παραστατικά του από το myDATA. Ανακλητή· η γραμμή μένει ως απόδειξη (ΓΚΠΔ 7§1).';

-- ── 3. ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ, ΜΟΝΟ ΤΑ ΠΕΔΙΑ ΤΗΣ ΔΑΠΑΝΗΣ ─────────────────────────────
create table if not exists public.mydata_docs (
  id                uuid primary key default gen_random_uuid(),
  consent_id        uuid not null references public.mydata_consents (id) on delete cascade,
  client_id         uuid not null references auth.users (id) on delete cascade,
  client_afm        text not null,
  mark              bigint not null,
  counterpart_afm   text not null,
  counterpart_name  text,
  doc_type          text not null,
  series            text not null,
  aa                text not null,
  issue_date        date not null,
  title             text not null,
  net_cents         bigint not null,
  vat_cents         bigint not null,
  gross_cents       bigint not null,
  is_credit         boolean not null default false,
  status            text not null default 'pending',
  cancellation_mark bigint,
  expense_id        uuid references public.expenses (id) on delete set null,
  fetched_at        timestamptz not null default now(),
  decided_at        timestamptz,
  unique (client_afm, mark)
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_status_known') then
    alter table public.mydata_docs add constraint mydata_docs_status_known
      check (status in ('pending', 'filed', 'linked', 'dismissed', 'cancelled'));
  end if;
  -- AmountType της ΑΑΔΕ: ≥ 0, ως 15 ψηφία. Το πρόσημο του πιστωτικού το λέει
  -- η σημαία, όχι το ποσό.
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_amounts') then
    alter table public.mydata_docs add constraint mydata_docs_amounts check (
      net_cents between 0 and 999999999999999 and vat_cents between 0 and 999999999999999
      and gross_cents between 0 and 999999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_mark_positive') then
    alter table public.mydata_docs add constraint mydata_docs_mark_positive check (mark > 0);
  end if;
end $c$;

create index if not exists mydata_docs_client_pending on public.mydata_docs (client_id, issue_date desc) where status = 'pending';
create index if not exists mydata_docs_consent on public.mydata_docs (consent_id);
create index if not exists mydata_docs_expense on public.mydata_docs (expense_id);

comment on table public.mydata_docs is
  'Παραστατικά εξόδων του πελάτη από το myDATA: μόνο ΜΑΡΚ, αντισυμβαλλόμενος, τύπος, ημερομηνία και ποσά σε λεπτά, όπως τα δίνει η ΑΑΔΕ. Κανένα ολόκληρο XML.';

-- ── 4. «ΠΑΝΤΑ ΑΓΝΟΗΣΕ ΑΥΤΟΝ ΤΟΝ ΠΑΡΟΧΟ» ───────────────────────────────────────
create table if not exists public.mydata_ignored_providers (
  client_id       uuid not null references auth.users (id) on delete cascade,
  counterpart_afm text not null,
  created_at      timestamptz not null default now(),
  primary key (client_id, counterpart_afm)
);

-- ── 5. ΤΟ ΑΡΧΕΙΟ ΠΡΟΣΒΑΣΗΣ ──────────────────────────────────────────────────
-- Ποιος, πότε, ποιο ΑΦΜ, τι. Μένει μετά την ανάκληση (ΓΚΠΔ 5§2). Φεύγει με τον
-- λογαριασμό του πελάτη· όταν φεύγει ο λογιστής, η γραμμή μένει χωρίς αυτόν.
create table if not exists public.mydata_access_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  client_id     uuid references auth.users (id) on delete cascade,
  accountant_id uuid references auth.users (id) on delete set null,
  actor_id      uuid,
  afm           text,
  action        text not null,
  n             integer,
  detail        text
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_access_log_action_known') then
    alter table public.mydata_access_log add constraint mydata_access_log_action_known check (action in (
      'consent_granted', 'consent_revoked', 'key_saved', 'key_removed', 'key_rejected',
      'sync_fetch', 'sync_failed', 'provider_ignored', 'cancel_removed_expense'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_access_log_detail_code') then
    alter table public.mydata_access_log add constraint mydata_access_log_detail_code
      check (detail is null or detail ~ '^[a-z_]{1,40}$');
  end if;
end $c$;

create index if not exists mydata_access_log_client on public.mydata_access_log (client_id, at desc);
create index if not exists mydata_access_log_accountant on public.mydata_access_log (accountant_id, at desc);

comment on table public.mydata_access_log is
  'Αρχείο πρόσβασης myDATA: ποιος, πότε, ποιο ΑΦΜ, ποια ενέργεια. Κωδικοί, ποτέ κείμενο ή μυστικό. Διατήρηση 24 μήνες.';

create or replace function private.mydata_log(
  p_client uuid, p_accountant uuid, p_actor uuid, p_afm text, p_action text, p_n integer default null, p_detail text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.mydata_access_log (client_id, accountant_id, actor_id, afm, action, n, detail)
  values (p_client, p_accountant, p_actor, p_afm, p_action, p_n, p_detail);
$$;

-- ── 6. RLS ─────────────────────────────────────────────────────────────────
alter table public.mydata_connections       enable row level security;
alter table public.mydata_consents          enable row level security;
alter table public.mydata_docs              enable row level security;
alter table public.mydata_ignored_providers enable row level security;
alter table public.mydata_access_log        enable row level security;

drop policy if exists mydata_connections_own on public.mydata_connections;
create policy mydata_connections_own on public.mydata_connections
  for select to authenticated using (accountant_id = (select auth.uid()));

drop policy if exists mydata_consents_parties on public.mydata_consents;
create policy mydata_consents_parties on public.mydata_consents
  for select to authenticated using (client_id = (select auth.uid()) or accountant_id = (select auth.uid()));

-- Ο πελάτης βλέπει τα δικά του. Ο λογιστής ΜΟΝΟ όσο η συναίνεση ισχύει ΚΑΙ η
-- σύνδεση στο PROPERWISE είναι ζωντανή· με την ανάκληση δεν βλέπει τίποτα.
-- Ο βοηθός ζει στο private (20260812160000): η RLS τον καλεί, το RPC όχι.
create or replace function private.mydata_accountant_sees(p_consent uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mydata_consents c
     where c.id = p_consent
       and c.accountant_id = auth.uid()
       and c.revoked_at is null
       and public.accountant_link_live(c.accountant_id, c.client_id));
$$;
revoke all on function private.mydata_accountant_sees(uuid) from public, anon;
grant execute on function private.mydata_accountant_sees(uuid) to authenticated;

drop policy if exists mydata_docs_parties on public.mydata_docs;
create policy mydata_docs_parties on public.mydata_docs
  for select to authenticated using (
    client_id = (select auth.uid()) or private.mydata_accountant_sees(consent_id));

drop policy if exists mydata_ignored_own on public.mydata_ignored_providers;
create policy mydata_ignored_own on public.mydata_ignored_providers
  for select to authenticated using (client_id = (select auth.uid()));
drop policy if exists mydata_ignored_own_del on public.mydata_ignored_providers;
create policy mydata_ignored_own_del on public.mydata_ignored_providers
  for delete to authenticated using (client_id = (select auth.uid()));

drop policy if exists mydata_access_log_parties on public.mydata_access_log;
create policy mydata_access_log_parties on public.mydata_access_log
  for select to authenticated using (client_id = (select auth.uid()) or accountant_id = (select auth.uid()));

-- Το δεύτερο βήμα (20261003120000): restrictive, όπως σε κάθε πίνακα χρήστη.
drop policy if exists mfa_mydata_connections on public.mydata_connections;
create policy mfa_mydata_connections on public.mydata_connections as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_mydata_consents on public.mydata_consents;
create policy mfa_mydata_consents on public.mydata_consents as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_mydata_docs on public.mydata_docs;
create policy mfa_mydata_docs on public.mydata_docs as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_mydata_ignored on public.mydata_ignored_providers;
create policy mfa_mydata_ignored on public.mydata_ignored_providers as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_mydata_access_log on public.mydata_access_log;
create policy mfa_mydata_access_log on public.mydata_access_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- Καμία εγγραφή απευθείας από πελάτη: όλα περνούν από τις συναρτήσεις.
revoke all on public.mydata_connections, public.mydata_consents, public.mydata_docs,
              public.mydata_ignored_providers, public.mydata_access_log from anon, authenticated;
grant select on public.mydata_connections, public.mydata_consents, public.mydata_docs,
                public.mydata_access_log to authenticated;
grant select, delete on public.mydata_ignored_providers to authenticated;
-- RLS χωρίς καμία πολιτική: κανένας ρόλος πελάτη δεν διαβάζει, ούτε αν κάποτε
-- εκτεθεί το σχήμα. Τη διαβάζουν μόνο οι SECURITY DEFINER του ρόλου υπηρεσίας.
alter table private.mydata_vault enable row level security;
revoke all on private.mydata_vault from public, anon, authenticated;

-- ── 7. ΑΝΑΚΛΗΣΗ: ΜΙΑ ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΚΑΘΕ ΑΙΤΙΑ ─────────────────────────────────
-- Σβήνει τα παραστατικά που τραβήχτηκαν (ΓΚΠΔ 17), όχι τις δαπάνες που έχει
-- ήδη καταχωρήσει ο ίδιος ο πελάτης: εκείνες είναι δικά του βιβλία. Η γραμμή
-- της συναίνεσης και το αρχείο πρόσβασης μένουν.
create or replace function private.mydata_revoke(p_consent uuid, p_reason text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.mydata_consents%rowtype;
  v_n integer;
begin
  update public.mydata_consents
     set revoked_at = now(), revoke_reason = p_reason, resume = null, next_retry_at = null
   where id = p_consent and revoked_at is null
  returning * into v;
  if not found then return 0; end if;
  delete from public.mydata_docs where consent_id = p_consent;
  get diagnostics v_n = row_count;
  perform private.mydata_log(v.client_id, v.accountant_id, p_actor, v.afm, 'consent_revoked', v_n, p_reason);
  return v_n;
end $$;

-- Ο πελάτης αλλάζει λογιστή ή ο λογιστής αφαιρεί τον πελάτη: η σύνδεση στο
-- PROPERWISE σβήνει ή απενεργοποιείται: η άδεια φεύγει μαζί της.
create or replace function private.mydata_unlinked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  if tg_op = 'UPDATE' and (new.active or not old.active) then return new; end if;
  for r in select id from public.mydata_consents
            where client_id = old.owner_id and accountant_id = old.accountant_id and revoked_at is null loop
    perform private.mydata_revoke(r.id, 'unlinked', auth.uid());
  end loop;
  return coalesce(new, old);
end $$;

drop trigger if exists mydata_unlinked on public.accountant_clients;
create trigger mydata_unlinked after update of active or delete on public.accountant_clients
  for each row execute function private.mydata_unlinked();

-- ── 8. ΤΑ ΚΟΥΜΠΙΑ ΤΟΥ ΠΕΛΑΤΗ ───────────────────────────────────────────────
-- «Επιτρέπω». Η περίοδος του πρώτου συγχρονισμού: 1/1 του τρέχοντος ή του
-- προηγούμενου έτους (ώρα Αθήνας). Τίποτα παλιότερο: ελαχιστοποίηση.
create or replace function public.mydata_consent_grant(p_accountant uuid, p_from_year integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_afm  text;
  v_year integer := extract(year from (now() at time zone 'Europe/Athens'))::int;
  v_old  record;
  v_id   uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if p_accountant is null or p_accountant = v_me then return json_build_object('ok', false, 'reason', 'not_linked'); end if;
  if not public.accountant_link_live(p_accountant, v_me) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;
  if p_from_year is null or p_from_year not in (v_year, v_year - 1) then
    return json_build_object('ok', false, 'reason', 'bad_period');
  end if;
  -- Το ΑΦΜ ζητείται ΠΡΙΝ τη συναίνεση: χωρίς σωστό ΑΦΜ δεν υπάρχει τι να ζητηθεί.
  select regexp_replace(coalesce(bp.afm, ''), '[\s.\-]', '', 'g') into v_afm
    from public.billing_profiles bp where bp.user_id = v_me;
  if v_afm is null or not private.mydata_afm_ok(v_afm) then
    return json_build_object('ok', false, 'reason', 'no_afm');
  end if;

  select * into v_old from public.mydata_consents where client_id = v_me and revoked_at is null;
  if found and v_old.accountant_id = p_accountant then
    return json_build_object('ok', true, 'existing', true);
  end if;
  -- Άλλος λογιστής είχε την άδεια: ένας συγχρονιστής ανά πελάτη, άρα αλλάζει.
  if found then perform private.mydata_revoke(v_old.id, 'switched', v_me); end if;

  insert into public.mydata_consents (client_id, accountant_id, afm, window_from)
  values (v_me, p_accountant, v_afm, make_date(p_from_year, 1, 1))
  returning id into v_id;
  perform private.mydata_log(v_me, p_accountant, v_me, v_afm, 'consent_granted', null, null);
  return json_build_object('ok', true, 'existing', false);
end $$;

-- «Ανάκληση», όσο εύκολα δόθηκε (ΓΚΠΔ 7§3).
create or replace function public.mydata_consent_revoke(p_accountant uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_n  integer := 0;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  select id into v_id from public.mydata_consents
   where client_id = v_me and accountant_id = p_accountant and revoked_at is null;
  if v_id is not null then v_n := private.mydata_revoke(v_id, 'client', v_me); end if;
  return json_build_object('ok', true, 'deleted', v_n);
end $$;

-- «Πάντα αγνόησε αυτόν τον πάροχο»: όσα περιμένουν από αυτόν φεύγουν από τα
-- Εισερχόμενα και όσα έρθουν δεν γράφονται καν.
create or replace function public.mydata_ignore_provider(p_afm text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_n  integer;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if p_afm is null or length(p_afm) not between 1 and 30 then return json_build_object('ok', false, 'reason', 'bad_afm'); end if;
  insert into public.mydata_ignored_providers (client_id, counterpart_afm) values (v_me, p_afm)
  on conflict do nothing;
  update public.mydata_docs set status = 'dismissed', decided_at = now()
   where client_id = v_me and counterpart_afm = p_afm and status = 'pending';
  get diagnostics v_n = row_count;
  perform private.mydata_log(v_me, null, v_me, null, 'provider_ignored', v_n, null);
  return json_build_object('ok', true, 'dismissed', v_n);
end $$;

-- «Δεν είναι δαπάνη» για ένα παραστατικό.
create or replace function public.mydata_doc_dismiss(p_doc uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update public.mydata_docs set status = 'dismissed', decided_at = now()
   where id = p_doc and client_id = v_me and status = 'pending';
  return json_build_object('ok', found);
end $$;

-- Η ΚΑΤΑΧΩΡΗΣΗ ΕΓΙΝΕ ΑΠΟ ΤΗΝ ΕΦΑΡΜΟΓΗ, ΜΕ ΤΗΝ RLS ΤΩΝ ΔΑΠΑΝΩΝ. Εδώ μόνο
-- δένεται, ΑΦΟΥ ελεγχθεί ότι η δαπάνη είναι του ίδιου, έχει το αποτύπωμα του
-- ΜΑΡΚ και ΑΚΡΙΒΩΣ τα ποσά της ΑΑΔΕ (με πρόσημο για το πιστωτικό). Μια δαπάνη
-- με άλλο ποσό δεν δένεται ποτέ ως «από το myDATA».
create or replace function public.mydata_doc_filed(p_doc uuid, p_expense uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  d     public.mydata_docs%rowtype;
  e     record;
  v_sig integer;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into d from public.mydata_docs where id = p_doc and client_id = v_me;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if d.status not in ('pending', 'filed') then return json_build_object('ok', false, 'reason', 'not_pending'); end if;
  select id, user_id, amount, vat_amount, dedup_hash into e from public.expenses where id = p_expense;
  v_sig := case when d.is_credit then -1 else 1 end;
  if not found or e.user_id is distinct from v_me
     or e.dedup_hash is distinct from ('mydata:' || d.mark)
     or round(e.amount * 100)::bigint <> v_sig * d.gross_cents
     or round(coalesce(e.vat_amount, 0) * 100)::bigint <> v_sig * d.vat_cents then
    return json_build_object('ok', false, 'reason', 'mismatch');
  end if;
  update public.mydata_docs set status = 'filed', expense_id = p_expense, decided_at = now() where id = p_doc;
  return json_build_object('ok', true);
end $$;

-- ── 9. ΤΑ ΚΟΥΜΠΙΑ ΤΟΥ ΛΟΓΙΣΤΗ ───────────────────────────────────────────────
-- «Αφαίρεση κλειδιού». Το μυστικό σβήνει από το Vault με τη σκανδάλη.
create or replace function public.mydata_key_remove()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  delete from private.mydata_vault where accountant_id = v_me;
  update public.mydata_connections
     set has_key = false, status = 'removed', lease_id = null, lease_at = null, updated_at = now()
   where accountant_id = v_me;
  if found then perform private.mydata_log(null, v_me, v_me, null, 'key_removed', null, null); end if;
  return json_build_object('ok', true);
end $$;

-- Ο πίνακας του λογιστή: ΟΛΟΙ οι συνδεδεμένοι πελάτες του, με την κατάσταση
-- της άδειας. Οσοι δεν έχουν πατήσει «Επιτρέπω» εμφανίζονται μόνο με όνομα,
-- που ο λογιστής βλέπει ήδη στη λίστα του: κανένα δεδομένο τους δεν περνά.
create or replace function public.mydata_clients_status()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(r order by r->>'name') from (
      select json_build_object(
        'ownerId',     ac.owner_id,
        'name',        coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), 'Πελάτης'),
        'consent',     c.id is not null,
        'status',      c.status,
        'lastSyncAt',  c.last_sync_at,
        'lastNew',     c.last_new,
        'error',       c.last_error_code,
        'nextRetryAt', c.next_retry_at,
        'pending',     (select count(*) from public.mydata_docs d where d.consent_id = c.id and d.status = 'pending')
      ) as r
      from public.accountant_clients ac
      left join public.billing_profiles bp on bp.user_id = ac.owner_id
      left join public.mydata_consents c
        on c.client_id = ac.owner_id and c.accountant_id = v_me and c.revoked_at is null
      where ac.accountant_id = v_me and ac.active
        and public.accountant_link_live(v_me, ac.owner_id)
    ) s
  ), '[]'::json);
end $$;

-- Ο πελάτης: ποιος λογιστής έχει την άδεια και τι έγινε τελευταία.
create or replace function public.mydata_my_consent()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return null; end if;
  return (
    select json_build_object(
      'accountantId', c.accountant_id, 'windowFrom', c.window_from, 'grantedAt', c.granted_at,
      'status', c.status, 'lastSyncAt', c.last_sync_at, 'lastNew', c.last_new,
      'error', c.last_error_code, 'nextRetryAt', c.next_retry_at)
      from public.mydata_consents c where c.client_id = v_me and c.revoked_at is null);
end $$;

-- ── 10. ΜΟΝΟ ΓΙΑ ΤΟΝ ΡΟΛΟ ΥΠΗΡΕΣΙΑΣ (η συνάρτηση άκρου mydata-sync) ──────────
-- Αποθήκευση του κλειδιού, ΑΦΟΥ η συνάρτηση το δοκιμάσει στην ΑΑΔΕ. Το κλειδί
-- δεν μπαίνει ποτέ σε μήνυμα σφάλματος: τα `raise` εδώ λένε μόνο κωδικό.
create or replace function public.mydata_key_store(p_accountant uuid, p_user_id text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret uuid;
begin
  if p_accountant is null then raise exception 'mydata_no_accountant'; end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9]{16,200}$' then
    raise exception 'mydata_bad_key_shape';
  end if;
  if p_user_id is null or length(p_user_id) not between 1 and 100 or p_user_id ~ '\s' then raise exception 'mydata_bad_user'; end if;
  select secret_id into v_secret from private.mydata_vault where accountant_id = p_accountant;
  if v_secret is null then
    v_secret := vault.create_secret(p_key, 'mydata_key:' || p_accountant::text, 'myDATA subscription key');
    insert into private.mydata_vault (accountant_id, secret_id) values (p_accountant, v_secret);
  else
    perform vault.update_secret(v_secret, p_key);
  end if;
  insert into public.mydata_connections (accountant_id, aade_user_id, has_key, status)
  values (p_accountant, p_user_id, true, 'active')
  on conflict (accountant_id) do update
    set aade_user_id = excluded.aade_user_id, has_key = true, status = 'active',
        last_error_code = null, updated_at = now();
  perform private.mydata_log(null, p_accountant, p_accountant, null, 'key_saved', null, null);
end $$;

create or replace function public.mydata_key_read(p_accountant uuid)
returns table (aade_user_id text, api_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.aade_user_id, s.decrypted_secret
    from public.mydata_connections c
    join private.mydata_vault v on v.accountant_id = c.accountant_id
    join vault.decrypted_secrets s on s.id = v.secret_id
   where c.accountant_id = p_accountant and c.has_key and c.status = 'active';
$$;

-- Η ΑΣΦΑΛΕΙΑ: ΕΝΑ ΤΡΕΞΙΜΟ ΑΝΑ ΛΟΓΙΣΤΗ. Η μίσθωση λήγει μόνη της στα 10 λεπτά,
-- ώστε μια συνάρτηση που κόπηκε να μην κλειδώνει τον λογιστή για πάντα.
--   manual:  όχι πιο συχνά από μία φορά ανά 5 λεπτά
--   auto:    μόνο αν ο τελευταίος είναι τουλάχιστον 12 ώρες πίσω
--   nightly, retry: πάντα (από το cron)
create or replace function public.mydata_sync_begin(p_accountant uuid, p_kind text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.mydata_connections%rowtype;
  v_lease uuid := gen_random_uuid();
begin
  if p_kind not in ('manual', 'auto', 'nightly', 'retry') then return json_build_object('ok', false, 'reason', 'bad_kind'); end if;
  select * into c from public.mydata_connections where accountant_id = p_accountant for update;
  if not found or not c.has_key then return json_build_object('ok', false, 'reason', 'no_key'); end if;
  if c.status = 'invalid' then return json_build_object('ok', false, 'reason', 'key_invalid'); end if;
  if c.status <> 'active' then return json_build_object('ok', false, 'reason', 'no_key'); end if;
  if p_kind = 'manual' and c.last_manual_at > now() - interval '5 minutes' then
    return json_build_object('ok', false, 'reason', 'too_soon', 'retryAt', c.last_manual_at + interval '5 minutes');
  end if;
  if p_kind = 'auto' and c.last_sync_at > now() - interval '12 hours' then
    return json_build_object('ok', false, 'reason', 'fresh');
  end if;
  if c.lease_id is not null and c.lease_at > now() - interval '10 minutes' then
    return json_build_object('ok', false, 'reason', 'busy');
  end if;
  update public.mydata_connections
     set lease_id = v_lease, lease_at = now(),
         last_manual_at = case when p_kind = 'manual' then now() else last_manual_at end
   where accountant_id = p_accountant;
  return json_build_object('ok', true, 'lease', v_lease);
end $$;

create or replace function private.mydata_lease_ok(p_lease uuid, p_accountant uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.mydata_connections
                  where accountant_id = p_accountant and lease_id = p_lease
                    and lease_at > now() - interval '10 minutes');
$$;

-- Ποιοι πελάτες, με τη σειρά «ο πιο παλιός συγχρονισμός πρώτος». Οσοι έχουν
-- άδεια αλλά η σύνδεση στο PROPERWISE δεν ζει πια, ανακαλούνται ΕΔΩ.
create or replace function public.mydata_sync_targets(p_accountant uuid, p_lease uuid, p_kind text)
returns table (consent_id uuid, afm text, window_from date, last_mark bigint, resume jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  if not private.mydata_lease_ok(p_lease, p_accountant) then return; end if;
  for r in select c.id from public.mydata_consents c
            where c.accountant_id = p_accountant and c.revoked_at is null
              and not public.accountant_link_live(c.accountant_id, c.client_id) loop
    perform private.mydata_revoke(r.id, 'link_revoked', null);
  end loop;
  return query
    select c.id, c.afm, c.window_from, c.last_mark, c.resume
      from public.mydata_consents c
     where c.accountant_id = p_accountant and c.revoked_at is null
       and (p_kind <> 'retry' or (c.next_retry_at is not null and c.next_retry_at <= now()))
       -- «forbidden» (η ΑΑΔΕ αρνείται τον ΑΦΜ) δεν ξαναδοκιμάζεται κάθε 15
       -- λεπτά: μόνο στον νυχτερινό ή όταν το ζητήσει ο λογιστής.
       and (p_kind in ('manual', 'nightly') or c.status <> 'forbidden')
     order by c.last_sync_at nulls first, c.granted_at;
end $$;

-- Ο έλεγχος ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΚΛΗΣΗ ΣΤΗΝ ΑΑΔΕ: άδεια σε ισχύ, σύνδεση ζωντανή,
-- μίσθωση του ίδιου τρεξίματος.
create or replace function public.mydata_consent_live(p_consent uuid, p_lease uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mydata_consents c
     where c.id = p_consent and c.revoked_at is null
       and private.mydata_lease_ok(p_lease, c.accountant_id)
       and public.accountant_link_live(c.accountant_id, c.client_id));
$$;

-- Η ΕΓΓΡΑΦΗ ΜΙΑΣ ΣΕΛΙΔΑΣ. Ξαναελέγχει άδεια και μίσθωση στην ΙΔΙΑ συναλλαγή
-- (κανένα κενό ανάμεσα σε έλεγχο και εγγραφή). Ιδιοδύναμη ανά ΜΑΡΚ.
--   · ίδιος ΜΑΡΚ για το ίδιο ΑΦΜ: ένα, πάντα (μοναδικό κλειδί)
--   · πάροχος στη λίστα «Πάντα αγνόησε»: δεν γράφεται καθόλου
--   · δαπάνη με αποτύπωμα «mydata:<ΜΑΡΚ>» υπάρχει ήδη: «filed», δεμένο
--   · χειροκίνητη ή σαρωμένη δαπάνη με ίδιο ΑΦΜ παρόχου (ή, χωρίς ΑΦΜ, ίδιο
--     όνομα), ίδιο ποσό και ημερομηνία ±3 ημέρες: «linked», δεμένο, χωρίς
--     δεύτερη εγγραφή
--   · ακύρωση: «cancelled»· αν η δαπάνη γεννήθηκε από αυτό το παραστατικό, σβήνει·
--     αν ήταν του χρήστη (linked), μένει και σημειώνεται
--   · ο ΜΑΡΚ προχωρά μόνο όταν τελειώσουν οι σελίδες (p_done)
create or replace function public.mydata_ingest(
  p_lease uuid, p_consent uuid, p_docs jsonb, p_cancels jsonb, p_max_mark bigint, p_resume jsonb, p_done boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        public.mydata_consents%rowtype;
  x        jsonb;
  v_id     uuid;
  v_exp    uuid;
  v_sig    integer;
  v_added  integer := 0;
  v_status text;
  d        public.mydata_docs%rowtype;
begin
  select * into c from public.mydata_consents where id = p_consent for update;
  if not found or c.revoked_at is not null
     or not private.mydata_lease_ok(p_lease, c.accountant_id)
     or not public.accountant_link_live(c.accountant_id, c.client_id) then
    return json_build_object('ok', false, 'added', 0);
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    if exists (select 1 from public.mydata_ignored_providers ip
                where ip.client_id = c.client_id and ip.counterpart_afm = x->>'counterpart_afm') then
      continue;
    end if;
    v_sig := case when (x->>'is_credit')::boolean then -1 else 1 end;
    v_status := case when (x->>'cancelled')::boolean then 'cancelled' else 'pending' end;
    v_exp := null;
    if v_status = 'pending' then
      select e.id into v_exp from public.expenses e
       where e.user_id = c.client_id and e.dedup_hash = 'mydata:' || (x->>'mark') limit 1;
      if v_exp is not null then
        v_status := 'filed';
      else
        select e.id into v_exp from public.expenses e
         where e.user_id = c.client_id
           and round(e.amount * 100)::bigint = v_sig * (x->>'gross_cents')::bigint
           and abs(e.date - (x->>'issue_date')::date) <= 3
           and (e.supplier_afm = x->>'counterpart_afm'
                or (e.supplier_afm is null and x->>'counterpart_name' is not null
                    and lower(btrim(e.store_vendor)) = lower(btrim(x->>'counterpart_name'))))
           and not exists (select 1 from public.mydata_docs m where m.expense_id = e.id)
         order by abs(e.date - (x->>'issue_date')::date), e.created_at
         limit 1;
        if v_exp is not null then v_status := 'linked'; end if;
      end if;
    end if;

    insert into public.mydata_docs (
      consent_id, client_id, client_afm, mark, counterpart_afm, counterpart_name, doc_type, series, aa,
      issue_date, title, net_cents, vat_cents, gross_cents, is_credit, status, cancellation_mark, expense_id,
      decided_at)
    values (
      c.id, c.client_id, c.afm, (x->>'mark')::bigint, left(x->>'counterpart_afm', 30), left(x->>'counterpart_name', 200),
      x->>'doc_type', left(x->>'series', 50), left(x->>'aa', 50), (x->>'issue_date')::date, left(x->>'title', 300),
      (x->>'net_cents')::bigint, (x->>'vat_cents')::bigint, (x->>'gross_cents')::bigint, (x->>'is_credit')::boolean,
      v_status, nullif(x->>'cancellation_mark', '')::bigint, v_exp,
      case when v_status in ('filed', 'linked') then now() end)
    on conflict (client_afm, mark) do nothing
    returning id into v_id;
    if v_id is not null and v_status = 'pending' then v_added := v_added + 1; end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_cancels, '[]'::jsonb)) loop
    select * into d from public.mydata_docs
     where client_afm = c.afm and mark = (x->>'invoice_mark')::bigint for update;
    if not found or d.status = 'cancelled' then continue; end if;
    if d.status = 'filed' and d.expense_id is not null then
      delete from public.expenses
       where id = d.expense_id and user_id = c.client_id and dedup_hash = 'mydata:' || d.mark;
      if found then
        perform private.mydata_log(c.client_id, c.accountant_id, null, c.afm, 'cancel_removed_expense', 1, null);
      end if;
    end if;
    update public.mydata_docs
       set status = 'cancelled', cancellation_mark = (x->>'cancellation_mark')::bigint, decided_at = now()
     where id = d.id;
  end loop;

  if p_done then
    update public.mydata_consents set last_mark = greatest(last_mark, coalesce(p_max_mark, 0)), resume = null where id = c.id;
  else
    update public.mydata_consents set resume = p_resume where id = c.id;
  end if;
  return json_build_object('ok', true, 'added', v_added);
end $$;

-- Το τέλος ενός πελάτη: κατάσταση, αρχείο πρόσβασης, επόμενη προσπάθεια.
create or replace function public.mydata_client_done(
  p_lease uuid, p_consent uuid, p_error text, p_added integer, p_more boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.mydata_consents%rowtype;
  v_err text := case when p_error is null then null
                     when p_error = any (private.mydata_error_codes()) then p_error else 'unknown' end;
begin
  select * into c from public.mydata_consents where id = p_consent;
  if not found or c.revoked_at is not null or not private.mydata_lease_ok(p_lease, c.accountant_id) then return; end if;
  if v_err is null then
    update public.mydata_consents
       set status = 'ok', last_error_code = null, failures = 0, last_sync_at = now(),
           last_new = greatest(coalesce(p_added, 0), 0),
           next_retry_at = case when p_more then now() + interval '1 minute' end
     where id = p_consent;
    perform private.mydata_log(c.client_id, c.accountant_id, null, c.afm, 'sync_fetch', greatest(coalesce(p_added, 0), 0), null);
  elsif v_err = 'not_linked' then
    return;
  else
    update public.mydata_consents
       set status = case when v_err = 'forbidden' then 'forbidden' else 'error' end,
           last_error_code = v_err, failures = failures + 1,
           next_retry_at = case when v_err in ('rate','server','empty','network','timeout','unknown')
                                then now() + private.mydata_retry_after(failures + 1) end
     where id = p_consent;
    perform private.mydata_log(c.client_id, c.accountant_id, null, c.afm, 'sync_failed', null, v_err);
  end if;
end $$;

-- Το τέλος του τρεξίματος. Το 401 γυρίζει τη σύνδεση σε «invalid»: καμία νέα
-- προσπάθεια ώσπου να μπει νέο κλειδί.
create or replace function public.mydata_sync_end(p_accountant uuid, p_lease uuid, p_error text, p_added integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_err text := case when p_error is null then null
                           when p_error = any (private.mydata_error_codes()) then p_error else 'unknown' end;
begin
  update public.mydata_connections
     set lease_id = null, lease_at = null,
         last_sync_at = case when v_err is null then now() else last_sync_at end,
         last_sync_new = case when v_err is null then greatest(coalesce(p_added, 0), 0) else last_sync_new end,
         last_error_code = v_err,
         status = case when v_err = 'auth' then 'invalid' else status end,
         updated_at = now()
   where accountant_id = p_accountant and lease_id = p_lease;
  if v_err = 'auth' then
    perform private.mydata_log(null, p_accountant, null, null, 'key_rejected', null, 'auth');
  end if;
end $$;

-- Ποιοι λογιστές έχουν δουλειά: όλοι με ενεργό κλειδί (νυχτερινός), ή όσοι
-- έχουν πελάτη που περιμένει νέα προσπάθεια (κάθε 15 λεπτά).
create or replace function public.mydata_due_accountants(p_kind text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.accountant_id from public.mydata_connections c
   where c.has_key and c.status = 'active'
     and (p_kind = 'nightly' or exists (
           select 1 from public.mydata_consents k
            where k.accountant_id = c.accountant_id and k.revoked_at is null
              and k.next_retry_at is not null and k.next_retry_at <= now()))
   order by c.last_sync_at nulls first;
$$;

-- ── 11. ΔΙΚΑΙΩΜΑΤΑ ΣΤΙΣ ΣΥΝΑΡΤΗΣΕΙΣ ─────────────────────────────────────────
revoke all on function private.mydata_afm_ok(text), private.mydata_error_codes(), private.mydata_retry_after(integer),
  private.mydata_vault_drop(), private.mydata_log(uuid, uuid, uuid, text, text, integer, text),
  private.mydata_revoke(uuid, text, uuid), private.mydata_unlinked(), private.mydata_lease_ok(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  public.mydata_consent_grant(uuid, integer), public.mydata_consent_revoke(uuid), public.mydata_ignore_provider(text),
  public.mydata_doc_dismiss(uuid), public.mydata_doc_filed(uuid, uuid), public.mydata_key_remove(),
  public.mydata_clients_status(), public.mydata_my_consent()
  from public, anon;
grant execute on function
  public.mydata_consent_grant(uuid, integer), public.mydata_consent_revoke(uuid), public.mydata_ignore_provider(text),
  public.mydata_doc_dismiss(uuid), public.mydata_doc_filed(uuid, uuid), public.mydata_key_remove(),
  public.mydata_clients_status(), public.mydata_my_consent()
  to authenticated;

revoke all on function
  public.mydata_key_store(uuid, text, text), public.mydata_key_read(uuid), public.mydata_sync_begin(uuid, text),
  public.mydata_sync_targets(uuid, uuid, text), public.mydata_consent_live(uuid, uuid),
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, bigint, jsonb, boolean),
  public.mydata_client_done(uuid, uuid, text, integer, boolean), public.mydata_sync_end(uuid, uuid, text, integer),
  public.mydata_due_accountants(text)
  from public, anon, authenticated;
grant execute on function
  public.mydata_key_store(uuid, text, text), public.mydata_key_read(uuid), public.mydata_sync_begin(uuid, text),
  public.mydata_sync_targets(uuid, uuid, text), public.mydata_consent_live(uuid, uuid),
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, bigint, jsonb, boolean),
  public.mydata_client_done(uuid, uuid, text, integer, boolean), public.mydata_sync_end(uuid, uuid, text, integer),
  public.mydata_due_accountants(text)
  to service_role;

-- ── 12. ΤΟ ΟΡΙΟ ΤΩΝ ΔΟΚΙΜΩΝ ΣΥΝΔΕΣΗΣ ─────────────────────────────────────────
-- Ολόκληρος ο κατάλογος, γιατί η τελευταία γραφή είναι η ισχύουσα. Νέο:
-- `mydata_connect`, 10 δοκιμές κλειδιού την ώρα ανά λογιστή.
create or replace function public.send_quota_rule(p_kind text)
returns table (max_units int, window_span interval)
language sql immutable set search_path = public as $$
  select t.max_units, t.window_span
    from (values
      ('client_email',                  3000, interval '24 hours'),
      ('org_invite',                      20, interval '24 hours'),
      ('accountant_invite',               50, interval '24 hours'),
      ('accountant_invite_trial_day',     10, interval '24 hours'),
      ('accountant_invite_trial_total',   25, interval '3650 days'),
      ('test_notification',               10, interval '24 hours'),
      ('tester_code',                      5, interval '24 hours'),
      ('ical_preview',                    60, interval  '1 hour'),
      ('mydata_connect',                  10, interval  '1 hour')
    ) as t(kind, max_units, window_span)
   where t.kind = btrim(coalesce(p_kind, ''))
$$;

alter function public.send_quota_rule(text) owner to postgres;
revoke all     on function public.send_quota_rule(text) from public, anon;
grant  execute on function public.send_quota_rule(text) to authenticated, service_role;

-- ── 13. ΟΡΙΟ ΔΙΑΤΗΡΗΣΗΣ (ΓΚΠΔ 5§1(ε)) ──────────────────────────────────────────
-- Αρχείο πρόσβασης: 24 μήνες. Παραστατικά που έχουν κριθεί (καταχωρήθηκαν,
-- δέθηκαν, απορρίφθηκαν, ακυρώθηκαν): 400 ημέρες· ο ΜΑΡΚ της άδειας εμποδίζει
-- να ξανάρθουν. Τα εκκρεμή μένουν όσο περιμένουν τον ιδιοκτήτη.
create or replace function private.mydata_prune()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mydata_access_log where at < now() - interval '24 months';
  delete from public.mydata_docs
   where status <> 'pending' and coalesce(decided_at, fetched_at) < now() - interval '400 days';
end $$;
revoke all on function private.mydata_prune() from public, anon, authenticated;

-- ── 14. ΖΩΝΤΑΝΗ ΕΝΗΜΕΡΩΣΗ ΟΘΟΝΗΣ (Supabase Realtime, με την ίδια RLS) ──────────
do $r$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mydata_connections') then
      alter publication supabase_realtime add table public.mydata_connections;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mydata_consents') then
      alter publication supabase_realtime add table public.mydata_consents;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mydata_docs') then
      alter publication supabase_realtime add table public.mydata_docs;
    end if;
  end if;
end $r$;

-- ── 15. ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ (ίδιο μοτίβο με το 00000000000002_scheduling.sql) ──
--   mydata-sync-nightly  01:17 UTC (03:17 ή 04:17 Αθήνα): όλοι οι λογιστές
--   mydata-sync-retry    κάθε 15 λεπτά: μόνο πελάτες με νέα προσπάθεια που ήρθε
--   mydata-prune         02:41 UTC: όριο διατήρησης
do $$
declare
  v_base text := private.functions_base_url();
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  -- Χωρίς διεύθυνση δεν μαντεύουμε (20260902140000): καμία εργασία που θα
  -- έδειχνε σε άλλο έργο. Το καθάρισμα δεν χρειάζεται διεύθυνση.
  if exists (select 1 from cron.job where jobname = 'mydata-prune') then perform cron.unschedule('mydata-prune'); end if;
  perform cron.schedule('mydata-prune', '41 2 * * *', $cron$ select private.mydata_prune(); $cron$);
  if v_base is null then
    raise warning '[cron] Το vault δεν έχει functions_base_url: ο συγχρονισμός myDATA δεν προγραμματίστηκε.';
    return;
  end if;
  v_base := regexp_replace(v_base, '/+$', '');

  if exists (select 1 from cron.job where jobname = 'mydata-sync-nightly') then perform cron.unschedule('mydata-sync-nightly'); end if;
  perform cron.schedule('mydata-sync-nightly', '17 1 * * *', format($cron$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object('Content-Type','application/json',
                   'x-cron-secret', (select secret from public.cron_secrets where name = 'email_cron')),
      body    := '{"action":"sync-all"}'::jsonb, timeout_milliseconds := 150000);
  $cron$, v_base || '/functions/v1/mydata-sync'));

  if exists (select 1 from cron.job where jobname = 'mydata-sync-retry') then perform cron.unschedule('mydata-sync-retry'); end if;
  perform cron.schedule('mydata-sync-retry', '*/15 * * * *', format($cron$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object('Content-Type','application/json',
                   'x-cron-secret', (select secret from public.cron_secrets where name = 'email_cron')),
      body    := '{"action":"retry-due"}'::jsonb, timeout_milliseconds := 150000);
  $cron$, v_base || '/functions/v1/mydata-sync'));

end $$;
