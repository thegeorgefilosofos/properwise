-- ═══════════════════════════════════════════════════════════════════════════
--  Ο ΑΝΕΞΑΡΤΗΤΟΣ ΕΛΕΓΧΟΣ ΤΩΝ ΓΡΑΦΕΙΩΝ (04/11/2026), ΕΝΑ ΕΥΡΗΜΑ ΑΝΑ ΕΝΟΤΗΤΑ
-- ─────────────────────────────────────────────────────────────────────────
--  Τρέχει μετά το firm-write-probe.sql, στην ίδια βάση. Κάθε ενότητα γράφτηκε
--  ΠΡΙΝ από τη διόρθωση (20261104150000) και κοκκίνιζε πάνω στον κώδικα των
--  20261104120000 / 20261104130000:
--
--   1. Το πρώην μέλος κρατούσε πρόσβαση: το `firm_open_client` έδινε στον
--      περιηγητή του το token του ιδιοκτήτη και το `get_accountant_data`, που
--      το καλεί και ο ανώνυμος, δεχόταν μόνο αυτό. Αφαίρεση μέλους και
--      ανάκληση γραφείου δεν το άλλαζαν.
--   2. Το ημερολόγιο κινήσεων κρατούσε ολόκληρη τη γραμμή του μισθωτή (ΑΦΜ,
--      ταυτότητα, τηλέφωνο) και μετά τη διαγραφή της, ορατή στο γραφείο και
--      μετά την ανάκληση.
--   3. Με το τελευταίο μέλος έφευγε και το ιστορικό του ιδιοκτήτη.
--   4. Μέλος γραφείου χωρίς δεύτερο παράγοντα περνούσε το `mfa_satisfied`.
--   5. Η εξαγωγή δεδομένων του ιδιοκτήτη έπρεπε να έχει και τα δύο ημερολόγια.
-- ═══════════════════════════════════════════════════════════════════════════

reset role;
set session "probe.uid" = '';
-- Ο,τι ακολουθεί γίνεται με δεύτερο βήμα, εκτός από την ενότητα 4.
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);

create schema if not exists probe_s;
create table probe_s.who(k text primary key, id uuid);
insert into probe_s.who values
  ('O', 'f3000000-0000-4000-8000-000000000001'),   -- ιδιοκτήτης
  ('M', 'f3000000-0000-4000-8000-0000000000a1'),   -- υπεύθυνος του Φ
  ('L', 'f3000000-0000-4000-8000-0000000000a2'),   -- λογιστής που διεκδίκησε τον Ο
  ('K', 'f3000000-0000-4000-8000-0000000000a3');   -- λογιστής με ανάθεση του Ο
create or replace function probe_s.u(p text) returns uuid language sql stable as $$ select id from probe_s.who where k = p $$;
grant usage on schema probe_s to authenticated, anon;
grant select on probe_s.who to authenticated, anon;
grant execute on function probe_s.u(text) to authenticated, anon;

-- ── Η αφετηρία: ένα γραφείο, ένας πελάτης σε «Τήρηση» ──────────────────────
do $probe$
declare f uuid := 'f3000000-0000-4000-8000-00000000ff01';
begin
  insert into auth.users(id, email) select id, lower(k) || '@security.test' from probe_s.who;
  insert into public.user_properties(id, user_id, name)
    values ('f3000000-0000-4000-8000-00000000f001', probe_s.u('O'), 'Του Ο');
  insert into public.accountant_links(user_id, token, active) values (probe_s.u('O'), 'security-probe-o', true);
  insert into public.firms(id, name, created_by) values (f, 'Γραφείο Ασφάλειας', probe_s.u('M'));
  insert into public.firm_members(firm_id, user_id, email, role, status, joined_at, firm_only) values
    (f, probe_s.u('M'), 'm@security.test', 'manager',    'active', now(), true),
    (f, probe_s.u('L'), 'l@security.test', 'accountant', 'active', now(), true),
    (f, probe_s.u('K'), 'k@security.test', 'accountant', 'active', now(), true);
  -- Ο L διεκδίκησε τον Ο με τον σύνδεσμό του (η σκανδάλη τού δίνει και ανάθεση).
  insert into public.accountant_clients(accountant_id, owner_id, claimed_token, firm_id, access_level)
    values (probe_s.u('L'), probe_s.u('O'), 'security-probe-o', f, 'keep');
  insert into public.firm_client_assignees(firm_id, owner_id, user_id, assigned_by)
    values (f, probe_s.u('O'), probe_s.u('K'), probe_s.u('M'));
