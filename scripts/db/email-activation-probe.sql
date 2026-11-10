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

-- Η drain δεν μαντεύει πια διεύθυνση (20261110132000): τη διαβάζει από το vault.
insert into vault.decrypted_secrets (name, decrypted_secret)
select 'functions_base_url', 'http://probe.invalid'
 where not exists (select 1 from vault.decrypted_secrets where name = 'functions_base_url');

-- Η απάντηση του pg_net. Στην παραγωγή τη γράφει ο worker του pg_net· εδώ
-- απαντά η send-lifecycle-email «στάλθηκε» σε κάθε αίτημα του πρωινού.
create table if not exists net._http_response (
  id bigint primary key, status_code int, content text, timed_out boolean,
  error_msg text, created timestamptz not null default now());

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
  -- Η ουρά γράφει «dispatched»· «sent» γίνεται μόνο αφού έρθει η απάντηση.
  insert into net._http_response (id, status_code, content, timed_out)
  select p.id, 200, '{"sent":true}', false from net.probe_posts p
   where not exists (select 1 from net._http_response h where h.id = p.id);
  perform public.reconcile_email_outbox();
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

-- ═══════════════════════════════════════════════════════════════════════════
--  [Ο] Η ΣΥΜΦΩΝΙΑ ΤΗΣ ΟΥΡΑΣ ΜΕ ΤΗΝ ΑΠΑΝΤΗΣΗ (20261110132000)
-- ─────────────────────────────────────────────────────────────────────────
--  Γραμμές «σε πτήση» με απάντηση του pg_net γραμμένη στο χέρι. Τα
--  αναγνωριστικά αιτημάτων 9000xx δεν συγκρούονται με τα net.probe_posts.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function pg_temp.probe_inflight(p_key text, p_req bigint, p_copy text default 'probe_copy',
  p_cat text default 'marketing', p_email text default 'oura@probe.test',
  p_since interval default interval '0', p_age interval default interval '0') returns bigint language sql as $$
  insert into public.email_outbox (copy_id, to_email, category, dedup_key, status, request_id,
                                   dispatched_at, idem_since, attempts, send_window)
  values (p_copy, p_email, p_cat, p_key, 'dispatched', p_req,
          now() - p_age, now() - p_since, 1, 'morning')
  returning id;
$$;
create or replace function pg_temp.probe_reply(p_req bigint, p_code int, p_body text) returns void language sql as $$
  insert into net._http_response (id, status_code, content, timed_out) values (p_req, p_code, p_body, false);
$$;

do $probe$
declare
  a bigint; b bigint; c bigint; d bigint; e bigint; f bigint; g bigint;
  r record;
