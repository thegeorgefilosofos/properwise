-- ═══════════════════════════════════════════════════════════════════════════
--  Η ΥΓΕΙΑ ΤΗΣ ΤΡΟΦΟΔΟΣΙΑΣ ΕΠΙΤΟΚΙΩΝ, ΡΩΤΗΜΕΝΗ ΣΤΗΝ ΙΔΙΑ ΤΗ ΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
--  ΤΟ ΣΦΑΛΜΑ (18/10/2026). Η `market_feed_health()` έλεγε «εντάξει, 8 από 8»
--  πάνω σε γραμμή όπου δύο σειρές του καταλόγου δεν είχαν έρθει ποτέ. Είχε
--  πει «εντάξει» και στις 18/09, 04/10 και 05/10, όταν τιμές δεν ήρθαν στο
--  πέρασμά τους. Μετρούσε κλειδιά και η τροφοδοσία δεν σβήνει ποτέ κλειδί.
--
--  Ο lib/market/ecbFeedHealth.test.ts διαβάζει το σώμα της συνάρτησης ως
--  κείμενο: τα δέκα κλειδιά είναι ο κατάλογος του lib/market/ecb.ts. Εδώ τη
--  ΡΩΤΑΜΕ, πάνω σε γραμμές με το σχήμα της παραγωγής. Μια σύγκριση με λάθος
--  φορά ή μια συνθήκη που λείπει περνά από τον πρώτο έλεγχο και κοκκινίζει εδώ.
--
--  Ολα μέσα σε μία συναλλαγή που ακυρώνεται στο τέλος: η βάση μένει όπως ήταν
--  για τα επόμενα βήματα του scripts/db-replay.sh. Κάθε απόκλιση σηκώνει
--  εξαίρεση και το ON_ERROR_STOP την κάνει κόκκινη.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
begin;

-- Η ταυτότητα μιας γραμμής: τα κλειδιά που δίνονται, κατεβασμένα τη στιγμή `fetched`.
create function pg_temp.mf_prov(keys text[], fetched timestamptz) returns jsonb
language sql as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object(
           'value', 2.5, 'asOf', '2026-09-01', 'source', 'ΕΚΤ', 'basis', 'δοκιμή',
           'url', 'https://data.ecb.europa.eu/data/datasets/X/X.' || k,
           'fetchedAt', to_char(fetched at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
         '{}'::jsonb)
    from unnest(keys) k
$$;

create function pg_temp.mf_check(label text, want_ok boolean, want_reason text[]) returns void
language plpgsql as $$
declare
  h record;
  w text;
begin
  select * into h from public.market_feed_health();
  if h.ok is distinct from want_ok then
    raise exception 'market_feed_health: %: περίμενα ok=%, πήρα ok=% «%»', label, want_ok, h.ok, h.reason;
  end if;
  foreach w in array want_reason loop
    if position(w in coalesce(h.reason, '')) = 0 then
      raise exception 'market_feed_health: %: η αιτία δεν λέει «%»: «%»', label, w, h.reason;
    end if;
  end loop;
  raise notice 'market-feed: % (ok=%, «%»)', label, h.ok, h.reason;
end $$;

do $probe$
declare
  ten constant text[] := array[
    'euribor_1m', 'euribor_3m', 'euribor_6m', 'euribor_12m', 'ecb_rate', 'ecb_dfl',
    'bog_housing_new', 'bog_housing_floating', 'bog_housing_fixed', 'bog_housing_stock'];
  eight constant text[] := array[
    'euribor_1m', 'euribor_3m', 'euribor_6m', 'euribor_12m', 'ecb_rate', 'ecb_dfl',
    'bog_housing_new', 'bog_housing_stock'];
  nine_no_3m constant text[] := array[
    'euribor_1m', 'euribor_6m', 'euribor_12m', 'ecb_rate', 'ecb_dfl',
    'bog_housing_new', 'bog_housing_floating', 'bog_housing_fixed', 'bog_housing_stock'];
  run constant timestamptz := now() - interval '1 hour';
  h record;
begin
  delete from public.market_rates;
  perform pg_temp.mf_check('άδειος πίνακας', false, array['καμία γραμμή']);

  -- Πλήρες πέρασμα: δέκα σειρές, όλες στο τελευταίο πέρασμα.
  insert into public.market_rates(updated_at, provenance) values (run, pg_temp.mf_prov(ten, run));
  perform pg_temp.mf_check('πλήρες πέρασμα', true, array['εντάξει']);
  select * into h from public.market_feed_health();
  if h.values_present <> 10 or h.values_expected <> 10 then
    raise exception 'market_feed_health: πλήρες πέρασμα: περίμενα 10 από 10, πήρα % από %', h.values_present, h.values_expected;
  end if;

  -- Η γραμμή της παραγωγής 18/10/2026: οκτώ κλειδιά, χωρίς floating και fixed.
  -- Η παλιά συνάρτηση έλεγε εδώ «εντάξει».
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance) values (run, pg_temp.mf_prov(eight, run));
  perform pg_temp.mf_check('η γραμμή της 18/10/2026', false, array['bog_housing_fixed', 'bog_housing_floating']);

  -- Μία χαμένη μέρα δεν είναι βλάβη: διορθώνεται μόνη της το επόμενο πρωί.
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance)
    values (run, pg_temp.mf_prov(nine_no_3m, run) || pg_temp.mf_prov(array['euribor_3m'], run - interval '25 hours'));
  perform pg_temp.mf_check('μία χαμένη μέρα', true, array['εντάξει']);

  -- Δύο χαμένες μέρες: η σειρά δεν απαντά. Η παλιά συνάρτηση έλεγε «εντάξει».
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance)
    values (run, pg_temp.mf_prov(nine_no_3m, run) || pg_temp.mf_prov(array['euribor_3m'], run - interval '49 hours'));
  perform pg_temp.mf_check('δύο χαμένες μέρες', false, array['euribor_3m']);

  -- Στιγμή λήψης που δεν διαβάζεται μετρά ως «δεν ήρθε».
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance)
    values (run, pg_temp.mf_prov(nine_no_3m, run)
      || jsonb_build_object('euribor_3m', jsonb_build_object('value', 2.5, 'asOf', '2026-09-01', 'fetchedAt', 'χθες')));
  perform pg_temp.mf_check('ακατάληπτη στιγμή λήψης', false, array['euribor_3m']);

  -- Μετρά μόνο η τελευταία γραμμή: η ατελής της προηγούμενης μέρας δεν κρίνει.
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance) values
    (run - interval '1 day', pg_temp.mf_prov(eight, run - interval '1 day')),
    (run, pg_temp.mf_prov(ten, run));
  perform pg_temp.mf_check('μόνο η τελευταία γραμμή', true, array['εντάξει']);

  -- Η εργασία σταμάτησε: η σιωπή κρίνεται πρώτη.
  delete from public.market_rates;
  insert into public.market_rates(updated_at, provenance)
    values (now() - interval '40 hours', pg_temp.mf_prov(ten, now() - interval '40 hours'));
  perform pg_temp.mf_check('η εργασία σταμάτησε', false, array['η εργασία δεν έτρεξε']);
end $probe$;

rollback;
