-- ═══════════════════════════════════════════════════════════════════════════
-- ΔΩΡΟ ΠΟΥ ΕΡΧΕΤΑΙ ΜΕΤΑ ΤΗ ΛΗΞΗ ΠΑΛΙΩΝ ΜΗΝΩΝ ΜΕΤΡΑ ΑΠΟ ΣΗΜΕΡΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ (ανεξάρτητος έλεγχος του #514, 10/11/2026). Η
-- sync_comp_from_referrals (τελευταίος ορισμός 20261021120000, ίδιος με την
-- παραγωγή στις 10/11/2026) έγραφε
--     comp_until = coalesce(comp_started_at, now()) + granted μήνες.
-- Όποιος είχε παλιούς μήνες χωρίς χρέωση που έληξαν (π.χ. ένα
-- per_referral_pro πριν από έξι μήνες) και κέρδιζε μετά νέο δώρο (το δώρο
-- του Συνεργάτη, τον μήνα του στόχου), έπαιρνε comp_until ήδη στο παρελθόν:
-- ο μήνας που υπόσχονται οι Όροι (app/terms/page.tsx:191) χανόταν.
--
-- Η ΔΙΟΡΘΩΣΗ. Οι ΝΕΟΙ μήνες (όσοι λείπουν από το comp_months_granted)
-- προστίθενται στο greatest(comp_until, now()). Όταν το comp είναι ενεργό,
-- αυτό δίνει ακριβώς ό,τι πριν (comp_until = έναρξη + granted). Όταν έχει
-- λήξει, οι νέοι μήνες μετρούν από σήμερα και η έναρξη γράφεται ξανά.
--
-- ΤΟ ΟΡΙΟ ΜΕΝΕΙ ΟΠΩΣ ΕΙΝΑΙ: 12 μήνες εφ' όρου ζωής (REFERRAL_COMP_CAP_MONTHS,
-- η οθόνη γράφει «Έως 12 μήνες συνολικά», TabReferral.tsx). Οι Όροι δεν
-- ορίζουν όριο ανά παράθυρο, οπότε κρατιέται η σημερινή σημασία.
--
-- Αλλαγή μόνο βαθμίδας χωρίς νέους μήνες: όπως πριν, ανεβαίνει το comp_plan
-- και το comp_until δεν αλλάζει. Στην παραγωγή, στις 10/11/2026, οι
-- ανταμοιβές είναι 0, οπότε η αλλαγή δεν επηρεάζει κανέναν λογαριασμό σήμερα.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.sync_comp_from_referrals()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_months int;
  v_slots  int;
  v_target text;
  v_cap    int := 12;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return; end if;

  select coalesce(sum(months) filter (where kind = 'months'), 0),
         coalesce(sum(months) filter (where kind = 'slot'), 0)
    into v_months, v_slots
    from referral_rewards
   where user_id = v_uid;

  select t.tier into v_target
    from (select coalesce(nullif(btrim(rr.tier), ''), 'owner') as tier
            from referral_rewards rr
           where rr.user_id = v_uid and rr.kind = 'months') t
   order by public.plan_rank(t.tier) desc
   limit 1;
  v_target := coalesce(v_target, 'owner');

  v_months := least(v_months, v_cap);
  if v_months > 0 then
    update billing_profiles
       set comp_started_at     = case
                                   when v_months > coalesce(comp_months_granted, 0)
                                    and (comp_until is null or comp_until < now())
                                   then now()
                                   else coalesce(comp_started_at, now())
                                 end,
           comp_until          = case
                                   when v_months > coalesce(comp_months_granted, 0)
                                   then greatest(coalesce(comp_until, now()), now())
                                        + ((v_months - coalesce(comp_months_granted, 0)) || ' months')::interval
                                   else comp_until
                                 end,
           comp_months_granted = greatest(coalesce(comp_months_granted, 0), v_months),
           comp_plan           = v_target
     where user_id = v_uid
       and (v_months > coalesce(comp_months_granted, 0)
            or public.plan_rank(v_target) > public.plan_rank(coalesce(comp_plan, 'owner')));
  end if;

  v_slots := least(v_slots, 500);
  if v_slots > 0 then
    update billing_profiles
       set bonus_properties       = greatest(coalesce(bonus_properties, 0), v_slots),
           bonus_properties_until = greatest(coalesce(bonus_properties_until, now()), now() + interval '1 month')
     where user_id = v_uid
       and v_slots > coalesce(bonus_properties, 0);
  end if;
end;
$function$;
