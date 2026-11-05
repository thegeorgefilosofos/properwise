-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΑ ΕΠΙΠΕΔΑ ΕΓΓΡΑΦΗΣ ΤΩΝ ΓΡΑΦΕΙΩΝ, ΣΕ ΚΑΘΕ ΣΥΝΔΥΑΣΜΟ
-- ─────────────────────────────────────────────────────────────────────────
--  Τρέχει μετά το firm-probe.sql, στην ίδια βάση.
--
--  Ο ΠΙΝΑΚΑΣ: επίπεδο (read/upload/keep) × πρόσωπο (υπεύθυνος, λογιστής με
--  ανάθεση, λογιστής χωρίς ανάθεση, συνεργάτης με ανάθεση) × είδος (παραστατικό,
--  μισθωτής, λογαριασμός, ενοίκιο, δαπάνη) × ενέργεια (νέα, αλλαγή, διαγραφή,
--  σημείωση πληρωμής) × προέλευση (ιδιοκτήτης, ίδιο γραφείο, άλλο γραφείο).
--  Η αναμενόμενη απάντηση υπολογίζεται από τους κανόνες, όχι από τη βάση. Και
--  κάθε απόπειρα τρέχει σε υπο-συναλλαγή που ΠΑΝΤΑ αναιρείται, ώστε η μία να
--  μην αλλάζει την αφετηρία της άλλης.
--
--  Και τα σενάρια: ανάκληση, αφαίρεση μέλους, μέλος σε δύο γραφεία, ιδιοκτήτης
--  που είναι και μέλος, ξένος πελάτης, πλαστή προέλευση, σύνδεσμος χωρίς
--  λογαριασμό, storage, σύνοψη ημέρας, «Αναίρεση όλων».
-- ═══════════════════════════════════════════════════════════════════════════

reset role;
set session "probe.uid" = '';
-- Τα μέλη γραφείου χρειάζονται δεύτερο βήμα (20261104150000): εδώ το έχουν.
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);

create schema if not exists probe_w;
grant usage on schema probe_w to authenticated, anon;

/* Τρέχει μία εντολή, γυρίζει «ok» ή το μήνυμα του σφάλματος. Πάντα ΑΝΑΙΡΕΙ. */
create or replace function probe_w.try(q text) returns text language plpgsql as $$
begin
  begin
    execute q;
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then return 'ok';
    when others then return sqlerrm;
  end;
end $$;
grant execute on function probe_w.try(text) to authenticated, anon;

/* Πόσες γραμμές θα άλλαζε μια εντολή, χωρίς να αλλάξει τίποτα. */
create or replace function probe_w.rows(q text) returns int language plpgsql as $$
declare n int;
begin
  begin
    execute q;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0099', message = n::text;
  exception
    when sqlstate 'P0099' then return sqlerrm::int;
    when others then return -1;
  end;
end $$;
grant execute on function probe_w.rows(text) to authenticated, anon;

-- ── Τα πρόσωπα ──────────────────────────────────────────────────────────────
-- O     ιδιοκτήτης με δύο ακίνητα: P (με δάνειο) και Q (χωρίς)
-- O2    άλλος ιδιοκτήτης, πελάτης μόνο του γραφείου Γ
-- M     υπεύθυνος του Φ          L  λογιστής του Φ, με ανάθεση του O
-- N     λογιστής του Φ, χωρίς ανάθεση
-- S     συνεργάτης του Φ, με ανάθεση του O
-- X     υπεύθυνος του Γ, που έχει ΚΑΙ αυτό τον O για πελάτη
create table probe_w.who(k text primary key, id uuid);
insert into probe_w.who values
  ('O',  'f2000000-0000-4000-8000-000000000001'), ('O2', 'f2000000-0000-4000-8000-000000000002'),
  ('M',  'f2000000-0000-4000-8000-0000000000a1'), ('L',  'f2000000-0000-4000-8000-0000000000a2'),
  ('N',  'f2000000-0000-4000-8000-0000000000a3'), ('S',  'f2000000-0000-4000-8000-0000000000a4'),
  ('X',  'f2000000-0000-4000-8000-0000000000b1');
grant select on probe_w.who to authenticated, anon;

create or replace function probe_w.u(p text) returns uuid language sql stable as $$ select id from probe_w.who where k = p $$;
grant execute on function probe_w.u(text) to authenticated, anon;
create or replace function probe_w.as_(p text) returns void language sql as $$ select set_config('probe.uid', probe_w.u(p)::text, false) $$;
grant execute on function probe_w.as_(text) to authenticated, anon;

