-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΟ DEMO ΓΡΑΦΕΙΟ ΤΡΕΧΕΙ ΔΥΟ ΦΟΡΕΣ ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ ΚΑΙ ΦΕΥΓΕΙ ΚΑΘΑΡΑ
-- ─────────────────────────────────────────────────────────────────────────
--  Ελέγχει το scripts/db/demo-logistis.sql πάνω στο σχήμα που φτιάχνει το
--  db-replay: οι τρεις χρήστες, δύο εκτελέσεις με το ίδιο αποτέλεσμα. Μετά το UNDO.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
set session "probe.uid" = '';
insert into auth.users(id, email) values
  ('f3000000-0000-4000-8000-000000000001', 'demo@properwise.gr'),
  ('f3000000-0000-4000-8000-000000000002', 'demo-logistis@properwise.gr'),
  ('f3000000-0000-4000-8000-000000000003', 'demo-synergatis@properwise.gr');
insert into public.user_properties(user_id, name) values ('f3000000-0000-4000-8000-000000000001', 'Demo ακίνητο');

\ir demo-logistis.sql
\ir demo-logistis.sql

do $probe$
declare n int;
begin
  select count(*) into n from public.firms where name = 'Demo Λογιστικό Γραφείο';
  if n <> 1 then raise exception 'DEMO: % γραφεία αντί για 1', n; end if;
  select count(*) into n from public.firm_members m join public.firms f on f.id = m.firm_id where f.name = 'Demo Λογιστικό Γραφείο' and m.status = 'active';
  if n <> 2 then raise exception 'DEMO: % μέλη αντί για 2', n; end if;
  if (select access_level from public.accountant_clients where owner_id = 'f3000000-0000-4000-8000-000000000001') <> 'keep' then
    raise exception 'DEMO: ο demo@ δεν έχει «Τήρηση»';
  end if;
  if not public.accountant_link_live('f3000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000001') then
    raise exception 'DEMO: ο Υπεύθυνος δεν βλέπει τον demo@';
  end if;
  if not private.firm_reads_owner('f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000001')
     or public.accountant_link_live('f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000001') then
    raise exception 'DEMO: ο Συνεργάτης δεν είναι μόνο ανάγνωση';
  end if;
  if private.firm_level('f3000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000001') <> 'keep' then
    raise exception 'DEMO: το επίπεδο του Υπευθύνου δεν είναι «Τήρηση»';
  end if;
  if (select raw_user_meta_data->>'account_kind' from auth.users where id = 'f3000000-0000-4000-8000-000000000002') <> 'firm' then
    raise exception 'DEMO: ο demo-logistis@ δεν ανοίγει στον χώρο του γραφείου';
  end if;
  raise notice 'probe: το demo γραφείο στήνεται δύο φορές με το ίδιο αποτέλεσμα';
end $probe$;

-- Το UNDO του αρχείου, όπως είναι γραμμένο στο σχόλιο.
do $undo$
declare v_firm uuid := (select id from public.firms where name = 'Demo Λογιστικό Γραφείο');
begin
  delete from public.accountant_clients where firm_id = v_firm;
  delete from public.firm_client_assignees where firm_id = v_firm;
  delete from public.firm_members where firm_id = v_firm;
  delete from public.firms where id = v_firm;
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'account_kind'
   where lower(email) in ('demo-logistis@properwise.gr', 'demo-synergatis@properwise.gr');
end $undo$;

do $probe$
declare u uuid;
begin
  if exists (select 1 from public.firms where name = 'Demo Λογιστικό Γραφείο') then raise exception 'DEMO: το UNDO άφησε το γραφείο'; end if;
  for u in select id from auth.users where id::text like 'f3000000-%' loop perform public.erase_account(u); end loop;
  raise notice 'probe: το UNDO του demo γραφείου καθαρίζει';
end $probe$;
