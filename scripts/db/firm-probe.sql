-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΑ ΛΟΓΙΣΤΙΚΑ ΓΡΑΦΕΙΑ, ΔΟΚΙΜΑΣΜΕΝΑ ΣΤΗΝ ΙΔΙΑ ΤΗ ΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
--  Τρέχει μετά το rls-probe.sql, στην ίδια βάση: το `auth.uid()` διαβάζει ήδη
--  το `probe.uid` και ο ρόλος `authenticated` έχει τα GRANT του Supabase.
--
--  Πρόσωπα:
--    O1, O2   δύο ιδιοκτήτες, ένας σύνδεσμος λογιστή ο καθένας
--    M        υπεύθυνος του γραφείου Φ
--    L        λογιστής του Φ
--    S        συνεργάτης του Φ
--    X        υπεύθυνος του άλλου γραφείου Γ
--    P        λογιστής με δικά του ακίνητα πριν από τα γραφεία
--
--  Αποδεικνύεται:
--    1. κανένα γραφείο δεν βλέπει τους πελάτες άλλου·
--    2. ο συνεργάτης δεν γράφει (αίτημα, Ε2, ανέβασμα)·
--    3. ο λογιστής βλέπει μόνο όσους του ανατέθηκαν·
--    4. η ανάκληση (από τον ιδιοκτήτη ή την αφαίρεση μέλους) κόβει αμέσως·
--    5. η μεταφορά κρατά κάθε υπάρχουσα πρόσβαση·
--    6. ο λογαριασμός γραφείου δεν καταχωρεί ακίνητα, ο παλιός λογιστής με
--       ακίνητα συνεχίζει, ο ιδιοκτήτης δεν αγγίζεται.
-- ═══════════════════════════════════════════════════════════════════════════

reset role;
set session "probe.uid" = '';
-- Τα μέλη γραφείου χρειάζονται δεύτερο βήμα (20261104150000): εδώ το έχουν.
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $probe$
begin
  insert into auth.users(id, email) values
    ('f1000000-0000-4000-8000-000000000001', 'o1@firm.test'),
    ('f1000000-0000-4000-8000-000000000002', 'o2@firm.test'),
    ('f1000000-0000-4000-8000-0000000000a1', 'm@firm.test'),
    ('f1000000-0000-4000-8000-0000000000a2', 'l@firm.test'),
    ('f1000000-0000-4000-8000-0000000000a3', 's@firm.test'),
    ('f1000000-0000-4000-8000-0000000000b1', 'x@other.test'),
    ('f1000000-0000-4000-8000-0000000000c1', 'p@legacy.test');
  insert into public.user_properties(user_id, name) values
    ('f1000000-0000-4000-8000-000000000001', 'Του Ο1'),
    ('f1000000-0000-4000-8000-000000000002', 'Του Ο2'),
    ('f1000000-0000-4000-8000-0000000000c1', 'Του Π');
  insert into public.accountant_links(user_id, token, active) values
    ('f1000000-0000-4000-8000-000000000001', 'firm-probe-o1', true),
    ('f1000000-0000-4000-8000-000000000002', 'firm-probe-o2', true);
end $probe$;

-- ── 5. Η ΜΕΤΑΦΟΡΑ: μια παλιά άδεια χωρίς γραφείο ───────────────────────────
-- Γράφεται όπως ήταν πριν από τη μετανάστευση (χωρίς τη σκανδάλη) και περνά
-- από το ίδιο βήμα μεταφοράς. Ο Π πρέπει να βλέπει τον Ο2 όπως πριν.
alter table public.accountant_clients disable trigger accountant_clients_firm;
alter table public.accountant_clients disable trigger accountant_clients_assign;
insert into public.accountant_clients(accountant_id, owner_id, claimed_token)
  values ('f1000000-0000-4000-8000-0000000000c1', 'f1000000-0000-4000-8000-000000000002', 'firm-probe-o2');
alter table public.accountant_clients enable trigger accountant_clients_firm;
alter table public.accountant_clients enable trigger accountant_clients_assign;

