-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΟΥΡΑ ΤΩΝ EMAIL ΓΡΑΦΕΙ «ΣΤΑΛΘΗΚΕ» ΜΟΝΟ ΟΤΑΝ ΤΟ ΞΕΡΕΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΜΕΤΡΗΘΗΚΕ (10/11/2026, pg_get_functiondef στην παραγωγή). Η
-- drain_email_outbox έκανε `perform net.http_post(...)` και ΑΜΕΣΩΣ ΜΕΤΑ
-- `status = 'sent'`. Το net.http_post είναι ασύγχρονο: γυρίζει αναγνωριστικό
-- αιτήματος, όχι απάντηση. Αρα:
--   · 500 `no_resend_key`, 502 `send_failed`, 400 `unknown_email` της
--     send-lifecycle-email γράφονταν «sent»·
--   · τα 200 `{skipped: …}` (unsubscribed, billing_not_live κ.λπ.) επίσης «sent»·
--   · το `attempts` δεν ξεπερνούσε ποτέ το 1 και δεν υπήρχε επανάληψη·
--   · χωρίς το μυστικό `email_cron`, η συνάρτηση γύριζε σιωπηλά 0 και το
--     pg_cron κατέγραφε «succeeded» κάθε πέντε λεπτά.
-- Διασταύρωση με το Resend (15/10–10/11) δεν έδειξε χαμένο email ως σήμερα·
-- αυτό είναι τύχη, όχι μηχανισμός.
--
-- ΤΙ ΑΛΛΑΖΕΙ.
--   1. Η drain κρατά το αναγνωριστικό του αιτήματος και γράφει `dispatched`.
--   2. Νέα reconcile_email_outbox διαβάζει το net._http_response (σβήνεται σε
--      ~6 ώρες, άρα τρέχει κάθε 5 λεπτά) και ορίζει:
--        200 {sent:true}      → sent, sent_at = ώρα αποστολής
--        200 {skipped: λόγος} → skipped, last_error = 'skipped:<λόγος>'
--        400                  → failed (λάθος αίτημα, η επανάληψη δεν βοηθά)
--        άλλο 2xx             → failed χωρίς επανάληψη (ίσως έφυγε)
--        άλλο / λήξη / σφάλμα → pending ξανά με καθυστέρηση, ως 3 προσπάθειες,
--                               μετά failed
--        καμία απάντηση >60'  → failed 'response_lost'. ΧΩΡΙΣ επανάληψη: ίσως
--                               έφυγε· διπλό email είναι χειρότερο.
--   3. Χωρίς το μυστικό `email_cron` ή το `functions_base_url` η drain ΣΗΚΩΝΕΙ ΣΦΑΛΜΑ, ώστε το pg_cron
--      να γράψει failed και να το δει ο έλεγχος υγείας, αντί για «succeeded».
--   4. Το όριο συχνότητας μάρκετινγκ (can_send_marketing) μετρά και τα
--      `dispatched`: ένα email σε πτήση έχει ήδη φύγει για τον παραλήπτη.
--
-- Κανένα δικαίωμα δεν αλλάζει: η drain και η reconcile εκτελούνται μόνο από
-- το cron (postgres) και το service_role. Δες scripts/guard-http-bridge.mjs.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.email_outbox add column if not exists request_id bigint;
alter table public.email_outbox add column if not exists dispatched_at timestamptz;

create index if not exists email_outbox_dispatched_idx
  on public.email_outbox (dispatched_at) where status = 'dispatched';

-- ── 1. Η αποστολή κρατά το αναγνωριστικό ───────────────────────────────────
create or replace function public.drain_email_outbox(p_limit integer default 100)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r        record;
  v_secret text;
  v_req    bigint;
  v_live   boolean := coalesce(
              (select secret = '1' from public.cron_secrets where name = 'emails_live' limit 1),
              false);
  -- ΚΑΝΕΝΑ ΕΦΕΔΡΙΚΟ ΕΡΓΟ ΓΡΑΜΜΕΝΟ ΣΤΟ ΧΕΡΙ (scripts/guard-project-ref.mjs). Ο
  -- παλιός ορισμός έπεφτε σε καρφωμένη διεύθυνση όταν έλειπε το μυστικό.
  v_base   text := private.functions_base_url();
  v_url    text;
  v_sent   int := 0;
begin
  if v_base is null then
    raise exception 'drain_email_outbox: λείπει το functions_base_url στο vault, κανένα email δεν φεύγει';
  end if;
  v_url := v_base || '/functions/v1/send-lifecycle-email';
  select secret into v_secret from public.cron_secrets where name = 'email_cron' limit 1;
  -- ΘΟΡΥΒΩΔΩΣ: το pg_cron γράφει failed με αυτό το μήνυμα, αντί για «succeeded».
  if v_secret is null then
    raise exception 'drain_email_outbox: λείπει το μυστικό email_cron στο cron_secrets, κανένα email δεν φεύγει';
  end if;

  for r in
    select * from public.email_outbox
     where status = 'pending' and scheduled_for <= now()
       and (send_window is not null or category = 'transactional')
     order by scheduled_for
     limit p_limit
     for update skip locked
  loop
    -- Guard 2: stale by ORIGINAL enqueue time (created_at), which the scheduler
    -- never rewrites, so a backlog accumulated while dormant expires instead of
    -- flushing on activation day.
    if r.category <> 'transactional' and r.created_at < now() - interval '2 days' then
      update public.email_outbox set status = 'expired', last_error = 'stale' where id = r.id;
      continue;
    end if;

    -- Guard 1: master switch. Non-transactional holds until emails_live='1'.
    if r.category <> 'transactional' and not v_live then
      continue;
    end if;

    if r.category = 'marketing' and not public.can_send_marketing(r.to_email) then
      update public.email_outbox set status = 'skipped', last_error = 'frequency_cap' where id = r.id;
      continue;
    end if;

    -- ΕΠΑΝΑΛΗΨΗ ΧΩΡΙΣ ΔΙΠΛΟ EMAIL. Το `outboxId` γίνεται στη function
    -- `Idempotency-Key: outbox-<id>` προς τον Resend, που κρατά το κλειδί 24
    -- ώρες και σε δεύτερη κλήση επιστρέφει την πρώτη απάντηση, χωρίς νέα
    -- αποστολή. Οι 3 προσπάθειες της reconcile χωρούν σε λιγότερο από μία ώρα.
    -- Το όριο χρόνου ανεβαίνει από τα 5″ του pg_net στα 30″, ώστε μια αργή αλλά
    -- πετυχημένη αποστολή να μη μετρά ως λήξη χρόνου.
    v_req := net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body    := jsonb_build_object('outboxId', r.id, 'copyId', r.copy_id, 'email', r.to_email, 'name', r.to_name, 'params', r.params),
      timeout_milliseconds := 30000
    );
    update public.email_outbox
       set status = 'dispatched', request_id = v_req, dispatched_at = now(), attempts = attempts + 1
     where id = r.id;
    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$function$;

