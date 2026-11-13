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
--    5. ο service_role (webhook) γράφει κανονικά·
--    6. η `revoke_mor_access` κόβει ΜΟΝΟ την τελευταία πληρωμένη συναλλαγή,
--       μία φορά· δεν την καλεί ο πελάτης· η σκανδάλη `keep_mor_revocation`
--       κρατά την ανάκληση απέναντι σε γεγονός συνδρομής χωρίς νέα συναλλαγή·
--       η ίδια αναφορά δίνει `already_same_ref`, άλλη αναφορά `already`· η
--       γραμμή δοκιμαστή δεν αγγίζεται από τη σκανδάλη·
--    7. η ανάκληση κρατά τη συναλλαγή στο `mor_revoked_tx` (20261113120000,
--       έλεγχος του PR 558, γύρος 3)· η στήλη μένει όταν η υποστήριξη σβήσει
--       την ανάκληση (Ζ4.4) ή περάσει νέα πληρωμή· ο πελάτης δεν τη γράφει.
--    8. η νόμιμη επαναφορά του οδηγού (Ζ7, έλεγχος των PR 560 και 563) με τα
--       τρία SQL του: ζωντανή συνδρομή, ακυρωμένη ως το τέλος της περιόδου,
--       νεότερη πληρωμή που δεν άνοιξε πρόσβαση· και ακυρωμένη στο τέλος
--       περιόδου (`scheduled_cancel`) στα Ζ7.1 και Ζ7.3.
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
     set mor_past_due_at = null, mor_revoked_at = now(), mor_revoked_reason = 'refund', full_name = 'Όνομα',
         mor_revoked_ref = 'ref_x', mor_last_transaction_id = 'tran_x', mor_revoked_tx = 'tran_x'
   where user_id = auth.uid();
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.mor_past_due_at is null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης μηδένισε την ώρα της πρώτης αποτυχημένης χρέωσης';
  end if;
  if r.mor_revoked_at is not null or r.mor_revoked_reason is not null or r.mor_revoked_ref is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης έγραψε μόνος του ανάκληση πρόσβασης';
  end if;
  if r.mor_last_transaction_id is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης έγραψε την τελευταία πληρωμένη συναλλαγή';
  end if;
  if r.mor_revoked_tx is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης έγραψε την επιστραμμένη συναλλαγή';
  end if;
  begin
    perform public.revoke_mor_access('sub_g', 'tran_g', 'ref_g', 'refund', now());
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης κάλεσε την revoke_mor_access';
  exception when insufficient_privilege then null;
  end;
  if r.full_name is distinct from 'Όνομα' then
    raise exception 'ΡΟΗ: το όνομα του προφίλ δεν γράφτηκε';
  end if;
end $probe$;

set session "probe.uid" = '6d6d6d6d-0000-4000-8000-0000000000b1';
do $probe$
declare r record;
begin
  insert into public.billing_profiles(user_id, full_name, mor_past_due_at, mor_revoked_at, mor_revoked_reason, mor_revoked_tx)
    values (auth.uid(), 'Νέος', now() + interval '50 years', now(), 'dispute', 'tran_n');
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.mor_past_due_at is not null or r.mor_revoked_at is not null or r.mor_revoked_reason is not null
     or r.mor_revoked_tx is not null then
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

-- ── 6. Η ΑΝΑΚΛΗΣΗ ΣΕ ΕΝΑ ΒΗΜΑ ΚΑΙ ΜΕΝΕΙ ───────────────────────────────────
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  o jsonb;
  r record;
