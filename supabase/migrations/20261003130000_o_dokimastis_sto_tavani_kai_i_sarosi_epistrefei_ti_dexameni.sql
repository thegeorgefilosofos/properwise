-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΔΟΚΙΜΑΣΤΗΣ ΣΤΟ ΤΑΒΑΝΙ ΚΑΙ Η ΑΠΟΤΥΧΗΜΕΝΗ ΣΑΡΩΣΗ ΓΥΡΙΖΕΙ ΚΑΙ ΤΗ ΔΕΞΑΜΕΝΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ, ΠΡΩΤΟ. Η 20261003100000 έβαλε ταβάνι `trial_scan` σε όποιον
-- ανεβαίνει χωρίς πληρωμή. Το «πληρώνει» όμως κρίνεται από τη στήλη `plan`:
-- ο δοκιμαστής (`tester_since`) που διαλέγει πληρωμένο πακέτο σάρωνε χωρίς
-- μηνιαίο όριο. Στις ερωτήσεις η `bump_ai_usage` κόβει τον δοκιμαστή
-- ΤΕΛΕΥΤΑΙΟ, ακριβώς για να κόβει και τον «πληρωμένο»· η σάρωση όχι.
--
-- ΤΟ ΣΦΑΛΜΑ, ΔΕΥΤΕΡΟ. Η σάρωση που χρέωσε μονάδα της κοινής δεξαμενής και
-- απέτυχε στον πάροχο γύριζε πίσω μόνο τον μήνα του χρήστη: η
-- `refund_scan_usage` δεν ήξερε τη δεξαμενή. Κάθε αποτυχία στη δοκιμή
-- έτρωγε για πάντα μία μονάδα από όλους τους μη πληρώνοντες.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Απόφαση ιδιοκτήτη (03.10.2026):
--   · `bump_scan_usage`: ο δοκιμαστής παίρνει ταβάνι `trial_scan` σε κάθε
--     πακέτο. Χρεώνει τη δεξαμενή μόνο αν δεν πληρώνει, όπως πριν.
--   · `refund_scan_usage(p_uid, p_pool)`: με `p_pool = true` γυρίζει και τη
--     μονάδα της δεξαμενής, ΜΟΝΟ όταν η σάρωση είχε χρεωθεί εκεί (βαθμός
--     από 1 και πάνω χωρίς πληρωμή, ο ίδιος όρος με τη `bump_scan_usage`). Η
--     προεπιλογή `false` κρατά την παλιά κλήση `{ p_uid }` σε λειτουργία όσο
--     ανεβαίνει η νέα έκδοση της εφαρμογής.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bump_scan_usage(p_max_min integer, p_month integer[])
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid    uuid        := auth.uid();
  v_now    timestamptz := now();
  v_min    timestamptz := date_trunc('minute', v_now);
  v_mon    date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_cap    jsonb       := public.ai_plan_limits();
  v_plan   text;
  v_pay    boolean;
  v_charge boolean;
  v_tester timestamptz;
  v_capped boolean;
  v_rank   integer;
  v_r      integer;
  v_lim    integer;
  v_srv    integer;
  v_cli    integer;
  v_lminute integer;
  v_lpool  integer;
  v_minc   integer;
  v_monc   integer;
  v_pool   integer;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;
  v_rank := coalesce(public.user_plan_rank(v_uid), 0);
  v_r := case when v_rank between 0 and jsonb_array_length(v_cap->'scan') - 1 then v_rank else 0 end;

  -- Ο ΙΔΙΟΣ ΟΡΙΣΜΟΣ ΤΟΥ «ΠΛΗΡΩΝΕΙ» ΜΕ ΤΗ bump_ai_usage. Ανυψωμένος βαθμός χωρίς
  -- πληρωμή είναι δοκιμή, δωρεάν μήνες ή Συνεργάτης: κοστίζει από την ίδια τσέπη.
  select plan, tester_since into v_plan, v_tester from public.billing_profiles where user_id = v_uid;
  v_pay    := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  v_charge := not v_pay and v_r >= 1;
  -- Ο ΔΟΚΙΜΑΣΤΗΣ ΠΑΙΡΝΕΙ ΤΟ ΙΔΙΟ ΤΑΒΑΝΙ ΑΚΟΜΗ ΚΙ ΣΕ ΠΛΗΡΩΜΕΝΟ ΠΑΚΕΤΟ, όπως
  -- στις ερωτήσεις (`tester_day`/`tester_month` της bump_ai_usage). Δεν
  -- χρεώνει όμως τη δεξαμενή όταν το πακέτο του είναι πληρωμένο.
  v_capped := v_charge or v_tester is not null;

  -- `null` = χωρίς μηνιαίο όριο. Του διακομιστή κρίνει· ο καλών μόνο χαμηλώνει.
  v_srv := (v_cap->'scan'->>v_r)::integer;
  if v_capped then
    v_srv := least(coalesce(v_srv, (v_cap->>'trial_scan')::integer), (v_cap->>'trial_scan')::integer);
  end if;
  v_cli := case when array_length(p_month, 1) >= v_rank + 1 then p_month[v_rank + 1] else p_month[1] end;
  v_lim := case
    when v_srv is null then v_cli
    when v_cli is null then v_srv
    else least(v_srv, v_cli)
  end;
  v_lminute := least((v_cap->>'per_minute')::integer, coalesce(p_max_min, (v_cap->>'per_minute')::integer));
  v_lpool   := (v_cap->>'pool')::integer;

  insert into public.scan_usage (user_id, minute_bucket, minute_count, month, month_count, updated_at)
    values (v_uid, v_min, 1, v_mon, 1, v_now)
  on conflict (user_id) do update set
    minute_count  = case when public.scan_usage.minute_bucket = v_min then public.scan_usage.minute_count + 1 else 1 end,
    minute_bucket = v_min,
    month_count   = case when public.scan_usage.month = v_mon then public.scan_usage.month_count + 1 else 1 end,
    month         = v_mon,
    updated_at    = v_now
  returning minute_count, month_count into v_minc, v_monc;

  if v_lim is not null and v_monc > v_lim then
    update public.scan_usage set month_count = month_count - 1 where user_id = v_uid;
    return json_build_object('allowed', false, 'reason', 'scan_month', 'rank', v_rank,
      'month', v_monc - 1, 'month_limit', v_lim);
  end if;
  -- Η άρνηση του λεπτού δεν τρώει σάρωση του μήνα· ο μετρητής του λεπτού μένει.
  if v_minc > v_lminute then
    update public.scan_usage set month_count = month_count - 1 where user_id = v_uid;
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;

  -- Η ΔΕΞΑΜΕΝΗ ΧΡΕΩΝΕΤΑΙ ΤΕΛΕΥΤΑΙΑ, μόνο για σάρωση που κατά τα άλλα περνά.
  if v_charge then
    insert into public.ai_budget (month, free_count, updated_at)
      values (v_mon, 1, v_now)
    on conflict (month) do update set
      free_count = public.ai_budget.free_count + 1,
      updated_at = v_now
    returning free_count into v_pool;

    if v_pool > v_lpool then
      update public.ai_budget set free_count = greatest(free_count - 1, 0) where month = v_mon;
      update public.scan_usage set month_count = month_count - 1 where user_id = v_uid;
      return json_build_object('allowed', false, 'reason', 'pool', 'rank', v_rank);
    end if;
  end if;

  return json_build_object('allowed', true, 'rank', v_rank, 'paying', v_pay, 'pool', v_charge,
    'month', v_monc, 'month_limit', v_lim);