do $probe$
declare p uuid := 'f1000000-0000-4000-8000-0000000000c1'; o2 uuid := 'f1000000-0000-4000-8000-000000000002';
begin
  if not public.accountant_link_live(p, o2) then
    raise exception 'Η παλιά άδεια χωρίς γραφείο δεν κρατά πριν από τη μεταφορά';
  end if;
  -- Το ίδιο βήμα με τη μετανάστευση.
  update public.accountant_clients set firm_id = private.firm_ensure(accountant_id)
   where accountant_id = p and firm_id is null;
  if not public.accountant_link_live(p, o2) then
    raise exception 'ΑΠΩΛΕΙΑ: η μεταφορά έκοψε την πρόσβαση του λογιστή';
  end if;
  if private.firm_role(p, private.firm_of(p)) <> 'manager' then
    raise exception 'Ο μεταφερμένος λογιστής δεν έγινε υπεύθυνος του γραφείου του';
  end if;
  if private.is_firm_only(p) then
    raise exception 'ΚΛΕΙΔΩΜΑ: λογιστής με δικά του ακίνητα έγινε λογαριασμός μόνο γραφείου';
  end if;
  -- Και η μετανάστευση δεν άφησε καμία παλιά άδεια χωρίς γραφείο.
  if exists (select 1 from public.accountant_clients where firm_id is null) then
    raise exception 'Έμειναν άδειες χωρίς γραφείο μετά τη μεταφορά';
  end if;
  raise notice 'probe: η μεταφορά κρατά την πρόσβαση και κάνει τον λογιστή υπεύθυνο';
end $probe$;

-- ── Το γραφείο Φ στήνεται από τον M ────────────────────────────────────────
set role authenticated;
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a1';
do $probe$
declare res json;
begin
  res := public.accountant_claim('firm-probe-o1');
  if not (res->>'ok')::boolean then raise exception 'Ο M δεν διεκδίκησε: %', res->>'reason'; end if;
  res := public.firm_save('Γραφείο Φ', '094014201', 'accounting', null, null);
  if not (res->>'ok')::boolean then raise exception 'firm_save: %', res->>'reason'; end if;
  res := public.firm_invite('l@firm.test', 'accountant');
  if not (res->>'ok')::boolean then raise exception 'firm_invite L: %', res->>'reason'; end if;
  res := public.firm_invite('s@firm.test', 'associate');
  if not (res->>'ok')::boolean then raise exception 'firm_invite S: %', res->>'reason'; end if;
  if (public.my_firm()->>'role') <> 'manager' then raise exception 'Ο M δεν είναι υπεύθυνος'; end if;

  -- Καμία απευθείας εγγραφή στους πίνακες του γραφείου.
  begin
    insert into public.firm_members(firm_id, user_id, email, role, status)
      values (private.firm_of('f1000000-0000-4000-8000-0000000000a1'), 'f1000000-0000-4000-8000-0000000000b1', 'x@other.test', 'manager', 'active');
    raise exception 'ΔΙΑΡΡΟΗ: απευθείας εισαγωγή μέλους πέρασε';
  exception when insufficient_privilege then null;
  end;
  update public.firms set name = 'Πειραγμένο';
  if exists (select 1 from public.firms where name = 'Πειραγμένο') then
    raise exception 'ΔΙΑΡΡΟΗ: απευθείας ενημέρωση γραφείου πέρασε';
  end if;
  raise notice 'probe: ο υπεύθυνος στήνει γραφείο και προσκαλεί, κανείς δεν γράφει απευθείας';
end $probe$;

