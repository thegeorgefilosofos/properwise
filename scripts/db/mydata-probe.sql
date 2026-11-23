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
  x  uuid := 'ad000000-0000-4000-8000-0000000000ee';
begin
  insert into auth.users(id, email) values
    (l1, 'l1@mydata.test'), (l2, 'l2@mydata.test'), (p1, 'p1@mydata.test'),
    (p2, 'p2@mydata.test'), (p3, 'p3@mydata.test'), (x, 'x@mydata.test');
  insert into public.billing_profiles(user_id, afm, owner_name) values
    (p1, '099 000 013', 'Πελάτης Ένα'), (p2, '099000025', 'Πελάτης Δύο'), (p3, '123456789', 'Πελάτης Τρία')
  on conflict (user_id) do update set afm = excluded.afm, owner_name = excluded.owner_name;
  insert into public.user_properties(id, user_id, name) values
    ('ad000000-0000-4000-8000-00000000f0a1', p1, 'Του Π1');
  insert into public.accountant_links(user_id, token, active) values
    (p1, 'mydata-probe-p1', true), (p2, 'mydata-probe-p2', true), (p3, 'mydata-probe-p3', true);
end $probe$;

-- Οι λογιστές διεκδικούν τους πελάτες τους από τη δική τους πόρτα.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.accountant_claim('mydata-probe-p1'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ1→Π1 %', r; end if;
  r := public.accountant_claim('mydata-probe-p3'); if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: Λ1→Π3 %', r; end if;
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
  r := public.mydata_consent_grant(l2, y);
  if (r->>'ok')::boolean or r->>'reason' <> 'not_linked' then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: άδεια σε λογιστή που δεν συνδέθηκε: %', r; end if;
  r := public.mydata_consent_grant(l1, y - 5);
  if (r->>'ok')::boolean or r->>'reason' <> 'bad_period' then raise exception 'ΠΕΡΙΟΔΟΣ: δέχτηκε έτος % (%)', y - 5, r; end if;
  r := public.mydata_consent_grant(l1, y - 1);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η άδεια του Π1 απέτυχε: %', r; end if;
  if (select afm from public.mydata_consents where client_id = auth.uid()) <> '099000013' then
    raise exception 'ΡΟΗ: το ΑΦΜ δεν καθαρίστηκε από κενά';
  end if;
  if (select window_from from public.mydata_consents where client_id = auth.uid()) <> make_date(y - 1, 1, 1) then
    raise exception 'ΠΕΡΙΟΔΟΣ: λάθος αρχή παραθύρου';
  end if;
  r := public.mydata_consent_grant(l1, y - 1);
  if not (r->>'existing')::boolean then raise exception 'ΡΟΗ: δεύτερο «Επιτρέπω» έγραψε δεύτερη γραμμή'; end if;
  raise notice 'probe: άδεια μόνο σε συνδεδεμένο λογιστή, για τρέχον ή προηγούμενο έτος';
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a3', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', extract(year from now())::int);
  if (r->>'ok')::boolean or r->>'reason' <> 'no_afm' then raise exception 'ΑΦΜ: άδεια με ΑΦΜ που δεν περνά τον έλεγχο: %', r; end if;
  raise notice 'probe: χωρίς έγκυρο ΑΦΜ δεν δίνεται άδεια';
end $probe$;
reset role;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a2', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c2', extract(year from (now() at time zone 'Europe/Athens'))::int);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η άδεια του Π2 απέτυχε: %', r; end if;
  -- Κανείς δεν γράφει απευθείας.
  begin
    update public.mydata_consents set last_mark = 999 where client_id = auth.uid();
    if found then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο πελάτης άλλαξε τον ΜΑΡΚ του'; end if;
  exception when insufficient_privilege then null;
  end;
end $probe$;
reset role;

