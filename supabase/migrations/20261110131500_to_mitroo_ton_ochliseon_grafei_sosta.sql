-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΟΧΛΗΣΕΩΝ ΓΡΑΦΕΙ ΣΩΣΤΑ ΚΑΙ Η ΔΙΑΓΡΑΦΗ ΓΕΓΟΝΟΤΟΣ ΔΕΝ ΣΚΑΛΩΝΕΙ
-- ─────────────────────────────────────────────────────────────────────────
-- Πηγή: ο ανεξάρτητος έλεγχος του PR «Οι ειδοποιήσεις κάνουν ό,τι λένε»
-- (10/11/2026) και οι περιορισμοί του notification_log στην παραγωγή
-- (pg_constraint, ίδια μέρα):
--   notification_log_event_id_fkey  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE SET NULL
--   notification_log_event_id_reminder_type_key  UNIQUE (event_id, reminder_type)
--   notification_log_monthly_key  (user_id, reminder_type, μήνας) WHERE event_id IS NULL   (20260814020000)
--
-- 1. Η ΟΧΛΗΣΗ ΕΝΟΙΚΙΟΥ ΕΓΡΑΦΕ ΣΕ ΛΑΘΟΣ ΣΤΗΛΗ. Η send-reminders έβαζε
--    `event_id = rent_payments.id`. Το κλειδί δείχνει στο calendar_events, οπότε
--    η εισαγωγή αποτύγχανε (σφάλμα που κανείς δεν διάβαζε), το ιστορικό έμενε
--    άδειο και η όχληση ξανάφευγε σε κάθε εκτέλεση, πάντα ως «πρώτη». Στην
--    παραγωγή υπάρχουν 0 γραμμές `rent_overdue`: καμία δεν γράφτηκε ποτέ.
--    Τώρα: στήλη `rent_payment_id` με κλειδί προς το rent_payments και είδος
--    `rent_overdue:<αριθμός ειδοποίησης>`. Το μοναδικό (rent_payment_id, είδος)
--    κάνει αδύνατη τη δεύτερη ίδια ειδοποίηση για την ίδια δόση.
--
-- 2. Η ΔΙΑΓΡΑΦΗ ΓΕΓΟΝΟΤΟΣ ΜΠΟΡΟΥΣΕ ΝΑ ΑΠΟΤΥΧΕΙ. Με `ON DELETE SET NULL`, το
--    log ενός σβησμένου γεγονότος γινόταν `event_id = null` και έπεφτε μέσα στο
--    μερικό μοναδικό των μηνιαίων μηνυμάτων: δύο σβησμένα γεγονότα του ίδιου
--    χρήστη με log ίδιου είδους τον ίδιο μήνα: η δεύτερη διαγραφή έσπαγε.
--    Το log ενός γεγονότος που δεν υπάρχει δεν χρειάζεται: CASCADE. Και το
--    μηνιαίο μοναδικό περιορίζεται σε ό,τι δεν κρέμεται ούτε από γεγονός ούτε
--    από δόση, δηλαδή στα μηνιαία μηνύματα (send-monthly-statements).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.notification_log
  add column if not exists rent_payment_id uuid references public.rent_payments(id) on delete cascade;

create unique index if not exists notification_log_rent_payment_key
  on public.notification_log (rent_payment_id, reminder_type)
  where rent_payment_id is not null;

alter table public.notification_log drop constraint if exists notification_log_event_id_fkey;
alter table public.notification_log
  add constraint notification_log_event_id_fkey
  foreign key (event_id) references public.calendar_events(id) on delete cascade;

drop index if exists public.notification_log_monthly_key;
create unique index notification_log_monthly_key
  on public.notification_log (user_id, reminder_type, (date_trunc('month', created_at at time zone 'UTC')))
  where event_id is null and rent_payment_id is null;
