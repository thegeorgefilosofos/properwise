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
--        409 του Resend       → probably_sent (το κλειδί έχει ήδη χρησιμοποιηθεί)
--                               ή, όσο τρέχει η πρώτη, ξανά με το ίδιο κλειδί
--        άλλο 2xx             → failed χωρίς επανάληψη (ίσως έφυγε)
--        σίγουρη αποτυχία     → pending ξανά με ΝΕΑ γενιά κλειδιού, μόνο αν
--                               καμία προσπάθεια της γενιάς δεν ήταν αβέβαιη
--                               (`idem_uncertain`)· αλλιώς ίδιο κλειδί
--        αβέβαιη έκβαση       → pending ξανά με το ΙΔΙΟ κλειδί, μόνο μέσα στο
--                               παράθυρο των 20 ωρών από την πρώτη αποστολή
--        καμία απάντηση >60'  → όπως η αβέβαιη έκβαση: ίδιο κλειδί, ίδιο
--                               παράθυρο. Τα net.* είναι UNLOGGED και χάνονται
--                               σε κατάρρευση· ο Resend δεν ξαναστέλνει.
--      Ολα ως 3 προσπάθειες, μετά failed. Η καθυστέρηση έχει τυχαίο μέρος
--      (ως 5 λεπτά), ώστε μια ριπή 429 να μην ξαναχτυπήσει όλη μαζί.
--      Η drain ελέγχει κι αυτή το παράθυρο πριν στείλει με το ίδιο κλειδί.
--   3. Χωρίς το μυστικό `email_cron` ή το `functions_base_url` η drain ΣΗΚΩΝΕΙ ΣΦΑΛΜΑ, ώστε το pg_cron
--      να γράψει failed και να το δει ο έλεγχος υγείας, αντί για «succeeded».
--   4. Το όριο συχνότητας μάρκετινγκ (can_send_marketing) μετρά και τα
--      `dispatched` και τα `probably_sent`: ένα email σε πτήση ή με κλειδί που
--      ο Resend έχει ήδη δει έχει φύγει για τον παραλήπτη. Και όσα ίσως
--      έφυγαν (pending, failed, expired με `idem_uncertain`).
--   5. Η ακύρωση πρόσκλησης λογιστή (απόσυρση, διαγραφή αποστολέα) πιάνει και
--      τα `dispatched`. Αλλιώς μια γραμμή σε πτήση γύριζε σε pending μετά από
--      5xx και η πρόσκληση που ανακλήθηκε έφευγε.
--   6. Η email_outbox_health() δίνει στην παρακολούθηση τις καταστάσεις του
--      τελευταίου 24ώρου, μαζί με τα probably_sent. Τη διαβάζει το
--      health-check και απαντά `email_ok` (_shared/outboxHealth.ts).
--
-- ΠΗΓΗ ΓΙΑ ΤΟΝ RESEND (τεκμηρίωση «Idempotency Keys», resend.com/docs/dashboard/
-- emails/idempotency-keys και changelog/idempotency-keys): το κλειδί κρατιέται
-- 24 ώρες· 409 `concurrent_idempotent_requests` σημαίνει ότι τρέχει ακόμη
-- αίτημα με το ίδιο κλειδί και η επανάληψη αργότερα είναι ασφαλής· 409
-- `invalid_idempotent_request` σημαίνει ότι το κλειδί χρησιμοποιήθηκε ήδη με
-- άλλο σώμα. Η τεκμηρίωση ΔΕΝ λέει αν κρατά απαντήσεις λάθους για το κλειδί·
-- γι' αυτό μετά από σίγουρη αποτυχία αλλάζει η γενιά του κλειδιού.
--
-- Κανένα δικαίωμα δεν αλλάζει: η drain και η reconcile εκτελούνται μόνο από
-- το cron (postgres) και το service_role. Δες scripts/guard-http-bridge.mjs.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.email_outbox add column if not exists request_id bigint;
alter table public.email_outbox add column if not exists dispatched_at timestamptz;
-- Η γενιά του κλειδιού μοναδικότητας και πότε στάλθηκε πρώτη φορά με αυτήν.
alter table public.email_outbox add column if not exists idem_gen integer not null default 0;
alter table public.email_outbox add column if not exists idem_since timestamptz;
-- Μια προσπάθεια της τρέχουσας γενιάς είχε αβέβαιη έκβαση (ίσως έφυγε). Οσο
-- ισχύει, η γενιά ΔΕΝ αλλάζει: νέο κλειδί θα μπορούσε να στείλει δεύτερο email.
alter table public.email_outbox add column if not exists idem_uncertain boolean not null default false;

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

    -- ΤΟ ΙΔΙΟ ΚΛΕΙΔΙ ΜΟΝΟ ΜΕΣΑ ΣΤΟ ΠΑΡΑΘΥΡΟ. Μετά από αβέβαιη έκβαση η γραμμή
    -- ξαναφεύγει με το ίδιο κλειδί· αν πέρασαν 20 ώρες από την πρώτη αποστολή
    -- (ο Resend κρατά το κλειδί 24), δεν φεύγει: θα μπορούσε να είναι δεύτερο.
    if r.idem_uncertain and coalesce(r.idem_since, r.dispatched_at, r.created_at) < now() - interval '20 hours' then
      update public.email_outbox set status = 'failed', last_error = 'idempotency_window' where id = r.id;
      continue;
    end if;

    -- Το όριο συχνότητας ΟΧΙ στην επανάληψη αβέβαιης έκβασης: με το ίδιο
    -- κλειδί δεν γίνεται δεύτερο email. Και η ίδια η γραμμή μετρά ήδη στο όριο.
    if r.category = 'marketing' and not r.idem_uncertain and not public.can_send_marketing(r.to_email) then
      update public.email_outbox set status = 'skipped', last_error = 'frequency_cap' where id = r.id;
      continue;
    end if;

    -- ΕΠΑΝΑΛΗΨΗ ΧΩΡΙΣ ΔΙΠΛΟ EMAIL. Το `outboxId` γίνεται στη function
    -- `Idempotency-Key: outbox-<id>` προς τον Resend, που κρατά το κλειδί 24
    -- ώρες και σε δεύτερη κλήση επιστρέφει την πρώτη απάντηση, χωρίς νέα
    -- αποστολή. Το κλειδί έχει περιβάλλον, γραμμή και γενιά (_shared/outboxKey.ts).
    -- Το όριο χρόνου ανεβαίνει από τα 5″ του pg_net στα 30″, ώστε μια αργή αλλά
    -- πετυχημένη αποστολή να μη μετρά ως λήξη χρόνου.
    v_req := net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body    := jsonb_build_object('outboxId', r.id, 'outboxGen', r.idem_gen, 'copyId', r.copy_id, 'email', r.to_email, 'name', r.to_name, 'params', r.params),
      timeout_milliseconds := 30000
    );
    update public.email_outbox
       set status = 'dispatched', request_id = v_req, dispatched_at = now(), attempts = attempts + 1,
           idem_since = coalesce(idem_since, now())
     where id = r.id;
    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$function$;

