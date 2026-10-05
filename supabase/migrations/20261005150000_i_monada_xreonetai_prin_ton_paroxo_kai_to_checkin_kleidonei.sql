-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΜΟΝΑΔΑ ΤΗΣ ΝΟΑΣ ΚΑΙ ΤΗΣ ΣΑΡΩΣΗΣ ΧΡΕΩΝΕΤΑΙ ΠΡΙΝ ΤΟΝ ΠΑΡΟΧΟ, ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ·
-- ΤΟ CHECK-IN ΚΛΕΙΔΩΝΕΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ, ΠΡΩΤΟ. Η `bump_ai_usage` (20261002100000:121-153) έγραφε τον
-- μετρητή του χρήστη και την κοινή δεξαμενή `ai_budget` ΠΡΙΝ ελέγξει τα όρια
-- και δεν τα γύριζε πίσω όταν αρνιόταν. Εκτελείται από τον `authenticated`, άρα
-- ένας λογαριασμός σε δοκιμή, σε δωρεάν μήνες ή Συνεργάτης καλούσε απευθείας
-- `rpc('bump_ai_usage')` σε βρόχο: κάθε άρνηση έγραφε +1 στη δεξαμενή (2000)
-- και τελικά έκλεινε τη Νόα σε όλους τους μη πληρώνοντες, χωρίς να κοστίσει
-- ούτε μία κλήση AI.
--
-- ΤΟ ΣΦΑΛΜΑ, ΔΕΥΤΕΡΟ. Τα όρια ταξίδευαν ακόμη ως ορίσματα (έστω με `least`),
-- τον μετρητή τον διάλεγε το σώμα του αιτήματος (`kind: 'scan'`), η επανάχρηση
-- αρχείου ζούσε στη μνήμη κάθε στιγμιοτύπου και η επιστροφή αφαιρούσε «μία»
-- χωρίς να ξέρει ποια: δύο επιστροφές για την ίδια αποτυχία χάριζαν δεύτερη.
--
-- ΤΟ ΣΦΑΛΜΑ, ΤΡΙΤΟ. Η `submit_checkin` (20260806230000:81-96) διάβαζε το
-- `checkin_links` χωρίς κλείδωμα και η `allow_public_submit`
-- (20261004100000:107-134) κλειδώνει μόνο τη γραμμή του `portal_links`. Για
-- κουπόνι check-in δεν υπάρχει τέτοια γραμμή, οπότε `count(*)` και `insert`
-- έτρεχαν χωρίς σειρά: είκοσι ταυτόχρονες υποβολές περνούσαν το «τρεις την
-- ώρα» και έγραφαν προσωπικά δεδομένα επισκεπτών στο `guest_checkins`. Το
-- έλεγε ήδη το ίδιο το 20261004100000 (γρ. 29).
--
-- ΤΙ ΑΛΛΑΖΕΙ.
--   1. `ai_usage_requests`: μία γραμμή ανά αίτημα, με κλειδί που φτιάχνει ο
--      διακομιστής. RLS χωρίς πολιτικές, κανένα δικαίωμα σε πελάτη.
--   2. `take_ai_unit(p_uid, p_request_id)` και
--      `take_scan_unit(p_uid, p_request_id, p_file_hash)`: χωρίς ορίσματα
--      ορίων. Τα όρια βγαίνουν μόνο από `ai_plan_limits()`, `user_plan_rank` και
--      `billing_profiles`, με την ίδια λογική δοκιμής, δοκιμαστή και πληρωμής
--      με τις 20261002100000 και 20261003130000. Κάθε μετρητής ανεβαίνει με
--      ατομικό `insert … on conflict do update … where <κάτω από το όριο>`· η
--      δεξαμενή χρεώνεται τελευταία. Όλα μαζί σε υποσυναλλαγή: ΑΡΝΗΣΗ =
--      ΚΑΜΙΑ ΕΓΓΡΑΦΗ, ούτε στον χρήστη ούτε στη δεξαμενή ούτε στο ημερολόγιο.
--   3. Η επανάχρηση αρχείου ζει πλέον εδώ: το ίδιο αρχείο (αποτύπωμα
--      `p_file_hash`) από τον ίδιο χρήστη, μέσα σε πέντε λεπτά από τη σάρωση
--      που χρεώθηκε, περνά το πολύ τρεις φορές συνολικά χωρίς νέα χρέωση. Τα
--      νούμερα είναι τα SCAN_REUSE_MS / SCAN_REUSE_MAX που ζούσαν στη διαδρομή.
--   4. `refund_ai_unit(p_uid, p_request_id, p_pool)`: γυρίζει ΑΚΡΙΒΩΣ ό,τι
--      χρέωσε αυτό το αίτημα, μία φορά. Δεύτερη κλήση για το ίδιο κλειδί δεν
--      κάνει τίποτα.
--   5. Οι τρεις νέες συναρτήσεις εκτελούνται μόνο από `service_role`: τις καλεί
--      η διαδρομή /api/anthropic (lib/billing/aiUnits.ts) με το `user.id` της
--      συνεδρίας και η smart-suggestions με τον χρήστη του JWT.
--   6. ΜΕΤΑΒΑΣΗ. Οι `bump_ai_usage` και `bump_scan_usage` μένουν σε αυτή την
--      έκδοση, γιατί τις καλεί η εφαρμογή που τρέχει όσο ανεβαίνει η νέα. Δεν
--      διαβάζουν πια κανένα όρισμα: είναι λεπτά περιτυλίγματα της `take_*` με
--      `auth.uid()` και νέο κλειδί, άρα κληρονομούν το «άρνηση = καμία
--      εγγραφή». Φεύγουν σε επόμενη αλλαγή, μαζί με τις
--      `refund_ai_usage`/`refund_scan_usage`.
--   7. `submit_checkin`: το μοτίβο του 20261004100000 για την πύλη. Κλειδώνει
--      τη γραμμή του `checkin_links` (`for no key update`), την ξαναδιαβάζει
--      μετά την αναμονή με `token = p_token`, ενεργή και μη ληγμένη, μετρά και
--      γράφει και ανεβάζει την έκδοση της γραμμής (`set token = token`), ώστε
--      όποια υποβολή περίμενε με παλιά φωτογραφία (REPEATABLE READ,
--      SERIALIZABLE) να πάρει 40001 αντί να περάσει το ταβάνι. Ίδια υπογραφή,
--      ίδια δικαιώματα.
--
-- ΤΑ ΝΟΥΜΕΡΑ ΔΕΝ ΑΛΛΑΖΟΥΝ. Κανένα όριο πακέτου, καμία τιμή: η `ai_plan_limits()`
-- μένει όπως την άφησε η 20261003100000.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create table if not exists`, `create index if not exists`,
-- `create or replace` με ίδιες υπογραφές, `drop policy`/`unschedule` πριν από
-- δημιουργία. Η απόδειξη: scripts/test-ai-units-concurrency.mjs (πριν/μετά, σε
-- READ COMMITTED, REPEATABLE READ, SERIALIZABLE) και scripts/db-replay.sh.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Το ημερολόγιο των αιτημάτων ───────────────────────────────────────
create table if not exists public.ai_usage_requests (
  request_id  uuid        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null check (kind in ('ai', 'scan')),
  -- Ο μήνας και η ημέρα Αθήνας της χρέωσης: η επιστροφή μειώνει μόνο τον
  -- μετρητή της ίδιας περιόδου, όχι αυτόν που έχει γυρίσει στο μεταξύ.
  period      date        not null,
  day         date        not null,
  file_hash   text,
  -- Αν αυτό το αίτημα χρέωσε μονάδα της κοινής δεξαμενής.
  pool        boolean     not null default false,
  -- Επανάχρηση: ποια σάρωση πλήρωσε για αυτό το αρχείο. Χωρίς χρέωση.
  reuse_of    uuid,
  -- Στη σάρωση που χρεώθηκε: πόσες επαναχρήσεις έχει ήδη δώσει.
  reuses      integer     not null default 0,
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

create index if not exists ai_usage_requests_file_idx
  on public.ai_usage_requests (user_id, file_hash, created_at desc)
  where file_hash is not null and reuse_of is null;
create index if not exists ai_usage_requests_created_idx
  on public.ai_usage_requests (created_at);

alter table public.ai_usage_requests enable row level security;
-- Καμία πολιτική και κανένα δικαίωμα σε ρόλο πελάτη: το γράφουν μόνο οι
-- SECURITY DEFINER από κάτω (scripts/guard-service-only-tables.mjs).
revoke all on table public.ai_usage_requests from public, anon, authenticated;

comment on table public.ai_usage_requests is
  'Ένα αίτημα AI ή σάρωσης ανά γραμμή, με κλειδί του διακομιστή. Η επιστροφή γίνεται ανά κλειδί και μία φορά· η επανάχρηση αρχείου μετριέται εδώ. Μόνο υπηρεσία.';

-- ── 2. Η μονάδα της Νόας ─────────────────────────────────────────────────
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
  v_pay     boolean;
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

  select plan, tester_since into v_plan, v_tester
    from public.billing_profiles where user_id = p_uid;
  v_pay := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  -- Ο μη πληρώνων δεν παίρνει ποτέ περισσότερα από το πακέτο της δοκιμής.
  if not v_pay then
    v_lday := least(v_lday, (v_lim->>'trial_day')::integer);
    v_lmon := least(v_lmon, (v_lim->>'trial_month')::integer);
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
      values (p_request_id, p_uid, 'ai', v_mon, v_day, not v_pay)
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
    if not v_pay then
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
    'tester', v_tester is not null,
    'minute', v_minc, 'day', v_dayc, 'month', v_monc,
    'day_limit', v_lday, 'month_limit', v_lmon,
    'request_id', p_request_id
  );
end; $$;

revoke all on function public.take_ai_unit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.take_ai_unit(uuid, uuid) to service_role;

comment on function public.take_ai_unit(uuid, uuid) is
  'Χρεώνει μία ερώτηση στη Νόα πριν από την κλήση στον πάροχο. Όρια μόνο από ai_plan_limits() και το πακέτο· άρνηση χωρίς καμία εγγραφή· η δεξαμενή τελευταία. Μόνο service_role.';

-- ── 3. Η μονάδα της σάρωσης ──────────────────────────────────────────────
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
  v_pay     boolean;
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
  select plan, tester_since into v_plan, v_tester from public.billing_profiles where user_id = p_uid;
  v_pay    := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');
  -- Ανυψωμένος βαθμός χωρίς πληρωμή: δοκιμή, δωρεάν μήνες, Συνεργάτης.
  v_charge := not v_pay and v_r >= 1;
  -- `null` = χωρίς μηνιαίο όριο. Ο δοκιμαστής παίρνει το ταβάνι σε κάθε πακέτο.
  v_lim := (v_cap->'scan'->>v_r)::integer;
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
    'pool', v_charge, 'month', v_monc, 'month_limit', v_lim, 'request_id', p_request_id);
end; $$;

revoke all on function public.take_scan_unit(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.take_scan_unit(uuid, uuid, text) to service_role;

comment on function public.take_scan_unit(uuid, uuid, text) is
  'Χρεώνει μία σάρωση πριν από την κλήση στον πάροχο, ή μετρά επανάχρηση του ίδιου αρχείου (έως 3 μέσα σε 5 λεπτά). Όρια μόνο από ai_plan_limits() και το πακέτο· άρνηση χωρίς καμία εγγραφή. Μόνο service_role.';

-- ── 4. Η επιστροφή, ανά κλειδί και μία φορά ──────────────────────────────
create or replace function public.refund_ai_unit(p_uid uuid, p_request_id uuid, p_pool boolean default true)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_req  record;
  v_dayc integer;
  v_monc integer;
begin
  if p_uid is null or p_request_id is null then
    return json_build_object('refunded', false, 'reason', 'uid');
  end if;

  -- Η ΣΗΜΑΙΑ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ. Μόνο η πρώτη κλήση βρίσκει `refunded_at is null`·
  -- η δεύτερη, ταυτόχρονη ή όχι, περιμένει τη γραμμή και δεν βρίσκει τίποτα.
  update public.ai_usage_requests
     set refunded_at = now()
   where request_id = p_request_id and user_id = p_uid and refunded_at is null
  returning kind, period, day, pool, reuse_of into v_req;
  if not found then
    return json_build_object('refunded', false, 'reason',
      case when exists (select 1 from public.ai_usage_requests
                         where request_id = p_request_id and user_id = p_uid)
           then 'already' else 'no_request' end);
  end if;

  -- Η επανάχρηση δεν χρέωσε τίποτα, άρα δεν επιστρέφει τίποτα. Η σημαία
  -- μπήκε όμως, ώστε να μη μετρηθεί ξανά.
  if v_req.reuse_of is not null then
    return json_build_object('refunded', false, 'reason', 'reused');
  end if;

  -- Ο μετρητής του λεπτού δεν επιστρέφεται: είναι φράγμα ρυθμού, όχι πακέτο.
  -- Μειώνεται μόνο ο μετρητής της ΙΔΙΑΣ περιόδου.
  if v_req.kind = 'ai' then
    update public.ai_usage set
      day_count   = case when public.ai_usage.day   = v_req.day    then greatest(public.ai_usage.day_count   - 1, 0) else public.ai_usage.day_count end,
      month_count = case when public.ai_usage.month = v_req.period then greatest(public.ai_usage.month_count - 1, 0) else public.ai_usage.month_count end,
      updated_at  = now()
    where user_id = p_uid
    returning public.ai_usage.day_count, public.ai_usage.month_count into v_dayc, v_monc;
  else
    update public.scan_usage set
      month_count = case when public.scan_usage.month = v_req.period then greatest(public.scan_usage.month_count - 1, 0) else public.scan_usage.month_count end
    where user_id = p_uid
    returning public.scan_usage.month_count into v_monc;
  end if;

  -- Η δεξαμενή πιστώνεται μόνο αν ΑΥΤΟ το αίτημα τη χρέωσε και ο καλών κρίνει
  -- ότι ο πάροχος δεν παρήγαγε tokens (lib/assistant/upstream.ts).
  if p_pool and v_req.pool then
    update public.ai_budget
       set free_count = greatest(public.ai_budget.free_count - 1, 0),
           updated_at = now()
     where month = v_req.period;
  end if;

  return json_build_object('refunded', true, 'kind', v_req.kind, 'pool', p_pool and v_req.pool,
    'day', v_dayc, 'month', v_monc);
end; $$;

revoke all on function public.refund_ai_unit(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.refund_ai_unit(uuid, uuid, boolean) to service_role;

comment on function public.refund_ai_unit(uuid, uuid, boolean) is
  'Γυρίζει ό,τι χρέωσε ένα αίτημα (ερώτηση ή σάρωση), μία φορά ανά κλειδί. Η δεξαμενή μόνο με p_pool = true και μόνο αν χρεώθηκε. Μόνο service_role.';

-- ── 5. Το σκούπισμα του ημερολογίου ──────────────────────────────────────
-- Η επανάχρηση θέλει πέντε λεπτά και η επιστροφή όσο ζει ένα αίτημα. Τριάντα
-- πέντε μέρες κρατούν τον μήνα ολόκληρο για τα ερωτήματα παρακολούθησης.
create or replace function public.prune_ai_usage_requests(p_batch int default 5000)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  delete from public.ai_usage_requests r
   where r.request_id in (
     select request_id from public.ai_usage_requests
      where created_at < now() - interval '35 days'
      limit greatest(p_batch, 1)
        for update skip locked);
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

revoke all on function public.prune_ai_usage_requests(int) from public, anon, authenticated;
grant execute on function public.prune_ai_usage_requests(int) to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το σκούπισμα του ai_usage_requests δεν προγραμματίζεται';
    return;
  end if;
  -- ai-usage-requests-prune: στο λεπτό 23 κάθε ώρας, μακριά από το :00.
  if exists (select 1 from cron.job where jobname = 'ai-usage-requests-prune') then
    perform cron.unschedule('ai-usage-requests-prune');
  end if;
  perform cron.schedule('ai-usage-requests-prune', '23 * * * *', 'select public.prune_ai_usage_requests()');
end $$;

-- ── 6. Οι παλιές υπογραφές, για όσο ανεβαίνει η εφαρμογή ─────────────────
-- ΚΑΝΕΝΑ ΟΡΙΣΜΑ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ. Η εφαρμογή που τρέχει τη στιγμή του deploy
-- στέλνει ακόμη πίνακες ορίων· εδώ αγνοούνται. Κάθε κλήση είναι νέο αίτημα με
-- νέο κλειδί, άρα η άρνηση δεν γράφει τίποτα, όπως στις νέες. Τα δικαιώματα
-- μένουν όπως είναι (μόνο η 8-ορισμάτων στον authenticated) μέχρι να φύγουν.
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
begin
  return public.take_ai_unit(auth.uid(), gen_random_uuid());
end; $$;

comment on function public.bump_ai_usage(integer, integer[], integer[], integer, integer, integer, integer, integer) is
  'ΜΕΤΑΒΑΤΙΚΗ. Περιτύλιγμα της take_ai_unit με auth.uid(): κανένα όρισμα δεν διαβάζεται. Φεύγει μόλις η εφαρμογή καλεί μόνο την take_ai_unit.';

create or replace function public.bump_scan_usage(p_max_min integer, p_month integer[])
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  return public.take_scan_unit(auth.uid(), gen_random_uuid(), null);
end; $$;

comment on function public.bump_scan_usage(integer, integer[]) is
  'ΜΕΤΑΒΑΤΙΚΗ. Περιτύλιγμα της take_scan_unit με auth.uid(): κανένα όρισμα δεν διαβάζεται. Φεύγει μόλις η εφαρμογή καλεί μόνο την take_scan_unit.';

-- ── 7. Το check-in κλειδώνει ─────────────────────────────────────────────
create or replace function public.submit_checkin(p_token text, p_full_name text, p_id_number text, p_nationality text, p_birth_date text, p_phone text, p_email text, p_arrival_date text, p_guests integer, p_accepts boolean, p_privacy_consent boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_link record;
begin
  select id into v_link from checkin_links
   where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return false; end if;
  if coalesce(trim(p_full_name), '') = '' then return false; end if;
  if coalesce(p_privacy_consent, false) = false then return false; end if;

  -- Η ΣΕΙΡΑ. Μετά την αναμονή η γραμμή ξαναδιαβάζεται με το ίδιο κουπόνι: ο
  -- σύνδεσμος μπορεί στο μεταξύ να απενεργοποιήθηκε, να έληξε ή να άλλαξε.
  select * into v_link from checkin_links
   where id = v_link.id and token = p_token
     and active = true and (expires_at is null or expires_at > now())
     for no key update;
  if not found then return false; end if;

  if not allow_public_submit('checkin', p_token, 3, interval '1 hour') then return false; end if;

  insert into guest_checkins(token, user_id, client_id, property_id, full_name, id_number, nationality, birth_date, phone, email, arrival_date, guests_count, accepts_rules, privacy_consent, privacy_consent_at)
    values (p_token, v_link.user_id, v_link.client_id, v_link.property_id, left(p_full_name,160), left(p_id_number,60),
            left(p_nationality,60), nullif(p_birth_date,'')::date, left(p_phone,40), left(p_email,160),
            nullif(p_arrival_date,'')::date, p_guests, coalesce(p_accepts,false), true, now());

  -- Νέα έκδοση της γραμμής: όποια υποβολή περιμένει με παλιά φωτογραφία
  -- (REPEATABLE READ, SERIALIZABLE) παίρνει 40001 αντί να ξεπεράσει το ταβάνι.
  update checkin_links set token = token where id = v_link.id;
  return true;
end; $$;

revoke execute on function public.submit_checkin(text, text, text, text, text, text, text, text, integer, boolean, boolean) from public;
grant  execute on function public.submit_checkin(text, text, text, text, text, text, text, text, integer, boolean, boolean) to anon, authenticated, service_role;
-- Η `allow_public_submit` μένει μόνο του ρόλου υπηρεσίας (20261004100000).
revoke execute on function public.allow_public_submit(text, text, int, interval) from public, anon, authenticated;
grant  execute on function public.allow_public_submit(text, text, int, interval) to service_role;
