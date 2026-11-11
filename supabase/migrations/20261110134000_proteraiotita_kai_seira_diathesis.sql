-- ═══════════════════════════════════════════════════════════════════════════
-- ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΗΝ ΥΠΟΣΤΗΡΙΞΗ ΚΑΙ ΣΕΙΡΑ ΔΙΑΘΕΣΗΣ, ΜΕ ΜΗΧΑΝΙΣΜΟ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: οι Όροι χρήσης (app/terms/page.tsx), ενότητες «Προτεραιότητα στις νέες
-- δυνατότητες» και «Υποστήριξη»:
--   · «Οι συνδρομητές «Ιδιοκτήτης+», «Επαγγελματίας» και «Επαγγελματίας+» έχουν
--     προτεραιότητα στη σειρά διάθεσης … με πρώτο το «Επαγγελματίας+». Η
--     εφαρμογή κινητού … όταν κυκλοφορήσει, τα πακέτα αυτά θα αποκτήσουν
--     πρόσβαση ${EARLY_ACCESS_DAYS} ημέρες νωρίτερα από τους υπόλοιπους.»
--   · «Ο συνεργάτης έχει επίσης προτεραιότητα στη σειρά διάθεσης.»
--   · Η δοκιμή έχει τις δυνατότητες του «Ιδιοκτήτης+» και σε αυτές το plans.ts
--     γράφει τις «Νέες δυνατότητες νωρίτερα». Γι' αυτό η σειρά κρίνεται με την
--     ίδια την `public.user_plan_rank`, που μετρά δοκιμή, δωρεάν μήνες, κράτηση
--     υποβάθμισης και Συνεργάτη, όπως το effectivePlan του entitlements.ts.
--   · «Στο πακέτο «Επαγγελματίας+» η «Προτεραιότητα στο email» σημαίνει ότι τα
--     μηνύματά σου στη διεύθυνση αυτή απαντώνται πριν από τα υπόλοιπα.»
--
-- ΤΙ ΠΡΟΣΘΕΤΕΙ:
--   1. early_access_days() και office_lead_days(): οι ίδιες σταθερές με τα
--      EARLY_ACCESS_DAYS (entitlements.ts) και OFFICE_LEAD_DAYS (rollout.ts).
--      Το rollout.test.ts κοκκινίζει αν διαφέρουν.
--   2. support_rank_for_email(email): το επίπεδο του From ενός μηνύματος. ΔΕΝ
--      είναι ταυτότητα (το From δεν επαληθεύεται), γι' αυτό το support_inbox
--      γράφει `priority_claimed` και `sender_verified`, χωριστά.
--   3. support_inbox: ένα μήνυμα υποστήριξης ανά `provider_id`, με την
--      κατάσταση της προώθησης (pending → sent | failed | skipped), το ακριβές
--      σώμα της πρώτης προσπάθειας, τη γενιά του κλειδιού και τις προσπάθειες.
--      Δέσμευση, αποτέλεσμα και λήξη: support_forward_claim / _settle / _expire,
--      cron κάθε 10 λεπτά (app/api/support/forward), υγεία: support_inbox_health.
--   4. Η ειδοποίηση της εφαρμογής κινητού σε τρία κύματα, που τα επιβάλλει η
--      βάση (release_waves, mobile_launch_claim, mobile_launch_settle):
--        first    : «Επαγγελματίας+»
--        priority : από «Ιδιοκτήτης+» (και Συνεργάτες), office_lead_days()
--                   μετά την έναρξη του first
--        everyone : όλοι, early_access_days() μετά την έναρξη του priority
--      Οι γραμμές δεσμεύονται πριν από την αποστολή (`notifying_at`, `for update
--      skip locked`, λήξη 15 λεπτών), ώστε δύο ταυτόχρονες κλήσεις να μη
--      στέλνουν διπλά. Οι μόνιμες αποτυχίες σημειώνονται (`failed_at`) και δεν
--      ξαναβγαίνουν· οι προσωρινές πάνε στο τέλος της ουράς (`fail_count`) και
--      μετά από πέντε γίνονται μόνιμες.
--   5. mobile_access(): το κλείδωμα της εφαρμογής κινητού, με τα ίδια κύματα.
--   6. support_submit(): η φόρμα υποστήριξης της εφαρμογής, με αποστολέα τον
--      χρήστη που επαλήθευσε η διαδρομή (sender_verified = true), όριο ρυθμού
--      ανά χρήστη χωρίς αγώνα και αποτροπή διπλού μηνύματος.
--   7. join_mobile_waitlist(): όποιος ξαναμπαίνει ξεκινά χωρίς παλιές αποτυχίες.
--
-- Μόνο για τον ρόλο υπηρεσίας, εκτός από τα 5 και 7, που τα καλεί ο
-- συνδεδεμένος χρήστης, κρίνουν με το auth.uid() και περνούν το δεύτερο βήμα.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.early_access_days()
returns integer
language sql
immutable
set search_path to 'public'
as $$ select 15 $$;