begin
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'active', mor_subscription_id = 'sub_g',
         mor_last_transaction_id = 'tran_2', mor_revoked_at = null, mor_revoked_reason = null,
         mor_revoked_ref = null, mor_past_due_at = null, mor_ends_at = null
   where user_id = a;
  -- Ο ΠΡΩΤΟΣ ΜΗΝΑΣ ΑΦΟΥ ΠΛΗΡΩΘΗΚΕ Ο ΔΕΥΤΕΡΟΣ: τίποτα.
  o := public.revoke_mor_access('sub_g', 'tran_1', 'ref_1', 'refund', now());
  select * into r from public.billing_profiles where user_id = a;
  if o->>'outcome' <> 'not_latest' or r.plan <> 'agency' or r.mor_revoked_at is not null then
    raise exception 'ΑΝΑΚΛΗΣΗ: παλαιότερη συναλλαγή έκοψε πελάτη που πληρώνει (%)', o;
  end if;
  o := public.revoke_mor_access('sub_x', 'tran_2', 'ref_2', 'refund', now());
  if o->>'outcome' <> 'unmatched' then raise exception 'ΑΝΑΚΛΗΣΗ: άγνωστη συνδρομή βρήκε λογαριασμό (%)', o; end if;
  -- Η ΤΕΛΕΥΤΑΙΑ: κλείνει, μία φορά.
  o := public.revoke_mor_access('sub_g', 'tran_2', 'ref_2', 'refund', now());
  select * into r from public.billing_profiles where user_id = a;
  if o->>'outcome' <> 'revoked' or r.plan <> 'free' or r.subscription_status <> 'expired' or r.mor_revoked_ref <> 'ref_2' then
    raise exception 'ΑΝΑΚΛΗΣΗ: η τελευταία πληρωμένη συναλλαγή δεν έκλεισε την πρόσβαση (%)', o;
  end if;
  if r.mor_revoked_tx is distinct from 'tran_2' then
    raise exception 'ΑΝΑΚΛΗΣΗ: η επιστραμμένη συναλλαγή δεν γράφτηκε στο mor_revoked_tx (%)', r.mor_revoked_tx;
  end if;
  o := public.revoke_mor_access('sub_g', 'tran_2', 'ref_2', 'refund', now());
  if o->>'outcome' <> 'already_same_ref' then raise exception 'ΑΝΑΚΛΗΣΗ: δεύτερη παράδοση δεν αναγνωρίστηκε (%)', o; end if;
  -- ΑΛΛΗ ΑΝΑΦΟΡΑ ΣΕ ΗΔΗ ΚΛΕΙΣΤΗ (αμφισβήτηση μετά από επιστροφή, PR 558 εύρημα 2):
  -- δεν ξαναγράφει, αλλά δεν είναι ξαναπαράδοση. Ο webhook στέλνει email.
  o := public.revoke_mor_access('sub_g', 'tran_2', 'disp_2', 'dispute', now());
  select * into r from public.billing_profiles where user_id = a;
  if o->>'outcome' <> 'already' or r.mor_revoked_ref <> 'ref_2' or r.mor_revoked_reason <> 'refund' then
    raise exception 'ΑΝΑΚΛΗΣΗ: αμφισβήτηση μετά από επιστροφή μπερδεύτηκε με ξαναπαράδοση (%)', o;
  end if;
  begin
    perform public.revoke_mor_access('sub_g', 'tran_2', 'ref_3', 'κάτι', now());
    raise exception 'ΑΝΑΚΛΗΣΗ: δέχτηκε λόγο εκτός refund/dispute';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'probe: η ανάκληση κόβει μόνο την τελευταία πληρωμένη συναλλαγή, μία φορά';
end $probe$;

