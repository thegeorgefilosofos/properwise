-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΣΕΛΙΔΑ ΕΠΑΛΗΘΕΥΣΗΣ ΛΕΕΙ PROPERWISE, ΟΧΙ ΤΟ ΠΑΛΙΟ ΟΝΟΜΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΒΡΕΘΗΚΕ. Η /verify/<κωδικός> δείχνει «Εκδότης» από την `verify_document`:
-- την επωνυμία του `report_branding` όταν υπάρχει, αλλιώς μια σταθερή. Η
-- μετονομασία της 24/08/2026 άλλαξε τη σταθερή στο baseline, αλλά το baseline
-- δεν ξανατρέχει στην παραγωγή. Η ζωντανή συνάρτηση γράφει ακόμη το ΠΑΛΙΟ
-- όνομα του προϊόντος (`pg_get_functiondef`, 6/10/2026, μόνο ανάγνωση).
--
-- ΤΙ ΣΗΜΑΙΝΕ. Η τράπεζα ή η ΔΟΥ που σαρώνει το QR μιας βεβαίωσης χωρίς
-- επωνυμία διαβάζει ως εκδότη ένα όνομα που δεν υπάρχει πουθενά αλλού: ούτε
-- στο PDF ούτε στη διεύθυνση της σελίδας. Σε σελίδα που υπάρχει για να πει αν
-- ένα έγγραφο είναι γνήσιο, δύο ονόματα για τον ίδιο εκδότη μοιάζουν πλαστά.
--
-- Η ΔΙΟΡΘΩΣΗ. Ίδιο σώμα με το baseline (που ήδη λέει PROPERWISE), ίδια
-- υπογραφή, SECURITY DEFINER και search_path. Το `create or replace` κρατά τα
-- δικαιώματα· γράφονται ξανά για να φαίνεται ότι η σελίδα μένει δημόσια.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.verify_document(p_id text)
returns table(id text, doc_type text, subject text, period text, issued_at timestamptz, issuer text)
language sql stable security definer
set search_path to 'public'
as $$
  select d.id, d.doc_type, d.subject, d.period, d.issued_at,
         coalesce(nullif(btrim(b.company_name), ''), 'PROPERWISE') as issuer
  from public.issued_documents d
  left join public.report_branding b on b.user_id = d.user_id and b.enabled = true
  where d.id = p_id;
$$;

alter function public.verify_document(text) owner to postgres;
revoke all     on function public.verify_document(text) from public;
grant  execute on function public.verify_document(text) to anon, authenticated, service_role;