do $probe$
declare who text; res json;
begin
  foreach who in array array['f1000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-0000000000a3'] loop
    perform set_config('probe.uid', who, false);
    res := public.my_firm_invites();
    if json_array_length(res) <> 1 then raise exception 'Ο % βλέπει % προσκλήσεις', who, json_array_length(res); end if;
    res := public.firm_invite_answer((res->0->>'id')::uuid, true);
    if not (res->>'ok')::boolean then raise exception 'Αποδοχή %: %', who, res->>'reason'; end if;
  end loop;

  -- 3. Μέλη χωρίς ανάθεση δεν βλέπουν κανέναν πελάτη.
  foreach who in array array['f1000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-0000000000a3'] loop
    perform set_config('probe.uid', who, false);
    if json_array_length(public.accountant_clients_overview(2026)) <> 0 then
      raise exception 'ΔΙΑΡΡΟΗ: μέλος χωρίς ανάθεση βλέπει πελάτες (%)', who;
    end if;
    if (public.firm_open_client('f1000000-0000-4000-8000-000000000001')->>'ok')::boolean then
      raise exception 'ΔΙΑΡΡΟΗ: μέλος χωρίς ανάθεση άνοιξε πελάτη (%)', who;
    end if;
  end loop;
  raise notice 'probe: μέλος χωρίς ανάθεση δεν βλέπει κανέναν πελάτη';
end $probe$;

-- Ο M αναθέτει τον Ο1 στον L και στον S.
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a1';
do $probe$
declare res json;
begin
  res := public.firm_assign(array['f1000000-0000-4000-8000-000000000001']::uuid[], 'f1000000-0000-4000-8000-0000000000a2', true);
  if (res->>'changed')::int <> 1 then raise exception 'Ανάθεση L: %', res; end if;
  res := public.firm_assign(array['f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002']::uuid[], 'f1000000-0000-4000-8000-0000000000a3', true);
  -- Ο Ο2 δεν είναι πελάτης του Φ: δεν ανατίθεται.
  if (res->>'changed')::int <> 1 then raise exception 'Ανάθεση S ανέθεσε ξένο πελάτη: %', res; end if;
end $probe$;

-- ── 3. Ο λογιστής βλέπει και ενεργεί για όσους του ανατέθηκαν ──────────────
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a2';
do $probe$
declare res json; o1 uuid := 'f1000000-0000-4000-8000-000000000001';
begin
  res := public.accountant_clients_overview(2026);
  if json_array_length(res) <> 1 or (res->0->>'ownerId')::uuid <> o1 then
    raise exception 'Ο λογιστής έπρεπε να βλέπει μόνο τον Ο1: %', res;
  end if;
  if not (res->0->>'canAct')::boolean then raise exception 'Ο λογιστής δεν μπορεί να ενεργήσει'; end if;
  res := public.accountant_request_item(o1, 'Εκκαθαριστικό ΕΝΦΙΑ', null);
  if not (res->>'ok')::boolean then raise exception 'Αίτημα λογιστή: %', res->>'reason'; end if;
  if not (public.firm_open_client(o1)->>'ok')::boolean then raise exception 'Ο λογιστής δεν άνοιξε τον Ο1'; end if;
  -- Δεύτερο μέλος διεκδικεί τον ίδιο σύνδεσμο: ο ιδιοκτήτης βλέπει ακόμη ΕΝΑ γραφείο.
  if not (public.accountant_claim('firm-probe-o1')->>'ok')::boolean then raise exception 'Δεύτερη διεκδίκηση απέτυχε'; end if;
  if json_array_length(public.accountant_clients_overview(2026)) <> 1 then raise exception 'Διπλός πελάτης στη λίστα του γραφείου'; end if;
  raise notice 'probe: ο λογιστής βλέπει μόνο τον πελάτη του και ζητά';
end $probe$;

