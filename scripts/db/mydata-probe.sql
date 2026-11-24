-- ═══════════════════════════════════════════════════════════════════════════
--  myDATA ΜΕΣΩ ΛΟΓΙΣΤΗ: ΚΑΝΕΙΣ ΔΕΝ ΒΛΕΠΕΙ ΞΕΝΑ (20261123100000)
-- ─────────────────────────────────────────────────────────────────────────
--  Δύο λογιστές (Λ1, Λ2), δύο πελάτες (Π1 του Λ1, Π2 του Λ2), ένας ξένος (Ξ)
--  και ένας πελάτης χωρίς ΑΦΜ (Π3). Ρωτά το ίδιο το Postgres, ως
--  `authenticated` και ως ρόλος υπηρεσίας:
--    · συναίνεση μόνο σε συνδεδεμένο λογιστή, με ΑΦΜ που περνά τον έλεγχο,
--      για τρέχον ή προηγούμενο έτος· ένας συγχρονιστής ανά πελάτη
--    · το κλειδί: μόνο ο ρόλος υπηρεσίας το διαβάζει· σβήνει από το Vault με
--      την αφαίρεση και με τη διαγραφή του λογαριασμού
--    · μίσθωση: δεύτερο τρέξιμο «busy», «Συγχρονισμός τώρα» ανά 5 λεπτά,
--      αυτόματο μόνο μετά από 12 ώρες
--    · RLS: κανείς από τους τέσσερις δεν βλέπει ή γράφει τα του άλλου
--    · εγγραφή: ένα ανά ΜΑΡΚ, σύνδεση με χειροκίνητη δαπάνη (±3 ημέρες),
--      «Πάντα αγνόησε», ακύρωση που σβήνει μόνο ό,τι γέννησε το myDATA,
--      πιστωτικό με πρόσημο, ΜΑΡΚ που προχωρά μόνο στο τέλος των σελίδων
--    · σφάλματα: 401 κλειδώνει τη σύνδεση, 403 απομονώνει τον πελάτη, τα
--      παροδικά ξαναδοκιμάζονται με αναμονή, το ελεύθερο κείμενο γίνεται κωδικός
--    · ανάκληση από τον πελάτη, αποσύνδεση, νεκρός σύνδεσμος, διαγραφή
--      λογαριασμού: τα παραστατικά σβήνουν, το αρχείο πρόσβασης μένει
--    · αξιολόγηση 23/11/2026: ΑΦΜ που επιβεβαιώνει ο λογιστής (B1), καραντίνα
--      (H1), παύση χωρίς διαγραφή (H2), άμεση ανάκληση με σκανδάλες (H3),
--      σημείο συνέχισης που δεν κολλά (H4), ακύρωση που δεν σβήνει (M2),
--      αναβολή όσων δεν πρόλαβαν (M3), πλήρες αρχείο (M4), μόνο λογιστής με
--      δική του γραμμή (M5). Θωράκιση 24/11/2026 (§12): δεύτερο βήμα για τον
--      λογιστή, συναίνεση με κείμενο, αυτόματο ανά πάροχο και ακίνητο, ανεκτικό
--      ταίριασμα, επανέκδοση, ελαχιστοποίηση, διατήρηση, αλλαγή λογιστή.
--      Οι σκανδάλες τρέχουν στο τέλος της συναλλαγής·
--      εδώ τις τρέχει νωρίτερα το `set constraints all immediate`.
--  Τρέχει μετά το rls-probe (που ορίζει το `auth.uid()` από το `probe.uid`),
--  σε συναλλαγή που αναιρείται: τα επόμενα βήματα βρίσκουν τη βάση όπως ήταν.
--  Κάθε αποτυχία σηκώνει exception· το ON_ERROR_STOP το κάνει κόκκινο.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);

-- ── Σκηνικό ────────────────────────────────────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  l2 uuid := 'ad000000-0000-4000-8000-0000000000c2';
  p1 uuid := 'ad000000-0000-4000-8000-0000000000a1';
  p2 uuid := 'ad000000-0000-4000-8000-0000000000a2';
  p3 uuid := 'ad000000-0000-4000-8000-0000000000a3';
  p5 uuid := 'ad000000-0000-4000-8000-0000000000a5';
  l3 uuid := 'ad000000-0000-4000-8000-0000000000c3';
  x  uuid := 'ad000000-0000-4000-8000-0000000000ee';
begin
  insert into auth.users(id, email) values
    (l1, 'l1@mydata.test'), (l2, 'l2@mydata.test'), (p1, 'p1@mydata.test'),
    (p2, 'p2@mydata.test'), (p3, 'p3@mydata.test'), (x, 'x@mydata.test'),
    (p5, 'p5@mydata.test'), (l3, 'l3@mydata.test');
  insert into public.billing_profiles(user_id, afm, owner_name) values
    (p1, '099 000 013', 'Πελάτης Ένα'), (p2, '099000025', 'Πελάτης Δύο'), (p3, '123456789', 'Πελάτης Τρία'),
    (p5, '801000012', 'Πελάτης Πέντε')
  on conflict (user_id) do update set afm = excluded.afm, owner_name = excluded.owner_name;
  insert into public.user_properties(id, user_id, name) values
    ('ad000000-0000-4000-8000-00000000f0a1', p1, 'Του Π1');
  insert into public.accountant_links(user_id, token, active) values
    (p1, 'mydata-probe-p1', true), (p2, 'mydata-probe-p2', true), (p3, 'mydata-probe-p3', true),
    (p5, 'mydata-probe-p5', true);
end $probe$;

-- Ε-1: η αποδοχή της ρύθμισης άρθρου 26 για όσους ΔΕΝ ελέγχονται εδώ. Ο Λ1
-- την αποδέχεται από τη δική του πόρτα στην §2, όπως στην εφαρμογή.
create function pg_temp.joint(p uuid) returns void language sql as $$
  insert into public.mydata_connections (accountant_id, joint_version, joint_at)
  values (p, private.mydata_joint_version(), now())
  on conflict (accountant_id) do update set joint_version = excluded.joint_version, joint_at = excluded.joint_at;
$$;

-- Οι λογιστές διεκδικούν τους πελάτες τους από τη δική τους πόρτα.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p1'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ1→Π1 %', r; end if;
  r := public.accountant_claim('mydata-probe-p3'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ1→Π3 %', r; end if;
  r := public.accountant_claim('mydata-probe-p5'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ1→Π5 %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p2'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ2→Π2 %', r; end if;
end $probe$;
reset role;

-- ── 1. Η ΣΥΝΑΙΝΕΣΗ ─────────────────────────────────────────────────────────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  l2 uuid := 'ad000000-0000-4000-8000-0000000000c2';
  y  int  := extract(year from (now() at time zone 'Europe/Athens'))::int;
  r  json;
begin
  r := public.mydata_consent_grant(l2, y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'not_linked' then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: άδεια σε λογιστή που δεν συνδέθηκε: %', r; end if;
  r := public.mydata_consent_grant(l1, y - 5, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'bad_period' then raise exception 'ΠΕΡΙΟΔΟΣ: δέχτηκε έτος % (%)', y - 5, r; end if;
  -- B1: χωρίς ΑΦΜ επιβεβαιωμένο από τον λογιστή δεν δίνεται άδεια.
  r := public.mydata_consent_grant(l1, y - 1, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'afm_unconfirmed' then raise exception 'B1: άδεια με ΑΦΜ που ο λογιστής δεν επιβεβαίωσε: %', r; end if;
end $probe$;
reset role;

-- Ο λογιστής επιβεβαιώνει το ΑΦΜ των πελατών του από τον δικό του χώρο.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a2', '099000025');
  if (r->>'ok')::boolean or r->>'reason' <> 'not_linked' then raise exception 'B1: ο Λ1 επιβεβαίωσε ΑΦΜ πελάτη του Λ2: %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a1', '099000014');
  if (r->>'ok')::boolean or r->>'reason' <> 'bad_afm' then raise exception 'B1: δέχτηκε ΑΦΜ με λάθος ψηφίο ελέγχου: %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a1', '099 000 013');
  if not (r->>'ok')::boolean then raise exception 'B1: η επιβεβαίωση του Π1 απέτυχε: %', r; end if;
  if r::text like '%099000013%' then raise exception 'B1: η απάντηση κουβαλά ΑΦΜ'; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a2', '099000025');
  if not (r->>'ok')::boolean then raise exception 'B1: η επιβεβαίωση του Π2 απέτυχε: %', r; end if;
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  y  int  := extract(year from (now() at time zone 'Europe/Athens'))::int;
  r  json;
begin
  r := public.mydata_consent_grant(l1, y - 1, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η άδεια του Π1 απέτυχε: %', r; end if;
  if (select afm from public.mydata_consents where client_id = auth.uid()) <> '099000013' then
    raise exception 'ΡΟΗ: το ΑΦΜ δεν καθαρίστηκε από κενά';
  end if;
  if (select window_from from public.mydata_consents where client_id = auth.uid()) <> make_date(y - 1, 1, 1) then
    raise exception 'ΠΕΡΙΟΔΟΣ: λάθος αρχή παραθύρου';
  end if;
  r := public.mydata_consent_grant(l1, y - 1, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'existing')::boolean then raise exception 'ΡΟΗ: δεύτερο «Επιτρέπω» έγραψε δεύτερη γραμμή'; end if;
  raise notice 'probe: άδεια μόνο σε συνδεδεμένο λογιστή, για τρέχον ή προηγούμενο έτος';
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a3', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', extract(year from now())::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'no_afm' then raise exception 'ΑΦΜ: άδεια με ΑΦΜ που δεν περνά τον έλεγχο: %', r; end if;
  raise notice 'probe: χωρίς έγκυρο ΑΦΜ δεν δίνεται άδεια';
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c2', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η άδεια του Π2 απέτυχε: %', r; end if;
  -- Κανείς δεν γράφει απευθείας.
  begin
    update public.mydata_consents set last_mark = 999 where client_id = auth.uid();
    if found then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο πελάτης άλλαξε τον ΜΑΡΚ του'; end if;
  exception when insufficient_privilege then null;
  end;
end $probe$;
reset role;

-- ── 1β. B1: ΤΟ ΑΦΜ ΔΕΝ ΤΟ ΔΙΑΛΕΓΕΙ Ο ΠΕΛΑΤΗΣ ────────────────────────────────────
-- Ο Π3 (πελάτης του Λ1) γράφει στο προφίλ του ΑΦΜ που δεν είναι δικό του: του
-- Υ (άλλος πελάτης του Λ1 στο myAADE, όχι χρήστης) ή του Π2. Καμία άδεια, κανένας
-- στόχος συγχρονισμού.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a3', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  update public.billing_profiles set afm = '099000049' where user_id = auth.uid();
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'afm_unconfirmed' then raise exception 'B1: ο Π3 πήρε άδεια με ξένο ΑΦΜ χωρίς επιβεβαίωση: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a3', '099000037');
  if not (r->>'ok')::boolean then raise exception 'B1: επιβεβαίωση Π3: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a3', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'afm_mismatch' then raise exception 'B1: ο Π3 πήρε άδεια με ΑΦΜ άλλο από αυτό που επιβεβαίωσε ο λογιστής: %', r; end if;
  update public.billing_profiles set afm = '099000025' where user_id = auth.uid();
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean then raise exception 'B1: ο Π3 πήρε άδεια με το ΑΦΜ του Π2: %', r; end if;
end $probe$;
reset role;
-- Ακόμη κι αν ο λογιστής γράψει κατά λάθος το ΑΦΜ του Π2, ένα ΑΦΜ έχει μία άδεια.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a3', '099000025');
  if not (r->>'ok')::boolean then raise exception 'B1: επιβεβαίωση Π3: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a3', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'afm_taken' then raise exception 'B1: δεύτερη ενεργή άδεια στο ίδιο ΑΦΜ: %', r; end if;
  update public.billing_profiles set afm = '123456789' where user_id = auth.uid();
end $probe$;
reset role;
do $probe$ begin
  if (select count(*) from public.mydata_consents where afm = '099000025' and revoked_at is null) <> 1 then raise exception 'B1: το ΑΦΜ του Π2 έχει δεύτερη άδεια'; end if;
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a3') then raise exception 'B1: ο Π3 έχει άδεια'; end if;
  begin
    insert into public.mydata_consents (client_id, accountant_id, afm, window_from)
    values ('ad000000-0000-4000-8000-0000000000a3', 'ad000000-0000-4000-8000-0000000000c1', '099000025', current_date);
    raise exception 'B1: το σχήμα δέχτηκε δεύτερη ενεργή άδεια για το ίδιο ΑΦΜ';
  exception when unique_violation then null;
  end;
  raise notice 'probe: B1: ο πελάτης με ξένο ΑΦΜ δεν παίρνει άδεια· ένα ΑΦΜ, μία ενεργή άδεια';
end $probe$;

-- Ο Π1 αλλάζει το ΑΦΜ του ΑΦΟΥ πήρε άδεια: η άδεια φεύγει αμέσως. Με το σωστό
-- ΑΦΜ ξαναδίνεται.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  update public.billing_profiles set afm = '099000049' where user_id = auth.uid();
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoked_at is null) then
    raise exception 'B1: η άδεια έμεινε ενεργή με άλλο ΑΦΜ στο προφίλ';
  end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'afm_changed') then
    raise exception 'B1: η ανάκληση δεν έγραψε «afm_changed»';
  end if;
  update public.billing_profiles set afm = '099 000 013' where user_id = auth.uid();
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y - 1, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'B1: η άδεια με το σωστό ΑΦΜ δεν ξαναδόθηκε: %', r; end if;
  raise notice 'probe: B1: αλλαγή ΑΦΜ στο προφίλ ανακαλεί την άδεια αμέσως';
end $probe$;
reset role;

-- ── 2. Ε2: ΚΑΝΕΝΑ ΚΛΕΙΔΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΥΘΕΝΑ (απόφαση ιδιοκτήτη 24/11/2026) ──
-- Η βάση δεν έχει ούτε συνάρτηση, ούτε πίνακα, ούτε στήλη, ούτε μυστικό του
-- Vault για κλειδί λογιστή. Κανένα cron δεν καλεί τη συνάρτηση άκρου.
do $probe$ begin
  if to_regprocedure('public.mydata_key_store(uuid,text,text)') is not null
     or to_regprocedure('public.mydata_key_read(uuid)') is not null
     or to_regprocedure('public.mydata_key_remove()') is not null
     or to_regclass('private.mydata_vault') is not null
     or to_regprocedure('private.mydata_vault_drop()') is not null then
    raise exception 'Ε2: ζει ακόμη μηχανισμός φύλαξης κλειδιού';
  end if;
  if to_regprocedure('public.mydata_due_accountants(text)') is not null
     or to_regprocedure('public.mydata_defer(uuid,uuid[])') is not null then
    raise exception 'Ε2: ζει ακόμη μηχανισμός αυτόματης άντλησης';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'private') and p.proname like 'mydata%'
                and p.proargnames && array['p_key', 'p_api_key', 'p_secret', 'p_subscription_key']) then
    raise exception 'Ε2: συνάρτηση myDATA δέχεται κλειδί ως όρισμα';
  end if;
  if exists (select 1 from information_schema.columns where table_schema in ('public', 'private') and table_name like 'mydata%'
             and column_name ~ '(secret|subscription|api_key|^key$)') then
    raise exception 'Ε2: στήλη κλειδιού σε πίνακα myDATA';
  end if;
  if exists (select 1 from cron.job where jobname like 'mydata-sync%' or command like '%mydata-sync%') then
    raise exception 'Ε2: εργασία cron καλεί ακόμη τη mydata-sync';
  end if;
  if exists (select 1 from vault.secrets where name like 'mydata%') then raise exception 'Ε2: μυστικό myDATA στο Vault'; end if;
  -- Η στήλη `has_key` και το `aade_user_id` μένουν μόνο για τις παλιές
  -- μεταναστεύσεις: ο κανόνας του πίνακα τα κρατά κενά.
  begin
    insert into public.mydata_connections (accountant_id, aade_user_id) values ('ad000000-0000-4000-8000-0000000000ee', 'logistis');
    raise exception 'Ε2: ο πίνακας δέχτηκε user id ΑΑΔΕ';
  exception when check_violation then null;
  end;
  begin
    insert into public.mydata_connections (accountant_id, has_key) values ('ad000000-0000-4000-8000-0000000000ee', true);
    raise exception 'Ε2: ο πίνακας δέχτηκε «has_key»';
  exception when check_violation then null;
  end;
  raise notice 'probe: Ε2: κανένα κλειδί, κανένα user id, κανένα cron άντλησης στη βάση';