create or replace function public.office_lead_days()
returns integer
language sql
immutable
set search_path to 'public'
as $$ select 1 $$;

-- Ο ΑΠΟΣΤΟΛΕΑΣ ΕΙΝΑΙ ΜΟΝΟ ΜΙΑ ΔΙΕΥΘΥΝΣΗ. Ιδιος κανόνας εύρεσης με τη
-- name_for_email: επιβεβαιωμένο email, χωρίς διάκριση πεζών. Αγνωστος → 0.
create or replace function public.support_rank_for_email(p_email text)
returns integer
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid;
begin
  select u.id into v_uid
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.email_confirmed_at is not null
   limit 1;
  if v_uid is null then return 0; end if;
  return public.user_plan_rank(v_uid);
end;
$$;

create table if not exists public.support_inbox (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text not null unique,
  -- Ο λογαριασμός με το ίδιο επιβεβαιωμένο email, αν υπάρχει. Δύο στήλες γιατί
  -- η διαγραφή λογαριασμού δεν κάνει το ίδιο σε όλα τα μηνύματα:
  --   user_id  (support, φόρμα): φεύγουν μαζί του (έλεγχος του 20260818100000).
  --   kept_for (privacy@, security@): η γραμμή μένει ως ίχνος του αιτήματος,
  --            χωρίς σύνδεση με τον λογαριασμό. ΣΗΜΕΙΟ ΓΙΑ ΝΟΜΙΚΟ ΕΛΕΓΧΟ: η
  --            διεύθυνση από την οποία ήρθε το αίτημα μένει (άρθ. 6§1γ ΓΚΠΔ,
  --            απόδειξη ότι το αίτημα παραλήφθηκε και απαντήθηκε).
  user_id          uuid references auth.users(id) on delete cascade,
  kept_for         uuid references auth.users(id) on delete set null,
  from_email       text not null,
  subject          text,
  kind             text not null default 'support',
  plan_rank        integer not null default 0,
  priority_claimed boolean not null default false,
  sender_verified  boolean not null default false,
  -- ── Η ΠΡΟΩΘΗΣΗ ΣΤΟ INBOX (lib/support/forwarder.ts) ──────────────────────
  -- pending → sent | failed | skipped (αυτόματος αποστολέας).
  forward_state    text not null default 'pending'
                   check (forward_state in ('pending', 'sent', 'failed', 'skipped')),
  forwarded_at     timestamptz,
  -- Το ΑΚΡΙΒΕΣ θέμα και reply_to της πρώτης προσπάθειας: κάθε επανάληψη στέλνει
  -- το ίδιο σώμα, αλλιώς ο πάροχος απαντά 409 invalid_idempotent_request.
  forward_subject  text,
  reply_to         text,
  -- Σίγουρες αποτυχίες λόγω του ίδιου του μηνύματος (4xx εκτός 401/403/429 και
  -- 422 ρύθμισης). Στις 3 γίνεται failed. Λάθη ρύθμισης και προσωρινά δεν μετρούν.
  forward_attempts integer not null default 0,
  -- Η γενιά του Idempotency-Key (όπως στην email_outbox, 20261110132000). Αλλάζει
  -- μόνο μετά από σίγουρη αποτυχία και μόνο αν καμία προσπάθεια της γενιάς δεν
  -- ήταν αβέβαιη (`forward_uncertain`), αλλιώς νέο κλειδί θα έστελνε δεύτερο μήνυμα.
  forward_gen      integer not null default 0,
  forward_uncertain boolean not null default false,
  next_attempt_at  timestamptz not null default now(),
  forward_claimed_at timestamptz,
  -- Ο κωδικός της τελευταίας αποτυχίας (`config:401`, `message:422`, `503`,
  -- `network`, `expired`), ή `uncertain` για τη φόρμα. Ποτέ δεδομένα χρήστη.
  forward_error    text,
  -- Φόρμα: χρήστης και hash του κειμένου. Το ίδιο μήνυμα μέσα σε 24 ώρες δεν
  -- ξαναστέλνεται (ίδιο Idempotency-Key στον πάροχο).
  dedupe_key       text,
  received_at      timestamptz not null default now()
);
-- ΒΑΣΗ ΠΟΥ ΕΧΕΙ ΗΔΗ ΠΑΛΙΟΤΕΡΗ ΕΚΔΟΧΗ ΤΟΥ ΠΙΝΑΚΑ. Το staging πήρε το πρώτο σχέδιο
-- αυτής της μετάβασης από την ώθηση του κλαδιού (Supabase deploy, 10/11/2026) και
-- το `create table if not exists` από πάνω δεν πρόσθετε στήλες: η επόμενη ώθηση
-- έσκαγε στο `create index … (kept_for)`. Κάθε στήλη ορίζεται και εδώ, ώστε η
-- μετάβαση να φτάνει στο ίδιο σχήμα από όποια προηγούμενη εκδοχή. Οι στήλες του
-- πρώτου σχεδίου που δεν υπάρχουν πια (`priority`, `forwarded`) φεύγουν.
alter table public.support_inbox
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists kept_for uuid references auth.users(id) on delete set null,
  add column if not exists priority_claimed boolean not null default false,
  add column if not exists sender_verified boolean not null default false,
  add column if not exists forward_state text not null default 'pending',
  add column if not exists forwarded_at timestamptz,
  add column if not exists forward_subject text,
  add column if not exists reply_to text,
  add column if not exists forward_attempts integer not null default 0,
  add column if not exists forward_gen integer not null default 0,
  add column if not exists forward_uncertain boolean not null default false,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists forward_claimed_at timestamptz,
  add column if not exists forward_error text,
  add column if not exists dedupe_key text,
  drop column if exists priority,
  drop column if exists forwarded;
