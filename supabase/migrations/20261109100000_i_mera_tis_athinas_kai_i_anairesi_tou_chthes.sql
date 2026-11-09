-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΜΕΡΑ ΤΗΣ ΑΘΗΝΑΣ ΚΑΙ Η ΑΝΑΙΡΕΣΗ ΤΟΥ «ΧΘΕΣ»
-- ─────────────────────────────────────────────────────────────────────────
-- Τρία κενά στις συναρτήσεις του 20261104150000, που ξαναγράφονται εδώ ίδιες
-- εκτός από όσα λέει κάθε σημείο: ίδιες υπογραφές, ίδιο security definer, ίδιο
-- search_path, ίδια δικαιώματα. Ο τύπος επιστροφής μένει `json`, οπότε αρκεί
-- `create or replace` και τα δικαιώματα δεν πειράζονται.
--
-- 1. ΤΟ «ΣΗΜΕΡΑ» ΗΤΑΝ ΤΟΥ UTC. `current_date` είναι η μέρα του διακομιστή (UTC).
--    Από 00:00 ως 02:00 (03:00 το καλοκαίρι) ώρα Αθήνας είναι ακόμη χθες:
--      · `firm_mark_paid`: πληρωμή με σημερινή ημερομηνία κοβόταν ως
--        «μελλοντική» (`firm_record:future`)·
--      · `owner_firm_day` / `owner_undo_firm_day` χωρίς μέρα: έδειχναν και
--        αναιρούσαν το χθες.
--    Τώρα: `(now() at time zone 'Europe/Athens')::date`, όπως ήδη φιλτράρεται
--    το `at` του ημερολογίου.
--
-- 2. ΤΟ ΑΡΧΕΙΟ ΕΜΕΝΕ. Η «Αναίρεση όλων» του ιδιοκτήτη έσβηνε τη γραμμή του
--    παραστατικού που είχε ανεβάσει το γραφείο, όχι το αρχείο του: το PDF έμενε
--    στο `property-files`, αόρατο από την εφαρμογή. Η συνάρτηση δεν φτάνει στο
--    storage· επιστρέφει τις διαδρομές (`filePaths`) όπως το `firm_record_delete`
--    επιστρέφει το `filePath`. Τις σβήνει ο περιηγητής μετά την αναίρεση.
--
-- 3. ΤΟ ΠΑΡΑΘΥΡΟ ΤΗΣ ΑΝΑΙΡΕΣΗΣ. Η Πολιτική απορρήτου (#grafeia) λέει ότι ο
--    ιδιοκτήτης αναιρεί μέσα σε `FIRM_UNDO_DAYS` = 2 ημέρες (lib/legal/firms.ts):
--    σήμερα και χθες, ημερολογιακές μέρες Αθήνας. Η μέρα που ζητά η οθόνη
--    ελέγχεται εδώ: έξω από αυτές, η σύνοψη είναι κενή και η αναίρεση
--    απαντά `window` χωρίς να αγγίξει τίποτα.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.firm_mark_paid(p_kind text, p_id uuid, p_paid_on date, p_method text)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_table text;
  v_before jsonb;
  v_after jsonb;
  v_firm uuid;
  v_today date := (now() at time zone 'Europe/Athens')::date;  -- η μέρα της Αθήνας, όχι του UTC
  v_on date := coalesce(p_paid_on, v_today);
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_kind = 'bill' then v_table := 'bills';
  elsif p_kind = 'rent' then v_table := 'rent_payments';
  elsif p_kind = 'event' then v_table := 'calendar_events';
  else raise exception 'firm_record:kind' using errcode = '22023';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_before;
  if v_before is null then raise exception 'firm_record:not_found' using errcode = '42501'; end if;
  v_firm := private.firm_write_gate((v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind);
  if v_on > v_today then raise exception 'firm_record:future' using errcode = '22023'; end if;

  if p_kind = 'bill' then
    if coalesce((v_before->>'paid')::boolean, false) then raise exception 'firm_record:already_paid' using errcode = '22023'; end if;
    update bills set paid = true, paid_at = v_on::timestamptz where id = p_id;
  elsif p_kind = 'event' then
    -- Μία δόση, όχι σειρά: επαναλαμβανόμενο γεγονός δεν κλείνει ολόκληρο.
    if coalesce(v_before->>'status', 'pending') <> 'pending' or coalesce((v_before->>'recurring')::boolean, false)
       or v_before->>'amount' is null then
      raise exception 'firm_record:not_payable' using errcode = '22023';
    end if;
    update calendar_events set status = 'paid' where id = p_id;
  else
    if coalesce(v_before->>'status', '') = 'paid' and coalesce((v_before->>'paid')::boolean, true) then
      raise exception 'firm_record:already_paid' using errcode = '22023';
    end if;
    update rent_payments set status = 'paid', paid = true, paid_date = v_on, payment_date = v_on,
           method = coalesce(nullif(btrim(coalesce(p_method, '')), ''), method)
     where id = p_id;
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_after;
  perform private.firm_log(v_firm, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
                           'mark_paid', v_before, v_after);
  insert into firm_access_log (firm_id, member_id, owner_id, action)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, 'record');
  return json_build_object('ok', true);
end $$;

create or replace function public.owner_firm_day(p_day date)
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Athens')::date);
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  -- ΣΗΜΕΡΑ ΚΑΙ ΧΘΕΣ (FIRM_UNDO_DAYS = 2): πιο πίσω η αναίρεση δεν γίνεται πια.
  if v_day > v_today or v_day < v_today - 1 then return '[]'::json; end if;
  return coalesce((
    -- ΤΟ ΓΡΑΦΕΙΟ ΠΟΥ ΕΦΥΓΕ ΜΕΝΕΙ ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ (20261104150000).
    select json_agg(json_build_object('firmId', s.firm_id, 'firmName', coalesce(f.name, s.firm_name),
                                      'counts', s.counts, 'total', s.total)
           order by coalesce(f.name, s.firm_name))
      from (
        select l.firm_id, max(l.firm_name) as firm_name, sum(l.n)::int as total, json_object_agg(l.kind, l.n) as counts
          from (select firm_id, max(firm_name) as firm_name, kind, count(*)::int as n
                  from firm_record_log
                 where owner_id = v_me and undone_at is null and action in ('insert', 'mark_paid')
                   and (at at time zone 'Europe/Athens')::date = v_day
                 group by firm_id, kind) l
         group by l.firm_id
      ) s left join firms f on f.id = s.firm_id
  ), '[]'::json);
end $$;

create or replace function public.owner_undo_firm_day(p_firm uuid, p_day date)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Athens')::date);
  l record;
  v_now jsonb;
  v_n int := 0;
  v_skipped int := 0;
  v_cols text;
  v_files text[] := '{}';
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  -- ΣΗΜΕΡΑ ΚΑΙ ΧΘΕΣ (FIRM_UNDO_DAYS = 2), όπως υπόσχεται η Πολιτική απορρήτου.
  if v_day > v_today or v_day < v_today - 1 then
    return json_build_object('ok', false, 'reason', 'window');
  end if;

  -- ΤΑ «ΠΡΙΝ» ΚΑΙ «ΜΕΤΑ» ΖΟΥΝ ΣΤΟ public.firm_record_undo (20261104150000).
  -- Οπου λείπουν (σβήστηκε η γραμμή ή πέρασε η μέρα), η κίνηση δεν αναιρείται.
  for l in
    select fl.id, fl.table_name, fl.row_id, fl.action, u.before, u.after, (u.log_id is not null) as has_undo
      from firm_record_log fl
      left join public.firm_record_undo u on u.log_id = fl.id
     where fl.owner_id = v_me and fl.firm_id = p_firm and fl.undone_at is null
       and fl.action in ('insert', 'update', 'delete', 'mark_paid')
       and (fl.at at time zone 'Europe/Athens')::date = v_day
     order by fl.at desc, fl.id desc
     for update of fl
  loop
    if not l.has_undo then v_skipped := v_skipped + 1; continue; end if;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', l.table_name) using l.row_id into v_now;
    if l.action = 'delete' then
      if v_now is null then
        select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(l.before) k
         where exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = k);
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                       l.table_name, v_cols, v_cols, l.table_name) using l.before;
        v_n := v_n + 1;
      else v_skipped := v_skipped + 1;
      end if;
    elsif v_now is null then
      v_skipped := v_skipped + 1;                           -- ήδη σβησμένη
    elsif v_now is distinct from l.after then
      v_skipped := v_skipped + 1;                           -- ο ιδιοκτήτης την άλλαξε στο μεταξύ
    elsif l.action = 'insert' then
      execute format('delete from public.%I where id = $1', l.table_name) using l.row_id;
      -- Το αρχείο του παραστατικού: το σβήνει ο περιηγητής (`filePaths`).
      if l.table_name = 'property_documents' and coalesce(v_now->>'file_path', '') <> '' then
        v_files := v_files || (v_now->>'file_path');
      end if;
      v_n := v_n + 1;
    else
      select string_agg(format('%I = r.%I', k, k), ', ') into v_cols from jsonb_object_keys(l.before) k
       where k not in ('id', 'user_id', 'property_id', 'firm_id', 'created_by_member', 'created_at')
         and exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = k);
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2',
                     l.table_name, v_cols, l.table_name) using l.before, l.row_id;
      v_n := v_n + 1;
    end if;
    update firm_record_log set undone_at = now() where id = l.id;
    delete from public.firm_record_undo where log_id = l.id;
  end loop;
  return json_build_object('ok', true, 'undone', v_n, 'skipped', v_skipped, 'filePaths', to_json(v_files));
end $$;

-- ═══ ΔΙΚΑΙΩΜΑΤΑ ══════════════════════════════════════════════════════════
-- Όπως στο 20261104150000. Το `create or replace` τα κρατά· ξαναγράφονται ώστε
-- η μετανάστευση να στέκει μόνη της.
do $$
declare f text;
begin
  foreach f in array array[
    'public.firm_mark_paid(text, uuid, date, text)',
    'public.owner_firm_day(date)',
    'public.owner_undo_firm_day(uuid, date)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
