-- ═══════════════════════════════════════════════════════════════════════════
-- «ΠΛΗΡΩΣΑ» ΜΕ ΕΝΑ ΠΑΤΗΜΑ: ΤΑ ΔΙΑΚΡΙΤΙΚΑ ΤΩΝ ΥΠΕΝΘΥΜΙΣΕΩΝ
-- ─────────────────────────────────────────────────────────────────────────
-- Κάθε υπενθύμιση (email ή ειδοποίηση) μπορεί να φέρει σύνδεσμο που σημειώνει
-- ΜΙΑ προθεσμία ως πληρωμένη χωρίς σύνδεση (lib/reminders/payLink.ts).
--
--   · ΜΟΝΟ ΤΟ ΑΠΟΤΥΠΩΜΑ. Το `token_hash` είναι SHA-256 του διακριτικού· το ίδιο
--     το διακριτικό δεν αποθηκεύεται πουθενά.
--   · ΔΕΜΕΝΟ ΣΕ ΧΡΗΣΤΗ ΚΑΙ ΓΕΓΟΝΟΣ, με διαγραφή μαζί τους.
--   · ΜΙΑΣ ΧΡΗΣΗΣ, ΜΕ ΛΗΞΗ: `used_at` και `expires_at`· η εξαργύρωση είναι
--     ατομικό UPDATE … WHERE used_at IS NULL AND expires_at > now().
--   · ΑΝΑΙΡΕΣΗ: `undone_at`. Η δαπάνη που έγραψε το «Πλήρωσα» βρίσκεται με το
--     αποτύπωμά της (`expenses.dedup_hash`) και σβήνεται αυτή μόνο.
--
-- ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΔΙΑΒΑΖΕΙ ΑΠΟ ΤΟΝ ΠΕΡΙΗΓΗΤΗ. RLS ενεργό ΧΩΡΙΣ καμία πολιτική:
-- ούτε `anon` ούτε `authenticated` βλέπουν ή γράφουν γραμμή. Μόνο ο service
-- role (η διαδρομή /api/plirosa και η send-reminders) τον αγγίζει.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.reminder_pay_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_id    uuid not null references public.calendar_events(id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  channel     text not null check (channel in ('email', 'push')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  undone_at   timestamptz,
  created_at  timestamptz not null default now(),
  check (undone_at is null or used_at is not null)
);

create index if not exists reminder_pay_tokens_event_idx on public.reminder_pay_tokens (event_id);
create index if not exists reminder_pay_tokens_user_idx  on public.reminder_pay_tokens (user_id);
-- Ο καθαρισμός των ληγμένων διαβάζει με τη λήξη.
create index if not exists reminder_pay_tokens_expiry_idx on public.reminder_pay_tokens (expires_at);

alter table public.reminder_pay_tokens enable row level security;
revoke all on table public.reminder_pay_tokens from anon, authenticated;
grant all on table public.reminder_pay_tokens to service_role;

comment on table public.reminder_pay_tokens is
  'Διακριτικά «Πλήρωσα» των υπενθυμίσεων: μόνο SHA-256, μίας χρήσης, με λήξη. Μόνο service role (lib/reminders/payLink.ts).';