alter table public.support_inbox drop constraint if exists support_inbox_forward_state_check;
alter table public.support_inbox add constraint support_inbox_forward_state_check
  check (forward_state in ('pending', 'sent', 'failed', 'skipped'));
delete from public.support_inbox where provider_id is null;
alter table public.support_inbox alter column provider_id set not null;
drop index if exists public.support_inbox_order_idx;

alter table public.support_inbox enable row level security;
revoke all on public.support_inbox from public, anon, authenticated;
-- Η σειρά απάντησης: πρώτα όσα επαληθεύτηκαν με προτεραιότητα, μετά οι πιθανές.
create index if not exists support_inbox_order_idx
  on public.support_inbox (sender_verified desc, priority_claimed desc, plan_rank desc, received_at);

create index if not exists support_inbox_user_idx on public.support_inbox (user_id);
create index if not exists support_inbox_kept_idx on public.support_inbox (kept_for);
create index if not exists support_inbox_dedupe_idx on public.support_inbox (dedupe_key, received_at);
create index if not exists support_inbox_due_idx
  on public.support_inbox (next_attempt_at) where forward_state = 'pending';

-- Ο ΛΟΓΑΡΙΑΣΜΟΣ ΤΟΥ ΑΠΟΣΤΟΛΕΑ ΜΠΑΙΝΕΙ ΑΠΟ ΤΗ ΒΑΣΗ, ΟΧΙ ΑΠΟ ΤΗΝ ΕΦΑΡΜΟΓΗ, με τον
-- ίδιο κανόνα εύρεσης με τη support_rank_for_email.
create or replace function public.support_inbox_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid;
begin
  v_uid := new.user_id;
  if v_uid is null then
    select u.id into v_uid
      from auth.users u
     where lower(u.email) = lower(trim(new.from_email))
       and u.email_confirmed_at is not null
     limit 1;
  end if;
  if new.kind in ('privacy', 'security') then
    new.kept_for := v_uid; new.user_id := null;
  else
    new.user_id := v_uid; new.kept_for := null;
  end if;
  return new;