do $probe$
begin
  insert into auth.users(id, email)
    select id, lower(k) || '@write.test' from probe_w.who;
  insert into public.user_properties(id, user_id, name) values
    ('f2000000-0000-4000-8000-00000000f001', probe_w.u('O'),  'P του O'),
    ('f2000000-0000-4000-8000-00000000f002', probe_w.u('O'),  'Q του O'),
    ('f2000000-0000-4000-8000-00000000f003', probe_w.u('O2'), 'Του O2');
  insert into public.loans(property_id, user_id, bank, loan_amount)
    values ('f2000000-0000-4000-8000-00000000f001', probe_w.u('O'), 'Τράπεζα', 100000);
  insert into public.accountant_links(user_id, token, active) values
    (probe_w.u('O'), 'write-probe-o', true), (probe_w.u('O2'), 'write-probe-o2', true);
end $probe$;
-- Οι ιδιοκτήτες του ελέγχου έχουν αποδεχτεί την τρέχουσα σύμβαση επεξεργασίας (20261105090000).
update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || jsonb_build_object('dpa_version', private.firm_dpa_version());

create table probe_w.ids(k text primary key, id uuid);
grant select, insert, update on probe_w.ids to authenticated;
grant select on probe_w.ids to anon;
create table probe_w.firm(k text primary key, id uuid);
grant select, insert on probe_w.firm to authenticated;

-- ── Τα δύο γραφεία ─────────────────────────────────────────────────────────
set role authenticated;
do $probe$
declare res json; who text;
begin
  perform probe_w.as_('M');
  if not (public.accountant_claim('write-probe-o')->>'ok')::boolean then raise exception 'M claim'; end if;
  perform public.firm_save('Γραφείο Φ', null, 'accounting', null, null);
  perform public.firm_invite('l@write.test', 'accountant');
  perform public.firm_invite('n@write.test', 'accountant');
  perform public.firm_invite('s@write.test', 'associate');
  insert into probe_w.firm values ('F', (public.my_firm()->>'id')::uuid);
  foreach who in array array['L', 'N', 'S'] loop
    perform probe_w.as_(who);
    res := public.firm_invite_answer((public.my_firm_invites()->0->>'id')::uuid, true);
    if not (res->>'ok')::boolean then raise exception 'accept %: %', who, res; end if;
  end loop;
  perform probe_w.as_('M');
  perform public.firm_assign(array[probe_w.u('O')], probe_w.u('L'), true);
  perform public.firm_assign(array[probe_w.u('O')], probe_w.u('S'), true);

  perform probe_w.as_('X');
  if not (public.accountant_claim('write-probe-o')->>'ok')::boolean then raise exception 'X claim O'; end if;
  if not (public.accountant_claim('write-probe-o2')->>'ok')::boolean then raise exception 'X claim O2'; end if;
  insert into probe_w.firm values ('G', (public.my_firm()->>'id')::uuid);

  -- Ο O δίνει «τήρηση» και στα δύο, για να στηθούν οι εγγραφές προέλευσης.
  perform probe_w.as_('O');
  perform public.owner_set_firm_level((select id from probe_w.firm where k = 'F'), 'keep');
  perform public.owner_set_firm_level((select id from probe_w.firm where k = 'G'), 'keep');
  if exists (select 1 from json_array_elements(public.my_accountants()) x where x->>'accessLevel' <> 'keep') then
    raise exception 'Το επίπεδο δεν φαίνεται στον ιδιοκτήτη';
  end if;
end $probe$;

-- ── Οι γραμμές προέλευσης: του ιδιοκτήτη, του Φ, του Γ ──────────────────────
reset role;
do $probe$
declare
  o uuid := probe_w.u('O'); p uuid := 'f2000000-0000-4000-8000-00000000f001';
  v uuid;
