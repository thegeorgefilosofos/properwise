-- ═══════════════════════════════════════════════════════════════════════════
-- myDATA: ΘΩΡΑΚΙΣΗ ΠΡΙΝ ΑΝΟΙΞΕΙ Η ΣΗΜΑΙΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Δύο ανεξάρτητοι έλεγχοι στις 24/11/2026 πάνω στο Α1 (20261123100000) και στο
-- Α2 (20261123160000): λογιστικός (ορθότητα) και νομικός (ΓΚΠΔ). Η σημαία
-- (NEXT_PUBLIC_MYDATA_SYNC / MYDATA_SYNC_ENABLED) μένει κλειστή.
--
-- ΠΗΓΕΣ (προστατευμένη διαδρομή, άρα γραμμένες ρητά):
--   ΓΚΠΔ (Κανονισμός 2016/679): 5§1(γ) ελαχιστοποίηση, 5§1(ε) όριο διατήρησης,
--   7§1 απόδειξη συγκατάθεσης, 9§2(α) ρητή συγκατάθεση για ειδικές κατηγορίες,
--   32§1(β) δεύτερο βήμα για όποιον βλέπει δεδομένα τρίτων. EDPB Guidelines
--   05/2020 (συγκατάθεση) §§ 104-108: τεκμηρίωση του κειμένου που είδε ο χρήστης.
--   ΑΑΔΕ, myDATA REST API ERP v2.0.2 (09/2026): InvoiceHeaderType,
--   `correlatedInvoices` (xs:long, 0..ν, ΜΑΡΚ συσχετιζόμενων)· Παράρτημα 8.1
--   (5.1 «Πιστωτικό Τιμολόγιο / Συσχετιζόμενο»).
--   ν. 4172/2013 (ΚΦΕ) άρθρο 23 περ. β΄, ΠΟΛ.1113/2015 και ΠΟΛ.1079/2015: το
--   όριο κρίνεται στην αξία ΠΡΟ ΦΠΑ. Η τιμή δεν αλλάζει
--   (data/accounting-sources.json)· τη σύγκριση την κάνει η συνάρτηση άκρου.
--
-- ΤΙ ΑΛΛΑΖΕΙ
--   1. ΔΕΥΤΕΡΟ ΒΗΜΑ ΓΙΑ ΚΑΘΕ ΕΝΕΡΓΕΙΑ myDATA ΤΟΥ ΛΟΓΙΣΤΗ, ακόμη και χωρίς
--      γραφείο και χωρίς δηλωμένη συσκευή (`private.mydata_aal2`): πολιτικές
--      ανάγνωσης, πίνακας πελατών (που κρατά και την πύλη της συνάρτησης άκρου
--      για αποθήκευση κλειδιού και συγχρονισμό), επιβεβαίωση ΑΦΜ, αφαίρεση κλειδιού.
--   2. Ο ΛΟΓΙΣΤΗΣ ΒΛΕΠΕΙ ΜΟΝΟ Ο,ΤΙ ΚΑΤΑΧΩΡΗΘΗΚΕ (`filed`, `linked`). Τα
--      εκκρεμή και τα απορριφθέντα μένουν μόνο στον ιδιοκτήτη· για τα εκκρεμή
--      ο λογιστής βλέπει μόνο πλήθος (`mydata_clients_status`).
--   3. ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ: «Δεν αφορά ακίνητο» και «Πάντα αγνόησε» μηδενίζουν
--      αμέσως εκδότη, ποσά, ημερομηνία και τίτλο. Μένουν ΜΑΡΚ και απόφαση.
--   4. ΔΙΑΤΗΡΗΣΗ: τα εκκρεμή σβήνουν σε 90 ημέρες, οι ανακλημένες άδειες σε
--      1825 (lib/mydata/retention.ts· τις διάρκειες τις αποφασίζει ο ιδιοκτήτης).
--   5. ΣΥΝΑΙΝΕΣΗ ΜΕ ΕΚΔΟΣΗ ΚΑΙ ΑΠΟΤΥΠΩΜΑ ΚΕΙΜΕΝΟΥ και ρητό τικ για πιθανά
--      δεδομένα υγείας. Αλλαγή λογιστή μόνο με ρητή επιβεβαίωση (`p_switch`).
--   6. ΑΥΤΟΜΑΤΟ ΜΟΝΟ ΜΕ ΙΣΤΟΡΙΚΟ ΑΝΑ (ΑΦΜ ΕΚΔΟΤΗ + ΑΚΙΝΗΤΟ): ο λογαριασμός ΔΕΗ
--      της κατοικίας δεν μπαίνει ως «Ρεύμα» του μισθωμένου επειδή ο χρήστης
--      καταχώρησε κάποτε άλλη ΔΕΗ. (Η συνάρτηση άκρου δεν στέλνει καν `auto`
--      για πάροχο χωρίς `checkedAt`, lib/mydata/providers.ts.)
--   7. ΔΙΠΛΕΣ ΔΑΠΑΝΕΣ: ανεκτικό ταίριασμα με χειροκίνητη δαπάνη (ίδιο ακίνητο,
--      ΑΦΜ εκδότη ή κατηγορία, ποσό ±1€ ή ίδιος αριθμός, ±10 ημέρες από έκδοση
--      ή πληρωμή). Ακύρωση και επανέκδοση δένουν στην ίδια δαπάνη. Ακύρωση
--      δεμένου με χειροκίνητη δαπάνη: «Θέλει έλεγχο». Πιστωτικό με
--      `correlatedInvoices` δένεται με το αρχικό.
--   8. `expenses.paid_on`: η ημερομηνία πληρωμής, μόνο όταν τη γράψει ο χρήστης.
--
-- RLS. Κανένας νέος πίνακας. Οι νέες στήλες ανήκουν σε πίνακες με RLS και
-- πολιτική MFA (20261123100000, expenses). Οι συναρτήσεις είναι SECURITY
-- DEFINER με `search_path = ''` και κρίνουν μόνες τους ποιος ρωτά.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. ΣΤΗΛΕΣ ΚΑΙ ΚΑΝΟΝΕΣ ───────────────────────────────────────────────────
alter table public.expenses add column if not exists paid_on date;
comment on column public.expenses.paid_on is
  'Ημερομηνία πληρωμής, μόνο όταν τη γράψει ο χρήστης. Ποτέ η ημερομηνία έκδοσης παραστατικού.';

