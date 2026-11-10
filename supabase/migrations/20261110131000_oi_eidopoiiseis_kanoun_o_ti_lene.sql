-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΚΑΝΟΥΝ Ο,ΤΙ ΛΕΝΕ: 08:00 ΑΘΗΝΑΣ ΚΑΙ ΟΝΟΜΑ ΜΙΑ ΦΟΡΑ ΤΟΝ ΜΗΝΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Πηγή: ο έλεγχος υποσχέσεων της 10/11/2026 (PR «Οι ειδοποιήσεις κάνουν ό,τι
-- λένε»). Δύο υποσχέσεις της οθόνης που η βάση δεν τηρούσε.
--
-- 1. «ΥΠΕΝΘΥΜΙΣΗ ΣΤΙΣ 08:00» (NotificationSettings.tsx). Το cron
--    `send-reminders-daily` ήταν '0 6 * * *' σε UTC: 08:00 Αθήνας τον χειμώνα,
--    09:00 το καλοκαίρι (cron.job στην παραγωγή, 10/11/2026). Τρέχει πλέον στις
--    05:00 και στις 06:00 UTC με `{"athens_hour":8}`· η συνάρτηση αγνοεί την
--    κλήση που δεν πέφτει στις 08 Αθήνας. ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ: πρώτα η συνάρτηση,
--    μετά αυτό. Αν τρέξει ανάποδα, η παλιά συνάρτηση τρέχει δύο φορές τη μέρα·
--    διπλό email δεν φεύγει, γιατί κάθε αποστολή περνά από το notification_log.
--
-- 2. «ΤΟ ΟΝΟΜΑ ΑΛΛΑΖΕΙ ΜΙΑ ΦΟΡΑ ΤΟΝ ΜΗΝΑ ΓΙΑ ΛΟΓΟΥΣ ΑΣΦΑΛΕΙΑΣ» (σελίδα trust,
--    TabSettings). Ο κανόνας ζούσε μόνο στον πελάτη: το TabSettings έγραφε μόνο
--    του το `full_name_changed_at` και η φόρμα τιμολόγησης άλλαζε το όνομα
--    χωρίς καν να το αγγίζει. Τώρα το επιβάλλει η βάση:
--      · αλλαγή ονόματος μέσα σε 30 ημέρες από την προηγούμενη → σφάλμα
--        `full_name_locked`, που το καταλαβαίνουν και οι δύο οθόνες·
--      · τη χρονοσφραγίδα τη γράφει η βάση και όχι ο πελάτης, μόνο σε
--        ΑΛΛΑΓΗ ονόματος: η πρώτη συμπλήρωση δεν κλειδώνει τίποτα·
--      · μόνο για τους ρόλους του πελάτη (authenticated, anon), όπως η
--        `lock_billing_plan`· ο διακομιστής και η υποστήριξη διορθώνουν όποτε
--        χρειαστεί, όπως υπόσχεται η σελίδα trust.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- Η διεύθυνση από το vault, χωρίς μαντεψιά (20260902140000): όταν λείπει,
  -- η παλιά εργασία μένει όπως είναι και το λέει.
  v_base text := private.functions_base_url();
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: οι υπενθυμίσεις δεν ξαναπρογραμματίστηκαν';
    return;
  end if;
  if v_base is null or v_base = '' then
    raise warning 'functions_base_url λείπει από το vault: το send-reminders-daily ΔΕΝ άλλαξε';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'send-reminders-daily') then perform cron.unschedule('send-reminders-daily'); end if;
  perform cron.schedule('send-reminders-daily', '0 5,6 * * *', format($cron$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object('Content-Type','application/json',
                   'x-cron-secret', (select secret from public.cron_secrets where name = 'email_cron')),
      body    := '{"athens_hour":8}'::jsonb, timeout_milliseconds := 120000);
  $cron$, v_base || '/functions/v1/send-reminders'));
end $$;

create or replace function public.lock_full_name_change() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.full_name_changed_at := null;
    return new;
  end if;
  if new.full_name is distinct from old.full_name then
    -- Ο ΕΛΕΓΧΟΣ ΙΣΧΥΕΙ ΚΑΙ ΟΤΑΝ ΤΟ ΠΑΛΙΟ ΕΙΝΑΙ ΚΕΝΟ. Αλλιώς Α → κενό → Β σε δύο
    -- βήματα παρέκαμπτε τον μήνα. Η πρώτη συμπλήρωση περνά, γιατί δεν έχει σφραγίδα.
    if old.full_name_changed_at is not null and old.full_name_changed_at > now() - interval '30 days' then
      raise exception 'full_name_locked' using errcode = 'P0001',
        hint = 'Το όνομα αλλάζει μία φορά τον μήνα.';
    end if;
    if coalesce(btrim(old.full_name), '') <> '' then
      new.full_name_changed_at := now();
    else
      new.full_name_changed_at := old.full_name_changed_at;
    end if;
  else
    new.full_name_changed_at := old.full_name_changed_at;
  end if;
  return new;
end $$;

revoke all on function public.lock_full_name_change() from public, anon, authenticated;

drop trigger if exists billing_profiles_full_name_lock on public.billing_profiles;
create trigger billing_profiles_full_name_lock
  before insert or update on public.billing_profiles
  for each row execute function public.lock_full_name_change();