end; $$;

comment on function public.bump_scan_usage(integer, integer[]) is
  'Μετρά μία σάρωση. Βαθμός 0: όριο scan[0], εκτός δεξαμενής. Ανυψωμένος χωρίς πληρωμή: όριο trial_scan και μία μονάδα της κοινής δεξαμενής (ai_budget). Δοκιμαστής: όριο trial_scan σε κάθε πακέτο. Πληρωμένος: χωρίς μηνιαίο όριο. Κάθε άρνηση γυρίζει πίσω τον μηνιαίο μετρητή.';

drop function if exists public.refund_scan_usage(uuid);

create or replace function public.refund_scan_usage(p_uid uuid, p_pool boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_now  timestamptz := now();
  v_mon  date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_monc integer;
  v_pay  boolean;
  v_rank integer;
begin
  if p_uid is null then
    return json_build_object('refunded', false, 'reason', 'uid');
  end if;
  update public.scan_usage
     set month_count = greatest(month_count - 1, 0)
   where user_id = p_uid
  returning month_count into v_monc;
  if not found then
    return json_build_object('refunded', false, 'reason', 'no_row');
  end if;

  if p_pool then
    -- Ο ΙΔΙΟΣ ΟΡΟΣ ΜΕ ΤΗ ΧΡΕΩΣΗ της `bump_scan_usage`: η δεξαμενή πιστώνεται
    -- μόνο εκεί όπου χρεώθηκε, αλλιώς θα γέμιζε μονάδες που δεν ξοδεύτηκαν.
    select coalesce(plan, 'free') in ('solo', 'owner', 'agency', 'office')
      into v_pay from public.billing_profiles where user_id = p_uid;
    v_rank := coalesce(public.user_plan_rank(p_uid), 0);
    if not coalesce(v_pay, false) and v_rank >= 1 then
      update public.ai_budget
         set free_count = greatest(public.ai_budget.free_count - 1, 0),
             updated_at = v_now
       where month = v_mon;
    end if;
  end if;

  return json_build_object('refunded', true, 'month', v_monc);
end; $$;
revoke all on function public.refund_scan_usage(uuid, boolean) from public, anon, authenticated;
grant execute on function public.refund_scan_usage(uuid, boolean) to service_role;

comment on function public.refund_scan_usage(uuid, boolean) is
  'Γυρίζει πίσω μία σάρωση στον μηνιαίο μετρητή. Με p_pool = true γυρίζει και τη μονάδα της κοινής δεξαμενής, μόνο αν η σάρωση είχε χρεωθεί εκεί. Εκτελείται μόνο από service_role.';