end $probe$;

set role authenticated;

-- ═══ 1α. ΤΟ TOKEN ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΔΕΝ ΦΤΑΝΕΙ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ ΜΕΛΟΥΣ ═══════════
do $probe$
declare res json; who text;
begin
  foreach who in array array['L', 'K', 'M'] loop
    perform set_config('probe.uid', probe_s.u(who)::text, false);
    res := public.firm_open_client(probe_s.u('O'));
    if not coalesce((res->>'ok')::boolean, false) then raise exception 'Ο % δεν άνοιξε τον Ο: %', who, res; end if;
    if res->>'token' is not null then
      raise exception 'ΔΙΑΡΡΟΗ: το firm_open_client δίνει στον % το token του ιδιοκτήτη', who;
    end if;
    if exists (select 1 from json_array_elements(public.accountant_clients_overview(2026)) r where r->>'token' is not null) then
      raise exception 'ΔΙΑΡΡΟΗ: η λίστα πελατών δίνει στον % το token του ιδιοκτήτη', who;
    end if;
    res := public.firm_client_data(probe_s.u('O'), 2026);
    if res is null or res->'properties' is null then
      raise exception 'Ο % δεν διαβάζει τον φάκελο του Ο μέσα από το γραφείο: %', who, res;
    end if;
  end loop;
  raise notice 'probe: το μέλος διαβάζει τον πελάτη ως πρόσωπο, χωρίς να δει ποτέ το token του';
end $probe$;

-- ═══ 2. ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΔΕΝ ΚΡΑΤΑ ΠΡΟΣΩΠΙΚΑ ΔΕΔΟΜΕΝΑ ΤΡΙΤΩΝ ═════════════════
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a3';
do $probe$
declare res json;
begin
  res := public.firm_record(probe_s.u('O'), 'f3000000-0000-4000-8000-00000000f001', 'tenant',
    jsonb_build_object('full_name', 'Μισθωτής Ασφαλείας', 'afm', '094444444', 'phone', '6944000444',
                       'id_number', 'ΑΖ444444', 'email', 'misthotis@security.test'));
  if not coalesce((res->>'ok')::boolean, false) then raise exception 'Ο K δεν κατέγραψε μισθωτή: %', res; end if;
  perform set_config('probe.tenant', res->>'id', false);
end $probe$;
reset role;
do $probe$
declare pii text[] := array['094444444', '6944000444', 'ΑΖ444444', 'misthotis@security.test', 'Μισθωτής Ασφαλείας'];
        v text; hit boolean; t uuid := current_setting('probe.tenant')::uuid;
begin
  if not exists (select 1 from public.firm_record_log where row_id = t) then
    raise exception 'Η καταχώρηση του μισθωτή δεν γράφτηκε στο ημερολόγιο';
  end if;
  foreach v in array pii loop
    if exists (select 1 from public.firm_record_log l where l.row_id = t and to_jsonb(l)::text like '%' || v || '%') then
      raise exception 'ΔΙΑΡΡΟΗ: το ημερολόγιο του γραφείου κρατά «%» του μισθωτή', v;
    end if;
  end loop;
  -- Ο ιδιοκτήτης σβήνει τον μισθωτή: κανένα αντίγραφο δεν μένει πουθενά.
  delete from public.tenants where id = t;
  foreach v in array pii loop
    if exists (select 1 from public.firm_record_log l where to_jsonb(l)::text like '%' || v || '%') then
      raise exception 'ΔΙΑΡΡΟΗ: μετά τη διαγραφή το ημερολόγιο κρατά «%»', v;
    end if;
    if to_regclass('public.firm_record_undo') is not null then
      execute format('select exists (select 1 from public.firm_record_undo u where to_jsonb(u)::text like %L)', '%' || v || '%')
         into hit;
      if hit then raise exception 'ΔΙΑΡΡΟΗ: μετά τη διαγραφή η αναίρεση κρατά «%»', v; end if;
    end if;
  end loop;
  raise notice 'probe: το ημερολόγιο κρατά τι έγινε, όχι τα στοιχεία του μισθωτή';