begin
  insert into public.property_documents(property_id, user_id, file_path, file_name, mime, size_bytes)
    values (p, o, o || '/' || p || '/document/own.pdf', 'own.pdf', 'application/pdf', 10) returning id into v;
  insert into probe_w.ids values ('owner:document', v);
  insert into public.tenants(property_id, user_id, full_name) values (p, o, 'Μισθωτής ιδιοκτήτη') returning id into v;
  insert into probe_w.ids values ('owner:tenant', v);
  insert into public.bills(property_id, user_id, type, amount, due_date, paid) values (p, o, 'ΔΕΗ', 50, '2026-10-01', true) returning id into v;
  insert into probe_w.ids values ('owner:bill', v);
  insert into public.rent_payments(property_id, user_id, payment_date, amount) values (p, o, '2026-10-01', 400) returning id into v;
  insert into probe_w.ids values ('owner:rent', v);
  insert into public.expenses(property_id, user_id, description, amount, category, date) values (p, o, 'Δική του', 10, 'Άλλο', '2026-10-01') returning id into v;
  insert into probe_w.ids values ('owner:expense', v);
  -- Εκκρεμότητες για σημείωση πληρωμής.
  insert into public.bills(property_id, user_id, type, name, amount, due_date, paid) values (p, o, 'tax', 'ΕΝΦΙΑ 3η δόση', 120, '2026-11-30', false) returning id into v;
  insert into probe_w.ids values ('due:bill', v);
  insert into public.rent_payments(property_id, user_id, payment_date, amount, status, paid) values (p, o, '2026-11-01', 400, 'pending', false) returning id into v;
  insert into probe_w.ids values ('due:rent', v);
  insert into public.calendar_events(property_id, user_id, title, event_date, amount, source) values (p, o, 'Δόση δανείου', '2026-11-15', 751.43, 'loan_schedule:probe') returning id into v;
  insert into probe_w.ids values ('due:event', v);
  insert into public.calendar_events(property_id, user_id, title, event_date, amount, recurring) values (p, o, 'Κοινόχρηστα', '2026-11-20', 60, true) returning id into v;
  insert into probe_w.ids values ('due:recurring', v);
end $probe$;

-- Ένα δείγμα για κάθε είδος.
create or replace function probe_w.sample(p_kind text, p_owner uuid, p_property uuid) returns jsonb language sql stable as $$
  select case p_kind
    when 'document' then jsonb_build_object('file_path', p_owner || '/' || p_property || '/document/' || gen_random_uuid() || '.pdf',
                                            'file_name', 'x.pdf', 'mime', 'application/pdf', 'size_bytes', 100, 'title', 'Απόδειξη')
    when 'tenant'   then jsonb_build_object('full_name', 'Μισθωτής γραφείου', 'monthly_rent', 400)
    when 'bill'     then jsonb_build_object('type', 'ΔΕΗ', 'name', 'ΔΕΗ', 'amount', 50, 'due_date', '2026-10-01', 'paid_at', '2026-10-02')
    when 'rent'     then jsonb_build_object('payment_date', '2026-10-01', 'amount', 400, 'period', '10/2026')
    when 'expense'  then jsonb_build_object('description', 'Υδραυλικός', 'amount', 80, 'category', 'Συντήρηση', 'date', '2026-10-03')
  end
$$;
grant execute on function probe_w.sample(text, uuid, uuid) to authenticated;

set role authenticated;
do $probe$
declare k text; res json; f text;
begin
  foreach f in array array['M', 'X'] loop
    perform probe_w.as_(f);
    foreach k in array array['document', 'tenant', 'bill', 'rent', 'expense'] loop
      res := public.firm_record(probe_w.u('O'), 'f2000000-0000-4000-8000-00000000f001', k,
                                probe_w.sample(k, probe_w.u('O'), 'f2000000-0000-4000-8000-00000000f001'));
      insert into probe_w.ids values (case f when 'M' then 'firm:' else 'other:' end || k, (res->>'id')::uuid);
    end loop;
  end loop;
  raise notice 'probe: υπεύθυνος με «τήρηση» καταχωρεί και τα πέντε είδη';
end $probe$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΠΙΝΑΚΑΣ
-- ═══════════════════════════════════════════════════════════════════════════
do $probe$
declare
  o uuid := probe_w.u('O');
  p uuid := 'f2000000-0000-4000-8000-00000000f001';
  lvl text; who text; kk text; org text; act text; tbl text;
  can_act boolean; want boolean; got text; n int := 0;
  rid uuid;
