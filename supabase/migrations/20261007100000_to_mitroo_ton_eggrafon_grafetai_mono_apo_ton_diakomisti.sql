-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΕΓΓΡΑΦΩΝ ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΗ ΔΙΑΔΡΟΜΗ. Η /verify/<κωδικός> είναι δημόσια
-- σελίδα που διαβάζει τράπεζα, ΔΟΥ ή μισθωτής για να κρίνει ένα χαρτί. Ό,τι
-- δείχνει βγαίνει από τον πίνακα `issued_documents` μέσω της `verify_document`.
-- Πηγή του ευρήματος: έλεγχος της παραγωγής (07/10/2026, μόνο ανάγνωση) και
-- ανάγνωση του κώδικα· όχι νόμος ή ΦΕΚ, γιατί το εύρημα είναι ασφάλειας.
--
-- ΤΙ ΒΡΕΘΗΚΕ. Ο πίνακας είχε δύο πολιτικές: την `own_issued_documents` (FOR
-- ALL, `auth.uid() = user_id`, baseline) και την restrictive
-- `mfa_issued_documents` (20261003120000). Δηλαδή κάθε συνδεδεμένος χρήστης
-- μπορούσε, με ένα αίτημα από τον περιηγητή:
--
--   · να ΓΡΑΨΕΙ γραμμή με όποιον τύπο, αντικείμενο, περίοδο και ημερομηνία
--     ήθελε («Βεβαίωση ενοικίου», έκδοση «01/01/2024»)· τον αριθμό, την ώρα
--     και το checksum τα έφτιαχνε ο περιηγητής (lib/documents/issue.ts)·
--   · να την ΑΛΛΑΞΕΙ ή να τη ΣΒΗΣΕΙ αφού τυπώσει το χαρτί.
--
-- Και ως «Εκδότη» η σελίδα έδειχνε την ΤΡΕΧΟΥΣΑ επωνυμία του `report_branding`,
-- που τη γράφει ο ίδιος ο χρήστης: μπορούσε να γράψει όνομα τράπεζας, να
-- τυπώσει και να την ξαναλλάξει. Η σελίδα θα βεβαίωνε κάτω από το όνομα του
-- PROPERWISE ό,τι είχε δηλώσει ο καθένας και θα το βεβαίωνε διαφορετικά από
-- μέρα σε μέρα.
--
-- ΤΙ ΜΕΤΡΗΘΗΚΕ: 8 γραμμές από 2 λογαριασμούς. Δεν αλλάζει κανένα πεδίο τους.
-- Προστίθεται μόνο η στήλη του εκδότη, γεμάτη από την ίδια έκφραση που
-- δείχνει σήμερα η σελίδα, ώστε καμία να μη φαίνεται αλλιώς αύριο.
--
-- Η ΔΙΟΡΘΩΣΗ.
--   1. Ο `anon` και ο `authenticated` χάνουν κάθε δικαίωμα εγγραφής. Ο
--      χρήστης κρατά μόνο ανάγνωση των δικών του γραμμών (πολιτική FOR SELECT
--      στη θέση της FOR ALL). Η restrictive του δεύτερου βήματος μένει.
--   2. Η μόνη πόρτα εγγραφής είναι η `issue_document` (SECURITY DEFINER):
--      ταυτότητα από `auth.uid()`, πύλη 2FA, κλειστός κατάλογος τύπων, όρια
--      μήκους, αριθμός από `gen_random_bytes`, ώρα `now()`, αποτύπωμα sha256
--      και στιγμιότυπο του εκδότη τη στιγμή της έκδοσης.
--   3. Trigger που αρνείται κάθε UPDATE σε κάθε ρόλο, ακόμη και στον ρόλο υπηρεσίας.
--      Η διαγραφή μένει μόνο για τη διαγραφή λογαριασμού (on delete cascade):
--      το δικαίωμα διαγραφής δεδομένων δεν καταργείται από ένα μητρώο.
--   4. Η `verify_document` κρατά ΑΚΡΙΒΩΣ την υπογραφή και τον τύπο επιστροφής
--      της (ώστε η 20261006160000 να ξανατρέχει) και διαβάζει πλέον τον
--      εκδότη του στιγμιοτύπου. Μένει για τη σελίδα που τρέχει όσο ανεβαίνει
--      η νέα. Η νέα `verify_issued_document` δίνει τα ίδια συν το αποτύπωμα
--      και αν ταιριάζει ακόμη με τη γραμμή (`intact`)· αυτήν καλεί η /verify.
--      Οι 8 παλιές γραμμές έχουν checksum του περιηγητή (djb2), οπότε
--      απαντούν `intact = false`: η σελίδα δεν βεβαιώνει γι' αυτές ότι δεν
--      άλλαξαν, γιατί μέχρι σήμερα μπορούσαν να αλλάξουν.
--
-- ΤΟ ΑΠΟΤΥΠΩΜΑ. sha256 σε δεκαεξαδική γραφή, πάνω στο κείμενο ενός πίνακα
-- jsonb: ['properwise-issued-v1', id, user_id, doc_type, subject, period,
-- issued_at σε UTC με μικροδευτερόλεπτα, issuer, summary]. Το jsonb δίνει μία
-- και μόνη γραφή για κάθε τιμή (ταξινομημένα κλειδιά, σταθερά κενά), οπότε το
-- ίδιο περιεχόμενο βγάζει πάντα το ίδιο αποτύπωμα. Το `summary` μένει ιδιωτικό
-- αλλά δένεται στο αποτύπωμα: αν αλλάξει ένα ποσό, το `intact` γίνεται false.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `add column if not exists`, `drop … if exists` πριν από κάθε
-- δημιουργία, `create or replace`. Το γέμισμα αγγίζει μόνο γραμμές χωρίς
-- εκδότη και τρέχει πριν μπει ο trigger. Απόδειξη: scripts/db-replay.sh και
-- οι έλεγχοι του μητρώου στο scripts/db/rls-probe.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ο εκδότης, όπως ήταν τη στιγμή της έκδοσης ────────────────────────
alter table public.issued_documents add column if not exists issuer text;