-- ── 2. ΤΟ ΚΛΕΙΔΙ ───────────────────────────────────────────────────────────
do $probe$ begin
  perform public.mydata_key_store('ad000000-0000-4000-8000-0000000000c1', 'logistis1', 'abcdEFGH12345678abcdEFGH12345678');
  perform public.mydata_key_store('ad000000-0000-4000-8000-0000000000c2', 'logistis2', 'zyxwVUTS98765432zyxwVUTS98765432');
  if (select api_key from public.mydata_key_read('ad000000-0000-4000-8000-0000000000c1')) <> 'abcdEFGH12345678abcdEFGH12345678' then
    raise exception 'ΚΛΕΙΔΙ: ο ρόλος υπηρεσίας δεν διαβάζει το κλειδί';
  end if;
  begin
    perform public.mydata_key_store('ad000000-0000-4000-8000-0000000000c1', 'logistis1', 'κλειδί με κενά');
    raise exception 'ΚΛΕΙΔΙ: δέχτηκε κλειδί με λάθος μορφή';
  exception when raise_exception then
    if sqlerrm like '%κλειδί%' or sqlerrm like '%abcd%' then raise exception 'ΔΙΑΡΡΟΗ: το μήνυμα σφάλματος περιέχει το κλειδί'; end if;
  end;
  -- Η ενημέρωση ξαναγράφει το ίδιο μυστικό, δεν γεννά δεύτερο.
  perform public.mydata_key_store('ad000000-0000-4000-8000-0000000000c1', 'logistis1', 'abcdEFGH12345678abcdEFGH12345678');
  if (select count(*) from vault.secrets where name like 'mydata_key:%') <> 2 then raise exception 'ΚΛΕΙΔΙ: διπλό μυστικό στο Vault'; end if;
  raise notice 'probe: το κλειδί ζει στο Vault, ένα ανά λογιστή';
end $probe$;

select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare t text; begin
  begin
    select api_key into t from public.mydata_key_read('ad000000-0000-4000-8000-0000000000c1');
    raise exception 'ΔΙΑΡΡΟΗ: ο λογιστής διάβασε κλειδί μέσω RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.mydata_vault;
    raise exception 'ΔΙΑΡΡΟΗ: ο λογιστής βλέπει την αναφορά του Vault';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mydata_connections'
             and column_name ~ '(secret|subscription|api_key|^key$)') then
    raise exception 'ΣΧΗΜΑ: στήλη κλειδιού στον δημόσιο πίνακα';
  end if;
  begin
    update public.mydata_connections set status = 'active', has_key = true;
    if found then raise exception 'ΠΑΡΑΒΙΑΣΗ: ο λογιστής γράφει την κατάσταση της σύνδεσης'; end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe: ο λογιστής δεν διαβάζει ποτέ το κλειδί, ούτε το δικό του';
end $probe$;
reset role;