alter table public.mydata_consents add column if not exists consent_text_version text;
alter table public.mydata_consents add column if not exists consent_text_hash text;
alter table public.mydata_consents add column if not exists health_consent boolean not null default false;
comment on column public.mydata_consents.consent_text_version is
  'Η έκδοση του κειμένου που είδε ο χρήστης στο «Επιτρέπω» (lib/mydata/consentText.ts). ΓΚΠΔ 7§1.';
comment on column public.mydata_consents.consent_text_hash is
  'SHA-256 του κειμένου της έκδοσης, όπως το έδειξε η οθόνη.';
comment on column public.mydata_consents.health_consent is
  'Ρητή συγκατάθεση για παραστατικά που μπορεί να φανερώνουν στοιχεία υγείας (ΓΚΠΔ 9§2(α)).';

alter table public.mydata_docs add column if not exists prev_expense_id uuid references public.expenses (id) on delete set null;
alter table public.mydata_docs add column if not exists correlated_mark bigint;
alter table public.mydata_docs add column if not exists correlated_doc_id uuid references public.mydata_docs (id) on delete set null;
create index if not exists mydata_docs_prev_expense on public.mydata_docs (prev_expense_id) where prev_expense_id is not null;
create index if not exists mydata_docs_correlated on public.mydata_docs (correlated_doc_id) where correlated_doc_id is not null;
comment on column public.mydata_docs.prev_expense_id is
  'Η δαπάνη που είχε το παραστατικό πριν ακυρωθεί. Η επανέκδοση δένεται σε αυτήν.';

-- Η ελαχιστοποίηση θέλει κενά πεδία· μόνο ένα απορριφθέν μπορεί να τα έχει.
alter table public.mydata_docs
  alter column counterpart_afm drop not null, alter column doc_type drop not null,
  alter column series drop not null, alter column aa drop not null,
  alter column issue_date drop not null, alter column title drop not null,
  alter column net_cents drop not null, alter column vat_cents drop not null,
  alter column gross_cents drop not null;

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_fields_or_minimized') then
    alter table public.mydata_docs add constraint mydata_docs_fields_or_minimized check (
      status = 'dismissed' or (
        counterpart_afm is not null and doc_type is not null and series is not null and aa is not null
        and issue_date is not null and title is not null and net_cents is not null
        and vat_cents is not null and gross_cents is not null));
  end if;
  if exists (select 1 from pg_constraint where conname = 'mydata_docs_attention_known') then
    alter table public.mydata_docs drop constraint mydata_docs_attention_known;
  end if;
  alter table public.mydata_docs add constraint mydata_docs_attention_known
    check (needs_attention is null or needs_attention in ('cancelled_after_filing', 'cancelled_linked'));
  if exists (select 1 from pg_constraint where conname = 'mydata_docs_reasons_known') then
    alter table public.mydata_docs drop constraint mydata_docs_reasons_known;
  end if;
  alter table public.mydata_docs add constraint mydata_docs_reasons_known check (review_reasons <@ array[
    'over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'provider_unchecked',
    'unknown_provider', 'pick_property']::text[]);
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_text_shape') then
    alter table public.mydata_consents add constraint mydata_consents_text_shape check (
      (consent_text_version is null or consent_text_version ~ '^\d{4}-\d{2}-\d{2}$')
      and (consent_text_hash is null or consent_text_hash ~ '^[0-9a-f]{64}$'));
  end if;
  if exists (select 1 from pg_constraint where conname = 'mydata_access_log_action_known') then
    alter table public.mydata_access_log drop constraint mydata_access_log_action_known;
  end if;
  alter table public.mydata_access_log add constraint mydata_access_log_action_known check (action in (
    'consent_granted', 'consent_revoked', 'consent_paused', 'afm_confirmed',
    'key_saved', 'key_removed', 'key_rejected',
    'sync_fetch', 'sync_done', 'sync_failed', 'page_rejected', 'invalid_quarantined',
    'provider_ignored', 'cancel_flagged', 'cancel_removed_expense', 'key_read',
    'auto_filed', 'auto_undone', 'not_property', 'reissue_linked'));
end $c$;

-- Οσα απορρίφθηκαν ΠΡΙΝ από αυτή τη μετανάστευση: ίδια ελαχιστοποίηση τώρα.
update public.mydata_docs
   set counterpart_afm = null, counterpart_name = null, doc_type = null, series = null, aa = null,
       issue_date = null, title = null, net_cents = null, vat_cents = null, gross_cents = null,
       category = null, review_reasons = '{}', tier = null, correlated_mark = null
 where status = 'dismissed';