end;
$$;
revoke all on function public.support_inbox_owner() from public, anon, authenticated;
drop trigger if exists support_inbox_owner on public.support_inbox;
create trigger support_inbox_owner before insert on public.support_inbox
  for each row execute function public.support_inbox_owner();

create table if not exists public.release_waves (
  feature     text not null,
  wave        text not null check (wave in ('first', 'priority', 'everyone')),
  started_at  timestamptz not null default now(),
  primary key (feature, wave)
);
-- Το πρώτο σχέδιο είχε δύο κύματα (priority, everyone)· τώρα τρία.
alter table public.release_waves drop constraint if exists release_waves_wave_check;
alter table public.release_waves add constraint release_waves_wave_check
  check (wave in ('first', 'priority', 'everyone'));
alter table public.release_waves enable row level security;
revoke all on public.release_waves from public, anon, authenticated;

alter table public.mobile_waitlist
  add column if not exists notifying_at timestamptz,
  add column if not exists fail_count   integer not null default 0,
  add column if not exists failed_at    timestamptz;

-- ΣΥΝΑΡΤΗΣΕΙΣ ΤΩΝ ΠΡΟΗΓΟΥΜΕΝΩΝ ΣΧΕΔΙΩΝ. Αν κάποια βάση πήρε προηγούμενη εκδοχή
-- αυτής της μετάβασης, οι παλιές υπογραφές θα έμεναν δίπλα στις νέες, κάποιες
-- εκτελέσιμες από τον χρήστη. Φεύγουν ρητά.
drop function if exists public.user_release_rank(uuid);
drop function if exists public.mobile_launch_wave(text, text, integer);
drop function if exists public.mobile_launch_settle(uuid[], uuid[], uuid[]);
drop function if exists public.support_submit(text);
drop function if exists public.support_withdraw(uuid);

