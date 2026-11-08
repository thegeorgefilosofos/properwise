-- ═══════════════════════════════════════════════════════════════════════════
--  ΧΩΡΙΣ ΑΠΟΔΟΧΗ ΤΩΝ ΟΡΩΝ ΕΠΕΞΕΡΓΑΣΙΑΣ, ΚΑΝΕΝΑΣ ΠΕΛΑΤΗΣ (20261108090000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα. Το db-replay δίνει στα άλλα δοκιμαστικά
--  γραφεία αποδοχή από προεπιλογή· εδώ η προεπιλογή φεύγει, όπως στην παραγωγή.
--   · γραφείο και μέλος χωρίς αποδοχή: ούτε φάκελος, ούτε επίπεδο εγγραφής,
--     ούτε αρχείο για ανάγνωση ή ανέβασμα·
--   · αποδοχή παλιάς έκδοσης: δεν γράφεται·
--   · ο Υπεύθυνος δέχεται: βλέπει· το μέλος που δεν δέχτηκε, όχι·
--   · νέα έκδοση: η πρόσβαση κόβεται ως τη νέα αποδοχή.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
alter table public.firms alter column terms_version drop default;
alter table public.firm_members alter column terms_version drop default;
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
do $probe$
declare
  o uuid := 'f5000000-0000-4000-8000-000000000001';
  m uuid := 'f5000000-0000-4000-8000-0000000000a1';
  a uuid := 'f5000000-0000-4000-8000-0000000000a2';
  f uuid := 'f5000000-0000-4000-8000-00000000ff01';
  p uuid := 'f5000000-0000-4000-8000-00000000f001';
  up text := 'f5000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-00000000f001/document/terms.pdf';
  rd text := 'f5000000-0000-4000-8000-000000000001/aade-e2/e2.pdf';
  res json;
  stored boolean;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (o, 'o@terms.test', jsonb_build_object('dpa_version', private.firm_dpa_version())),
    (m, 'm@terms.test', '{}'), (a, 'a@terms.test', '{}');
  insert into public.user_properties(id, user_id, name) values (p, o, 'Του Ο');
  insert into public.accountant_links(user_id, token, active) values (o, 'terms-probe-o', true);
  insert into public.firms(id, name, created_by) values (f, 'Γραφείο Όρων', m);
  insert into public.firm_members(firm_id, user_id, email, role, status, joined_at, firm_only) values
    (f, m, 'm@terms.test', 'manager', 'active', now(), true),
    (f, a, 'a@terms.test', 'accountant', 'active', now(), true);
  insert into public.accountant_clients(accountant_id, owner_id, claimed_token, firm_id, access_level)
    values (m, o, 'terms-probe-o', f, 'keep');
  insert into public.firm_client_assignees(firm_id, owner_id, user_id) values (f, o, a);

  -- ── 1. Χωρίς αποδοχή ───────────────────────────────────────────────────
  perform set_config('probe.uid', m::text, true);
  if private.firm_reads_owner(m, o) or private.firm_level(m, o) is not null then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: το γραφείο βλέπει πελάτη χωρίς αποδοχή των όρων';
  end if;
  if public.firm_client_data(o, 2026) is not null then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: φάκελος χωρίς αποδοχή των όρων'; end if;
  begin
    res := public.firm_record(o, p, 'expense', '{"description":"Δοκιμή","amount":10,"date":"2026-11-01","category":"other"}');
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: εγγραφή χωρίς αποδοχή των όρων: %', res;
  exception when insufficient_privilege then null;
  end;
  if private.accountant_sees_file(rd, false) then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: αρχείο πελάτη χωρίς αποδοχή των όρων'; end if;
  perform set_config('role', 'authenticated', true);
  begin
    insert into storage.objects(bucket_id, name, owner) values ('property-files', up, m);
    stored := true;
  exception when insufficient_privilege then stored := false;
  end;
  perform set_config('role', 'postgres', true);
  if stored then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: ανέβασμα χωρίς αποδοχή των όρων'; end if;
  raise notice 'probe: χωρίς αποδοχή των όρων το γραφείο δεν βλέπει, δεν γράφει, δεν ανεβάζει';

  -- ── 2. Παλιά έκδοση: δεν γράφεται ──────────────────────────────────────
  res := public.firm_accept_terms('2020-01');
  if (res->>'ok')::boolean or exists (select 1 from public.firms where id = f and terms_version is not null) then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: γράφτηκε αποδοχή έκδοσης που δεν είναι η τρέχουσα';
  end if;
  raise notice 'probe: αποδοχή άλλης έκδοσης από την τρέχουσα δεν γράφεται';

  -- ── 3. Ο Υπεύθυνος δέχεται· το μέλος όχι ακόμη ─────────────────────────
  res := public.firm_accept_terms(private.firm_terms_version());
  if not coalesce((res->>'ok')::boolean, false) or not coalesce((res->>'firm')::boolean, false) then
    raise exception 'Ο Υπεύθυνος δεν αποδέχτηκε τους όρους: %', res;
  end if;
  if private.firm_level(m, o) is distinct from 'keep' or not private.accountant_sees_file(rd, false) then
    raise exception 'Το γραφείο δεν βλέπει τον πελάτη μετά την αποδοχή';
  end if;
  perform set_config('probe.uid', a::text, true);
  if private.firm_reads_owner(a, o) then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: μέλος χωρίς δική του αποδοχή βλέπει πελάτη'; end if;
  res := public.firm_accept_terms(private.firm_terms_version());
  if not private.firm_reads_owner(a, o) then raise exception 'Το μέλος δεν βλέπει τον πελάτη μετά την αποδοχή του'; end if;
  if (select terms_accepted_by from public.firms where id = f) is distinct from m then
    raise exception 'Η αποδοχή μέλους που δεν είναι Υπεύθυνος άλλαξε την αποδοχή του γραφείου';
  end if;
  raise notice 'probe: βλέπει μόνο όποιος δέχτηκε, και μόνο αν έχει δεχτεί και το γραφείο';

  -- ── 4. Νέα έκδοση: κόβεται ─────────────────────────────────────────────
  update public.firms set terms_version = '2020-01' where id = f;
  if private.firm_reads_owner(a, o) or private.firm_reads_owner(m, o) then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: πρόσβαση με αποδοχή παλιάς έκδοσης';
  end if;
  raise notice 'probe: με παλιά έκδοση των όρων η πρόσβαση κόβεται';
end $probe$;
rollback;