-- ── 2. Ο συνεργάτης διαβάζει, δεν γράφει ───────────────────────────────────
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a3';
do $probe$
declare res json; o1 uuid := 'f1000000-0000-4000-8000-000000000001'; n int;
begin
  res := public.accountant_clients_overview(2026);
  if json_array_length(res) <> 1 then raise exception 'Ο συνεργάτης έπρεπε να βλέπει τον Ο1: %', res; end if;
  if (res->0->>'canAct')::boolean then raise exception 'Ο συνεργάτης φαίνεται να ενεργεί'; end if;
  -- Βλέπει το αίτημα του συναδέλφου, όχι διπλό.
  if (res->0->>'openRequests')::int <> 1 then raise exception 'Ο συνεργάτης δεν βλέπει το αίτημα του γραφείου'; end if;
  res := public.accountant_request_item(o1, 'Συμβόλαιο', null);
  if (res->>'ok')::boolean then raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης υπέβαλε αίτημα'; end if;
  begin
    insert into public.e2_prefilled(user_id, tax_year, owner_afm) values (o1, 2026, '094014201');
    raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης έγραψε Ε2';
  exception when insufficient_privilege then null;
  end;
  update public.user_properties set name = 'Πειραγμένο' where user_id = o1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης άλλαξε ακίνητο'; end if;
  if not private.accountant_sees_file(o1::text || '/accountant-pack/2026.zip', false) then
    raise exception 'Ο συνεργάτης δεν διαβάζει τον φάκελο';
  end if;
  if private.accountant_sees_file(o1::text || '/aade-e2/2026.pdf', true) then
    raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης ανεβάζει Ε2';
  end if;
  if (public.firm_assign(array[o1], 'f1000000-0000-4000-8000-0000000000a3', false)->>'ok')::boolean then
    raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης αλλάζει αναθέσεις';
  end if;
  if (public.firm_invite('evil@x.test', 'manager')->>'ok')::boolean then
    raise exception 'ΔΙΑΡΡΟΗ: ο συνεργάτης προσκαλεί';
  end if;
  raise notice 'probe: ο συνεργάτης διαβάζει, δεν ζητά, δεν ανεβάζει, δεν αναθέτει';
end $probe$;

-- ── 1. Κανένα γραφείο δεν βλέπει τους πελάτες άλλου ───────────────────────
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000b1';
do $probe$
declare res json; o1 uuid := 'f1000000-0000-4000-8000-000000000001'; n int;
begin
  res := public.accountant_claim('firm-probe-o2');
  if not (res->>'ok')::boolean then raise exception 'Ο X δεν διεκδίκησε: %', res->>'reason'; end if;
  res := public.accountant_clients_overview(2026);
  if json_array_length(res) <> 1 or (res->0->>'ownerId')::uuid = o1 then
    raise exception 'ΔΙΑΡΡΟΗ: το γραφείο Γ βλέπει: %', res;
  end if;
  if (public.accountant_request_item(o1, 'Κάτι', null)->>'ok')::boolean then raise exception 'ΔΙΑΡΡΟΗ: το Γ ζητά από τον Ο1'; end if;
  if (public.firm_open_client(o1)->>'ok')::boolean then raise exception 'ΔΙΑΡΡΟΗ: το Γ ανοίγει τον Ο1'; end if;
  select count(*) into n from public.firm_members where email like '%@firm.test';
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: το Γ βλέπει % μέλη του Φ', n; end if;
  select count(*) into n from public.firms where name = 'Γραφείο Φ';
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: το Γ βλέπει το Φ'; end if;
  select count(*) into n from public.firm_client_assignees where owner_id = o1;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: το Γ βλέπει τις αναθέσεις του Φ'; end if;
  select count(*) into n from public.firm_access_log where owner_id = o1;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: το Γ βλέπει το ιστορικό του Φ'; end if;
  if (public.firm_assign(array[o1], 'f1000000-0000-4000-8000-0000000000a2', true)->>'ok')::boolean then
    raise exception 'ΔΙΑΡΡΟΗ: το Γ αναθέτει σε μέλος του Φ';
  end if;
  raise notice 'probe: δύο γραφεία, κανένα δεν βλέπει τα του άλλου';
end $probe$;

-- Και ο M δεν βλέπει τον Ο2 του Γ.
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a1';
do $probe$
declare res json := public.accountant_clients_overview(2026);
begin
  if json_array_length(res) <> 1 then raise exception 'ΔΙΑΡΡΟΗ: ο υπεύθυνος του Φ βλέπει % πελάτες', json_array_length(res); end if;
  if json_array_length(public.firm_access_history(50)) < 1 then raise exception 'Ο υπεύθυνος δεν βλέπει το ιστορικό'; end if;
  raise notice 'probe: ο υπεύθυνος βλέπει μόνο τους πελάτες του γραφείου και το ιστορικό τους';
