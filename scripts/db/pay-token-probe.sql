-- ═══════════════════════════════════════════════════════════════════════════
--  «ΠΛΗΡΩΣΑ»: ΤΑ ΔΙΑΚΡΙΤΙΚΑ ΔΕΝ ΦΤΑΝΟΥΝ ΣΕ ΚΑΝΕΝΑΝ ΑΠΟ ΤΟΝ ΠΕΡΙΗΓΗΤΗ
-- ─────────────────────────────────────────────────────────────────────────
--  Ο πίνακας `reminder_pay_tokens` (20261029120000) έχει RLS χωρίς καμία
--  πολιτική: μόνο ο service role τον αγγίζει. Εδώ ρωτιέται η ίδια η βάση, με
--  τα δικαιώματα που δίνει το Supabase σε κάθε πίνακα (`grant … to
--  authenticated`), ώστε να κρίνεται η RLS και όχι ένα `revoke`:
--
--    1. ο συνδεδεμένος χρήστης δεν βλέπει ούτε τα ΔΙΚΑ του διακριτικά·
--    2. δεν γράφει διακριτικό, ούτε για τον εαυτό του·
--    3. οι έλεγχοι του σχήματος κόβουν αποτύπωμα που δεν είναι SHA-256 και
--       «αναίρεση» χωρίς πληρωμή·
--    4. η διαγραφή του γεγονότος σβήνει και τα διακριτικά του·
--    5. η δαπάνη του «Πλήρωσα» γράφεται με το `ON CONFLICT (user_id,
--       dedup_hash)` που στέλνει το PostgREST· η δεύτερη δεν γράφεται·
--    6. ο χρήστης σβήνει τη ΔΙΚΗ του δαπάνη με το αποτύπωμα (αναίρεση από
--       το Ημερολόγιο) και κανενός άλλου.
--
--  Ολα μέσα σε συναλλαγή που ακυρώνεται: η βάση μένει όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on public.reminder_pay_tokens to authenticated, anon;
grant select, insert, update, delete on public.expenses to authenticated;

do $probe$
declare
  n int;
  u uuid := '9a9a9a9a-0000-4000-8000-00000000a001';
  p uuid := '9a9a9a9a-0000-4000-8000-00000000b001';
  e uuid := '9a9a9a9a-0000-4000-8000-00000000c001';
  h text := repeat('ab', 32);
begin
  insert into auth.users(id, email) values (u, 'pay@probe.test');
  insert into public.user_properties(id, user_id, name) values (p, u, 'Πληρωμή');
  insert into public.calendar_events(id, property_id, user_id, title, event_date)
    values (e, p, u, 'ΕΝΦΙΑ, 8η δόση', '2026-10-30');
  insert into public.reminder_pay_tokens(user_id, event_id, token_hash, channel, expires_at)
    values (u, e, h, 'email', now() + interval '45 days');

  begin
    insert into public.reminder_pay_tokens(user_id, event_id, token_hash, channel, expires_at)
      values (u, e, 'not-a-hash', 'email', now());
    raise exception 'ΣΧΗΜΑ: δέχτηκε αποτύπωμα που δεν είναι SHA-256';
  exception when check_violation then null;
  end;
  begin
    insert into public.reminder_pay_tokens(user_id, event_id, token_hash, channel, expires_at, undone_at)
      values (u, e, repeat('cd', 32), 'push', now(), now());
    raise exception 'ΣΧΗΜΑ: δέχτηκε αναίρεση χωρίς πληρωμή';
  exception when check_violation then null;
  end;
  begin
    insert into public.reminder_pay_tokens(user_id, event_id, token_hash, channel, expires_at)
      values (u, e, h, 'email', now());
    raise exception 'ΣΧΗΜΑ: δέχτηκε το ίδιο αποτύπωμα δύο φορές';
  exception when unique_violation then null;
  end;
  raise notice 'probe: τα διακριτικά «Πλήρωσα» κρατούν το σχήμα τους';

  -- 5. Η δαπάνη, όπως τη γράφει το expenses.insertDeduped (upsert με ignoreDuplicates).
  insert into public.expenses(property_id, user_id, description, amount, category, date, paid, dedup_hash)
    values (p, u, 'ΕΝΦΙΑ, 8η δόση', 26.33, 'enfia', '2026-10-29', true, 'reminder-pay:' || e)
    on conflict (user_id, dedup_hash) do nothing;
  insert into public.expenses(property_id, user_id, description, amount, category, date, paid, dedup_hash)
    values (p, u, 'ΕΝΦΙΑ, 8η δόση', 26.33, 'enfia', '2026-10-29', true, 'reminder-pay:' || e)
    on conflict (user_id, dedup_hash) do nothing;
  select count(*) into n from public.expenses where user_id = u and dedup_hash = 'reminder-pay:' || e;
  if n <> 1 then raise exception 'ΣΧΗΜΑ: το «Πλήρωσα» έγραψε % δαπάνες αντί για μία', n; end if;
  -- Η ίδια δαπάνη σε ΑΛΛΟΝ χρήστη (για τον έλεγχο του 6).
  insert into auth.users(id, email) values ('9a9a9a9a-0000-4000-8000-00000000a002', 'other@probe.test');
  insert into public.user_properties(id, user_id, name) values ('9a9a9a9a-0000-4000-8000-00000000b002', '9a9a9a9a-0000-4000-8000-00000000a002', 'Ξένο');
  insert into public.expenses(property_id, user_id, description, amount, category, date, paid, dedup_hash)
    values ('9a9a9a9a-0000-4000-8000-00000000b002', '9a9a9a9a-0000-4000-8000-00000000a002', 'Ξένη', 10, 'enfia', '2026-10-29', true, 'reminder-pay:' || e);
  raise notice 'probe: η δαπάνη του «Πλήρωσα» γράφεται μία φορά';