end $probe$;

-- ═══ 1β. Η ΑΦΑΙΡΕΣΗ ΜΕΛΟΥΣ ΚΟΒΕΙ ΑΜΕΣΩΣ ΑΚΟΜΗ ΚΑΙ ΤΟΝ ΣΥΝΔΕΣΜΟ ΠΟΥ ΗΞΕΡΕ ═
-- Ο L επικόλλησε τον σύνδεσμο για να διεκδικήσει τον πελάτη: τον ξέρει όπως
-- κι αν τον κρατήσει η οθόνη. Η αφαίρεσή του πρέπει να τον κάνει άχρηστο.
do $probe$ begin perform set_config('probe.oldtoken', (select token from public.accountant_links where user_id = probe_s.u('O')), false); end $probe$;
set role authenticated;
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a1';
do $probe$
declare mid uuid; res json;
begin
  select (x->>'id')::uuid into mid from json_array_elements(public.my_firm()->'members') x where x->>'email' = 'l@security.test';
  res := public.firm_member_update(mid, null, true);
  if not coalesce((res->>'ok')::boolean, false) then raise exception 'Αφαίρεση L: %', res; end if;
end $probe$;
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a2';
do $probe$
begin
  if public.get_accountant_data(current_setting('probe.oldtoken'), 2026) is not null then
    raise exception 'ΔΙΑΡΡΟΗ: το αφαιρεμένο μέλος διαβάζει τον φάκελο με τον σύνδεσμο που διεκδίκησε';
  end if;
  if public.firm_client_data(probe_s.u('O'), 2026) is not null then raise exception 'ΔΙΑΡΡΟΗ: το αφαιρεμένο μέλος διαβάζει ακόμη τον φάκελο'; end if;
end $probe$;
reset role;
do $probe$
begin
  perform set_config('probe.uid', probe_s.u('L')::text, false);
  if private.accountant_sees_file(probe_s.u('O')::text || '/accountant-pack/2026.zip', false) then
    raise exception 'ΔΙΑΡΡΟΗ: το αφαιρεμένο μέλος διαβάζει αρχεία του πελάτη';
  end if;
  -- Οι υπόλοιποι του γραφείου δεν χάνουν τίποτα.
  perform set_config('probe.uid', probe_s.u('K')::text, false);
  if public.firm_client_data(probe_s.u('O'), 2026) is null then raise exception 'Η αφαίρεση του L έκοψε και τον K'; end if;
  if not private.accountant_sees_file(probe_s.u('O')::text || '/accountant-pack/2026.zip', false) then
    raise exception 'Η αφαίρεση του L έκοψε τα αρχεία του K';
  end if;
  perform set_config('probe.uid', '', false);
  raise notice 'probe: το αφαιρεμένο μέλος χάνει αμέσως φάκελο, αρχεία και σύνδεσμο, οι άλλοι κρατούν';
end $probe$;

-- ═══ 4. ΜΕΛΟΣ ΓΡΑΦΕΙΟΥ ΧΩΡΙΣ ΔΕΥΤΕΡΟ ΒΗΜΑ ΔΕΝ ΒΛΕΠΕΙ ΤΙΠΟΤΑ ═════════════════
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
set role authenticated;
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a3';
do $probe$
declare blocked boolean := false;
begin
  begin
    perform public.accountant_clients_overview(2026);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: μέλος γραφείου χωρίς δεύτερο παράγοντα διαβάζει πελάτη'; end if;
  if exists (select 1 from public.firm_record_log) then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: μέλος χωρίς δεύτερο παράγοντα διαβάζει το ημερολόγιο'; end if;