-- ΤΑΥΤΟΧΡΟΝΟ ΓΕΓΟΝΟΣ ΣΥΝΔΡΟΜΗΣ ΑΠΟ ΤΟΝ WEBHOOK: δεν αναιρεί την ανάκληση.
set role service_role;
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  r record;
begin
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'active', mor_revoked_at = null, mor_revoked_reason = null, mor_ends_at = null
   where user_id = a;
  select * into r from public.billing_profiles where user_id = a;
  if r.plan <> 'free' or r.mor_revoked_at is null or r.subscription_status <> 'expired' then
    raise exception 'ΑΝΑΚΛΗΣΗ: γεγονός συνδρομής χωρίς νέα συναλλαγή αναίρεσε την ανάκληση';
  end if;
  -- ΝΕΑ ΠΛΗΡΩΜΕΝΗ ΣΥΝΑΛΛΑΓΗ: η ανάκληση σηκώνεται, η αναφορά μένει.
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'active', mor_last_transaction_id = 'tran_3',
         mor_revoked_at = null, mor_revoked_reason = null, mor_ends_at = null
   where user_id = a;
  select * into r from public.billing_profiles where user_id = a;
  if r.plan <> 'agency' or r.mor_revoked_at is not null or r.mor_revoked_ref <> 'ref_2' then
    raise exception 'ΑΝΑΚΛΗΣΗ: νέα πληρωμένη συναλλαγή δεν ξανάνοιξε την πρόσβαση';
  end if;
  if r.mor_revoked_tx is distinct from 'tran_2' then
    raise exception 'ΑΝΑΚΛΗΣΗ: η νέα πληρωμή έσβησε την επιστραμμένη συναλλαγή';
  end if;
  raise notice 'probe: η ανάκληση μένει απέναντι σε ταυτόχρονο γεγονός, σηκώνεται μόνο με νέα πληρωμή';
end $probe$;

-- 7. Ζ4.4: Η ΥΠΟΣΤΗΡΙΞΗ ΣΒΗΝΕΙ ΤΗΝ ΑΝΑΚΛΗΣΗ. Το SQL του οδηγού, ως postgres,
-- αφήνει το `mor_revoked_tx`, ώστε ο webhook να αρνείται ακόμη την ίδια
-- συναλλαγή (lib/billing/morWebhook.ts).
reset role;
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  o jsonb;
  r record;
begin
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'active', mor_subscription_id = 'sub_z',
         mor_last_transaction_id = 'tran_z', mor_revoked_at = null, mor_revoked_reason = null,
         mor_revoked_ref = null, mor_revoked_tx = null, mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_z', 'tran_z', 'ref_z', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ4.4: η ανάκληση δεν έγινε (%)', o; end if;
  update public.billing_profiles set mor_revoked_at = null, mor_revoked_reason = null where user_id = a;
  select * into r from public.billing_profiles where user_id = a;
  if r.mor_revoked_at is not null or r.mor_revoked_tx is distinct from 'tran_z' then
    raise exception 'Ζ4.4: το SQL της υποστήριξης έσβησε την επιστραμμένη συναλλαγή (%)', r.mor_revoked_tx;
  end if;
  raise notice 'probe: η επιστραμμένη συναλλαγή μένει μετά από νέα πληρωμή και μετά το Ζ4.4';
end $probe$;

-- 8. Ζ7: Η ΝΟΜΙΜΗ ΕΠΑΝΑΦΟΡΑ (έλεγχος των PR 560 και 563). Τα SQL του οδηγού,
-- ως postgres, από γραμμή που η ανάκληση ισχύει ακόμη. Το καθένα ενημερώνει
-- ΜΙΑ γραμμή (καμία σε δεύτερη εκτέλεση, με λάθος συναλλαγή, με κατάσταση
-- που δεν επιτρέπεται ή αφού νεότερη πληρωμή σήκωσε ήδη την ανάκληση) και
-- αφήνει την αναφορά της επιστροφής. Ακυρωμένη συνδρομή (`scheduled_cancel`
-- στον Creem) παίρνει λήξη από το `current_period_end_date` και πέφτει μόνη
-- της σε `free` όταν περάσει (έλεγχος του PR 563, M1).
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  o jsonb;
  r record;
  n int;
  pe timestamptz := date_trunc('second', now()) + interval '20 days';
