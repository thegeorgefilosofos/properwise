-- ═══════════════════════════════════════════════════════════════════════════
-- Ο «ΙΔΙΟΚΤΗΤΗΣ» ΔΩΡΕΑΝ, Η ΝΟΑ ΣΤΑ 4,99 €, Η ΣΑΡΩΣΗ ΜΕ ΔΙΚΟ ΤΗΣ ΜΕΤΡΗΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ ΤΗΣ ΑΛΛΑΓΗΣ. Απόφαση ιδιοκτήτη (25.09.2026):
--   · η βαθμίδα `free` (βαθμός 0) γίνεται το δωρεάν πακέτο «Ιδιοκτήτης»: ένα
--     ακίνητο, όλα τα φορολογικά, ΧΩΡΙΣ τη Νόα, πέντε σαρώσεις τον μήνα·
--   · η `solo` (βαθμός 1) γίνεται «Ιδιοκτήτης με Νόα», 4,99 € / 54,90 €, με
--     30 ερωτήσεις και σάρωση χωρίς όριο·
--   · τα μεγαλύτερα πακέτα κρατούν τις ερωτήσεις τους και παίρνουν σάρωση
--     χωρίς όριο.
-- Τα αναγνωριστικά και οι βαθμοί ΔΕΝ αλλάζουν, άρα καμία γραμμή δεν μεταπίπτει.
--
-- ΤΕΣΣΕΡΑ ΣΗΜΕΙΑ ΤΗΣ ΒΑΣΗΣ ΑΚΟΛΟΥΘΟΥΝ:
--   1. `plan_price`: η νέα τιμή, για την προαναγγελία χρέωσης (το db-replay
--      τη συγκρίνει με το PLANS).
--   2. `bump_ai_usage`: πακέτο με μηδέν ερωτήσεις αρνείται ΠΡΙΝ μετρήσει.
--   3. `scan_usage` και `bump_scan_usage`: η σάρωση δεν τρώει πια ερωτήσεις
--      της Νόας· έχει δικό της μηνιαίο μετρητή (όριο ανά βαθμό, `null` =
--      χωρίς όριο) και το ίδιο φράγμα ανά λεπτό με τη Νόα, κατά των σεναρίων.
--   4. Η πύλη του λογιστή (`get_accountant_data`,
--      `accountant_clients_overview`) ζητούσε βαθμό 1· ο δωρεάν «Ιδιοκτήτης»
--      έχει το Ε2, άρα και την πύλη.
--
-- ΚΑΙ Η ΑΥΤΟΜΑΤΗ ΔΙΑΓΡΑΦΗ ΣΤΑΜΑΤΑ. Η `sweep_and_purge_lapsed` έσβηνε μετά από
-- τριάντα ημέρες κάθε λογαριασμό βαθμού 0, όταν ανοίξει η χρέωση, γιατί ο
-- βαθμός 0 σήμαινε «χωρίς συνδρομή». Πλέον σημαίνει δωρεάν πακέτο: με το
-- χρονόμετρο ενεργό, την ημέρα που ανοίγει το ταμείο θα άρχιζε η διαγραφή
-- κάθε δωρεάν χρήστη. Το χρονόμετρο αφαιρείται· οι συναρτήσεις μένουν, για
-- μια μελλοντική πολιτική αδράνειας που θα αποφασίσει ο ιδιοκτήτης.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η ΤΙΜΗ ─────────────────────────────────────────────────────────────
create or replace function public.plan_price(p_plan text, p_cycle text)
returns numeric language sql immutable
set search_path = public
as $$
  select case
    when p_cycle = 'annual' then
      case p_plan
        when 'solo'   then 54.90
        when 'owner'  then 99.00
        when 'agency' then 299.00
        when 'office' then 799.00
        else 0
      end
    else
      case p_plan
        when 'solo'   then 4.99
        when 'owner'  then 9.90
        when 'agency' then 29.90
        when 'office' then 79.90
        else 0
      end
  end
