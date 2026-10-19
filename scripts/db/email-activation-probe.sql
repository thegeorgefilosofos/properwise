-- ═══════════════════════════════════════════════════════════════════════════
--  ΟΙ ΕΠΙΣΤΟΛΕΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ ΦΤΑΝΟΥΝ ΚΑΙ ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΟΥΡΑΣ ΛΥΝΕΤΑΙ
-- ─────────────────────────────────────────────────────────────────────────
--  Τρέχει σε ΚΛΩΝΟ της βάσης του scripts/db-replay.sh, ποτέ στην ίδια: ανοίγει
--  τον διακόπτη emails_live, στήνει ομοίωμα του pg_net και γράφει ουρά.
--
--  Τι ελέγχει, με τις ΠΡΑΓΜΑΤΙΚΕΣ lifecycle_enqueue και drain_email_outbox:
--
--   [Α] Χρήστης χωρίς ακίνητο. Το welcome φεύγει την ημέρα 0. Το
--       add_first_property φτάνει μία φορά και δεν κόβεται ποτέ από το όριο
--       των τριών ημερών. Πριν από το 20261018164100 έμπαινε την ημέρα 2 και
--       έμενε 'skipped' / 'frequency_cap' για πάντα.
--   [Β] Χρήστης με ακίνητο από την πρώτη μέρα. Κανένα add_first_property
--       (πριν: έμπαινε, γιατί το onboarding_progress.first_property δεν
--       γράφεται ποτέ) και ένα first_property_success που φτάνει.
--   [Γ] Ακίνητο την ημέρα 6, αφού έφυγε το add_first_property: το
--       first_property_success περιμένει το όριο και φτάνει.
--   [Μ] Η μίσθωση του προγραμματισμού: δεύτερο «πήρα» όσο κρατιέται είναι
--       false, το «άφησα» την ελευθερώνει, η ληγμένη ξαναπαίρνεται. Πριν από
--       το 20261018164200 το δεύτερο «πήρα» γύριζε true (το advisory lock
--       συνεδρίας ξαναμπαίνει), οπότε τίποτα δεν εμπόδιζε δεύτερο τρέξιμο.
--
--  ΧΡΟΝΟΣ ΧΩΡΙΣ ΡΟΛΟΙ. Το now() δεν αλλάζει μέσα σε συναλλαγή. Μία «ημέρα»
--  περνά μετακινώντας ΟΛΑ τα χρονικά πεδία των δοκιμαστικών χρηστών μία ημέρα
--  πίσω: εγγραφή, επιβεβαίωση, ακίνητα, ουρά. Ο προγραμματιστής της ουράς
--  (edge function) αντικαθίσταται από το ελάχιστο που κάνει: σφραγίζει
--  send_window στις γραμμές που περιμένουν.
--
--  ΟΙ ΕΛΕΓΧΟΙ ΕΙΝΑΙ ΑΜΕΤΑΒΛΗΤΕΣ, ΟΧΙ ΗΜΕΡΟΜΗΝΙΕΣ. Η lifecycle_enqueue στέλνει
--  και εποχικά (black_friday, tax_season, quarterly_review…) ανάλογα με τη μέρα
--  που τρέχει ο έλεγχος. Γι' αυτό δεν ελέγχεται «ποιο έφυγε πρώτο» αλλά ότι οι
--  δύο επιστολές ενεργοποίησης φτάνουν μία φορά και δεν κόβονται ποτέ.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Σκαλωσιά του κλώνου ────────────────────────────────────────────────────
-- pg_net δεν υπάρχει σε γυμνό Postgres. Η drain καλεί net.http_post· εδώ κάθε
-- κλήση γράφεται σε πίνακα, ώστε να μετρηθεί τι «έφυγε».
create schema if not exists net;
create table if not exists net.probe_posts (id bigserial primary key, url text, body jsonb);
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language sql as
$$ insert into net.probe_posts (url, body) values (url, body) returning id $$;

insert into public.cron_secrets (name, secret) values ('email_cron', 'probe'), ('emails_live', '1')
on conflict (name) do update set secret = excluded.secret;