begin
  foreach lvl in array array['read', 'upload', 'keep'] loop
    perform probe_w.as_('O');
    perform public.owner_set_firm_level((select id from probe_w.firm f where f.k = 'F'), lvl);

    foreach who in array array['M', 'L', 'N', 'S'] loop
      perform probe_w.as_(who);
      can_act := who in ('M', 'L');

      foreach kk in array array['document', 'tenant', 'bill', 'rent', 'expense'] loop
        -- Νέα καταχώρηση.
        want := can_act and ((kk = 'document' and lvl in ('upload', 'keep')) or lvl = 'keep');
        got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, kk, probe_w.sample(kk, o, p)));
        if (got = 'ok') <> want then
          raise exception 'ΠΙΝΑΚΑΣ insert: επίπεδο % · % · % → «%», αναμενόταν %', lvl, who, kk, got, case when want then 'ok' else 'άρνηση' end;
        end if;
        n := n + 1;

        foreach org in array array['owner', 'firm', 'other'] loop
          select i.id into rid from probe_w.ids i where i.k = org || ':' || kk;
          foreach act in array array['update', 'delete'] loop
            want := org = 'firm' and can_act and (lvl = 'keep' or (act = 'delete' and kk = 'document' and lvl = 'upload'));
            if act = 'update' then
              got := probe_w.try(format('select public.firm_record_update(%L, %L, %L::jsonb)', kk, rid,
                       case kk when 'tenant' then '{"phone":"2100000000"}' when 'document' then '{"title":"Νέος τίτλος"}'
                               else '{"notes":"σημείωση"}' end));
            else
              got := probe_w.try(format('select public.firm_record_delete(%L, %L)', kk, rid));
            end if;
            if (got = 'ok') <> want then
              raise exception 'ΠΙΝΑΚΑΣ %: επίπεδο % · % · % του «%» → «%», αναμενόταν %', act, lvl, who, kk, org, got,
                case when want then 'ok' else 'άρνηση' end;
            end if;
            n := n + 1;
          end loop;
        end loop;

        -- Απευθείας στον πίνακα, χωρίς τη συνάρτηση: ΠΟΤΕ, σε κανένα επίπεδο.
        tbl := case kk when 'document' then 'property_documents' when 'tenant' then 'tenants' when 'bill' then 'bills'
                       when 'rent' then 'rent_payments' else 'expenses' end;
        if probe_w.try(format('insert into public.%I (user_id, property_id) values (%L, %L)', tbl, o, p)) = 'ok' then
          raise exception 'ΔΙΑΡΡΟΗ: % έγραψε απευθείας στο % (επίπεδο %)', who, tbl, lvl;
        end if;
        select i.id into rid from probe_w.ids i where i.k = 'owner:' || kk;
        if probe_w.rows(format('update public.%I set user_id = user_id where id = %L', tbl, rid)) > 0
           or probe_w.rows(format('delete from public.%I where id = %L', tbl, rid)) > 0 then
          raise exception 'ΔΙΑΡΡΟΗ: % άλλαξε απευθείας γραμμή του ιδιοκτήτη στο %', who, tbl;
        end if;
        n := n + 3;
      end loop;

      -- Σημείωση πληρωμής σε εκκρεμότητα του ιδιοκτήτη.
      foreach kk in array array['bill', 'rent', 'event'] loop
        want := can_act and lvl = 'keep';
        select i.id into rid from probe_w.ids i where i.k = 'due:' || kk;
        got := probe_w.try(format('select public.firm_mark_paid(%L, %L, current_date, null)', kk, rid));
        if (got = 'ok') <> want then
          raise exception 'ΠΙΝΑΚΑΣ πληρωμή: επίπεδο % · % · % → «%»', lvl, who, kk, got;
        end if;
        n := n + 1;
      end loop;
    end loop;
  end loop;
  raise notice 'probe: % συνδυασμοί επιπέδου, ρόλου, ανάθεσης, προέλευσης και ενέργειας απαντούν όπως ορίζουν οι κανόνες', n;
end $probe$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΣΕΝΑΡΙΑ («τήρηση» ενεργή για το Φ)
-- ═══════════════════════════════════════════════════════════════════════════
do $probe$
declare
  o uuid := probe_w.u('O'); p uuid := 'f2000000-0000-4000-8000-00000000f001';
  q uuid := 'f2000000-0000-4000-8000-00000000f002'; p2 uuid := 'f2000000-0000-4000-8000-00000000f003';
  got text;