end $probe$;

-- Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΣΒΗΝΕΙ ΟΣΑ ΒΡΕΙ. Στην παραγωγή υπάρχουν τα Α1 και Α2 με
-- κλειστές σημαίες: δύο εργασίες cron και, θεωρητικά, μυστικά. Εδώ τα στήνουμε
-- όπως θα ήταν και ξανατρέχουμε το καθάρισμα της μετανάστευσης.
do $probe$ begin
  perform cron.schedule('mydata-sync-nightly', '17 1 * * *', 'select 1');
  perform cron.schedule('mydata-sync-retry', '*/15 * * * *', 'select 1');
  perform cron.schedule('mydata-prune', '41 2 * * *', $c$ select private.mydata_prune(); $c$);
  perform vault.create_secret('abcdEFGH12345678abcdEFGH12345678', 'mydata_key:ad000000-0000-4000-8000-0000000000c1', 'x');
  create table private.mydata_vault (accountant_id uuid primary key, secret_id uuid not null);
  insert into private.mydata_vault select 'ad000000-0000-4000-8000-0000000000c1', id from vault.secrets where name like 'mydata_key:%';
  perform private.mydata_forget_keys();
  if exists (select 1 from cron.job where jobname in ('mydata-sync-nightly', 'mydata-sync-retry')) then raise exception 'Ε2: το cron άντλησης έμεινε'; end if;
  if not exists (select 1 from cron.job where jobname = 'mydata-prune') then raise exception 'Ε2: σβήστηκε και το καθάρισμα διατήρησης'; end if;
  if exists (select 1 from vault.secrets where name like 'mydata_key:%') or exists (select 1 from vault.decrypted_secrets where name like 'mydata_key:%') then
    raise exception 'Ε2: έμεινε μυστικό κλειδιού στο Vault';
  end if;
  if to_regclass('private.mydata_vault') is not null then raise exception 'Ε2: έμεινε ο πίνακας αναφορών του Vault'; end if;
  perform cron.unschedule('mydata-prune');
  raise notice 'probe: Ε2: η μετανάστευση σβήνει cron άντλησης και μυστικά, κρατά το καθάρισμα';
end $probe$;

-- ── 2β. Ε-1: Η ΡΥΘΜΙΣΗ ΑΡΘΡΟΥ 26 ΓΙΝΕΤΑΙ ΔΕΚΤΗ ΜΕ ΕΚΔΟΣΗ ΚΑΙ ΩΡΑ, ΠΡΙΝ ΑΠΟ ΤΗΝ ΑΝΤΛΗΣΗ
do $probe$ declare r json; begin
  r := public.mydata_sync_begin('ad000000-0000-4000-8000-0000000000c1', 'manual', 'ad000000-0000-4000-8000-0000000000c1');
  if (r->>'ok')::boolean or r->>'reason' <> 'joint_terms' then raise exception 'Ε-1: άντληση χωρίς αποδοχή της ρύθμισης: %', r; end if;
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
set local role authenticated;
do $probe$ declare r json; begin
  -- Ο Λ1 έχει πελάτες χωρίς γραφείο: το mfa_satisfied τον περνά, το aal2 όχι.
  begin
    r := public.mydata_joint_accept(private.mydata_joint_version());
    raise exception 'Ε-1: αποδοχή χωρίς δεύτερο βήμα: %', r;
  exception when insufficient_privilege then null;
  end;
end $probe$;
reset role;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_joint_accept('2020-01-01');
  if (r->>'ok')::boolean or r->>'reason' <> 'joint_outdated' then raise exception 'Ε-1: δέχτηκε παλιά έκδοση: %', r; end if;
  r := public.mydata_joint_accept(private.mydata_joint_version());
  if not (r->>'ok')::boolean then raise exception 'Ε-1: η αποδοχή απέτυχε: %', r; end if;
  -- Ο λογιστής δεν γράφει μόνος του έκδοση ή ώρα.
  begin
    update public.mydata_connections set joint_version = '2099-01-01';
    if found then raise exception 'Ε-1: ο λογιστής γράφει την έκδοση με το χέρι'; end if;
  exception when insufficient_privilege then null;
  end;
end $probe$;
reset role;
do $probe$ declare c record; begin
  select * into c from public.mydata_connections where accountant_id = 'ad000000-0000-4000-8000-0000000000c1';
  if c.joint_version is distinct from private.mydata_joint_version() or c.joint_at is null or c.joint_at > now() then
    raise exception 'Ε-1: έκδοση ή ώρα δεν γράφτηκαν (%, %)', c.joint_version, c.joint_at;
  end if;
  if c.aade_user_id is not null or c.has_key then raise exception 'Ε2: η αποδοχή έγραψε διαπιστευτήριο'; end if;
  if not exists (select 1 from public.mydata_access_log where accountant_id = c.accountant_id and action = 'joint_accepted') then
    raise exception 'Ε-1: η αποδοχή δεν γράφτηκε στο αρχείο πρόσβασης';
  end if;
  -- Ε-2: νέα έκδοση της ρύθμισης: η άντληση σταματά ώσπου να γίνει ξανά δεκτή.
  update public.mydata_connections set joint_version = '2026-01-01' where accountant_id = c.accountant_id;
  if (public.mydata_sync_begin(c.accountant_id, 'manual', c.accountant_id))->>'reason' is distinct from 'joint_terms' then
    raise exception 'Ε-2: άντληση με ρύθμιση παλιάς έκδοσης';
  end if;
  update public.mydata_connections set joint_version = private.mydata_joint_version() where accountant_id = c.accountant_id;
  if not ('joint_terms' = any (private.mydata_error_codes())) then raise exception 'Ε-2: ο κωδικός joint_terms λείπει από τον κατάλογο'; end if;
  perform pg_temp.joint('ad000000-0000-4000-8000-0000000000c2');
  raise notice 'probe: Ε-1/Ε-2: αποδοχή με έκδοση και ώρα πριν από την άντληση· νέα έκδοση σταματά την άντληση';
end $probe$;

