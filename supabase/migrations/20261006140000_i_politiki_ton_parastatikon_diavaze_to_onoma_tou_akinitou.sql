-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΠΟΛΙΤΙΚΗ ΤΩΝ ΠΑΡΑΣΤΑΤΙΚΩΝ ΔΙΑΒΑΖΕ ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΟΧΙ ΤΗ ΔΙΑΔΡΟΜΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΒΡΕΘΗΚΕ. Οι τρεις πολιτικές του κάδου `inventory-docs`
-- (00000000000001_platform_storage.sql) γράφουν μέσα στο `exists (select …
-- from user_properties p …)` το σκέτο `name`. Εκεί μέσα το `name` δένεται στη
-- στήλη `user_properties.name` —το όνομα του ακινήτου— και όχι στη διαδρομή
-- του αρχείου. Ο ίδιος ο Postgres το γράφει ρητά στη ζωντανή βάση:
--
--   select pg_get_expr(polqual, polrelid) from pg_policy
--   where polname = 'inv_docs_select';
--   → … where ((p.id)::text = (storage.foldername(p.name))[2]) …
--
-- ΤΙ ΣΗΜΑΙΝΕ. Δύο πράγματα, αληθινά σήμερα και τα δύο:
--   1. Το νόμιμο ανέβασμα σε `receipts/<property_id>/…` απορρίπτεται, γιατί το
--      όνομα ενός ακινήτου δεν μοιάζει ποτέ με διαδρομή. Η λειτουργία δεν
--      δουλεύει.
--   2. Όποιος δώσει στο δικό του ακίνητο όνομα `x/<το δικό του id>/y` κάνει τη
--      συνθήκη αληθή για ΚΑΘΕ αρχείο του κάδου: διαβάζει, ανεβάζει και σβήνει
--      τα παραστατικά όλων.
--
-- ΤΙ ΜΕΤΡΗΘΗΚΕ ΣΤΗΝ ΠΑΡΑΓΩΓΗ (6/10/2026, μόνο ανάγνωση): 0 αρχεία στον κάδο,
-- 0 ακίνητα με «/» στο όνομα. Δεν έχει διαρρεύσει τίποτα· το άνοιγμα είναι
-- ακόμα μόνο θεωρητικό.
--
-- Η ΔΙΟΡΘΩΣΗ. Ίδιες πολιτικές, ίδιοι ρόλοι, ίδια λογική, με τη στήλη δεμένη
-- ρητά στο `objects.name`. Τίποτα άλλο δεν αλλάζει.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "inv_docs_insert" on storage.objects;
create policy "inv_docs_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inventory-docs' and exists (
      select 1 from public.user_properties p
      where p.id::text = (storage.foldername(objects.name))[2] and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "inv_docs_select" on storage.objects;
create policy "inv_docs_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'inventory-docs' and exists (
      select 1 from public.user_properties p
      where p.id::text = (storage.foldername(objects.name))[2] and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "inv_docs_delete" on storage.objects;
create policy "inv_docs_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'inventory-docs' and exists (
      select 1 from public.user_properties p
      where p.id::text = (storage.foldername(objects.name))[2] and p.user_id = (select auth.uid())
    )
  );
