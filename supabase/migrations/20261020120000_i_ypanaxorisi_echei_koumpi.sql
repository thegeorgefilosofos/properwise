-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΥΠΑΝΑΧΩΡΗΣΗ ΑΠΟΚΤΑ ΛΕΙΤΟΥΡΓΙΑ ΣΤΗ ΔΙΕΠΑΦΗ ΚΑΙ ΑΡΧΕΙΟ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΚΕΝΟ (νομική αξιολόγηση 20/10/2026, εύρημα 4). Η υπαναχώρηση γινόταν
-- μόνο με email. Από 19/06/2026 το άρθ. 11α της Οδηγίας 2011/83/ΕΕ (όπως
-- προστέθηκε από την Οδηγία (ΕΕ) 2023/2673, https://eur-lex.europa.eu/eli/dir/2023/2673/oj)
-- ζητά λειτουργία «υπαναχώρηση από τη σύμβαση εδώ» με βήμα επιβεβαίωσης και
-- αποδεικτικό σε σταθερό μέσο με ημερομηνία και ώρα. Στην Ελλάδα: άρθ. 3ζα
-- ν. 2251/1994, που προστέθηκε τον Ιούλιο 2026 (τροποποιητικός νόμος, φύλλο
-- της Εφημερίδας και σύνδεσμοι: docs/legal/ypanaxorisi.md). Το κείμενο του 3ζα δεν
-- διαβάστηκε κατά λέξη (δεν επαληθεύτηκε)· λεπτομέρειες: lib/legal/withdrawal.ts.
--
-- ΓΙΑΤΙ ΠΙΝΑΚΑΣ. Το αποδεικτικό φεύγει με email, αλλά το βάρος απόδειξης ότι
-- η δήλωση έγινε εμπρόθεσμα το σηκώνει ο καταναλωτής (άρθ. 11§4 Οδηγίας
-- 2011/83/ΕΕ) και ο έλεγχος της ΓΓΕΚΠ ρωτά εμάς. Κάθε δήλωση γράφεται εδώ τη
-- στιγμή της υποβολής, με την ώρα της βάσης, πριν σταλεί οτιδήποτε.
--
-- ΠΟΙΟΣ ΓΡΑΦΕΙ ΚΑΙ ΠΟΙΟΣ ΔΙΑΒΑΖΕΙ.
--   · Γράφει ΜΟΝΟ η διαδρομή app/api/withdrawal/route.ts με τον ρόλο
--     υπηρεσίας: η λειτουργία πρέπει να δουλεύει και ΧΩΡΙΣ σύνδεση (άρθ. 11α:
--     διαθέσιμη σε όλη την προθεσμία), άρα δεν υπάρχει `auth.uid()` να κρίνει.
--   · Ο συνδεδεμένος χρήστης ΔΙΑΒΑΖΕΙ τις δικές του δηλώσεις (άρθ. 15 GDPR).
--   · Κανείς πελάτης δεν γράφει, δεν αλλάζει και δεν σβήνει: αποδεικτικό που
--     αλλάζει από τον ίδιο που το επικαλείται δεν αποδεικνύει τίποτα.
--
-- ΜΕ ΤΗ ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ Η ΔΗΛΩΣΗ ΜΕΝΕΙ, ΧΩΡΙΣ ΔΕΣΜΟ. Γι' αυτό η στήλη
-- λέγεται `account_id` και ΟΧΙ `user_id`: η `erase_account` (20260824110000)
-- σβήνει κάθε γραμμή κάθε πίνακα με στήλη `user_id`, οπότε μια δήλωση με
-- επιστροφή που εκκρεμεί θα χανόταν μαζί με τον λογαριασμό. Με `account_id`
-- το ξένο κλειδί τη γράφει `null` και η γραμμή κρατιέται ως απόδειξη άσκησης δικαιώματος και για την
-- επιστροφή που εκκρεμεί: GDPR άρθ. 17§3 στοιχ. ε΄ (θεμελίωση, άσκηση ή
-- υποστήριξη νομικών αξιώσεων) και 6§1 στοιχ. γ΄. Το ΠΟΣΟ μένει δεν το
-- αποφασίζει η μετανάστευση: εκκρεμεί στο docs/compliance/dpia.md (ενέργειες).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.withdrawal_requests (
  id              uuid primary key default gen_random_uuid(),
  -- Ξένο κλειδί προς auth.users: έτσι μπαίνει και στην εξαγωγή δεδομένων
  -- (`export_my_data`, κανόνας της σχέσης από το 20260815140000).
  account_id      uuid references auth.users(id) on delete set null,
  submitted_at    timestamptz not null default now(),
  consumer_name   text not null check (char_length(consumer_name) between 2 and 120),
  consumer_email  text not null check (char_length(consumer_email) between 3 and 254),
  contract        text not null check (char_length(contract) between 2 and 500),
  purchase_date   date,
  within_period   boolean,
  subscription_id text,
  cancel_outcome  text not null default 'none'
                  check (cancel_outcome in ('cancelled', 'failed', 'none', 'not_signed_in')),
  ack_sent_at     timestamptz,
  forwarded_at    timestamptz,
  -- Η πορεία της επιστροφής, την ενημερώνει άνθρωπος από την υποστήριξη.
  status          text not null default 'received'
                  check (status in ('received', 'refunded', 'no_payment', 'rejected'))
);

comment on table public.withdrawal_requests is
  'Δηλώσεις υπαναχώρησης από τη λειτουργία της διεπαφής (άρθ. 11α Οδηγίας 2011/83/ΕΕ, άρθ. 3ζα ν. 2251/1994). Γράφει μόνο ο ρόλος υπηρεσίας· ο χρήστης διαβάζει τις δικές του.';

create index if not exists withdrawal_requests_account_idx on public.withdrawal_requests (account_id);
-- Το φρένο κατάχρησης της δημόσιας φόρμας μετρά ανά email και ώρα.
create index if not exists withdrawal_requests_email_idx on public.withdrawal_requests (consumer_email, submitted_at desc);

alter table public.withdrawal_requests enable row level security;

revoke all on table public.withdrawal_requests from public, anon, authenticated;
grant select on table public.withdrawal_requests to authenticated;
grant select, insert, update on table public.withdrawal_requests to service_role;

drop policy if exists withdrawal_requests_own_read on public.withdrawal_requests;
create policy withdrawal_requests_own_read on public.withdrawal_requests for select to authenticated
  using (account_id = (select auth.uid()));