-- ── 1. ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΤΟΥ ΛΟΓΙΣΤΗ ───────────────────────────────────────────
-- Το `mfa_satisfied` περνά όποιον δεν έχει δηλώσει συσκευή και δεν είναι μέλος
-- γραφείου (20261104150000). Για τον λογιστή του myDATA αυτό δεν αρκεί: το
-- κλειδί του ανοίγει στην ΑΑΔΕ όλους τους πελάτες του. Μόνο `aal2`.
create or replace function private.mydata_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function private.mydata_aal2() from public, anon;
grant execute on function private.mydata_aal2() to authenticated;

-- Ο λογιστής βλέπει ένα παραστατικό μόνο με δεύτερο βήμα, όσο ισχύει η άδεια
-- και η σύνδεση, και ΜΟΝΟ όταν έχει καταχωρηθεί.
create or replace function private.mydata_accountant_sees(p_consent uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select private.mydata_aal2() and exists (
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
    client_id = (select auth.uid())
    or (status in ('filed', 'linked') and private.mydata_accountant_sees(consent_id)));

drop policy if exists mydata_connections_own on public.mydata_connections;
create policy mydata_connections_own on public.mydata_connections
  for select to authenticated using (accountant_id = (select auth.uid()) and (select private.mydata_aal2()));

drop policy if exists mydata_consents_parties on public.mydata_consents;
create policy mydata_consents_parties on public.mydata_consents
  for select to authenticated using (
    client_id = (select auth.uid()) or (accountant_id = (select auth.uid()) and (select private.mydata_aal2())));

drop policy if exists mydata_access_log_parties on public.mydata_access_log;
create policy mydata_access_log_parties on public.mydata_access_log
  for select to authenticated using (
    client_id = (select auth.uid()) or (accountant_id = (select auth.uid()) and (select private.mydata_aal2())));

drop policy if exists mydata_afm_confirmations_own on public.mydata_afm_confirmations;
create policy mydata_afm_confirmations_own on public.mydata_afm_confirmations
  for select to authenticated using (accountant_id = (select auth.uid()) and (select private.mydata_aal2()));

-- Ο πίνακας του λογιστή. Ιδιο σώμα με την 20261123100000, με `aal2`. Την
-- ρωτά και η συνάρτηση άκρου πριν από «Σύνδεση» και «Συγχρονισμός»: χωρίς
-- δεύτερο βήμα απαντά `mfa_required` και δεν φυλάγεται ούτε ζητείται τίποτα.
create or replace function public.mydata_clients_status()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() or not private.mydata_aal2() then
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
        -- Μόνο πλήθος: το περιεχόμενο των εκκρεμών μένει στον ιδιοκτήτη.
        'pending',     (select count(*) from public.mydata_docs d where d.consent_id = c.id and d.status = 'pending'),
        'afmConfirmed', exists (select 1 from public.mydata_afm_confirmations f
                                 where f.accountant_id = v_me and f.client_id = ac.owner_id),
        'quarantined', (select count(*) from public.mydata_quarantine q where q.consent_id = c.id),
        'afmChangedAt', (select x.changed_at from private.mydata_afm_changes x
                          where x.client_id = ac.owner_id and x.changed_at > ac.linked_at)
      ) as r
      from public.accountant_clients ac
      left join public.billing_profiles bp on bp.user_id = ac.owner_id
      left join public.mydata_consents c
        on c.client_id = ac.owner_id and c.accountant_id = v_me and c.revoked_at is null
      where ac.accountant_id = v_me and ac.active
        and private.mydata_link_state(v_me, ac.owner_id) <> 'dead'
    ) s
  ), '[]'::json);
end $$;

-- «Επιβεβαίωση ΑΦΜ»: ίδιο σώμα με την 20261123100000, με `aal2`.
create or replace function public.mydata_confirm_afm(p_owner uuid, p_afm text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  v_afm text := private.mydata_clean_afm(p_afm);
begin
  if not private.mfa_satisfied() or not private.mydata_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if p_owner is null or not exists (
       select 1 from public.accountant_clients ac where ac.accountant_id = v_me and ac.owner_id = p_owner and ac.active)
     or not public.accountant_link_live(v_me, p_owner) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;
  if not private.mydata_afm_ok(v_afm) then return json_build_object('ok', false, 'reason', 'bad_afm'); end if;
  if exists (select 1 from public.mydata_afm_confirmations f
              where f.accountant_id = v_me and f.afm = v_afm and f.client_id <> p_owner) then
    return json_build_object('ok', false, 'reason', 'afm_taken');
  end if;
  begin
    insert into public.mydata_afm_confirmations (accountant_id, client_id, afm)
    values (v_me, p_owner, v_afm)
    on conflict (accountant_id, client_id) do update set afm = excluded.afm, confirmed_at = now();
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'afm_taken');
  end;
  perform private.mydata_log(p_owner, v_me, v_me, v_afm, 'afm_confirmed', null, null);
  return json_build_object('ok', true);
end $$;

-- «Αφαίρεση κλειδιού»: ίδιο σώμα, με `aal2`.
create or replace function public.mydata_key_remove()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() or not private.mydata_aal2() then
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

-- ── 2. Η ΣΥΝΑΙΝΕΣΗ: ΚΕΙΜΕΝΟ, ΥΓΕΙΑ, ΑΛΛΑΓΗ ΛΟΓΙΣΤΗ ─────────────────────────────
-- Οι εκδόσεις που δέχεται η βάση, με το αποτύπωμα (SHA-256) του κειμένου τους.
-- Ιδια με το lib/mydata/consentText.ts· το consentText.test.ts το ελέγχει.
create or replace function private.mydata_consent_text_ok(p_version text, p_hash text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_version, p_hash) in (
    ('2026-11-24', 'a3b599d95e82ca8cc40004d190900d1e25158dca00eb83224f64a7ef4d1519ab'));