end $probe$;
reset role;
do $probe$
begin
  perform set_config('probe.uid', probe_s.u('K')::text, false);
  if private.accountant_sees_file(probe_s.u('O')::text || '/accountant-pack/2026.zip', false) then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: μέλος χωρίς δεύτερο παράγοντα διαβάζει αρχεία πελάτη';
  end if;
  -- Ο ιδιοκτήτης χωρίς συσκευή δεν αλλάζει: ο κανόνας είναι για τα μέλη.
  perform set_config('probe.uid', probe_s.u('O')::text, false);
  if not private.mfa_satisfied() then raise exception 'Ο ιδιοκτήτης χωρίς συσκευή κλειδώθηκε έξω'; end if;
  perform set_config('probe.uid', '', false);
  raise notice 'probe: τα μέλη γραφείου χρειάζονται δεύτερο βήμα, ο ιδιοκτήτης όπως πριν';
end $probe$;
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);

-- ═══ 1γ. Η ΑΝΑΚΛΗΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΚΟΒΕΙ ΑΜΕΣΩΣ ΑΚΟΜΗ ΚΑΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ ═══
reset role;
do $probe$ begin perform set_config('probe.oldtoken', (select token from public.accountant_links where user_id = probe_s.u('O')), false); end $probe$;
set role authenticated;
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a1';
do $probe$
begin
  if not exists (select 1 from public.firm_record_log where owner_id = probe_s.u('O')) then
    raise exception 'Ο υπεύθυνος δεν βλέπει το ημερολόγιο πριν από την ανάκληση: ο έλεγχος από κάτω δεν θα σήμαινε τίποτα';
  end if;
end $probe$;
set session "probe.uid" = 'f3000000-0000-4000-8000-000000000001';
do $probe$
declare res json := public.owner_revoke_firm('f3000000-0000-4000-8000-00000000ff01');
begin
  if not coalesce((res->>'ok')::boolean, false) then raise exception 'Η ανάκληση απέτυχε: %', res; end if;
end $probe$;
do $probe$
declare who text;
begin
  foreach who in array array['M', 'K'] loop
    perform set_config('probe.uid', probe_s.u(who)::text, false);
    if public.get_accountant_data(current_setting('probe.oldtoken'), 2026) is not null then
      raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο σύνδεσμος που είχε δει το γραφείο ισχύει ακόμη';
    end if;
    if public.firm_client_data(probe_s.u('O'), 2026) is not null then raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο % διαβάζει τον φάκελο', who; end if;
    if exists (select 1 from public.firm_record_log where owner_id = probe_s.u('O')) then
      raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο % διαβάζει το ημερολόγιο του πελάτη', who;
    end if;
  end loop;
end $probe$;
reset role;
do $probe$
declare who text;
begin
  foreach who in array array['M', 'K'] loop
    perform set_config('probe.uid', probe_s.u(who)::text, false);
    if private.accountant_sees_file(probe_s.u('O')::text || '/accountant-pack/2026.zip', false) then
      raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο % διαβάζει αρχεία', who;
    end if;
  end loop;
  perform set_config('probe.uid', '', false);
  raise notice 'probe: η ανάκληση κόβει φάκελο, αρχεία, σύνδεσμο και ημερολόγιο αμέσως';
end $probe$;