-- ── 3. Η ΜΙΣΘΩΣΗ ΚΑΙ ΤΑ ΟΡΙΑ ΣΥΧΝΟΤΗΤΑΣ ─────────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  r json; r2 json;
begin
  r := public.mydata_sync_begin(l1, 'manual');
  if not (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: η πρώτη απέτυχε: %', r; end if;
  r2 := public.mydata_sync_begin(l1, 'nightly');
  if (r2->>'ok')::boolean or r2->>'reason' <> 'busy' then raise exception 'ΜΙΣΘΩΣΗ: δεύτερο τρέξιμο ενώ τρέχει το πρώτο: %', r2; end if;
  perform public.mydata_sync_end(l1, (r->>'lease')::uuid, null, 0);
  r2 := public.mydata_sync_begin(l1, 'manual');
  if (r2->>'ok')::boolean or r2->>'reason' <> 'too_soon' or r2->>'retryAt' is null then
    raise exception 'ΟΡΙΟ: «Συγχρονισμός τώρα» δύο φορές μέσα σε 5 λεπτά: %', r2;
  end if;
  r2 := public.mydata_sync_begin(l1, 'auto');
  if (r2->>'ok')::boolean or r2->>'reason' <> 'fresh' then raise exception '12 ΩΡΕΣ: αυτόματο αμέσως μετά από συγχρονισμό: %', r2; end if;
  update public.mydata_connections set last_sync_at = now() - interval '11 hours 59 minutes' where accountant_id = l1;
  r2 := public.mydata_sync_begin(l1, 'auto');
  if (r2->>'ok')::boolean then raise exception '12 ΩΡΕΣ: αυτόματο στις 11:59'; end if;
  update public.mydata_connections set last_sync_at = now() - interval '12 hours' where accountant_id = l1;
  r2 := public.mydata_sync_begin(l1, 'auto');
  if not (r2->>'ok')::boolean then raise exception '12 ΩΡΕΣ: δεν έτρεξε στις 12 ώρες: %', r2; end if;
  -- Μίσθωση που ξεχάστηκε (κομμένη συνάρτηση) λήγει στα 10 λεπτά.
  update public.mydata_connections set lease_at = now() - interval '11 minutes' where accountant_id = l1;
  r := public.mydata_sync_begin(l1, 'nightly');
  if not (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: η ληγμένη δεν απελευθερώθηκε: %', r; end if;
  perform set_config('mydata.lease', r->>'lease', true);
  raise notice 'probe: ένα τρέξιμο ανά λογιστή, «τώρα» ανά 5 λεπτά, αυτόματο μετά από 12 ώρες';
end $probe$;

-- ── 4. ΠΟΙΟΥΣ ΠΕΛΑΤΕΣ ΖΗΤΑ Ο ΛΟΓΙΣΤΗΣ ─────────────────────────────────────────
do $probe$
declare
  l1 uuid := 'ad000000-0000-4000-8000-0000000000c1';
  lease uuid := current_setting('mydata.lease')::uuid;
  n int; v_afm text;
begin
  select count(*), min(afm) into n, v_afm from public.mydata_sync_targets(l1, lease, 'nightly');
  if n <> 1 or v_afm <> '099000013' then raise exception 'ΔΙΑΡΡΟΗ: ο Λ1 θα ζητούσε % ΑΦΜ (%), όχι μόνο τον Π1', n, v_afm; end if;
  select count(*) into n from public.mydata_sync_targets(l1, gen_random_uuid(), 'nightly');
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
  -- Ιδια δαπάνη 4 ημέρες μακριά από το 120: δεν δένεται.
  insert into public.expenses (user_id, property_id, amount, description, category, date, supplier_afm)
    values (p1, prop, 40.00, 'Μακριά', 'Επισκευές', '2026-11-01', '099000049') returning id into far;
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
  r := public.mydata_ingest(lease, k, docs, '[]'::jsonb, 400001000000130, '{"partitionKey":"p","rowKey":"r","fromMark":"0","maxMark":"400001000000130"}'::jsonb, false);
  if not (r->>'ok')::boolean then raise exception 'ΡΟΗ: η εγγραφή απέτυχε: %', r; end if;
  if (r->>'added')::int <> 3 then raise exception 'ΕΓΓΡΑΦΗ: % νέα αντί για 3 (101, 110, 120)', r->>'added'; end if;
  if (select last_mark from public.mydata_consents where id = k) <> 0 then raise exception 'ΜΑΡΚ: προχώρησε πριν τελειώσουν οι σελίδες'; end if;
  if (select resume->>'partitionKey' from public.mydata_consents where id = k) <> 'p' then raise exception 'ΣΥΝΕΧΕΙΑ: δεν κρατήθηκε το σημείο'; end if;

  if (select status from public.mydata_docs where mark = 400001000000102) <> 'linked'
     or (select expense_id from public.mydata_docs where mark = 400001000000102) <> manual then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: η χειροκίνητη δαπάνη ±3 ημερών δεν δέθηκε';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000120) <> 'pending' then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: δέθηκε δαπάνη 4 ημέρες μακριά';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000130) <> 'filed'
     or (select expense_id from public.mydata_docs where mark = 400001000000130) <> mine then
    raise exception 'ΔΙΠΛΟΤΥΠΟ: η δαπάνη με αποτύπωμα ΜΑΡΚ δεν αναγνωρίστηκε';
  end if;
  if (select status from public.mydata_docs where mark = 400001000000111) <> 'cancelled' then
    raise exception 'ΑΚΥΡΩΣΗ: το ακυρωμένο μπήκε ως εκκρεμές';
  end if;

  -- Ξανά η ίδια σελίδα (επανάληψη μετά από κόψιμο): κανένα νέο, κανένα διπλό.
  r := public.mydata_ingest(lease, k, docs, '[]'::jsonb, 400001000000130, null, true);
  if (r->>'added')::int <> 0 then raise exception 'ΔΙΠΛΟΤΥΠΟ: ο ίδιος ΜΑΡΚ γράφτηκε δεύτερη φορά'; end if;
  select count(*) into n from public.mydata_docs where client_id = p1;
  if n <> 6 then raise exception 'ΔΙΠΛΟΤΥΠΟ: % γραμμές αντί για 6', n; end if;
  if (select last_mark from public.mydata_consents where id = k) <> 400001000000130 then raise exception 'ΜΑΡΚ: δεν προχώρησε στο τέλος'; end if;
  if (select resume from public.mydata_consents where id = k) is not null then raise exception 'ΣΥΝΕΧΕΙΑ: έμεινε μετά το τέλος'; end if;

  -- Λάθος μίσθωση: τίποτα.
  r := public.mydata_ingest(gen_random_uuid(), k, docs, '[]'::jsonb, 1, null, true);
  if (r->>'ok')::boolean then raise exception 'ΜΙΣΘΩΣΗ: εγγραφή χωρίς μίσθωση'; end if;
  raise notice 'probe: ένα ανά ΜΑΡΚ, σύνδεση με χειροκίνητη ±3 ημερών, συνέχεια σελίδων';
end $probe$;

-- ── 6. RLS: ΔΥΟ ΛΟΓΙΣΤΕΣ, ΔΥΟ ΠΕΛΑΤΕΣ, ΕΝΑΣ ΞΕΝΟΣ ────────────────────────────
do $probe$
declare
  lease uuid := current_setting('mydata.lease')::uuid;
  r json; r2 json;
begin
  -- Ενα παραστατικό και για τον Π2, από τον Λ2.
  r := public.mydata_sync_begin('ad000000-0000-4000-8000-0000000000c2', 'nightly');
  r2 := public.mydata_ingest((r->>'lease')::uuid, (select id from public.mydata_consents where afm = '099000025'),
    jsonb_build_array(jsonb_build_object('mark','500000000000001','counterpart_afm','099000037','counterpart_name',null,'doc_type','2.1','series','Ε','aa','1','issue_date','2026-11-10','title','Τ','net_cents',100,'vat_cents',24,'gross_cents',124,'is_credit',false,'cancelled',false,'cancellation_mark',null)),
    '[]'::jsonb, 500000000000001, null, true);
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
    if r.who = 'Λ1' and (r.docs <> 6 or r.consents <> 1 or r.conns <> 1) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Λ1 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Λ2' and (r.docs <> 1 or r.consents <> 1 or r.conns <> 1) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Λ2 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Π1' and (r.docs <> 6 or r.consents <> 1 or r.conns <> 0) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Π1 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Π2' and (r.docs <> 1 or r.consents <> 1 or r.conns <> 0) then raise exception 'ΔΙΑΡΡΟΗ/ΑΠΩΛΕΙΑ: ο Π2 βλέπει % παραστατικά, % άδειες, % συνδέσεις', r.docs, r.consents, r.conns; end if;
    if r.who = 'Ξ'  and (r.docs + r.consents + r.logs + r.conns) <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο ξένος βλέπει % γραμμές', r.docs + r.consents + r.logs + r.conns; end if;
    if r.who in ('Λ1', 'Λ2', 'Π1', 'Π2') and r.logs = 0 then raise exception 'ΑΡΧΕΙΟ: ο % δεν βλέπει το δικό του αρχείο πρόσβασης', r.who; end if;
  end loop;
  raise notice 'probe: δύο λογιστές, δύο πελάτες, ένας ξένος: κανείς δεν βλέπει τα του άλλου';
end $probe$;

-- Ο πίνακας του λογιστή: μόνο οι δικοί του, κανένα ΑΦΜ ή ποσό.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_clients_status();
  if json_array_length(r) <> 2 then raise exception 'ΠΙΝΑΚΑΣ: ο Λ1 βλέπει % πελάτες αντί για 2 (Π1, Π3)', json_array_length(r); end if;
  if r::text like '%099000025%' or r::text like '%Πελάτης Δύο%' then raise exception 'ΔΙΑΡΡΟΗ: ο πίνακας του Λ1 δείχνει τον Π2'; end if;
  if r::text like '%099000013%' then raise exception 'ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ: ο πίνακας κουβαλά ΑΦΜ'; end if;
  begin
    perform public.mydata_ingest(gen_random_uuid(), gen_random_uuid(), '[]', '[]', 0, null, true);
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
      values ((select id from public.mydata_consents where client_id = p1), p1, '099000013', 9, '1', '2.1', 'a', 'b', '2026-01-01', 't', 0, 0, 0);
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
    400001000000192, null, true);
  if (r->>'added')::int <> 0 then raise exception 'ΑΓΝΟΗΣΗ: γράφτηκε παραστατικό παρόχου στη λίστα «Πάντα αγνόησε»'; end if;
  if exists (select 1 from public.mydata_docs where mark = 400001000000140) then raise exception 'ΑΓΝΟΗΣΗ: η γραμμή υπάρχει'; end if;
  if exists (select 1 from public.expenses where id = filed) then raise exception 'ΑΚΥΡΩΣΗ: έμεινε η δαπάνη που γέννησε το ακυρωμένο παραστατικό'; end if;
  if not exists (select 1 from public.expenses where id = manual) then raise exception 'ΑΚΥΡΩΣΗ: σβήστηκε δαπάνη που έγραψε ο ίδιος ο χρήστης'; end if;
  if (select count(*) from public.mydata_docs where mark in (400001000000101, 400001000000102) and status = 'cancelled') <> 2 then
    raise exception 'ΑΚΥΡΩΣΗ: δεν σημειώθηκαν και τα δύο';
  end if;
  if not exists (select 1 from public.mydata_access_log where action = 'cancel_removed_expense') then raise exception 'ΑΡΧΕΙΟ: η αφαίρεση δεν καταγράφηκε'; end if;
  raise notice 'probe: η ακύρωση σβήνει μόνο τη δαπάνη που γέννησε το myDATA· της χειροκίνητης τη σημειώνει';