begin
  -- Ζ7.1 ΖΩΝΤΑΝΗ ΣΥΝΔΡΟΜΗ: η κατάσταση έρχεται από τον Creem (εδώ `on_trial`).
  update public.billing_profiles
     set plan = 'agency', subscription_status = 'active', mor_subscription_id = 'sub_w',
         mor_last_transaction_id = 'tran_w', mor_revoked_at = null, mor_revoked_reason = null,
         mor_revoked_ref = null, mor_revoked_tx = null, mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_w', 'tran_w', 'disp_w', 'dispute', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.1: η ανάκληση δεν έγινε (%)', o; end if;
  -- ΛΑΘΟΣ ΣΥΝΑΛΛΑΓΗ: καμία γραμμή.
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('on_trial', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_w' and b.mor_revoked_tx = 'tran_x'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Ζ7.1: το SQL άγγιξε γραμμή με άλλη επιστραμμένη συναλλαγή'; end if;
  -- ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ (`past_due`): καμία γραμμή.
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('past_due', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_w' and b.mor_revoked_tx = 'tran_w'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Ζ7.1: το SQL δέχτηκε κατάσταση past_due'; end if;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('on_trial', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_w' and b.mor_revoked_tx = 'tran_w'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 1 or r.mor_revoked_at is not null or r.mor_revoked_tx is not null
     or r.plan <> 'agency' or r.subscription_status <> 'on_trial' or r.mor_revoked_ref <> 'disp_w'
     or r.mor_ends_at is not null or r.mor_renews_at is distinct from pe then
    raise exception 'Ζ7.1: η επαναφορά δεν έγινε όπως λέει ο οδηγός (%, %)', n, r.mor_revoked_tx;
  end if;
  if public.user_plan_rank(a) <> public.plan_rank('agency') then
    raise exception 'Ζ7.1: μετά την επαναφορά το επίπεδο είναι %', public.user_plan_rank(a);
  end if;

  -- Ζ7.1 ΜΕ `scheduled_cancel` ΣΤΟΝ CREEM: λήξη στο τέλος της περιόδου, καμία ανανέωση.
  update public.billing_profiles
     set mor_subscription_id = 'sub_s', mor_last_transaction_id = 'tran_s', mor_revoked_ref = null,
         plan = 'agency', subscription_status = 'active', mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_s', 'tran_s', 'ref_s', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.1 cancelled: η ανάκληση δεν έγινε (%)', o; end if;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('cancelled', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_s' and b.mor_revoked_tx = 'tran_s'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 1 or r.subscription_status <> 'cancelled' or r.mor_ends_at is distinct from pe
     or r.mor_renews_at is not null then
    raise exception 'Ζ7.1 cancelled: λήξη % και ανανέωση % (%)', r.mor_ends_at, r.mor_renews_at, n;
  end if;
  if public.user_plan_rank(a) <> public.plan_rank('agency') then
    raise exception 'Ζ7.1 cancelled: πριν από το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;
  update public.billing_profiles set mor_ends_at = now() - interval '1 minute' where user_id = a;
  if public.user_plan_rank(a) <> 0 then
    raise exception 'Ζ7.1 cancelled: μετά το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;

  -- Ζ7.1 ΑΦΟΥ ΝΕΟΤΕΡΗ ΠΛΗΡΩΜΗ ΣΗΚΩΣΕ ΗΔΗ ΤΗΝ ΑΝΑΚΛΗΣΗ: καμία γραμμή.
  update public.billing_profiles
     set mor_subscription_id = 'sub_l', mor_last_transaction_id = 'tran_l1', mor_revoked_ref = null,
         plan = 'agency', subscription_status = 'active', mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_l', 'tran_l1', 'ref_l', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.1 lifted: η ανάκληση δεν έγινε (%)', o; end if;
  -- Ο webhook γράφει τη νέα χρέωση: νέα συναλλαγή, η ανάκληση σβήνει.
  update public.billing_profiles
     set mor_revoked_at = null, mor_revoked_reason = null, mor_last_transaction_id = 'tran_l2',
         plan = 'agency', subscription_status = 'active', mor_ends_at = null, mor_renews_at = pe
   where user_id = a;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('cancelled', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_l' and b.mor_revoked_tx = 'tran_l1'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 0 or r.subscription_status <> 'active' or r.mor_revoked_tx is distinct from 'tran_l1' then
    raise exception 'Ζ7.1 lifted: το SQL έγραψε πάνω από νεότερη πληρωμή (%)', n;
  end if;

  -- Ζ7.2 ΑΚΥΡΩΜΕΝΗ ΣΤΟΝ CREEM: πρόσβαση ως το `current_period_end_date`.
  update public.billing_profiles
     set mor_subscription_id = 'sub_c', mor_last_transaction_id = 'tran_c', mor_revoked_ref = null
   where user_id = a;
  o := public.revoke_mor_access('sub_c', 'tran_c', 'ref_c', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.2: η ανάκληση δεν έγινε (%)', o; end if;
  update public.billing_profiles
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = 'cancelled', mor_ends_at = pe,
         mor_renews_at = null
   where user_id = a and mor_subscription_id = 'sub_c' and mor_revoked_tx = 'tran_c';
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 1 or r.mor_revoked_at is not null or r.mor_revoked_tx is not null
     or r.subscription_status <> 'cancelled' or r.mor_revoked_ref <> 'ref_c' then
    raise exception 'Ζ7.2: η επαναφορά δεν έγινε όπως λέει ο οδηγός (%, %)', n, r.mor_revoked_tx;
  end if;
  if public.user_plan_rank(a) <> public.plan_rank('agency') then
    raise exception 'Ζ7.2: πριν από το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;
  update public.billing_profiles
     set mor_revoked_at = null, mor_revoked_reason = null, mor_revoked_tx = null,
         plan = 'agency', subscription_status = 'cancelled', mor_ends_at = pe,
         mor_renews_at = null
   where user_id = a and mor_subscription_id = 'sub_c' and mor_revoked_tx = 'tran_c';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Ζ7.2: δεύτερη εκτέλεση άγγιξε τη γραμμή'; end if;
  -- ΜΕΤΑ ΤΟ ΤΕΛΟΣ ΤΗΣ ΠΕΡΙΟΔΟΥ: πέφτει μόνη της, χωρίς γεγονός.
  update public.billing_profiles set mor_ends_at = now() - interval '1 minute' where user_id = a;
  if public.user_plan_rank(a) <> 0 then
    raise exception 'Ζ7.2: μετά το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;

  -- Ζ7.3 ΝΕΟΤΕΡΗ ΠΛΗΡΩΜΗ ΠΟΥ ΔΕΝ ΑΝΟΙΞΕ: η επιστραμμένη μένει.
  update public.billing_profiles
     set mor_subscription_id = 'sub_p', mor_last_transaction_id = 'tran_p1', mor_revoked_ref = null,
         plan = 'agency', subscription_status = 'active', mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_p', 'tran_p1', 'ref_p', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.3: η ανάκληση δεν έγινε (%)', o; end if;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_last_transaction_id = 'tran_p2',
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('active', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_p'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 1 or r.mor_revoked_at is not null or r.mor_revoked_tx is distinct from 'tran_p1'
     or r.mor_last_transaction_id <> 'tran_p2' or r.mor_revoked_ref <> 'ref_p'
     or r.mor_ends_at is not null or r.mor_renews_at is distinct from pe then
    raise exception 'Ζ7.3: η επαναφορά δεν έγινε όπως λέει ο οδηγός (%, %)', n, r.mor_revoked_tx;
  end if;
  if public.user_plan_rank(a) <> public.plan_rank('agency') then
    raise exception 'Ζ7.3: μετά την επαναφορά το επίπεδο είναι %', public.user_plan_rank(a);
  end if;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_last_transaction_id = 'tran_p2',
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('active', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_p'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Ζ7.3: δεύτερη εκτέλεση άγγιξε τη γραμμή'; end if;

  -- Ζ7.3 ΜΕ `scheduled_cancel` ΣΤΟΝ CREEM: λήξη στο τέλος της περιόδου, καμία ανανέωση.
  update public.billing_profiles
     set mor_subscription_id = 'sub_q', mor_last_transaction_id = 'tran_q1', mor_revoked_ref = null,
         plan = 'agency', subscription_status = 'active', mor_ends_at = null
   where user_id = a;
  o := public.revoke_mor_access('sub_q', 'tran_q1', 'ref_q', 'refund', now());
  if o->>'outcome' <> 'revoked' then raise exception 'Ζ7.3 cancelled: η ανάκληση δεν έγινε (%)', o; end if;
  update public.billing_profiles as b
     set mor_revoked_at = null, mor_revoked_reason = null, mor_last_transaction_id = 'tran_q2',
         plan = 'agency', subscription_status = v.status,
         mor_ends_at   = case when v.status = 'cancelled' then v.period_end end,
         mor_renews_at = case when v.status = 'cancelled' then null else v.period_end end
    from (values ('cancelled', pe)) as v(status, period_end)
   where b.user_id = a and b.mor_subscription_id = 'sub_q'
     and b.mor_last_transaction_id = b.mor_revoked_tx
     and v.status in ('active', 'on_trial', 'cancelled');
  get diagnostics n = row_count;
  select * into r from public.billing_profiles where user_id = a;
  if n <> 1 or r.subscription_status <> 'cancelled' or r.mor_ends_at is distinct from pe
     or r.mor_renews_at is not null or r.mor_revoked_tx is distinct from 'tran_q1' then
    raise exception 'Ζ7.3 cancelled: λήξη % και ανανέωση % (%)', r.mor_ends_at, r.mor_renews_at, n;
  end if;
  if public.user_plan_rank(a) <> public.plan_rank('agency') then
    raise exception 'Ζ7.3 cancelled: πριν από το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;
  update public.billing_profiles set mor_ends_at = now() - interval '1 minute' where user_id = a;
  if public.user_plan_rank(a) <> 0 then
    raise exception 'Ζ7.3 cancelled: μετά το τέλος της περιόδου το επίπεδο είναι %', public.user_plan_rank(a);
  end if;
  raise notice 'probe: η νόμιμη επαναφορά του Ζ7 (ζωντανή, ακυρωμένη στο τέλος περιόδου, ακυρωμένη, νεότερη πληρωμή) ενημερώνει μία γραμμή όπως λέει ο οδηγός';
end $probe$;

-- Ο ΔΟΚΙΜΑΣΤΗΣ ΜΕ ΠΑΛΙΑ ΑΝΑΚΛΗΣΗ (PR 558, εύρημα 4): η /api/billing/plan γράφει
-- το πακέτο του με τον ρόλο υπηρεσίας και απαντά «ok». Η σκανδάλη δεν το
-- γυρίζει σιωπηλά σε `free`.
update public.billing_profiles
   set tester_since = now() - interval '10 days', plan = 'free', subscription_status = 'expired',
       mor_revoked_at = now(), mor_revoked_reason = 'refund', mor_revoked_ref = 'ref_t'
 where user_id = '6d6d6d6d-0000-4000-8000-0000000000a1';
set role service_role;
do $probe$
declare
  a uuid := '6d6d6d6d-0000-4000-8000-0000000000a1';
  r record;
begin
  update public.billing_profiles set plan = 'office', hold_plan = null, hold_until = null where user_id = a;
  select * into r from public.billing_profiles where user_id = a;
  if r.plan <> 'office' then
    raise exception 'ΑΝΑΚΛΗΣΗ: η αλλαγή πακέτου δοκιμαστή γράφτηκε ως % αντί για office', r.plan;
  end if;
  raise notice 'probe: ο δοκιμαστής αλλάζει πακέτο και με παλιά ανάκληση';
end $probe$;
reset role;

rollback;
