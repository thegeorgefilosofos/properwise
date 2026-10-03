-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΣΑΡΩΣΗ ΧΩΡΙΣ ΣΥΝΔΡΟΜΗ ΜΕΤΡΙΕΤΑΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Η `bump_scan_usage` (20261002100000) έκοβε μόνο τον βαθμό 0: πέντε
-- σαρώσεις τον μήνα στον δωρεάν «Ιδιοκτήτη», `null` σε όλους τους άλλους. Ο
-- βαθμός όμως ανεβαίνει και ΧΩΡΙΣ πληρωμή: η τοπική δοκιμή δίνει «Ιδιοκτήτης+»,
-- οι δωρεάν μήνες δίνουν όποιο πακέτο γράφει το `comp_plan`, ο Συνεργάτης
-- παίρνει πάντα «Επαγγελματίας». Ολοι αυτοί σάρωναν χωρίς μηνιαίο όριο και
-- καμία σάρωση δεν μετρούσε στην κοινή δεξαμενή (`ai_budget`), που είναι η
-- μόνη σκληρή εγγύηση κόστους για όσους δεν πληρώνουν. Η `bump_ai_usage` το
-- ήξερε από καιρό για τις ερωτήσεις («ο μη πληρώνων δεν παίρνει ΠΟΤΕ
-- περισσότερα από το πακέτο της δοκιμής»)· η σάρωση, με το ίδιο μοντέλο και
-- εικόνα στο αίτημα, έμενε ανοιχτή βρύση.
--
-- Και ένα μικρότερο: η σάρωση που κοβόταν από το όριο ΑΝΑ ΛΕΠΤΟ είχε ήδη
-- γράψει +1 στον μήνα και δεν το γύριζε πίσω. Ο δωρεάν χρήστης που πατούσε
-- γρήγορα έχανε σαρώσεις του μήνα για σαρώσεις που δεν έγιναν ποτέ. Η άρνηση
-- του μήνα γύριζε ήδη πίσω· η άρνηση του λεπτού όχι.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Απόφαση ιδιοκτήτη (03.10.2026):
--   · ΔΩΡΕΑΝ, βαθμός 0: όπως ήταν. Πέντε τον μήνα, εκτός δεξαμενής.
--   · ΑΝΥΨΩΜΕΝΟΣ ΧΩΡΙΣ ΠΛΗΡΩΜΗ (δοκιμή, δωρεάν μήνες, Συνεργάτης): ταβάνι
--     `trial_scan` τον μήνα ΚΑΙ κάθε σάρωση που περνά χρεώνει μία μονάδα της
--     κοινής δεξαμενής. Οταν η δεξαμενή γεμίσει, άρνηση με λόγο 'pool', όπως
--     στην `bump_ai_usage`.
--   · ΣΥΝΔΡΟΜΗΤΗΣ ΠΟΥ ΠΛΗΡΩΝΕΙ: όπως ήταν. Χωρίς μηνιαίο όριο, εκτός δεξαμενής.
-- Το «πληρώνει» είναι ο ΙΔΙΟΣ ορισμός με τη `bump_ai_usage` και τη
-- `refund_ai_usage`: `billing_profiles.plan` σε πληρωμένο πακέτο. Το ταβάνι
-- ζει στη `ai_plan_limits()` δίπλα στα άλλα, ίδιο με το TRIAL_SCANS_PER_MONTH
-- του lib/billing/aiLimits.ts (το aiLimitsSql.test.ts τα αντιπαραβάλλει).
--
-- ΚΑΘΕ ΑΡΝΗΣΗ ΓΥΡΙΖΕΙ ΠΙΣΩ ΟΣΑ ΕΓΡΑΨΕ. Μήνας, λεπτό ή δεξαμενή: ο μηνιαίος
-- μετρητής του χρήστη επιστρέφει στη θέση του και η δεξαμενή χρεώνεται ΜΟΝΟ
-- αφού περάσουν μήνας και λεπτό. Ο μετρητής του λεπτού μένει, γιατί μετρά
-- προσπάθειες και όχι σαρώσεις: εκεί είναι που πιάνει το σενάριο.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create or replace` με ίδια υπογραφή· τα grants μένουν.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ai_plan_limits()
returns jsonb language sql immutable
set search_path = public
as $$
  -- Σειρά βαθμών: free, solo, owner, agency, office (PLAN_RANK_ORDER).
  -- Σάρωση: null = χωρίς μηνιαίο όριο. Το `trial_scan` κόβει κάθε ανυψωμένο
  -- επίπεδο χωρίς πληρωμή, όπως τα `trial_day` και `trial_month` τις ερωτήσεις.
  select jsonb_build_object(
    'per_minute',   20,
    'day',          jsonb_build_array(0, 10, 20, 50, 150),
    'month',        jsonb_build_array(0, 30, 60, 150, 500),
    'scan',         jsonb_build_array(5, null, null, null, null),
    'trial_day',    7,
    'trial_month',  20,
    'trial_scan',   30,
    'tester_day',   30,
    'tester_month', 30,
    'pool',         2000
  )
$$;

comment on function public.ai_plan_limits() is
  'Τα όρια της Νόας και της σάρωσης ανά βαθμό πακέτου. Ταυτόσημα με το lib/billing/aiLimits.ts· το aiLimitsSql.test.ts τα αντιπαραβάλλει.';

revoke all on function public.ai_plan_limits() from public, anon;
grant execute on function public.ai_plan_limits() to authenticated, service_role;

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
  select plan into v_plan from public.billing_profiles where user_id = v_uid;
  v_pay    := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  v_charge := not v_pay and v_r >= 1;

  -- `null` = χωρίς μηνιαίο όριο. Του διακομιστή κρίνει· ο καλών μόνο χαμηλώνει.
  v_srv := (v_cap->'scan'->>v_r)::integer;
  if v_charge then
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
  'Μετρά μία σάρωση. Βαθμός 0: όριο scan[0], εκτός δεξαμενής. Ανυψωμένος χωρίς πληρωμή: όριο trial_scan και μία μονάδα της κοινής δεξαμενής (ai_budget). Πληρωμένος: χωρίς μηνιαίο όριο. Κάθε άρνηση γυρίζει πίσω τον μηνιαίο μετρητή.';