begin
  perform probe_w.as_('O');
  perform public.owner_set_firm_level((select id from probe_w.firm f where f.k = 'F'), 'keep');
  perform probe_w.as_('L');

  -- Ακίνητο άλλου ιδιοκτήτη, με τον O ως «πελάτη» ή με τον O2.
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p2, 'tenant', probe_w.sample('tenant', o, p2)));
  if got not like '%firm_record:property%' then raise exception 'ΔΙΑΡΡΟΗ: καταχώρηση σε ακίνητο άλλου (%)', got; end if;
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', probe_w.u('O2'), p2, 'tenant', probe_w.sample('tenant', probe_w.u('O2'), p2)));
  if got not like '%not_allowed%' then raise exception 'ΔΙΑΡΡΟΗ: καταχώρηση σε πελάτη άλλου γραφείου (%)', got; end if;
  -- Ανύπαρκτο ακίνητο: το γραφείο δεν φτιάχνει ακίνητα.
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, gen_random_uuid(), 'expense', probe_w.sample('expense', o, p)));
  if got not like '%firm_record:property%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: καταχώρηση σε ανύπαρκτο ακίνητο (%)', got; end if;

  -- Καμία νέα υποχρέωση.
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, 'bill', '{"type":"ΔΕΗ","amount":50,"due_date":"2026-12-01"}'));
  if got not like '%paid_at%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: απλήρωτος λογαριασμός από το γραφείο (%)', got; end if;
  if probe_w.try(format($q$
       do $x$ declare r json := public.firm_record(%L, %L, 'bill', '{"type":"ΔΕΗ","amount":50,"due_date":"2026-12-01","paid_at":"2026-12-01","paid":false,"recurring":true}'::jsonb);
       begin
         if (select paid is not true or recurring is not false from public.bills where id = (r->>'id')::uuid) then raise exception 'ανοιχτό'; end if;
       end $x$ $q$, o, p)) <> 'ok' then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: ο λογαριασμός του γραφείου έμεινε απλήρωτος ή επαναλαμβανόμενος';
  end if;
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, q, 'expense',
                            '{"description":"Δόση","amount":500,"category":"Άλλο","date":"2026-10-01","expense_group":"loan"}'));
  if got not like '%no_loan%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: δόση δανείου σε ακίνητο χωρίς δάνειο (%)', got; end if;
  if probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, 'expense',
                        '{"description":"Δόση","amount":500,"category":"Άλλο","date":"2026-10-01","expense_group":"loan"}')) <> 'ok' then
    raise exception 'Η δόση δανείου στο υπάρχον δάνειο δεν γράφτηκε';
  end if;
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, 'event', '{"title":"Νέα δόση","amount":10}'));
  if got not like '%firm_record:kind%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: το γραφείο έγραψε γεγονός ημερολογίου (%)', got; end if;
  got := probe_w.try(format('select public.firm_mark_paid(%L, %L, current_date, null)', 'event', (select id from probe_w.ids i where i.k = 'due:recurring')));
  if got not like '%not_payable%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: έκλεισε επαναλαμβανόμενη σειρά (%)', got; end if;
  got := probe_w.try(format('select public.firm_mark_paid(%L, %L, current_date + 3, null)', 'bill', (select id from probe_w.ids i where i.k = 'due:bill')));
  if got not like '%future%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: πληρωμή με μελλοντική ημερομηνία (%)', got; end if;

  -- Η στήλη που δεν είναι στη λίστα δεν γράφεται: ούτε ιδιοκτήτης, ούτε ακίνητο, ούτε προέλευση.
  if probe_w.try(format($q$
       do $x$ declare r json := public.firm_record(%L, %L, 'tenant', '{"full_name":"Α","user_id":"%s","property_id":"%s","firm_id":null,"created_by_member":null}'::jsonb);
       begin
         if (select user_id <> %L or property_id <> %L or firm_id is null or created_by_member is null from public.tenants where id = (r->>'id')::uuid) then
           raise exception 'πέρασε';
         end if;
       end $x$ $q$, o, p, probe_w.u('O2'), p2, o, p)) <> 'ok' then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: στήλη εκτός λίστας γράφτηκε από το γραφείο';
  end if;
  if (select x->>'myLevel' from json_array_elements(public.firm_client_levels()) x where (x->>'ownerId')::uuid = o) <> 'keep' then
    raise exception 'Το firm_client_levels δεν δίνει το επίπεδο του πελάτη';
  end if;
  perform probe_w.as_('S');
  if (select x->>'myLevel' from json_array_elements(public.firm_client_levels()) x where (x->>'ownerId')::uuid = o) is not null then
    raise exception 'Ο συνεργάτης φαίνεται να έχει επίπεδο εγγραφής';
  end if;
  perform probe_w.as_('L');
  raise notice 'probe: ξένο ακίνητο, ξένος πελάτης, νέα υποχρέωση, γεγονός, σειρά και στήλη εκτός λίστας κόβονται';
end $probe$;

-- Η προέλευση δεν πλαστογραφείται, ούτε από τον ιδιοκτήτη.
do $probe$
declare got text; o uuid := probe_w.u('O'); p uuid := 'f2000000-0000-4000-8000-00000000f001';
begin
  perform probe_w.as_('O');
  got := probe_w.try(format('insert into public.tenants (user_id, property_id, full_name, firm_id) values (%L, %L, %L, %L)',
                            o, p, 'Πλαστός', (select id from probe_w.firm f where f.k = 'F')));
  if got not like '%firm_provenance%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο ιδιοκτήτης έγραψε πλαστή προέλευση (%)', got; end if;
  got := probe_w.try(format('update public.tenants set created_by_member = %L where id = %L', o, (select id from probe_w.ids i where i.k = 'firm:tenant')));
  if got not like '%firm_provenance%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο ιδιοκτήτης άλλαξε το μέλος της προέλευσης (%)', got; end if;
  got := probe_w.try(format('update public.tenants set firm_id = null where id = %L', (select id from probe_w.ids i where i.k = 'firm:tenant')));
  if got not like '%firm_provenance%' then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο ιδιοκτήτης έσβησε την προέλευση (%)', got; end if;
  -- Αλλά αλλάζει και σβήνει τις εγγραφές του γραφείου όπως τις δικές του.
  if probe_w.rows(format('update public.tenants set phone = %L where id = %L', '2101111111', (select id from probe_w.ids i where i.k = 'firm:tenant'))) <> 1 then
    raise exception 'Ο ιδιοκτήτης δεν αλλάζει εγγραφή του γραφείου';
  end if;
  if probe_w.rows(format('delete from public.expenses where id = %L', (select id from probe_w.ids i where i.k = 'firm:expense'))) <> 1 then
    raise exception 'Ο ιδιοκτήτης δεν σβήνει εγγραφή του γραφείου';
  end if;
  raise notice 'probe: την προέλευση δεν την αλλάζει κανείς· ο ιδιοκτήτης αλλάζει και σβήνει τις εγγραφές του γραφείου';