-- ΔΕΣΜΕΥΣΗ ΓΡΑΜΜΩΝ ΓΙΑ ΕΝΑ ΚΥΜΑ. Επιστρέφει έως p_limit παραλήπτες, ήδη
-- δεσμευμένους (`notifying_at = now()`). Το κύμα που δεν έχει έρθει η ώρα του
-- σηκώνει `early_access_window`.
create or replace function public.mobile_launch_claim(p_wave text, p_limit integer)
returns table (user_id uuid, email text, plan_rank integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_min int;
  v_prev text;
  v_gap int;
  v_started timestamptz;
begin
  if p_wave = 'first' then
    v_min := public.plan_rank('office'); v_prev := null;
  elsif p_wave = 'priority' then
    v_min := public.plan_rank('owner'); v_prev := 'first'; v_gap := public.office_lead_days();
  elsif p_wave = 'everyone' then
    v_min := 0; v_prev := 'priority'; v_gap := public.early_access_days();
  else
    raise exception 'unknown_wave' using errcode = '22023';
  end if;

  if v_prev is not null then
    select rw.started_at into v_started
      from release_waves rw where rw.feature = 'mobile_app' and rw.wave = v_prev;
    if v_started is null or v_started > now() - (v_gap || ' days')::interval then
      raise exception 'early_access_window' using errcode = 'P0001';
    end if;
  end if;

  insert into release_waves (feature, wave) values ('mobile_app', p_wave)
    on conflict (feature, wave) do nothing;

  return query
    with picked as (
      select w.user_id, public.user_plan_rank(w.user_id) as r
        from mobile_waitlist w
       where w.notified_at is null and w.failed_at is null and w.email is not null
         and (w.notifying_at is null or w.notifying_at < now() - interval '15 minutes')
         and public.user_plan_rank(w.user_id) >= v_min
       order by w.fail_count, r desc, w.created_at
       limit greatest(1, least(p_limit, 500))
       for update of w skip locked
    )
    update mobile_waitlist m set notifying_at = now()
      from picked
     where m.user_id = picked.user_id
    returning m.user_id, m.email, picked.r;
end;
$$;

-- ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΤΗΣ ΑΠΟΣΤΟΛΗΣ. Επιστρέφει πόσοι περιμένουν ακόμη σε όλη τη λίστα.
--   p_failed : μόνιμη αποτυχία ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ (bounce, suppressed)· δεν ξαναβγαίνει.
--   p_retry  : προσωρινή (δίκτυο, 5xx, 429)· στο τέλος της ουράς, μόνιμη μετά από 5.
--   p_release: δεν δοκιμάστηκε επειδή η εκτέλεση σταμάτησε σε λάθος ρύθμισης δικό
--              μας (401, 403, 422)· η δέσμευση λύνεται χωρίς καμία χρέωση.
create or replace function public.mobile_launch_settle(p_sent uuid[], p_failed uuid[], p_retry uuid[], p_release uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_left int;
begin
  update mobile_waitlist set notified_at = now(), notifying_at = null
   where user_id = any(coalesce(p_sent, '{}'));
  update mobile_waitlist set failed_at = now(), notifying_at = null, fail_count = fail_count + 1
   where user_id = any(coalesce(p_failed, '{}'));
  update mobile_waitlist set notifying_at = null, fail_count = fail_count + 1,
         failed_at = case when fail_count + 1 >= 5 then now() end
   where user_id = any(coalesce(p_retry, '{}'));
  update mobile_waitlist set notifying_at = null
   where user_id = any(coalesce(p_release, '{}'));
  select count(*) into v_left from mobile_waitlist
   where notified_at is null and failed_at is null and email is not null;
  return v_left;
end;
$$;

-- ── Η ΕΦΑΡΜΟΓΗ ΚΙΝΗΤΟΥ ΑΝΟΙΓΕΙ ΜΕ ΤΗ ΣΕΙΡΑ ΤΩΝ ΚΥΜΑΤΩΝ ───────────────────────
-- Απόφαση ιδιοκτήτη (10/11/2026): οι συνδρομητές προτεραιότητας και οι
-- Συνεργάτες παίρνουν την εφαρμογή νωρίτερα, με κλείδωμα μέσα στην εφαρμογή.
-- Η εφαρμογή ρωτά αυτή τη συνάρτηση με τη συνεδρία του χρήστη:
--   { open: true,  wave }                        το κύμα του έχει ανοίξει
--   { open: false, wave, opens_at }              όχι ακόμη· opens_at η νωρίτερη
--                                                μέρα, ή null αν δεν έχει ξεκινήσει
--                                                ούτε το προηγούμενο κύμα
-- Το κύμα κρίνεται με την user_plan_rank (δοκιμή, δωρεάν μήνες, Συνεργάτης) τη
-- στιγμή της ερώτησης, όπως και η αποστολή της ειδοποίησης.
create or replace function public.mobile_access()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_rank int;
  v_wave text;
  v_prev text;
  v_gap int;
  v_started timestamptz;
  v_prev_started timestamptz;
begin
  if not private.mfa_satisfied() then raise exception 'mfa_required' using errcode = '42501'; end if;
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  v_rank := public.user_plan_rank(v_uid);
  if v_rank >= public.plan_rank('office') then
    v_wave := 'first';
  elsif v_rank >= public.plan_rank('owner') then
    v_wave := 'priority'; v_prev := 'first'; v_gap := public.office_lead_days();
  else
    v_wave := 'everyone'; v_prev := 'priority'; v_gap := public.early_access_days();
  end if;

  select rw.started_at into v_started
    from release_waves rw where rw.feature = 'mobile_app' and rw.wave = v_wave;
  if v_started is not null and v_started <= now() then
    return json_build_object('open', true, 'wave', v_wave);
  end if;

  if v_prev is not null then
    select rw.started_at into v_prev_started
      from release_waves rw where rw.feature = 'mobile_app' and rw.wave = v_prev;
  end if;
  return json_build_object('open', false, 'wave', v_wave,
    'opens_at', case when v_prev_started is null then null
                     else v_prev_started + (v_gap || ' days')::interval end);
end;
$$;

-- ── Η ΦΟΡΜΑ ΥΠΟΣΤΗΡΙΞΗΣ: Ο ΑΠΟΣΤΟΛΕΑΣ ΕΙΝΑΙ Η ΣΥΝΕΔΡΙΑ ───────────────────────
-- Εδώ η προτεραιότητα είναι εγγυημένη: τη διεύθυνση και το πακέτο τα δίνει η
-- βάση από τον χρήστη που επαλήθευσε η διαδρομή (συνεδρία και δεύτερο βήμα,
-- app/api/support), όχι ο αποστολέας. ΜΟΝΟ ο ρόλος υπηρεσίας την καλεί, με
-- ρητό p_user_id· ο έλεγχος του δεύτερου βήματος γίνεται στη διαδρομή.
--
-- ΟΡΙΟ ΡΥΘΜΟΥ ΧΩΡΙΣ ΑΓΩΝΑ: το advisory lock ανά χρήστη σειριοποιεί μέτρηση και
-- εγγραφή, οπότε 50 ταυτόχρονα αιτήματα δίνουν 5 γραμμές, όχι 50.
-- ΙΔΙΟ ΜΗΝΥΜΑ ΜΕΣΑ ΣΕ 24 ΩΡΕΣ (p_dedupe = χρήστης + hash κειμένου): επιστρέφει
-- την υπάρχουσα γραμμή (`duplicate`), ώστε η διαδρομή να μην ξαναστείλει.
-- Το κείμενο ΔΕΝ αποθηκεύεται· η διαδρομή το προωθεί.
create or replace function public.support_submit(p_user_id uuid, p_subject text, p_dedupe text)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text;
  v_rank int;
  v_id uuid;
  v_prev record;
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext('support:' || p_user_id::text));

  select u.email into v_email from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'email_not_confirmed' using errcode = '28000';
  end if;

  select s.id, s.forward_state, s.plan_rank into v_prev
    from support_inbox s
   where s.user_id = p_user_id and s.kind = 'form' and s.dedupe_key = p_dedupe
     and s.received_at > now() - interval '24 hours'
   order by s.received_at desc limit 1;
  if v_prev.id is not null then
    return json_build_object('id', v_prev.id, 'plan_rank', v_prev.plan_rank, 'email', v_email,
                             'duplicate', true, 'forwarded', v_prev.forward_state = 'sent');
  end if;

  if (select count(*) from support_inbox s
       where s.user_id = p_user_id and s.kind = 'form' and s.received_at > now() - interval '1 hour') >= 5
     or (select count(*) from support_inbox s
       where s.user_id = p_user_id and s.kind = 'form' and s.received_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_rank := public.user_plan_rank(p_user_id);
  v_id := gen_random_uuid();
  insert into support_inbox (id, provider_id, user_id, from_email, subject, kind, plan_rank,
                             priority_claimed, sender_verified, dedupe_key, reply_to)
  values (v_id, 'form/' || v_id, p_user_id, v_email, left(coalesce(p_subject, ''), 200), 'form', v_rank,
          v_rank >= public.plan_rank('office'), true, p_dedupe, v_email);
  return json_build_object('id', v_id, 'plan_rank', v_rank, 'email', v_email,
                           'duplicate', false, 'forwarded', false);
end;
$$;

-- Μήνυμα της φόρμας που ΣΙΓΟΥΡΑ δεν έφυγε (429, λάθος ρύθμισης) αποσύρεται, ώστε
-- η νέα προσπάθεια να μη χρεώνεται στο όριο. Μόνο του ίδιου χρήστη, μη προωθημένο.
create or replace function public.support_withdraw(p_user_id uuid, p_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from support_inbox
   where id = p_id and user_id = p_user_id and kind = 'form' and forward_state <> 'sent';
$$;

-- ── Η ΠΡΟΩΘΗΣΗ ΤΩΝ EMAIL ΥΠΟΣΤΗΡΙΞΗΣ: ΔΕΣΜΕΥΣΗ, ΑΠΟΤΕΛΕΣΜΑ, ΛΗΞΗ ──────────────
-- Μία ρουτίνα (lib/support/forwarder.ts) τις καλεί από δύο σημεία: αμέσως, όταν
-- φτάνει το email (app/api/inbound) και από το cron κάθε 10 λεπτά
-- (app/api/support/forward). Τίποτα δεν περιμένει νέο email για να ξαναδοκιμάσει.
create or replace function public.support_forward_claim(p_limit integer, p_provider_id text default null)
returns table (id uuid, provider_id text, reply_to text, forward_subject text, plan_rank integer, forward_gen integer)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
    with picked as (
      select s.id
        from support_inbox s
       where s.forward_state = 'pending' and s.kind <> 'form'
         and s.next_attempt_at <= now()
         and s.received_at >= now() - interval '7 days'
         and (s.forward_claimed_at is null or s.forward_claimed_at < now() - interval '10 minutes')
         and (p_provider_id is null or s.provider_id = p_provider_id)
       order by s.next_attempt_at
       limit greatest(1, least(coalesce(p_limit, 20), 50))
       for update of s skip locked
    )
    update support_inbox m set forward_claimed_at = now()
      from picked
     where m.id = picked.id
    returning m.id, m.provider_id, m.reply_to, m.forward_subject, m.plan_rank, m.forward_gen;
end;
$$;

-- Το αποτέλεσμα μίας προσπάθειας. Επιστρέφει τη νέα κατάσταση· null αν η γραμμή
-- δεν υπάρχει (η διαδρομή απαντά τότε 5xx).
--   sent    : έφυγε.
--   retry   : δίκτυο, 5xx, 429, 409 concurrent· ξανά σε 10 λεπτά, ίδια γενιά.
--   config  : 401, 403, κενή ρύθμιση, 422 για domain/sender· ξανά σε 10 λεπτά,
--             δεν μετρά στις προσπάθειες του μηνύματος.
--   message : 4xx του ίδιου του μηνύματος· +1 προσπάθεια, νέα γενιά (αν καμία
--             προσπάθεια της γενιάς δεν ήταν αβέβαιη), failed στις 3.
create or replace function public.support_forward_settle(p_id uuid, p_outcome text, p_code text, p_uncertain boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_state text;
begin
  if p_outcome not in ('sent', 'retry', 'config', 'message') then
    raise exception 'unknown_outcome' using errcode = '22023';
  end if;
  update support_inbox s set
    forward_claimed_at = null,
    forward_state = case
      when p_outcome = 'sent' then 'sent'
      when p_outcome = 'message' and s.forward_attempts + 1 >= 3 then 'failed'
      else 'pending' end,
    forwarded_at = case when p_outcome = 'sent' then now() else s.forwarded_at end,
    forward_error = case when p_outcome = 'sent' then null else left(p_code, 60) end,
    forward_attempts = s.forward_attempts + (p_outcome = 'message')::int,
    forward_gen = case
      when p_outcome = 'message' and not (s.forward_uncertain or coalesce(p_uncertain, false))
      then s.forward_gen + 1 else s.forward_gen end,
    forward_uncertain = case
      when p_outcome = 'sent' then false
      when p_outcome = 'message' and not (s.forward_uncertain or coalesce(p_uncertain, false)) then false
      else s.forward_uncertain or coalesce(p_uncertain, false) end,
    next_attempt_at = now() + interval '10 minutes'
   where s.id = p_id
  returning s.forward_state into v_state;
  return v_state;
end;
$$;

-- Ό,τι εκκρεμεί πάνω από 7 ημέρες γίνεται failed, ΜΕ αριθμό που ταξιδεύει στην
-- απάντηση του cron και στην ειδοποίηση. Όχι σιωπηλή απώλεια.
create or replace function public.support_forward_expire()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int;
begin
  update support_inbox set forward_state = 'failed', forward_error = 'expired', forward_claimed_at = null
   where forward_state = 'pending' and kind <> 'form' and received_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Για το health-check: πόσα περιμένουν πάνω από μία ώρα, πόσα απέτυχαν σε 24 ώρες.
create or replace function public.support_inbox_health()
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object(
    'stale_pending', count(*) filter (where forward_state = 'pending' and kind <> 'form' and received_at < now() - interval '1 hour'),
    'failed_24h',    count(*) filter (where forward_state = 'failed' and received_at > now() - interval '1 day'))
  from support_inbox;
$$;

revoke all on function public.support_forward_claim(integer, text) from public, anon, authenticated;
revoke all on function public.support_forward_settle(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.support_forward_expire() from public, anon, authenticated;
revoke all on function public.support_inbox_health() from public, anon, authenticated;
grant execute on function public.support_forward_claim(integer, text) to service_role;
grant execute on function public.support_forward_settle(uuid, text, text, boolean) to service_role;
grant execute on function public.support_forward_expire() to service_role;
grant execute on function public.support_inbox_health() to service_role;

-- Το cron της προώθησης: κάθε 10 λεπτά, ίδιο μοτίβο και ίδιο μυστικό με το
-- send-push-daily (20260822090000).
do $$
declare
  v_app text := coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url'),
    'https://property-tan-gamma.vercel.app');
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'support-forward') then perform cron.unschedule('support-forward'); end if;
  perform cron.schedule('support-forward', '*/10 * * * *', format($cron$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object('Content-Type','application/json',
                   'x-cron-secret', (select secret from public.cron_secrets where name = 'email_cron')),
      body    := '{}'::jsonb, timeout_milliseconds := 120000);
  $cron$, v_app || '/api/support/forward'));
end $$;

revoke all on function public.mobile_access() from public, anon;
revoke all on function public.support_submit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.support_withdraw(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mobile_access() to authenticated, service_role;
grant execute on function public.support_submit(uuid, text, text) to service_role;
grant execute on function public.support_withdraw(uuid, uuid) to service_role;

-- ΟΠΟΙΟΣ ΞΑΝΑΜΠΑΙΝΕΙ ΣΤΗ ΛΙΣΤΑ ΞΕΚΙΝΑ ΚΑΘΑΡΑ. Μια παλιά αποτυχία (π.χ. γεμάτο
-- γραμματοκιβώτιο) δεν τον κρατά έξω για πάντα. Ίδιος ορισμός με το
-- 20261003120000, συν τον μηδενισμό των στηλών αποστολής.
create or replace function public.join_mobile_waitlist()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return; end if;
  select email into v_email from auth.users where id = v_uid;

  insert into mobile_waitlist(user_id, email) values (v_uid, v_email)
  on conflict (user_id) do update set email = excluded.email,
    failed_at = null, fail_count = 0, notifying_at = null;

  insert into billing_profiles(user_id, wants_mobile) values (v_uid, true)
  on conflict (user_id) do update set wants_mobile = true;
end; $$;

revoke all on function public.early_access_days() from public, anon, authenticated;
revoke all on function public.office_lead_days() from public, anon, authenticated;
revoke all on function public.support_rank_for_email(text) from public, anon, authenticated;
revoke all on function public.mobile_launch_claim(text, integer) from public, anon, authenticated;
revoke all on function public.mobile_launch_settle(uuid[], uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.early_access_days() to service_role;
grant execute on function public.office_lead_days() to service_role;
grant execute on function public.support_rank_for_email(text) to service_role;
grant execute on function public.mobile_launch_claim(text, integer) to service_role;
grant execute on function public.mobile_launch_settle(uuid[], uuid[], uuid[], uuid[]) to service_role;
grant all on public.support_inbox to service_role;
grant all on public.release_waves to service_role;
