-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΧΩΝΙ ΤΩΝ ΠΕΝΤΕ ΒΗΜΑΤΩΝ: ΕΠΙΣΚΕΨΗ → ΕΓΓΡΑΦΗ → ΑΚΙΝΗΤΟ → ΥΠΕΝΘΥΜΙΣΗ → «ΠΛΗΡΩΣΑ»
-- ─────────────────────────────────────────────────────────────────────────
-- ΕΓΚΡΙΣΗ ΙΔΙΟΚΤΗΤΗ, 30/10/2026: «εκτέλεσέ το και πέρνα το παραγωγή». Μία
-- συνάρτηση ανάγνωσης, μόνο για τον διακομιστή. Δεν αλλάζει κανέναν πίνακα.
--
-- ΤΙ ΔΕΝ ΞΕΡΑΜΕ. Η metrics_weekly (20261020150000) λέει πόσοι γράφτηκαν και
-- πόσοι έβαλαν ακίνητο. Δεν λέει αν η αξία του προϊόντος έφτασε ποτέ σε
-- κάποιον: αν του ήρθε υπενθύμιση και αν πάτησε «Πλήρωσα». Χωρίς αυτά τα δύο
-- σκαλιά, μια εβδομάδα με τρεις εγγραφές και τρία ακίνητα μοιάζει επιτυχία
-- ακόμη κι αν κανείς δεν ξαναγύρισε ποτέ.
--
-- ── ΟΙ ΟΡΙΣΜΟΙ ────────────────────────────────────────────────────────────
-- Εβδομάδα Δευτέρας–Κυριακής, ώρα Ελλάδας (Europe/Athens), όπως η metrics_weekly.
--
--   ΕΠΙΣΚΕΨΕΙΣ   ανοίγματα της σελίδας εγγραφής μέσα στην εβδομάδα: άθροισμα
--                του signup_funnel στο βήμα 'view' (ανώνυμοι μετρητές, κανένας
--                επισκέπτης δεν ξεχωρίζει). Δεν είναι επισκέψεις όλου του site·
--                αυτές τις μετρά το Vercel Analytics, χωρίς ταυτότητα.
--   ΕΓΓΡΑΦΕΣ     λογαριασμοί που δημιουργήθηκαν μέσα στην εβδομάδα
--                (auth.users.created_at). Αυτή είναι η κοόρτη· τα επόμενα τρία
--                σκαλιά μετρούν ΑΥΤΟΥΣ τους λογαριασμούς, ως σήμερα.
--   ΜΕ ΑΚΙΝΗΤΟ   έχουν ακίνητο (user_properties) ή γεγονός property_added.
--   ΜΕ ΥΠΕΝΘΥΜΙΣΗ  τους στάλθηκε έστω μία υπενθύμιση (notification_log, που
--                γράφει η send-reminders για κάθε αποστολή).
--   «ΠΛΗΡΩΣΑ»    σημείωσαν έστω μία προθεσμία ως πληρωμένη: γεγονός
--                paid_marked (από την υπενθύμιση ή από την εφαρμογή) ή
--                διακριτικό υπενθύμισης που χρησιμοποιήθηκε και δεν αναιρέθηκε.
--                Τα διακριτικά σβήνονται όταν λήξουν, γι' αυτό από 31/10/2026
--                γράφεται και το γεγονός· πριν από αυτό το νούμερο είναι κάτω όριο.
--
-- ── ΤΙ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ ───────────────────────────────────────────────────
-- Μόνο πλήθη ανά εβδομάδα. Κανένα αναγνωριστικό, κανένα email, κανένα ποσό.
-- Οι λογαριασμοί του app_admins βγαίνουν έξω, όπως στη metrics_weekly.
--
-- ── ΠΟΙΟΣ ΤΑ ΔΙΑΒΑΖΕΙ ─────────────────────────────────────────────────────
-- ΜΟΝΟ ο service_role (npm run metrics:report). Ο περιηγητής δεν έχει
-- δικαίωμα εκτέλεσης. Security definer γιατί διαβάζει το auth.users.
--
-- ── ΕΞΑΡΤΗΣΕΙΣ ────────────────────────────────────────────────────────────
-- product_events (20261020170000), signup_funnel (20260930140000),
-- notification_log (baseline), reminder_pay_tokens (20261029120000). Η plpgsql
-- δεν ελέγχει πίνακες τη στιγμή του create· η ΚΛΗΣΗ λέει καθαρά τι λείπει.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.metrics_funnel(p_weeks integer default 12)
returns table (
  week_start     date,
  visits         integer,
  signups        integer,
  with_property  integer,
  reminded       integer,
  paid_marked    integer
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
    raise exception 'λείπει ο πίνακας public.product_events (20261020170000)';
  end if;
  if to_regclass('public.signup_funnel') is null then
    raise exception 'λείπει ο πίνακας public.signup_funnel (20260930140000)';
  end if;
  if to_regclass('public.reminder_pay_tokens') is null then
    raise exception 'λείπει ο πίνακας public.reminder_pay_tokens (20261029120000)';
  end if;
  v_from := date_trunc('week', v_today)::date - 7 * (v_weeks - 1);

  return query
  with excluded as (
    select u.id
      from auth.users u
      join public.app_admins a on lower(a.email) = lower(u.email)
  ), cohort as (
    select u.id as user_id,
           date_trunc('week', (u.created_at at time zone 'Europe/Athens')::date)::date as w
      from auth.users u
     where (u.created_at at time zone 'Europe/Athens')::date >= v_from
       and not exists (select 1 from excluded x where x.id = u.id)
  ), steps as (
    select c.user_id, c.w,
           (exists (select 1 from public.user_properties up where up.user_id = c.user_id)
             or exists (select 1 from public.product_events e where e.user_id = c.user_id and e.event = 'property_added')) as has_property,
           exists (select 1 from public.notification_log n where n.user_id = c.user_id) as was_reminded,
           (exists (select 1 from public.product_events e where e.user_id = c.user_id and e.event = 'paid_marked')
             or exists (select 1 from public.reminder_pay_tokens t
                         where t.user_id = c.user_id and t.used_at is not null and t.undone_at is null)) as has_paid
      from cohort c
  ), weeks as (
    select g::date as w
      from generate_series(v_from, date_trunc('week', v_today)::date, interval '7 days') g
  )
  select
    wk.w,
    (select coalesce(sum(f.n), 0)
       from public.signup_funnel f
      where f.step = 'view' and f.day >= wk.w and f.day < wk.w + 7)::integer,
    count(s.user_id)::integer,
    count(s.user_id) filter (where s.has_property)::integer,
    count(s.user_id) filter (where s.was_reminded)::integer,
    count(s.user_id) filter (where s.has_paid)::integer
  from weeks wk
  left join steps s on s.w = wk.w
  group by wk.w
  order by wk.w desc;
end;
$$;

comment on function public.metrics_funnel(integer) is
  'Χωνί ανά εβδομάδα: επισκέψεις σελίδας εγγραφής και εγγραφές· από αυτούς πόσοι έχουν ακίνητο, με υπενθύμιση, με «Πλήρωσα». Μόνο πλήθη, μόνο service_role. Ορισμοί στη μετανάστευση 20261031100000.';

revoke all on function public.metrics_funnel(integer) from public, anon, authenticated;
grant execute on function public.metrics_funnel(integer) to service_role;
