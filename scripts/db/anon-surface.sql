-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΙ ΜΠΟΡΕΙ ΝΑ ΚΑΛΕΣΕΙ ΚΑΠΟΙΟΣ ΧΩΡΙΣ ΝΑ ΕΧΕΙ ΛΟΓΑΡΙΑΣΜΟ
-- ─────────────────────────────────────────────────────────────────────────
--  ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΑΠΟΤΡΕΠΕΙ. Μια συνάρτηση SECURITY DEFINER τρέχει με
--  δικαιώματα του κατόχου: ΠΑΡΑΚΑΜΠΤΕΙ την RLS εκ κατασκευής. Όταν είναι και
--  εκτελέσιμη από τον ρόλο `anon`, γίνεται δημόσια διαδρομή προς όλα τα
--  δεδομένα, ανοιχτή σε οποιονδήποτε ξέρει τη διεύθυνση του project.
--
--  Δεν είναι υποθετικό: ο έλεγχος της Supabase βρήκε την `owns_parent_property`
--  εκτελέσιμη από ανώνυμο. Δεν την πρόσθεσε κανείς επίτηδες — γεννήθηκε έτσι,
--  γιατί το προεπιλεγμένο δικαίωμα εκτέλεσης στην PostgreSQL είναι «όλοι».
--
--  Ο ΚΑΝΟΝΑΣ. Κάθε συνάρτηση που φτάνει στον ανώνυμο πρέπει να είναι ΓΡΑΜΜΕΝΗ
--  εδώ, με τον λόγο της. Καινούρια που εμφανίζεται χωρίς γραμμή, κοκκινίζει.
--  Γραμμή που περισσεύει, κοκκινίζει επίσης: ο κατάλογος δεν επιτρέπεται να
--  γεμίσει με ονόματα που δεν υπάρχουν πια, γιατί τότε κανείς δεν τον διαβάζει.
--
--  ΤΟ ΚΡΙΤΗΡΙΟ ΓΙΑ ΝΑ ΜΠΕΙ ΚΑΤΙ ΕΔΩ. Πρέπει να είναι πύλη με μυστικό στο χέρι
--  του επισκέπτη: ένα token που στέλνει ο ιδιοκτήτης. Κάθε μία από τις
--  παρακάτω ξεκινά επαληθεύοντας το token σε πίνακα συνδέσμων, με `active` και
--  `expires_at` και ό,τι αγγίζει μετά είναι δεμένο σε ΕΚΕΙΝΟΝ τον σύνδεσμο.
--  Χωρίς έγκυρο token επιστρέφουν κενό, όχι σφάλμα που αποκαλύπτει ύπαρξη.
-- ═══════════════════════════════════════════════════════════════════════════

create temporary table expected_anon (name text primary key, why text);
insert into expected_anon values
  ('count_signup_step',         'Ανώνυμος μετρητής του χωνιού εγγραφής. Εξαίρεση από το κριτήριο του token: δεν διαβάζει και δεν επιστρέφει τίποτα, δέχεται μόνο τιμές από κλειστούς καταλόγους και γράφει μόνο +1 σε μετρητή με ταβάνι.'),
  ('confirm_reminder_email',    'Ο παραλήπτης πατά τον σύνδεσμο επιβεβαίωσης από το email του. Το token είναι uuid μιας χρήσης.'),
  ('declare_rent_payment',      'Ο μισθωτής δηλώνει ότι πλήρωσε, από την πύλη του. Ενημερώνει ΜΟΝΟ δόση του ακινήτου του συνδέσμου και μόνο απλήρωτη. Με κωδικό στον σύνδεσμο ζητά τον κωδικό και μετρά στο ίδιο κλείδωμα με την ανάγνωση· δέκα ανά ώρα.'),
  ('get_accountant_data',       'Ο λογιστής ανοίγει τον σύνδεσμο που του έστειλε ο ιδιοκτήτης. Επιστρέφει μόνο τα ακίνητα ΕΚΕΙΝΟΥ του ιδιοκτήτη.'),
  ('get_checkin_context',       'Ο επισκέπτης ανοίγει τη φόρμα άφιξης. Επιστρέφει όνομα και διεύθυνση καταλύματος, τίποτα άλλο.'),
  ('get_portal_data',           'Η πύλη του μισθωτή, με token ΚΑΙ PIN. Οι αποτυχημένες προσπάθειες μετριούνται σε portal_pin_attempts.'),
  ('marketing_prefs_by_token',  'Ο παραλήπτης βλέπει τις προτιμήσεις του από σύνδεσμο email, για να τις αλλάξει.'),
  ('portal_meta',               'Τι είδους πύλη είναι και αν ζητά PIN. Απαντά πριν τη σύνδεση, χωρίς δεδομένα.'),
  ('submit_checkin',            'Ο επισκέπτης υποβάλλει τα στοιχεία άφιξης. Γράφει μόνο στο κατάλυμα του συνδέσμου.'),
  ('submit_maintenance_request','Ο μισθωτής αναφέρει βλάβη από την πύλη του. Με κωδικό στον σύνδεσμο ζητά τον κωδικό· πέντε ανά ώρα.'),
  ('unsubscribe_email',         'Διαγραφή από λίστα με ένα κλικ, από τον σύνδεσμο του email. Υποχρέωση, όχι επιλογή.'),
  ('verify_document',           'Επαλήθευση γνησιότητας εγγράφου που εκδώσαμε, από το αναγνωριστικό που φέρει τυπωμένο πάνω του.');

