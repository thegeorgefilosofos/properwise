-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΥΓΕΙΑ ΤΗΣ ΤΡΟΦΟΔΟΣΙΑΣ ΒΛΕΠΕΙ ΤΙ ΔΕΝ ΗΡΘΕ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΜΕΤΡΗΘΗΚΕ (19/10/2026, 06:10 UTC, μόνο SELECT στην παραγωγή, μόνο
-- δεδομένα αγοράς):
--
--   select * from public.market_feed_health()
--     ok = true · «εντάξει» · values_present 8 · values_expected 8
--
--   οι δύο τελευταίες γραμμές του market_rates (18/10 και 17/10, 08:00 UTC):
--     bog_housing_new   url …MIR.M.GR.B.A2C.F.R.A.2250.EUR.N · 3,39 · asOf 2026-08-01
--     bog_housing_floating, bog_housing_fixed: δεν υπάρχουν καθόλου
--
--   γραμμές από 01/09/2026 με τιμή που ΔΕΝ ήρθε στο πέρασμά της
--   (fetchedAt παλιότερο από το updated_at της γραμμής):
--     18/09  8 από 8 · 04/10  2 (euribor_3m, euribor_12m) · 05/10  2
--     (euribor_6m, bog_housing_stock). Ολες ήρθαν στο επόμενο πρωινό πέρασμα.
--     Η υγεία έλεγε «εντάξει» και τις τρεις μέρες.
--
-- ΤΟ ΣΦΑΛΜΑ. Η 20260901160000 έκρινε το «πλήρες» μετρώντας τα κλειδιά της
-- ταυτότητας (`present < 8`). Ομως η τροφοδοσία κρατά ό,τι δεν ήρθε με την
-- παλιά του ημερομηνία, άρα τα κλειδιά δεν λιγοστεύουν ποτέ: ο έλεγχος
-- «ατελές πέρασμα» δεν μπορούσε να χτυπήσει. Και δεν ήξερε ότι ο κατάλογος
-- έχει πλέον δέκα σειρές: μετρούσε οκτώ, ενώ οι δύο νέες (κυμαινόμενο ή
-- σταθερό έως 1 έτος, σταθερό πάνω από 1 έτος) δεν είχαν έρθει ποτέ.
--
-- ── ΤΙ ΚΡΙΝΕΙ ΤΩΡΑ ─────────────────────────────────────────────────────
--   ΤΡΕΧΕΙ;      όπως πριν: η τελευταία γραμμή νεότερη από 36 ώρες.
--   ΛΕΙΠΕΙ ΚΑΤΙ; κάθε κλειδί του καταλόγου υπάρχει στην ταυτότητα. Η
--                τροφοδοσία πετά πλέον τιμή άλλης σειράς (lib/market/ecb.ts,
--                `nextProvenance`), οπότε η F κάτω από το `bog_housing_new`
--                φαίνεται εδώ ως «λείπει» αν η A δεν απαντήσει.
--   ΗΡΘΕ;        κάθε τιμή κατέβηκε (`fetchedAt`) το πολύ 36 ώρες πριν από την
--                τελευταία εκτέλεση. Μία χαμένη μέρα δεν σημαίνει βλάβη: οι τρεις
--                που μετρήθηκαν παραπάνω διορθώθηκαν μόνες τους το επόμενο πρωί
--                και θα έστελναν έξι email για τίποτα. Δύο χαμένες στη σειρά
--                σημαίνουν σειρά που δεν απαντά.
--
-- ── ΓΙΑΤΙ ΟΙ ΔΕΚΑ ΣΕΙΡΕΣ ΓΡΑΦΟΝΤΑΙ ΚΑΙ ΕΔΩ ─────────────────────────────
-- Ο κατάλογος ζει στο `ECB_SERIES` του lib/market/ecb.ts. Η βάση δεν έχει
-- άλλο τρόπο να ξέρει ότι μια σειρά που δεν ήρθε ποτέ ήταν αναμενόμενη. Τα δύο
-- αντίγραφα δένονται από το lib/market/ecbFeedHealth.test.ts, που κοκκινίζει
-- αν διαφέρουν. Οι ημέρες παλαιότητας ανά είδος ΔΕΝ γράφονται εδώ, όπως ορίζει
-- η 20260901160000: ζουν μία φορά στο ίδιο αρχείο και τις διαβάζει η οθόνη.
--
-- ΙΔΙΑ ΥΠΟΓΡΑΦΗ, ΙΔΙΕΣ ΣΤΗΛΕΣ. `create or replace`: κάτοχος και δικαιώματα
-- μένουν· η `watch_market_feed` (20260907170000) και το feedAlert.mjs διαβάζουν
-- τα ίδια πεδία και δεν αλλάζουν.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.market_feed_health()
returns table (
  ok             boolean,
  reason         text,
  last_run       timestamptz,
  hours_silent   numeric,
  values_present integer,
  values_expected integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with expected(key) as (
    select unnest(array[
      'euribor_1m', 'euribor_3m', 'euribor_6m', 'euribor_12m',
      'ecb_rate', 'ecb_dfl',
      'bog_housing_new', 'bog_housing_floating', 'bog_housing_fixed', 'bog_housing_stock'
    ]::text[])
  ), latest as (
    select updated_at, coalesce(provenance, '{}'::jsonb) as provenance
      from public.market_rates
     order by updated_at desc
     limit 1
  ), per_key as (
    select e.key,
           l.provenance ? e.key as present,
           -- Μη αναγνώσιμη στιγμή λήψης μετρά ως «δεν ήρθε».
           case when l.provenance -> e.key ->> 'fetchedAt' ~ '^\d{4}-\d{2}-\d{2}T'
                then (l.provenance -> e.key ->> 'fetchedAt')::timestamptz end as fetched_at,
           l.updated_at
      from latest l cross join expected e
  ), m as (
    select
      l.updated_at as last_run,
      round(extract(epoch from (now() - l.updated_at)) / 3600.0, 1) as hours_silent,
      (select string_agg(p.key, ', ' order by p.key) from per_key p where not p.present) as missing,
      (select string_agg(p.key, ', ' order by p.key) from per_key p
        where p.present and (p.fetched_at is null or p.fetched_at < p.updated_at - interval '36 hours')) as silent,
      (select count(*)::int from per_key p
        where p.present and p.fetched_at >= p.updated_at - interval '36 hours') as present,
      (select count(*)::int from expected) as expected
      from latest l
  )
  select
    not (m.hours_silent > 36 or m.missing is not null or m.silent is not null),
    case when m.hours_silent > 36 then 'η εργασία δεν έτρεξε: ' || m.hours_silent || ' ώρες σιωπής'
         when m.missing is not null or m.silent is not null then concat_ws(' · ',
           'λείπουν από την τροφοδοσία: ' || m.missing,
           'δεν ήρθαν πάνω από 36 ώρες: ' || m.silent)
         else 'εντάξει' end,
    m.last_run, m.hours_silent, m.present, m.expected
  from m
  -- Χωρίς γραμμή στον πίνακα, το `m` είναι κενό και η συνάρτηση δεν θα
  -- επέστρεφε ΤΙΠΟΤΑ: «καμία απάντηση» αντί για «χαλασμένη».
  union all
  select false, 'καμία γραμμή στον market_rates', null::timestamptz, null::numeric, 0,
         (select count(*)::int from expected)
   where not exists (select 1 from public.market_rates);
$$;

comment on function public.market_feed_health() is
  'Τρέχει η τροφοδοσία επιτοκίων, έχει κάθε σειρά του καταλόγου και ήρθε η καθεμία τις τελευταίες 36 ώρες; Ενας ορισμός, για τη βάση, το email και την οθόνη.';

revoke all on function public.market_feed_health() from public, anon;
grant execute on function public.market_feed_health() to authenticated, service_role;
