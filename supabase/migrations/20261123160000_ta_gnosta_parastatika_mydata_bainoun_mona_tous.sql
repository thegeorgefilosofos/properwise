-- ═══════════════════════════════════════════════════════════════════════════
-- myDATA PR-Α2: ΤΑ ΓΝΩΣΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΜΠΑΙΝΟΥΝ ΜΟΝΑ ΤΟΥΣ, ΤΑ ΑΛΛΑ ΜΕ ΕΝΑ ΠΑΤΗΜΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΕΓΚΡΙΣΗ ΙΔΙΟΚΤΗΤΗ: 23/11/2026, σχέδιο «Σύνδεση ΑΑΔΕ χωρίς export/upload»,
-- ενότητες «ΟΔΙΚΟΣ ΧΑΡΤΗΣ Α2», «ΑΥΣΤΗΡΟΠΟΙΗΣΗ», «ΟΡΙΟ ΕΛΕΓΧΟΥ» και «ΔΙΟΡΘΩΣΗ
-- 12:00» (το RgWsPublic2 είναι προαιρετικό· χωρίς ΚΑΔ το αυτόματο στηρίζεται
-- ΜΟΝΟ στο μητρώο ΑΦΜ παρόχων).
--
-- ΠΗΓΕΣ (προστατευμένη διαδρομή, άρα γραμμένες ρητά):
--   ΑΑΔΕ, myDATA REST API ERP v2.0.2 (09/2026): Παράρτημα 8.1 (τύποι
--   παραστατικών: 1.1, 2.1, 11.1, 11.2, 11.3 οι συνηθισμένοι λογαριασμοί,
--   5.1/5.2/11.4 πιστωτικά) και InvoicesDoc-v2.0.2.xsd, InvoiceSummaryType
--   (μικτό = καθαρό + ΦΠΑ − παρακρατήσεις + τέλη + χαρτόσημο + λοιποί φόροι −
--   κρατήσεις). ν. 4172/2013 (ΚΦΕ) άρθρο 23, ΠΟΛ.1216/2014: δαπάνη άνω των
--   500€ δεν εκπίπτει χωρίς τραπεζικό μέσο, άρα ΠΑΝΤΑ για έλεγχο (το όριο το
--   κρίνει η συνάρτηση άκρου, lib/mydata/limits.ts). ΓΚΠΔ 5§1(γ): ό,τι δεν
--   αφορά ακίνητα δεν αποθηκεύεται, μόνο το πλήθος του.
--
-- ΤΙ ΑΛΛΑΖΕΙ
--   1. Τρεις στήλες στο mydata_docs: `tier` (auto/review), `category` (slug της
--      ταξινομίας, προσυμπληρωμένο), `review_reasons` (κωδικοί από κλειστό
--      κατάλογο) και `filed_by` (user/auto).
--   2. `mydata_consents.not_property`: μόνο το πλήθος όσων δεν αφορούν ακίνητα.
--   3. `mydata_provider_stats`: πόσα επιβεβαιωμένα έχει ο πελάτης ανά πάροχο,
--      για το «νέος πάροχος» και το «2× τον μέσο όρο». Μόνο ο ρόλος υπηρεσίας.
--   4. `mydata_ingest` με `p_rejected`: το `auto` γίνεται δαπάνη ΜΟΝΟ όταν ο
--      πελάτης έχει ένα ακίνητο. Με περισσότερα πάει για έλεγχο με
--      `pick_property`: η ίδια ΔΕΗ μπορεί να είναι δύο σπίτια.
--   5. `mydata_doc_filed` κρατά την κατηγορία της επιβεβαίωσης (μαθαίνει).
--   6. `mydata_auto_undo`: «Δεν είναι σωστό» για ό,τι μπήκε μόνο του. Σβήνει
--      ΜΟΝΟ τη δαπάνη που γέννησε το ίδιο παραστατικό.
--
-- RLS. Κανένας νέος πίνακας: οι νέες στήλες ανήκουν σε πίνακες με RLS και
-- πολιτική MFA ήδη (20261123100000). Οι νέες συναρτήσεις είναι SECURITY
-- DEFINER με `search_path = ''` και κρίνουν μόνες τους ποιος ρωτά.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΤΟ ΕΠΙΠΕΔΟ, Η ΚΑΤΗΓΟΡΙΑ, ΟΙ ΛΟΓΟΙ ─────────────────────────────────────
alter table public.mydata_docs add column if not exists tier text;
alter table public.mydata_docs add column if not exists category text;
alter table public.mydata_docs add column if not exists review_reasons text[] not null default '{}';
alter table public.mydata_docs add column if not exists filed_by text;
alter table public.mydata_consents add column if not exists not_property integer not null default 0;

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_tier_known') then
    alter table public.mydata_docs add constraint mydata_docs_tier_known
      check (tier is null or tier in ('auto', 'review'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_category_slug') then
    alter table public.mydata_docs add constraint mydata_docs_category_slug
      check (category is null or category ~ '^[a-z_]{1,32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_reasons_known') then
    alter table public.mydata_docs add constraint mydata_docs_reasons_known check (review_reasons <@ array[
      'over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'unknown_provider',
      'pick_property']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_docs_filed_by_known') then
    alter table public.mydata_docs add constraint mydata_docs_filed_by_known
      check (filed_by is null or filed_by in ('user', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mydata_consents_not_property_nonneg') then
    alter table public.mydata_consents add constraint mydata_consents_not_property_nonneg check (not_property >= 0);
  end if;
  -- Το αρχείο πρόσβασης: τρεις νέες ενέργειες. Ολόκληρος ο κατάλογος, γιατί η
  -- τελευταία γραφή είναι η ισχύουσα.
  if exists (select 1 from pg_constraint where conname = 'mydata_access_log_action_known') then
    alter table public.mydata_access_log drop constraint mydata_access_log_action_known;
  end if;
  alter table public.mydata_access_log add constraint mydata_access_log_action_known check (action in (
    'consent_granted', 'consent_revoked', 'consent_paused', 'afm_confirmed',
    'key_saved', 'key_removed', 'key_rejected',
    'sync_fetch', 'sync_done', 'sync_failed', 'page_rejected', 'invalid_quarantined',
    'provider_ignored', 'cancel_flagged', 'cancel_removed_expense', 'key_read',
    'auto_filed', 'auto_undone', 'not_property'));
end $c$;

create index if not exists mydata_docs_client_auto on public.mydata_docs (client_id, decided_at desc) where filed_by = 'auto';
create index if not exists mydata_docs_client_counterpart on public.mydata_docs (client_id, counterpart_afm) where status in ('filed', 'linked');

comment on column public.mydata_docs.tier is
  'Α2: auto = καταχωρήθηκε χωρίς πάτημα (πάροχος του μητρώου, ήδη επιβεβαιωμένος, ένα ακίνητο)· review = περιμένει τον χρήστη.';
comment on column public.mydata_docs.review_reasons is
  'Α2: γιατί θέλει έλεγχο, ως κωδικοί (over_limit, credit, amounts, unusual_amount, doc_type, new_provider, unknown_provider, pick_property).';
comment on column public.mydata_consents.not_property is
  'Α2: πόσα παραστατικά δεν αφορούσαν ακίνητα και δεν αποθηκεύτηκαν (ΓΚΠΔ 5§1(γ)). Μόνο πλήθος.';

-- ── 2. ΤΟ ΜΟΝΑΔΙΚΟ ΑΚΙΝΗΤΟ ΤΟΥ ΠΕΛΑΤΗ, ΑΝ ΕΙΝΑΙ ΕΝΑ ─────────────────────────────
create or replace function private.mydata_one_property(p_client uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then min(p.id::text)::uuid end
    from public.user_properties p where p.user_id = p_client;
$$;
revoke all on function private.mydata_one_property(uuid) from public, anon, authenticated;

-- ── 3. ΤΟ ΙΣΤΟΡΙΚΟ ΑΝΑ ΠΑΡΟΧΟ ─────────────────────────────────────────────────
-- Μόνο τα επιβεβαιωμένα (καταχωρημένα ή δεμένα με δαπάνη του χρήστη), χωρίς
-- πιστωτικά. Το πολύ 500 πάροχοι, οι πιο συχνοί. Χωρίς ζωντανή μίσθωση και
-- άδεια: κενό, άρα κανείς «γνωστός» και όλα για έλεγχο.
create or replace function public.mydata_provider_stats(p_lease uuid, p_consent uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.mydata_consents%rowtype;
  v jsonb;
begin
  select * into c from public.mydata_consents where id = p_consent;
  if not found or not private.mydata_consent_ok(c.id, p_lease) then return '{}'::jsonb; end if;
  select coalesce(jsonb_object_agg(s.afm, jsonb_build_object('n', s.n, 'avg', s.avg, 'cat', s.cat)), '{}'::jsonb) into v
    from (
      select m.counterpart_afm as afm, count(*) as n, round(avg(m.gross_cents))::bigint as avg,
             (array_agg(m.category order by m.decided_at desc nulls last) filter (where m.category is not null))[1] as cat
        from public.mydata_docs m
       where m.client_id = c.client_id and m.status in ('filed', 'linked') and not m.is_credit
       group by m.counterpart_afm
       order by count(*) desc, m.counterpart_afm
       limit 500
    ) s;
  return v;
end $$;

-- ── 4. Η ΕΓΓΡΑΦΗ ΜΙΑΣ ΣΕΛΙΔΑΣ, ΜΕ ΤΑ ΕΠΙΠΕΔΑ ────────────────────────────────────
-- Ιδια με την 20261123100000, με τρεις προσθήκες: (α) ό,τι υπάρχει ήδη για τον
-- ΜΑΡΚ δεν ξαναγγίζεται ΠΡΙΝ από οτιδήποτε άλλο, ώστε μια επανάληψη να μη
-- γεννήσει δαπάνη για παραστατικό που ο χρήστης απέρριψε· (β) το `auto` γίνεται
-- δαπάνη μόνο με ένα ακίνητο· (γ) το πλήθος όσων δεν αφορούν ακίνητα.
drop function if exists public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean);
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
  v_status  text;
  v_tier    text;
  v_cat     text;
  v_reasons text[];
  v_by      text;
  v_prop    uuid;
  v_label   text;
  v_group   text;
  d         public.mydata_docs%rowtype;
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

  for x in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    if exists (select 1 from public.mydata_ignored_providers ip
                where ip.client_id = c.client_id and ip.counterpart_afm = x->>'counterpart_afm') then
      -- «Πάντα αγνόησε» είναι κανόνας απόρριψης του ίδιου του χρήστη: μετρά μαζί
      -- με όσα δεν αφορούν ακίνητα.
      v_rej := v_rej + 1;
      continue;
    end if;
    -- (α) Ο ΜΑΡΚ υπάρχει ήδη: τίποτα, ούτε δαπάνη.
    if exists (select 1 from public.mydata_docs m where m.client_afm = c.afm and m.mark = (x->>'mark')::bigint) then
      continue;
    end if;
    v_sig := case when (x->>'is_credit')::boolean then -1 else 1 end;
    v_status := case when (x->>'cancelled')::boolean then 'cancelled' else 'pending' end;
    v_tier := case when x->>'tier' = 'auto' then 'auto' else 'review' end;
    v_cat := case when x->>'category' ~ '^[a-z_]{1,32}$' then x->>'category' end;
    v_reasons := array(
      select distinct r from jsonb_array_elements_text(case when jsonb_typeof(x->'reasons') = 'array' then x->'reasons' else '[]'::jsonb end) r
       where r in ('over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'unknown_provider')
       order by r);
    v_by := null;
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

    -- (β) ΑΥΤΟΜΑΤΑ: μόνο εκκρεμές, μόνο θετικό, μόνο με ένα ακίνητο και με
    -- κατηγορία που μοιάζει με της ταξινομίας. Αλλιώς για έλεγχο.
    if v_status = 'pending' and v_tier = 'auto' then
      v_label := btrim(coalesce(x->>'category_label', ''));
      v_group := coalesce(x->>'expense_group', '');
      if v_prop is null then
        v_tier := 'review';
        v_reasons := array_append(v_reasons, 'pick_property');
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
      decided_at, tier, category, review_reasons, filed_by)
    values (
      c.id, c.client_id, c.afm, (x->>'mark')::bigint, left(x->>'counterpart_afm', 30), left(x->>'counterpart_name', 200),
      x->>'doc_type', left(x->>'series', 50), left(x->>'aa', 50), (x->>'issue_date')::date, left(x->>'title', 300),
      (x->>'net_cents')::bigint, (x->>'vat_cents')::bigint, (x->>'gross_cents')::bigint, (x->>'is_credit')::boolean,
      v_status, nullif(x->>'cancellation_mark', '')::bigint, v_exp,
      case when v_status in ('filed', 'linked') then now() end,
      v_tier, v_cat, v_reasons, v_by)
    on conflict (client_afm, mark) do nothing
    returning id into v_id;
    if v_id is not null and v_status = 'pending' then v_added := v_added + 1; end if;
    if v_id is not null and v_by = 'auto' then v_added := v_added + 1; v_auto := v_auto + 1; end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_cancels, '[]'::jsonb)) loop
    select * into d from public.mydata_docs
     where client_id = c.client_id and client_afm = c.afm and mark = (x->>'invoice_mark')::bigint for update;
    if not found or d.status = 'cancelled' then continue; end if;
    update public.mydata_docs
       set status = 'cancelled', cancellation_mark = (x->>'cancellation_mark')::bigint, decided_at = now(),
           needs_attention = case when d.status = 'filed' and d.expense_id is not null then 'cancelled_after_filing' end
     where id = d.id;
    if d.status = 'filed' and d.expense_id is not null then
      perform private.mydata_log(c.client_id, c.accountant_id, k.lease_actor, c.afm, 'cancel_flagged', 1, k.lease_kind);
    end if;
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

-- ── 5. Η ΚΑΤΑΧΩΡΗΣΗ ΑΠΟ ΤΗΝ ΕΦΑΡΜΟΓΗ ΚΡΑΤΑ ΤΗΝ ΚΑΤΗΓΟΡΙΑ ─────────────────────────
-- Ιδιο σώμα με την 20261123100000· η κατηγορία (slug) γράφεται ώστε το επόμενο
-- παραστατικό του ίδιου παρόχου να έρθει με αυτήν προσυμπληρωμένη.
drop function if exists public.mydata_doc_filed(uuid, uuid);
create or replace function public.mydata_doc_filed(p_doc uuid, p_expense uuid, p_category text default null)
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
  update public.mydata_docs
     set status = 'filed', expense_id = p_expense, decided_at = now(), filed_by = 'user',
         category = case when p_category ~ '^[a-z_]{1,32}$' then p_category else category end
   where id = p_doc;
  return json_build_object('ok', true);
end $$;

-- ── 6. «ΔΕΝ ΕΙΝΑΙ ΣΩΣΤΟ» ΓΙΑ Ο,ΤΙ ΜΠΗΚΕ ΜΟΝΟ ΤΟΥ ──────────────────────────────
-- Σβήνει ΜΟΝΟ τη δαπάνη με το αποτύπωμα του ίδιου ΜΑΡΚ και του ίδιου χρήστη· το
-- παραστατικό ξαναγίνεται εκκρεμές, για έλεγχο, με την κατηγορία του.
create or replace function public.mydata_auto_undo(p_doc uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  d    public.mydata_docs%rowtype;
  v_n  integer := 0;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into d from public.mydata_docs
   where id = p_doc and client_id = v_me and filed_by = 'auto' and status = 'filed' for update;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if d.expense_id is not null then
    delete from public.expenses
     where id = d.expense_id and user_id = v_me and dedup_hash = 'mydata:' || d.mark;
    get diagnostics v_n = row_count;
  end if;
  update public.mydata_docs
     set status = 'pending', tier = 'review', filed_by = null, expense_id = null, decided_at = null
   where id = d.id;
  perform private.mydata_log(v_me, null, v_me, d.client_afm, 'auto_undone', v_n, null);
  return json_build_object('ok', true, 'removed', v_n);
end $$;

-- ── 7. ΔΙΚΑΙΩΜΑΤΑ ──────────────────────────────────────────────────────────
revoke all on function
  public.mydata_doc_filed(uuid, uuid, text), public.mydata_auto_undo(uuid)
  from public, anon;
grant execute on function
  public.mydata_doc_filed(uuid, uuid, text), public.mydata_auto_undo(uuid)
  to authenticated;

revoke all on function
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean, integer),
  public.mydata_provider_stats(uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.mydata_ingest(uuid, uuid, jsonb, jsonb, jsonb, integer, bigint, jsonb, boolean, integer),
  public.mydata_provider_stats(uuid, uuid)
  to service_role;
