-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΠΟΛΙΤΙΚΗ «Service write inventory_handovers» ΗΤΑΝ ΠΕΡΙΤΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΕΥΡΗΜΑ (05.10.2026, Supabase advisor `multiple_permissive_policies`).
-- Ο πίνακας inventory_handovers είχε δύο επιτρεπτικές πολιτικές για κάθε
-- ενέργεια: την `own_inventory_handovers` και την
-- `Service write inventory_handovers` (TO public, USING auth.role() =
-- 'service_role'). Είκοσι από τα 260 ευρήματα του advisor.
--
-- ΓΙΑΤΙ ΔΕΝ ΚΑΝΕΙ ΤΙΠΟΤΑ. Ο ρόλος service_role έχει BYPASSRLS
-- (pg_roles.rolbypassrls = true, μετρημένο στην παραγωγή 05.10.2026): δεν
-- περνά από καμία πολιτική, οπότε η πολιτική δεν δίνει πρόσβαση σε κανέναν.
-- Για κάθε άλλον ρόλο η συνθήκη της είναι ψευδής. Η σημείωση του
-- 20260815100000 («ο ρόλος υπηρεσίας χάνει την εγγραφή») ίσχυε για τη μορφή
-- της έκφρασης, όχι για την ανάγκη της πολιτικής.
--
-- ΓΙΑΤΙ ΜΟΝΟ ΑΥΤΗ. Τα υπόλοιπα 240 ευρήματα είναι το κανονικό σχήμα του
-- docs/db/rls-conventions.md: `own_<πίνακας>` συν `org_read_` / `org_edit_` /
-- `org_del_`, που διαβάζονται χωριστά και τα ελέγχει το scripts/db/rls-probe.sql.
-- Η ένωσή τους σε μία πολιτική ανά ενέργεια θα κέρδιζε ελάχιστο χρόνο στον
-- σημερινό όγκο και θα έσπαγε τη σύμβαση. Δεν γίνεται εδώ.
--
-- Η σύμβαση (κανόνας 4 και ονόματα) ζητά έτσι κι αλλιώς πολιτικές υπηρεσίας
-- μόνο ως `<πίνακας>_service_write TO service_role` και καθόλου σε πίνακες
-- δεδομένων χρήστη.
-- ═══════════════════════════════════════════════════════════════════════════

do $mig$
begin
  if not (select rolbypassrls from pg_roles where rolname = 'service_role') then
    raise exception 'ο service_role δεν παρακάμπτει το RLS εδώ: η πολιτική δεν είναι περιττή, σταματώ';
  end if;
end
$mig$;

drop policy if exists "Service write inventory_handovers" on public.inventory_handovers;

-- Ο ιδιοκτήτης κρατά την πρόσβασή του: μία επιτρεπτική πολιτική ανά ενέργεια.
do $chk$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'inventory_handovers'
     and permissive = 'PERMISSIVE' and policyname = 'own_inventory_handovers';
  if n <> 1 then
    raise exception 'λείπει η own_inventory_handovers: ο ιδιοκτήτης θα έχανε τα πρωτόκολλα παράδοσης';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'inventory_handovers' and permissive = 'PERMISSIVE';
  if n <> 1 then
    raise exception 'inventory_handovers: % επιτρεπτικές πολιτικές, αναμενόταν 1', n;
  end if;
end
$chk$;