-- ── 3. Η ΜΙΣΘΩΣΗ ΚΑΙ ΤΑ ΟΡΙΑ ΣΥΧΝΟΤΗΤΑΣ ─────────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  r json; r2 json;
begin
  -- Ε2: κανένα τρέξιμο που δεν ξεκίνησε ο ίδιος ο λογιστής.
  foreach r2 in array array[public.mydata_sync_begin(l1, 'nightly'), public.mydata_sync_begin(l1, 'retry'), public.mydata_sync_begin(l1, 'auto', l1)] loop
    if (r2->>'ok')::boolean or r2->>'reason' <> 'bad_kind' then raise exception 'Ε2: δέχτηκε τρέξιμο χωρίς τον λογιστή: %', r2; end if;
  end loop;
  r2 := public.mydata_sync_begin(l1, 'manual');
  if (r2->>'ok')::boolean or r2->>'reason' <> 'no_actor' then raise exception 'Ε2: «manual» χωρίς πρόσωπο: %', r2; end if;
  r2 := public.mydata_sync_begin(l1, 'manual', 'ad000000-0000-4000-8000-0000000000c2');
  if (r2->>'ok')::boolean or r2->>'reason' <> 'no_actor' then raise exception 'Ε2: τρέξιμο για λογαριασμό άλλου λογιστή: %', r2; end if;
  r := public.mydata_sync_begin(l1, 'manual', l1);
  if not (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: η πρώτη απέτυχε: %', r; end if;
  -- M4: η μίσθωση ξέρει ποιος πάτησε «τώρα» και τι είδους τρέξιμο είναι.
  if (select lease_actor from public.mydata_connections where accountant_id = l1) is distinct from l1
     or (select lease_kind from public.mydata_connections where accountant_id = l1) <> 'manual' then
    raise exception 'M4: η μίσθωση δεν κράτησε πρόσωπο και είδος';
  end if;
  -- Ε2: κάθε χρήση του κλειδιού γράφεται, χωρίς το κλειδί (πρώην «key_read»).
  if not exists (select 1 from public.mydata_access_log where accountant_id = l1 and action = 'key_used' and actor_id = l1 and detail = 'manual') then
    raise exception 'Ε2: η χρήση του κλειδιού δεν γράφτηκε στο αρχείο πρόσβασης';
  end if;
  r2 := public.mydata_sync_begin(l1, 'manual', l1);
  if (r2->>'ok')::boolean or r2->>'reason' <> 'busy' then raise exception 'ΜΙΣΘΩΣΗ: δεύτερο τρέξιμο ενώ τρέχει το πρώτο: %', r2; end if;
  perform public.mydata_sync_end(l1, (r->>'lease')::uuid, null, 0);
  r2 := public.mydata_sync_begin(l1, 'manual', l1);
  if (r2->>'ok')::boolean or r2->>'reason' <> 'too_soon' or r2->>'retryAt' is null then
    raise exception 'ΟΡΙΟ: «Φέρε τώρα» δύο φορές μέσα σε 5 λεπτά: %', r2;
  end if;
  -- Ε2: τρέξιμο που σταμάτησε στο όριο χρόνου (`partial`) συνεχίζει αμέσως με
  -- το επόμενο πάτημα, χωρίς το όριο των 5 λεπτών και χωρίς cron.
  update public.mydata_connections set last_manual_at = now() - interval '6 minutes' where accountant_id = l1;
  r := public.mydata_sync_begin(l1, 'manual', l1);
  perform public.mydata_sync_end(l1, (r->>'lease')::uuid, null, 0, true);
  r := public.mydata_sync_begin(l1, 'manual', l1);
  if not (r->>'ok')::boolean then raise exception 'Ε2: η συνέχεια μετά από «partial» περιμένει 5 λεπτά: %', r; end if;
  -- Μίσθωση που ξεχάστηκε (κομμένη συνάρτηση) λήγει στα 10 λεπτά.
  update public.mydata_connections set lease_at = now() - interval '11 minutes', last_manual_at = now() - interval '11 minutes' where accountant_id = l1;
  r := public.mydata_sync_begin(l1, 'manual', l1);
  if not (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: η ληγμένη δεν απελευθερώθηκε: %', r; end if;
  perform set_config('mydata.lease', r->>'lease', true);
  raise notice 'probe: μόνο ο λογιστής ξεκινά, ένα τρέξιμο ανά λογιστή, «τώρα» ανά 5 λεπτά, συνέχεια αμέσως';
end $probe$;

-- ── 4. ΠΟΙΟΥΣ ΠΕΛΑΤΕΣ ΖΗΤΑ Ο ΛΟΓΙΣΤΗΣ ─────────────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  lease uuid := current_setting('mydata.lease')::uuid;
  n int; v_afm text;
begin
  select count(*), min(afm) into n, v_afm from public.mydata_sync_targets(l1, lease, 'manual');
  if n <> 1 or v_afm <> '099000013' then raise exception 'ΔΙΑΡΡΟΗ: ο Λ1 θα ζητούσε % ΑΦΜ (%), όχι μόνο τον Π1', n, v_afm; end if;
  select count(*) into n from public.mydata_sync_targets(l1, gen_random_uuid(), 'manual');
  if n <> 0 then raise exception 'ΜΙΣΘΩΣΗ: στόχοι χωρίς έγκυρη μίσθωση'; end if;
  if public.mydata_consent_live((select id from public.mydata_consents where afm = '099000025'), lease) then
    raise exception 'ΔΙΑΡΡΟΗ: η μίσθωση του Λ1 περνά για πελάτη του Λ2';
  end if;
  raise notice 'probe: ο λογιστής ζητά ΜΟΝΟ πελάτες με άδεια προς αυτόν';
end $probe$;

-- ── 5. ΕΓΓΡΑΦΗ ΣΕΛΙΔΩΝ ─────────────────────────────────────────────────────
do $probe$
declare
  p1 uuid := 'ad000000-0000-4000-8000-0000000000a1';
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a1';
  lease uuid := current_setting('mydata.lease')::uuid;
  k uuid := (select id from public.mydata_consents where afm = '099000013' and revoked_at is null);
  docs jsonb;
  r json; n int;
  manual uuid; far uuid; mine uuid;
begin
  -- Χειροκίνητη δαπάνη στις 13/11, 88,50€, ίδιος πάροχος: το 102 (15/11) δένεται.
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (p1, prop, 88.50, 'Υδραυλικός', 'Επισκευές', '2026-11-13', '099000049') returning id into manual;
  -- Ιδια δαπάνη 16 ημέρες μακριά από το 120: δεν δένεται (θωράκιση: ±10 ημέρες).
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (p1, prop, 40.00, 'Μακριά', 'Επισκευές', '2026-10-20', '099000049') returning id into far;
  -- Δαπάνη που γέννησε ήδη το myDATA (π.χ. από προηγούμενη άδεια): το 130 είναι «filed».
  insert into public.expenses (user_id, property_id, amount, description, category, date, dedup_hash)
    values (p1, prop, 10.00, 'Από myDATA', 'Ρεύμα', '2026-11-03', 'mydata:400001000000130') returning id into mine;

  docs := jsonb_build_array(
    jsonb_build_object('mark','400001000000101','counterpart_afm','099000037','counterpart_name','Ηλεκτρική','doc_type','2.1','series','Α','aa','101','issue_date','2026-11-02','title','Τιμολόγιο Παροχής Υπηρεσιών Α 101','net_cents',10000,'vat_cents',2400,'gross_cents',12400,'is_credit',false,'cancelled',false,'cancellation_mark',null),
    jsonb_build_object('mark','400001000000102','counterpart_afm','099000049','counterpart_name',null,'doc_type','1.1','series','ΤΠΥ','aa','7','issue_date','2026-11-15','title','Τιμολόγιο Πώλησης ΤΠΥ 7','net_cents',7137,'vat_cents',1713,'gross_cents',8850,'is_credit',false,'cancelled',false,'cancellation_mark',null),
    jsonb_build_object('mark','400001000000110','counterpart_afm','099000037','counterpart_name','Ηλεκτρική','doc_type','5.1','series','ΠΙΣ','aa','3','issue_date','2026-11-20','title','Πιστωτικό Τιμολόγιο ΠΙΣ 3','net_cents',1000,'vat_cents',240,'gross_cents',1240,'is_credit',true,'cancelled',false,'cancellation_mark',null),
    jsonb_build_object('mark','400001000000111','counterpart_afm','990000014','counterpart_name',null,'doc_type','2.1','series','Β','aa','55','issue_date','2026-11-21','title','Τιμολόγιο Παροχής Υπηρεσιών Β 55','net_cents',5000,'vat_cents',1200,'gross_cents',6200,'is_credit',false,'cancelled',true,'cancellation_mark','400001000000190'),
    jsonb_build_object('mark','400001000000120','counterpart_afm','099000049','counterpart_name',null,'doc_type','2.1','series','Γ','aa','1','issue_date','2026-11-05','title','Τιμολόγιο Παροχής Υπηρεσιών Γ 1','net_cents',3226,'vat_cents',774,'gross_cents',4000,'is_credit',false,'cancelled',false,'cancellation_mark',null),
    jsonb_build_object('mark','400001000000130','counterpart_afm','099000037','counterpart_name',null,'doc_type','2.1','series','Δ','aa','1','issue_date','2026-11-03','title','Τιμολόγιο Παροχής Υπηρεσιών Δ 1','net_cents',806,'vat_cents',194,'gross_cents',1000,'is_credit',false,'cancelled',false,'cancellation_mark',null));

  -- Πρώτη σελίδα από δύο: γράφει, κρατά τη συνέχεια, ΔΕΝ προχωρά τον ΜΑΡΚ.
  r := public.mydata_ingest(lease, k, docs, '[]'::jsonb, '[]'::jsonb, 7, 400001000000130, '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"400001000000130"}'::jsonb, false);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η εγγραφή απέτυχε: %', r; end if;
  -- M4: κάθε σελίδα στο αρχείο, με όσα ανακτήθηκαν και το είδος του τρεξίματος.
  if not exists (select 1 from public.mydata_access_log l where l.client_id = p1 and l.action = 'sync_fetch' and l.n = 7 and l.detail = 'manual') then
    raise exception 'M4: η σελίδα δεν γράφτηκε στο αρχείο πρόσβασης με το πλήθος της';
  end if;
  if (r->>'added')::int <> 3 then raise exception 'ΕΓΓΡΑΦΗ: % νέα αντί για 3 (101, 110, 120)', r->>'added'; end if;
  if (select last_mark from public.mydata_consents where id = k) <> 0 then raise exception 'ΜΑΡΚ: προχώρησε πριν τελειώσουν οι σελίδες'; end if;
  if (select resume->>'partitionKey' from public.mydata_consents where id = k) <> 'p' then raise exception 'ΣΥΝΕΧΕΙΑ: δεν κρατήθηκε το σημείο'; end if;

  if (select status from public.mydata_docs where mark = 400001000000102) <> 'linked'
     or (select expense_id from public.mydata_docs where mark = 400001000000102) <> manual then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: η χειροκίνητη δαπάνη 2 ημερών δεν δέθηκε';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000120) <> 'pending' then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: δέθηκε δαπάνη 16 ημέρες μακριά';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000130) <> 'filed'
     or (select expense_id from public.mydata_docs where mark = 400001000000130) <> mine then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: η δαπάνη με αποτύπωμα ΜΑΡΚ δεν αναγνωρίστηκε';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000111) <> 'cancelled' then
    raise exception 'ΑΚΥΡΩΣΗ: το ακυρωμένο μπήκε ως εκκρεμές';
  end if;

  -- Ξανά η ίδια σελίδα (επανάληψη μετά από κόψιμο): κανένα νέο, κανένα διπλό.
  r := public.mydata_ingest(lease, k, docs, '[]'::jsonb, '[]'::jsonb, 7, 400001000000130, null, true);
  if (r->>'added')::int <> 0 then raise exception 'ΔΙΠΛΟΤΥΠΟ: ο ίδιος ΜΑΡΚ γράφτηκε δεύτερη φορά'; end if;
  select count(*) into n from public.mydata_docs where client_id = p1;
  if n <> 6 then raise exception 'ΔΙΠΛΟΤΥΠΟ: % γραμμές αντί για 6', n; end if;
  if (select last_mark from public.mydata_consents where id = k) <> 400001000000130 then raise exception 'ΜΑΡΚ: δεν προχώρησε στο τέλος'; end if;
  if (select resume from public.mydata_consents where id = k) is not null then raise exception 'ΣΥΝΕΧΕΙΑ: έμεινε μετά το τέλος'; end if;

  -- Λάθος μίσθωση: τίποτα.
  r := public.mydata_ingest(gen_random_uuid(), k, docs, '[]'::jsonb, '[]'::jsonb, 7, 1, null, true);
  if (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: εγγραφή χωρίς μίσθωση'; end if;

  -- H1: τα άκυρα σε καραντίνα με ΜΑΡΚ και αιτία· ο ΜΑΡΚ της άδειας δεν περνά από πάνω τους.
  r := public.mydata_ingest(lease, k, '[]'::jsonb, '[]'::jsonb,
    '[{"mark":"400001000000150","reason":"invoice_type"},{"mark":null,"reason":"mark"}]'::jsonb, 2, null, null, true);
  if not (r->>'ok')::boolean then raise exception 'H1: η σελίδα με άκυρα απέτυχε: %', r; end if;
  if (select count(*) from public.mydata_quarantine where consent_id = k) <> 2 then raise exception 'H1: τα άκυρα δεν μπήκαν σε καραντίνα'; end if;
  if (select last_mark from public.mydata_consents where id = k) <> 400001000000130 then raise exception 'H1: ο ΜΑΡΚ προχώρησε πάνω από άκυρο'; end if;
  -- Ξανά τα ίδια: καμία δεύτερη γραμμή.
  perform public.mydata_ingest(lease, k, '[]'::jsonb, '[]'::jsonb,
    '[{"mark":"400001000000150","reason":"invoice_type"},{"mark":null,"reason":"mark"}]'::jsonb, 2, null, null, true);
  if (select count(*) from public.mydata_quarantine where consent_id = k) <> 2 then raise exception 'H1: διπλή γραμμή καραντίνας'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = p1 and action = 'invalid_quarantined') then raise exception 'H1: η καραντίνα δεν καταγράφηκε'; end if;
  raise notice 'probe: ένα ανά ΜΑΡΚ, σύνδεση με χειροκίνητη ±10 ημερών, συνέχεια σελίδων';
end $probe$;

-- ── 5α. Α2 (20261123160000): ΑΥΤΟΜΑΤΑ, ΓΙΑ ΕΛΕΓΧΟ, ΑΠΟΡΡΙΨΗ ──────────────────
--  Ο Π1 έχει ΕΝΑ ακίνητο: το `auto` γίνεται δαπάνη με τα ποσά της ΑΑΔΕ. Με
--  δεύτερο ακίνητο το ίδιο πάει για έλεγχο (`pick_property`). Επανάληψη της
--  σελίδας δεν γεννά δεύτερη δαπάνη. Ο κατάλογος λόγων είναι κλειστός. Οι
--  απορρίψεις μετρώνται, δεν γράφονται. Στο τέλος σβήνει ό,τι έγραψε, ώστε οι
--  μετρήσεις των επόμενων ενοτήτων να μένουν ίδιες.
do $probe$
declare
  p1 uuid := 'ad000000-0000-4000-8000-0000000000a1';
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a1';
  lease uuid := current_setting('mydata.lease')::uuid;
  k uuid := (select id from public.mydata_consents where afm = '099000013' and revoked_at is null);
  doc_auto jsonb; doc_review jsonb; doc_bad jsonb; doc_two jsonb;
  r json; st jsonb; e record; np0 int;
begin
  np0 := (select not_property from public.mydata_consents where id = k);
  doc_auto := jsonb_build_object('mark','400001000000140','counterpart_afm','090000045','counterpart_name',null,'doc_type','2.1','series','Α','aa','140','issue_date','2026-11-04','title','Τιμολόγιο Παροχής Υπηρεσιών Α 140','net_cents',7137,'vat_cents',1713,'gross_cents',8850,'is_credit',false,'cancelled',false,'cancellation_mark',null,
    'tier','auto','category','electricity','category_label','Ρεύμα','expense_group','fixed','vendor','ΔΕΗ','reasons','[]'::jsonb);
  doc_review := jsonb_build_object('mark','400001000000141','counterpart_afm','094079101','counterpart_name',null,'doc_type','11.2','series','Β','aa','141','issue_date','2026-11-04','title','Απόδειξη Παροχής Υπηρεσιών Β 141','net_cents',3000,'vat_cents',0,'gross_cents',3000,'is_credit',false,'cancelled',false,'cancellation_mark',null,
    'tier','review','category','water','category_label',null,'expense_group',null,'vendor',null,'reasons','["new_provider","drop table"]'::jsonb);
  doc_bad := jsonb_build_object('mark','400001000000142','counterpart_afm','090000045','counterpart_name',null,'doc_type','2.1','series','Α','aa','142','issue_date','2026-11-05','title','Τ','net_cents',100,'vat_cents',24,'gross_cents',124,'is_credit',false,'cancelled',false,'cancellation_mark',null,
    'tier','auto','category','electricity','category_label','','expense_group','fixed','vendor','ΔΕΗ','reasons','[]'::jsonb);

  -- Θωράκιση (Σ1 λογιστικού): το αυτόματο θέλει παραστατικό του ίδιου παρόχου
  -- που ο χρήστης καταχώρησε για το ΙΔΙΟ ακίνητο. Το 139 είναι αυτό.
  insert into public.expenses (user_id, property_id, amount, description, category, date, dedup_hash)
    values (p1, prop, 80.00, 'ΔΕΗ Οκτωβρίου', 'Ρεύμα', '2026-10-04', 'mydata:400001000000139');
  perform public.mydata_ingest(lease, k, jsonb_build_array(doc_auto || jsonb_build_object('mark', '400001000000139', 'tier', 'review', 'gross_cents', 8000, 'net_cents', 6452, 'vat_cents', 1548, 'issue_date', '2026-10-04')),
    '[]'::jsonb, '[]'::jsonb, 1, null, null, true);
  if (select status from public.mydata_docs where mark = 400001000000139) <> 'filed' then raise exception 'ΣΚΗΝΙΚΟ: το ιστορικό του 139 δεν καταχωρήθηκε'; end if;
  r := public.mydata_ingest(lease, k, jsonb_build_array(doc_auto, doc_review, doc_bad), '[]'::jsonb, '[]'::jsonb, 6, null, null, true, 3);
  if not (r->>'ok')::boolean then raise exception 'Α2: η σελίδα απέτυχε: %', r; end if;
  if (r->>'auto')::int <> 1 or (r->>'added')::int <> 3 then raise exception 'Α2: % αυτόματα και % νέα αντί για 1 και 3', r->>'auto', r->>'added'; end if;

  select * into e from public.expenses where user_id = p1 and dedup_hash = 'mydata:400001000000140';
  if not found then raise exception 'Α2: το αυτόματο δεν έγινε δαπάνη'; end if;
  if e.amount <> 88.50 or e.vat_amount <> 17.13 or e.category <> 'Ρεύμα' or e.expense_group <> 'fixed'
     or e.property_id <> prop or e.store_vendor <> 'ΔΕΗ' or e.supplier_afm <> '090000045' or e.paid then
    raise exception 'Α2: η αυτόματη δαπάνη δεν έχει τα στοιχεία της ΑΑΔΕ: % % % % %', e.amount, e.vat_amount, e.category, e.store_vendor, e.supplier_afm;
  end if;
  if (select status || '/' || filed_by || '/' || tier from public.mydata_docs where mark = 400001000000140) <> 'filed/auto/auto' then
    raise exception 'Α2: το αυτόματο παραστατικό δεν σημειώθηκε filed/auto';
  end if;
  if (select status || '/' || tier || '/' || category from public.mydata_docs where mark = 400001000000141) <> 'pending/review/water' then
    raise exception 'Α2: το για έλεγχο δεν κράτησε κατηγορία';
  end if;
  if (select review_reasons from public.mydata_docs where mark = 400001000000141) <> array['new_provider']::text[] then
    raise exception 'Α2: άγνωστος κωδικός λόγου πέρασε στη βάση';
  end if;
  if (select status || '/' || tier from public.mydata_docs where mark = 400001000000142) <> 'pending/review' then
    raise exception 'Α2: αυτόματο χωρίς ετικέτα κατηγορίας έγινε δαπάνη';
  end if;
  if exists (select 1 from public.expenses where dedup_hash = 'mydata:400001000000142') then raise exception 'Α2: δαπάνη χωρίς κατηγορία'; end if;
  if (select not_property from public.mydata_consents where id = k) <> np0 + 3 then raise exception 'Α2: οι απορρίψεις δεν μετρήθηκαν'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = p1 and action = 'not_property' and n = 3) then raise exception 'Α2: η απόρριψη δεν γράφτηκε στο αρχείο'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = p1 and action = 'auto_filed' and n = 1) then raise exception 'Α2: η αυτόματη καταχώρηση δεν γράφτηκε στο αρχείο'; end if;

  -- Επανάληψη της ίδιας σελίδας: καμία δεύτερη δαπάνη.
  r := public.mydata_ingest(lease, k, jsonb_build_array(doc_auto, doc_review), '[]'::jsonb, '[]'::jsonb, 2, null, null, true);
  if (r->>'added')::int <> 0 or (select count(*) from public.expenses where dedup_hash = 'mydata:400001000000140') <> 1 then
    raise exception 'Α2: η επανάληψη γέννησε δεύτερη δαπάνη';
  end if;
  -- Ο χρήστης απέρριψε το 141· ξανάρχεται ως auto: δεν γίνεται δαπάνη.
  update public.mydata_docs set status = 'dismissed' where mark = 400001000000141;
  perform public.mydata_ingest(lease, k, jsonb_build_array(doc_review || '{"tier":"auto","category_label":"Νερό","expense_group":"fixed"}'::jsonb), '[]'::jsonb, '[]'::jsonb, 1, null, null, true);
  if exists (select 1 from public.expenses where dedup_hash = 'mydata:400001000000141') then raise exception 'Α2: απορριμμένο έγινε δαπάνη στην επανάληψη'; end if;

  -- Ιστορικό: 139 (80,00€) και 140 (88,50€) μετρούν για τη ΔΕΗ, με κατηγορία· λάθος μίσθωση, τίποτα.
  st := public.mydata_provider_stats(lease, k);
  if (st->'090000045'->>'n')::int <> 2 or (st->'090000045'->>'avg')::int <> 8425 or st->'090000045'->>'cat' <> 'electricity' then
    raise exception 'Α2: το ιστορικό της ΔΕΗ λάθος: %', st;
  end if;
  if st ? '094079101' then raise exception 'Α2: απορριμμένο μέτρησε ως επιβεβαιωμένο'; end if;
  if public.mydata_provider_stats(gen_random_uuid(), k) <> '{}'::jsonb then raise exception 'Α2: ιστορικό χωρίς μίσθωση'; end if;

  -- Δεύτερο ακίνητο: το auto πάει για έλεγχο με pick_property.
  insert into public.user_properties(id, user_id, name) values ('ad000000-0000-4000-8000-00000000f0a2', p1, 'Δεύτερο του Π1');
  doc_two := doc_auto || '{"mark":"400001000000143","aa":"143"}'::jsonb;
  perform public.mydata_ingest(lease, k, jsonb_build_array(doc_two), '[]'::jsonb, '[]'::jsonb, 1, null, null, true);
  if (select status || '/' || tier from public.mydata_docs where mark = 400001000000143) <> 'pending/review'
     or not ((select review_reasons from public.mydata_docs where mark = 400001000000143) @> array['pick_property']) then
    raise exception 'Α2: με δύο ακίνητα το αυτόματο δεν πήγε για έλεγχο';
  end if;
  if exists (select 1 from public.expenses where dedup_hash = 'mydata:400001000000143') then raise exception 'Α2: δαπάνη σε τυχαίο ακίνητο'; end if;
  delete from public.user_properties where id = 'ad000000-0000-4000-8000-00000000f0a2';
  raise notice 'probe: Α2 αυτόματα μόνο με ένα ακίνητο, λόγοι από κλειστό κατάλογο, απορρίψεις μόνο ως πλήθος';
end $probe$;

-- Ο ξένος δεν αναιρεί· ο ίδιος αναιρεί και σβήνει ΜΟΝΟ τη δαπάνη του ΜΑΡΚ.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_auto_undo((select id from public.mydata_docs where mark = 400001000000140));
  if (r->>'ok')::boolean then raise exception 'Α2: ο Π2 αναίρεσε δαπάνη του Π1'; end if;
end $probe$;
reset role;
-- Κ-5: η αναίρεση ήρθε 200 ημέρες μετά τη λήψη. Με την παλιά ημερομηνία το
-- παραστατικό θα έσβηνε στο επόμενο καθάρισμα, πριν το δει ο χρήστης.
update public.mydata_docs set fetched_at = now() - interval '200 days' where mark = 400001000000140;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; kept int := (select count(*) from public.expenses where user_id = auth.uid()); begin
  r := public.mydata_auto_undo((select id from public.mydata_docs where mark = 400001000000140));
  if (select fetched_at from public.mydata_docs where mark = 400001000000140) < now() - interval '1 day' then
    raise exception 'Κ-5: η αναίρεση κράτησε την παλιά ημερομηνία λήψης';
  end if;
  if not (r->>'ok')::boolean or (r->>'removed')::int <> 1 then raise exception 'Α2: η αναίρεση απέτυχε: %', r; end if;
  if (select count(*) from public.expenses where user_id = auth.uid()) <> kept - 1 then raise exception 'Α2: η αναίρεση έσβησε άλλη δαπάνη'; end if;
  if (select status || '/' || tier || '/' || coalesce(filed_by, '-') from public.mydata_docs where mark = 400001000000140) <> 'pending/review/-' then
    raise exception 'Α2: μετά την αναίρεση δεν ξαναμπήκε για έλεγχο';
  end if;
  r := public.mydata_auto_undo((select id from public.mydata_docs where mark = 400001000000141));
  if (r->>'ok')::boolean then raise exception 'Α2: αναίρεση σε παραστατικό που δεν μπήκε μόνο του'; end if;
  raise notice 'probe: Α2 «Δεν είναι σωστό»: μόνο ο ίδιος, μόνο η δαπάνη του ΜΑΡΚ';
