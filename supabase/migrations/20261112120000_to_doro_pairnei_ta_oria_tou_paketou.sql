-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΔΩΡΟ ΠΑΙΡΝΕΙ ΤΑ ΟΡΙΑ ΤΟΥ ΠΑΚΕΤΟΥ ΠΟΥ ΥΠΟΣΧΕΘΗΚΕ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Οι `take_ai_unit` και `take_scan_unit` (20261005150000) κρίνουν
-- το «πληρώνει» μόνο από τη στήλη `plan`:
--     v_pay := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office')
-- Ο νικητής της κλήρωσης και όποιος κερδίζει μήνες από το πρόγραμμα
-- πρόσκλησης έχει `plan = 'free'` και το δώρο στα `comp_plan`/`comp_until`.
-- Η `user_plan_rank` του δίνει τον βαθμό του πακέτου, αλλά οι δύο συναρτήσεις
-- τον έκοβαν στο πακέτο της ΔΟΚΙΜΗΣ (`trial_day`, `trial_month`,
-- `trial_scan`) και τον χρέωναν στην κοινή δεξαμενή. Ενας χρόνος
-- «Επαγγελματίας» από την κλήρωση έδινε τις ερωτήσεις της δοκιμής αντί για όσες
-- έχει το πακέτο.
--
-- Η ΠΗΓΗ. Οι Όροι (app/terms/page.tsx) υπόσχονται πακέτο, όχι δοκιμή:
--   §10 «Πρόγραμμα πρόσκλησης και συνεργατών»: «κερδίζεις … μήνες
--       “Επαγγελματίας”», «Οι ανταμοιβές είναι αξία προϊόντος, δηλαδή μήνες
--       συνδρομής χωρίς χρέωση … Όσο δεν έχει ενεργοποιηθεί η χρέωση
--       συνδρομών, οι μήνες αυτοί δίνονται ως αντίστοιχη πρόσβαση χωρίς
--       πληρωμή» (billingWords.compMonths).
--   §13 «Κλήρωση αξιολόγησης»: «δώρο έναν χρόνο συνδρομής “Επαγγελματίας”»,
--       «Το δώρο είναι αξία προϊόντος, πιστώνεται στον λογαριασμό του νικητή».
-- Απόφαση ιδιοκτήτη 12/11/2026 (Α): οι ανταμοιβές κρατούν την υπόσχεσή τους.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Δώρο σε ισχύ = `comp_until > now()` και `plan_rank(comp_plan)`
-- από 1 και πάνω, ο ίδιος όρος με την `user_plan_rank`. Τότε:
--   · τα όρια της Νόας είναι του πακέτου του δώρου (`day`/`month` στον βαθμό
--     του), όχι της δοκιμής· ούτε ενός ψηλότερου βαθμού που ο λογαριασμός
--     έχει για άλλον λόγο (δοκιμή, Συνεργάτης)·
--   · η σάρωση έχει το όριο του πακέτου του δώρου (`scan`, σήμερα χωρίς
--     μηνιαίο)·
--   · τίποτα δεν χρεώνεται στην κοινή δεξαμενή (`pool` στο αίτημα `false`).
-- Ο δοκιμαστής κόβεται ακόμη τελευταίος, με ή χωρίς δώρο. Η δοκιμή, ο
-- Συνεργάτης χωρίς δώρο και ο δωρεάν λογαριασμός μένουν όπως ήταν.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Καμία τιμή και κανένα όριο πακέτου: η `ai_plan_limits()`
-- μένει όπως την άφησε η 20261003100000. Υπογραφές, `security definer`,
-- `search_path`, `revoke`/`grant` (μόνο `service_role`), η άρνηση χωρίς
-- ίχνος (ΟΛΑ Ή ΤΙΠΟΤΑ) και η σειρά «χρήστης πρώτα, δεξαμενή τελευταία» μένουν
-- αυτούσια. Ο δεύτερος παράγοντας ελέγχεται στη διαδρομή, πριν από τον ρόλο
-- υπηρεσίας που καλεί αυτές τις συναρτήσεις· δεν αγγίζεται.
-- Η επιστροφή (`refund_ai_unit`) διαβάζει το `pool` του αιτήματος, άρα
-- πιστώνει δεξαμενή μόνο όπου τη χρέωσε· δεν χρειάζεται αλλαγή.
--
-- ΙΔΙΟΔΥΝΑΜΗ. Μόνο `create or replace` με τις ίδιες υπογραφές και
-- `revoke`/`grant` που ξανατρέχουν. Η απόδειξη: scripts/db/rls-probe.sql
-- (δώρο: όρια του πακέτου, εκτός δεξαμενής· δοκιμή: όπως πριν) και
-- scripts/db-replay.sh. Ο TS καθρέφτης: `effectiveAiLimits` στο
-- lib/billing/aiLimits.ts, με τη δοκιμή στο lib/billing/aiLimits.test.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η μονάδα της Νόας ─────────────────────────────────────────────────
create or replace function public.take_ai_unit(p_uid uuid, p_request_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_now     timestamptz := now();
  v_min     timestamptz := date_trunc('minute', v_now);
  v_day     date        := (v_now at time zone 'Europe/Athens')::date;
  v_mon     date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_lim     jsonb       := public.ai_plan_limits();
  v_lminute integer     := (v_lim->>'per_minute')::integer;
  v_lpool   integer     := (v_lim->>'pool')::integer;
  v_plan    text;
  v_tester  timestamptz;
  v_cplan   text;
  v_cuntil  timestamptz;
  v_pay     boolean;
  v_comp    boolean;
  v_cr      integer;
  v_pool    boolean;
  v_rank    integer;
  v_r       integer;
  v_lday    integer;
  v_lmon    integer;
  v_minc    integer;
  v_dayc    integer;
  v_monc    integer;
  v_deny    text;
  v_cur     record;
begin
  if p_uid is null or p_request_id is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;

  -- ΤΑ ΟΡΙΑ ΤΑ ΞΕΡΕΙ ΜΟΝΟ Ο ΔΙΑΚΟΜΙΣΤΗΣ. Η ίδια λογική με τη bump_ai_usage της
  -- 20261002100000, χωρίς το `least` με τον καλούντα: δεν υπάρχει καλών.
  v_rank := coalesce(public.user_plan_rank(p_uid), 0);
  v_r := case when v_rank between 0 and jsonb_array_length(v_lim->'month') - 1 then v_rank else 0 end;
  v_lday := (v_lim->'day'->>v_r)::integer;
  v_lmon := (v_lim->'month'->>v_r)::integer;

  select plan, tester_since, comp_plan, comp_until into v_plan, v_tester, v_cplan, v_cuntil
    from public.billing_profiles where user_id = p_uid;
  v_pay := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  -- ΔΩΡΟ ΣΕ ΙΣΧΥ: πακέτο με βαθμό και λήξη που δεν πέρασε, όπως το μετρά η
  -- user_plan_rank (20260927200000). Δίνει τα όρια του ΔΙΚΟΥ ΤΟΥ πακέτου.
  v_cr := case when v_cuntil is not null and v_cuntil > v_now then public.plan_rank(v_cplan) else 0 end;
  v_comp := not v_pay and v_cr between 1 and jsonb_array_length(v_lim->'month') - 1;
  -- Μόνο ο μη πληρώνων χωρίς δώρο κοστίζει από την κοινή δεξαμενή.
  v_pool := not v_pay and not v_comp;
  -- Ο μη πληρώνων χωρίς δώρο δεν παίρνει ποτέ περισσότερα από το πακέτο της δοκιμής.
  if v_pool then
    v_lday := least(v_lday, (v_lim->>'trial_day')::integer);
    v_lmon := least(v_lmon, (v_lim->>'trial_month')::integer);
  end if;
  -- Το δώρο παίρνει τα όρια του πακέτου του, όχι ενός ψηλότερου βαθμού που
  -- ο λογαριασμός έχει για άλλον λόγο (δοκιμή, Συνεργάτης).
  if v_comp then
    v_lday := least(v_lday, (v_lim->'day'->>v_cr)::integer);
    v_lmon := least(v_lmon, (v_lim->'month'->>v_cr)::integer);
  end if;
  -- Ο δοκιμαστής κόβεται τελευταίος, ώστε να κόβει και τον «πληρωμένο».
  if v_tester is not null then
    v_lday := least(v_lday, (v_lim->>'tester_day')::integer);
    v_lmon := least(v_lmon, (v_lim->>'tester_month')::integer);
  end if;

  -- Το πακέτο χωρίς Νόα σταματά εδώ, πριν γραφτεί οτιδήποτε.
  if v_lmon <= 0 or v_lday <= 0 then
    return json_build_object('allowed', false, 'reason', 'plan', 'rank', v_rank);
  end if;

  -- ΟΛΑ Ή ΤΙΠΟΤΑ. Ό,τι γράφεται μέσα σε αυτό το μπλοκ σβήνει με την άρνηση.
  begin
    insert into public.ai_usage_requests (request_id, user_id, kind, period, day, pool)
      values (p_request_id, p_uid, 'ai', v_mon, v_day, v_pool)
      on conflict (request_id) do nothing;
    if not found then
      raise exception using errcode = 'PWU01', message = 'duplicate';
    end if;

    -- Ο μετρητής ανεβαίνει ΜΟΝΟ αν και τα τρία όρια έχουν χώρο. Σε READ
    -- COMMITTED η συνθήκη ξαναελέγχεται στη νεότερη έκδοση της γραμμής· σε
    -- REPEATABLE READ και SERIALIZABLE μια ταυτόχρονη αλλαγή δίνει 40001.
    insert into public.ai_usage (user_id, minute_bucket, minute_count, day, day_count, month, month_count, updated_at)
      values (p_uid, v_min, 1, v_day, 1, v_mon, 1, v_now)
    on conflict (user_id) do update set
      minute_count  = case when public.ai_usage.minute_bucket = v_min then public.ai_usage.minute_count + 1 else 1 end,
      minute_bucket = v_min,
      day_count     = case when public.ai_usage.day   = v_day then public.ai_usage.day_count   + 1 else 1 end,
      day           = v_day,
      month_count   = case when public.ai_usage.month = v_mon then public.ai_usage.month_count + 1 else 1 end,
      month         = v_mon,
      updated_at    = v_now
    where (case when public.ai_usage.month = v_mon then public.ai_usage.month_count else 0 end) < v_lmon
      and (case when public.ai_usage.day   = v_day then public.ai_usage.day_count   else 0 end) < v_lday
      and (case when public.ai_usage.minute_bucket = v_min then public.ai_usage.minute_count else 0 end) < v_lminute
    returning minute_count, day_count, month_count into v_minc, v_dayc, v_monc;
    if not found then
      raise exception using errcode = 'PWU01', message = 'user';
    end if;

    -- Η ΔΕΞΑΜΕΝΗ ΤΕΛΕΥΤΑΙΑ, μόνο για ό,τι κατά τα άλλα περνά.
    if v_pool then
      insert into public.ai_budget (month, free_count, updated_at)
        values (v_mon, 1, v_now)
      on conflict (month) do update set
        free_count = public.ai_budget.free_count + 1,
        updated_at = v_now
      where public.ai_budget.free_count < v_lpool;
      if not found then
        raise exception using errcode = 'PWU01', message = 'pool';
      end if;
    end if;
  exception when sqlstate 'PWU01' then
    v_deny := sqlerrm;
  end;

  if v_deny = 'duplicate' then
    return json_build_object('allowed', false, 'reason', 'duplicate', 'rank', v_rank);
  end if;
  if v_deny = 'pool' then
    return json_build_object('allowed', false, 'reason', 'pool', 'rank', v_rank);
  end if;
  if v_deny = 'user' then
    -- Ποιο όριο έκλεισε. Μόνο ανάγνωση: η απόφαση έχει ήδη παρθεί.
    select case when month = v_mon then month_count else 0 end as monc,
           case when day = v_day then day_count else 0 end as dayc
      into v_cur from public.ai_usage where user_id = p_uid;
    return json_build_object(
      'allowed', false,
      'reason', case when v_cur.monc >= v_lmon then 'month'
                     when v_cur.dayc >= v_lday then 'day'
                     else 'minute' end,
      'rank', v_rank,
      'month', v_cur.monc, 'month_limit', v_lmon,
      'day', v_cur.dayc, 'day_limit', v_lday);
  end if;

  return json_build_object(
    'allowed', true, 'rank', v_rank, 'paying', v_pay,
    'comp', v_comp, 'pool', v_pool,
    'tester', v_tester is not null,
    'minute', v_minc, 'day', v_dayc, 'month', v_monc,
    'day_limit', v_lday, 'month_limit', v_lmon,
    'request_id', p_request_id
  );
end; $$;

revoke all on function public.take_ai_unit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.take_ai_unit(uuid, uuid) to service_role;

comment on function public.take_ai_unit(uuid, uuid) is
  'Χρεώνει μία ερώτηση στη Νόα πριν από την κλήση στον πάροχο. Όρια μόνο από ai_plan_limits() και το πακέτο· το δώρο σε ισχύ (comp_plan/comp_until) παίρνει τα όρια του πακέτου του, εκτός δεξαμενής· άρνηση χωρίς καμία εγγραφή· η δεξαμενή τελευταία. Μόνο service_role.';

-- ── 2. Η μονάδα της σάρωσης ──────────────────────────────────────────────
create or replace function public.take_scan_unit(p_uid uuid, p_request_id uuid, p_file_hash text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  -- SCAN_REUSE_MS και SCAN_REUSE_MAX: ζούσαν στη μνήμη της διαδρομής.
  c_reuse_window constant interval := interval '5 minutes';
  c_reuse_max    constant integer  := 3;
  v_now     timestamptz := now();
  v_min     timestamptz := date_trunc('minute', v_now);
  v_day     date        := (v_now at time zone 'Europe/Athens')::date;
  v_mon     date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_cap     jsonb       := public.ai_plan_limits();
  v_lminute integer     := (v_cap->>'per_minute')::integer;
  v_lpool   integer     := (v_cap->>'pool')::integer;
  v_plan    text;
  v_tester  timestamptz;
  v_cplan   text;
  v_cuntil  timestamptz;
  v_pay     boolean;
  v_comp    boolean;
  v_cr      integer;
  v_charge  boolean;
  v_rank    integer;
  v_r       integer;
  v_lim     integer;
  v_minc    integer;
  v_monc    integer;
  v_base    uuid;
  v_deny    text;
  v_cur     record;
begin
  if p_uid is null or p_request_id is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;

  -- Η ΙΔΙΑ ΛΟΓΙΚΗ ΜΕ ΤΗ bump_scan_usage ΤΗΣ 20261003130000, χωρίς ορίσματα.
  v_rank := coalesce(public.user_plan_rank(p_uid), 0);
  v_r := case when v_rank between 0 and jsonb_array_length(v_cap->'scan') - 1 then v_rank else 0 end;
  select plan, tester_since, comp_plan, comp_until into v_plan, v_tester, v_cplan, v_cuntil
    from public.billing_profiles where user_id = p_uid;
  v_pay    := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  -- Ο ΙΔΙΟΣ ΟΡΙΣΜΟΣ ΤΟΥ ΔΩΡΟΥ ΜΕ ΤΗΝ take_ai_unit.
  v_cr := case when v_cuntil is not null and v_cuntil > v_now then public.plan_rank(v_cplan) else 0 end;
  v_comp := not v_pay and v_cr between 1 and jsonb_array_length(v_cap->'scan') - 1;
  -- Ανυψωμένος βαθμός χωρίς πληρωμή και χωρίς δώρο: δοκιμή, Συνεργάτης.
  v_charge := not v_pay and not v_comp and v_r >= 1;
  -- `null` = χωρίς μηνιαίο όριο. Το δώρο σαρώνει με το όριο του πακέτου του.
  -- Ο δοκιμαστής παίρνει το ταβάνι σε κάθε πακέτο.
  v_lim := (v_cap->'scan'->>(case when v_comp then v_cr else v_r end))::integer;
  if v_charge or v_tester is not null then
    v_lim := least(coalesce(v_lim, (v_cap->>'trial_scan')::integer), (v_cap->>'trial_scan')::integer);
  end if;
  if v_lim is not null and v_lim <= 0 then
    return json_build_object('allowed', false, 'reason', 'scan_month', 'rank', v_rank, 'month', 0, 'month_limit', v_lim);
  end if;

  begin
    insert into public.ai_usage_requests (request_id, user_id, kind, period, day, file_hash, pool)
      values (p_request_id, p_uid, 'scan', v_mon, v_day, p_file_hash, v_charge)
      on conflict (request_id) do nothing;
    if not found then
      raise exception using errcode = 'PWU01', message = 'duplicate';
    end if;

    -- ΕΝΑ ΑΡΧΕΙΟ, ΜΙΑ ΣΑΡΩΣΗ. Η οθόνη διαβάζει μια φωτογραφία σε έως τρία
    -- βήματα (scanDoc.ts `scanFile`)· για τον χρήστη είναι μία σάρωση. Η
    -- σάρωση που πλήρωσε για το αρχείο μετρά τις επαναχρήσεις της με ατομικό
    -- `update … where reuses < …`: δύο ταυτόχρονες δεν περνούν και οι δύο.
    if p_file_hash is not null then
      update public.ai_usage_requests b
         set reuses = b.reuses + 1
       where b.request_id = (
               select request_id from public.ai_usage_requests
                where user_id = p_uid and file_hash = p_file_hash and kind = 'scan'
                  and reuse_of is null and refunded_at is null
                  and request_id <> p_request_id
                  and created_at > v_now - c_reuse_window
                order by created_at desc
                limit 1)
         and b.reuses < c_reuse_max - 1
         and b.refunded_at is null
      returning b.request_id into v_base;
    end if;

    if v_base is not null then
      update public.ai_usage_requests set reuse_of = v_base, pool = false
       where request_id = p_request_id;
    else
      insert into public.scan_usage (user_id, minute_bucket, minute_count, month, month_count, updated_at)
        values (p_uid, v_min, 1, v_mon, 1, v_now)
      on conflict (user_id) do update set
        minute_count  = case when public.scan_usage.minute_bucket = v_min then public.scan_usage.minute_count + 1 else 1 end,
        minute_bucket = v_min,
        month_count   = case when public.scan_usage.month = v_mon then public.scan_usage.month_count + 1 else 1 end,
        month         = v_mon,
        updated_at    = v_now
      where (v_lim is null
             or (case when public.scan_usage.month = v_mon then public.scan_usage.month_count else 0 end) < v_lim)
        and (case when public.scan_usage.minute_bucket = v_min then public.scan_usage.minute_count else 0 end) < v_lminute
      returning minute_count, month_count into v_minc, v_monc;
      if not found then
        raise exception using errcode = 'PWU01', message = 'user';
      end if;

      if v_charge then
        insert into public.ai_budget (month, free_count, updated_at)
          values (v_mon, 1, v_now)
        on conflict (month) do update set
          free_count = public.ai_budget.free_count + 1,
          updated_at = v_now
        where public.ai_budget.free_count < v_lpool;
        if not found then
          raise exception using errcode = 'PWU01', message = 'pool';
        end if;
      end if;
    end if;
  exception when sqlstate 'PWU01' then
    v_deny := sqlerrm;
  end;

  if v_deny = 'duplicate' then
    return json_build_object('allowed', false, 'reason', 'duplicate', 'rank', v_rank);
  end if;
  if v_deny = 'pool' then
    return json_build_object('allowed', false, 'reason', 'pool', 'rank', v_rank);
  end if;
  if v_deny = 'user' then
    select case when month = v_mon then month_count else 0 end as monc
      into v_cur from public.scan_usage where user_id = p_uid;
    if v_lim is not null and v_cur.monc >= v_lim then
      return json_build_object('allowed', false, 'reason', 'scan_month', 'rank', v_rank,
        'month', v_cur.monc, 'month_limit', v_lim);
    end if;
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;

  if v_base is not null then
    return json_build_object('allowed', true, 'reuse', true, 'rank', v_rank, 'paying', v_pay,
      'pool', false, 'month_limit', v_lim, 'request_id', p_request_id);
  end if;
  return json_build_object('allowed', true, 'reuse', false, 'rank', v_rank, 'paying', v_pay,
    'comp', v_comp, 'pool', v_charge, 'month', v_monc, 'month_limit', v_lim, 'request_id', p_request_id);
end; $$;

revoke all on function public.take_scan_unit(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.take_scan_unit(uuid, uuid, text) to service_role;

comment on function public.take_scan_unit(uuid, uuid, text) is
  'Χρεώνει μία σάρωση πριν από την κλήση στον πάροχο, ή μετρά επανάχρηση του ίδιου αρχείου (έως 3 μέσα σε 5 λεπτά). Όρια μόνο από ai_plan_limits() και το πακέτο· το δώρο σε ισχύ σαρώνει με το όριο του πακέτου του, εκτός δεξαμενής· άρνηση χωρίς καμία εγγραφή. Μόνο service_role.';