do $audit$
declare
  extra text;
  missing text;
  unsafe text;
begin
  -- ── 1. ΚΑΜΙΑ ΚΑΙΝΟΥΡΙΑ ΔΗΜΟΣΙΑ ΔΙΑΔΡΟΜΗ ΧΩΡΙΣ ΓΡΑΨΙΜΟ ────────────────────
  select string_agg(p.proname, ', ' order by p.proname) into extra
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in (select name from expected_anon);
  if extra is not null then
    raise exception E'ΝΕΑ ΔΗΜΟΣΙΑ ΔΙΑΔΡΟΜΗ ΧΩΡΙΣ ΑΙΤΙΟΛΟΓΙΑ: %\n  Μια SECURITY DEFINER εκτελέσιμη από ανώνυμο παρακάμπτει την RLS.\n  Αν είναι σκόπιμο, γράψ'' το στο scripts/db/anon-surface.sql με τον λόγο.\n  Αν όχι: revoke all on function public.%%(...) from anon;', extra;
  end if;

  -- ── 2. ΚΑΙ Ο ΚΑΤΑΛΟΓΟΣ ΔΕΝ ΚΡΑΤΑ ΦΑΝΤΑΣΜΑΤΑ ─────────────────────────────
  select string_agg(e.name, ', ' order by e.name) into missing
    from expected_anon e
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = e.name
        and has_function_privilege('anon', p.oid, 'execute'));
  if missing is not null then
    raise exception 'ΓΡΑΜΜΕΣ ΠΟΥ ΠΕΡΙΣΣΕΥΟΥΝ: %. Δεν υπάρχουν πια ή δεν είναι ανοιχτές στον ανώνυμο. Σβήσε τες, αλλιώς ο κατάλογος γίνεται διακοσμητικός.', missing;
  end if;

  -- ── 3. ΚΑΘΕ SECURITY DEFINER ΚΛΕΙΔΩΝΕΙ ΤΟ SEARCH_PATH ────────────────────
  -- Χωρίς αυτό, ποιος πίνακας θα διαβαστεί εξαρτάται από τη συνεδρία που
  -- καλεί. Είναι ο κλασικός τρόπος να στραφεί μια συνάρτηση εναντίον της βάσης
  -- της. Ένας trigger είχε ξεφύγει· δεν ξαναγίνεται σιωπηλά.
  select string_agg(p.proname, ', ' order by p.proname) into unsafe
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and (p.proconfig is null or not exists (
       select 1 from unnest(p.proconfig) c where c like 'search\_path=%'));
  if unsafe is not null then
    raise exception 'SECURITY DEFINER ΧΩΡΙΣ ΚΛΕΙΔΩΜΕΝΟ SEARCH_PATH: %', unsafe;
  end if;

  raise notice 'probe: 12 δημόσιες διαδρομές, όλες γραμμένες· κάθε SECURITY DEFINER κλειδώνει το search_path';