end $probe$;
reset role;
do $probe$ begin
  delete from public.expenses where dedup_hash in ('mydata:400001000000140', 'mydata:400001000000141', 'mydata:400001000000142', 'mydata:400001000000143');
  delete from public.mydata_docs where mark between 400001000000139 and 400001000000143;
end $probe$;

-- ── 6. RLS: ΔΥΟ ΛΟΓΙΣΤΕΣ, ΔΥΟ ΠΕΛΑΤΕΣ, ΕΝΑΣ ΞΕΝΟΣ ────────────────────────────
do $probe$
declare
  lease uuid := current_setting('mydata.lease')::uuid;
  r json; r2 json;
begin
  -- Ενα παραστατικό και για τον Π2, από τον Λ2.
  r := public.mydata_sync_begin('ad000000-0000-4000-8000-0000000000c2', 'manual', 'ad000000-0000-4000-8000-0000000000c2');
  r2 := public.mydata_ingest((r->>'lease')::uuid, (select id from public.mydata_consents where afm = '099000025'),
    jsonb_build_array(jsonb_build_object('mark','500000000000001','counterpart_afm','099000037','counterpart_name',null,'doc_type','2.1','series','Ε','aa','1','issue_date','2026-11-10','title','Τ','net_cents',100,'vat_cents',24,'gross_cents',124,'is_credit',false,'cancelled',false,'cancellation_mark',null)),
    '[]'::jsonb, '[]'::jsonb, 1, 500000000000001, null, true);
  if (r2->>'added')::int <> 1 then raise exception 'ΣΚΗΝΙΚΟ: το παραστατικό του Π2 δεν γράφτηκε'; end if;
  perform public.mydata_sync_end('ad000000-0000-4000-8000-0000000000c2', (r->>'lease')::uuid, null, 1);
end $probe$;

create temp table mydata_seen (who text, docs int, consents int, logs int, conns int) on commit drop;
grant insert on mydata_seen to authenticated;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
insert into mydata_seen select 'Λ1', (select count(*) from public.mydata_docs), (select count(*) from public.mydata_consents),
  (select count(*) from public.mydata_access_log), (select count(*) from public.mydata_connections);
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c2', true);
set local role authenticated;
insert into mydata_seen select 'Λ2', (select count(*) from public.mydata_docs), (select count(*) from public.mydata_consents),
  (select count(*) from public.mydata_access_log), (select count(*) from public.mydata_connections);
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
insert into mydata_seen select 'Π1', (select count(*) from public.mydata_docs), (select count(*) from public.mydata_consents),
  (select count(*) from public.mydata_access_log), (select count(*) from public.mydata_connections);
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
insert into mydata_seen select 'Π2', (select count(*) from public.mydata_docs), (select count(*) from public.mydata_consents),
  (select count(*) from public.mydata_access_log), (select count(*) from public.mydata_connections);
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000ee', true);
set local role authenticated;
insert into mydata_seen select 'Ξ', (select count(*) from public.mydata_docs), (select count(*) from public.mydata_consents),
  (select count(*) from public.mydata_access_log), (select count(*) from public.mydata_connections);
reset role;
set local role anon;
-- Το rls-probe δίνει σκόπιμα GRANT σε όλους (ελέγχεται η RLS, όχι η έλλειψη
-- δικαιώματος)· τα δικαιώματα της μετανάστευσης τα ελέγχει το anon-grants-probe.
do $probe$ declare n int; begin
  select (select count(*) from public.mydata_docs) + (select count(*) from public.mydata_consents)
       + (select count(*) from public.mydata_connections) + (select count(*) from public.mydata_access_log) into n;
  if n <> 0 then raise exception 'ΕΚΘΕΣΗ: ο ανώνυμος βλέπει % γραμμές myDATA', n; end if;
end $probe$;
reset role;

do $probe$
declare r record;
begin
  for r in select * from mydata_seen loop
    -- Θωράκιση: ο λογιστής βλέπει ΜΟΝΟ τα καταχωρημένα (102 δεμένο, 130 καταχωρημένο).
    if r.who = 'Λ1' and (r.docs <> 2 or r.consents <> 2 or r.conns <> 1) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Λ1 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Λ2' and (r.docs <> 0 or r.consents <> 1 or r.conns <> 1) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Λ2 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Π1' and (r.docs <> 6 or r.consents <> 2 or r.conns <> 0) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Π1 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Π2' and (r.docs <> 1 or r.consents <> 1 or r.conns <> 0) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Π2 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Ξ'  and (r.docs + r.consents + r.logs + r.conns) <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο ξένος βλέπει % γραμμές', r.docs + r.consents + r.logs + r.conns; end if;
    if r.who in ('Λ1', 'Λ2', 'Π1', 'Π2') and r.logs = 0 then raise exception 'ΑΡΧΕΙΟ: ο % δεν βλέπει το δικό του αρχείο πρόσβασης', r.who; end if;
  end loop;
  raise notice 'probe: δύο λογιστές, δύο πελάτες, ένας ξένος: κανείς δεν βλέπει τα του άλλου';
end $probe$;

-- (Λ1 και Π1 βλέπουν και την άδεια που ανακλήθηκε με «afm_changed» στο 1β.)
-- Ο πίνακας του λογιστή: μόνο οι δικοί του, κανένα ΑΦΜ ή ποσό.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_clients_status();
  if json_array_length(r) <> 3 then raise exception 'ΠΙΝΑΚΑΣ: ο Λ1 βλέπει % πελάτες αντί για 3 (Π1, Π3, Π5)', json_array_length(r); end if;
  if not exists (select 1 from json_array_elements(r) e where (e->>'afmConfirmed')::boolean and (e->>'quarantined')::int = 2) then
    raise exception 'H1/B1: ο πίνακας δεν δείχνει επιβεβαιωμένο ΑΦΜ και καραντίνα';
  end if;
  if r::text like '%099000025%' or r::text like '%Πελάτης Δύο%' then raise exception 'ΔΙΑΡΡΟΗ: ο πίνακας του Λ1 δείχνει τον Π2'; end if;
  if r::text like '%099000013%' then raise exception 'ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ: ο πίνακας κουβαλά ΑΦΜ'; end if;
  begin
    perform public.mydata_ingest(gen_random_uuid(), gen_random_uuid(), '[]', '[]', '[]', 0, 0, null, true);
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: ο λογιστής καλεί την εγγραφή του ρόλου υπηρεσίας';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe: ο πίνακας του λογιστή δείχνει μόνο τους δικούς του, χωρίς ΑΦΜ';
end $probe$;
reset role;

-- ── 7. ΚΑΤΑΧΩΡΗΣΗ, «ΠΑΝΤΑ ΑΓΝΟΗΣΕ», ΑΚΥΡΩΣΗ ────────────────────────────────────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$
declare
  p1 uuid := 'ad000000-0000-4000-8000-0000000000a1';
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a1';
  d101 uuid := (select id from public.mydata_docs where mark = 400001000000101);
  d110 uuid := (select id from public.mydata_docs where mark = 400001000000110);
  e uuid; r json;
begin
  -- Λάθος ποσό: δεν δένεται ποτέ ως «από το myDATA».
  insert into public.expenses (user_id, property_id, amount, vat_amount, description, category, date, dedup_hash)
    values (p1, prop, 124.01, 24.00, 'x', 'Ρεύμα', '2026-11-02', 'mydata:400001000000101') returning id into e;
  r := public.mydata_doc_filed(d101, e);
  if (r->>'ok')::boolean or r->>'reason' <> 'mismatch' then raise exception 'ΑΚΡΙΒΕΙΑ: δέθηκε δαπάνη με ποσό 124,01 αντί για 124,00'; end if;
  update public.expenses set amount = 124.00 where id = e;
  r := public.mydata_doc_filed(d101, e);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η καταχώρηση δεν δέθηκε: %', r; end if;
  -- Πιστωτικό: μόνο με αρνητικά ποσά.
  insert into public.expenses (user_id, property_id, amount, vat_amount, description, category, date, dedup_hash)
    values (p1, prop, 12.40, 2.40, 'x', 'Ρεύμα', '2026-11-20', 'mydata:400001000000110') returning id into e;
  r := public.mydata_doc_filed(d110, e);
  if (r->>'ok')::boolean then raise exception 'ΑΚΡΙΒΕΙΑ: πιστωτικό δέθηκε με θετικό ποσό'; end if;
  update public.expenses set amount = -12.40, vat_amount = -2.40 where id = e;
  r := public.mydata_doc_filed(d110, e);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: το πιστωτικό δεν δέθηκε με −12,40: %', r; end if;
  -- Ξένο παραστατικό: δεν υπάρχει για αυτόν.
  r := public.mydata_doc_filed((select id from public.mydata_docs where mark = 500000000000001), e);
  if (r->>'ok')::boolean then raise exception 'ΔΙΑΡΡΟΗ: ο Π1 έδεσε παραστατικό του Π2'; end if;
  -- «Πάντα αγνόησε»: το εκκρεμές 120 του 099000049 φεύγει.
  r := public.mydata_ignore_provider('099000049');
  if (r->>'dismissed')::int <> 1 then raise exception 'ΑΓΝΟΗΣΗ: απορρίφθηκαν % αντί για 1', r->>'dismissed'; end if;
  begin
    insert into public.mydata_docs (consent_id, client_id, client_afm, mark, counterpart_afm, doc_type, series, aa, issue_date, title, net_cents, vat_cents, gross_cents)
      values ((select id from public.mydata_consents where client_id = p1 and revoked_at is null), p1, '099000013', 9, '1', '2.1', 'a', 'b', '2026-01-01', 't', 0, 0, 0);
    raise exception 'ΠΑΡΑΒΙΑΣΗ: ο πελάτης φύτεψε παραστατικό';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe: δένεται μόνο με τα ακριβή ποσά της ΑΑΔΕ, πιστωτικό με πρόσημο, «Πάντα αγνόησε»';
end $probe$;
reset role;

do $probe$
declare
  lease uuid := current_setting('mydata.lease')::uuid;
  k uuid := (select id from public.mydata_consents where afm = '099000013' and revoked_at is null);
  manual uuid := (select expense_id from public.mydata_docs where mark = 400001000000102);
  filed uuid := (select expense_id from public.mydata_docs where mark = 400001000000101);
  r json;
begin
  r := public.mydata_ingest(lease, k,
    jsonb_build_array(jsonb_build_object('mark','400001000000140','counterpart_afm','099000049','counterpart_name',null,'doc_type','2.1','series','Ζ','aa','1','issue_date','2026-11-22','title','Τ','net_cents',100,'vat_cents',24,'gross_cents',124,'is_credit',false,'cancelled',false,'cancellation_mark',null)),
    jsonb_build_array(
      jsonb_build_object('invoice_mark','400001000000101','cancellation_mark','400001000000191'),
      jsonb_build_object('invoice_mark','400001000000102','cancellation_mark','400001000000192')),
    '[]'::jsonb, 3, 400001000000192, null, true);
  if (r->>'added')::int <> 0 then raise exception 'ΑΓΝΟΗΣΗ: γράφτηκε παραστατικό παρόχου στη λίστα «Πάντα αγνόησε»'; end if;
  if exists (select 1 from public.mydata_docs where mark = 400001000000140) then raise exception 'ΑΓΝΟΗΣΗ: η γραμμή υπάρχει'; end if;
  -- M2: η καταχωρημένη δαπάνη ΔΕΝ σβήνει μόνη της· σημειώνεται για τον χρήστη.
  if not exists (select 1 from public.expenses where id = filed) then raise exception 'M2: η ακύρωση έσβησε σιωπηλά δαπάνη που καταχώρησε ο χρήστης'; end if;
  if (select needs_attention from public.mydata_docs where mark = 400001000000101) is distinct from 'cancelled_after_filing' then
    raise exception 'M2: η ακυρωμένη καταχωρημένη δαπάνη δεν σημειώθηκε για τον χρήστη';
  end if;
  if not exists (select 1 from public.expenses where id = manual) then raise exception 'ΑΚΥΡΩΣΗ: σβήστηκε δαπάνη που έγραψε ο ίδιος ο χρήστης'; end if;
  -- Θωράκιση (Σ3): δεμένο με χειροκίνητη δαπάνη και ακυρωμένο: «Θέλει έλεγχο».
  if (select needs_attention from public.mydata_docs where mark = 400001000000102) is distinct from 'cancelled_linked' then
    raise exception 'Σ3: η ακύρωση δεμένου με χειροκίνητη δαπάνη δεν ειδοποίησε τον χρήστη';
  end if;
  if (select prev_expense_id from public.mydata_docs where mark = 400001000000102) is distinct from manual
     or (select expense_id from public.mydata_docs where mark = 400001000000101) is not null then
    raise exception 'Σ3: η δαπάνη του ακυρωμένου δεν πέρασε στο prev_expense_id';
  end if;
  if (select count(*) from public.mydata_docs where mark in (400001000000101, 400001000000102) and status = 'cancelled') <> 2 then
    raise exception 'ΑΚΥΡΩΣΗ: δεν σημειώθηκαν και τα δύο';
  end if;
  if not exists (select 1 from public.mydata_access_log where action = 'cancel_flagged') then raise exception 'M2: η σημείωση δεν καταγράφηκε'; end if;
  if exists (select 1 from public.mydata_access_log where action = 'cancel_removed_expense') then raise exception 'M2: γράφτηκε αφαίρεση χωρίς απόφαση του χρήστη'; end if;
  raise notice 'probe: M2: η ακύρωση δεν σβήνει δαπάνη· τη σημειώνει και αποφασίζει ο χρήστης';
end $probe$;

-- M2: ο χρήστης αποφασίζει. Ξένος δεν μπορεί να αποφασίσει για εκείνον.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_cancel_ack((select id from public.mydata_docs where mark = 400001000000101), true);
  if (r->>'ok')::boolean then raise exception 'M2: ο Π2 έσβησε δαπάνη του Π1'; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; e uuid := (select coalesce(expense_id, prev_expense_id) from public.mydata_docs where mark = 400001000000101); begin
  if e is null then raise exception 'ΣΚΗΝΙΚΟ: το ακυρωμένο δεν κράτησε τη δαπάνη του'; end if;
  r := public.mydata_cancel_ack((select id from public.mydata_docs where mark = 400001000000101), true);
  if not (r->>'ok')::boolean or (r->>'removed')::int <> 1 then raise exception 'M2: «Σβήσε τη δαπάνη» απέτυχε: %', r; end if;
  if exists (select 1 from public.expenses where id = e) then raise exception 'M2: η δαπάνη έμεινε μετά την απόφαση'; end if;
  if (select needs_attention from public.mydata_docs where mark = 400001000000101) is not null then raise exception 'M2: η ειδοποίηση έμεινε'; end if;
  if not exists (select 1 from public.mydata_access_log where action = 'cancel_removed_expense') then raise exception 'ΑΡΧΕΙΟ: η αφαίρεση δεν καταγράφηκε'; end if;
end $probe$;
reset role;

-- ── 8. ΣΦΑΛΜΑΤΑ: ΑΠΟΜΟΝΩΣΗ, ΕΠΑΝΑΛΗΨΗ, ΚΛΕΙΔΙ ──────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  lease uuid := current_setting('mydata.lease')::uuid;
  k uuid := (select id from public.mydata_consents where afm = '099000013' and revoked_at is null);
  c record; n int; r json;