end $probe$;

-- ── 6. Ο λογαριασμός γραφείου δεν καταχωρεί ακίνητα ───────────────────────
do $probe$
declare who text; t text;
begin
  foreach who in array array['f1000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-0000000000a3'] loop
    perform set_config('probe.uid', who, false);
    begin
      insert into public.user_properties(user_id, name) values (who::uuid, 'Του γραφείου');
      raise exception 'ΠΑΡΑΒΙΑΣΗ: ο λογαριασμός γραφείου % καταχώρησε ακίνητο', who;
    exception when insufficient_privilege then
      if sqlerrm <> 'firm_account' then raise; end if;
    end;
    begin
      insert into public.expenses(user_id, amount, date) values (who::uuid, 10, current_date);
      raise exception 'ΠΑΡΑΒΙΑΣΗ: ο λογαριασμός γραφείου % καταχώρησε δαπάνη', who;
    exception when insufficient_privilege then
      if sqlerrm <> 'firm_account' then raise; end if;
    end;
  end loop;
  raise notice 'probe: ο λογαριασμός γραφείου δεν καταχωρεί ακίνητα ούτε δαπάνες';
end $probe$;

-- Ο ιδιοκτήτης και ο παλιός λογιστής με ακίνητα συνεχίζουν κανονικά.
do $probe$
declare who text;
begin
  foreach who in array array['f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-0000000000c1'] loop
    perform set_config('probe.uid', who, false);
    insert into public.user_properties(user_id, name) values (who::uuid, 'Δεύτερο');
  end loop;
  -- Όποιος έχει ακίνητα δεν μπαίνει σε γραφείο με τον ίδιο λογαριασμό.
  perform set_config('probe.uid', 'f1000000-0000-4000-8000-0000000000a1', false);
  perform public.firm_invite('o2@firm.test', 'associate');
  perform set_config('probe.uid', 'f1000000-0000-4000-8000-000000000002', false);
  if (public.firm_invite_answer((public.my_firm_invites()->0->>'id')::uuid, true)->>'reason') <> 'owner_account' then
    raise exception 'Ιδιοκτήτης με ακίνητα μπήκε σε γραφείο με τον ίδιο λογαριασμό';
  end if;
  raise notice 'probe: ιδιοκτήτης και λογιστής με δικά του ακίνητα καταχωρούν όπως πριν';
end $probe$;

-- ── 4. Η ανάκληση κόβει αμέσως ────────────────────────────────────────────
-- Αφαίρεση μέλους από τον υπεύθυνο.
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a1';
do $probe$
declare mid uuid; res json;
begin
  select (x->>'id')::uuid into mid from json_array_elements(public.my_firm()->'members') x where x->>'email' = 'l@firm.test';
  res := public.firm_member_update(mid, null, true);
  if not (res->>'ok')::boolean then raise exception 'Αφαίρεση L: %', res->>'reason'; end if;
  -- Ο τελευταίος υπεύθυνος δεν φεύγει.
  select (x->>'id')::uuid into mid from json_array_elements(public.my_firm()->'members') x where x->>'email' = 'm@firm.test';
  if (public.firm_member_update(mid, 'associate', false)->>'reason') <> 'last_manager' then
    raise exception 'Ο τελευταίος υπεύθυνος υποβιβάστηκε';
  end if;
end $probe$;
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000a2';
do $probe$
begin
  if json_array_length(public.accountant_clients_overview(2026)) <> 0 then raise exception 'ΔΙΑΡΡΟΗ: αφαιρεμένο μέλος βλέπει πελάτες'; end if;
  if (public.accountant_request_item('f1000000-0000-4000-8000-000000000001', 'Κάτι άλλο', null)->>'ok')::boolean then
    raise exception 'ΔΙΑΡΡΟΗ: αφαιρεμένο μέλος ζητά';
  end if;
