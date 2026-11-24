-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΚΙΝΗΣΕΙΣ ΤΡΑΠΕΖΑΣ ΑΝΟΙΓΟΥΝ ΑΠΟ ΤΟ «ΙΔΙΟΚΤΗΤΗΣ+»
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ. Απόφαση ιδιοκτήτη 24/11/2026: «Η εισαγωγή κινήσεων από αρχείο
-- e-banking (CSV) με αυτόματη αντιστοίχιση ενοικίων να ανοίξει και στο
-- Ιδιοκτήτης+». Η οθόνη το διαβάζει από το `FEATURE_MIN_PLAN.bank_import`
-- (lib/billing/entitlements.ts), που γίνεται 'owner' στην ίδια αλλαγή.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Μόνο οι δύο πολιτικές γραψίματος του `bank_transactions` από την
-- 20260814070000, που ζητούσαν `my_plan_rank() >= 3` («Επαγγελματίας»). Ο
-- βαθμός του «Ιδιοκτήτης+» είναι 2: `plan_rank('owner')` στην 20260820230000,
-- ίδια σειρά με το PLAN_ORDER. Γράφεται με το όνομα του πακέτου και όχι με τον
-- αριθμό, όπως στην 20261003140000, ώστε να διαβάζεται τι εννοεί.
--
-- Η ΑΛΛΑΓΗ ΜΟΝΟ ΑΝΟΙΓΕΙ. Ο,τι έγραφε ως τώρα ο βαθμός 3 και 4 το γράφει και
-- σήμερα· προστίθεται ο βαθμός 2. Η ανάγνωση και η διαγραφή ήταν ήδη ανοιχτές
-- (ό,τι εισήχθη μένει του χρήστη) και δεν αγγίζονται. Η δοκιμή δίνει βαθμό 2,
-- όπως και στην οθόνη, οπότε ο δοκιμαστής βλέπει το κουμπί ΚΑΙ γράφει.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Το ημερολόγιο άρθρων, οι επώνυμες αναφορές (report_branding,
-- βαθμός 3), το πελατολόγιο και η ομάδα. Οι restrictive πολιτικές του εύρους
-- (`scope_*`) και του δεύτερου βήματος (`mfa_bank_transactions`) μένουν όπως
-- είναι: η πολιτική του πακέτου είναι ένας ανεξάρτητος όρος ανάμεσά τους.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `drop policy if exists` πριν από κάθε `create policy`.
-- Το scripts/db/rls-probe.sql το αποδεικνύει με τέσσερις λογαριασμούς και το
-- lib/billing/planGateSql.test.ts ελέγχει ότι οθόνη και βάση λένε το ίδιο.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "plan_ins_bank_transactions" on public.bank_transactions;
drop policy if exists "plan_upd_bank_transactions" on public.bank_transactions;

create policy plan_ins_bank_transactions on public.bank_transactions as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('owner'));
create policy plan_upd_bank_transactions on public.bank_transactions as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('owner'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('owner'));
