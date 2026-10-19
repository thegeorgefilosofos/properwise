-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΚΛΕΙΔΩΜΑ ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ ΔΕΝ ΑΠΕΛΕΥΘΕΡΩΝΟΤΑΝ ΠΟΤΕ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Η edge function `schedule-email-outbox` κρατά «ένα τρέξιμο τη
-- φορά» με δύο RPC: `try_email_schedule_lock()` στην αρχή και
-- `release_email_schedule_lock()` στο τέλος. Από κάτω ήταν
-- `pg_try_advisory_lock` και `pg_advisory_unlock`, δηλαδή κλειδώματα ΣΥΝΕΔΡΙΑΣ.
-- Το PostgREST όμως στέλνει κάθε RPC σε όποια σύνδεση του pool είναι ελεύθερη.
-- Το unlock έπεφτε σε ΑΛΛΗ σύνδεση, εκεί δεν υπήρχε κλείδωμα να λυθεί και η
-- Postgres απαντούσε μόνο με WARNING. Το κλείδωμα έμενε στη σύνδεση που το
-- πήρε όσο ζούσε αυτή. Κάθε τικ που έπεφτε σε άλλη σύνδεση γύριζε
-- `skipped: 'locked'` χωρίς να προγραμματίσει τίποτα.
--
-- ΤΙ ΜΕΤΡΗΘΗΚΕ (παραγωγή, μόνο SELECT, 18/10/2026)
--   · postgres_logs, τελευταίες 24 ώρες: 234 WARNING «you don't own a lock of
--     type ExclusiveLock» από postgrest. Το cron τρέχει */5, δηλαδή 288 τικ.
--   · pg_locks στις 16:29 και 16:32 UTC: το advisory lock του
--     'email-outbox-schedule' granted σε idle σύνδεση postgrest με
--     backend_start 16:25:01 και 16:30:00, δηλαδή ΜΕΤΑ το τέλος της εκτέλεσης.
--   · Ξανά στις 17:39 UTC: granted σε idle σύνδεση postgrest με backend_start
--     17:35:01 και τελευταία εντολή COMMIT.
--   · Η ουρά ήταν άδεια (0 pending), οπότε καθυστέρηση δεν φαινόταν ακόμη.
--
-- Η ΔΙΟΡΘΩΣΗ: ΜΙΣΘΩΣΗ ΣΕ ΓΡΑΜΜΗ, ΟΧΙ ΚΛΕΙΔΩΜΑ ΣΥΝΔΕΣΗΣ. Η κατάσταση ζει σε
-- γραμμή πίνακα, που τη βλέπει κάθε σύνδεση του pool. Το «πήρα» είναι μία
-- εισαγωγή με `on conflict`, που περνά μόνο αν η προηγούμενη μίσθωση έχει
-- λήξει. Το «άφησα» σβήνει τη γραμμή, από όποια σύνδεση κι αν έρθει.
--
-- ΓΙΑΤΙ 7 ΛΕΠΤΑ. Μια edge function στο Supabase ζει το πολύ 400 δευτερόλεπτα
-- σε πληρωμένο πλάνο, 150 στο δωρεάν (https://supabase.com/docs/guides/functions/limits,
-- «Maximum Duration (Wall clock limit)»). Τα 7 λεπτά είναι 420 δευτερόλεπτα,
-- περισσότερα από τη μέγιστη ζωή: ένα τρέξιμο που ζει ακόμη έχει ΠΑΝΤΑ ζωντανή
-- μίσθωση, οπότε το «άφησα» που φτάνει είναι πάντα του κατόχου. Αν το τρέξιμο
-- πεθάνει πριν από το `finally`, χάνεται το πολύ ένα τικ του */5.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Τα ονόματα και οι υπογραφές των δύο RPC (boolean και void),
-- οπότε η edge function δουλεύει όπως είναι, ακόμη κι αν ανέβει πριν από τη
-- βάση (το supabase-deploy.yml ανεβάζει πρώτα τις functions). Μένουν INVOKER
-- και εκτελέσιμες μόνο από τον service_role, όπως τις άφησε το
-- 20260808120000. Το παλιό advisory lock που κρατά σήμερα μια σύνδεση του
-- pool δεν χρειάζεται τίποτα: δεν το ρωτά πια κανείς και φεύγει όταν κλείσει
-- η σύνδεση.
--
-- ΔΟΚΙΜΗ: scripts/db/email-activation-probe.sql (στο scripts/db-replay.sh) και
-- scripts/test-email-activation.mjs, που παίρνει τη μίσθωση από μία σύνδεση,
-- την αφήνει από δεύτερη και την ξαναπαίρνει από τρίτη, όπως το pool.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.job_leases (
  name       text not null primary key,
  expires_at timestamptz not null,
  taken_at   timestamptz not null default now()
);

comment on table public.job_leases is
  'Μισθώσεις «ένα τρέξιμο τη φορά» για εργασίες που καλούνται μέσω PostgREST. Γραμμή αντί για advisory lock, γιατί το pool στέλνει κάθε RPC σε άλλη σύνδεση.';

-- Μόνο υπηρεσία: RLS χωρίς πολιτικές και κανένα δικαίωμα σε ρόλο πελάτη,
-- όπως οι πίνακες του 20260808120000.
alter table public.job_leases enable row level security;
revoke all on public.job_leases from public, anon, authenticated;
grant select, insert, update, delete on public.job_leases to service_role;

create or replace function public.try_email_schedule_lock()
returns boolean
language sql
set search_path to 'public'
as $$
  with taken as (
    insert into public.job_leases as l (name, expires_at, taken_at)
    values ('email-outbox-schedule', now() + interval '7 minutes', now())
    on conflict (name) do update
       set expires_at = excluded.expires_at,
           taken_at   = excluded.taken_at
     where l.expires_at <= now()
    returning 1
  )
  select exists (select 1 from taken);
$$;

create or replace function public.release_email_schedule_lock()
returns void
language sql
set search_path to 'public'
as $$
  delete from public.job_leases where name = 'email-outbox-schedule';
$$;

revoke all on function public.try_email_schedule_lock() from public, anon, authenticated;
revoke all on function public.release_email_schedule_lock() from public, anon, authenticated;
grant execute on function public.try_email_schedule_lock() to service_role;
grant execute on function public.release_email_schedule_lock() to service_role;

comment on function public.try_email_schedule_lock() is
  'Μίσθωση 7 λεπτών στο job_leases για τον προγραμματισμό της ουράς email. true μόνο αν δεν υπάρχει ζωντανή μίσθωση.';
comment on function public.release_email_schedule_lock() is
  'Αφήνει τη μίσθωση του προγραμματισμού. Δουλεύει από οποιαδήποτε σύνδεση του pool.';
