-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΕΠΙΤΟΚΙΑ ΕΛΕΓΧΟΝΤΑΙ ΜΙΑ ΦΟΡΑ ΤΗΝ ΕΒΔΟΜΑΔΑ, ΟΧΙ ΚΑΘΕ ΜΕΡΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ (28.09.2026): «τους πόρους του παρόχου AI με πολύ
-- οικονομία». Η τροφοδοσία επιτοκίων είναι η μεγαλύτερη σταθερή δαπάνη του:
-- κάθε πέρασμα ψάχνει στο web έξι τράπεζες. Οι τράπεζες όμως αλλάζουν τα
-- δελτία τους λίγες φορές τον χρόνο (δελτία με ημερομηνία ισχύος 27.07.2026,
-- 20.02.2026, 24.11.2025 στις επίσημες σελίδες τους). Ενα πέρασμα την εβδομάδα
-- κόβει τη δαπάνη κατά περίπου 86% και αργεί το πολύ επτά μέρες να δει αλλαγή.
--
-- ΤΙ ΑΛΛΑΖΕΙ:
--   1. Η εργασία `bank-rates-daily` τρέχει τη Δευτέρα 05:30 UTC. Με
--      `cron.alter_job`: η εντολή και τα μυστικά της δεν ξαναγράφονται. Το
--      όνομα μένει, γιατί το διαβάζουν οι φύλακες και το ιστορικό.
--   2. Η `bank_feed_health()` θεωρεί σιωπή τις 8 ημέρες και 8 ώρες (200 ώρες)
--      αντί για 48 ώρες, αλλιώς θα κοκκίνιζε κάθε Τετάρτη. Οι κρατημένες
--      προτάσεις μετρούν 10 ημέρες πίσω, όσο και το παράθυρο δεύτερης
--      επιβεβαίωσης της συνάρτησης (bank-rates-updater).
--
-- Ιδιο σώμα με τη 20260902120000 κατά τα άλλα.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname = 'bank-rates-daily';
  if j is not null then
    perform cron.alter_job(j, schedule := '30 5 * * 1');
  end if;
end $$;

create or replace function public.bank_feed_health()
returns table (
  ok            boolean,
  reason        text,
  last_check    timestamptz,
  last_ok       timestamptz,
  hours_silent  numeric,
  verified_at   date,
  held_changes  integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with latest as (
    select ran_at, ok, reason from public.bank_rate_checks order by ran_at desc limit 1
  ), last_good as (
    select ran_at from public.bank_rate_checks where ok order by ran_at desc limit 1
  ), m as (
    select
      l.ran_at as last_check,
      l.ok     as last_ok_flag,
      l.reason as last_reason,
      g.ran_at as last_ok,
      round(extract(epoch from (now() - l.ran_at)) / 3600.0, 1) as hours_silent,
      (select min(verified_at) from public.bank_rates where is_active) as verified_at,
      (select count(*)::int from public.bank_rate_changes c
        where not c.applied and c.ran_at > now() - interval '10 days') as held
    from latest l left join last_good g on true
  )
  select
    case when m.last_check is null then false
         when m.hours_silent > 200 then false
         when not m.last_ok_flag then false
         else true end,
    case when m.last_check is null then 'καμία εκτέλεση της τροφοδοσίας επιτοκίων'
         when m.hours_silent > 200 then 'η εργασία δεν έτρεξε: ' || m.hours_silent || ' ώρες σιωπής'
         when not m.last_ok_flag then 'το τελευταίο πέρασμα απέτυχε: ' || m.last_reason
         else 'εντάξει' end,
    m.last_check, m.last_ok, m.hours_silent, m.verified_at, m.held
  from m
  union all
  select false, 'καμία εκτέλεση της τροφοδοσίας επιτοκίων', null::timestamptz, null::timestamptz, null::numeric,
         (select min(verified_at) from public.bank_rates where is_active), 0
   where not exists (select 1 from public.bank_rate_checks);
$$;