end $probe$;

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
  if not exists (select 1 from public.mydata_due_accountants('nightly') a where a = l1) then raise exception 'CRON: ο νυχτερινός δεν βλέπει τον Λ1'; end if;
  update public.mydata_consents set next_retry_at = now() - interval '1 minute' where id = k;
  if not exists (select 1 from public.mydata_due_accountants('retry') a where a = l1) then raise exception 'CRON: η επανάληψη δεν βλέπει τον Λ1'; end if;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'retry');
  if n <> 1 then raise exception 'ΕΠΑΝΑΛΗΨΗ: % στόχοι αντί για 1', n; end if;

  perform public.mydata_client_done(lease, k, 'forbidden', 0, false);
  select * into c from public.mydata_consents where id = k;
  if c.status <> 'forbidden' or c.next_retry_at is not null then raise exception '403: έπρεπε «forbidden» χωρίς αυτόματη επανάληψη'; end if;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'retry');
  if n <> 0 then raise exception '403: ξαναζητείται κάθε 15 λεπτά'; end if;
  select count(*) into n from public.mydata_sync_targets(l1, lease, 'nightly');
  if n <> 1 then raise exception '403: ο νυχτερινός έπρεπε να ξαναδοκιμάσει'; end if;

  perform public.mydata_client_done(lease, k, 'Ocp-Apim-Subscription-Key abcd invalid', 0, false);
  if (select last_error_code from public.mydata_consents where id = k) <> 'unknown' then raise exception 'ΔΙΑΡΡΟΗ: ελεύθερο κείμενο γράφτηκε ως σφάλμα'; end if;
  if exists (select 1 from public.mydata_access_log where detail like '%Ocp%' or detail like '%abcd%') then raise exception 'ΔΙΑΡΡΟΗ: κείμενο στο αρχείο πρόσβασης'; end if;

  perform public.mydata_client_done(lease, k, null, 4, false);
  select * into c from public.mydata_consents where id = k;
  if c.status <> 'ok' or c.failures <> 0 or c.last_new <> 4 or c.next_retry_at is not null then raise exception 'ΡΟΗ: η επιτυχία δεν καθάρισε την κατάσταση'; end if;
  perform public.mydata_client_done(lease, k, null, 0, true);
  if (select next_retry_at from public.mydata_consents where id = k) is null then raise exception 'ΣΥΝΕΧΕΙΑ: «κι άλλο» χωρίς προγραμματισμένη συνέχεια'; end if;

  -- 401: η σύνδεση κλειδώνει ως νέο κλειδί.
  perform public.mydata_sync_end(l1, lease, 'auth', 0);
  if (select status from public.mydata_connections where accountant_id = l1) <> 'invalid' then raise exception '401: η σύνδεση δεν έγινε «invalid»'; end if;
  r := public.mydata_sync_begin(l1, 'nightly');
  if (r->>'ok')::boolean or r->>'reason' <> 'key_invalid' then raise exception '401: νέα προσπάθεια με κλειδί που απορρίφθηκε: %', r; end if;
  if exists (select 1 from public.mydata_due_accountants('nightly') a where a = l1) then raise exception '401: ο νυχτερινός θα ξαναδοκίμαζε'; end if;
  perform public.mydata_key_store(l1, 'logistis1', 'newKEY1234567890newKEY1234567890');
  r := public.mydata_sync_begin(l1, 'nightly');
  if not (r->>'ok')::boolean then raise exception '401: το νέο κλειδί δεν ξεκλείδωσε: %', r; end if;
  perform set_config('mydata.lease', r->>'lease', true);
  raise notice 'probe: 403 απομονώνει τον πελάτη, 5xx ξαναδοκιμάζεται με αναμονή, 401 κλειδώνει ως νέο κλειδί';
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
  if (select revoke_reason from public.mydata_consents where client_id = auth.uid()) <> 'client' then raise exception 'ΑΝΑΚΛΗΣΗ: η γραμμή συναίνεσης δεν έμεινε ως απόδειξη'; end if;
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
end $probe$;
reset role;
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; y int := extract(year from (now() at time zone 'Europe/Athens'))::int; begin
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', y);
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c2', y);
  if not (r->>'ok')::boolean then raise exception 'ΑΛΛΑΓΗ: η άδεια στον Λ2 απέτυχε: %', r; end if;
  if (select count(*) from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> 1 then raise exception 'ΑΛΛΑΓΗ: δύο ενεργοί συγχρονιστές'; end if;
  if (select accountant_id from public.mydata_consents where client_id = auth.uid() and revoked_at is null) <> 'ad000000-0000-4000-8000-0000000000c2' then raise exception 'ΑΛΛΑΓΗ: έμεινε ο Λ1'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'switched') then raise exception 'ΑΛΛΑΓΗ: η παλιά άδεια δεν σημειώθηκε'; end if;
  -- Ο πελάτης κόβει τη σύνδεση στο PROPERWISE με τον Λ2: η άδεια φεύγει μόνη της.
  update public.accountant_clients set active = false where owner_id = auth.uid() and accountant_id = 'ad000000-0000-4000-8000-0000000000c2';
  if exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoked_at is null) then raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: η αποσύνδεση άφησε ενεργή άδεια'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = auth.uid() and revoke_reason = 'unlinked') then raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: χωρίς αιτία'; end if;
  raise notice 'probe: ένας συγχρονιστής ανά πελάτη· η αποσύνδεση ανακαλεί μόνη της';