-- ── 2. Η συμφωνία με την απάντηση ──────────────────────────────────────────
create or replace function public.reconcile_email_outbox()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r      record;
  v_body jsonb;
  v_n    int := 0;
  v_max  constant int := 3;
begin
  for r in
    select o.id, o.attempts, o.dispatched_at,
           h.id as resp_id, h.status_code, h.content, h.timed_out, h.error_msg
      from public.email_outbox o
      left join net._http_response h on h.id = o.request_id
     where o.status = 'dispatched'
     order by o.dispatched_at
     limit 500
     for update of o skip locked
  loop
    if r.resp_id is null then
      -- Δεν ήρθε ακόμη απάντηση. Μετά από μία ώρα δεν θα έρθει (ή σβήστηκε).
      if r.dispatched_at < now() - interval '60 minutes' then
        update public.email_outbox
           set status = 'failed', last_error = 'response_lost'
         where id = r.id;
        v_n := v_n + 1;
      end if;
      continue;
    end if;

    begin
      v_body := r.content::jsonb;
    exception when others then
      v_body := null;
    end;

    if r.status_code = 200 and coalesce(v_body->>'sent', '') = 'true' then
      update public.email_outbox
         set status = 'sent', sent_at = r.dispatched_at, last_error = null
       where id = r.id;
    elsif r.status_code = 200 and v_body ? 'skipped' then
      update public.email_outbox
         set status = 'skipped', last_error = left('skipped:' || (v_body->>'skipped'), 200)
       where id = r.id;
    elsif r.status_code = 400 then
      update public.email_outbox
         set status = 'failed',
             last_error = left('400:' || coalesce(v_body->>'error', r.content, ''), 300)
       where id = r.id;
    elsif r.status_code = 409 then
      -- Ο Resend αρνήθηκε το ίδιο κλειδί μοναδικότητας: η πρώτη αποστολή είτε
      -- τρέχει είτε έγινε. Οχι επανάληψη, όχι διπλό email.
      update public.email_outbox
         set status = 'failed', last_error = left('idempotency:' || coalesce(r.content, ''), 300)
       where id = r.id;
    elsif r.status_code between 200 and 299 then
      -- 2xx ΧΩΡΙΣ αναγνωρίσιμο σώμα: ίσως έφυγε. Οχι επανάληψη, όχι διπλό email.
      update public.email_outbox
         set status = 'failed', last_error = left('unexpected_2xx:' || coalesce(r.content, ''), 300)
       where id = r.id;
    elsif r.attempts < v_max then
      update public.email_outbox
         set status = 'pending',
             request_id = null,
             scheduled_for = now() + make_interval(mins => 15 * r.attempts),
             last_error = left(
               case when r.timed_out then 'timeout'
                    when r.error_msg is not null then 'net:' || r.error_msg
                    else coalesce(r.status_code::text, '?') || ':' || coalesce(v_body->>'error', r.content, '')
               end, 300)
       where id = r.id;
    else
      update public.email_outbox
         set status = 'failed',
             last_error = left(
               'after ' || r.attempts || ' attempts: ' ||
               case when r.timed_out then 'timeout'
                    when r.error_msg is not null then 'net:' || r.error_msg
                    else coalesce(r.status_code::text, '?') || ':' || coalesce(v_body->>'error', r.content, '')
               end, 300)
       where id = r.id;
    end if;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$function$;

revoke all on function public.reconcile_email_outbox() from public, anon, authenticated;
grant execute on function public.reconcile_email_outbox() to service_role;

-- ── 3. Το όριο συχνότητας μετρά και όσα είναι σε πτήση ──────────────────────
create or replace function public.can_send_marketing(p_to_email text)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(
    (select max(coalesce(sent_at, dispatched_at))
       from public.email_outbox
      where to_email = lower(trim(p_to_email)) and category = 'marketing'
        and status in ('sent', 'dispatched'))
      < now() - interval '3 days',
    true);
$function$;

-- ── 4. Η εργασία ───────────────────────────────────────────────────────────
-- Κάθε 5 λεπτά, μετατοπισμένη κατά 2 από τη drain (*/5), ώστε η απάντηση να
-- έχει προλάβει να έρθει.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'email-outbox-reconcile') then
    perform cron.unschedule('email-outbox-reconcile');
  end if;
  perform cron.schedule('email-outbox-reconcile', '2-59/5 * * * *', 'select public.reconcile_email_outbox()');
end $$;