-- Ο trigger φεύγει πριν από το γέμισμα και ξαναμπαίνει στο τέλος: σε δεύτερη
-- εκτέλεση το γέμισμα δεν βρίσκει γραμμή, αλλά η σειρά δεν στηρίζεται σε αυτό.
drop trigger if exists issued_documents_immutable on public.issued_documents;

-- Ίδια έκφραση με την `verify_document` της 20261006160000: ό,τι έβλεπε χθες
-- η σελίδα, αυτό γράφεται.
update public.issued_documents d
   set issuer = coalesce(
         (select nullif(btrim(b.company_name), '')
            from public.report_branding b
           where b.user_id = d.user_id and b.enabled = true),
         'PROPERWISE')
 where d.issuer is null;

alter table public.issued_documents alter column issuer set not null;

comment on column public.issued_documents.issuer is
  'Ο εκδότης όπως τον δήλωσε ο χρήστης (επωνυμία report_branding ή PROPERWISE), παγωμένος τη στιγμή της έκδοσης. Μια μεταγενέστερη αλλαγή επωνυμίας δεν ξαναγράφει την ιστορία.';

-- ── 2. Το αποτύπωμα ──────────────────────────────────────────────────────
-- Όχι SECURITY DEFINER: δεν διαβάζει πίνακα, μόνο τα ορίσματά του. Το
-- `to_char` πάνω σε `timestamp` είναι STABLE, άρα και η συνάρτηση.
create or replace function private.issued_document_digest(
  p_id text, p_user uuid, p_doc_type text, p_subject text, p_period text,
  p_issued_at timestamptz, p_issuer text, p_summary jsonb)
returns text
language sql stable
set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    'properwise-issued-v1', p_id, p_user, p_doc_type, p_subject, p_period,
    to_char(p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    p_issuer, p_summary)::text, 'UTF8')), 'hex')
$$;
alter function private.issued_document_digest(text, uuid, text, text, text, timestamptz, text, jsonb) owner to postgres;
revoke all on function private.issued_document_digest(text, uuid, text, text, text, timestamptz, text, jsonb) from public, anon, authenticated;

comment on function private.issued_document_digest(text, uuid, text, text, text, timestamptz, text, jsonb) is
  'sha256 (hex) μιας γραμμής του μητρώου εγγράφων, πάνω σε κανονική γραφή jsonb. Το καλούν μόνο η issue_document και η verify_document.';

-- ── 3. Οι πολιτικές και τα δικαιώματα ────────────────────────────────────
drop policy if exists own_issued_documents on public.issued_documents;
drop policy if exists own_issued_documents_read on public.issued_documents;
create policy own_issued_documents_read on public.issued_documents
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.issued_documents from anon, authenticated;
grant select on table public.issued_documents to authenticated;

