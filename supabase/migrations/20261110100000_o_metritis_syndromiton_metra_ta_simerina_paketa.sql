-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΜΕΤΡΗΤΗΣ ΣΥΝΔΡΟΜΗΤΩΝ ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ ΣΥΝΕΡΓΑΤΩΝ ΜΕΤΡΑ ΤΑ ΣΗΜΕΡΙΝΑ ΠΑΚΕΤΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Η get_referral_overview (τελευταίος ορισμός: 20261003120000) μετρούσε ως
-- συνδρομητή όποιον είχε `plan in ('monthly','annual')`. Αυτά είναι τα παλιά
-- ονόματα· τα πακέτα που πληρώνονται είναι αυτά της is_paying_plan
-- (20260811090000:90): solo, owner, agency, office. Στην παραγωγή, στις
-- 10/11/2026, το billing_profiles.plan έχει μόνο 'free' και 'office'.
--
-- Συνέπεια: η μπάρα «X/5» έδειχνε πάντα 0, το σερί δεν μετρούσε ποτέ και
-- κανείς δεν μπορούσε να γίνει Συνεργάτης. Δεν φάνηκε επειδή η μπάρα κρύβεται
-- όσο η χρέωση είναι κλειστή (TabReferral.tsx, billingWords.partnerTarget).
-- Η claim_referral_bonus χρησιμοποιεί ήδη την is_paying_plan, οπότε ο μετρητής
-- και η διεκδίκηση θα διαφωνούσαν τη μέρα που ανοίγει η χρέωση.
--
-- Η αλλαγή: οι τέσσερις συνθήκες περνούν από την is_paying_plan, τη μία πηγή
-- για το «ποιος πληρώνει». Τίποτα άλλο δεν αλλάζει: ίδιος έλεγχος MFA, ίδια
-- όρια (5 τον μήνα, 3 συνεχόμενοι μήνες), ίδιο σχήμα απάντησης. Το
-- CREATE OR REPLACE κρατά τα υπάρχοντα δικαιώματα της συνάρτησης.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.get_referral_overview(p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_invites int; v_activated int;
  v_m_pro int; v_m_indiv int; v_m_paid int; v_m_free int;
  v_streak int := 0; v_partner boolean; v_monthly json;
  r record;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner <> auth.uid() then
    return json_build_object('invites',0,'activated',0,'m_pro',0,'m_indiv',0,
      'm_paid',0,'m_free',0,'streak',0,'partner',false,'paid_monthly_counts',json_build_array());
  end if;

  select count(*)::int into v_invites   from referrals where referrer_user_id = v_owner;
  select count(*)::int into v_activated from referrals where referrer_user_id = v_owner and activated_at is not null;

  select
    (count(*) filter (where coalesce(bp.profile_type,'individual') = 'professional'))::int,
    (count(*) filter (where coalesce(bp.profile_type,'individual') <> 'professional'))::int,
    (count(*) filter (where public.is_paying_plan(bp.plan)))::int,
    (count(*) filter (where not public.is_paying_plan(bp.plan)))::int
  into v_m_pro, v_m_indiv, v_m_paid, v_m_free
  from referrals r2
  left join billing_profiles bp on bp.user_id = r2.referred_user_id
  where r2.referrer_user_id = v_owner and r2.activated_at is not null
    and date_trunc('month', r2.activated_at) = date_trunc('month', now());

  for r in
    select (
      select (count(*) filter (where public.is_paying_plan(bp.plan)))::int
        from referrals rr
        left join billing_profiles bp on bp.user_id = rr.referred_user_id
       where rr.referrer_user_id = v_owner and rr.activated_at is not null
         and date_trunc('month', rr.activated_at) = gs.m) as paid
      from generate_series(
             date_trunc('month', now()) - interval '1 month',
             date_trunc('month', now()) - interval '12 months',
             interval '-1 month') as gs(m)
      order by gs.m desc
  loop
    if r.paid >= 5 then v_streak := v_streak + 1; else exit; end if;
  end loop;

  if v_streak >= 3 then
    insert into referral_partners (user_id) values (v_owner) on conflict (user_id) do nothing;
  end if;
  select exists(select 1 from referral_partners where user_id = v_owner) into v_partner;

  select json_agg(paid order by m) into v_monthly from (
      select gs.m as m, (
             select (count(*) filter (where public.is_paying_plan(bp.plan)))::int
               from referrals rr
               left join billing_profiles bp on bp.user_id = rr.referred_user_id
              where rr.referrer_user_id = v_owner and rr.activated_at is not null
                and date_trunc('month', rr.activated_at) = gs.m) as paid
        from generate_series(
               date_trunc('month', now()) - interval '6 months',
               date_trunc('month', now()) - interval '1 month',
               interval '1 month') as gs(m)
    ) months;

  return json_build_object(
    'invites', v_invites, 'activated', v_activated,
    'm_pro', v_m_pro, 'm_indiv', v_m_indiv, 'm_paid', v_m_paid, 'm_free', v_m_free,
    'streak', v_streak, 'partner', v_partner,
    'paid_monthly_counts', coalesce(v_monthly, json_build_array())
  );
end; $function$;