end $probe$;
reset role;

-- Ο λογιστής αφαιρεί τον πελάτη (διαγραφή γραμμής).
do $probe$ begin
  delete from public.accountant_clients where owner_id = 'ad000000-0000-4000-8000-0000000000a2' and accountant_id = 'ad000000-0000-4000-8000-0000000000c2';
  if exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a2' and revoked_at is null) then
    raise exception 'ΑΥΤΟΜΑΤΗ ΑΝΑΚΛΗΣΗ: η αφαίρεση από τον λογιστή άφησε ενεργή άδεια';
  end if;
  if exists (select 1 from public.mydata_docs where client_id = 'ad000000-0000-4000-8000-0000000000a2') then
    raise exception 'ΓΚΠΔ: έμειναν παραστατικά μετά την αφαίρεση';
  end if;
  raise notice 'probe: όταν ο λογιστής αφαιρεί τον πελάτη, η άδεια και τα παραστατικά φεύγουν';
end $probe$;

-- Νεκρός σύνδεσμος: ο πελάτης ανακαλεί τον σύνδεσμο λογιστή· ο επόμενος
-- συγχρονισμός ανακαλεί την άδεια πριν ζητήσει οτιδήποτε.
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
do $probe$ declare r json; begin
  update public.accountant_clients set active = true where owner_id = auth.uid() and accountant_id = 'ad000000-0000-4000-8000-0000000000c1';
  r := public.mydata_consent_grant('ad000000-0000-4000-8000-0000000000c1', extract(year from (now() at time zone 'Europe/Athens'))::int);
  if not (r->>'ok')::boolean then raise exception 'ΣΚΗΝΙΚΟ: ξανά άδεια στον Λ1: %', r; end if;