end $probe$;

-- Ο σύνδεσμος χωρίς λογαριασμό δεν γράφει ποτέ.
set role anon;
set session "probe.uid" = '';
do $probe$
declare got text;
begin
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', probe_w.u('O'),
                            'f2000000-0000-4000-8000-00000000f001', 'tenant', '{"full_name":"Α"}'));
  if got = 'ok' then raise exception 'ΔΙΑΡΡΟΗ: ανώνυμος καταχώρησε'; end if;
  got := probe_w.try(format('select public.firm_mark_paid(%L, %L, current_date, null)', 'bill', (select id from probe_w.ids i where i.k = 'due:bill')));
  if got = 'ok' then raise exception 'ΔΙΑΡΡΟΗ: ανώνυμος σημείωσε πληρωμή'; end if;
  if (public.get_accountant_data('write-probe-o', 2026)) is null then raise exception 'Ο σύνδεσμος ανάγνωσης έπαψε να διαβάζει'; end if;
  raise notice 'probe: ο σύνδεσμος ανάγνωσης διαβάζει και δεν γράφει';
end $probe$;
set role authenticated;

-- Μέλος σε δύο γραφεία: όχι.
do $probe$
declare res json;
begin
  perform probe_w.as_('X');
  perform public.firm_invite('l@write.test', 'accountant');
  perform probe_w.as_('L');
  res := public.firm_invite_answer((select (x->>'id')::uuid from json_array_elements(public.my_firm_invites()) x limit 1), true);
  if (res->>'reason') is distinct from 'in_other_firm' then raise exception 'ΠΑΡΑΒΙΑΣΗ: μέλος μπήκε σε δεύτερο γραφείο (%)', res; end if;
  if (select count(*) from public.firm_members where user_id = probe_w.u('L') and status = 'active') <> 1 then
    raise exception 'Ο L είναι ενεργός σε % γραφεία', (select count(*) from public.firm_members where user_id = probe_w.u('L') and status = 'active');
  end if;
  raise notice 'probe: ένα πρόσωπο, ένα ενεργό γραφείο';
end $probe$;

-- Ιδιοκτήτης που είναι και μέλος: δεν καταχωρεί για τον εαυτό του ως γραφείο.
do $probe$
declare got text;
begin
  perform probe_w.as_('O');
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', probe_w.u('O'),
                            'f2000000-0000-4000-8000-00000000f001', 'tenant', '{"full_name":"Α"}'));
  if got = 'ok' then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο ιδιοκτήτης έγραψε ως γραφείο στον εαυτό του'; end if;
  raise notice 'probe: κανείς δεν γράφει ως γραφείο στον δικό του λογαριασμό';
end $probe$;

-- ── Storage: μόνο στη διαδρομή του πελάτη, μόνο με επίπεδο ≥ ανέβασμα ──────
reset role;
set session "probe.uid" = '';
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;
insert into storage.objects(bucket_id, name, owner) values
  ('property-files', 'f2000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-00000000f001/document/dikou.pdf', 'f2000000-0000-4000-8000-000000000001');
set role authenticated;
do $probe$
declare
  lvl text; who text; want boolean; got text;
  okp text := 'f2000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-00000000f001/document/xarti.pdf';
