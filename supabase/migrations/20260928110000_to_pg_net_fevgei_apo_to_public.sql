-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ pg_net ΦΕΥΓΕΙ ΑΠΟ ΤΟ ΣΧΗΜΑ public
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: έλεγχος 27.09.2026, ελεγκτές ασφαλείας και απόδοσης της Supabase
-- (lint 0014, extension_in_public).
--
-- ΤΙ ΕΙΧΕ ΚΡΙΘΕΙ ΠΡΙΝ. Το docs/security-known-accepted.md έγραφε ότι η
-- μετακίνηση είναι αδύνατη (`alter extension pg_net set schema` δίνει
-- «does not support SET SCHEMA») και ότι ο μόνος άλλος δρόμος, `drop` και
-- `create` ξανά, θα έσβηνε την ουρά και θα έσπαγε τα cron. Το δεύτερο δεν
-- είχε δοκιμαστεί ποτέ. Δοκιμάστηκε στο staging στις 27.09.2026.
--
-- ΤΙ ΒΡΕΘΗΚΕ ΣΤΟ STAGING (pg_net 0.20.4, ιδιοκτήτης `supabase_admin`):
--   · Ο `postgres` μπορεί να κάνει `drop extension pg_net` και
--     `create extension pg_net with schema extensions`: η πλατφόρμα
--     (supautils) το επιτρέπει για αυτή την επέκταση. Και τα δύο πέρασαν.
--   · ΚΑΜΙΑ εξάρτηση εκτός επέκτασης: καμία όψη, κανένας trigger, κανένα
--     `supabase_functions.http_request` (το σχήμα δεν υπάρχει). Τα σώματα
--     plpgsql δεν καταγράφουν εξάρτηση και επιλύουν το `net.http_post` τη
--     στιγμή της κλήσης. Τα αντικείμενα ζουν ΟΛΑ στο σχήμα `net` πριν και
--     μετά· αλλάζει μόνο η εγγραφή `pg_extension.extnamespace`.
--   · Τα δικαιώματα βγαίνουν ΙΔΙΑ. Το σχήμα `net` πριν και μετά:
--     {supabase_admin=UC, =U, supabase_functions_admin=U, postgres=U, anon=U,
--      authenticated=U, service_role=U}. Τα ξαναδίνει ο event trigger
--     `issue_pg_net_access` της πλατφόρμας· οι συναρτήσεις γυρίζουν στο
--     εξ ορισμού ACL τους, όπως ήταν.
--   · ΤΑ CRON ΔΟΥΛΕΥΟΥΝ. Μετά την εφαρμογή στο staging: `net.http_get` προς
--     https://properwise.gr/robots.txt έδωσε 200 σε λιγότερο από δευτερόλεπτο
--     και το επόμενο `email-outbox-schedule` (net.http_post προς edge function)
--     πέτυχε με απάντηση 200. Ο εργάτης του pg_net δεν χρειάστηκε επανεκκίνηση.
--     Ως τις 21:40 UTC παραδόθηκαν επτά αιτήματα, μαζί με τα
--     `purge-orphan-files` και `health-every-15` των 21:30.
--   · ΤΙ ΧΑΝΕΤΑΙ. Ο πίνακας `net._http_response` (ιστορικό απαντήσεων, που
--     δεν διαβάζει κανένας κώδικας, μόνο σχόλια) και ό,τι κάθεται εκείνη τη
--     στιγμή στο `net.http_request_queue`. Η ουρά αδειάζει σε κλάσματα
--     δευτερολέπτου· στο staging είχε μηδέν γραμμές. Το χειρότερο σενάριο είναι
--     ένα αίτημα cron που ξεκίνησε το ίδιο δευτερόλεπτο και ξαναστέλνεται στον
--     επόμενο κύκλο του.
--
-- ΠΩΣ ΦΥΛΑΓΕΤΑΙ.
--   · Τρέχει ΜΟΝΟ αν το pg_net υπάρχει ΚΑΙ είναι στο `public`. Είναι κενή πράξη
--     στο staging (το έχει ήδη στο `extensions`) και στο τοπικό αντίγραφο του
--     scripts/db-replay.sh (δεν έχει καν την επέκταση).
--     Δεύτερη εκτέλεση: κενή πράξη.
--   · Ολόκληρο το έργο είναι ΜΙΑ εντολή `do`, άρα ατομικό. Μετά το `create`
--     ρωτιέται η βάση: έχουν ο `postgres` (ρόλος του cron) και ο `service_role`
--     χρήση του σχήματος `net`, EXECUTE στην `net.http_post` και INSERT στην
--     ουρά; Αν κάτι λείπει, ξαναδίνεται ρητά· αν λείπει ακόμη, σηκώνεται
--     εξαίρεση και ΟΛΑ αναιρούνται, με το pg_net στο `public` όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  missing text;
begin
  if not exists (
    select 1 from pg_extension
     where extname = 'pg_net' and extnamespace = 'public'::regnamespace
  ) then
    return;
  end if;
  if to_regnamespace('extensions') is null then
    raise exception 'Λείπει το σχήμα extensions· το pg_net μένει στο public.';
  end if;

  execute 'drop extension pg_net';
  execute 'create extension pg_net with schema extensions';

  -- Ο event trigger της πλατφόρμας δίνει αυτά. Αν για κάποιο λόγο δεν έτρεξε,
  -- ξαναδίνονται εδώ, στους ρόλους που τα είχαν στο staging πριν.
  if not has_schema_privilege('postgres', 'net', 'usage')
     or not has_schema_privilege('service_role', 'net', 'usage')
     or (exists (select 1 from pg_roles where rolname = 'supabase_functions_admin')
         and not has_schema_privilege('supabase_functions_admin', 'net', 'usage')) then
    execute 'grant usage on schema net to postgres, service_role';
    if exists (select 1 from pg_roles where rolname = 'supabase_functions_admin') then
      execute 'grant usage on schema net to supabase_functions_admin';
    end if;
  end if;

  select concat_ws(', ',
    case when not has_schema_privilege('postgres', 'net', 'usage') then 'postgres: usage net' end,
    case when not has_schema_privilege('service_role', 'net', 'usage') then 'service_role: usage net' end,
    case when not has_function_privilege('postgres', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'execute') then 'postgres: net.http_post' end,
    case when not has_function_privilege('postgres', 'net.http_get(text,jsonb,jsonb,integer)', 'execute') then 'postgres: net.http_get' end,
    case when not has_table_privilege('postgres', 'net.http_request_queue', 'insert') then 'postgres: insert ουρά' end
  ) into missing;
  if missing <> '' then
    raise exception 'Το pg_net ξαναστήθηκε χωρίς δικαιώματα που χρειάζεται το cron: %. Αναίρεση.', missing;
  end if;
end
$$;
