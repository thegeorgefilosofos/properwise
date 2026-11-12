-- ═══════════════════════════════════════════════════════════════════════════
--  Η ΑΠΟΤΥΧΗΜΕΝΗ ΠΛΗΡΩΜΗ ΕΧΕΙ ΟΡΙΟ ΚΑΙ ΟΙ ΣΤΗΛΕΣ ΤΗΣ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
-- ─────────────────────────────────────────────────────────────────────────
--  Η μετανάστευση 20261112190000 (έλεγχος ετοιμότητας πληρωμών 12/11/2026)
--  προσθέτει τρεις στήλες του webhook και κρίνει τη χάρη μέσα στην
--  `user_plan_rank`. Εδώ ρωτιέται η ίδια η βάση:
--
--    1. ο `authenticated` στέλνει `mor_past_due_at`, `mor_revoked_at`,
--       `mor_revoked_reason` σε INSERT και UPDATE και η βάση τα αγνοεί·
--    2. `past_due` μέσα στη χάρη κρατά το πακέτο, πέρα από τη χάρη πέφτει στο
--       `free`, χωρίς ώρα πρώτης αποτυχίας κρατά (δεν εφευρίσκεται λήξη)·
--    3. η ακυρωμένη που έληξε κόβεται ακόμη (ο κανόνας της 20260927200000)·
--    4. ο λόγος ανάκλησης δέχεται μόνο refund ή dispute·
--    5. ο service_role (webhook) γράφει κανονικά.
--
--  Ολα μέσα σε συναλλαγή που ακυρώνεται: η βάση μένει όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
begin;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('probe.uid', true), '')::uuid $$;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';  -- πληρώνει
  n uuid := '6d6d6d6d-0000-4000-8000-0000000000b1';  -- νέος χωρίς προφίλ
begin
  -- ΧΩΡΙΣ ΤΟΠΙΚΗ ΔΟΚΙΜΗ: λογαριασμοί παλαιότεροι από τη δοκιμή, ώστε το
  -- επίπεδο να το κρίνει μόνο η συνδρομή.
  insert into auth.users(id, email, created_at) values
    (a, 'pliromi@grace.test', now() - interval '400 days'),
    (n, 'neos@grace.test', now() - interval '400 days')
    on conflict (id) do nothing;
  insert into public.billing_profiles(user_id) values (a) on conflict (user_id) do nothing;
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'past_due', trial_used_at = now() - interval '300 days',
         mor_past_due_at = now() - interval '1 day', mor_revoked_at = null, mor_revoked_reason = null
   where user_id = a;
  delete from public.billing_profiles where user_id = n;
  if public.past_due_grace_days() < 1 then
    raise exception 'ΣΧΗΜΑ: past_due_grace_days() = %', public.past_due_grace_days();
  end if;
end $probe$;

-- ── 1. Ο ΠΕΛΑΤΗΣ ΔΕΝ ΜΗΔΕΝΙΖΕΙ ΤΟ ΡΟΛΟΪ ──────────────────────────────────
set role authenticated;
set session "probe.uid" = '6d6d6d6d-0000-4000-8000-0000000000a1';
do $probe$
declare r record;
begin
  update public.billing_profiles
     set mor_past_due_at = null, mor_revoked_at = now(), mor_revoked_reason = 'refund', full_name = 'Όνομα'
   where user_id = auth.uid();
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.mor_past_due_at is null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης μηδένισε την ώρα της πρώτης αποτυχημένης χρέωσης';
  end if;
  if r.mor_revoked_at is not null or r.mor_revoked_reason is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης έγραψε μόνος του ανάκληση πρόσβασης';
  end if;
  if r.full_name is distinct from 'Όνομα' then
    raise exception 'ΡΟΗ: το όνομα του προφίλ δεν γράφτηκε';
  end if;
end $probe$;

set session "probe.uid" = '6d6d6d6d-0000-4000-8000-0000000000b1';
do $probe$
declare r record;
begin
  insert into public.billing_profiles(user_id, full_name, mor_past_due_at, mor_revoked_at, mor_revoked_reason)
    values (auth.uid(), 'Νέος', now() + interval '50 years', now(), 'dispute');
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.mor_past_due_at is not null or r.mor_revoked_at is not null or r.mor_revoked_reason is not null then
    raise exception 'ΔΙΑΡΡΟΗ: το INSERT πέρασε στήλες χάρης ή ανάκλησης';
  end if;
  raise notice 'probe: οι στήλες χάρης και ανάκλησης μένουν στον διακομιστή';
end $probe$;
reset role;
set session "probe.uid" = '';

-- ── 2-4. Η ΧΑΡΗ ΣΤΗΝ user_plan_rank ────────────────────────────────────────
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  g int := public.past_due_grace_days();
  v int;
begin
  update public.billing_profiles set mor_past_due_at = now() - make_interval(days => g - 1) where user_id = a;
  v := public.user_plan_rank(a);
  if v <> public.plan_rank('agency') then
    raise exception 'ΧΑΡΗ: past_due μέσα στη χάρη έδωσε επίπεδο % αντί για %', v, public.plan_rank('agency');
  end if;

  update public.billing_profiles set mor_past_due_at = now() - make_interval(days => g + 1) where user_id = a;
  v := public.user_plan_rank(a);
  if v <> public.plan_rank('free') then
    raise exception 'ΧΑΡΗ: past_due πέρα από τη χάρη έδωσε επίπεδο % αντί για free', v;
  end if;

  update public.billing_profiles set mor_past_due_at = null where user_id = a;
  v := public.user_plan_rank(a);
  if v <> public.plan_rank('agency') then
    raise exception 'ΧΑΡΗ: past_due χωρίς ώρα έκοψε πρόσβαση (επίπεδο %)', v;
  end if;

  update public.billing_profiles
     set subscription_status = 'cancelled', mor_ends_at = now() - interval '1 day' where user_id = a;
  v := public.user_plan_rank(a);
  if v <> public.plan_rank('free') then
    raise exception 'ΧΑΡΗ: η ακυρωμένη που έληξε δεν κόβεται πια (επίπεδο %)', v;
  end if;

  begin
    update public.billing_profiles set mor_revoked_reason = 'κάτι άλλο' where user_id = a;
    raise exception 'ΣΧΗΜΑ: ο λόγος ανάκλησης δέχτηκε τιμή εκτός refund/dispute';
  exception when check_violation then null;
  end;
  raise notice 'probe: η χάρη της αποτυχημένης πληρωμής κρίνεται στη βάση';
end $probe$;

-- ── 5. Ο ΔΙΑΚΟΜΙΣΤΗΣ ΓΡΑΦΕΙ ────────────────────────────────────────────────
set role service_role;
do $probe$
declare r record;
begin
  update public.billing_profiles
     set mor_past_due_at = now(), mor_revoked_at = now(), mor_revoked_reason = 'refund'
   where user_id = '6d6d6d6d-0000-4000-8000-0000000000a1';
  select * into r from public.billing_profiles where user_id = '6d6d6d6d-0000-4000-8000-0000000000a1';
  if r.mor_past_due_at is null or r.mor_revoked_at is null or r.mor_revoked_reason <> 'refund' then
    raise exception 'ΡΟΗ: ο service_role (webhook) δεν γράφει τις στήλες χάρης και ανάκλησης';
  end if;
  raise notice 'probe: ο service_role γράφει χάρη και ανάκληση';
end $probe$;
reset role;

rollback;