-- ── 2. Η συμφωνία με την απάντηση ──────────────────────────────────────────
-- Ολες οι ενημερώσεις ρωτούν ξανά `status = 'dispatched'`: μια γραμμή που
-- ακυρώθηκε στο μεταξύ (απόσυρση πρόσκλησης) δεν ξαναμπαίνει στην ουρά.
create or replace function public.reconcile_email_outbox()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r        record;
  v_body   jsonb;
  v_n      int := 0;
  v_max    constant int := 3;
  -- Ο Resend κρατά το κλειδί 24 ώρες. Επανάληψη με το ΙΔΙΟ κλειδί μόνο αν
  -- απέχει με άνεση από το όριο: μετά, ο Resend θα το έστελνε ξανά.
  v_window constant interval := interval '20 hours';
  v_why    text;
  v_same   boolean;   -- επιτρέπεται επανάληψη με το ίδιο κλειδί
  -- Τυχαίο μέρος στην καθυστέρηση: μια ριπή 429 δεν ξαναχτυπά όλη μαζί.
  v_jitter interval;
begin
  for r in
    select o.id, o.attempts, o.dispatched_at, o.idem_since, o.idem_uncertain,
           h.id as resp_id, h.status_code, h.content, h.timed_out, h.error_msg
      from public.email_outbox o
      left join net._http_response h on h.id = o.request_id
     where o.status = 'dispatched'
     order by o.dispatched_at
     limit 500
     for update of o skip locked
  loop
    v_same := r.attempts < v_max and coalesce(r.idem_since, r.dispatched_at) > now() - v_window;
    v_jitter := make_interval(secs => floor(random() * 300)::int);

    if r.resp_id is null then
      -- Δεν ήρθε ακόμη απάντηση. Μετά από μία ώρα δεν θα έρθει: τα net.* είναι
      -- UNLOGGED και χάνονται σε κατάρρευση. Ισως έφυγε, ίσως όχι: επανάληψη
      -- με το ίδιο κλειδί, που ο Resend δεν στέλνει δεύτερη φορά.
      if r.dispatched_at < now() - interval '60 minutes' then
        if v_same then
          update public.email_outbox
             set status = 'pending', request_id = null, scheduled_for = now() + v_jitter,
                 idem_uncertain = true, last_error = 'response_lost:retry'
           where id = r.id and status = 'dispatched';
        else
          update public.email_outbox
             set status = 'failed', idem_uncertain = true, last_error = 'response_lost'
           where id = r.id and status = 'dispatched';
        end if;
        v_n := v_n + 1;
      end if;
      continue;
    end if;

    begin
      v_body := r.content::jsonb;
    exception when others then
      v_body := null;
    end;

    v_why := left(
      case when r.timed_out then 'timeout'
           when r.error_msg is not null then 'net:' || r.error_msg
           else coalesce(r.status_code::text, '?') || ':' || coalesce(v_body->>'error', r.content, '')
      end, 300);

    if r.status_code = 200 and coalesce(v_body->>'sent', '') = 'true' then
      update public.email_outbox
         set status = 'sent', sent_at = r.dispatched_at, last_error = null
       where id = r.id and status = 'dispatched';
    elsif r.status_code = 200 and v_body ? 'skipped' then
      update public.email_outbox
         set status = 'skipped', last_error = left('skipped:' || (v_body->>'skipped'), 200)
       where id = r.id and status = 'dispatched';
    elsif r.status_code = 400 then
      update public.email_outbox
         set status = 'failed',
             last_error = left('400:' || coalesce(v_body->>'error', r.content, ''), 300)
       where id = r.id and status = 'dispatched';
    elsif r.status_code = 409 and v_body->>'resendCode' = 'concurrent_idempotent_requests' and v_same then
      -- Τρέχει ακόμη η πρώτη με το ίδιο κλειδί. Ξανά αργότερα, ίδιο κλειδί: ο
      -- Resend θα γυρίσει την απάντησή της.
      update public.email_outbox
         set status = 'pending', request_id = null,
             scheduled_for = now() + interval '5 minutes' + v_jitter,
             idem_uncertain = true, last_error = 'idempotency:concurrent'
       where id = r.id and status = 'dispatched';
    elsif r.status_code = 409 then
      -- Το κλειδί το έχει ήδη δει ο Resend: το email πιθανότατα έφυγε. ΟΧΙ
      -- failed (δεν είναι αποτυχία) και ΟΧΙ επανάληψη (θα ήταν διπλό). Μετρά
      -- στο όριο μάρκετινγκ και φαίνεται στην email_outbox_health().
      update public.email_outbox
         set status = 'probably_sent', sent_at = coalesce(r.idem_since, r.dispatched_at),
             last_error = left('idempotency:' || coalesce(nullif(v_body->>'resendCode', ''), 'unknown'), 300)
       where id = r.id and status = 'dispatched';
    elsif r.status_code between 200 and 299 then
      -- 2xx ΧΩΡΙΣ αναγνωρίσιμο σώμα: ίσως έφυγε. Οχι επανάληψη, όχι διπλό email.
      update public.email_outbox
         set status = 'failed', idem_uncertain = true,
             last_error = left('unexpected_2xx:' || coalesce(r.content, ''), 300)
       where id = r.id and status = 'dispatched';
    elsif r.attempts < v_max and coalesce(v_body->>'definite', '') = 'true' and not r.idem_uncertain then
      -- ΣΙΓΟΥΡΗ αποτυχία (ο Resend απάντησε λάθος ή λείπει το κλειδί του) και
      -- καμία προηγούμενη προσπάθεια της γενιάς δεν ήταν αβέβαιη: τίποτα δεν
      -- έφυγε. Νέα γενιά κλειδιού, ώστε μια απάντηση λάθους που ίσως κράτησε
      -- ο Resend να μην ξαναπαιχτεί· νέο παράθυρο 24 ωρών.
      update public.email_outbox
         set status = 'pending', request_id = null,
             idem_gen = idem_gen + 1, idem_since = null,
             scheduled_for = now() + make_interval(mins => 15 * r.attempts) + v_jitter,
             last_error = v_why
       where id = r.id and status = 'dispatched';
    elsif v_same and coalesce(v_body->>'definite', '') = 'true' then
      -- Σίγουρη αποτυχία ΤΩΡΑ, αλλά μια παλιότερη προσπάθεια της γενιάς ίσως
      -- έφυγε: νέο κλειδί θα μπορούσε να στείλει δεύτερο email. Ιδιο κλειδί.
      update public.email_outbox
         set status = 'pending', request_id = null,
             scheduled_for = now() + make_interval(mins => 15 * r.attempts) + v_jitter,
             last_error = v_why
       where id = r.id and status = 'dispatched';
    elsif v_same then
      -- ΑΒΕΒΑΙΗ έκβαση (λήξη χρόνου, σφάλμα δικτύου, 5xx χωρίς `definite`):
      -- ίσως έφυγε. Ιδιο κλειδί μέσα στο παράθυρο. Η σημαία μένει.
      update public.email_outbox
         set status = 'pending', request_id = null,
             scheduled_for = now() + make_interval(mins => 15 * r.attempts) + v_jitter,
             idem_uncertain = true, last_error = v_why
       where id = r.id and status = 'dispatched';
    else
      -- Τέλος προσπαθειών ή παραθύρου. Χωρίς νέα γενιά. Αν αυτή η τελευταία
      -- έκβαση ήταν αβέβαιη, η σημαία μένει και η γραμμή μετρά στο όριο.
      update public.email_outbox
         set status = 'failed',
             idem_uncertain = idem_uncertain or coalesce(v_body->>'definite', '') <> 'true',
             last_error = left(
               case when r.attempts >= v_max then 'after ' || r.attempts || ' attempts: '
                    else 'idempotency_window: ' end || v_why, 300)
       where id = r.id and status = 'dispatched';
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
  -- Μετρά ό,τι έφυγε ή ίσως έφυγε: και τις γραμμές με αβέβαιη έκβαση που
  -- περιμένουν επανάληψη, απέτυχαν ή έληξαν.
  select coalesce(
    (select max(coalesce(sent_at, dispatched_at))
       from public.email_outbox
      where to_email = lower(trim(p_to_email)) and category = 'marketing'
        and (status in ('sent', 'dispatched', 'probably_sent')
             or (idem_uncertain and status in ('pending', 'failed', 'expired'))))
      < now() - interval '3 days',
    true);