$$;
revoke all on function private.mydata_consent_text_ok(text, text) from public, anon, authenticated;

-- Η παλιά υπογραφή δεν κρατούσε κείμενο: φεύγει, ώστε καμία άδεια να μη
-- δίνεται χωρίς απόδειξη του τι διάβασε ο χρήστης.
drop function if exists public.mydata_consent_grant(uuid, integer);
create or replace function public.mydata_consent_grant(
  p_accountant uuid, p_from_year integer, p_text_version text, p_text_hash text, p_health boolean,
  p_switch boolean default false)
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
  v_conf text;
  v_drop integer;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if not private.mydata_consent_text_ok(p_text_version, p_text_hash) then
    return json_build_object('ok', false, 'reason', 'text_outdated');
  end if;
  if p_health is not true then return json_build_object('ok', false, 'reason', 'health_unchecked'); end if;
  if p_accountant is null or p_accountant = v_me then return json_build_object('ok', false, 'reason', 'not_linked'); end if;
  if not exists (select 1 from public.accountant_clients ac
                  where ac.accountant_id = p_accountant and ac.owner_id = v_me and ac.active)
     or not public.accountant_link_live(p_accountant, v_me) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;
  if p_from_year is null or p_from_year not in (v_year, v_year - 1) then
    return json_build_object('ok', false, 'reason', 'bad_period');
  end if;
  select private.mydata_clean_afm(bp.afm) into v_afm
    from public.billing_profiles bp where bp.user_id = v_me;
  if v_afm is null or not private.mydata_afm_ok(v_afm) then
    return json_build_object('ok', false, 'reason', 'no_afm');
  end if;
  select f.afm into v_conf from public.mydata_afm_confirmations f
   where f.accountant_id = p_accountant and f.client_id = v_me;
  if v_conf is null then return json_build_object('ok', false, 'reason', 'afm_unconfirmed'); end if;
  if v_conf <> v_afm then return json_build_object('ok', false, 'reason', 'afm_mismatch'); end if;
  if exists (select 1 from public.mydata_consents k
              where k.afm = v_afm and k.revoked_at is null and k.client_id <> v_me) then
    return json_build_object('ok', false, 'reason', 'afm_taken');
  end if;

  select * into v_old from public.mydata_consents where client_id = v_me and revoked_at is null;
  if found and v_old.accountant_id = p_accountant then
    return json_build_object('ok', true, 'existing', true);
  end if;
  -- ΑΛΛΑΓΗ ΛΟΓΙΣΤΗ ΜΟΝΟ ΜΕ ΡΗΤΗ ΕΠΙΒΕΒΑΙΩΣΗ (Σ6 νομικού ελέγχου). Η οθόνη λέει
  -- πόσα σβήνουν: τα παραστατικά που δεν καταχωρήθηκαν. Οι δαπάνες μένουν.
  if found and p_switch is not true then
    return json_build_object('ok', false, 'reason', 'switch_confirm',
      'pending', (select count(*) from public.mydata_docs d where d.consent_id = v_old.id and d.status not in ('filed', 'linked')));
  end if;
  if found then v_drop := private.mydata_revoke(v_old.id, 'switched', v_me); end if;

  insert into public.mydata_consents (client_id, accountant_id, afm, window_from, consent_text_version, consent_text_hash, health_consent)
  values (v_me, p_accountant, v_afm, make_date(p_from_year, 1, 1), p_text_version, p_text_hash, true)
  returning id into v_id;
  perform private.mydata_log(v_me, p_accountant, v_me, v_afm, 'consent_granted', null, null);
  return json_build_object('ok', true, 'existing', false, 'deleted', coalesce(v_drop, 0));
end $$;