begin
  -- 409 invalid_idempotent_request: πιθανότατα στάλθηκε. Δεν είναι αποτυχία και
  -- μετρά στο όριο μάρκετινγκ.
  a := pg_temp.probe_inflight('oura:a', 900001, p_email := 'oura-a@probe.test');
  perform pg_temp.probe_reply(900001, 409, '{"error":"idempotency_conflict","resendCode":"invalid_idempotent_request"}');
  -- 409 concurrent: ξανά, ίδιο κλειδί.
  b := pg_temp.probe_inflight('oura:b', 900002);
  perform pg_temp.probe_reply(900002, 409, '{"error":"idempotency_conflict","resendCode":"concurrent_idempotent_requests"}');
  -- Σίγουρη αποτυχία (ο Resend απάντησε 429): νέα γενιά κλειδιού.
  -- Δικός του παραλήπτης: οι αβέβαιες γραμμές του oura@ μετρούν στο όριο.
  c := pg_temp.probe_inflight('oura:c', 900003, p_email := 'oura-c@probe.test');
  perform pg_temp.probe_reply(900003, 502, '{"error":"send_failed","definite":true,"resendStatus":429}');
  -- Αβέβαιη έκβαση (504 της πύλης): ίδιο κλειδί.
  d := pg_temp.probe_inflight('oura:d', 900004);
  perform pg_temp.probe_reply(900004, 504, 'gateway timeout');
  -- Χαμένη απάντηση μέσα στο παράθυρο: ξανά, ίδιο κλειδί.
  e := pg_temp.probe_inflight('oura:e', 900005, p_cat := 'transactional', p_since := interval '2 hours', p_age := interval '2 hours');
  -- Χαμένη απάντηση έξω από το παράθυρο: failed.
  f := pg_temp.probe_inflight('oura:f', 900006, p_cat := 'transactional', p_since := interval '21 hours', p_age := interval '2 hours');
  -- Αβέβαιη έκβαση έξω από το παράθυρο: failed, όχι ίδιο κλειδί μετά τις 24 ώρες.
  g := pg_temp.probe_inflight('oura:g', 900007, p_since := interval '21 hours');
  perform pg_temp.probe_reply(900007, 504, 'gateway timeout');

  perform public.reconcile_email_outbox();

  select status, last_error into r from public.email_outbox where id = a;
  if r.status <> 'probably_sent' then raise exception '[Ο] Το 409 invalid_idempotent_request έγινε «%/%» αντί για probably_sent', r.status, r.last_error; end if;
  if public.can_send_marketing('oura-a@probe.test') then raise exception '[Ο] Το probably_sent δεν μετρά στο όριο μάρκετινγκ'; end if;
  if not exists (select 1 from public.email_outbox_health() h where h.status = 'probably_sent' and h.n >= 1) then
    raise exception '[Ο] Η email_outbox_health() δεν δείχνει το probably_sent';
  end if;

  select status, idem_gen into r from public.email_outbox where id = b;
  if r.status <> 'pending' or r.idem_gen <> 0 then raise exception '[Ο] Το 409 concurrent έγινε «%» γενιά % (θέλει pending, 0)', r.status, r.idem_gen; end if;

  select status, idem_gen, idem_since into r from public.email_outbox where id = c;
  if r.status <> 'pending' or r.idem_gen <> 1 or r.idem_since is not null then
    raise exception '[Ο] Η σίγουρη αποτυχία έγινε «%» γενιά % (θέλει pending, νέα γενιά 1)', r.status, r.idem_gen;
  end if;

  select status, idem_gen into r from public.email_outbox where id = d;
  if r.status <> 'pending' or r.idem_gen <> 0 then raise exception '[Ο] Η αβέβαιη έκβαση έγινε «%» γενιά % (θέλει pending, ίδιο κλειδί)', r.status, r.idem_gen; end if;

  select status, idem_gen, last_error into r from public.email_outbox where id = e;
  if r.status <> 'pending' or r.idem_gen <> 0 then raise exception '[Ο] Η χαμένη απάντηση μέσα στο παράθυρο έγινε «%/%» (θέλει pending, ίδιο κλειδί)', r.status, r.last_error; end if;

  select status, last_error into r from public.email_outbox where id = f;
  if r.status <> 'failed' or r.last_error <> 'response_lost' then raise exception '[Ο] Η χαμένη απάντηση έξω από το παράθυρο έγινε «%/%»', r.status, r.last_error; end if;

  select status, last_error into r from public.email_outbox where id = g;
  if r.status <> 'failed' or r.last_error not like 'idempotency_window:%' then raise exception '[Ο] Η αβέβαιη έκβαση μετά τις 20 ώρες έγινε «%/%»', r.status, r.last_error; end if;

  -- Η drain στέλνει τη γενιά και κρατά την ώρα της πρώτης αποστολής.
  update public.email_outbox set scheduled_for = now() where id in (c, e);
  perform public.drain_email_outbox(100);
  if not exists (select 1 from net.probe_posts p join public.email_outbox o on o.request_id = p.id
                  where o.id = c and (p.body->>'outboxGen')::int = 1) then
    raise exception '[Ο] Η drain δεν περνά τη νέα γενιά κλειδιού στη function';
  end if;
  if (select idem_since from public.email_outbox where id = e) > now() - interval '1 hour' then
    raise exception '[Ο] Η επανάληψη με το ίδιο κλειδί ξεκίνησε νέο παράθυρο';
  end if;
  raise notice 'probe: [Ο] 409, σίγουρη και αβέβαιη αποτυχία, χαμένη απάντηση: κανένα ψεύτικο failed, κανένα διπλό';
end $probe$;