-- ── 4. Η μόνη πόρτα εγγραφής ─────────────────────────────────────────────
-- Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΤΥΠΩΝ είναι ακριβώς όσοι εκδίδει σήμερα η εφαρμογή
-- (`ISSUED_DOC_TYPES`, lib/documents/issue.ts· η δοκιμή του αρχείου ελέγχει
-- ότι οι δύο λίστες συμφωνούν). Νέος τύπος = νέα μετανάστευση.
create or replace function public.issue_document(
  p_doc_type text, p_subject text, p_period text, p_summary jsonb)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c_types constant text[] := array[
    'Αναφορά απόδοσης',
    'Αναφορά χαρτοφυλακίου',
    'Βεβαίωση ενοικίου',
    'Ειδοποίηση αναπροσαρμογής μισθώματος',
    'Ιδιωτικό συμφωνητικό μίσθωσης',
    'Κατάσταση ιδιοκτήτη',
    'Κατάσταση κατανομής',
    'Λογιστική αναφορά',
    'Πίνακας τοκοχρεολυσίου',
    'Φάκελος για τον λογιστή'
  ];
  -- Χωρίς 0/O και 1/I/L, όπως το lib/documents/verifyCode.ts.
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c_max_text constant int := 200;
  c_max_summary constant int := 8192;
  v_uid     uuid := auth.uid();
  v_subject text := coalesce(p_subject, '');
  v_period  text := coalesce(p_period, '');
  v_summary jsonb := coalesce(p_summary, '{}'::jsonb);
  v_now     timestamptz := now();
  v_issuer  text;
  v_id      text;
  v_code    text;
  v_bytes   bytea;
  v_b       int;
  v_cut     int;
  v_sum     text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'issue_document: χωρίς σύνδεση δεν εκδίδεται έγγραφο'
      using errcode = 'insufficient_privilege';
  end if;
  if p_doc_type is null or not (p_doc_type = any(c_types)) then
    raise exception 'issue_document: άγνωστος τύπος εγγράφου' using errcode = '22023';
  end if;
  if char_length(v_subject) > c_max_text or char_length(v_period) > c_max_text then
    raise exception 'issue_document: αντικείμενο ή περίοδος πάνω από % χαρακτήρες', c_max_text
      using errcode = '22001';
  end if;
  if jsonb_typeof(v_summary) <> 'object' or octet_length(v_summary::text) > c_max_summary then
    raise exception 'issue_document: η σύνοψη πρέπει να είναι αντικείμενο έως % bytes', c_max_summary
      using errcode = '22023';
  end if;

  -- Ο εκδότης ΤΩΡΑ, με την ίδια έκφραση που διάβαζε η σελίδα επαλήθευσης.
  v_issuer := coalesce(
    (select nullif(btrim(b.company_name), '')
       from report_branding b
      where b.user_id = v_uid and b.enabled = true),
    'PROPERWISE');

  -- Ο ΑΡΙΘΜΟΣ: PO-ΕΕΜΜΗΗ-XXXXXXXX, ημερομηνία Ελλάδας. Δειγματοληψία με
  -- απόρριψη: δεκτά μόνο τα byte κάτω από το μεγαλύτερο πολλαπλάσιο του
  -- μήκους του αλφαβήτου, ώστε κάθε σύμβολο να έχει την ίδια πιθανότητα.
  v_cut := 256 - 256 % length(c_alphabet);
  for attempt in 1..5 loop
    v_code := '';
    while length(v_code) < 8 loop
      v_bytes := gen_random_bytes(16);
      for i in 0..15 loop
        v_b := get_byte(v_bytes, i);
        if v_b < v_cut then
          v_code := v_code || substr(c_alphabet, v_b % length(c_alphabet) + 1, 1);
          exit when length(v_code) = 8;
        end if;
      end loop;
    end loop;
    v_id := 'PO-' || to_char(v_now at time zone 'Europe/Athens', 'YYMMDD') || '-' || v_code;
    v_sum := private.issued_document_digest(v_id, v_uid, p_doc_type, v_subject, v_period, v_now, v_issuer, v_summary);
    begin
      insert into issued_documents (id, user_id, doc_type, subject, period, issued_at, summary, checksum, issuer)
      values (v_id, v_uid, p_doc_type, v_subject, v_period, v_now, v_summary, v_sum, v_issuer);
      return json_build_object('id', v_id, 'issued_at', v_now, 'checksum', v_sum);
    exception when unique_violation then
      null;  -- ίδιος αριθμός την ίδια μέρα: νέα κλήρωση
    end;
  end loop;
  raise exception 'issue_document: δεν βρέθηκε ελεύθερος αριθμός' using errcode = '40001';
end;
$$;

alter function public.issue_document(text, text, text, jsonb) owner to postgres;
revoke all on function public.issue_document(text, text, text, jsonb) from public, anon;
grant execute on function public.issue_document(text, text, text, jsonb) to authenticated, service_role;