end $audit$;

-- ═══════════════════════════════════════════════════════════════════════════
--  ΚΑΙ ΟΣΕΣ ΤΡΕΧΟΥΝ ΜΟΝΟ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΔΕΝ ΦΤΑΝΟΥΝ ΣΤΟΝ ΣΥΝΔΕΔΕΜΕΝΟ
-- ─────────────────────────────────────────────────────────────────────────
--  Ο κατάλογος από πάνω κοιτά μόνο τον `anon`. Ο έλεγχος της 27.09.2026 βρήκε
--  έξι SECURITY DEFINER που τις καλεί μόνο το cron, άλλη SQL ή κανείς. Παρ'
--  όλα αυτά ήταν εκτελέσιμες από κάθε συνδεδεμένο λογαριασμό. Η
--  `enqueue_email` ήταν ανοιχτός αναμεταδότης email· η `drain_email_outbox`
--  είχε ξαναδοθεί στον `authenticated` μέσα σε βρόχο που κανένας φύλακας
--  κειμένου δεν διάβαζε. Η μετανάστευση
--  20260928100000_oi_synartiseis_tou_diakomisti_kleinoun_ston_pelati.sql τις
--  έκλεισε· εδώ ρωτιέται η ίδια η βάση ότι μένουν κλειστές.
-- ═══════════════════════════════════════════════════════════════════════════
do $server_only$
declare
  s text;
  f regprocedure;
  open_ text;
begin
  foreach s in array array[
    'public.drain_email_outbox(integer)',
    'public.enqueue_email(text,text,text,jsonb,text,text,interval)',
    'public.accountant_link_live(uuid,uuid)',
    'public.set_org_member_role(text,text)',
    'public.bump_ai_usage(integer,integer[],integer[],integer)',
    'public.bump_ai_usage(integer,integer[],integer[],integer,integer,integer)'
  ] loop
    f := to_regprocedure(s);
    continue when f is null;
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      open_ := concat_ws(', ', open_, f::text);
    end if;
  end loop;
  if open_ is not null then
    raise exception E'SECURITY DEFINER ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΑΝΟΙΧΤΗ ΣΕ ΡΟΛΟ ΠΕΛΑΤΗ: %\n  Την καλεί μόνο το cron ή άλλη SQL. revoke execute on function … from public, anon, authenticated;', open_;
  end if;
  raise notice 'probe: οι συναρτήσεις του διακομιστή μένουν κλειστές σε anon και authenticated';
end $server_only$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Ο ΕΛΕΓΧΟΣ ΚΩΔΙΚΟΥ ΤΗΣ ΠΥΛΗΣ ΚΑΙ Η ΑΔΕΙΑ ΦΩΤΟΓΡΑΦΙΑΣ ΔΕΝ ΚΑΛΟΥΝΤΑΙ ΑΠΟ ΠΕΛΑΤΗ
-- ─────────────────────────────────────────────────────────────────────────
--  20261003110000_oi_eggrafes_tis_pylis_zitoun_ton_kodiko.sql. Η
--  `portal_pin_gate` γράφει αποτυχίες και σβήνει το κλείδωμα· η
--  `portal_upload_slot` μετρά τις φωτογραφίες πριν ο διακομιστής υπογράψει
--  ανέβασμα. Απευθείας από τον περιηγητή η πρώτη θα ήταν μαντείο κωδικού έξω
--  από τις συναρτήσεις που την ελέγχουν και η δεύτερη θα ξόδευε το ταβάνι του
--  ενοικιαστή. Καλούνται μόνο από SQL και από τον ρόλο υπηρεσίας.
-- ═══════════════════════════════════════════════════════════════════════════
do $portal_server_only$
declare
  s text;
  f regprocedure;
  open_ text;