-- Μία ημέρα περνά για τους δοκιμαστικούς χρήστες.
create or replace function pg_temp.probe_day_passes(p_users uuid[]) returns void language sql as $$
  update public.email_outbox o
     set created_at = o.created_at - interval '1 day',
         scheduled_for = o.scheduled_for - interval '1 day',
         sent_at = o.sent_at - interval '1 day'
   where o.to_email in (select lower(trim(u.email)) from auth.users u where u.id = any(p_users));
  update public.user_properties set created_at = created_at - interval '1 day' where user_id = any(p_users);
  update auth.users
     set created_at = created_at - interval '1 day',
         email_confirmed_at = email_confirmed_at - interval '1 day'
   where id = any(p_users);
$$;

-- Ο προγραμματιστής, στο ελάχιστο: ό,τι περιμένει παίρνει παράθυρο αποστολής.
create or replace function pg_temp.probe_plan(p_users uuid[]) returns void language sql as $$
  update public.email_outbox o set send_window = 'morning'
   where o.status = 'pending' and o.send_window is null and o.category <> 'transactional'
     and o.scheduled_for <= now()
     and o.to_email in (select lower(trim(u.email)) from auth.users u where u.id = any(p_users));
$$;

-- Ενα πλήρες πρωινό: μηχανή κύκλου ζωής, προγραμματισμός, άδειασμα ουράς.
create or replace function pg_temp.probe_morning(p_users uuid[]) returns void language plpgsql as $$
begin
  perform public.lifecycle_enqueue();
  perform pg_temp.probe_plan(p_users);
  perform public.drain_email_outbox(100);
end $$;

-- Πώς κατέληξε ένα κείμενο για έναν παραλήπτη: «sent», «skipped/frequency_cap»…
create or replace function pg_temp.probe_outcome(p_email text, p_copy text) returns text language sql as $$
  select string_agg(o.status || coalesce('/' || o.last_error, ''), ', ' order by o.id)
    from public.email_outbox o where o.to_email = p_email and o.copy_id = p_copy;
$$;

-- ── [Α] Χωρίς ακίνητο: το welcome και μετά το «πρόσθεσε ακίνητο» ──────────
do $probe$
declare
  u  uuid := 'e0a00000-0000-4000-8000-00000000000a';
  em text := 'energopoiisi-a@properwise.gr';
  d  int;
  st text;
  r  record;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values (u, em, now(), now());
  for d in 0..9 loop
    perform pg_temp.probe_morning(array[u]);
    perform pg_temp.probe_day_passes(array[u]);
  end loop;

  st := pg_temp.probe_outcome(em, 'add_first_property');
  if st is distinct from 'sent' then
    raise exception '[Α] Το add_first_property κατέληξε «%» αντί για ένα «sent»', coalesce(st, 'καμία γραμμή');
  end if;
  select category, dedup_key into r from public.email_outbox where to_email = em and copy_id = 'add_first_property';
  if r.category <> 'marketing' or r.dedup_key <> 'add_first_property:' || u then
    raise exception '[Α] Αλλαξε η κατηγορία ή το κλειδί: % / %', r.category, r.dedup_key;
  end if;
  raise notice 'probe: [Α] το «πρόσθεσε το πρώτο σου ακίνητο» φτάνει μία φορά, μετά το όριο του welcome';
end $probe$;

-- ── [Β] Με ακίνητο από την πρώτη μέρα ────────────────────────────────────
do $probe$
declare
  u  uuid := 'e0a00000-0000-4000-8000-00000000000b';
  em text := 'energopoiisi-b@properwise.gr';
  d  int;
  st text;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values (u, em, now(), now());
  insert into public.user_properties (user_id, name, status_detail) values (u, 'Δοκιμή Β', 'rented');
  for d in 0..9 loop
    perform pg_temp.probe_morning(array[u]);
    perform pg_temp.probe_day_passes(array[u]);
  end loop;

  st := pg_temp.probe_outcome(em, 'add_first_property');
  if st is not null then
    raise exception '[Β] Το add_first_property μπήκε σε χρήστη με ακίνητο: «%»', st;
  end if;
  st := pg_temp.probe_outcome(em, 'first_property_success');
  if st is distinct from 'sent' then
    raise exception '[Β] Το first_property_success κατέληξε «%» αντί για ένα «sent»', coalesce(st, 'καμία γραμμή');
  end if;
  raise notice 'probe: [Β] με ακίνητο: κανένα «πρόσθεσε ακίνητο», το «είναι έτοιμο» φτάνει';