begin
  foreach lvl in array array['read', 'upload', 'keep'] loop
    perform probe_w.as_('O');
    perform public.owner_set_firm_level((select id from probe_w.firm f where f.k = 'F'), lvl);
    foreach who in array array['M', 'L', 'N', 'S'] loop
      perform probe_w.as_(who);
      want := who in ('M', 'L') and lvl in ('upload', 'keep');
      got := probe_w.try(format('insert into storage.objects(bucket_id, name, owner) values (%L, %L, %L)', 'property-files', okp, auth.uid()));
      if (got = 'ok') <> want then raise exception 'STORAGE: επίπεδο % · % → «%»', lvl, who, got; end if;
      -- Ποτέ: άλλο ακίνητο, άλλος πελάτης, άλλος φάκελος, άλλο είδος αρχείου.
      if probe_w.try(format('insert into storage.objects(bucket_id, name, owner) values (%L, %L, %L)', 'property-files',
           'f2000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-00000000f003/document/x.pdf', auth.uid())) = 'ok'
         or probe_w.try(format('insert into storage.objects(bucket_id, name, owner) values (%L, %L, %L)', 'property-files',
           'f2000000-0000-4000-8000-000000000002/f2000000-0000-4000-8000-00000000f003/document/x.pdf', auth.uid())) = 'ok'
         or probe_w.try(format('insert into storage.objects(bucket_id, name, owner) values (%L, %L, %L)', 'property-files',
           'f2000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-00000000f001/contracts/x.pdf', auth.uid())) = 'ok'
         or probe_w.try(format('insert into storage.objects(bucket_id, name, owner) values (%L, %L, %L)', 'property-files',
           'f2000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-00000000f001/document/x.exe', auth.uid())) = 'ok' then
        raise exception 'ΔΙΑΡΡΟΗ STORAGE: % ανέβασε έξω από τη διαδρομή του πελάτη (επίπεδο %)', who, lvl;
      end if;
      if probe_w.rows($q$delete from storage.objects where name like '%/document/dikou.pdf'$q$) <> 0 then
        raise exception 'ΔΙΑΡΡΟΗ STORAGE: % έσβησε αρχείο του ιδιοκτήτη', who;
      end if;
    end loop;
  end loop;
  raise notice 'probe: storage δέχεται μόνο τη διαδρομή του πελάτη, μόνο από επίπεδο ανεβάσματος· δεν σβήνει αρχεία του ιδιοκτήτη';
end $probe$;
reset role;
delete from storage.objects where name like 'f2000000-%';
revoke select, insert, delete on storage.objects from authenticated;
alter table storage.objects disable row level security;
set role authenticated;

-- ── Η σύνοψη της ημέρας και η «Αναίρεση όλων» ───────────────────────────────
-- Χθεσινή καταχώρηση του Φ, σημερινές του Φ και του Γ, μία του ιδιοκτήτη.
do $probe$
declare o uuid := probe_w.u('O'); p uuid := 'f2000000-0000-4000-8000-00000000f001'; r json;
begin
  perform probe_w.as_('O');
  perform public.owner_set_firm_level((select id from probe_w.firm f where f.k = 'F'), 'keep');
  perform probe_w.as_('L');
  r := public.firm_record(o, p, 'tenant', '{"full_name":"Χθεσινός"}'::jsonb);
  insert into probe_w.ids values ('yesterday:tenant', (r->>'id')::uuid);
  perform public.firm_mark_paid('bill', (select id from probe_w.ids i where i.k = 'due:bill'), current_date, null);
  perform public.firm_mark_paid('event', (select id from probe_w.ids i where i.k = 'due:event'), current_date, null);
  r := public.firm_record(o, p, 'rent', probe_w.sample('rent', o, p));
  insert into probe_w.ids values ('today:rent', (r->>'id')::uuid);
  perform probe_w.as_('X');
  r := public.firm_record(o, p, 'expense', probe_w.sample('expense', o, p));
  insert into probe_w.ids values ('today:other', (r->>'id')::uuid);
end $probe$;
reset role;
update public.firm_record_log set at = at - interval '1 day' where row_id = (select id from probe_w.ids where k = 'yesterday:tenant');
set role authenticated;

do $probe$
declare
  f uuid := (select id from probe_w.firm x where x.k = 'F');
  day json; res json; fcount int;
