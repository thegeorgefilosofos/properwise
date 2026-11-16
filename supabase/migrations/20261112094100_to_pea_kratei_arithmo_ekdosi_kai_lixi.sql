-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΠΕΑ ΚΡΑΤΑ ΑΡΙΘΜΟ, ΕΚΔΟΣΗ ΚΑΙ ΛΗΞΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΤΟ supabase/migrations. Η πηγή είναι ο ν. 4122/2013
-- (ΦΕΚ Α΄ 42/19.02.2013), όπως ισχύει:
--
--   Άρθρο 12 παρ. 1 περ. δ΄ (όπως αντικαταστάθηκε με το άρθρο 65 του
--   ν. 4685/2020, ΦΕΚ Α΄ 92/07.05.2020): «Η έκδοση ΠΕΑ είναι υποχρεωτική: ...
--   δ) κατά τη μίσθωση (μακροχρόνια, βραχυχρόνια, υπεκμίσθωση) σε νέο
--   ενοικιαστή κτιρίου ή κτιριακής μονάδας ...»
--
--   Άρθρο 12 παρ. 8: στην έντυπη ή ηλεκτρονική δήλωση της μίσθωσης σε νέο
--   ενοικιαστή προς την αρμόδια Δημόσια Αρχή, ο αριθμός πρωτοκόλλου του ΠΕΑ
--   μπαίνει υποχρεωτικά (το ακριβές κείμενο στην περιγραφή του PR).
--
--   Άρθρο 11 παρ. 6 περ. β΄: «Εφόσον υπάρχει ΠΕΑ σε ισχύ, δεν απαιτείται
--   έκδοση νέου ΠΕΑ για τις περιπτώσεις της πώλησης ή μίσθωσης κτιρίου ή
--   κτιριακής μονάδας εντός του διαστήματος ισχύος του ΠΕΑ.»
--
-- Η εφαρμογή κρατούσε μόνο την ενεργειακή κατηγορία (`pea_class`). Ο αριθμός
-- έμενε σε σημείωση του εγγράφου και η λήξη μόνο ως γεγονός ημερολογίου, οπότε
-- ούτε η δήλωση μίσθωσης τον έβρισκε ούτε η ροή του ενοικιαστή ήξερε αν το
-- πιστοποιητικό ισχύει στην έναρξη.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ. ΜΟΝΟ ΠΡΟΣΘΕΤΙΚΑ ΚΑΙ ΜΕ ΦΥΛΑΞΗ ΓΙΑ ΔΕΥΤΕΡΟ ΤΡΕΞΙΜΟ:
--   1. `user_properties.pea_number`: ο αριθμός πρωτοκόλλου όπως τυπώνεται.
--   2. `user_properties.pea_issued`: η ημερομηνία έκδοσης.
--   3. `user_properties.pea_expiry`: η ημερομηνία λήξης όπως τυπώνεται. Η
--      εφαρμογή ΔΕΝ τη συμπεραίνει από την έκδοση: οι υπενθυμίσεις βγαίνουν
--      μόνο από ό,τι έγραψε ο χρήστης ή διάβασε η σάρωση.
--
-- ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ. Καμία νέα πολιτική και κανένας νέος πίνακας: οι στήλες
-- ανήκουν στο `user_properties`, που έχει RLS ανά γραμμή χωρίς δικαιώματα ανά
-- στήλη: οι sel_/ins_/upd_/del_user_properties (20261030110000) και η
-- περιοριστική mfa_user_properties (20261003120000). Τις διαβάζει και τις γράφει
-- ακριβώς όποιος διαβάζει και γράφει τη γραμμή τους.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_properties add column if not exists pea_number text;
alter table public.user_properties add column if not exists pea_issued date;
alter table public.user_properties add column if not exists pea_expiry date;

-- Ο αριθμός είναι κείμενο (έχει κάθετο και έτος), όχι ελεύθερη παράγραφος.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_properties_pea_number_chk') then
    alter table public.user_properties add constraint user_properties_pea_number_chk
      check (pea_number is null or char_length(btrim(pea_number)) between 1 and 40);
  end if;
end $$;

-- Η λήξη δεν προηγείται της έκδοσης. Οταν λείπει η μία, δεν κρίνεται τίποτα.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_properties_pea_dates_chk') then
    alter table public.user_properties add constraint user_properties_pea_dates_chk
      check (pea_issued is null or pea_expiry is null or pea_issued <= pea_expiry);
  end if;
end $$;

comment on column public.user_properties.pea_number is
  'Αριθμός πρωτοκόλλου του ΠΕΑ, όπως τυπώνεται. Μπαίνει στη δήλωση μίσθωσης (ν. 4122/2013, άρθρο 12 παρ. 8).';
comment on column public.user_properties.pea_issued is
  'Ημερομηνία έκδοσης του ΠΕΑ.';
comment on column public.user_properties.pea_expiry is
  'Ημερομηνία λήξης του ΠΕΑ, όπως τυπώνεται ή όπως τη γράφει ο χρήστης. Από αυτή βγαίνουν οι υπενθυμίσεις λήξης και η ειδοποίηση της μίσθωσης.';
