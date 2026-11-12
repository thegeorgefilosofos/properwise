-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ ΜΕ ΟΡΙΟ ΡΥΘΜΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- Η `count_signup_step` εκτελείται από τον anon (χωρίς σύνδεση) και γράφει στο
-- `signup_funnel`. Είχε ταβάνι 1.000 ανά γραμμή και ημέρα (20260930140000), όχι
-- όριο ρυθμού: ένα σενάριο μπορούσε να γεμίσει όλες τις γραμμές της ημέρας σε
-- λίγα δευτερόλεπτα και να αλλοιώσει τις μετρήσεις (έλεγχος ετοιμότητας για
-- κλίμακα, 10/11/2026).
--
-- ΣΥΝΟΛΙΚΟ ΟΡΙΟ ΑΝΑ ΛΕΠΤΟ, ΧΩΡΙΣ ΤΑΥΤΟΤΗΤΑ. Ο anon δεν έχει χρήστη· η μόνη
-- ταυτότητα θα ήταν η διεύθυνση IP, δηλαδή προσωπικό δεδομένο που η Πολιτική
-- απορρήτου δεν αναφέρει για τις μετρήσεις. Γι' αυτό μετράμε μόνο πόσες κλήσεις
-- έγιναν μέσα στο λεπτό, για όλους μαζί. Πάνω από 600 κλήσεις το λεπτό η
-- κλήση απλώς δεν μετρά: η εγγραφή του επισκέπτη δεν επηρεάζεται ποτέ, γιατί η
-- συνάρτηση γράφει μόνο στατιστικά.
--
-- Το 600 το λεπτό είναι πολύ πάνω από κάθε πραγματική κίνηση της φόρμας και
-- κόβει μόνο αυτοματοποιημένη πλημμύρα. Οι γραμμές του μετρητή σβήνονται μετά
-- από μία ώρα μέσα στην ίδια κλήση, άρα ο πίνακας μένει μικρός.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists private.signup_funnel_minute (
  minute timestamptz primary key,
  n integer not null default 0
);
alter table private.signup_funnel_minute enable row level security;
revoke all on private.signup_funnel_minute from public, anon, authenticated;

create or replace function public.count_signup_step(
  p_step text, p_source text, p_in_app boolean, p_mobile boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_n integer;
begin
  if p_step not in ('view', 'google', 'app_note', 'chrome', 'invalid', 'submit', 'sent', 'error')
     or p_source not in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'google', 'search',
                         'internal', 'direct', 'other')
     or p_in_app is null or p_mobile is null then
    return;
  end if;

  -- Όριο ρυθμού: πάνω από 600 κλήσεις το λεπτό, για όλους μαζί, δεν μετρούν.
  insert into private.signup_funnel_minute as m (minute, n) values (v_minute, 1)
  on conflict (minute) do update set n = m.n + 1
  returning n into v_n;
  if v_n > 600 then
    return;
  end if;
  delete from private.signup_funnel_minute where minute < v_minute - interval '1 hour';

  insert into public.signup_funnel as f (day, step, source, in_app, mobile, n)
  values ((now() at time zone 'Europe/Athens')::date, p_step, p_source, p_in_app, p_mobile, 1)
  on conflict (day, step, source, in_app, mobile)
  -- Ταβάνι ανά γραμμή και ημέρα, όπως στην 20260930140000.
  do update set n = f.n + 1 where f.n < 1000;
end;
$function$;

-- Ίδια δικαιώματα με την 20261007170000.
revoke execute on function public.count_signup_step(text, text, boolean, boolean) from public;
grant execute on function public.count_signup_step(text, text, boolean, boolean) to anon, authenticated, service_role;