-- ── 3. ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ ΣΤΗΝ ΑΠΟΡΡΙΨΗ ───────────────────────────────────────────
-- Μένουν ΜΑΡΚ (για να μην ξανάρθει), ΑΦΜ του πελάτη, άδεια και απόφαση.
create or replace function private.mydata_minimize(p_client uuid, p_doc uuid, p_afm text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  update public.mydata_docs
     set status = 'dismissed', decided_at = now(),
         counterpart_afm = null, counterpart_name = null, doc_type = null, series = null, aa = null,
         issue_date = null, title = null, net_cents = null, vat_cents = null, gross_cents = null,
         category = null, review_reasons = '{}', tier = null, correlated_mark = null, correlated_doc_id = null
   where client_id = p_client and status = 'pending'
     and ((p_doc is not null and id = p_doc) or (p_afm is not null and counterpart_afm = p_afm));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.mydata_minimize(uuid, uuid, text) from public, anon, authenticated;

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
  if p_doc is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', private.mydata_minimize(v_me, p_doc, null) > 0);
end $$;

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
  v_n := private.mydata_minimize(v_me, null, p_afm);
  perform private.mydata_log(v_me, null, v_me, null, 'provider_ignored', v_n, null);
  return json_build_object('ok', true, 'dismissed', v_n);
end $$;

-- ── 4. ΤΟ ΤΑΙΡΙΑΣΜΑ ΜΕ ΧΕΙΡΟΚΙΝΗΤΗ ΔΑΠΑΝΗ ──────────────────────────────────────
-- Σ2 λογιστικού ελέγχου: ο χρήστης περνά τον λογαριασμό με την ημερομηνία που
-- τον πλήρωσε και συχνά με στρογγυλεμένο ποσό. Ταιριάζει δαπάνη του ίδιου
-- χρήστη που ΔΕΝ γεννήθηκε από το myDATA και δεν είναι δεμένη αλλού, με:
--   · ίδιο ακίνητο, όταν το ξέρουμε·
--   · ίδιο ΑΦΜ εκδότη, ή (χωρίς ΑΦΜ) ίδια επωνυμία, ή ίδια κατηγορία·
--   · ποσό ±1€ (100 λεπτά), ή ο αριθμός του παραστατικού στην περιγραφή ή στις
--     σημειώσεις (τουλάχιστον 3 χαρακτήρες)·
--   · ημερομηνία ή ημερομηνία πληρωμής ±10 ημέρες από την έκδοση.
-- Ο πιο κοντινός σε ποσό και ημερομηνία.
create or replace function private.mydata_match_expense(
  p_client uuid, p_property uuid, p_afm text, p_name text, p_label text, p_signed_cents bigint, p_aa text, p_date date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.expenses e
   where e.user_id = p_client
     and (p_property is null or e.property_id = p_property)
     and (e.dedup_hash is null or e.dedup_hash not like 'mydata:%')
     and (e.supplier_afm = p_afm
          or (e.supplier_afm is null and nullif(btrim(p_name), '') is not null
              and lower(btrim(e.store_vendor)) = lower(btrim(p_name)))
          or (nullif(btrim(p_label), '') is not null and e.category = btrim(p_label)))
     and (abs(round(e.amount * 100)::bigint - p_signed_cents) <= 100
          or (length(btrim(coalesce(p_aa, ''))) >= 3
              and position(lower(btrim(p_aa)) in lower(coalesce(e.description, '') || ' ' || coalesce(e.notes, ''))) > 0))
     and (abs(e.date - p_date) <= 10 or (e.paid_on is not null and abs(e.paid_on - p_date) <= 10))
     and not exists (select 1 from public.mydata_docs m where m.expense_id = e.id)
   order by abs(round(e.amount * 100)::bigint - p_signed_cents), abs(e.date - p_date), e.created_at
   limit 1;
$$;
revoke all on function private.mydata_match_expense(uuid, uuid, text, text, text, bigint, text, date) from public, anon, authenticated;

-- Η κάρτα «Για έλεγχο» ρωτά «Είναι η ίδια με …;» πριν από νέα καταχώρηση.
create or replace function public.mydata_doc_match(p_doc uuid, p_property uuid, p_label text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  d     public.mydata_docs%rowtype;
  v_exp uuid;
  e     record;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into d from public.mydata_docs where id = p_doc and client_id = v_me and status = 'pending';
  if not found then return null; end if;
  v_exp := private.mydata_match_expense(v_me, p_property, d.counterpart_afm, d.counterpart_name, p_label,
             case when d.is_credit then -1 else 1 end * d.gross_cents, d.aa, d.issue_date);
  if v_exp is null then return null; end if;
  select id, description, amount, date, store_vendor into e from public.expenses where id = v_exp;
  return json_build_object('expenseId', e.id, 'description', e.description, 'amount', e.amount,
                           'date', e.date, 'vendor', e.store_vendor);
end $$;

-- «Είναι η ίδια»: δένει, ΑΦΟΥ ξαναελέγξει ότι η δαπάνη ταιριάζει ακόμη.
create or replace function public.mydata_doc_link(p_doc uuid, p_expense uuid, p_property uuid, p_label text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  d     public.mydata_docs%rowtype;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into d from public.mydata_docs where id = p_doc and client_id = v_me and status = 'pending' for update;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_expense is null or p_expense is distinct from private.mydata_match_expense(
       v_me, p_property, d.counterpart_afm, d.counterpart_name, p_label,
       case when d.is_credit then -1 else 1 end * d.gross_cents, d.aa, d.issue_date) then
    return json_build_object('ok', false, 'reason', 'mismatch');
  end if;
  update public.mydata_docs
     set status = 'linked', expense_id = p_expense, decided_at = now(), filed_by = 'user'
   where id = d.id;
  return json_build_object('ok', true);
end $$;

-- ── 5. Η ΕΓΓΡΑΦΗ ΜΙΑΣ ΣΕΛΙΔΑΣ ─────────────────────────────────────────────────
-- Ιδια με την 20261123160000, με τέσσερις αλλαγές:
--   (α) ΟΙ ΑΚΥΡΩΣΕΙΣ ΠΡΩΤΑ. Ενα παραστατικό που έρχεται ήδη ακυρωμένο έχει το
--       δικό του `cancelled`· οι ακυρώσεις αφορούν όσα υπάρχουν ήδη. Ετσι η
--       επανέκδοση της ίδιας σελίδας βρίσκει την ακύρωση και δένεται στην ίδια
--       δαπάνη, αντί να γεννήσει δεύτερη. Η δαπάνη του ακυρωμένου πάει στο
--       `prev_expense_id`· δεμένο με χειροκίνητη δαπάνη παίρνει «Θέλει έλεγχο».
--   (β) ταίριασμα με χειροκίνητη δαπάνη με τον ανεκτικό κανόνα της §4·
--   (γ) αυτόματο μόνο με επιβεβαίωση του ίδιου παρόχου για το ίδιο ακίνητο·
--   (δ) πιστωτικό με `correlated_mark`: δένεται με το αρχικό και παίρνει την
--       κατηγορία του.
drop function if exists public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean, integer);
create or replace function public.mydata_ingest(
  p_lease uuid, p_consent uuid, p_docs jsonb, p_cancels jsonb, p_quarantine jsonb, p_fetched integer,
  p_max_mark bigint, p_resume jsonb, p_done boolean, p_rejected integer default 0)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c         public.mydata_consents%rowtype;
  x         jsonb;
  v_id      uuid;
  v_exp     uuid;
  v_sig     integer;
  v_added   integer := 0;
  v_auto    integer := 0;
  v_reissue integer := 0;
  v_status  text;
  v_tier    text;
  v_cat     text;
  v_reasons text[];
  v_by      text;
  v_prop    uuid;
  v_label   text;
  v_group   text;
  v_corr    uuid;
  v_cmark   bigint;
  d         public.mydata_docs%rowtype;
  o         public.mydata_docs%rowtype;
  k         public.mydata_connections%rowtype;
  v_n       integer := greatest(coalesce(p_fetched, 0), 0);
  v_rej     integer := least(greatest(coalesce(p_rejected, 0), 0), 100000);
begin
  select * into c from public.mydata_consents where id = p_consent for update;
  if not found then return json_build_object('ok', false, 'added', 0); end if;
  select * into k from public.mydata_connections where accountant_id = c.accountant_id;
  if not private.mydata_lease_ok(p_lease, c.accountant_id) then
    return json_build_object('ok', false, 'added', 0);
  end if;
  if not private.mydata_consent_ok(c.id, p_lease) then
    perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'page_rejected', v_n, k.lease_kind);
    return json_build_object('ok', false, 'added', 0);
  end if;
  perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'sync_fetch', v_n, k.lease_kind);
  v_prop := private.mydata_one_property(c.client_id);

  -- (α) ΟΙ ΑΚΥΡΩΣΕΙΣ.
  for x in select * from jsonb_array_elements(coalesce(p_cancels, '[]'::jsonb)) loop
    select * into d from public.mydata_docs
     where client_id = c.client_id and client_afm = c.afm and mark = (x->>'invoice_mark')::bigint for update;
    if not found or d.status = 'cancelled' then continue; end if;
    update public.mydata_docs
       set status = 'cancelled', cancellation_mark = (x->>'cancellation_mark')::bigint, decided_at = now(),
           prev_expense_id = d.expense_id, expense_id = null,
           needs_attention = case
             when d.expense_id is null then null
             when d.status = 'filed' then 'cancelled_after_filing'
             when d.status = 'linked' then 'cancelled_linked' end
     where id = d.id;
    if d.expense_id is not null and d.status in ('filed', 'linked') then
      perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'cancel_flagged', 1, k.lease_kind);
      -- Η επανέκδοση ήρθε ΠΡΙΝ από την ακύρωση και περιμένει: δένεται τώρα.
      select * into o from public.mydata_docs r
       where r.client_id = c.client_id and r.status = 'pending' and r.expense_id is null and not r.is_credit
         and r.counterpart_afm = d.counterpart_afm and r.mark <> d.mark
         and abs(r.gross_cents - d.gross_cents) <= 100 and abs(r.issue_date - d.issue_date) <= 30
       order by abs(r.gross_cents - d.gross_cents), abs(r.issue_date - d.issue_date)
       limit 1 for update;
      if found and exists (select 1 from public.expenses e where e.id = d.expense_id) then
        update public.mydata_docs set status = 'linked', expense_id = d.expense_id, decided_at = now() where id = o.id;
        update public.mydata_docs set needs_attention = null where id = d.id;
        v_reissue := v_reissue + 1;
      end if;
    end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    if exists (select 1 from public.mydata_ignored_providers ip
                where ip.client_id = c.client_id and ip.counterpart_afm = x->>'counterpart_afm') then
      v_rej := v_rej + 1;
      continue;
    end if;
    if exists (select 1 from public.mydata_docs m where m.client_afm = c.afm and m.mark = (x->>'mark')::bigint) then
      continue;
    end if;
    v_sig := case when (x->>'is_credit')::boolean then -1 else 1 end;
    v_status := case when (x->>'cancelled')::boolean then 'cancelled' else 'pending' end;
    v_tier := case when x->>'tier' = 'auto' then 'auto' else 'review' end;
    v_cat := case when x->>'category' ~ '^[a-z_]{1,32}$' then x->>'category' end;
    v_reasons := array(
      select distinct r from jsonb_array_elements_text(case when jsonb_typeof(x->'reasons') = 'array' then x->'reasons' else '[]'::jsonb end) r
       where r in ('over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'provider_unchecked', 'unknown_provider')
       order by r);
    v_by := null;
    v_exp := null;
    v_corr := null;
    v_cmark := case when x->>'correlated_mark' ~ '^[1-9][0-9]{0,18}$' then (x->>'correlated_mark')::bigint end;

    -- (δ) ΠΙΣΤΩΤΙΚΟ ΣΥΣΧΕΤΙΖΟΜΕΝΟ: το αρχικό δίνει κατηγορία.
    if (x->>'is_credit')::boolean and v_cmark is not null then
      select * into o from public.mydata_docs m where m.client_afm = c.afm and m.mark = v_cmark and m.client_id = c.client_id;
      if found then
        v_corr := o.id;
        v_cat := coalesce(o.category, v_cat);
      end if;
    end if;

    if v_status = 'pending' then
      select e.id into v_exp from public.expenses e
       where e.user_id = c.client_id and e.dedup_hash = 'mydata:' || (x->>'mark') limit 1;
      if v_exp is not null then
        v_status := 'filed';
      else
        -- (α) ΕΠΑΝΕΚΔΟΣΗ: ακυρωμένο του ίδιου εκδότη, ποσό ±1€, ±30 ημέρες, με
        -- δαπάνη που δεν έχει δεθεί αλλού.
        select * into o from public.mydata_docs m
         where m.client_id = c.client_id and m.status = 'cancelled' and m.prev_expense_id is not null
           and m.counterpart_afm = x->>'counterpart_afm' and not m.is_credit and v_sig > 0
           and abs(m.gross_cents - (x->>'gross_cents')::bigint) <= 100
           and abs(m.issue_date - (x->>'issue_date')::date) <= 30
           and not exists (select 1 from public.mydata_docs z where z.expense_id = m.prev_expense_id)
           and exists (select 1 from public.expenses e where e.id = m.prev_expense_id)
         order by abs(m.gross_cents - (x->>'gross_cents')::bigint), abs(m.issue_date - (x->>'issue_date')::date)
         limit 1;
        if found then
          v_exp := o.prev_expense_id;
          v_status := 'linked';
          update public.mydata_docs set needs_attention = null where id = o.id;
          v_reissue := v_reissue + 1;
        else
          -- (β) ΧΕΙΡΟΚΙΝΗΤΗ ΔΑΠΑΝΗ.
          v_exp := private.mydata_match_expense(c.client_id, v_prop, x->>'counterpart_afm', x->>'counterpart_name',
                     x->>'category_label', v_sig * (x->>'gross_cents')::bigint, x->>'aa', (x->>'issue_date')::date);
          if v_exp is not null then v_status := 'linked'; end if;
        end if;
      end if;
    end if;

    if v_status = 'pending' and v_tier = 'auto' then
      v_label := btrim(coalesce(x->>'category_label', ''));
      v_group := coalesce(x->>'expense_group', '');
      if v_prop is null then
        v_tier := 'review';
        v_reasons := array_append(v_reasons, 'pick_property');
      elsif not exists (
        -- (γ) Ο ΙΔΙΟΣ ΠΑΡΟΧΟΣ, ΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ, ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ ΑΠΟ ΤΟΝ ΧΡΗΣΤΗ (όχι από αυτόματο).
          select 1 from public.mydata_docs m join public.expenses e on e.id = m.expense_id
           where m.client_id = c.client_id and m.counterpart_afm = x->>'counterpart_afm'
             and m.status in ('filed', 'linked') and coalesce(m.filed_by, 'user') = 'user' and not m.is_credit
             and e.property_id = v_prop) then
        v_tier := 'review';
        if not ('new_provider' = any (v_reasons)) then v_reasons := array_append(v_reasons, 'new_provider'); end if;
      elsif v_sig < 0 or v_cat is null or v_label = '' or length(v_label) > 60 or v_group !~ '^[a-z_]{1,32}$' then
        v_tier := 'review';
      else
        insert into public.expenses (
          property_id, user_id, description, amount, category, date, expense_group, paid, paid_by,
          notes, store_vendor, supplier_afm, vat_amount, dedup_hash)
        values (
          v_prop, c.client_id, left(x->>'title', 300), (x->>'gross_cents')::bigint / 100.0, v_label,
          (x->>'issue_date')::date, v_group, false, 'owner',
          'myDATA · ΜΑΡΚ ' || (x->>'mark'),
          left(coalesce(nullif(btrim(x->>'vendor'), ''), nullif(btrim(x->>'counterpart_name'), ''), 'ΑΦΜ ' || (x->>'counterpart_afm')), 200),
          case when x->>'counterpart_afm' ~ '^\d{9}$' then x->>'counterpart_afm' end,
          (x->>'vat_cents')::bigint / 100.0, 'mydata:' || (x->>'mark'))
        on conflict (user_id, dedup_hash) do nothing
        returning id into v_exp;
        if v_exp is null then
          select e.id into v_exp from public.expenses e
           where e.user_id = c.client_id and e.dedup_hash = 'mydata:' || (x->>'mark') limit 1;
        end if;
        if v_exp is not null then v_status := 'filed'; v_by := 'auto'; else v_tier := 'review'; end if;
      end if;
    end if;

    insert into public.mydata_docs (
      consent_id, client_id, client_afm, mark, counterpart_afm, counterpart_name, doc_type, series, aa,
      issue_date, title, net_cents, vat_cents, gross_cents, is_credit, status, cancellation_mark, expense_id,
      decided_at, tier, category, review_reasons, filed_by, correlated_mark, correlated_doc_id)
    values (
      c.id, c.client_id, c.afm, (x->>'mark')::bigint, left(x->>'counterpart_afm', 30), left(x->>'counterpart_name', 200),
      x->>'doc_type', left(x->>'series', 50), left(x->>'aa', 50), (x->>'issue_date')::date, left(x->>'title', 300),
      (x->>'net_cents')::bigint, (x->>'vat_cents')::bigint, (x->>'gross_cents')::bigint, (x->>'is_credit')::boolean,
      v_status, nullif(x->>'cancellation_mark', '')::bigint, v_exp,
      case when v_status in ('filed', 'linked') then now() end,
      v_tier, v_cat, v_reasons, v_by, v_cmark, v_corr)
    on conflict (client_afm, mark) do nothing
    returning id into v_id;
    if v_id is not null and v_status = 'pending' then v_added := v_added + 1; end if;
    if v_id is not null and v_by = 'auto' then v_added := v_added + 1; v_auto := v_auto + 1; end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_quarantine, '[]'::jsonb)) loop
    if nullif(x->>'mark', '') is not null then
      insert into public.mydata_quarantine (consent_id, client_id, client_afm, mark, reason)
      values (c.id, c.client_id, c.afm, (x->>'mark')::bigint, left(coalesce(x->>'reason', 'unknown'), 40))
      on conflict (consent_id, mark) where mark is not null do update set seen_at = now(), reason = excluded.reason;
    elsif not exists (select 1 from public.mydata_quarantine q
                       where q.consent_id = c.id and q.mark is null and q.reason = left(coalesce(x->>'reason', 'unknown'), 40)) then
      insert into public.mydata_quarantine (consent_id, client_id, client_afm, mark, reason)
      values (c.id, c.client_id, c.afm, null, left(coalesce(x->>'reason', 'unknown'), 40));
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_quarantine, '[]'::jsonb)) > 0 then
    perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'invalid_quarantined',
                               jsonb_array_length(p_quarantine), k.lease_kind);
  end if;
  if v_auto > 0 then
    perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'auto_filed', v_auto, k.lease_kind);
  end if;
  if v_reissue > 0 then
    perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'reissue_linked', v_reissue, k.lease_kind);
  end if;
  if v_rej > 0 then
    update public.mydata_consents set not_property = least(not_property + v_rej, 2000000000) where id = c.id;
    perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'not_property', v_rej, k.lease_kind);
  end if;

  if p_done then
    update public.mydata_consents set last_mark = greatest(last_mark, coalesce(p_max_mark, 0)), resume = null where id = c.id;
  else
    update public.mydata_consents set resume = p_resume where id = c.id;
  end if;
  return json_build_object('ok', true, 'added', v_added, 'auto', v_auto);