begin
  perform public.mydata_client_done(lease, k, 'server', 0, false);
  select * into c from public.mydata_consents where id = k;
  if c.status <> 'error' or c.failures <> 1 or c.next_retry_at not between now() + interval '14 minutes' and now() + interval '16 minutes' then
    raise exception 'ΕΠΑΝΑΛΗΨΗ: 5xx δεν προγραμμάτισε νέα προσπάθεια σε 15 λεπτά (%, %, %)', c.status, c.failures, c.next_retry_at;
  end if;
  perform public.mydata_client_done(lease, k, 'server', 0, false);
  if (select next_retry_at from public.mydata_consents where id = k) < now() + interval '29 minutes' then raise exception 'ΕΠΑΝΑΛΗΨΗ: η αναμονή δεν διπλασιάστηκε'; end if;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'manual');
  if n <> 1 then raise exception 'ΕΠΑΝΑΛΗΨΗ: % στόχοι αντί για 1', n; end if;

  perform public.mydata_client_done(lease, k, 'forbidden', 0, false);
  select * into c from public.mydata_consents where id = k;
  if c.status <> 'forbidden' or c.next_retry_at is not null then raise exception '403: έπρεπε «forbidden» χωρίς αυτόματη επανάληψη'; end if;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'manual');
  if n <> 1 then raise exception '403: το «Φέρε τώρα» του λογιστή έπρεπε να ξαναδοκιμάσει'; end if;

  perform public.mydata_client_done(lease, k, 'Ocp-Apim-Subscription-Key abcd invalid', 0, false);
  if (select last_error_code from public.mydata_consents where id = k) <> 'unknown' then raise exception 'ΔΙΑΡΡΟΗ: ελεύθερο κείμενο γράφτηκε ως σφάλμα'; end if;
  if exists (select 1 from public.mydata_access_log where detail like '%Ocp%' or detail like '%abcd%') then raise exception 'ΔΙΑΡΡΟΗ: κείμενο στο αρχείο πρόσβασης'; end if;

  perform public.mydata_client_done(lease, k, null, 4, false);
  select * into c from public.mydata_consents where id = k;
  if c.status <> 'ok' or c.failures <> 0 or c.last_new <> 4 or c.next_retry_at is not null then raise exception 'ΡΟΗ: η επιτυχία δεν καθάρισε την κατάσταση'; end if;
  perform public.mydata_client_done(lease, k, null, 0, true);
  if (select next_retry_at from public.mydata_consents where id = k) is null then raise exception 'ΣΥΝΕΧΕΙΑ: «κι άλλο» χωρίς προγραμματισμένη συνέχεια'; end if;
  -- Η καραντίνα σβήνει μόνο με ολόκληρο τρέξιμο χωρίς άκυρα, όχι στη μέση των σελίδων.
  insert into public.mydata_quarantine (consent_id, client_id, client_afm, mark, reason)
  select id, client_id, afm, 400001000000150, 'invoice_type' from public.mydata_consents where id = k;
  perform public.mydata_client_done(lease, k, null, 0, true);
  if (select count(*) from public.mydata_quarantine where consent_id = k) <> 1 then raise exception 'H1: η καραντίνα σβήστηκε πριν τελειώσουν οι σελίδες'; end if;
  perform public.mydata_client_done(lease, k, null, 0, false);
  if exists (select 1 from public.mydata_quarantine where consent_id = k) then raise exception 'H1: η καραντίνα έμεινε μετά από τρέξιμο χωρίς άκυρα'; end if;

  -- H4: σημείο συνέχισης που δεν κολλά. Μη παροδικό σφάλμα: φεύγει αμέσως.
  update public.mydata_consents set resume = '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"1","dateTo":"2026-11-20"}', failures = 0 where id = k;
  perform public.mydata_client_done(lease, k, 'bad_request', 0, false);
  if (select resume from public.mydata_consents where id = k) is not null then raise exception 'H4: το σημείο συνέχισης έμεινε μετά από μη παροδικό σφάλμα'; end if;
  -- Παροδικό: μένει για δύο αποτυχίες, φεύγει στην τρίτη.
  update public.mydata_consents set resume = '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"1","dateTo":"2026-11-20"}', failures = 0 where id = k;
  perform public.mydata_client_done(lease, k, 'server', 0, false);
  perform public.mydata_client_done(lease, k, 'server', 0, false);
  if (select resume from public.mydata_consents where id = k) is null then raise exception 'H4: το σημείο συνέχισης χάθηκε σε παροδικό σφάλμα'; end if;
  perform public.mydata_client_done(lease, k, 'server', 0, false);
  if (select resume from public.mydata_consents where id = k) is not null then raise exception 'H4: το σημείο συνέχισης έμεινε μετά από τρεις αποτυχίες'; end if;
  perform public.mydata_client_done(lease, k, null, 0, false);

  -- 401: το κλειδί που δόθηκε δεν ισχύει. Δεν φυλάσσεται τίποτα για να
  -- «κλειδώσει»· η σύνδεση γράφει μόνο τον κωδικό και ο λογιστής δίνει νέο.
  perform public.mydata_sync_end(l1, lease, 'auth', 0);
  if (select last_error_code from public.mydata_connections where accountant_id = l1) is distinct from 'auth' then raise exception '401: ο κωδικός δεν γράφτηκε'; end if;
  if not exists (select 1 from public.mydata_access_log where accountant_id = l1 and action = 'key_rejected') then raise exception '401: δεν γράφτηκε στο αρχείο'; end if;
  update public.mydata_connections set last_manual_at = now() - interval '6 minutes' where accountant_id = l1;
  r := public.mydata_sync_begin(l1, 'manual', l1);
  if not (r->>'ok')::boolean then raise exception '401: νέο κλειδί δεν μπορεί να δοκιμαστεί: %', r; end if;
  perform set_config('mydata.lease', r->>'lease', true);
  raise notice 'probe: 403 απομονώνει τον πελάτη, 5xx γράφει κωδικό, 401 ζητά νέο κλειδί χωρίς να φυλάει τίποτα';
end $probe$;

-- ── 8β. H2: ΟΡΟΙ ΠΟΥ ΑΛΛΑΞΑΝ, ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΕΛΗΞΕ: ΠΑΥΣΗ, ΟΧΙ ΔΙΑΓΡΑΦΗ ─────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  p1 uuid := 'ad000000-0000-4000-8000-0000000000a1';
  lease uuid := current_setting('mydata.lease')::uuid;
  k uuid := (select id from public.mydata_consents where afm = '099000013' and revoked_at is null);
  f uuid := (select firm_id from public.accountant_clients where accountant_id = l1 and owner_id = p1);
  docs_before int := (select count(*) from public.mydata_docs where client_id = p1);
  n int;
begin
  update public.firms set terms_version = '2020-01' where id = f;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'nightly');
  if n <> 0 then raise exception 'H2: ζητείται πελάτης ενώ οι όροι του γραφείου δεν έχουν γίνει δεκτοί'; end if;
  if (select revoked_at from public.mydata_consents where id = k) is not null then raise exception 'H2: νέα έκδοση όρων ΑΝΕΚΑΛΕΣΕ την άδεια'; end if;
  if (select status from public.mydata_consents where id = k) <> 'paused' then raise exception 'H2: η άδεια δεν μπήκε σε παύση'; end if;
  if (select count(*) from public.mydata_docs where client_id = p1) <> docs_before then raise exception 'H2: η παύση έσβησε παραστατικά'; end if;
  if public.mydata_consent_live(k, lease) then raise exception 'H2: άδεια σε παύση περνά τον έλεγχο πριν από αίτημα'; end if;
  update public.firms set terms_version = private.firm_terms_version() where id = f;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'nightly');
  if n <> 1 or (select status from public.mydata_consents where id = k) = 'paused' then raise exception 'H2: η αποδοχή των όρων δεν ξεπάγωσε την άδεια'; end if;

  -- Ο σύνδεσμος έληξε (180 ημέρες): παύση αμέσως, χωρίς διαγραφή.
  update public.accountant_links set expires_at = now() - interval '1 day' where user_id = p1;
  set constraints all immediate;
  set constraints all deferred;
  if (select revoked_at from public.mydata_consents where id = k) is not null then raise exception 'H2: η λήξη του συνδέσμου ΑΝΕΚΑΛΕΣΕ την άδεια'; end if;
  if (select status from public.mydata_consents where id = k) <> 'paused' then raise exception 'H2: η λήξη του συνδέσμου δεν έβαλε παύση'; end if;
  if (select count(*) from public.mydata_docs where client_id = p1) <> docs_before then raise exception 'H2: η λήξη έσβησε παραστατικά'; end if;
  update public.accountant_links set expires_at = null where user_id = p1;
  set constraints all immediate;
  set constraints all deferred;
  if (select status from public.mydata_consents where id = k) = 'paused' then raise exception 'H2: η ανανέωση του συνδέσμου δεν ξεπάγωσε την άδεια'; end if;
  raise notice 'probe: H2: όροι ή λήξη συνδέσμου παγώνουν την άδεια χωρίς να σβήσουν τίποτα';
end $probe$;

-- ── 9. ΑΝΑΚΛΗΣΗ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ ─────────────────────────────────────────────────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$
declare
  r json;
  kept int := (select count(*) from public.expenses where user_id = auth.uid());
begin
  r := public.mydata_consent_revoke('ad000000-0000-4000-8000-0000000000c1');
  if not (r->>'ok')::boolean or (r->>'deleted')::int < 1 then raise exception 'ΑΝΑΚΛΗΣΗ: δεν σβήστηκαν παραστατικά: %', r; end if;
  if exists (select 1 from public.mydata_docs where client_id = auth.uid()) then raise exception 'ΓΚΠΔ: έμειναν παραστατικά μετά την ανάκληση'; end if;
  if (select count(*) from public.expenses where user_id = auth.uid()) <> kept then raise exception 'ΑΝΑΚΛΗΣΗ: σβήστηκαν δαπάνες του πελάτη'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = auth.uid() and action = 'consent_revoked') then raise exception 'ΑΡΧΕΙΟ: η ανάκληση δεν καταγράφηκε'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'client') then raise exception 'ΑΝΑΚΛΗΣΗ: η γραμμή συναίνεσης δεν έμεινε ως απόδειξη'; end if;
  raise notice 'probe: ανάκληση: σβήνουν τα παραστατικά, μένουν οι δαπάνες και το αρχείο';
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ begin
  if exists (select 1 from public.mydata_docs) then raise exception 'ΔΙΑΡΡΟΗ: ο λογιστής βλέπει παραστατικά μετά την ανάκληση'; end if;
end $probe$;
reset role;

do $probe$ declare n int; begin
  select count(*) into n from public.mydata_sync_targets('ad000000-0000-4000-8000-0000000000c1', current_setting('mydata.lease')::uuid, 'manual');
  if n <> 0 then raise exception 'ΑΝΑΚΛΗΣΗ: ο πελάτης που ανακάλεσε είναι ακόμη στόχος'; end if;
end $probe$;

-- ── 10. ΑΛΛΑΓΗ ΛΟΓΙΣΤΗ ΚΑΙ ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ ────────────────────────────────────
-- Ο Λ2 συνδέεται και με τον Π1. Ο Π1 ξαναδίνει άδεια στον Λ1, μετά στον Λ2:
-- ένας συγχρονιστής ανά πελάτη, η άδεια του Λ1 φεύγει.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p1'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ2→Π1 %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a1', '099000013');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ο Λ2 επιβεβαιώνει τον Π1: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  -- Σ6: χωρίς ρητή επιβεβαίωση ο προηγούμενος λογιστής δεν ανακαλείται.
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c2', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'switch_confirm' then raise exception 'Σ6: αλλαγή λογιστή χωρίς επιβεβαίωση: %', r; end if;
  if (select accountant_id from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> 'ad000000-0000-4000-8000-0000000000c1' then
    raise exception 'Σ6: η άρνηση άλλαξε τον λογιστή';
  end if;
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c2', y, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true, true);
  if not (r->>'ok')::boolean then raise exception 'ΑΛΛΑΓΗ: η άδεια στον Λ2 απέτυχε: %', r; end if;
  if (select count(*) from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> 1 then raise exception 'ΑΛΛΑΓΗ: δύο ενεργοί συγχρονιστές'; end if;
  if (select accountant_id from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> 'ad000000-0000-4000-8000-0000000000c2' then raise exception 'ΑΛΛΑΓΗ: έμεινε ο Λ1'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'switched') then raise exception 'ΑΛΛΑΓΗ: η παλιά άδεια δεν σημειώθηκε'; end if;
  -- Ο πελάτης κόβει τη σύνδεση στο PROPERWISE με τον Λ2: η άδεια φεύγει μόνη της.
  update public.accountant_clients set active = false where owner_id = auth.uid() and accountant_id = 'ad000000-0000-4000-8000-0000000000c2';
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoked_at is null) then raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: η αποσύνδεση άφησε ενεργή άδεια'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'unlinked') then raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: χωρίς αιτία'; end if;
  raise notice 'probe: ένας συγχρονιστής ανά πελάτη· η αποσύνδεση ανακαλεί μόνη της';
end $probe$;
reset role;

-- Ο λογιστής αφαιρεί τον πελάτη (διαγραφή γραμμής).
do $probe$ begin
  delete from public.accountant_clients where owner_id = 'ad000000-0000-4000-8000-0000000000a2' and accountant_id = 'ad000000-0000-4000-8000-0000000000c2';
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a2' and revoked_at is null) then
    raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: η αφαίρεση από τον λογιστή άφησε ενεργή άδεια';
  end if;
  if exists (select 1 from public.mydata_docs where client_id = 'ad000000-0000-4000-8000-0000000000a2') then
    raise exception 'ΓΚΠΔ: έμειναν παραστατικά μετά την αφαίρεση';
  end if;
  raise notice 'probe: όταν ο λογιστής αφαιρεί τον πελάτη, η άδεια και τα παραστατικά φεύγουν';
end $probe$;

-- H3: νέο token συνδέσμου (ο πελάτης κόβει τον λογιστή περιστρέφοντας τον
-- σύνδεσμο): η άδεια φεύγει ΑΜΕΣΩΣ, χωρίς να περιμένει συγχρονισμό, ακόμη κι αν
-- ο λογιστής δεν έχει κλειδί ή δεν συγχρονίζει ποτέ.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; begin
  update public.accountant_clients set active = true where owner_id = auth.uid() and accountant_id = 'ad000000-0000-4000-8000-0000000000c1';
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ξανά άδεια στον Λ1: %', r; end if;
end $probe$;
reset role;
do $probe$ declare n int; r json; k uuid; begin
  k := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a1' and revoked_at is null);
  update public.accountant_links set token = 'mydata-probe-p1-rotated' where user_id = 'ad000000-0000-4000-8000-0000000000a1';
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where id = k and revoked_at is null) then
    raise exception 'H3: νέο token συνδέσμου άφησε ενεργή την άδεια ως τον επόμενο συγχρονισμό';
  end if;
  if (select revoke_reason from public.mydata_consents where id = k) <> 'unlinked' then raise exception 'H3: λάθος αιτία ανάκλησης'; end if;
  if exists (select 1 from public.mydata_docs where consent_id = k) then raise exception 'H3: έμειναν παραστατικά μετά την αποσύνδεση'; end if;
  -- M4: σελίδα που ήρθε αφού κόπηκε η άδεια: απορρίπτεται ΚΑΙ γράφεται.
  r := public.mydata_ingest(current_setting('mydata.lease')::uuid, k, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 4, null, null, true);
  if (r->>'ok')::boolean then raise exception 'H3: εγγραφή σε άδεια που ανακλήθηκε'; end if;
  if not exists (select 1 from public.mydata_access_log l where l.action = 'page_rejected' and l.n = 4 and l.client_id = 'ad000000-0000-4000-8000-0000000000a1') then
    raise exception 'M4: η σελίδα που απορρίφθηκε δεν γράφτηκε στο αρχείο πρόσβασης';
  end if;
  raise notice 'probe: H3: νέο token ανακαλεί αμέσως· M4: η σελίδα που απορρίφθηκε καταγράφεται';
end $probe$;

-- ── 10β. ΓΡΑΦΕΙΟ: ΜΕΛΟΣ ΧΩΡΙΣ ΓΡΑΜΜΗ (M5), ΑΝΑΘΕΣΗ ΚΑΙ ΜΕΛΟΣ ΠΟΥ ΦΕΥΓΟΥΝ (H3) ──
-- Ο Λ3 μπαίνει στο γραφείο του Λ1 ως υπεύθυνος: βλέπει τον Π5 μέσω γραφείου,
-- αλλά δεν έχει δική του γραμμή, άρα δεν παίρνει άδεια myDATA.
do $probe$ begin
  insert into public.firm_members (firm_id, user_id, email, role, status, joined_at)
  values ((select firm_id from public.accountant_clients where accountant_id = 'ad000000-0000-4000-8000-0000000000c1'
            and owner_id = 'ad000000-0000-4000-8000-0000000000a5'),
          'ad000000-0000-4000-8000-0000000000c3', 'l3@mydata.test', 'manager', 'active', now());
  if not public.accountant_link_live('ad000000-0000-4000-8000-0000000000c3', 'ad000000-0000-4000-8000-0000000000a5') then
    raise exception 'ΣΚΗΝΙΚΟ: ο Λ3 δεν βλέπει τον Π5 μέσω γραφείου';
  end if;
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a5', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c3', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'not_linked' then raise exception 'M5: άδεια σε μέλος γραφείου χωρίς δική του γραμμή: %', r; end if;
  raise notice 'probe: M5: άδεια μόνο σε λογιστή με δική του γραμμή σύνδεσης';
