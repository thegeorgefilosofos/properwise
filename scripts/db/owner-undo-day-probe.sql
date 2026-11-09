-- ═══════════════════════════════════════════════════════════════════════════
--  Η ΑΝΑΙΡΕΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ: ΣΗΜΕΡΑ ΚΑΙ ΧΘΕΣ, ΜΕ ΤΗ ΜΕΡΑ ΤΗΣ ΑΘΗΝΑΣ
--  (20261109100000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα.
--   · καμία από τις τρεις συναρτήσεις δεν κρίνει με `current_date` (UTC)·
--   · πληρωμή με τη σημερινή μέρα της Αθήνας περνά, με την αυριανή όχι·
--   · σύνοψη και αναίρεση για σήμερα και χθες· προχθές και αύριο: κενή σύνοψη,
--     αναίρεση `window` που δεν αγγίζει τίποτα·
--   · η αναίρεση του χθες δεν αγγίζει το σήμερα και επιστρέφει τη διαδρομή του
--     αρχείου που πρέπει να σβηστεί (`filePaths`)·
--   · χωρίς μέρα: το σήμερα της Αθήνας.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
do $probe$
declare
  o uuid := 'f6000000-0000-4000-8000-000000000001';
  m uuid := 'f6000000-0000-4000-8000-0000000000a1';
  f uuid := 'f6000000-0000-4000-8000-00000000ff01';
  p uuid := 'f6000000-0000-4000-8000-00000000f001';
  today date := (now() at time zone 'Europe/Athens')::date;
  fn text;
  bill uuid;
  res json;
  doc_y uuid; doc_t uuid; doc_old uuid;
  path_y text := 'f6000000-0000-4000-8000-000000000001/f6000000-0000-4000-8000-00000000f001/document/chthes.pdf';
  got text;
begin
  -- ── 1. Καμία μέρα του UTC ──────────────────────────────────────────────
  foreach fn in array array['firm_mark_paid', 'owner_firm_day', 'owner_undo_firm_day'] loop
    if exists (select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
                where n.nspname = 'public' and pr.proname = fn and pr.prosrc ilike '%current_date%') then
      raise exception 'ΩΡΑ UTC: η public.% κρίνει ακόμη με current_date', fn;
    end if;
  end loop;
  raise notice 'probe: πληρωμή, σύνοψη και αναίρεση κρίνουν με τη μέρα της Αθήνας';

  insert into auth.users(id, email, raw_user_meta_data) values
    (o, 'o@undo-day.test', jsonb_build_object('dpa_version', private.firm_dpa_version())),
    (m, 'm@undo-day.test', '{}');
  insert into public.user_properties(id, user_id, name) values (p, o, 'Του Ο');
  insert into public.accountant_links(user_id, token, active) values (o, 'undo-day-probe-o', true);
  insert into public.firms(id, name, created_by) values (f, 'Γραφείο Ημέρας', m);
  insert into public.firm_members(firm_id, user_id, email, role, status, joined_at, firm_only) values
    (f, m, 'm@undo-day.test', 'manager', 'active', now(), true);
  insert into public.accountant_clients(accountant_id, owner_id, claimed_token, firm_id, access_level)
    values (m, o, 'undo-day-probe-o', f, 'keep');
  insert into public.bills(user_id, property_id, type, name, amount, due_date, paid)
    values (o, p, 'ΔΕΗ', 'ΔΕΗ', 40, today, false) returning id into bill;

  -- ── 2. Η πληρωμή: σήμερα της Αθήνας ναι, αύριο όχι ─────────────────────
  perform set_config('probe.uid', m::text, true);
  begin
    perform public.firm_mark_paid('bill', bill, today + 1, null);
    raise exception 'ΗΜΕΡΟΜΗΝΙΑ: δεκτή πληρωμή με αυριανή ημερομηνία';
  exception when invalid_parameter_value then null;
  end;
  res := public.firm_mark_paid('bill', bill, today, null);
  if not coalesce((res->>'ok')::boolean, false) then raise exception 'ΗΜΕΡΟΜΗΝΙΑ: η σημερινή πληρωμή κόπηκε: %', res; end if;
  raise notice 'probe: πληρωμή με τη σημερινή μέρα της Αθήνας περνά· με την αυριανή όχι';

  -- ── 3. Τρία παραστατικά: χθες, σήμερα, προχθές ────────────────────────
  res := public.firm_record(o, p, 'document', jsonb_build_object('file_path', path_y, 'file_name', 'chthes.pdf',
                            'mime', 'application/pdf', 'size_bytes', 100, 'title', 'Χθεσινό'));
  doc_y := (res->>'id')::uuid;
  res := public.firm_record(o, p, 'document', jsonb_build_object('file_path', o || '/' || p || '/document/simera.pdf',
                            'file_name', 'simera.pdf', 'mime', 'application/pdf', 'size_bytes', 100, 'title', 'Σημερινό'));
  doc_t := (res->>'id')::uuid;
  res := public.firm_record(o, p, 'document', jsonb_build_object('file_path', o || '/' || p || '/document/prochthes.pdf',
                            'file_name', 'prochthes.pdf', 'mime', 'application/pdf', 'size_bytes', 100, 'title', 'Προχθεσινό'));
  doc_old := (res->>'id')::uuid;
  -- Το μεσημέρι της μέρας τους, ώρα Αθήνας: καμία άκρη μεσάνυχτων στη δοκιμή.
  update public.firm_record_log set at = ((today - 1) + time '12:00') at time zone 'Europe/Athens' where row_id = doc_y;
  update public.firm_record_log set at = ((today - 2) + time '12:00') at time zone 'Europe/Athens' where row_id = doc_old;
  update public.firm_record_log set at = (today + time '00:30') at time zone 'Europe/Athens' where row_id = doc_t;

  -- ── 4. Η σύνοψη: σήμερα και χθες μόνο ─────────────────────────────────
  perform set_config('probe.uid', o::text, true);
  if json_array_length(public.owner_firm_day(today - 1)) <> 1 then
    raise exception 'ΠΑΡΑΘΥΡΟ: η σύνοψη του χθες δεν βρήκε το χθεσινό: %', public.owner_firm_day(today - 1);
  end if;
  if json_array_length(public.owner_firm_day(today - 2)) <> 0 or json_array_length(public.owner_firm_day(today + 1)) <> 0 then
    raise exception 'ΠΑΡΑΘΥΡΟ: σύνοψη έξω από σήμερα και χθες';
  end if;
  -- 00:30 ώρα Αθήνας είναι ακόμη «χθες» στο UTC: μετρά στο σήμερα.
  if (select (x->>'total')::int from json_array_elements(public.owner_firm_day(null)) x) <> 2 then
    raise exception 'ΩΡΑ UTC: η σημερινή σύνοψη χωρίς μέρα δεν είναι το σήμερα της Αθήνας: %', public.owner_firm_day(null);
  end if;
  raise notice 'probe: η σύνοψη δείχνει σήμερα και χθες, όχι προχθές ή αύριο';

  -- ── 5. Η αναίρεση: έξω από το παράθυρο τίποτα ─────────────────────────
  res := public.owner_undo_firm_day(f, today - 2);
  if res->>'reason' is distinct from 'window' or not exists (select 1 from public.property_documents where id = doc_old) then
    raise exception 'ΠΑΡΑΘΥΡΟ: αναίρεση προχθεσινής καταχώρησης: %', res;
  end if;
  res := public.owner_undo_firm_day(f, today + 1);
  if res->>'reason' is distinct from 'window' then raise exception 'ΠΑΡΑΘΥΡΟ: αναίρεση αυριανής μέρας: %', res; end if;

  -- ── 6. Η αναίρεση του χθες: μόνο το χθες, με το αρχείο του ─────────────
  res := public.owner_undo_firm_day(f, today - 1);
  if not coalesce((res->>'ok')::boolean, false) or (res->>'undone')::int <> 1 then
    raise exception 'Η αναίρεση του χθες δεν έγινε: %', res;
  end if;
  if exists (select 1 from public.property_documents where id = doc_y) then
    raise exception 'Η αναίρεση του χθες άφησε το χθεσινό παραστατικό';
  end if;
  if not exists (select 1 from public.property_documents where id = doc_t) then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: η αναίρεση του χθες έσβησε σημερινό παραστατικό';
  end if;
  select string_agg(x, ',') into got from json_array_elements_text(res->'filePaths') x;
  if got is distinct from path_y then
    raise exception 'ΑΡΧΕΙΟ: η αναίρεση δεν επέστρεψε τη διαδρομή του αρχείου (%), πήρε %', path_y, res->'filePaths';
  end if;
  raise notice 'probe: η αναίρεση του χθες αγγίζει μόνο το χθες και επιστρέφει το αρχείο για σβήσιμο';

  -- ── 7. Χωρίς μέρα: το σήμερα της Αθήνας ────────────────────────────────
  res := public.owner_undo_firm_day(f, null);
  if not coalesce((res->>'ok')::boolean, false) or exists (select 1 from public.property_documents where id = doc_t) then
    raise exception 'ΩΡΑ UTC: η αναίρεση χωρίς μέρα δεν αναίρεσε το σήμερα της Αθήνας: %', res;
  end if;
  if exists (select 1 from public.bills where id = bill and paid) then
    raise exception 'Η αναίρεση του σήμερα δεν ξανάνοιξε την πληρωμή';
  end if;
  if not exists (select 1 from public.property_documents where id = doc_old) then
    raise exception 'ΠΑΡΑΘΥΡΟ: η αναίρεση του σήμερα έσβησε προχθεσινό';
  end if;
  raise notice 'probe: χωρίς μέρα, σύνοψη και αναίρεση είναι το σήμερα της Αθήνας';
end $probe$;
rollback;