end $probe$;
reset role;
do $probe$ declare n int; begin
  update public.accountant_links set active = false where user_id = 'ad000000-0000-4000-8000-0000000000a1';
  select count(*) into n from public.mydata_sync_targets('ad000000-0000-4000-8000-0000000000c1', current_setting('mydata.lease')::uuid, 'nightly');
  if n <> 0 then raise exception 'ΝΕΚΡΟΣ ΣΥΝΔΕΣΜΟΣ: ο πελάτης είναι ακόμη στόχος'; end if;
  if not exists (select 1 from public.mydata_consents where client_id = 'ad000000-0000-4000-8000-0000000000a1' and revoke_reason = 'link_revoked') then
    raise exception 'ΝΕΚΡΟΣ ΣΥΝΔΕΣΜΟΣ: η άδεια δεν ανακλήθηκε';
  end if;
  raise notice 'probe: νεκρός σύνδεσμος: η άδεια ανακαλείται πριν από κάθε αίτημα';
end $probe$;

-- ── 11. ΑΦΑΙΡΕΣΗ ΚΛΕΙΔΙΟΥ ΚΑΙ ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ ───────────────────────────────
select set_config('probe.uid', 'ad000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
do $probe$ declare r json; begin
  r := public.mydata_key_remove();
  if not (r->>'ok')::boolean then raise exception 'ΚΛΕΙΔΙ: η αφαίρεση απέτυχε'; end if;
end $probe$;
reset role;
do $probe$ begin
  if exists (select 1 from vault.secrets where name = 'mydata_key:ad000000-0000-4000-8000-0000000000c1') then raise exception 'ΚΛΕΙΔΙ: έμεινε στο Vault μετά την αφαίρεση'; end if;
  if exists (select 1 from public.mydata_key_read('ad000000-0000-4000-8000-0000000000c1')) then raise exception 'ΚΛΕΙΔΙ: διαβάζεται μετά την αφαίρεση'; end if;
  if (select has_key from public.mydata_connections where accountant_id = 'ad000000-0000-4000-8000-0000000000c1') then raise exception 'ΚΛΕΙΔΙ: «has_key» έμεινε αληθές'; end if;

  delete from auth.users where id = 'ad000000-0000-4000-8000-0000000000c2';
  if exists (select 1 from vault.secrets where name = 'mydata_key:ad000000-0000-4000-8000-0000000000c2') then raise exception 'ΔΙΑΓΡΑΦΗ: το κλειδί του Λ2 έμεινε ορφανό στο Vault'; end if;
  if exists (select 1 from public.mydata_consents where accountant_id = 'ad000000-0000-4000-8000-0000000000c2') then raise exception 'ΔΙΑΓΡΑΦΗ: έμειναν άδειες του λογαριασμού που σβήστηκε'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a2' and accountant_id is null) then
    raise exception 'ΔΙΑΓΡΑΦΗ: το αρχείο πρόσβασης του πελάτη χάθηκε μαζί με τον λογιστή';
  end if;
  raise notice 'probe: αφαίρεση κλειδιού και διαγραφή λογαριασμού: το Vault καθαρίζει, το αρχείο του πελάτη μένει';
end $probe$;

-- ── 12. ΟΡΙΟ ΔΙΑΤΗΡΗΣΗΣ ────────────────────────────────────────────────────────
do $probe$ begin
  update public.mydata_access_log set at = now() - interval '25 months' where client_id = 'ad000000-0000-4000-8000-0000000000a2';
  perform private.mydata_prune();
  if exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a2') then raise exception 'ΔΙΑΤΗΡΗΣΗ: αρχείο παλαιότερο των 24 μηνών'; end if;
  if not exists (select 1 from public.mydata_access_log where client_id = 'ad000000-0000-4000-8000-0000000000a1') then raise exception 'ΔΙΑΤΗΡΗΣΗ: σβήστηκε πρόσφατο αρχείο'; end if;
  raise notice 'probe: το αρχείο πρόσβασης κρατά 24 μήνες';
end $probe$;

rollback;
