-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΕΠΙΣΤΡΟΦΗ ΤΩΝ ΧΡΗΣΤΩΝ ΜΕΤΡΙΕΤΑΙ, ΑΝΑ ΕΒΔΟΜΑΔΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΕΓΚΡΙΣΗ ΙΔΙΟΚΤΗΤΗ, 20/10/2026: σχήμα μέτρησης (δύο συναρτήσεις ανάγνωσης,
-- μόνο για τον διακομιστή). Δεν αλλάζει κανέναν πίνακα δεδομένων χρήστη.
--
-- ΤΙ ΔΕΝ ΞΕΡΑΜΕ. Η αξιολόγηση της 20/10/2026 (πελάτης και αγορά, §6.4) έγραψε:
-- «Χωρίς αποδεδειγμένη διατήρηση πελατών, ακόμη και 300 πελάτες αποτιμώνται στο
-- κάτω άκρο, γιατί ο αγοραστής θα υποθέσει ότι η χρήση γίνεται μόνο τον Ιούνιο».
-- Οι όψεις του scripts/db/product-events.sql δίνουν πρώτη και τελευταία μέρα
-- ανά χρήστη, με το αναγνωριστικό του. Δεν δίνουν ποσοστό ούτε εβδομάδα και
-- τις διαβάζει μόνο όποιος ανοίξει τον SQL Editor.
--
-- ── ΟΙ ΟΡΙΣΜΟΙ ────────────────────────────────────────────────────────────
-- Όλες οι μέρες είναι ημερολογιακές μέρες ώρας Ελλάδας (Europe/Athens).
--
--   ΚΟΟΡΤΗ       οι λογαριασμοί που δημιουργήθηκαν (auth.users.created_at) στην
--                εβδομάδα Δευτέρας–Κυριακής W. Μέρα 0 = η μέρα δημιουργίας.
--   ΕΝΕΡΓΟΣ      τη μέρα d, όταν υπάρχει έστω ένα από:
--                  · γεγονός προϊόντος (product_events, μέσω log_event)·
--                  · γραμμή στο activity_log που έγραψε ο ίδιος·
--                  · σύνδεση (auth.sessions.created_at) ή ανανέωση της
--                    συνεδρίας (auth.sessions.updated_at), δηλαδή άνοιγμα της
--                    εφαρμογής με ενεργή σύνδεση.
--                Η συνεδρία κρατά μόνο την πρώτη και την τελευταία ανανέωσή της
--                και σβήνεται στην αποσύνδεση· τα ποσοστά είναι ΚΑΤΩ ΟΡΙΟ.
--   ΕΝΕΡΓΟΠΟΙΗΘΗΚΕ  έχει έστω ένα ακίνητο (user_properties) ή γεγονός
--                property_added. Το ακίνητο μετρά και όταν φτιάχτηκε πριν
--                αρχίσει η καταγραφή γεγονότων.
--   D1           ενεργός τη μέρα 1.
--   D7           ενεργός μία από τις μέρες 6 έως 8.
--   D30          ενεργός μία από τις μέρες 25 έως 35. ΑΥΤΟ είναι η «επιστροφή
--                στις 30 ημέρες» της αξιολόγησης.
--   ΜΕΤΡΗΣΙΜΟ    ένα Dn μετρά μόνο όταν το παράθυρό του έχει κλείσει (η
--                τελευταία του μέρα είναι πριν από σήμερα). Ο παρονομαστής
--                είναι οι μετρήσιμοι της κοορτής, όχι όλη η κοορτή· αλλιώς
--                η τρέχουσα εβδομάδα θα έδειχνε πάντα 0%.
--   ΣΑΡΩΣΕΙΣ     γεγονότα scan_opened μέσα στην εβδομάδα (όλοι οι χρήστες).
--   ΝΕΟΙ ΠΛΗΡΩΜΕΝΟΙ  χρήστες με subscription_started μέσα στην εβδομάδα (το
--                γράφει μόνο το webhook του εμπόρου, όχι ο περιηγητής).
--   ΠΛΗΡΩΝΟΥΝ ΤΩΡΑ  billing_profiles με συνδρομή εμπόρου σε active ή past_due
--                (ό,τι το lib/billing/subscription.ts κρίνει «ενεργή»).
--
-- Τα ίδια παράθυρα ζουν στο lib/metrics/weekly.ts (RETENTION_WINDOWS) και το
-- lib/metrics/weekly.test.ts κοκκινίζει αν τα δύο αντίγραφα διαφέρουν.
--
-- ── ΤΙ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ ───────────────────────────────────────────────────
-- Μόνο πλήθη ανά εβδομάδα. Κανένα αναγνωριστικό, κανένα email, κανένα όνομα,
-- κανένα ποσό. Οι λογαριασμοί του app_admins (ο ιδιοκτήτης, οι δοκιμές του)
-- βγαίνουν έξω από κάθε μέτρηση, για να μη μετρά ο ιδιοκτήτης τον εαυτό του.
--
-- ── ΠΟΙΟΣ ΤΑ ΔΙΑΒΑΖΕΙ ─────────────────────────────────────────────────────
-- ΜΟΝΟ ο service_role (scripts/metrics-report.ts, npm run metrics:report). Ο
-- περιηγητής δεν έχει δικαίωμα εκτέλεσης: revoke από public, anon και
-- authenticated. Οι συναρτήσεις είναι security definer γιατί διαβάζουν το
-- auth.*, που ο service_role του PostgREST δεν βλέπει απευθείας.
--
-- ── ΕΞΑΡΤΗΣΗ ──────────────────────────────────────────────────────────────
-- Ο πίνακας product_events στήθηκε στην παραγωγή από το
-- scripts/db/product-events.sql (SQL Editor) και μετρήθηκε εκεί στις
-- 19/10/2026. Η plpgsql δεν ελέγχει πίνακες τη στιγμή του create, οπότε η
-- μετανάστευση εφαρμόζεται και σε βάση χωρίς αυτόν· η ΚΛΗΣΗ λέει τότε καθαρά
-- τι λείπει, αντί για ένα σκέτο 42P01.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.metrics_weekly(p_weeks integer default 12)
returns table (
  week_start    date,
  signups       integer,
  activated     integer,
  d1_eligible   integer,
  d1_active     integer,
  d7_eligible   integer,
  d7_active     integer,
  d30_eligible  integer,
  d30_active    integer,
  active_users  integer,
  scans         integer,
  new_paying    integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_weeks integer := greatest(1, least(coalesce(p_weeks, 12), 104));
  v_from  date;
begin
  if to_regclass('public.product_events') is null then
    raise exception 'λείπει ο πίνακας public.product_events (scripts/db/product-events.sql)';
  end if;
  v_from := date_trunc('week', v_today)::date - 7 * (v_weeks - 1);

  return query
  with excluded as (
    select u.id
      from auth.users u
      join public.app_admins a on lower(a.email) = lower(u.email)
  ), people as (
    select u.id as user_id, (u.created_at at time zone 'Europe/Athens')::date as day0
      from auth.users u
     where not exists (select 1 from excluded x where x.id = u.id)
  ), activity as (
    select e.user_id, (e.created_at at time zone 'Europe/Athens')::date as day
      from public.product_events e
    union
    select l.user_id, (l.created_at at time zone 'Europe/Athens')::date
      from public.activity_log l
     where l.actor_id is null or l.actor_id = l.user_id
    union
    select s.user_id, (s.created_at at time zone 'Europe/Athens')::date
      from auth.sessions s
     where s.created_at is not null
    union
    select s.user_id, (s.updated_at at time zone 'Europe/Athens')::date
      from auth.sessions s
     where s.updated_at is not null
  ), cohort as (
    select p.user_id, p.day0,
           date_trunc('week', p.day0)::date as w,
           exists (select 1 from activity a where a.user_id = p.user_id and a.day = p.day0 + 1)                  as d1,
           exists (select 1 from activity a where a.user_id = p.user_id and a.day between p.day0 + 6 and p.day0 + 8)   as d7,
           exists (select 1 from activity a where a.user_id = p.user_id and a.day between p.day0 + 25 and p.day0 + 35) as d30,
           (exists (select 1 from public.user_properties up where up.user_id = p.user_id)
             or exists (select 1 from public.product_events e where e.user_id = p.user_id and e.event = 'property_added')) as act
      from people p
     where p.day0 >= v_from
  ), weeks as (
    select g::date as w
      from generate_series(v_from, date_trunc('week', v_today)::date, interval '7 days') g
  )
  select
    wk.w,
    count(c.user_id)::integer,
    count(c.user_id) filter (where c.act)::integer,
    count(c.user_id) filter (where c.day0 + 1 < v_today)::integer,
    count(c.user_id) filter (where c.day0 + 1 < v_today and c.d1)::integer,
    count(c.user_id) filter (where c.day0 + 8 < v_today)::integer,
    count(c.user_id) filter (where c.day0 + 8 < v_today and c.d7)::integer,
    count(c.user_id) filter (where c.day0 + 35 < v_today)::integer,
    count(c.user_id) filter (where c.day0 + 35 < v_today and c.d30)::integer,
    (select count(distinct a.user_id)
       from activity a
       join people p on p.user_id = a.user_id
      where a.day >= wk.w and a.day < wk.w + 7)::integer,
    (select count(*)
       from public.product_events e
      where e.event = 'scan_opened'
        and (e.created_at at time zone 'Europe/Athens')::date >= wk.w
        and (e.created_at at time zone 'Europe/Athens')::date < wk.w + 7
        and not exists (select 1 from excluded x where x.id = e.user_id))::integer,
    (select count(distinct e.user_id)
       from public.product_events e
      where e.event = 'subscription_started'
        and (e.created_at at time zone 'Europe/Athens')::date >= wk.w
        and (e.created_at at time zone 'Europe/Athens')::date < wk.w + 7
        and not exists (select 1 from excluded x where x.id = e.user_id))::integer
  from weeks wk
  left join cohort c on c.w = wk.w
  group by wk.w
  order by wk.w desc;
end;
$$;

comment on function public.metrics_weekly(integer) is
  'Εβδομαδιαία μέτρηση: εγγραφές, ενεργοποίηση, επιστροφή D1/D7/D30 (μετρήσιμοι και ενεργοί), ενεργοί, σαρώσεις, νέοι πληρωμένοι. Μόνο πλήθη, μόνο service_role. Ορισμοί στη μετανάστευση 20261020150000.';

revoke all on function public.metrics_weekly(integer) from public, anon, authenticated;
grant execute on function public.metrics_weekly(integer) to service_role;

-- ── Η ΣΤΙΓΜΗ: ΠΟΣΟΙ ΕΙΜΑΣΤΕ ΣΗΜΕΡΑ ──────────────────────────────────────────
-- Τα ίδια φίλτρα και οι ίδιοι ορισμοί, μία γραμμή, για την κεφαλίδα της αναφοράς.
create or replace function public.metrics_snapshot()
returns table (
  users        integer,
  activated    integer,
  active_7d    integer,
  active_30d   integer,
  paying_now   integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Europe/Athens')::date;
begin
  if to_regclass('public.product_events') is null then
    raise exception 'λείπει ο πίνακας public.product_events (scripts/db/product-events.sql)';
  end if;

  return query
  with excluded as (
    select u.id
      from auth.users u
      join public.app_admins a on lower(a.email) = lower(u.email)
  ), people as (
    select u.id as user_id
      from auth.users u
     where not exists (select 1 from excluded x where x.id = u.id)
  ), activity as (
    select e.user_id, (e.created_at at time zone 'Europe/Athens')::date as day
      from public.product_events e
    union
    select l.user_id, (l.created_at at time zone 'Europe/Athens')::date
      from public.activity_log l
     where l.actor_id is null or l.actor_id = l.user_id
    union
    select s.user_id, (s.created_at at time zone 'Europe/Athens')::date
      from auth.sessions s
     where s.created_at is not null
    union
    select s.user_id, (s.updated_at at time zone 'Europe/Athens')::date
      from auth.sessions s
     where s.updated_at is not null
  )
  select
    (select count(*) from people)::integer,
    (select count(*) from people p
      where exists (select 1 from public.user_properties up where up.user_id = p.user_id)
         or exists (select 1 from public.product_events e where e.user_id = p.user_id and e.event = 'property_added'))::integer,
    (select count(distinct a.user_id) from activity a join people p on p.user_id = a.user_id
      where a.day > v_today - 7)::integer,
    (select count(distinct a.user_id) from activity a join people p on p.user_id = a.user_id
      where a.day > v_today - 30)::integer,
    (select count(*) from public.billing_profiles b join people p on p.user_id = b.user_id
      where b.mor_subscription_id is not null
        and b.subscription_status in ('active', 'past_due'))::integer;
end;
$$;

comment on function public.metrics_snapshot() is
  'Η μέτρηση της ημέρας: χρήστες, ενεργοποιημένοι, ενεργοί 7 και 30 ημερών, πληρώνουν τώρα. Μόνο πλήθη, μόνο service_role.';

revoke all on function public.metrics_snapshot() from public, anon, authenticated;
grant execute on function public.metrics_snapshot() to service_role;
