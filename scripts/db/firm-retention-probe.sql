-- ═══════════════════════════════════════════════════════════════════════════
--  ΙΣΤΟΡΙΚΟ 12 ΜΗΝΩΝ ΚΑΙ ΕΓΓΡΑΦΗ ΜΟΝΟ ΜΕ ΣΥΜΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ (20261105090000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα:
--   · ανοίγματα λίγο πριν και λίγο μετά από τους 12 μήνες, κινήσεις 13 μηνών
--     και 6 ετών· το καθάρισμα σβήνει μόνο το παλιό άνοιγμα·
--   · το γραφείο σε «Τήρηση» δεν γράφει όσο ο ιδιοκτήτης δεν έχει την τρέχουσα
--     σύμβαση· γράφει μόλις την αποδεχτεί.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
do $probe$
declare
  o uuid := 'f4000000-0000-4000-8000-000000000001';
  m uuid := 'f4000000-0000-4000-8000-0000000000a1';
  f uuid := 'f4000000-0000-4000-8000-00000000ff01';
  p uuid := 'f4000000-0000-4000-8000-00000000f001';
  n int;
  res json;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (o, 'o@retention.test', '{"dpa_version":"2026-10"}'), (m, 'm@retention.test', '{}');
  insert into public.user_properties(id, user_id, name) values (p, o, 'Του Ο');
  insert into public.accountant_links(user_id, token, active) values (o, 'retention-probe-o', true);
  insert into public.firms(id, name, created_by) values (f, 'Γραφείο Διατήρησης', m);
  insert into public.firm_members(firm_id, user_id, email, role, status, joined_at, firm_only)
    values (f, m, 'm@retention.test', 'manager', 'active', now(), true);
  insert into public.accountant_clients(accountant_id, owner_id, claimed_token, firm_id, access_level)
    values (m, o, 'retention-probe-o', f, 'keep');

  -- ── 1. Η διατήρηση ──────────────────────────────────────────────────────
  insert into public.firm_access_log(firm_id, member_id, owner_id, action, at) values
    (f, m, o, 'open', now() - interval '12 months' - interval '1 day'),
    (f, m, o, 'open', now() - interval '12 months' + interval '1 day');
  insert into public.firm_record_log(firm_id, member_id, owner_id, kind, table_name, row_id, action, at) values
    (f, m, o, 'bill', 'bills', gen_random_uuid(), 'insert', now() - interval '13 months'),
    (f, m, o, 'bill', 'bills', gen_random_uuid(), 'insert', now() - interval '6 years');
  perform private.firm_access_log_prune();
  select count(*) into n from public.firm_access_log where owner_id = o;
  if n <> 1 then raise exception 'ΔΙΑΤΗΡΗΣΗ: το ιστορικό ανοίγματος κράτησε % γραμμές αντί για 1', n; end if;
  select count(*) into n from public.firm_record_log where owner_id = o;
  if n <> 2 then raise exception 'ΔΙΑΤΗΡΗΣΗ: το καθάρισμα άγγιξε το ημερολόγιο κινήσεων (% αντί για 2)', n; end if;
  raise notice 'probe: το ιστορικό ανοίγματος κρατά 12 μήνες, το ημερολόγιο κινήσεων όσο ο λογαριασμός';

  -- ── 2. Η σύμβαση επεξεργασίας ──────────────────────────────────────────
  perform set_config('probe.uid', m::text, true);
  begin
    res := public.firm_record(o, p, 'expense', '{"description":"Δοκιμή","amount":10,"date":"2026-11-01","category":"other"}');
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: το γραφείο έγραψε χωρίς την τρέχουσα σύμβαση επεξεργασίας: %', res;
  exception when insufficient_privilege then
    if sqlerrm <> 'firm_record:dpa' then raise exception 'ΔΙΑΤΗΡΗΣΗ: άλλη άρνηση από την αναμενόμενη: %', sqlerrm; end if;
  end;
  update auth.users set raw_user_meta_data = jsonb_build_object('dpa_version', private.firm_dpa_version()) where id = o;
  res := public.firm_record(o, p, 'expense', '{"description":"Δοκιμή","amount":10,"date":"2026-11-01","category":"other"}');
  if not coalesce((res->>'ok')::boolean, false) then raise exception 'Το γραφείο δεν γράφει με την τρέχουσα σύμβαση: %', res; end if;
  raise notice 'probe: το γραφείο γράφει μόνο όταν ο ιδιοκτήτης έχει αποδεχτεί την τρέχουσα σύμβαση';
end $probe$;
rollback;
