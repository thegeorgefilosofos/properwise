-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΟΡΙΑ ΤΗΣ ΝΟΑΣ ΚΑΙ ΤΗΣ ΣΑΡΩΣΗΣ ΤΑ ΞΕΡΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Η `bump_ai_usage` (8 ορίσματα) και η `bump_scan_usage` μένουν
-- εκτελέσιμες από τον `authenticated` (20260928100000, κατηγορία β), γιατί τις
-- καλεί η διαδρομή /api/anthropic με τη συνεδρία του χρήστη. Τα όρια όμως
-- έρχονταν ΩΣ ΟΡΙΣΜΑΤΑ: πίνακες ανά βαθμό, πακέτο δοκιμής, δοκιμαστή,
-- δεξαμενή. Ο βαθμός κρινόταν μέσα στη βάση, το όριο του βαθμού όχι. Ενας
-- συνδεδεμένος χρήστης μπορούσε να καλέσει απευθείας το RPC με
-- `p_month => '{100000,…}'`, να δει `allowed: true` και να γράψει μετρητή που
-- δεν τον σταματά. Το φράγμα της διαδρομής ήταν πραγματικό μόνο όσο κανείς
-- δεν χτυπούσε τη βάση χωρίς αυτήν.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Τα όρια ζουν στη `ai_plan_limits()`, ίδια με το
-- lib/billing/aiLimits.ts (το lib/billing/aiLimitsSql.test.ts τα
-- αντιπαραβάλλει, όπως η `plan_price` με το plans.ts). Οι δύο συναρτήσεις
-- κρατούν την υπογραφή τους, ώστε η διαδρομή και η edge function να μη
-- σπάσουν στο deploy, αλλά κάθε όριο που στέλνει ο καλών περνά από `least`
-- με το όριο του διακομιστή: ο καλών μπορεί να ζητήσει ΛΙΓΟΤΕΡΑ, ποτέ
-- περισσότερα. Κενό όρισμα σημαίνει «του διακομιστή». Η δοκιμή και ο
-- δοκιμαστής κόβονται πάντα, όχι μόνο όταν ο καλών θυμηθεί να τα στείλει.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create or replace` με ίδια υπογραφή· τα grants μένουν.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ai_plan_limits()
returns jsonb language sql immutable
set search_path = public
as $$
  -- Σειρά βαθμών: free, solo, owner, agency, office (PLAN_RANK_ORDER).
  -- Σάρωση: null = χωρίς μηνιαίο όριο.
  select jsonb_build_object(
    'per_minute',   20,
    'day',          jsonb_build_array(0, 10, 20, 50, 150),
    'month',        jsonb_build_array(0, 30, 60, 150, 500),
    'scan',         jsonb_build_array(5, null, null, null, null),
    'trial_day',    7,
    'trial_month',  20,
    'tester_day',   30,
    'tester_month', 30,
    'pool',         2000
  )
$$;

comment on function public.ai_plan_limits() is
  'Τα όρια της Νόας και της σάρωσης ανά βαθμό πακέτου. Ταυτόσημα με το lib/billing/aiLimits.ts· το aiLimitsSql.test.ts τα αντιπαραβάλλει.';

revoke all on function public.ai_plan_limits() from public, anon;
grant execute on function public.ai_plan_limits() to authenticated, service_role;

create or replace function public.bump_ai_usage(
  p_max_min      integer,
  p_day          integer[],
  p_month        integer[],
  p_pool         integer,
  p_trial_day    integer,
  p_trial_month  integer,
  p_tester_day   integer,
  p_tester_month integer
) returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid    uuid        := auth.uid();
  v_now    timestamptz := now();
  v_min    timestamptz := date_trunc('minute', v_now);
  v_day    date        := (v_now at time zone 'Europe/Athens')::date;
  v_mon    date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_lim    jsonb       := public.ai_plan_limits();
  v_plan   text;
  v_tester timestamptz;
  v_pay    boolean;
  v_rank   integer;
  v_r      integer;
  v_lday   integer;
  v_lmon   integer;
  v_lminute integer;
  v_lpool  integer;
  v_minc   integer;
  v_dayc   integer;
  v_monc   integer;
  v_pool   integer := 0;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;

  v_rank := coalesce(public.user_plan_rank(v_uid), 0);
  -- Αγνωστος βαθμός πέφτει στον βαθμό 0, όπως και πριν.
  v_r := case when v_rank between 0 and jsonb_array_length(v_lim->'month') - 1 then v_rank else 0 end;

  -- ΤΟ ΟΡΙΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, ΚΑΙ ΤΟΥ ΚΑΛΟΥΝΤΟΣ ΜΟΝΟ ΑΝ ΕΙΝΑΙ ΜΙΚΡΟΤΕΡΟ.
  v_lday    := (v_lim->'day'->>v_r)::integer;
  v_lmon    := (v_lim->'month'->>v_r)::integer;
  v_lday    := least(v_lday, coalesce(p_day[v_rank + 1], p_day[1], v_lday));
  v_lmon    := least(v_lmon, coalesce(p_month[v_rank + 1], p_month[1], v_lmon));
  v_lminute := least((v_lim->>'per_minute')::integer, coalesce(p_max_min, (v_lim->>'per_minute')::integer));
  v_lpool   := least((v_lim->>'pool')::integer, coalesce(p_pool, (v_lim->>'pool')::integer));

  select plan, tester_since into v_plan, v_tester
    from public.billing_profiles where user_id = v_uid;
  v_pay := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');

  -- Ο μη πληρώνων δεν παίρνει ΠΟΤΕ περισσότερα από το πακέτο της δοκιμής,
  -- όσο ψηλά κι αν τον ανεβάσει δοκιμή, δώρο ή ιδιότητα. Πάντα, όχι μόνο όταν
  -- ο καλών στείλει τα ορίσματα της δοκιμής.
  if not v_pay then
    v_lday := least(v_lday, (v_lim->>'trial_day')::integer, coalesce(p_trial_day, v_lday));
    v_lmon := least(v_lmon, (v_lim->>'trial_month')::integer, coalesce(p_trial_month, v_lmon));
  end if;

  -- Ο δοκιμαστής κόβεται τελευταίος, ώστε να κόβει και τον «πληρωμένο».
  if v_tester is not null then
    v_lday := least(v_lday, (v_lim->>'tester_day')::integer, coalesce(p_tester_day, v_lday));
    v_lmon := least(v_lmon, (v_lim->>'tester_month')::integer, coalesce(p_tester_month, v_lmon));
  end if;

  -- Το πακέτο χωρίς Νόα σταματά εδώ, πριν μετρηθεί οτιδήποτε.
  if v_lmon <= 0 or v_lday <= 0 then
    return json_build_object('allowed', false, 'reason', 'plan', 'rank', v_rank);
  end if;

  insert into public.ai_usage (user_id, minute_bucket, minute_count, day, day_count, month, month_count, updated_at)
    values (v_uid, v_min, 1, v_day, 1, v_mon, 1, v_now)
  on conflict (user_id) do update set
    minute_count  = case when public.ai_usage.minute_bucket = v_min then public.ai_usage.minute_count + 1 else 1 end,
    minute_bucket = v_min,
    day_count     = case when public.ai_usage.day   = v_day then public.ai_usage.day_count   + 1 else 1 end,
    day           = v_day,
    month_count   = case when public.ai_usage.month = v_mon then public.ai_usage.month_count + 1 else 1 end,
    month         = v_mon,
    updated_at    = v_now
  returning minute_count, day_count, month_count into v_minc, v_dayc, v_monc;

  if not v_pay then
    insert into public.ai_budget (month, free_count, updated_at)
      values (v_mon, 1, v_now)
    on conflict (month) do update set
      free_count = public.ai_budget.free_count + 1,
      updated_at = v_now
    returning free_count into v_pool;
  end if;

  if not v_pay and v_pool > v_lpool then
    return json_build_object('allowed', false, 'reason', 'pool', 'rank', v_rank);
  end if;
  if v_monc > v_lmon then
    return json_build_object('allowed', false, 'reason', 'month', 'rank', v_rank);
  end if;
  if v_dayc > v_lday then
    return json_build_object('allowed', false, 'reason', 'day', 'rank', v_rank);
  end if;
  if v_minc > v_lminute then
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;

  return json_build_object(
    'allowed', true, 'rank', v_rank, 'paying', v_pay,
    'tester', v_tester is not null,
    'minute', v_minc, 'day', v_dayc, 'month', v_monc,
    'day_limit', v_lday, 'month_limit', v_lmon
  );
end; $$;

create or replace function public.bump_scan_usage(p_max_min integer, p_month integer[])
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid  uuid        := auth.uid();
  v_now  timestamptz := now();
  v_min  timestamptz := date_trunc('minute', v_now);
  v_mon  date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_cap  jsonb       := public.ai_plan_limits();
  v_rank integer;
  v_r    integer;
  v_lim  integer;
  v_srv  integer;
  v_cli  integer;
  v_lminute integer;
  v_minc integer;
  v_monc integer;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;
  v_rank := coalesce(public.user_plan_rank(v_uid), 0);
  v_r := case when v_rank between 0 and jsonb_array_length(v_cap->'scan') - 1 then v_rank else 0 end;

  -- `null` = χωρίς μηνιαίο όριο. Του διακομιστή κρίνει· ο καλών μόνο χαμηλώνει.
  v_srv := (v_cap->'scan'->>v_r)::integer;
  v_cli := case when array_length(p_month, 1) >= v_rank + 1 then p_month[v_rank + 1] else p_month[1] end;
  v_lim := case
    when v_srv is null then v_cli
    when v_cli is null then v_srv
    else least(v_srv, v_cli)
  end;
  v_lminute := least((v_cap->>'per_minute')::integer, coalesce(p_max_min, (v_cap->>'per_minute')::integer));

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
  if v_minc > v_lminute then
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;
  return json_build_object('allowed', true, 'rank', v_rank, 'month', v_monc, 'month_limit', v_lim);
end; $$;
