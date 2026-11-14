-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΟ ΚΑΘΑΡΙΣΜΑ ΤΩΝ ΠΙΝΑΚΩΝ ΚΑΤΑΓΡΑΦΗΣ (20261110151000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα. Γραμμές λίγο πριν και λίγο μετά από κάθε
--  όριο· η private.prune_logs() σβήνει ΜΟΝΟ ό,τι πρέπει:
--   · health_checks: 31 ημερών σβήνει, 29 ημερών μένει·
--   · email_outbox: pending και dispatched δεν αγγίζονται ποτέ· τελική γραμμή
--     91 ημερών χάνει περιεχόμενο και όνομα αλλά μένει (το dedup_key της)·
--     κλειδί μίας φοράς 500 ημερών μένει· κλειδί περιόδου 500 ημερών σβήνει·
--   · notification_log: 14 μηνών σβήνει, εκτός από την πρώτη γραμμή του
--     χρήστη και την όχληση γεγονότος που είναι ακόμη pending. (Η εξαίρεση
--     της απλήρωτης δόσης δεν δοκιμάζεται εδώ: το event_id έχει ξένο κλειδί
--     προς το calendar_events, οπότε γραμμή `rent_overdue` με id δόσης δεν
--     γράφεται σήμερα καθόλου.)
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
do $probe$
declare
  u uuid := 'f5000000-0000-4000-8000-000000000001';
  p uuid := 'f5000000-0000-4000-8000-00000000f001';
  ev_open uuid := 'f5000000-0000-4000-8000-0000000e0001';
  ev_done uuid := 'f5000000-0000-4000-8000-0000000e0002';
  n int;
  res jsonb;
begin
  insert into auth.users(id, email) values (u, 'u@logs-retention.test');
  insert into public.user_properties(id, user_id, name) values (p, u, 'Διατήρηση');
  insert into public.calendar_events(id, user_id, property_id, title, event_date, status) values
    (ev_open, u, p, 'ανοιχτό', current_date - 500, 'pending'),
    (ev_done, u, p, 'κλειστό', current_date - 500, 'done');

  -- health_checks
  insert into public.health_checks(ran_at, ok, kind, base) values
    (now() - interval '31 days', true, 'ok', 'probe-old'),
    (now() - interval '29 days', true, 'ok', 'probe-new');

  -- email_outbox
  insert into public.email_outbox(copy_id, to_email, to_name, params, category, status, dedup_key, scheduled_for) values
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'transactional', 'pending',    'probe:pending',            now() - interval '500 days'),
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'transactional', 'dispatched', 'probe:dispatched',         now() - interval '500 days'),
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'lifecycle',     'sent',       'probe-once:' || u,          now() - interval '500 days'),
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'lifecycle',     'sent',       'probe-q:' || u || ':2025-1', now() - interval '500 days'),
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'lifecycle',     'expired',    'probe-91:' || u,            now() - interval '91 days'),
    ('probe', 'a@logs-retention.test', 'Α', '{"x":1}', 'lifecycle',     'sent',       'probe-89:' || u,            now() - interval '89 days');

  -- notification_log: η πρώτη γραμμή, τρεις παλιές που μένουν ή φεύγουν, μία πρόσφατη
  insert into public.notification_log(user_id, event_id, reminder_type, created_at) values
    (u, ev_done, '7days',        now() - interval '30 months'),   -- πρώτη του χρήστη: μένει
    (u, ev_done, '1day',         now() - interval '14 months'),   -- σβήνει
    (u, ev_open, 'overdue',      now() - interval '14 months'),   -- γεγονός ανοιχτό: μένει
    (u, ev_done, 'overdue',      now() - interval '14 months'),   -- γεγονός κλειστό: σβήνει
    (u, ev_done, 'today',        now() - interval '2 months');    -- πρόσφατη: μένει

  res := private.prune_logs();

  select count(*) into n from public.health_checks where base in ('probe-old', 'probe-new');
  if n <> 1 or not exists (select 1 from public.health_checks where base = 'probe-new') then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: health_checks κράτησε % γραμμές αντί για τη νεότερη', n; end if;
  raise notice 'probe: health_checks κρατά 30 ημέρες';

  select count(*) into n from public.email_outbox where dedup_key in ('probe:pending', 'probe:dispatched');
  if n <> 2 then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: σβήστηκε email σε πτήση (% από 2)', n; end if;
  if exists (select 1 from public.email_outbox where dedup_key in ('probe:pending', 'probe:dispatched') and (params = '{}'::jsonb or to_name is null)) then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: email σε πτήση έχασε περιεχόμενο'; end if;
  raise notice 'probe: pending και dispatched μένουν ανέγγιχτα';

  if not exists (select 1 from public.email_outbox where dedup_key = 'probe-once:' || u and params = '{}'::jsonb and to_name is null) then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: το κλειδί μίας φοράς χάθηκε ή κράτησε περιεχόμενο'; end if;
  if exists (select 1 from public.email_outbox where dedup_key = 'probe-q:' || u || ':2025-1') then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: το κλειδί περιόδου 500 ημερών δεν σβήστηκε'; end if;
  if not exists (select 1 from public.email_outbox where dedup_key = 'probe-91:' || u and params = '{}'::jsonb and to_name is null) then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: η τελική γραμμή 91 ημερών κράτησε περιεχόμενο'; end if;
  if not exists (select 1 from public.email_outbox where dedup_key = 'probe-89:' || u and params <> '{}'::jsonb and to_name is not null) then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: η γραμμή 89 ημερών έχασε περιεχόμενο νωρίς'; end if;
  raise notice 'probe: η ουρά κρατά το dedup και σβήνει το περιεχόμενο στις 90 ημέρες';

  select count(*) into n from public.notification_log where user_id = u;
  if n <> 3 then raise exception 'ΔΙΑΤΗΡΗΣΗ: notification_log κράτησε % γραμμές αντί για 3', n; end if;
  if not exists (select 1 from public.notification_log where user_id = u and reminder_type = 'overdue' and event_id = ev_open) then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: σβήστηκε όχληση ανοιχτού γεγονότος'; end if;
  if not exists (select 1 from public.notification_log where user_id = u and reminder_type = '7days') then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: σβήστηκε η πρώτη γραμμή του χρήστη'; end if;
  raise notice 'probe: notification_log κρατά 13 μήνες με τις εξαιρέσεις';

  -- Δεύτερη εκτέλεση: τίποτα άλλο δεν σβήνει.
  res := private.prune_logs();
  if (res->>'notification_log')::int <> 0 or (res->>'outbox_deleted')::int <> 0 then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: η δεύτερη εκτέλεση έσβησε κι άλλα: %', res; end if;
  raise notice 'probe: η δεύτερη εκτέλεση δεν αγγίζει τίποτα';

  if has_function_privilege('authenticated', 'private.prune_logs(int, int)', 'execute')
     or has_function_privilege('anon', 'private.prune_logs(int, int)', 'execute') then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: ο πελάτης καλεί το καθάρισμα'; end if;
  raise notice 'probe: ο πελάτης δεν καλεί το καθάρισμα';
end $probe$;
rollback;