$function$;

-- ── 3α. Η ακύρωση πιάνει και ό,τι είναι σε πτήση ──────────────────────────
-- Ιδιοι ορισμοί με το 20261021120000, με μία διαφορά: `status in ('pending',
-- 'dispatched')`. Η γραμμή σε πτήση γίνεται skipped, οπότε η reconcile (που
-- ρωτά `status = 'dispatched'`) δεν την ξαναβάζει στην ουρά μετά από 5xx. Αν
-- το πρώτο αίτημα έφυγε ήδη, αυτό δεν αναιρείται· η επανάληψη όμως κόβεται.
create or replace function public.accountant_invite_withdraw(p_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  update accountant_invites set status = 'withdrawn', answered_at = now()
   where id = p_id and accountant_id = v_me and status = 'sent'
  returning id into v_id;
  if v_id is null then return json_build_object('ok', false, 'reason', 'invalid'); end if;

  update email_outbox
     set status = 'skipped',
         last_error = case when status = 'dispatched' then 'withdrawn:in_flight' else 'withdrawn' end
   where copy_id = 'accountant_invite' and status in ('pending', 'dispatched')
     and dedup_key like 'accountant_invite:' || v_id::text || ':%';

  return json_build_object('ok', true, 'status', 'withdrawn');
end $$;

alter function public.accountant_invite_withdraw(uuid) owner to postgres;
revoke all     on function public.accountant_invite_withdraw(uuid) from public, anon;
grant  execute on function public.accountant_invite_withdraw(uuid) to authenticated;

create or replace function private.accountant_invites_forget_email()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare v_email text := lower(btrim(coalesce(old.email, '')));
begin
  if v_email <> '' then
    delete from public.accountant_invites where email = v_email;
    update public.email_outbox
       set status     = case when status in ('pending', 'dispatched') then 'skipped' else status end,
           last_error = case when status in ('pending', 'dispatched') then 'sender_erased' else last_error end,
           params     = params - 'accountantEmail' - 'accountantName'
     where copy_id = 'accountant_invite'
       and lower(btrim(coalesce(params->>'accountantEmail', ''))) = v_email;
  end if;
  return old;
end $$;

alter function private.accountant_invites_forget_email() owner to postgres;
revoke all on function private.accountant_invites_forget_email() from public, anon, authenticated;

-- ── 3β. Η παρακολούθηση ──────────────────────────────────────────────────
-- Οι καταστάσεις της ουράς στο τελευταίο 24ωρο. Τα `probably_sent` δεν είναι
-- αποτυχίες, αλλά πολλά μαζί σημαίνουν ότι κάτι ξαναστέλνει με το ίδιο κλειδί.
create or replace function public.email_outbox_health()
 returns table (status text, n integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select o.status, count(*)::int
    from public.email_outbox o
   where coalesce(o.dispatched_at, o.created_at) > now() - interval '24 hours'
   group by o.status
   order by o.status;
$function$;

revoke all on function public.email_outbox_health() from public, anon, authenticated;
grant execute on function public.email_outbox_health() to service_role;

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