-- ── [Ο] Η απόσυρση πρόσκλησης πιάνει και ό,τι είναι σε πτήση ─────────────
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('probe.uid', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

do $probe$
declare
  acc uuid := 'e0a00000-0000-4000-8000-0000000000a9';
  inv uuid;
  w   bigint;
  x   bigint;
  res json;
  st  text;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values (acc, 'oura-logistis@probe.test', now(), now());
  insert into public.accountant_invites (accountant_id, email) values (acc, 'oura-pelatis@probe.test') returning id into inv;

  -- Απόσυρση όσο το μήνυμα είναι σε πτήση και μετά 503.
  w := pg_temp.probe_inflight('accountant_invite:' || inv || ':1', 900011, 'accountant_invite', 'transactional', 'oura-pelatis@probe.test');
  perform set_config('probe.uid', acc::text, true);
  res := public.accountant_invite_withdraw(inv);
  perform set_config('probe.uid', '', true);
  if (res->>'ok')::boolean is not true then raise exception '[Ο] Η απόσυρση απέτυχε: %', res; end if;
  perform pg_temp.probe_reply(900011, 503, '{"error":"send_error"}');

  -- Διαγραφή αποστολέα όσο το μήνυμα είναι σε πτήση και μετά 503.
  insert into public.email_outbox (copy_id, to_email, category, dedup_key, status, request_id, dispatched_at, idem_since, attempts, params)
  values ('accountant_invite', 'oura-allos@probe.test', 'transactional', 'oura:x', 'dispatched', 900012, now(), now(), 1,
          jsonb_build_object('accountantEmail', 'oura-logistis@probe.test'))
  returning id into x;
  perform pg_temp.probe_reply(900012, 503, '{"error":"send_error"}');
  delete from auth.users where id = acc;

  perform public.reconcile_email_outbox();

  select status || '/' || coalesce(last_error, '') into st from public.email_outbox where id = w;
  if st <> 'skipped/withdrawn:in_flight' then
    raise exception '[Ο] Πρόσκληση που αποσύρθηκε σε πτήση κατέληξε «%» (θα ξανάφευγε)', st;
  end if;
  select status || '/' || coalesce(last_error, '') into st from public.email_outbox where id = x;
  if st <> 'skipped/sender_erased' then
    raise exception '[Ο] Πρόσκληση σβησμένου αποστολέα σε πτήση κατέληξε «%» (θα ξανάφευγε)', st;
  end if;
  raise notice 'probe: [Ο] η απόσυρση και η διαγραφή αποστολέα κόβουν και το μήνυμα σε πτήση';
end $probe$;

-- ── [Ο] Η σημαία της αβέβαιης έκβασης ────────────────────────────────────
--  Μια γενιά με αβέβαιη προσπάθεια δεν αλλάζει κλειδί, η drain δεν στέλνει
--  με το ίδιο κλειδί έξω από το παράθυρο, το όριο μάρκετινγκ μετρά ό,τι ίσως
--  έφυγε και οι επαναλήψεις δεν χτυπούν όλες μαζί.
create or replace function pg_temp.probe_row(p_key text, p_status text, p_req bigint, p_uncertain boolean,
  p_attempts int default 1, p_cat text default 'transactional', p_email text default 'oura@probe.test',
  p_since interval default interval '0', p_age interval default interval '0') returns bigint language sql as $$
  insert into public.email_outbox (copy_id, to_email, category, dedup_key, status, request_id, dispatched_at,
                                   idem_since, idem_uncertain, attempts, send_window, scheduled_for)
  values ('probe_copy', p_email, p_cat, p_key, p_status, p_req, now() - p_age, now() - p_since,
          p_uncertain, p_attempts, 'morning', now())
  returning id;
$$;

do $probe$
declare
  h bigint; i bigint; j bigint; n int;
  r record;
begin
  if not (select idem_uncertain from public.email_outbox where dedup_key = 'oura:d') then
    raise exception '[Ο] Η αβέβαιη έκβαση δεν σήκωσε τη σημαία idem_uncertain';
  end if;
  if not (select idem_uncertain from public.email_outbox where dedup_key = 'oura:f') then
    raise exception '[Ο] Η χαμένη απάντηση δεν σήκωσε τη σημαία idem_uncertain';
  end if;

  -- Σίγουρη αποτυχία μετά από αβέβαιη: ίδιο κλειδί.
  h := pg_temp.probe_row('oura:h', 'dispatched', 900021, true);
  perform pg_temp.probe_reply(900021, 502, '{"error":"send_failed","definite":true,"resendStatus":500}');
  -- Το ίδιο στην τελευταία προσπάθεια: failed, χωρίς νέα γενιά, η σημαία μένει.
  i := pg_temp.probe_row('oura:i', 'dispatched', 900022, true, 3);
  perform pg_temp.probe_reply(900022, 502, '{"error":"send_failed","definite":true,"resendStatus":500}');
  -- Ριπή 429: είκοσι γραμμές με την ίδια απάντηση.
  for n in 1..20 loop
    perform pg_temp.probe_row('oura:burst:' || n, 'dispatched', 900100 + n, false);
    perform pg_temp.probe_reply(900100 + n, 502, '{"error":"send_failed","definite":true,"resendStatus":429}');
  end loop;

  perform public.reconcile_email_outbox();

  select status, idem_gen into r from public.email_outbox where id = h;
  if r.status <> 'pending' or r.idem_gen <> 0 then
    raise exception '[Ο] Σίγουρη αποτυχία μετά από αβέβαιη έγινε «%» γενιά % (θέλει pending, ίδιο κλειδί)', r.status, r.idem_gen;
  end if;
  select status, idem_gen, idem_uncertain into r from public.email_outbox where id = i;
  if r.status <> 'failed' or r.idem_gen <> 0 or not r.idem_uncertain then
    raise exception '[Ο] Τέλος προσπαθειών μετά από αβέβαιη έγινε «%» γενιά % σημαία %', r.status, r.idem_gen, r.idem_uncertain;
  end if;
  select count(distinct scheduled_for) into n from public.email_outbox where dedup_key like 'oura:burst:%';
  if n < 5 then raise exception '[Ο] Η ριπή 429 ξαναπρογραμματίστηκε σε % στιγμές (χωρίς τυχαίο μέρος)', n; end if;
  if exists (select 1 from public.email_outbox where dedup_key like 'oura:burst:%'
              and (scheduled_for < now() + interval '15 minutes' or scheduled_for > now() + interval '20 minutes')) then
    raise exception '[Ο] Η καθυστέρηση της ριπής βγήκε έξω από τα 15 έως 20 λεπτά';
  end if;

  -- Η drain δεν στέλνει με το ίδιο κλειδί μετά τις 20 ώρες.
  j := pg_temp.probe_row('oura:j', 'pending', null, true, 1, p_since := interval '21 hours', p_age := interval '19 hours');
  perform public.drain_email_outbox(100);
  select status, last_error, request_id into r from public.email_outbox where id = j;
  if r.status <> 'failed' or r.last_error <> 'idempotency_window' or r.request_id is not null then
    raise exception '[Ο] Η drain έστειλε με το ίδιο κλειδί έξω από το παράθυρο: «%/%»', r.status, r.last_error;
  end if;

  -- Το όριο μάρκετινγκ μετρά ό,τι ίσως έφυγε.
  perform pg_temp.probe_row('oura:k', 'failed', null, true, 3, 'marketing', 'oura-k@probe.test', p_age := interval '1 hour');
  perform pg_temp.probe_row('oura:l', 'failed', null, false, 3, 'marketing', 'oura-l@probe.test', p_age := interval '1 hour');
  if public.can_send_marketing('oura-k@probe.test') then
    raise exception '[Ο] Το όριο μάρκετινγκ αγνοεί email που ίσως έφυγε (failed με αβέβαιη έκβαση)';
  end if;
  if not public.can_send_marketing('oura-l@probe.test') then
    raise exception '[Ο] Το όριο μάρκετινγκ μετρά σίγουρη αποτυχία σαν αποστολή';
  end if;
  raise notice 'probe: [Ο] η αβέβαιη έκβαση κρατά το κλειδί, κόβεται στο παράθυρο και μετρά στο όριο· η ριπή 429 σκορπίζει';
end $probe$;