end $probe$;

set role authenticated;
set session "probe.uid" = '9a9a9a9a-0000-4000-8000-00000000a001';
do $probe$
declare n int;
begin
  select count(*) into n from public.reminder_pay_tokens;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο χρήστης βλέπει % διακριτικά «Πλήρωσα»', n; end if;
  begin
    insert into public.reminder_pay_tokens(user_id, event_id, token_hash, channel, expires_at)
      values ('9a9a9a9a-0000-4000-8000-00000000a001', '9a9a9a9a-0000-4000-8000-00000000c001', repeat('ef', 32), 'email', now() + interval '1 day');
    raise exception 'ΔΙΑΡΡΟΗ: ο χρήστης έγραψε διακριτικό «Πλήρωσα»';
  exception when insufficient_privilege then null;
  end;
  update public.reminder_pay_tokens set used_at = now();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο χρήστης εξαργύρωσε % διακριτικά χωρίς τον διακομιστή', n; end if;
  raise notice 'probe: ο συνδεδεμένος χρήστης δεν βλέπει ούτε γράφει διακριτικά «Πλήρωσα»';

  -- 6. Αναίρεση από την εφαρμογή: σβήνει τη δική του δαπάνη, όχι την ξένη.
  delete from public.expenses where dedup_hash = 'reminder-pay:9a9a9a9a-0000-4000-8000-00000000c001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ΔΙΑΡΡΟΗ: η αναίρεση έσβησε % δαπάνες αντί για τη μία δική του', n; end if;
  raise notice 'probe: η αναίρεση σβήνει μόνο τη δαπάνη του χρήστη';
end $probe$;

set role anon;
set session "probe.uid" = '';
do $probe$
declare n int;
begin
  select count(*) into n from public.reminder_pay_tokens;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο ανώνυμος βλέπει % διακριτικά «Πλήρωσα»', n; end if;
  raise notice 'probe: ο ανώνυμος δεν βλέπει διακριτικά «Πλήρωσα»';
end $probe$;

reset role;
do $probe$
declare n int;
begin
  delete from public.calendar_events where id = '9a9a9a9a-0000-4000-8000-00000000c001';
  select count(*) into n from public.reminder_pay_tokens where event_id = '9a9a9a9a-0000-4000-8000-00000000c001';
  if n <> 0 then raise exception 'ΣΧΗΜΑ: η διαγραφή του γεγονότος άφησε % διακριτικά', n; end if;
  raise notice 'probe: η διαγραφή του γεγονότος σβήνει τα διακριτικά του';
end $probe$;

rollback;