$$;

comment on function public.plan_price(text, text) is
  'Η τιμή ενός πακέτου ανά κύκλο, σε ευρώ. Ταυτόσημη με το PLANS του lib/billing/plans.ts· το db-replay τις αντιπαραβάλλει και οι δύο πλευρές.';

-- ── 2. ΚΑΜΙΑ ΜΟΝΑΔΑ ΑΠΟ ΤΗ ΔΕΞΑΜΕΝΗ ΓΙΑ ΠΑΚΕΤΟ ΧΩΡΙΣ ΝΟΑ ─────────────────
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
  v_plan   text;
  v_tester timestamptz;
  v_pay    boolean;
  v_rank   integer;
  v_lday   integer;
  v_lmon   integer;
  v_minc   integer;
  v_dayc   integer;
  v_monc   integer;
  v_pool   integer := 0;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;

  v_rank := coalesce(public.user_plan_rank(v_uid), 0);
  v_lday := coalesce(p_day[v_rank + 1],   p_day[1]);
  v_lmon := coalesce(p_month[v_rank + 1], p_month[1]);

  -- «Πληρώνει» σημαίνει ΠΡΑΓΜΑΤΙΚΗ συνδρομή, όχι ανυψωμένο επίπεδο. Δοκιμή,
  -- δωρεάν μήνες και Συνεργάτες κοστίζουν από την ίδια τσέπη με τη δεξαμενή.
  -- Η λίστα διαβάζεται ΑΠΟ ΤΑ ΠΑΚΕΤΑ ΠΟΥ ΧΡΕΩΝΟΝΤΑΙ: αν προστεθεί πακέτο και
  -- ξεχαστεί εδώ, ο συνδρομητής του θα μετράει ως δωρεάν.
  select plan, tester_since into v_plan, v_tester
    from public.billing_profiles where user_id = v_uid;
  v_pay := coalesce(v_plan, 'free') in ('solo', 'owner', 'agency', 'office');

  -- ΤΟ ΠΑΚΕΤΟ ΕΡΩΤΗΣΕΩΝ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΠΛΗΡΩΜΗ, ΟΧΙ ΤΟ ΕΠΙΠΕΔΟ. Το `least`
  -- σημαίνει ότι ο μη πληρώνων δεν παίρνει ΠΟΤΕ περισσότερα από το δοκιμαστικό
  -- πακέτο, όσο ψηλά κι αν τον ανεβάσει δοκιμή, δώρο ή ιδιότητα.
  if not v_pay and p_trial_day is not null then
    v_lday := least(v_lday, p_trial_day);
    v_lmon := least(v_lmon, p_trial_month);
  end if;

  -- Ο ΔΟΚΙΜΑΣΤΗΣ ΚΟΒΕΤΑΙ ΤΕΛΕΥΤΑΙΟΣ, ΩΣΤΕ ΝΑ ΚΟΒΕΙ ΚΑΙ ΤΟΝ ΠΛΗΡΩΜΕΝΟ. Είναι
  -- η ΜΟΝΗ περίπτωση όπου το ταβάνι πέφτει πάνω σε λογαριασμό που δείχνει
  -- συνδρομητής: το πακέτο του είναι αληθινό, η πληρωμή δεν είναι.
  if v_tester is not null and p_tester_month is not null then
    v_lday := least(v_lday, p_tester_day);
    v_lmon := least(v_lmon, p_tester_month);
  end if;

  -- ΤΟ ΠΑΚΕΤΟ ΧΩΡΙΣ ΝΟΑ ΣΤΑΜΑΤΑ ΕΔΩ, ΠΡΙΝ ΜΕΤΡΗΘΕΙ ΟΤΙΔΗΠΟΤΕ. Ο δωρεάν
  -- «Ιδιοκτήτης» έχει μηδέν ερωτήσεις (25.09.2026). Αν η άρνηση ερχόταν μετά
  -- την αύξηση, κάθε άρνηση θα έτρωγε μία μονάδα από την κοινή δεξαμενή που
  -- μοιράζονται οι δοκιμές, χωρίς να δοθεί ποτέ απάντηση.
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

  -- Σειρά ελέγχων: από το πιο «μόνιμο» προς το πιο πρόσκαιρο, ώστε το μήνυμα
  -- που βλέπει ο χρήστης να λέει την πραγματική αιτία και όχι μια παροδική.
  if not v_pay and p_pool is not null and v_pool > p_pool then
    return json_build_object('allowed', false, 'reason', 'pool', 'rank', v_rank);
  end if;
  if v_monc > v_lmon then
    return json_build_object('allowed', false, 'reason', 'month', 'rank', v_rank);
  end if;
  if v_dayc > v_lday then
    return json_build_object('allowed', false, 'reason', 'day', 'rank', v_rank);
  end if;
  if v_minc > p_max_min then
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;

  return json_build_object(
    'allowed', true, 'rank', v_rank, 'paying', v_pay,
    'tester', v_tester is not null,
    'minute', v_minc, 'day', v_dayc, 'month', v_monc,
    'day_limit', v_lday, 'month_limit', v_lmon
  );
