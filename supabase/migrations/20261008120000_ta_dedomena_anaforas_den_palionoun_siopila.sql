-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΔΕΔΟΜΕΝΑ ΑΝΑΦΟΡΑΣ ΔΕΝ ΠΑΛΙΩΝΟΥΝ ΣΙΩΠΗΛΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΗ ΔΙΑΔΡΟΜΗ. Μία νέα συνάρτηση ανάγνωσης, τίποτα
-- άλλο: καμία γραμμή δεδομένων, καμία στήλη, καμία πολιτική, καμία εργασία
-- pg_cron. Πηγή είναι μέτρηση, όχι νόμος: ο έλεγχος υγείας είναι λειτουργικός.
--
-- ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. Στις 08/10/2026 ένα SELECT στην παραγωγή βρήκε την
-- `active_loan_programs` να γυρίζει ΜΙΑ γραμμή, την `anakainizo_noikazo`,
-- ενεργή από τις 08/07/2026 χωρίς προθεσμία και με περιεχόμενο παλιού κύκλου
-- (20261008100000_to_palio_anakainizo_den_kryvei_ton_katalogo.sql). Τη βρήκε
-- άνθρωπος, τυχαία. Το market-data-updater κλείνει μόνο γραμμές ΜΕ προθεσμία
-- (`.not('deadline','is',null)`), οπότε γραμμή χωρίς προθεσμία δεν έληγε ποτέ.
-- Και τίποτα δεν γράφει το `verified_at` αυτόματα: αν δεν το ανανεώσει
-- μετανάστευση, μένει όπως ήταν. Ο έλεγχος βαθμολόγησης του 08/10/2026 το
-- κατέγραψε ως μοτίβο που επανέρχεται, όχι ως μεμονωμένο περιστατικό.
--
-- Ο ΚΑΝΟΝΑΣ. Κάθε ζωντανό πρόγραμμα της βάσης (ό,τι δείχνει η
-- `active_loan_programs`) έχει προθεσμία ΚΑΙ επαλήθευση νεότερη από 60 ημέρες.
-- Τα προγράμματα χωρίς λήξη ζουν στον κατάλογο του κώδικα (STATE_PROGRAMS),
-- με το ΦΕΚ τους. Αν ποτέ μπει σκόπιμα στη βάση πρόγραμμα χωρίς λήξη, θα
-- χτυπά συναγερμό ώσπου νέα μετανάστευση να χαλαρώσει τον κανόνα.
--
-- ΤΑ 60 ΕΙΝΑΙ ΕΣΩΤΕΡΙΚΟ ΟΡΙΟ ΣΥΝΑΓΕΡΜΟΥ, όπως οι 200 ώρες της
-- `bank_feed_health`. Δεν τα βλέπει χρήστης.
--
-- ΠΟΙΟΣ ΤΗ ΡΩΤΑ. Ο έλεγχος υγείας (supabase/functions/health-check), με τον
-- πελάτη υπηρεσίας, από τον κατάλογο FEEDS του `_shared/feedAlert.mjs`: ένα
-- email όταν σπάσει, ένα όταν ξαναστηθεί.
--
-- SECURITY INVOKER. Ο πίνακας διαβάζεται ήδη από όλους (πολιτική USING(true))
-- και ο ρόλος υπηρεσίας παρακάμπτει την RLS, οπότε δεν χρειάζεται δικαίωμα
-- κατόχου. Η εκτέλεση μένει μόνο στον ρόλο υπηρεσίας.
--
-- ΚΑΙ ΧΩΡΙΣ ΖΩΝΤΑΝΗ ΓΡΑΜΜΗ ΑΠΑΝΤΑ. Το άθροισμα χωρίς GROUP BY δίνει πάντα μία
-- γραμμή: με μηδέν ζωντανά προγράμματα είναι `ok` με `live_programs = 0`, όχι
-- κενή απάντηση που ο έλεγχος θα διάβαζε ως σπασμένη.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create or replace`, ίδιος ορισμός σε κάθε τρέξιμο.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reference_data_health()
returns table (
  ok              boolean,
  reason          text,
  live_programs   integer,
  stale_programs  integer,
  open_ended      integer,
  oldest_verified date
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  -- Ο ίδιος ορισμός «ζωντανού» με την όψη `active_loan_programs`.
  with live as (
    select program_id,
           deadline is null as no_deadline,
           (verified_at is null or verified_at < current_date - 60) as stale,
           verified_at
      from public.loan_programs
     where coalesce(status, 'active') <> 'ended'
       and (deadline is null or deadline >= current_date)
  )
  select
    not coalesce(bool_or(l.stale or l.no_deadline), false),
    case when coalesce(bool_or(l.stale or l.no_deadline), false)
         then 'ζωντανά προγράμματα χωρίς προθεσμία ή επαλήθευση 60 ημερών: '
              || string_agg(l.program_id, ', ' order by l.program_id) filter (where l.stale or l.no_deadline)
         else 'εντάξει' end,
    count(*)::int,
    (count(*) filter (where l.stale))::int,
    (count(*) filter (where l.no_deadline))::int,
    min(l.verified_at)
  from live l;
$$;

comment on function public.reference_data_health() is
  'Έχει κάθε ζωντανό πρόγραμμα του loan_programs προθεσμία και επαλήθευση νεότερη από 60 ημέρες; Τη ρωτά ο έλεγχος υγείας.';

revoke all on function public.reference_data_health() from public, anon, authenticated;
grant execute on function public.reference_data_health() to service_role;