end $probe$;
reset role;
-- Ο Λ3 γίνεται απλό μέλος και διεκδικεί τον Π5: η ανάθεση γίνεται μόνη της.
do $probe$ begin
  update public.firm_members set role = 'accountant' where user_id = 'ad000000-0000-4000-8000-0000000000c3';
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c3', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p5'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ3→Π5 %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a5', '801000012');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ο Λ3 επιβεβαιώνει τον Π5: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a5', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c3', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: άδεια του Π5 στον Λ3: %', r; end if;
end $probe$;
reset role;
-- H3: η ανάθεση φεύγει: η άδεια φεύγει αμέσως.
do $probe$ declare r json; begin
  delete from public.firm_client_assignees where user_id = 'ad000000-0000-4000-8000-0000000000c3';
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a5' and revoked_at is null) then
    raise exception 'H3: αφαίρεση ανάθεσης άφησε ενεργή την άδεια';
  end if;
  insert into public.firm_client_assignees (firm_id, owner_id, user_id)
  select firm_id, 'ad000000-0000-4000-8000-0000000000a5', 'ad000000-0000-4000-8000-0000000000c3'
    from public.firm_members where user_id = 'ad000000-0000-4000-8000-0000000000c3';
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a5', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c3', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ξανά άδεια του Π5 στον Λ3: %', r; end if;
end $probe$;
reset role;
-- H3: το μέλος φεύγει από το γραφείο: η άδεια φεύγει αμέσως.
do $probe$ begin
  update public.firm_members set status = 'removed', removed_at = now() where user_id = 'ad000000-0000-4000-8000-0000000000c3';
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a5' and revoked_at is null) then
    raise exception 'H3: αφαίρεση μέλους από το γραφείο άφησε ενεργή την άδεια';
  end if;
  if (select count(*) from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a5' and revoke_reason = 'unlinked') <> 2 then
    raise exception 'H3: οι δύο ανακλήσεις του Π5 δεν γράφτηκαν ως αποσύνδεση';
  end if;
  raise notice 'probe: H3: ανάθεση ή μέλος που φεύγει από το γραφείο ανακαλεί αμέσως';
end $probe$;

-- ── 11. ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ ΤΟΥ ΛΟΓΙΣΤΗ (Κ-3 / Ε-10) ───────────────────────
-- Η απόδειξη της συναίνεσης ανήκει και στους δύο από κοινού υπευθύνους: δεν
-- σβήνει όταν σβήσει ο λογιστής τον λογαριασμό του. Η άδεια ανακαλείται με
-- αιτία `accountant_deleted`, όπως κάθε ανάκληση· οι δαπάνες μένουν.
do $probe$ declare k uuid; begin
  -- Ενεργή άδεια του Λ2, με ένα παραστατικό και λειτουργικά πεδία γεμάτα.
  insert into auth.users(id, email) values ('ad000000-0000-4000-8000-0000000000b2', 'b2@mydata.test');
  insert into public.mydata_consents (client_id, accountant_id, afm, window_from, consent_text_version, consent_text_hash,
                                      health_consent, last_mark, resume, last_error_code, next_retry_at)
  values ('ad000000-0000-4000-8000-0000000000b2', 'ad000000-0000-4000-8000-0000000000c2', '801000061', '2026-01-01',
          '2026-11-24', repeat('a', 64), true, 500000000000009, '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"1"}',
          'server', now() + interval '1 hour')
  returning id into k;
  insert into public.mydata_docs (consent_id, client_id, client_afm, mark, counterpart_afm, doc_type, series, aa, issue_date, title,
                                  net_cents, vat_cents, gross_cents)
  values (k, 'ad000000-0000-4000-8000-0000000000b2', '801000061', 500000000000009, '099000037', '2.1', 'Α', '1', '2026-11-01', 'Τ', 100, 24, 124);
  delete from auth.users where id = 'ad000000-0000-4000-8000-0000000000c2';
  set constraints all immediate;
  set constraints all deferred;
  if not exists (select 1 from public.mydata_consents where id = k) then raise exception 'Κ-3: η απόδειξη συναίνεσης σβήστηκε μαζί με τον λογιστή'; end if;
  if (select accountant_id from public.mydata_consents where id = k) is not null then raise exception 'Κ-3: η άδεια δείχνει ακόμη τον λογιστή'; end if;
  if (select revoke_reason from public.mydata_consents where id = k) is distinct from 'accountant_deleted'
     or (select revoked_at from public.mydata_consents where id = k) is null then
    raise exception 'Κ-3: η άδεια δεν ανακλήθηκε με αιτία';
  end if;
  if (select consent_text_hash from public.mydata_consents where id = k) is null then raise exception 'Κ-3: χάθηκε το αποτύπωμα του κειμένου'; end if;
  -- Ε-8: η απόδειξη κρατά μόνο ό,τι αποδεικνύει τη συναίνεση· τα λειτουργικά πεδία μηδενίζονται.
  if (select last_mark <> 0 or resume is not null or last_error_code is not null or next_retry_at is not null
        from public.mydata_consents where id = k) then
    raise exception 'Ε-8: η ανάκληση κράτησε λειτουργικά πεδία';
  end if;
  if exists (select 1 from public.mydata_docs where consent_id = k) then raise exception 'Κ-3: έμειναν παραστατικά της άδειας που ανακλήθηκε'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a2' and accountant_id is null) then
    raise exception 'ΔΙΑΓΡΑΦΗ: το αρχείο πρόσβασης του πελάτη χάθηκε μαζί με τον λογιστή';
  end if;
  raise notice 'probe: Κ-3: ο λογιστής σβήνει τον λογαριασμό του, η απόδειξη συναίνεσης και το αρχείο μένουν';
end $probe$;

-- ── 12. ΟΡΙΟ ΔΙΑΤΗΡΗΣΗΣ ────────────────────────────────────────────────────────
do $probe$ begin
  update public.mydata_access_log set at = now() - interval '25 months' where client_id = 'ad000000-0000-4000-8000-0000000000a2';
  perform private.mydata_prune();
  if exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a2') then raise exception 'ΔΙΑΤΗΡΗΣΗ: αρχείο παλαιότερο των 24 μηνών'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a1') then raise exception 'ΔΙΑΤΗΡΗΣΗ: σβήστηκε πρόσφατο αρχείο'; end if;
  raise notice 'probe: το αρχείο πρόσβασης κρατά 24 μήνες';
end $probe$;

-- ── 13. ΔΕΥΤΕΡΗ ΑΞΙΟΛΟΓΗΣΗ (N1–N7) ─────────────────────────────────────────────
-- Νέος λογιστής Λ4 με πελάτες Π6 και Π7, ώστε η κατάσταση να μην εξαρτάται από
-- τα προηγούμενα βήματα.
do $probe$ begin
  insert into auth.users(id, email) values
    ('ad000000-0000-4000-8000-0000000000c4', 'l4@mydata.test'),
    ('ad000000-0000-4000-8000-0000000000a6', 'p6@mydata.test'),
    ('ad000000-0000-4000-8000-0000000000a7', 'p7@mydata.test');
  insert into public.billing_profiles(user_id, afm, owner_name) values
    ('ad000000-0000-4000-8000-0000000000a6', '801000024', 'Πελάτης Έξι'),
    ('ad000000-0000-4000-8000-0000000000a7', '099000037', 'Πελάτης Επτά')
  on conflict (user_id) do update set afm = excluded.afm, owner_name = excluded.owner_name;
  insert into public.accountant_links(user_id, token, active) values
    ('ad000000-0000-4000-8000-0000000000a6', 'mydata-probe-p6', true),
    ('ad000000-0000-4000-8000-0000000000a7', 'mydata-probe-p7', true);
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c4', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p6'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ4→Π6 %', r; end if;
  r := public.accountant_claim('mydata-probe-p7'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ4→Π7 %', r; end if;
  -- N1: ένα ΑΦΜ επιβεβαιώνεται για έναν μόνο πελάτη ανά λογιστή.
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a6', '801000024');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: επιβεβαίωση Π6: %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a7', '801000024');
  if (r->>'ok')::boolean or r->>'reason' <> 'afm_taken' then raise exception 'N1: το ΑΦΜ του Π6 επιβεβαιώθηκε και για τον Π7: %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a7', '099000037');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: επιβεβαίωση Π7: %', r; end if;
end $probe$;
reset role;
do $probe$ begin
  begin
    update public.mydata_afm_confirmations set afm = '801000024'
     where accountant_id = 'ad000000-0000-4000-8000-0000000000c4' and client_id = 'ad000000-0000-4000-8000-0000000000a7';
    raise exception 'N1: το σχήμα δέχτηκε το ίδιο ΑΦΜ σε δύο πελάτες του ίδιου λογιστή';
  exception when unique_violation then null;
  end;
  raise notice 'probe: N1: ένα ΑΦΜ, ένας πελάτης ανά λογιστή';
end $probe$;
-- N1: ο Π6 αλλάζει το ΑΦΜ του προφίλ μετά τη σύνδεση: η κάρτα του στον λογιστή το σημαδεύει.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a6', true);
set local role authenticated;
do $probe$ begin
  update public.billing_profiles set afm = '099000049' where user_id = auth.uid();
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c4', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_clients_status();
  if not exists (select 1 from json_array_elements(r) e where e->>'ownerId' = 'ad000000-0000-4000-8000-0000000000a6' and e->>'afmChangedAt' is not null) then
    raise exception 'N1: η αλλαγή ΑΦΜ του Π6 μετά τη σύνδεση δεν σημαδεύτηκε';
  end if;
  if exists (select 1 from json_array_elements(r) e where e->>'ownerId' = 'ad000000-0000-4000-8000-0000000000a7' and e->>'afmChangedAt' is not null) then
    raise exception 'N1: σημάδι αλλαγής σε πελάτη που δεν άλλαξε τίποτα';
  end if;
  if r::text like '%099000049%' then raise exception 'N1: το σημάδι κουβαλά την τιμή του ΑΦΜ'; end if;
  raise notice 'probe: N1: η αλλαγή ΑΦΜ μετά τη σύνδεση φαίνεται στον λογιστή, χωρίς την τιμή';
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a6', true);
set local role authenticated;
do $probe$ begin update public.billing_profiles set afm = '801000024' where user_id = auth.uid(); end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a7', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c4', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: άδεια Π7: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a6', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c4', extract(year from (now() at time zone 'Europe/Athens'))::int, '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: άδεια Π6: %', r; end if;
end $probe$;
reset role;

do $probe$
declare
  l4 uuid := 'ad000000-0000-4000-8000-0000000000c4';
  k7 uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a7' and revoked_at is null);
  r json; lease uuid; n int; c record;
begin
  perform pg_temp.joint(l4);
  r := public.mydata_sync_begin(l4, 'manual', l4);
  lease := (r->>'lease')::uuid;
  -- N7: η χρήση του κλειδιού γράφεται στο αρχείο, χωρίς το κλειδί.
  if not exists (select 1 from public.mydata_access_log l where l.accountant_id = l4 and l.action = 'key_used' and l.actor_id = l4 and l.detail = 'manual') then
    raise exception 'N7: η χρήση του κλειδιού δεν γράφτηκε στο αρχείο πρόσβασης';
  end if;

  -- N3: καραντίνα που δεν λύθηκε: όχι κάθε νύχτα.
  select count(*) into n from public.mydata_sync_targets(l4, lease, 'nightly', 'r1');
  if n <> 2 then raise exception 'ΣΚΗΝΙΚΟ: % στόχοι αντί για 2', n; end if;
  perform public.mydata_client_done(lease, k7, 'quarantine', 0, false);
  if (select count(*) from public.mydata_sync_targets(l4, lease, 'nightly', 'r1') t where t.consent_id = k7) <> 0 then
    raise exception 'N3: πελάτης σε καραντίνα ξαναζητείται την επόμενη νύχτα';
  end if;
  if (select count(*) from public.mydata_sync_targets(l4, lease, 'retry', 'r1') t where t.consent_id = k7) <> 0 then
    raise exception 'N3: πελάτης σε καραντίνα ξαναζητείται στην επανάληψη';
  end if;
  if (select count(*) from public.mydata_sync_targets(l4, lease, 'manual', 'r1') t where t.consent_id = k7) <> 1 then
    raise exception 'N3: ο λογιστής δεν μπορεί να ξαναζητήσει με «τώρα»';
  end if;
  if (select count(*) from public.mydata_sync_targets(l4, lease, 'nightly', 'r2') t where t.consent_id = k7) <> 1 then
    raise exception 'N3: νέα έκδοση του αναγνώστη δεν ξαναζητά αμέσως';
  end if;
  update public.mydata_consents set quarantine_at = now() - interval '8 days' where id = k7;
  if (select count(*) from public.mydata_sync_targets(l4, lease, 'nightly', 'r1') t where t.consent_id = k7) <> 1 then
    raise exception 'N3: μετά από μία εβδομάδα δεν ξαναζητείται';
  end if;

  -- N6: μερικό τρέξιμο με καραντίνα: «Θέλει έλεγχο» από τώρα, το σημείο συνέχισης μένει.
  insert into public.mydata_quarantine (consent_id, client_id, client_afm, mark, reason)
  select id, client_id, afm, 700000000000001, 'invoice_type' from public.mydata_consents where id = k7;
  update public.mydata_consents set resume = '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"1"}', status = 'ok', last_error_code = null where id = k7;
  perform public.mydata_client_done(lease, k7, null, 0, true);
  select * into c from public.mydata_consents where id = k7;
  if c.status <> 'error' or c.last_error_code is distinct from 'quarantine' then raise exception 'N6: μερικό τρέξιμο με καραντίνα γράφτηκε «%»', c.status; end if;
  if c.resume is null then raise exception 'N6: το σημείο συνέχισης χάθηκε'; end if;

  perform public.mydata_sync_end(l4, lease, null, 0);

  -- N4: παύση πάνω από 90 ημέρες: ανάκληση στο καθάρισμα.
  update public.accountant_links set expires_at = now() - interval '1 day' where user_id = 'ad000000-0000-4000-8000-0000000000a7';
  set constraints all immediate;
  set constraints all deferred;
  if (select status from public.mydata_consents where id = k7) <> 'paused' then raise exception 'ΣΚΗΝΙΚΟ: ο Π7 δεν μπήκε σε παύση'; end if;
  perform private.mydata_prune();
  if (select revoked_at from public.mydata_consents where id = k7) is not null then raise exception 'N4: παύση μίας ημέρας ανακλήθηκε'; end if;
  update public.mydata_consents set paused_at = now() - interval '91 days' where id = k7;
  perform private.mydata_prune();
  if (select revoke_reason from public.mydata_consents where id = k7) is distinct from 'pause_expired' then
    raise exception 'N4: παύση 91 ημερών δεν ανακλήθηκε';
  end if;

  -- N4: υποβιβασμός σε «associate» είναι αποσύνδεση, όχι παύση.
  update public.firm_members set role = 'associate' where user_id = l4;
  set constraints all immediate;
  set constraints all deferred;
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a6' and revoked_at is null) then
    raise exception 'N4: υποβιβασμός ρόλου έδωσε παύση αντί για ανάκληση';
  end if;

  -- N5: σταθερή σειρά κλειδώματος στη σάρωση.
  if pg_get_functiondef('private.mydata_revoke_dead(uuid,uuid)'::regprocedure) !~ 'order by c\.id\s+for update' then
    raise exception 'N5: η σάρωση κλειδώνει χωρίς σειρά';
  end if;
  raise notice 'probe: N2–N7: αναμονή που μένει, καραντίνα εβδομαδιαία, παύση 90 ημερών, ρόλος, σειρά, ανάγνωση κλειδιού';
end $probe$;