end $probe$;

-- ── [Γ] Ακίνητο την ημέρα 6, μετά το «πρόσθεσε ακίνητο» ───────────────────
do $probe$
declare
  u  uuid := 'e0a00000-0000-4000-8000-00000000000c';
  em text := 'energopoiisi-c@properwise.gr';
  d  int;
  st text;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values (u, em, now(), now());
  for d in 0..12 loop
    if d = 6 then
      insert into public.user_properties (user_id, name, status_detail) values (u, 'Δοκιμή Γ', 'rented');
    end if;
    perform pg_temp.probe_morning(array[u]);
    perform pg_temp.probe_day_passes(array[u]);
  end loop;

  st := pg_temp.probe_outcome(em, 'add_first_property');
  if st is distinct from 'sent' then
    raise exception '[Γ] Το add_first_property κατέληξε «%» αντί για ένα «sent»', coalesce(st, 'καμία γραμμή');
  end if;
  st := pg_temp.probe_outcome(em, 'first_property_success');
  if st is distinct from 'sent' then
    raise exception '[Γ] Το first_property_success μετά το «πρόσθεσε» κατέληξε «%»', coalesce(st, 'καμία γραμμή');
  end if;
  raise notice 'probe: [Γ] ακίνητο την ημέρα 6: το «είναι έτοιμο» περιμένει το όριο και φτάνει';
end $probe$;

-- ── [Μ] Η μίσθωση του προγραμματισμού ────────────────────────────────────
do $probe$
declare
  first_take  boolean;
  second_take boolean;
  after_free  boolean;
  after_crash boolean;
begin
  -- Ως service_role, τον ρόλο της edge function: ένα δικαίωμα ή μια RLS που
  -- λείπει θα έκανε κάθε τικ 500 και ο προγραμματισμός δεν θα έτρεχε ποτέ.
  set local role service_role;
  perform public.release_email_schedule_lock();
  first_take  := public.try_email_schedule_lock();
  second_take := public.try_email_schedule_lock();
  if first_take is distinct from true or second_take is distinct from false then
    raise exception '[Μ] Δεύτερο «πήρα» όσο κρατιέται: πρώτο %, δεύτερο % (θέλει true, false)', first_take, second_take;
  end if;

  perform public.release_email_schedule_lock();
  after_free := public.try_email_schedule_lock();
  if after_free is distinct from true then
    raise exception '[Μ] Μετά το «άφησα» η μίσθωση δεν ξαναπαίρνεται';
  end if;

  -- Τρέξιμο που πέθανε πριν από το finally: η μίσθωση λήγει μόνη της.
  if to_regclass('public.job_leases') is null then
    raise exception '[Μ] Λείπει ο πίνακας public.job_leases';
  end if;
  update public.job_leases set expires_at = now() - interval '1 second' where name = 'email-outbox-schedule';
  after_crash := public.try_email_schedule_lock();
  if after_crash is distinct from true then
    raise exception '[Μ] Η ληγμένη μίσθωση δεν ξαναπαίρνεται';
  end if;
  perform public.release_email_schedule_lock();

  if not (select relrowsecurity from pg_class where oid = 'public.job_leases'::regclass) then
    raise exception '[Μ] Το job_leases δεν έχει RLS';
  end if;
  if has_table_privilege('anon', 'public.job_leases', 'select')
     or has_table_privilege('authenticated', 'public.job_leases', 'select')
     or has_function_privilege('anon', 'public.try_email_schedule_lock()', 'execute')
     or has_function_privilege('authenticated', 'public.release_email_schedule_lock()', 'execute') then
    raise exception '[Μ] Ρόλος πελάτη φτάνει στη μίσθωση';
  end if;
  if not has_function_privilege('service_role', 'public.try_email_schedule_lock()', 'execute') then
    raise exception '[Μ] Ο service_role δεν εκτελεί το try_email_schedule_lock';
  end if;
  reset role;
  raise notice 'probe: [Μ] η μίσθωση κρατά ένα τρέξιμο, λύνεται με το «άφησα» και λήγει μόνη της';
end $probe$;