end $probe$;
reset role;
do $probe$
begin
  if public.accountant_link_live('f1000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-000000000001') then
    raise exception 'ΔΙΑΡΡΟΗ: αφαιρεμένο μέλος ενεργεί';
  end if;
  raise notice 'probe: το μέλος που αφαιρείται χάνει αμέσως τους πελάτες';
end $probe$;
set role authenticated;

-- Ο ιδιοκτήτης ανακαλεί ολόκληρο το γραφείο.
set session "probe.uid" = 'f1000000-0000-4000-8000-000000000001';
do $probe$
declare res json := public.my_accountants();
begin
  if json_array_length(res) <> 1 or res->0->>'firmName' <> 'Γραφείο Φ' then raise exception 'Ο ιδιοκτήτης δεν βλέπει το γραφείο του: %', res; end if;
  if json_array_length(res->0->'members') <> 2 then raise exception 'Ο ιδιοκτήτης βλέπει % μέλη αντί για 2 (υπεύθυνος, συνεργάτης)', json_array_length(res->0->'members'); end if;
  if res->0->>'lastOpenedAt' is null then raise exception 'Ο ιδιοκτήτης δεν βλέπει πότε άνοιξε ο φάκελος'; end if;
  res := public.owner_revoke_firm((res->0->>'firmId')::uuid);
  if json_array_length(public.my_accountants()) <> 0 then raise exception 'Η ανάκληση δεν έσβησε την άδεια'; end if;
end $probe$;
do $probe$
declare who text;
begin
  foreach who in array array['f1000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000a3'] loop
    perform set_config('probe.uid', who, false);
    if json_array_length(public.accountant_clients_overview(2026)) <> 0 then
      raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο % βλέπει πελάτες', who;
    end if;
    if private.accountant_sees_file('f1000000-0000-4000-8000-000000000001/accountant-pack/2026.zip', false) then
      raise exception 'ΔΙΑΡΡΟΗ: μετά την ανάκληση ο % διαβάζει τον φάκελο', who;
    end if;
  end loop;
  raise notice 'probe: η ανάκληση του ιδιοκτήτη κόβει όλο το γραφείο αμέσως';
end $probe$;

-- Η περιστροφή του συνδέσμου κόβει κι αυτή το γραφείο Γ.
reset role;
set session "probe.uid" = '';
update public.accountant_links set active = false where token = 'firm-probe-o2';
set role authenticated;
set session "probe.uid" = 'f1000000-0000-4000-8000-0000000000b1';
do $probe$
begin
  if json_array_length(public.accountant_clients_overview(2026)) <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ανενεργός σύνδεσμος, το Γ βλέπει ακόμη'; end if;
  raise notice 'probe: ο ανενεργός σύνδεσμος κόβει το γραφείο';
end $probe$;

reset role;
set session "probe.uid" = '';

-- ── Καθαρισμός: τα πρόσωπα φεύγουν όπως φεύγει κάθε λογαριασμός ──────────
do $probe$
declare u uuid; n int;
begin
  for u in select id from auth.users where id::text like 'f1000000-%' loop
    perform public.erase_account(u);
  end loop;
  -- Το γραφείο χωρίς μέλη δεν μένει πίσω.
  select count(*) into n from public.firms f where not exists (select 1 from public.firm_members m where m.firm_id = f.id and m.status = 'active');
  if n <> 0 then raise exception 'Έμειναν % γραφεία χωρίς ενεργά μέλη', n; end if;
  select count(*) into n from public.firm_members where email like '%@firm.test' or email like '%@other.test' or email like '%@legacy.test';
  if n <> 0 then raise exception 'Η διαγραφή λογαριασμού άφησε % μέλη γραφείου', n; end if;
  raise notice 'probe: η διαγραφή λογαριασμού δεν αφήνει γραφείο ή πρόσκληση πίσω';
end $probe$;