-- ═══ 12. ΘΩΡΑΚΙΣΗ 24/11/2026 (20261124100000) ══════════════════════════════
-- Νέα πρόσωπα, για να μην εξαρτάται από όσα έγιναν πιο πάνω: ο λογιστής Λ8 με
-- τον πελάτη Π8 (ένα ακίνητο), ο Λ9 που δεν έχει κανέναν πελάτη ούτε γραφείο.
do $probe$
declare
  l8 uuid := 'ad000000-0000-4000-8000-0000000000c8';
  l9 uuid := 'ad000000-0000-4000-8000-0000000000c9';
  p8 uuid := 'ad000000-0000-4000-8000-0000000000a8';
begin
  insert into auth.users(id, email) values (l8, 'l8@mydata.test'), (l9, 'l9@mydata.test'), (p8, 'p8@mydata.test');
  insert into public.billing_profiles(user_id, afm, owner_name) values (p8, '801000036', 'Πελάτης Οκτώ')
  on conflict (user_id) do update set afm = excluded.afm, owner_name = excluded.owner_name;
  insert into public.user_properties(id, user_id, name) values ('ad000000-0000-4000-8000-00000000f0a8', p8, 'Του Π8');
  insert into public.accountant_links(user_id, token, active) values (p8, 'mydata-probe-p8', true);
  perform pg_temp.joint(l8);
  perform pg_temp.joint(l9);
end $probe$;

-- Τα παραστατικά των δοκιμών: ό,τι λείπει από το `extra` παίρνει ουδέτερη τιμή.
create function pg_temp.md(p_mark text, p_afm text, p_gross int, p_issue text, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('mark', p_mark, 'counterpart_afm', p_afm, 'counterpart_name', null, 'doc_type', '2.1',
    'series', 'Θ', 'aa', right(p_mark, 4), 'issue_date', p_issue, 'title', 'Τιμολόγιο Παροχής Υπηρεσιών Θ ' || right(p_mark, 4),
    'net_cents', p_gross, 'vat_cents', 0, 'gross_cents', p_gross, 'is_credit', false, 'cancelled', false,
    'cancellation_mark', null, 'tier', 'review', 'category', null, 'category_label', null, 'expense_group', null,
    'reasons', '[]'::jsonb, 'correlated_mark', null) || extra;
$$;

-- ── 12α. ΔΕΥΤΕΡΟ ΒΗΜΑ ΓΙΑ ΚΑΘΕ ΕΝΕΡΓΕΙΑ myDATA ΤΟΥ ΛΟΓΙΣΤΗ (Σ1 νομικού) ──────
-- Ο Λ9 δεν έχει συσκευή ούτε γραφείο: το `mfa_satisfied` τον περνά με aal1.
-- Ο,τι αφορά το myDATA πρέπει να τον σταματά.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c9', true);
select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
set local role authenticated;
do $probe$ declare r json; n int; begin
  if not private.mfa_satisfied() then raise exception 'ΣΚΗΝΙΚΟ: ο Λ9 έπρεπε να περνά το mfa_satisfied με aal1'; end if;
  begin
    r := public.mydata_clients_status();
    raise exception 'Σ1: ο πίνακας myDATA απάντησε χωρίς δεύτερο βήμα: %', r;
  exception when insufficient_privilege then null;
  end;
  begin
    r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a8', '801000036');
    raise exception 'Σ1: επιβεβαίωση ΑΦΜ χωρίς δεύτερο βήμα: %', r;
  exception when insufficient_privilege then null;
  end;
  begin
    r := public.mydata_joint_accept(private.mydata_joint_version());
    raise exception 'Σ1: αποδοχή της ρύθμισης χωρίς δεύτερο βήμα: %', r;
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.mydata_connections;
  if n <> 0 then raise exception 'Σ1: ο λογιστής βλέπει τη σύνδεσή του χωρίς δεύτερο βήμα'; end if;
end $probe$;
reset role;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c9', true);
set local role authenticated;
do $probe$ declare n int; begin
  select count(*) into n from public.mydata_connections;
  if n <> 1 then raise exception 'Σ1: με δεύτερο βήμα ο Λ9 δεν βλέπει τη σύνδεσή του (%)', n; end if;
  raise notice 'probe: Σ1: κάθε ενέργεια myDATA του λογιστή θέλει δεύτερο βήμα ακόμη και χωρίς γραφείο';
end $probe$;
reset role;

-- Ο Λ8 διεκδικεί τον Π8 και επιβεβαιώνει το ΑΦΜ του.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c8', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p8'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ8→Π8 %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a8', '801000036');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ο Λ8 επιβεβαιώνει τον Π8: %', r; end if;
end $probe$;
reset role;

-- ── 12β. ΣΥΝΑΙΝΕΣΗ ΜΕ ΚΕΙΜΕΝΟ ΚΑΙ ΡΗΤΟ ΤΙΚ ΓΙΑ ΥΓΕΙΑ (Κ4 νομικού) ───────────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$
declare
  l8 uuid := 'ad000000-0000-4000-8000-0000000000c8';
  y  int  := extract(year from (now() at time zone 'Europe/Athens'))::int;
  h  text := 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417';
  r  json;
begin
  r := public.mydata_consent_grant(l8, y, '2026-11-24', repeat('0', 64), true);
  if (r->>'ok')::boolean or r->>'reason' <> 'text_outdated' then raise exception 'Κ4: άδεια με κείμενο που η βάση δεν ξέρει: %', r; end if;
  -- Ε-4/Κ-7: η έκδοση 2026-11-24 (χωρίς από κοινού υπευθύνους) δεν γίνεται πια δεκτή.
  r := public.mydata_consent_grant(l8, y, '2026-11-24', '0ae5ce6725e8c46752fd7004ba21dea8dd0340d139fcf1f1e8a71a9be858cba5', true);
  if (r->>'ok')::boolean or r->>'reason' <> 'text_outdated' then raise exception 'Ε-4: άδεια με το παλιό κείμενο: %', r; end if;
  r := public.mydata_consent_grant(l8, y, '2026-11-23', h, true);
  if (r->>'ok')::boolean or r->>'reason' <> 'text_outdated' then raise exception 'Κ4: άδεια με άλλη έκδοση: %', r; end if;
  r := public.mydata_consent_grant(l8, y, '2026-11-24.2', h, false);
  if (r->>'ok')::boolean or r->>'reason' <> 'health_unchecked' then raise exception 'Κ4: άδεια χωρίς το τικ για την υγεία: %', r; end if;
  r := public.mydata_consent_grant(l8, y, '2026-11-24.2', h, null);
  if (r->>'ok')::boolean then raise exception 'Κ4: άδεια με κενό τικ για την υγεία'; end if;
  r := public.mydata_consent_grant(l8, y, '2026-11-24.2', h, true);
  if not (r->>'ok')::boolean then raise exception 'Κ4: η σωστή άδεια απέτυχε: %', r; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoked_at is null
                  and consent_text_version = '2026-11-24.2' and consent_text_hash = h and health_consent) then
    raise exception 'Κ4: η άδεια δεν κράτησε έκδοση, αποτύπωμα και τικ';
  end if;
  raise notice 'probe: Κ4: η άδεια κρατά ποιο κείμενο διάβασε ο χρήστης και το ρητό τικ';
end $probe$;
reset role;

-- ── 12γ. ΑΥΤΟΜΑΤΟ ΜΟΝΟ ΜΕ ΙΣΤΟΡΙΚΟ ΑΝΑ ΠΑΡΟΧΟ ΚΑΙ ΑΚΙΝΗΤΟ (Σ1 λογιστικού) ────
do $probe$
declare
  l8 uuid := 'ad000000-0000-4000-8000-0000000000c8';
  p8 uuid := 'ad000000-0000-4000-8000-0000000000a8';
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a8';
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  lease uuid;
  auto jsonb := '{"tier":"auto","category":"electricity","category_label":"Ρεύμα","expense_group":"fixed"}';
  r json; e uuid;
begin
  r := public.mydata_sync_begin(l8, 'manual', l8);
  lease := (r->>'lease')::uuid;
  perform set_config('mydata.lease8', lease::text, true);
  -- Ιστορικό του ίδιου παρόχου με δαπάνη ΧΩΡΙΣ ακίνητο: δεν μετρά για το ακίνητο.
  insert into public.expenses (user_id, property_id, amount, description, category, date, dedup_hash)
    values (p8, null, 80.00, 'Ρεύμα σπιτιού', 'Ρεύμα', '2026-09-01', 'mydata:700000000000001') returning id into e;
  r := public.mydata_ingest(lease, k, jsonb_build_array(
         pg_temp.md('700000000000001', '801000048', 8000, '2026-09-01', '{"category":"electricity"}')),
       '[]', '[]', 1, null, null, false);
  if (select status from public.mydata_docs where mark = 700000000000001) <> 'filed' then raise exception 'ΣΚΗΝΙΚΟ: το ιστορικό δεν καταχωρήθηκε'; end if;
  r := public.mydata_ingest(lease, k, jsonb_build_array(pg_temp.md('700000000000002', '801000048', 8100, '2026-10-01', auto)),
       '[]', '[]', 1, null, null, false);
  if (select status || '/' || tier from public.mydata_docs where mark = 700000000000002) <> 'pending/review'
     or not ((select review_reasons from public.mydata_docs where mark = 700000000000002) @> array['new_provider']) then
    raise exception 'Σ1: αυτόματο με ιστορικό που δεν αφορά αυτό το ακίνητο';
  end if;
  -- Ιστορικό του ίδιου παρόχου ΣΤΟ ακίνητο: το επόμενο μπαίνει αυτόματα.
  update public.expenses set property_id = prop where id = e;
  r := public.mydata_ingest(lease, k, jsonb_build_array(pg_temp.md('700000000000003', '801000048', 8200, '2026-11-01', auto)),
       '[]', '[]', 1, null, null, false);
  if (select status || '/' || filed_by from public.mydata_docs where mark = 700000000000003) <> 'filed/auto' then
    raise exception 'Σ1: με ιστορικό στο ίδιο ακίνητο το αυτόματο δεν έγινε';
  end if;
  raise notice 'probe: Σ1: το αυτόματο θέλει επιβεβαίωση του ίδιου παρόχου για το ίδιο ακίνητο';
end $probe$;

-- ── 12δ. ΑΝΕΚΤΙΚΟ ΤΑΙΡΙΑΣΜΑ ΜΕ ΧΕΙΡΟΚΙΝΗΤΗ ΔΑΠΑΝΗ (Σ2 λογιστικού) ──────────
do $probe$
declare
  p8 uuid := 'ad000000-0000-4000-8000-0000000000a8';
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a8';
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  lease uuid := current_setting('mydata.lease8')::uuid;
  bycat uuid; byaa uuid; tooFar uuid; r json;
begin
  -- Ο χρήστης πέρασε τον λογαριασμό 9 ημέρες μετά, στρογγυλεμένο, με άλλη επωνυμία: ίδια κατηγορία.
  insert into public.expenses (user_id, property_id, amount, description, category, date, store_vendor)
    values (p8, prop, 50.00, 'Λογαριασμός νερού', 'Νερό', '2026-11-19', 'Ύδρευση δήμου') returning id into bycat;
  -- Ποσό εντελώς άλλο, αλλά ο αριθμός του παραστατικού στην περιγραφή.
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (p8, prop, 30.00, 'Προκαταβολή ΤΔΑ 0012', 'Επισκευές', '2026-11-05', '801000050') returning id into byaa;
  -- 11 ημέρες και 1,50€ διαφορά: όχι.
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (p8, prop, 21.50, 'Αλλο', 'Επισκευές', '2026-11-21', '801000050') returning id into tooFar;
  r := public.mydata_ingest(lease, k, jsonb_build_array(
         pg_temp.md('700000000000010', '801000062', 5040, '2026-11-10', '{"category":"water","category_label":"Νερό"}'),
         pg_temp.md('700000000000012', '801000050', 7700, '2026-11-02', '{"aa":"0012"}'),
         pg_temp.md('700000000000013', '801000050', 2000, '2026-11-10', '{"aa":"77"}')),
       '[]', '[]', 3, null, null, false);
  if (select status from public.mydata_docs where mark = 700000000000010) <> 'linked'
     or (select expense_id from public.mydata_docs where mark = 700000000000010) <> bycat then
    raise exception 'Σ2: δεν δέθηκε δαπάνη ίδιας κατηγορίας, ±1€, 9 ημέρες μετά';
  end if;
  if (select expense_id from public.mydata_docs where mark = 700000000000012) is distinct from byaa then
    raise exception 'Σ2: δεν δέθηκε δαπάνη με τον ίδιο αριθμό παραστατικού';
  end if;
  if (select status from public.mydata_docs where mark = 700000000000013) <> 'pending' then
    raise exception 'Σ2: δέθηκε δαπάνη 11 ημέρες μακριά με 1,50€ διαφορά';
  end if;
  raise notice 'probe: Σ2: ±1€ ή ίδιος αριθμός, ±10 ημέρες, ΑΦΜ ή κατηγορία';
end $probe$;

-- Η κάρτα «Είναι η ίδια με …;»: ο ιδιοκτήτης βλέπει την υποψήφια και τη δένει.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$
declare
  prop uuid := 'ad000000-0000-4000-8000-00000000f0a8';
  d13 uuid := (select id from public.mydata_docs where mark = 700000000000013);
  e uuid; r json;
begin
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (auth.uid(), prop, 20.30, 'Ηλεκτρολόγος', 'Επισκευές', '2026-11-14', '801000050') returning id into e;
  r := public.mydata_doc_match(d13, prop, 'Επισκευές');
  if r is null or (r->>'expenseId')::uuid <> e then raise exception 'Σ2: η κάρτα δεν βρήκε την υποψήφια: %', r; end if;
  r := public.mydata_doc_link(d13, gen_random_uuid(), prop, 'Επισκευές');
  if (r->>'ok')::boolean then raise exception 'Σ2: δέθηκε δαπάνη που δεν ταιριάζει'; end if;
  r := public.mydata_doc_link(d13, e, prop, 'Επισκευές');
  if not (r->>'ok')::boolean or (select status from public.mydata_docs where id = d13) <> 'linked' then
    raise exception 'Σ2: «Είναι η ίδια» δεν έδεσε: %', r;
  end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_doc_match((select id from public.mydata_docs where mark = 700000000000002), null, 'Ρεύμα');
  if r is not null then raise exception 'ΔΙΑΡΡΟΗ: ο Π2 ψάχνει δαπάνες για παραστατικό του Π8'; end if;
end $probe$;
reset role;

-- ── 12ε. ΑΚΥΡΩΣΗ ΚΑΙ ΕΠΑΝΕΚΔΟΣΗ ΣΤΗΝ ΙΔΙΑ ΔΑΠΑΝΗ (Σ3 λογιστικού) ────────────
do $probe$
declare
  p8 uuid := 'ad000000-0000-4000-8000-0000000000a8';
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  lease uuid := current_setting('mydata.lease8')::uuid;
  e uuid := (select expense_id from public.mydata_docs where mark = 700000000000003);
  n int := (select count(*) from public.expenses where user_id = 'ad000000-0000-4000-8000-0000000000a8');
  r json;
begin
  -- Η ακύρωση του 003 και η επανέκδοσή του (νέος ΜΑΡΚ, ίδιο ποσό) στην ίδια σελίδα.
  r := public.mydata_ingest(lease, k,
         jsonb_build_array(pg_temp.md('700000000000020', '801000048', 8200, '2026-11-03',
           '{"tier":"auto","category":"electricity","category_label":"Ρεύμα","expense_group":"fixed"}')),
         jsonb_build_array(jsonb_build_object('invoice_mark', '700000000000003', 'cancellation_mark', '700000000000090')),
         '[]', 2, null, null, false);
  if (select status || '/' || coalesce(prev_expense_id::text, '-') from public.mydata_docs where mark = 700000000000003) <> 'cancelled/' || e then
    raise exception 'Σ3: το ακυρωμένο δεν κράτησε τη δαπάνη του στο prev_expense_id';
  end if;
  if (select status from public.mydata_docs where mark = 700000000000020) <> 'linked'
     or (select expense_id from public.mydata_docs where mark = 700000000000020) <> e then
    raise exception 'Σ3: η επανέκδοση δεν δέθηκε στην ίδια δαπάνη';
  end if;
  if (select count(*) from public.expenses where user_id = p8) <> n then raise exception 'Σ3: η επανέκδοση γέννησε δεύτερη δαπάνη'; end if;
  if (select needs_attention from public.mydata_docs where mark = 700000000000003) is not null then
    raise exception 'Σ3: έμεινε ειδοποίηση ενώ η επανέκδοση κάλυψε τη δαπάνη';
  end if;
  -- Ακύρωση δεμένου με χειροκίνητη δαπάνη, χωρίς επανέκδοση: «Θέλει έλεγχο».
  r := public.mydata_ingest(lease, k, '[]',
         jsonb_build_array(jsonb_build_object('invoice_mark', '700000000000012', 'cancellation_mark', '700000000000091')),
         '[]', 1, null, null, false);
  if (select needs_attention from public.mydata_docs where mark = 700000000000012) is distinct from 'cancelled_linked' then
    raise exception 'Σ3: ακύρωση δεμένου με χειροκίνητη δαπάνη χωρίς ειδοποίηση';
  end if;
  raise notice 'probe: Σ3: ακύρωση και επανέκδοση στην ίδια δαπάνη, «Θέλει έλεγχο» για το δεμένο';