end $$;

-- ── 6. «ΑΚΥΡΩΘΗΚΕ ΑΠΟ ΤΟΝ ΕΚΔΟΤΗ» ─────────────────────────────────────────────
-- Η δαπάνη του ακυρωμένου ζει πια στο `prev_expense_id`. «Σβήσε τη δαπάνη»
-- σβήνει ΜΟΝΟ δαπάνη που γέννησε το ίδιο παραστατικό· η χειροκίνητη δαπάνη
-- ενός `cancelled_linked` δεν σβήνει ποτέ από εδώ, η ειδοποίηση απλώς κλείνει.
create or replace function public.mydata_cancel_ack(p_doc uuid, p_remove boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  d     public.mydata_docs%rowtype;
  v_n   integer := 0;
  v_exp uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into d from public.mydata_docs
   where id = p_doc and client_id = v_me and needs_attention in ('cancelled_after_filing', 'cancelled_linked') for update;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  v_exp := coalesce(d.expense_id, d.prev_expense_id);
  if coalesce(p_remove, false) and v_exp is not null and d.needs_attention = 'cancelled_after_filing' then
    delete from public.expenses
     where id = v_exp and user_id = v_me and dedup_hash = 'mydata:' || d.mark;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      perform private.mydata_log(v_me, null, v_me, d.client_afm, 'cancel_removed_expense', v_n, null);
    end if;
  end if;
  update public.mydata_docs set needs_attention = null, decided_at = now() where id = d.id;
  return json_build_object('ok', true, 'removed', v_n);
end $$;

-- ── 7. ΟΡΙΟ ΔΙΑΤΗΡΗΣΗΣ ─────────────────────────────────────────────────────
-- Ιδια με την 20261123100000, με δύο προσθήκες (lib/mydata/retention.ts):
-- τα εκκρεμή σβήνουν σε 90 ημέρες από τη λήψη, οι ανακλημένες άδειες σε 1825
-- ημέρες από την ανάκληση. ΤΙΣ ΔΙΑΡΚΕΙΕΣ ΤΙΣ ΑΠΟΦΑΣΙΖΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ.
create or replace function private.mydata_prune()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  perform private.mydata_revoke_dead(null, null);
  for r in select c.id from public.mydata_consents c
            where c.revoked_at is null and c.status = 'paused' and c.paused_at < now() - interval '90 days'
            order by c.id loop
    perform private.mydata_revoke(r.id, 'pause_expired', null);
  end loop;
  delete from public.mydata_access_log where at < now() - interval '24 months';
  delete from public.mydata_docs
   where status <> 'pending' and coalesce(decided_at, fetched_at) < now() - interval '400 days';
  delete from public.mydata_docs
   where status = 'pending' and fetched_at < now() - interval '90 days';
  delete from public.mydata_consents
   where revoked_at is not null and revoked_at < now() - interval '1825 days';
end $$;
revoke all on function private.mydata_prune() from public, anon, authenticated;

-- ── 8. ΔΙΚΑΙΩΜΑΤΑ ──────────────────────────────────────────────────────────
revoke all on function
  public.mydata_consent_grant(uuid, integer, text, text, boolean, boolean),
  public.mydata_doc_match(uuid, uuid, text), public.mydata_doc_link(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function
  public.mydata_consent_grant(uuid, integer, text, text, boolean, boolean),
  public.mydata_doc_match(uuid, uuid, text), public.mydata_doc_link(uuid, uuid, uuid, text)
  to authenticated;

revoke all on function
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean, integer)
  from public, anon, authenticated;
grant execute on function
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean, integer)
  to service_role;