begin
  foreach s in array array[
    'public.portal_pin_gate(text,text)',
    'public.portal_upload_slot(text,text)',
    'public.allow_public_submit(text,text,integer,interval)',
    -- 20261004090000: το ωριαίο σκούπισμα των προσπαθειών. Το καλεί μόνο το
    -- pg_cron· από τον περιηγητή θα έσβηνε μετρητές άλλων κουπονιών.
    'public.prune_portal_pin_attempts(integer)'
  ] loop
    f := to_regprocedure(s);
    if f is null then
      raise exception 'Λείπει η %: η πύλη δεν έχει πια κοινό έλεγχο κωδικού ή ταβάνι.', s;
    end if;
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      open_ := concat_ws(', ', open_, f::text);
    end if;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'Ο ρόλος υπηρεσίας δεν εκτελεί την %: η διαδρομή ανεβάσματος θα απαντά 503.', s;
    end if;
  end loop;
  if open_ is not null then
    raise exception E'ΕΛΕΓΧΟΣ ΚΩΔΙΚΟΥ ΑΝΟΙΧΤΟΣ ΣΕ ΡΟΛΟ ΠΕΛΑΤΗ: %\n  revoke execute on function … from public, anon, authenticated;', open_;
  end if;
  raise notice 'probe: ο έλεγχος κωδικού και η άδεια φωτογραφίας της πύλης μένουν στον διακομιστή';
end $portal_server_only$;

-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ: Ο ΑΝΩΝΥΜΟΣ ΠΡΟΣΘΕΤΕΙ +1 ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ
-- ─────────────────────────────────────────────────────────────────────────
--  Η `count_signup_step` είναι η μόνη γραφή που επιτρέπεται χωρίς λογαριασμό.
--  Ρωτιέται η βάση, ως `anon`: μετρά το γνωστό βήμα, σωπαίνει στο άγνωστο,
--  σταματά στο ταβάνι και ο πελάτης δεν διαβάζει ούτε γράφει τον πίνακα
--  απευθείας. Το rls-probe.sql έχει ήδη δώσει GRANT σε όλους τους πίνακες,
--  όπως η πλατφόρμα: άρα εδώ κρίνεται η RLS, η κλειδαριά που μένει πάντα.
-- ═══════════════════════════════════════════════════════════════════════════
delete from public.signup_funnel;
set role anon;
select public.count_signup_step('view', 'instagram', true, true);
select public.count_signup_step('view', 'instagram', true, true);
select public.count_signup_step('kati_allo', 'instagram', true, true);
select public.count_signup_step('view', 'https://example.com/?email=x', true, true);
do $anon_reads$
declare seen int;
begin
  select count(*) into seen from public.signup_funnel;
  if seen <> 0 then
    raise exception 'Ο ανώνυμος διαβάζει % γραμμές του χωνιού', seen;
  end if;
  begin
    insert into public.signup_funnel (day, step, source, in_app, mobile, n)
    values (current_date, 'sent', 'direct', false, false, 999);
    raise exception 'ΕΚΘΕΣΗ: ο ανώνυμος γράφει το χωνί απευθείας, χωρίς τη συνάρτηση';
  exception when insufficient_privilege then null;
  end;
end $anon_reads$;
reset role;
do $funnel$
declare v int; rows_ int;
begin
  select n into v from public.signup_funnel where step = 'view' and source = 'instagram' and in_app and mobile;
  if v is distinct from 2 then
    raise exception 'Ο ανώνυμος μετρητής του χωνιού έγραψε % αντί για 2', v;
  end if;
  select count(*) into rows_ from public.signup_funnel;
  if rows_ <> 1 then
    raise exception 'Άγνωστο βήμα ή πηγή μπήκε στο χωνί ως ΝΕΑ γραμμή: % γραμμές', rows_;
  end if;
  update public.signup_funnel set n = 1000;
  perform public.count_signup_step('view', 'instagram', true, true);
  select n into v from public.signup_funnel;
  if v <> 1000 then
    raise exception 'Ο μετρητής του χωνιού πέρασε το ταβάνι: %', v;
  end if;
  delete from public.signup_funnel;
  raise notice 'probe: ο ανώνυμος μετρά το χωνί της εγγραφής και δεν διαβάζει τίποτα';
end $funnel$;

drop table expected_anon;