end; $$;

revoke all on function public.bump_ai_usage(integer, integer[], integer[], integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.bump_ai_usage(integer, integer[], integer[], integer, integer, integer, integer, integer) to authenticated;

-- ── 3. Ο ΜΕΤΡΗΤΗΣ ΤΗΣ ΣΑΡΩΣΗΣ ─────────────────────────────────────────────
create table if not exists public.scan_usage (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  minute_bucket timestamptz not null,
  minute_count  integer     not null default 0,
  month         date        not null,
  month_count   integer     not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.scan_usage enable row level security;
-- Όπως κάθε πίνακας με updated_at: τη γράφει η βάση, όχι ο καλών
-- (μετάβαση 20260819170000).
drop trigger if exists scan_usage_updated_at on public.scan_usage;
create trigger scan_usage_updated_at before update on public.scan_usage
  for each row execute function public.update_updated_at_column();
-- Μόνο οι SECURITY DEFINER συναρτήσεις από κάτω αγγίζουν τον πίνακα.
revoke all on table public.scan_usage from anon, authenticated;

create or replace function public.bump_scan_usage(p_max_min integer, p_month integer[])
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid  uuid        := auth.uid();
  v_now  timestamptz := now();
  v_min  timestamptz := date_trunc('minute', v_now);
  v_mon  date        := date_trunc('month', (v_now at time zone 'Europe/Athens'))::date;
  v_rank integer;
  v_lim  integer;
  v_minc integer;
  v_monc integer;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'reason', 'auth');
  end if;
  v_rank := coalesce(public.user_plan_rank(v_uid), 0);
  -- `null` στη θέση του βαθμού = χωρίς μηνιαίο όριο. Αγνωστος βαθμός πέφτει
  -- στο όριο του βαθμού 0, όπως και στη `bump_ai_usage`.
  if array_length(p_month, 1) >= v_rank + 1 then
    v_lim := p_month[v_rank + 1];
  else
    v_lim := p_month[1];
  end if;

  insert into public.scan_usage (user_id, minute_bucket, minute_count, month, month_count, updated_at)
    values (v_uid, v_min, 1, v_mon, 1, v_now)
  on conflict (user_id) do update set
    minute_count  = case when public.scan_usage.minute_bucket = v_min then public.scan_usage.minute_count + 1 else 1 end,
    minute_bucket = v_min,
    month_count   = case when public.scan_usage.month = v_mon then public.scan_usage.month_count + 1 else 1 end,
    month         = v_mon,
    updated_at    = v_now
  returning minute_count, month_count into v_minc, v_monc;

  -- Η ΑΡΝΗΣΗ ΔΕΝ ΜΕΤΡΑ. Η σάρωση που κόπηκε δεν έγινε, οπότε ο μηνιαίος
  -- μετρητής γυρίζει εκεί που ήταν· αλλιώς μια επιστροφή αργότερα θα έπεφτε
  -- πάνω σε αρνήσεις και δεν θα ελευθέρωνε θέση. Το λεπτό μένει μετρημένο:
  -- είναι φράγμα ρυθμού, όχι πακέτο.
  if v_lim is not null and v_monc > v_lim then
    update public.scan_usage set month_count = month_count - 1 where user_id = v_uid;
    return json_build_object('allowed', false, 'reason', 'scan_month', 'rank', v_rank,
      'month', v_monc - 1, 'month_limit', v_lim);
  end if;
  if v_minc > p_max_min then
    return json_build_object('allowed', false, 'reason', 'minute', 'rank', v_rank);
  end if;
  return json_build_object('allowed', true, 'rank', v_rank, 'month', v_monc, 'month_limit', v_lim);
end; $$;

revoke all on function public.bump_scan_usage(integer, integer[]) from public, anon;
grant execute on function public.bump_scan_usage(integer, integer[]) to authenticated;

-- Η σάρωση που δεν απαντήθηκε (σφάλμα παρόχου, λήξη χρόνου) επιστρέφεται,
-- όπως και η ερώτηση της Νόας: ο χρήστης δεν χάνει μία από τις πέντε για
-- αποτυχία που δεν ήταν δική του.
--
-- ΜΟΝΟ Ο service_role, ΜΕ ΡΗΤΟ ΧΡΗΣΤΗ. Η συνάρτηση ΜΕΙΩΝΕΙ: αν την είχε ο
-- `authenticated`, ο καθένας θα σάρωνε και αμέσως μετά θα την καλούσε για να
-- μηδενίσει το μηνιαίο όριο. Ιδιος λόγος με τη `refund_ai_usage`
-- (20260907180000).
create or replace function public.refund_scan_usage(p_uid uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_monc integer;
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
  return json_build_object('refunded', true, 'month', v_monc);
end; $$;

revoke all on function public.refund_scan_usage(uuid) from public, anon, authenticated;
grant execute on function public.refund_scan_usage(uuid) to service_role;

comment on table public.scan_usage is
  'Μετρητής σαρώσεων ανά χρήστη (λεπτό, μήνας). Τον αγγίζουν μόνο η bump_scan_usage (χρήστης) και η refund_scan_usage (μόνο service_role). Τα όρια ανά βαθμό τα δίνει η εφαρμογή (SCAN_LIMITS, lib/billing/aiLimits.ts).';

-- ── 4. Η ΠΥΛΗ ΤΟΥ ΛΟΓΙΣΤΗ ΓΙΑ ΤΟΝ ΔΩΡΕΑΝ «ΙΔΙΟΚΤΗΤΗ» ───────────────────────
create or replace function public.get_accountant_data(p_token text, p_year integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_link record; v_props json; v_owner text;
begin
  select * into v_link from accountant_links where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  -- Η ΚΛΕΙΔΑΡΙΑ. Βαθμός 1 = πακέτο «Ενα ακίνητο», δηλαδή ακριβώς το κατώφλι
  -- του `e2_export`. Ελέγχεται σε ΚΑΘΕ άνοιγμα, όχι μόνο στην έκδοση.
  -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ: ο δωρεάν «Ιδιοκτήτης» έχει το Ε2 και την πύλη.
  select coalesce(nullif(trim(owner_name), ''), full_name) into v_owner from billing_profiles where user_id = v_link.user_id;
  select json_agg(sub.row) into v_props from (
    select json_build_object(
      'name', p.name, 'atak', p.atak, 'address', p.address, 'prop_type', p.prop_type,
      -- ΤΑ ΔΥΟ ΠΟΥ ΖΗΤΑ ΤΟ ΕΝΤΥΠΟ. Στοιχεία του ακινήτου, όχι τρίτων.
      'sqm', p.sqm,
      'ownership', p.ownership,
      -- ΤΟ ΕΝΟΙΚΙΟ ΤΟΥ ΕΤΟΥΣ. Ιδια πηγή και ίδιο φίλτρο με το Ε2: όλες οι
      -- περίοδοι της χρήσης, ανεξάρτητα από την είσπραξη (δεδουλευμένα).
      'rent_collected', coalesce((
        select sum(rp.amount) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
      ), 0),
      -- Σε πόσες καταχωρημένες περιόδους βασίζεται. Χωρίς αυτό, το «0 €» δεν
      -- ξεχωρίζει από το «δεν καταχωρήθηκε τίποτα».
      'rent_months', coalesce((
        select count(*) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
      ), 0),
      -- Συμφραζόμενο, ΟΧΙ έσοδο: τι νοικιάζεται σήμερα.
      'rent_monthly', (
        select t.monthly_rent from tenants t where t.id = public.current_tenant_of(p.id)
      ),
      'expenses', coalesce((
        select json_agg(json_build_object('category', e.category, 'amount', e.amount, 'date', e.date))
        from expenses e
        where e.property_id = p.id and e.user_id = v_link.user_id and extract(year from e.date) = p_year
      ), '[]'::json),
      -- Η ΑΝΑΛΥΣΗ, ΟΧΙ ΜΟΝΟ ΤΟ ΣΥΝΟΛΟ. Χωρίς αυτά τα τέσσερα πεδία η οθόνη δεν
      -- μπορεί να ξεχωρίσει ακαθάριστο από payout, ούτε να βγάλει έξω το τέλος
      -- ανθεκτικότητας — δηλαδή δεν μπορεί να συμφωνήσει με το έντυπο.
      'stays', coalesce((
        select json_agg(json_build_object(
          'check_in', s.check_in, 'check_out', s.check_out, 'nights', s.nights,
          'total', s.total,
          'gross_guest_paid', s.gross_guest_paid,
          'climate_levy', s.climate_levy,
          'platform_fee', s.platform_fee,
          'amount_basis', s.amount_basis))
        from client_stays s
        where s.property_id = p.id and s.user_id = v_link.user_id
          and extract(year from coalesce(s.check_in, s.check_out)) = p_year
      ), '[]'::json)
    ) as row
    from user_properties p where p.user_id = v_link.user_id order by p.name
  ) sub;
  return json_build_object('owner', v_owner, 'year', p_year, 'properties', coalesce(v_props, '[]'::json));
end; $function$;

comment on function public.get_accountant_data(text, integer) is
  'Η εικόνα της χρήσης για τον λογιστή. Επιστρέφει null αν ο σύνδεσμος δεν '
  'είναι ενεργός. Από 25.09.2026 δεν ζητά πακέτο: ο δωρεάν «Ιδιοκτήτης» έχει το Ε2. '
  'Οι διαμονές δίνονται με την ανάλυση ποσού τους, ώστε η οθόνη να εφαρμόσει τον '
  'ΙΔΙΟ κανόνα δηλωτέου ακαθάριστου με το Ε2 (lib/clients/stayAmounts.ts). Καμία '
  'ταυτότητα τρίτου: ούτε μισθωτής, ούτε προμηθευτής, ούτε επισκέπτης.';

create or replace function public.accountant_clients_overview(p_year integer)
returns json
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_rows json;
begin
  if v_me is null then return '[]'::json; end if;

  select coalesce(json_agg(r order by r->>'name'), '[]'::json) into v_rows from (
    select json_build_object(
      'ownerId',      ac.owner_id,
      'name',         coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ιδιοκτήτης'),
      'afm',          bp.afm,
      'linkedAt',     ac.linked_at,
      'token',        (select al.token from accountant_links al
                        where al.user_id = ac.owner_id
                          and coalesce(al.active, true)
                          and (al.expires_at is null or al.expires_at > now())
                        limit 1),
      -- ΠΟΤΕ ΚΙΝΗΘΗΚΕ ΤΕΛΕΥΤΑΙΑ ΦΟΡΑ Ο ΦΑΚΕΛΟΣ. Ολες οι πηγές μαζί, γιατί
      -- «ενημερωμένος» σημαίνει ότι κάτι μπήκε, όχι ότι μπήκε δαπάνη.
      'lastActivity', (
        select max(t) from (
          select max(e.created_at) as t from expenses e where e.user_id = ac.owner_id
          union all
          select max(rp.created_at) from rent_payments rp where rp.user_id = ac.owner_id
          union all
          select max(s.created_at) from client_stays s where s.user_id = ac.owner_id
          union all
          select max(d.created_at) from property_documents d where d.user_id = ac.owner_id
        ) moves
      ),
      -- ΤΑ ΑΙΤΗΜΑΤΑ ΟΛΟΚΛΗΡΑ, ΟΧΙ ΣΕ ΠΛΗΘΟΣ. Ενας αριθμός δεν λέει ούτε τι
      -- ζητήθηκε ούτε πότε, ούτε επιτρέπει να παρθεί πίσω.
      'requests', coalesce((
        select json_agg(json_build_object(
          'id', ar.id, 'item', ar.item, 'note', ar.note, 'createdAt', ar.created_at
        ) order by ar.created_at)
        from accountant_requests ar
        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open'
      ), '[]'::json),
      'properties',   (select count(*) from user_properties up where up.user_id = ac.owner_id),
      'expenses',     (select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year),
      'uncategorised',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.category), ''), '') = ''),
      'noSupplierAfm',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.supplier_afm), ''), '') = ''),
      'rentsUnpaid',  (select count(*) from rent_payments rp
                        where rp.user_id = ac.owner_id and rp.period_year = p_year and rp.paid is not true),
      'stays',        (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year),
      'staysNoFee',   (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year
                          and s.channel in ('airbnb', 'booking')
                          and coalesce(s.platform_fee, 0) <= 0),
      'openRequests', (select count(*) from accountant_requests ar
                        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open')
    ) as r
    from accountant_clients ac
    left join billing_profiles bp on bp.user_id = ac.owner_id
    -- Η αξίωση ισχύει μόνο όσο το token με το οποίο δόθηκε είναι ακόμη ο
    -- ενεργός σύνδεσμος του ιδιοκτήτη (20260818090000).
    where ac.accountant_id = v_me
      and public.accountant_link_live(v_me, ac.owner_id)
      -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗΣ `get_accountant_data`: ο
      -- δωρεάν «Ιδιοκτήτης» στέλνει κι αυτός τον φάκελο στον λογιστή του.
  ) sub;

  return v_rows;
end;
$$;

alter function public.accountant_clients_overview(integer) owner to postgres;
revoke all    on function public.accountant_clients_overview(integer) from public, anon;
grant execute on function public.accountant_clients_overview(integer) to authenticated;

comment on function public.accountant_clients_overview(integer) is
  'Οι πελάτες του λογιστή για μια χρήση: οι μετρητές που δείχνουν τι λείπει, το τρέχον αναγνωριστικό της κατάστασης, πότε κινήθηκε τελευταία φορά ο φάκελος και τα ανοιχτά αιτήματα ολόκληρα.';

-- ── 5. ΤΟ ΧΡΟΝΟΜΕΤΡΟ ΤΗΣ ΔΙΑΓΡΑΦΗΣ ΦΕΥΓΕΙ ────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'sweep-lapsed-daily') then
    perform cron.unschedule('sweep-lapsed-daily');
  end if;
end $$;