-- ═══ 5. Η ΕΞΑΓΩΓΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΕΧΕΙ ΚΑΙ ΤΑ ΔΥΟ ΗΜΕΡΟΛΟΓΙΑ ══════════════════
set role authenticated;
set session "probe.uid" = 'f3000000-0000-4000-8000-000000000001';
do $probe$
declare d jsonb := public.export_my_data()->'data';
begin
  if not (d ? 'firm_access_log') then raise exception 'Η εξαγωγή του ιδιοκτήτη δεν έχει το ιστορικό πρόσβασης του γραφείου'; end if;
  if not (d ? 'firm_record_log') then raise exception 'Η εξαγωγή του ιδιοκτήτη δεν έχει το ημερολόγιο κινήσεων του γραφείου'; end if;
end $probe$;
-- Και η εξαγωγή του ΜΕΛΟΥΣ δεν κουβαλά τα δεδομένα των πελατών του.
set session "probe.uid" = 'f3000000-0000-4000-8000-0000000000a3';
do $probe$
declare d jsonb := public.export_my_data()->'data';
begin
  if exists (select 1 from jsonb_array_elements(coalesce(d->'firm_record_log', '[]')) x
              where x->>'owner_id' <> probe_s.u('K')::text
                and (x ?| array['before', 'after', 'label'])) then
    raise exception 'ΔΙΑΡΡΟΗ: η εξαγωγή του μέλους κουβαλά στοιχεία πελάτη από το ημερολόγιο';
  end if;
  raise notice 'probe: ο ιδιοκτήτης εξάγει και τα δύο ημερολόγια, το μέλος μόνο τις κινήσεις του';
end $probe$;

-- ═══ 3. ΤΟ ΙΣΤΟΡΙΚΟ ΜΕΝΕΙ ΣΤΟΝ ΙΔΙΟΚΤΗΤΗ ΟΤΑΝ ΦΥΓΟΥΝ ΤΑ ΜΕΛΗ ══════════════
reset role;
set session "probe.uid" = '';
do $probe$
declare who text; n int;
begin
  foreach who in array array['L', 'K', 'M'] loop
    perform public.erase_account(probe_s.u(who));
  end loop;
  if exists (select 1 from public.firms where id = 'f3000000-0000-4000-8000-00000000ff01') then
    raise exception 'Το γραφείο χωρίς μέλη έμεινε πίσω';
  end if;
  select count(*) into n from public.firm_access_log where owner_id = probe_s.u('O');
  if n = 0 then raise exception 'ΑΠΩΛΕΙΑ: με τα μέλη έφυγε το ιστορικό πρόσβασης του ιδιοκτήτη'; end if;
  if exists (select 1 from public.firm_access_log where owner_id = probe_s.u('O') and (firm_name is null or member_name is null)) then
    raise exception 'Το ιστορικό του ιδιοκτήτη έχασε ποιο γραφείο και ποιο μέλος';
  end if;
  select count(*) into n from public.firm_record_log where owner_id = probe_s.u('O');
  if n = 0 then raise exception 'ΑΠΩΛΕΙΑ: με τα μέλη έφυγε το ημερολόγιο κινήσεων του ιδιοκτήτη'; end if;
  if exists (select 1 from public.firm_record_log where owner_id = probe_s.u('O') and (firm_name is null or member_name is null)) then
    raise exception 'Το ημερολόγιο του ιδιοκτήτη έχασε ποιο γραφείο και ποιο μέλος';
  end if;
  raise notice 'probe: ο ιδιοκτήτης κρατά το ιστορικό του όταν φύγουν το γραφείο και τα μέλη του';
end $probe$;

-- ── Καθαρισμός ──────────────────────────────────────────────────────────────
do $probe$
begin
  perform public.erase_account(probe_s.u('O'));
  if exists (select 1 from public.firm_access_log where owner_id = probe_s.u('O'))
     or exists (select 1 from public.firm_record_log where owner_id = probe_s.u('O')) then
    raise exception 'Η διαγραφή του ιδιοκτήτη άφησε ημερολόγια πίσω';
  end if;
  raise notice 'probe: η διαγραφή του ιδιοκτήτη σβήνει και τα δύο ημερολόγια';
end $probe$;
drop schema probe_s cascade;