begin
  perform probe_w.as_('O');
  day := public.owner_firm_day(current_date);
  select (x->>'total')::int into fcount from json_array_elements(day) x where (x->>'firmId')::uuid = f;
  if coalesce(fcount, 0) < 3 or json_array_length(day) <> 2 then raise exception 'Η σύνοψη της ημέρας λάθος: %', day; end if;

  res := public.owner_undo_firm_day(f, current_date);
  if not (res->>'ok')::boolean then raise exception 'Αναίρεση: %', res; end if;

  -- Του Φ, σήμερα: πίσω.
  if exists (select 1 from public.rent_payments where id = (select id from probe_w.ids i where i.k = 'today:rent')) then
    raise exception 'Η αναίρεση άφησε τη σημερινή είσπραξη του γραφείου';
  end if;
  if (select paid from public.bills where id = (select id from probe_w.ids i where i.k = 'due:bill')) then
    raise exception 'Η αναίρεση δεν ξανάνοιξε τη δόση ΕΝΦΙΑ';
  end if;
  if (select status from public.calendar_events where id = (select id from probe_w.ids i where i.k = 'due:event')) <> 'pending' then
    raise exception 'Η αναίρεση δεν ξανάνοιξε τη δόση δανείου';
  end if;
  -- Όχι του Γ, όχι χθεσινά, όχι του ιδιοκτήτη.
  if not exists (select 1 from public.expenses where id = (select id from probe_w.ids i where i.k = 'today:other')) then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: η αναίρεση του Φ έσβησε καταχώρηση του Γ';
  end if;
  if not exists (select 1 from public.tenants where id = (select id from probe_w.ids i where i.k = 'yesterday:tenant')) then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: η αναίρεση έσβησε χθεσινή καταχώρηση';
  end if;
  if not exists (select 1 from public.tenants where id = (select id from probe_w.ids i where i.k = 'owner:tenant')) then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: η αναίρεση έσβησε εγγραφή του ιδιοκτήτη';
  end if;
  -- Και ξένος δεν αναιρεί για λογαριασμό του ιδιοκτήτη.
  perform probe_w.as_('X');
  if (public.owner_undo_firm_day((select id from probe_w.firm x where x.k = 'G'), current_date)->>'undone')::int <> 0 then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: το γραφείο αναίρεσε σαν ιδιοκτήτης';
  end if;
  raise notice 'probe: η «Αναίρεση όλων» αγγίζει μόνο εκείνο το γραφείο, εκείνη τη μέρα';
end $probe$;

-- ── Ανάκληση και αφαίρεση μέλους κόβουν και την εγγραφή ─────────────────────
do $probe$
declare o uuid := probe_w.u('O'); p uuid := 'f2000000-0000-4000-8000-00000000f001'; mid uuid; got text;
begin
  perform probe_w.as_('M');
  select (x->>'id')::uuid into mid from json_array_elements(public.my_firm()->'members') x where x->>'email' = 'l@write.test';
  perform public.firm_member_update(mid, null, true);
  perform probe_w.as_('L');
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, 'tenant', '{"full_name":"Α"}'));
  if got = 'ok' then raise exception 'ΔΙΑΡΡΟΗ: αφαιρεμένο μέλος καταχωρεί'; end if;

  perform probe_w.as_('O');
  perform public.owner_revoke_firm((select id from probe_w.firm x where x.k = 'F'));
  perform probe_w.as_('M');
  got := probe_w.try(format('select public.firm_record(%L, %L, %L, %L::jsonb)', o, p, 'tenant', '{"full_name":"Α"}'));
  if got = 'ok' then raise exception 'ΔΙΑΡΡΟΗ: ανακλημένο γραφείο καταχωρεί'; end if;
  got := probe_w.try(format('select public.firm_record_update(%L, %L, %L::jsonb)', 'tenant', (select id from probe_w.ids i where i.k = 'yesterday:tenant'), '{"phone":"1"}'));
  if got = 'ok' then raise exception 'ΔΙΑΡΡΟΗ: ανακλημένο γραφείο αλλάζει δική του παλιά εγγραφή'; end if;
  -- Και δεν τις βλέπει πια: το γραφείο δεν διαβάζει ποτέ απευθείας τους πίνακες του ιδιοκτήτη.
  if exists (select 1 from public.tenants where id = (select id from probe_w.ids i where i.k = 'yesterday:tenant')) then
    raise exception 'ΔΙΑΡΡΟΗ: το γραφείο διαβάζει απευθείας πίνακα του ιδιοκτήτη';
  end if;
end $probe$;
-- Οι εγγραφές του μένουν στον ιδιοκτήτη, με την ένδειξη προέλευσης.
do $probe$
begin
  perform probe_w.as_('O');
  if (select firm_id from public.tenants where id = (select id from probe_w.ids i where i.k = 'yesterday:tenant')) is null then
    raise exception 'Μετά την ανάκληση χάθηκε η προέλευση';
  end if;
  raise notice 'probe: αφαίρεση μέλους και ανάκληση κόβουν αμέσως και την εγγραφή· οι εγγραφές μένουν στον ιδιοκτήτη';
end $probe$;

-- ── Καθαρισμός ─────────────────────────────────────────────────────────────
reset role;
set session "probe.uid" = '';
do $probe$
declare u uuid;
begin
  for u in select id from probe_w.who loop perform public.erase_account(u); end loop;
  if exists (select 1 from auth.users where id::text like 'f2000000-%') then raise exception 'Έμειναν χρήστες του probe'; end if;
end $probe$;
drop schema probe_w cascade;