comment on function public.issue_document(text, text, text, jsonb) is
  'Η μόνη εγγραφή στο μητρώο εγγράφων. Αριθμός, ώρα, εκδότης και αποτύπωμα από τον διακομιστή· κλειστός κατάλογος τύπων· πύλη 2FA.';

-- ── 5. Καμία αλλαγή μετά την έκδοση ──────────────────────────────────────
create or replace function private.issued_documents_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'issued_documents: εκδοθέν έγγραφο δεν αλλάζει (%)', old.id
    using errcode = '42501';
end;
$$;
alter function private.issued_documents_immutable() owner to postgres;
revoke all on function private.issued_documents_immutable() from public, anon, authenticated;

create trigger issued_documents_immutable
  before update on public.issued_documents
  for each row execute function private.issued_documents_immutable();

-- ── 6. Η σελίδα επαλήθευσης ──────────────────────────────────────────────
-- Η ΠΑΛΙΑ ΥΠΟΓΡΑΦΗ ΜΕΝΕΙ ΙΔΙΑ. Ίδια ονόματα και τύποι στηλών με την
-- 20261006160000, ώστε εκείνη να ξανατρέχει χωρίς «cannot change return
-- type». Αλλάζει μόνο η πηγή του εκδότη: η στήλη του στιγμιοτύπου, όχι η
-- τρέχουσα επωνυμία.
create or replace function public.verify_document(p_id text)
returns table(id text, doc_type text, subject text, period text, issued_at timestamptz, issuer text)
language sql stable security definer
set search_path to 'public'
as $$
  select d.id, d.doc_type, d.subject, d.period, d.issued_at, d.issuer
  from public.issued_documents d
  where d.id = p_id;
$$;

alter function public.verify_document(text) owner to postgres;
revoke all     on function public.verify_document(text) from public;
grant  execute on function public.verify_document(text) to anon, authenticated, service_role;

-- Η ΝΕΑ: τα ίδια, συν το αποτύπωμα και τον έλεγχό του. Το `intact`
-- υπολογίζεται σε κάθε ερώτηση από τη γραμμή όπως είναι ΤΩΡΑ. Ίδια
-- δικαιώματα με την `verify_document`: δημόσια, χωρίς λογαριασμό.
create or replace function public.verify_issued_document(p_id text)
returns table(id text, doc_type text, subject text, period text, issued_at timestamptz,
              issuer text, checksum text, intact boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select d.id, d.doc_type, d.subject, d.period, d.issued_at, d.issuer, d.checksum,
         d.checksum = private.issued_document_digest(
           d.id, d.user_id, d.doc_type, d.subject, d.period, d.issued_at, d.issuer, d.summary) as intact
  from public.issued_documents d
  where d.id = p_id;
$$;

alter function public.verify_issued_document(text) owner to postgres;
revoke all     on function public.verify_issued_document(text) from public;
grant  execute on function public.verify_issued_document(text) to anon, authenticated, service_role;

comment on function public.verify_issued_document(text) is
  'Η /verify: τύπος, αντικείμενο, περίοδος, ημερομηνία, εκδότης-στιγμιότυπο, αποτύπωμα sha256 και αν η γραμμή ταιριάζει ακόμη με αυτό. Ποτέ ποσά.';

-- ── 7. Απόδειξη ──────────────────────────────────────────────────────────
do $chk$
declare n int;
begin
  select count(*) into n from public.issued_documents where issuer is null or btrim(issuer) = '';
  if n <> 0 then raise exception 'issued_documents: % γραμμές χωρίς εκδότη', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'issued_documents' and permissive = 'PERMISSIVE';
  if n <> 1 then raise exception 'issued_documents: % permissive πολιτικές αντί για 1 (μόνο ανάγνωση)', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'issued_documents'
     and permissive = 'PERMISSIVE' and cmd <> 'SELECT';
  if n <> 0 then raise exception 'issued_documents: έμεινε permissive πολιτική εγγραφής'; end if;

  if has_table_privilege('authenticated', 'public.issued_documents', 'insert')
     or has_table_privilege('authenticated', 'public.issued_documents', 'update')
     or has_table_privilege('authenticated', 'public.issued_documents', 'delete')
     or has_table_privilege('anon', 'public.issued_documents', 'select') then
    raise exception 'issued_documents: ρόλος πελάτη κρατά δικαίωμα που δεν πρέπει';
  end if;
  if has_function_privilege('anon', 'public.issue_document(text, text, text, jsonb)', 'execute') then
    raise exception 'issue_document: εκτελέσιμη από ανώνυμο';
  end if;
end
$chk$;