end $probe$;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$ declare r json; e uuid := (select prev_expense_id from public.mydata_docs where mark = 700000000000012); begin
  r := public.mydata_cancel_ack((select id from public.mydata_docs where mark = 700000000000012), true);
  if not (r->>'ok')::boolean or (r->>'removed')::int <> 0 then raise exception 'Σ3: το «Το είδα» απέτυχε ή έσβησε: %', r; end if;
  if not exists (select 1 from public.expenses where id = e) then raise exception 'Σ3: σβήστηκε χειροκίνητη δαπάνη του χρήστη'; end if;
end $probe$;
reset role;

-- ── 12στ. ΠΙΣΤΩΤΙΚΟ ΣΥΣΧΕΤΙΖΟΜΕΝΟ (Μ6 λογιστικού) ─────────────────────────────
do $probe$
declare
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  lease uuid := current_setting('mydata.lease8')::uuid;
  r json;
begin
  r := public.mydata_ingest(lease, k, jsonb_build_array(
         pg_temp.md('700000000000030', '801000074', 1500, '2026-11-12',
           '{"is_credit":true,"doc_type":"5.1","correlated_mark":"700000000000010","category":null}')),
       '[]', '[]', 1, null, null, false);
  if (select category from public.mydata_docs where mark = 700000000000030) is distinct from 'water'
     or (select correlated_doc_id from public.mydata_docs where mark = 700000000000030)
        is distinct from (select id from public.mydata_docs where mark = 700000000000010) then
    raise exception 'Μ6: το πιστωτικό δεν δέθηκε με το αρχικό ή δεν πήρε την κατηγορία του';
  end if;
end $probe$;

-- ── 12ζ. ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ ΚΑΙ ΤΙ ΒΛΕΠΕΙ Ο ΛΟΓΙΣΤΗΣ (Κ2 νομικού) ────────────────
do $probe$
declare
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  lease uuid := current_setting('mydata.lease8')::uuid;
begin
  perform public.mydata_ingest(lease, k, jsonb_build_array(
    pg_temp.md('700000000000040', '801000086', 3500, '2026-11-15', '{"counterpart_name":"Ιατρείο Παραδείγματος"}'),
    pg_temp.md('700000000000041', '801000098', 1200, '2026-11-16', '{"counterpart_name":"Φαρμακείο Παραδείγματος"}'),
    pg_temp.md('700000000000042', '801000098', 1300, '2026-11-17', '{"counterpart_name":"Φαρμακείο Παραδείγματος"}')),
    '[]', '[]', 3, null, null, false);
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_doc_dismiss((select id from public.mydata_docs where mark = 700000000000040));
  if not (r->>'ok')::boolean then raise exception 'Κ2: «Δεν αφορά ακίνητο» απέτυχε'; end if;
  r := public.mydata_ignore_provider('801000098');
  if (r->>'dismissed')::int <> 2 then raise exception 'Κ2: «Πάντα αγνόησε» απέρριψε % αντί για 2', r->>'dismissed'; end if;
  if exists (select 1 from public.mydata_docs where mark between 700000000000040 and 700000000000042
              and (status <> 'dismissed' or counterpart_afm is not null or counterpart_name is not null or title is not null
                   or issue_date is not null or gross_cents is not null or net_cents is not null or series is not null or aa is not null)) then
    raise exception 'Κ2: η απόρριψη κράτησε εκδότη, ποσά ή ημερομηνία';
  end if;
  if (select count(*) from public.mydata_docs where mark between 700000000000040 and 700000000000042 and mark is not null) <> 3 then
    raise exception 'Κ2: χάθηκε ο ΜΑΡΚ, άρα θα ξαναρχόταν';
  end if;
end $probe$;
reset role;
-- Ο ΜΑΡΚ μένει: το ίδιο παραστατικό δεν ξανάρχεται.
do $probe$
declare
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  r json;
begin
  r := public.mydata_ingest(current_setting('mydata.lease8')::uuid, k, jsonb_build_array(
    pg_temp.md('700000000000040', '801000086', 3500, '2026-11-15', '{"counterpart_name":"Ιατρείο Παραδείγματος"}')),
    '[]', '[]', 1, null, null, false);
  if (r->>'added')::int <> 0 or (select counterpart_name from public.mydata_docs where mark = 700000000000040) is not null then
    raise exception 'Κ2: το απορριφθέν ξαναήρθε με τα στοιχεία του';
  end if;
end $probe$;

-- Ο λογιστής: μόνο τα καταχωρημένα και τα δεμένα, ποτέ εκκρεμή ή απορριφθέντα.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c8', true);
set local role authenticated;
do $probe$ declare bad int; seen int; begin
  select count(*) filter (where status not in ('filed', 'linked')), count(*) into bad, seen from public.mydata_docs;
  if bad <> 0 then raise exception 'Κ2: ο λογιστής βλέπει % εκκρεμή ή απορριφθέντα', bad; end if;
  if seen = 0 then raise exception 'ΣΚΗΝΙΚΟ: ο λογιστής δεν βλέπει ούτε τα καταχωρημένα'; end if;
  if (select (e->>'pending')::int from json_array_elements(public.mydata_clients_status()) e
       where e->>'ownerId' = 'ad000000-0000-4000-8000-0000000000a8') < 1 then
    raise exception 'Κ2: ο λογιστής δεν βλέπει ούτε το πλήθος των εκκρεμών';
  end if;
  raise notice 'probe: Κ2: απόρριψη = μόνο ΜΑΡΚ· ο λογιστής βλέπει μόνο ό,τι καταχωρήθηκε';
end $probe$;
reset role;

-- ── 12η. ΔΙΑΤΗΡΗΣΗ: ΕΚΚΡΕΜΗ 90 ΗΜΕΡΕΣ, ΑΝΑΚΛΗΜΕΝΕΣ ΑΔΕΙΕΣ 5 ΕΤΗ (Σ3, Ε-8, Κ-4, Κ-12) ──
do $probe$
declare
  p8 uuid := 'ad000000-0000-4000-8000-0000000000a8';
  k uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  old_c uuid;
begin
  perform public.mydata_ingest(current_setting('mydata.lease8')::uuid, k, jsonb_build_array(
    pg_temp.md('700000000000050', '801000110', 1000, '2026-08-01'),
    pg_temp.md('700000000000051', '801000110', 1100, '2026-08-02')),
    '[]', '[]', 2, null, null, false);
  update public.mydata_docs set fetched_at = now() - interval '91 days' where mark = 700000000000050;
  update public.mydata_docs set fetched_at = now() - interval '89 days' where mark = 700000000000051;
  insert into public.mydata_consents (client_id, accountant_id, afm, window_from, revoked_at, revoke_reason, status)
    values (p8, 'ad000000-0000-4000-8000-0000000000c9', '801000036', '2020-01-01', now() - interval '5 years 1 day', 'client', 'pending')
    returning id into old_c;
  -- Ε-8: 5 έτη, όχι 1825 ημέρες. Με τα δίσεκτα τα 5 έτη είναι 1826 ημέρες, οπότε
  -- άδεια που ανακλήθηκε πριν από 5 έτη μείον μία ώρα ΜΕΝΕΙ.
  insert into public.mydata_consents (client_id, accountant_id, afm, window_from, revoked_at, revoke_reason, status)
    values (p8, 'ad000000-0000-4000-8000-0000000000c9', '801000036', '2020-01-01', now() - interval '5 years' + interval '1 hour', 'client', 'pending');
  -- Κ-12: η καραντίνα έχει ανώτατο όριο ({MYDATA_QUARANTINE_DAYS} από την τελευταία φορά που ζητήθηκε).
  insert into public.mydata_quarantine (consent_id, client_id, client_afm, mark, reason, seen_at)
    values (k, p8, '801000036', 700000000000060, 'invoice_type', now() - interval '91 days'),
           (k, p8, '801000036', 700000000000061, 'invoice_type', now() - interval '89 days');
  -- Κ-4: η επιβεβαίωση ΑΦΜ σβήνει όταν η σύνδεση πεθάνει.
  insert into auth.users(id, email) values ('ad000000-0000-4000-8000-0000000000b4', 'b4@mydata.test');
  insert into public.mydata_afm_confirmations (accountant_id, client_id, afm) values ('ad000000-0000-4000-8000-0000000000c9', 'ad000000-0000-4000-8000-0000000000b4', '801000048');
  perform private.mydata_prune();
  if (select count(*) from public.mydata_consents where client_id = p8 and revoked_at > now() - interval '5 years' and revoked_at < now() - interval '1825 days') <> 1 then
    raise exception 'Ε-8: άδεια μικρότερη των 5 ετών σβήστηκε (μετρήθηκαν 1825 ημέρες)';
  end if;
  if exists (select 1 from public.mydata_quarantine where mark = 700000000000060) then raise exception 'Κ-12: καραντίνα 91 ημερών έμεινε'; end if;
  if not exists (select 1 from public.mydata_quarantine where mark = 700000000000061) then raise exception 'Κ-12: σβήστηκε καραντίνα 89 ημερών'; end if;
  if exists (select 1 from public.mydata_afm_confirmations where client_id = 'ad000000-0000-4000-8000-0000000000b4') then
    raise exception 'Κ-4: η επιβεβαίωση ΑΦΜ έμεινε χωρίς ζωντανή σύνδεση';
  end if;
  if not exists (select 1 from public.mydata_afm_confirmations where client_id = p8) then raise exception 'Κ-4: σβήστηκε επιβεβαίωση ζωντανής σύνδεσης'; end if;
  if exists (select 1 from public.mydata_docs where mark = 700000000000050) then raise exception 'Σ3: εκκρεμές 91 ημερών δεν σβήστηκε'; end if;
  if (select status from public.mydata_docs where mark = 700000000000051) is distinct from 'pending' then raise exception 'Σ3: σβήστηκε εκκρεμές 89 ημερών'; end if;
  if exists (select 1 from public.mydata_consents where id = old_c) then raise exception 'Σ3: ανακλημένη άδεια 5 ετών και μίας ημέρας δεν σβήστηκε'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = p8 and revoked_at is null) then raise exception 'Σ3: το καθάρισμα πείραξε ενεργή άδεια'; end if;
  raise notice 'probe: Σ3/Ε-8/Κ-4/Κ-12: εκκρεμή 90 ημέρες, ανακλημένες άδειες 5 έτη, καραντίνα με όριο, επιβεβαίωση ΑΦΜ με τη σύνδεση';
end $probe$;

-- ── 12θ. ΑΛΛΑΓΗ ΛΟΓΙΣΤΗ: ΡΗΤΗ ΕΠΙΒΕΒΑΙΩΣΗ, ΟΙ ΔΑΠΑΝΕΣ ΜΕΝΟΥΝ (Σ6 νομικού) ────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c9', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p8'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ9→Π8 %', r; end if;
  r := public.mydata_confirm_afm('ad000000-0000-4000-8000-0000000000a8', '801000036');
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ο Λ9 επιβεβαιώνει τον Π8: %', r; end if;
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$
declare
  l9 uuid := 'ad000000-0000-4000-8000-0000000000c9';
  y  int  := extract(year from (now() at time zone 'Europe/Athens'))::int;
  h  text := 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417';
  kept int := (select count(*) from public.expenses where user_id = auth.uid());
  r json;
begin
  r := public.mydata_consent_grant(l9, y, '2026-11-24.2', h, true);
  if (r->>'ok')::boolean or r->>'reason' <> 'switch_confirm' or (r->>'pending')::int < 1 then
    raise exception 'Σ6: αλλαγή λογιστή χωρίς επιβεβαίωση, ή χωρίς πλήθος όσων σβήνουν: %', r;
  end if;
  r := public.mydata_consent_grant(l9, y, '2026-11-24.2', h, true, true);
  if not (r->>'ok')::boolean then raise exception 'Σ6: η επιβεβαιωμένη αλλαγή απέτυχε: %', r; end if;
  if (select count(*) from public.expenses where user_id = auth.uid()) <> kept then raise exception 'Σ6: η αλλαγή λογιστή έσβησε δαπάνες'; end if;
  if (select accountant_id from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> l9 then raise exception 'Σ6: ο λογιστής δεν άλλαξε'; end if;
  raise notice 'probe: Σ6: αλλαγή λογιστή μόνο με επιβεβαίωση· οι δαπάνες μένουν';
end $probe$;
reset role;

-- ── 12ι. ΠΑΚΕΤΟ: Η ΣΥΝΔΕΣΗ myDATA ΑΠΟ ΤΟ «ΙΔΙΟΚΤΗΤΗΣ+» (απόφαση 24/11/2026) ──
-- Ο Π8 έχει άδεια στον Λ9. Χωρίς το πακέτο (εδώ: «solo», δοκιμή που έληξε) η
-- άντληση δεν τον ζητά, καμία σελίδα δεν γράφεται και νέα άδεια δεν δίνεται.
update public.billing_profiles set plan = 'solo', trial_used_at = now() - interval '1 day'
 where user_id = 'ad000000-0000-4000-8000-0000000000a8';
do $probe$
declare
  l9 uuid := 'ad000000-0000-4000-8000-0000000000c9';
  k  uuid := (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null);
  r json; lease uuid;
begin
  if private.mydata_min_plan() <> 'owner' then raise exception 'ΠΑΚΕΤΟ: η βάση δεν ζητά «owner»'; end if;
  update public.mydata_connections set last_manual_at = null, lease_id = null where accountant_id = l9;
  r := public.mydata_sync_begin(l9, 'manual', l9);
  lease := (r->>'lease')::uuid;
  if exists (select 1 from public.mydata_sync_targets(l9, lease, 'manual') t where t.consent_id = k) then
    raise exception 'ΠΑΚΕΤΟ: η άντληση ζητά πελάτη χωρίς «Ιδιοκτήτης+»';
  end if;
  if public.mydata_consent_live(k, lease) then raise exception 'ΠΑΚΕΤΟ: σελίδα για πελάτη χωρίς «Ιδιοκτήτης+»'; end if;
  perform public.mydata_sync_end(l9, lease, null, 0);
end $probe$;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a8', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c8', extract(year from (now() at time zone 'Europe/Athens'))::int,
         '2026-11-24.2', 'd07487075d483d2a9852f5da1c3d840babcf131d93078c720047be9774311417', true, true);
  if (r->>'ok')::boolean or r->>'reason' <> 'plan_required' then raise exception 'ΠΑΚΕΤΟ: άδεια χωρίς «Ιδιοκτήτης+»: %', r; end if;
end $probe$;
reset role;
update public.billing_profiles set plan = 'owner' where user_id = 'ad000000-0000-4000-8000-0000000000a8';
do $probe$ declare l9 uuid := 'ad000000-0000-4000-8000-0000000000c9'; r json; lease uuid; begin
  update public.mydata_connections set last_manual_at = null, lease_id = null where accountant_id = l9;
  r := public.mydata_sync_begin(l9, 'manual', l9);
  lease := (r->>'lease')::uuid;
  if not exists (select 1 from public.mydata_sync_targets(l9, lease, 'manual') t
                  where t.consent_id = (select id from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a8' and revoked_at is null)) then
    raise exception 'ΠΑΚΕΤΟ: με «Ιδιοκτήτης+» ο πελάτης δεν ζητείται';
  end if;
  perform public.mydata_sync_end(l9, lease, null, 0);
  raise notice 'probe: ΠΑΚΕΤΟ: η Σύνδεση myDATA θέλει «Ιδιοκτήτης+» για άδεια και για κάθε σελίδα';
end $probe$;

rollback;
