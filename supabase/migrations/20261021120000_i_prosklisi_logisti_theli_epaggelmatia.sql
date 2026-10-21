-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΠΡΟΣΚΛΗΣΗ ΤΟΥ ΛΟΓΙΣΤΗ ΘΕΛΕΙ ΕΠΑΓΓΕΛΜΑΤΙΑ, ΑΛΗΘΙΝΟ ΑΠΟΣΤΟΛΕΑ ΚΑΙ ΜΝΗΜΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: ανεξάρτητος έλεγχος της 21/10/2026 πάνω στο 20261021090000 (#418) και
-- μέτρηση στην παραγωγή την ίδια μέρα (pg_policy, role_table_grants):
--
--   accountant_invites_withdraw  for delete
--       using (accountant_id = auth.uid() and status <> 'accepted')
--   authenticated: DELETE, INSERT, SELECT, UPDATE   (προεπιλεγμένα grants)
--   accountant_invite_clients: καμία πύλη πακέτου (prosrc χωρίς plan_rank)
--
-- ΤΑ ΤΡΙΑ ΣΦΑΛΜΑΤΑ.
--
-- 1. ΟΠΟΙΟΣ ΕΦΤΙΑΧΝΕ ΛΟΓΑΡΙΑΣΜΟ ΕΣΤΕΛΝΕ 50 ΜΗΝΥΜΑΤΑ ΤΗ ΜΕΡΑ ΑΠΟ ΤΟ ΔΙΚΟ ΜΑΣ
--    DOMAIN, με θέμα «<ό,τι γράψει> ζητά πρόσβαση στον φάκελό σου» και κείμενο
--    «Ο λογιστής σου ζητά πρόσβαση». Το όνομα ήταν ελεύθερο κείμενο (80
--    χαρακτήρες από το `billing_profiles`). Ενα «Αποδοχή» άνοιγε ΟΛΟ τον
--    φάκελο: ΑΦΜ, μισθωτήρια, στοιχεία ενοικιαστών. Αυτό είναι εργαλείο
--    ψαρέματος με τη σφραγίδα μας.
--
--    Η ΔΙΟΡΘΩΣΗ. Ο κανόνας του λογιστή δεν ξαναγράφεται: η εφαρμογή δεν έχει
--    ρόλο «λογιστής» στη βάση, έχει τον ΕΠΑΓΓΕΛΜΑΤΙΑ, που κρίνεται από το
--    `PROFESSIONAL_MIN_PLAN` (lib/billing/entitlements.ts) και στη βάση από την
--    ίδια πύλη με την πρόσκληση μέλους ομάδας (`invite_org_member`,
--    20261003140000): `my_plan_rank() >= plan_rank('agency')`, «plan_required»
--    με 42501, αμέσως μετά το δεύτερο βήμα. Η δοκιμή δίνει «Ιδιοκτήτης+»,
--    βαθμό 2: ένας νέος λογαριασμός δεν στέλνει τίποτα. Πρόσκληση με email σε
--    ξένους ανοίγει σε όποιον έχει βαθμό «Επαγγελματίας»: πληρωμένη συνδρομή,
--    ιδιότητα συνεργάτη ή δωρεάν μήνες ΑΥΤΗΣ της βαθμίδας, που κερδίζονται
--    μόνο με συνδρομητές (στόχος `pro_paid`) ή ως συνεργάτης. Ως τώρα οι
--    δωρεάν μήνες έπαιρναν το πακέτο από το `profile_type`, που το αλλάζει ο
--    ίδιος ο χρήστης· αυτό κλείνει στο 5β πιο κάτω.
--    Επιπλέον ο αποστολέας πρέπει να έχει ΕΠΙΒΕΒΑΙΩΜΕΝΗ διεύθυνση
--    (`auth.users.email_confirmed_at`) και αυτή, όχι το όνομα, είναι που
--    ταξιδεύει στο μήνυμα και στην οθόνη του πελάτη.
--
-- 2. ΤΟ «ΟΧΙ» ΣΒΗΝΟΤΑΝ. Η πολιτική διαγραφής άφηνε τον λογιστή να σβήσει τη
--    γραμμή «declined» και να ξαναστείλει την ίδια στιγμή· το ίδιο με τη «sent»
--    για να παρακάμψει τις 7 ημέρες. Η μνήμη ζούσε στη γραμμή που μπορούσε να
--    σβήσει ο ίδιος. Τώρα: καμία εγγραφή, ενημέρωση ή διαγραφή από τον
--    `authenticated`. Η απόσυρση γίνεται με τη `accountant_invite_withdraw`,
--    που ΣΗΜΑΔΕΥΕΙ «withdrawn» μόνο ό,τι είναι «sent», κρατά το `sent_at` (άρα
--    και τις 7 ημέρες) και ακυρώνει το μήνυμα στην ουρά αν δεν έχει φύγει.
--
-- 3. Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ ΑΓΝΩΣΤΟΥ ΕΜΕΝΕ ΓΙΑ ΠΑΝΤΑ. Ο προσκεκλημένος χωρίς
--    λογαριασμό δεν μπορεί να ζητήσει διαγραφή από μια οθόνη που δεν βλέπει.
--    Τώρα: πρόσκληση «sent» ή «withdrawn» πάνω από 90 ημέρες σβήνει κάθε μέρα
--    (`prune_accountant_invites`, pg_cron). Μένουν η «accepted» (ίχνος της
--    σύνδεσης, που ζει στο `accountant_clients`) και η «declined»: είναι η
--    ρητή επιθυμία του προσκεκλημένου να μην ξαναπάρει μήνυμα από αυτόν τον
--    αποστολέα και σβήνει με τον λογαριασμό του (σκανδάλη του 20261021090000).
--    Μετά τις 90 ημέρες η πρόσκληση δεν απαντιέται ούτε φαίνεται, ακόμη κι αν
--    το σκούπισμα δεν έχει τρέξει.
--
-- ΚΑΙ ΕΝΑ ΤΕΤΑΡΤΟ, ΑΣΧΕΤΟ ΜΕ ΤΙΣ ΠΡΟΣΚΛΗΣΕΙΣ (ίδιος έλεγχος, εύρημα E).
--    Το σύνολο του εκκαθαριστικού ΕΝΦΙΑ διαβαζόταν από ΟΠΟΙΟ έγγραφο είχε
--    τίτλο «ΕΝΦΙΑ YYYY» και ποσό· από αυτό ο συγχρονισμός έσβηνε δόσεις.
--    Νέα στήλη `property_documents.statement_total`: αληθής μόνο όταν η σάρωση
--    γράφει το ΣΥΝΟΛΟ του εκκαθαριστικού (lib/billing/documents.ts,
--    `planDocSave`). Οτι γράφτηκε πριν μένει ψευδές: χωρίς σύνολο, δώδεκα
--    δόσεις με σημείωση, όπως ορίζει ο κανόνας «κάθε αμφιβολία προς τις
--    περισσότερες» (lib/calendar/enfiaTotals.ts).
--
-- ΙΔΙΟΔΥΝΑΜΗ. `drop … if exists` πριν από κάθε `create policy`/constraint,
-- `add column if not exists`, `create or replace` με ίδια υπογραφή.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0α. ΠΟΣΟ ΚΡΑΤΙΕΤΑΙ Η ΔΙΕΥΘΥΝΣΗ ΧΩΡΙΣ ΑΠΑΝΤΗΣΗ ───────────────────────────
-- ΕΝΑΣ αριθμός για σκούπισμα, εμφάνιση και απάντηση. Ο ίδιος ζει στο
-- `ACCOUNTANT_INVITE_RETENTION_DAYS` (supabase/functions/_shared/accountantInvite.ts)
-- για το υποσέλιδο του μηνύματος· το emailCopy/accountantInvite.test.ts
-- απαιτεί να συμφωνούν.
create or replace function private.accountant_invite_retention()
 returns interval
 language sql immutable
 set search_path to 'pg_catalog'
as $$ select interval '90 days' $$;

alter function private.accountant_invite_retention() owner to postgres;
revoke all on function private.accountant_invite_retention() from public, anon, authenticated;

-- ── 0. Η ΚΑΤΑΣΤΑΣΗ «withdrawn» ─────────────────────────────────────────────
alter table public.accountant_invites drop constraint if exists accountant_invites_status_known;
alter table public.accountant_invites add constraint accountant_invites_status_known
  check (status in ('sent', 'accepted', 'declined', 'withdrawn'));

create index if not exists accountant_invites_sent_at_idx on public.accountant_invites (sent_at);

-- ── 1. ΚΑΜΙΑ ΓΡΑΦΗ ΑΠΕΥΘΕΙΑΣ ───────────────────────────────────────────────
drop policy if exists accountant_invites_withdraw on public.accountant_invites;
revoke insert, update, delete on public.accountant_invites from authenticated;
revoke all on public.accountant_invites from anon, public;
grant select on public.accountant_invites to authenticated;

-- ── 2. Η ΠΡΟΣΚΛΗΣΗ ──────────────────────────────────────────────────────────
-- Το σώμα είναι αυτό του 20261021090000 με τρεις αλλαγές: η πύλη του πακέτου,
-- η επιβεβαιωμένη διεύθυνση του αποστολέα από το `auth.users` και η απόσυρση
-- που μετρά στις 7 ημέρες όπως η αποστολή.
create or replace function public.accountant_invite_clients(p_emails text[])
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me     uuid := auth.uid();
  v_self   text;
  v_name   text;
  v_raw    text;
  v_email  text;
  v_seen   text[] := '{}';
  v_out    json[] := '{}';
  v_inv    record;
  v_quota  json;
  v_id     uuid;
  v_sent   timestamptz;
  v_n      int := 0;
  v_status text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if public.my_plan_rank() < public.plan_rank('agency') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;

  -- Ο ΑΠΟΣΤΟΛΕΑΣ ΕΙΝΑΙ Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ, ΟΧΙ Ο,ΤΙ ΓΡΑΨΕΙ. Επιβεβαιωμένη, από
  -- τον πίνακα των λογαριασμών: όχι από το διακριτικό, όχι από το προφίλ.
  select lower(btrim(u.email)) into v_self
    from auth.users u where u.id = v_me and u.email_confirmed_at is not null;
  if coalesce(v_self, '') = '' then
    raise exception 'email_unverified' using errcode = '42501';
  end if;

  select left(coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), ''), 80)
    into v_name from billing_profiles bp where bp.user_id = v_me;

  foreach v_raw in array coalesce(p_emails, '{}'::text[]) loop
    v_email := lower(btrim(coalesce(v_raw, '')));
    if v_email = '' then continue; end if;
    v_n := v_n + 1;
    v_sent := null;

    if v_n > 100 then
      v_status := 'over_limit';
    elsif length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_status := 'invalid';
    elsif v_email = any (v_seen) then
      v_status := 'duplicate';
    elsif v_email = v_self then
      v_status := 'self';
    elsif exists (
      select 1 from accountant_clients ac join auth.users u on u.id = ac.owner_id
       where ac.accountant_id = v_me and ac.active and lower(btrim(u.email)) = v_email
         and public.accountant_link_live(v_me, ac.owner_id)
    ) then
      v_status := 'already_client';
    -- ΕΝΑΝΤΙΩΣΗ ΜΕΣΩ ΥΠΟΣΤΗΡΙΞΗΣ (5γ): «όχι» προς όλους τους αποστολείς. Ο
    -- αποστολέας διαβάζει ό,τι και στο «Όχι» του πελάτη· τίποτα παραπάνω.
    -- ΜΕΤΡΑ ΣΤΟ ΟΡΙΟ ΟΠΩΣ ΜΙΑ ΑΠΟΣΤΟΛΗ: αλλιώς ο αποστολέας θα δοκίμαζε δωρεάν
    -- εκατό διευθύνσεις τη φορά για να μάθει ποιες αντιτάχθηκαν.
    elsif exists (select 1 from accountant_invite_optouts o
                   where o.address_sha256 = private.invite_address_sha256(v_email)) then
      v_quota := public.bump_send_quota('accountant_invite', 1, 50, interval '24 hours');
      v_status := case when coalesce((v_quota ->> 'allowed')::boolean, false) then 'declined' else 'rate_limited' end;
    else
      select * into v_inv from accountant_invites where accountant_id = v_me and email = v_email;
      if found and v_inv.status = 'declined' then
        v_status := 'declined';
      -- Η ΑΠΟΣΥΡΣΗ ΔΕΝ ΜΗΔΕΝΙΖΕΙ ΤΙΣ 7 ΗΜΕΡΕΣ. Το `sent_at` μένει όπως ήταν.
      elsif found and v_inv.status in ('sent', 'withdrawn') and v_inv.sent_at > now() - interval '7 days' then
        v_status := 'already_invited'; v_sent := v_inv.sent_at;
      else
        v_quota := public.bump_send_quota('accountant_invite', 1, 50, interval '24 hours');
        if coalesce((v_quota ->> 'allowed')::boolean, false) is not true then
          v_status := 'rate_limited';
        else
          insert into accountant_invites (accountant_id, email, status, sent_at, answered_at)
            values (v_me, v_email, 'sent', now(), null)
          on conflict (accountant_id, email)
            do update set status = 'sent', sent_at = now(), answered_at = null
          returning id, sent_at into v_id, v_sent;

          insert into email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
          values ('accountant_invite', v_email, null,
                  jsonb_build_object(
                    'accountantName', nullif(v_name, ''),
                    'accountantEmail', v_self),
                  'transactional',
                  'accountant_invite:' || v_id::text || ':' || extract(epoch from v_sent)::bigint::text,
                  now())
          on conflict (dedup_key) do nothing;
          v_status := 'sent';
        end if;
      end if;
    end if;

    if v_status <> 'over_limit' and v_status <> 'invalid' then v_seen := v_seen || v_email; end if;
    v_out := v_out || json_build_object('email', v_email, 'status', v_status, 'sentAt', v_sent);
  end loop;

  return array_to_json(v_out);
end $$;

alter function public.accountant_invite_clients(text[]) owner to postgres;
revoke all     on function public.accountant_invite_clients(text[]) from public, anon;
grant  execute on function public.accountant_invite_clients(text[]) to authenticated;

comment on function public.accountant_invite_clients(text[]) is
  'Ο επαγγελματίας (πακέτο «Επαγγελματίας» και πάνω) στέλνει πρόσκληση σε λίστα διευθύνσεων, με αποστολέα την επιβεβαιωμένη διεύθυνσή του. Μία κατάσταση ανά γραμμή, με όριο, χωρίς διπλά και χωρίς να αποκαλύπτει ποια διεύθυνση έχει λογαριασμό.';

-- ── 3. Η ΑΠΟΣΥΡΣΗ ───────────────────────────────────────────────────────────
-- Μόνο «sent», μόνο δική του. Η γραμμή μένει «withdrawn» με το ίδιο `sent_at`
-- και το μήνυμα που δεν έφυγε ακόμη ακυρώνεται. Χωρίς πύλη πακέτου: όπως στην
-- ομάδα, η αφαίρεση δεν θέλει ποτέ συνδρομή.
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

  update email_outbox set status = 'skipped', last_error = 'withdrawn'
   where copy_id = 'accountant_invite' and status = 'pending'
     and dedup_key like 'accountant_invite:' || v_id::text || ':%';

  return json_build_object('ok', true, 'status', 'withdrawn');
end $$;

alter function public.accountant_invite_withdraw(uuid) owner to postgres;
revoke all     on function public.accountant_invite_withdraw(uuid) from public, anon;
grant  execute on function public.accountant_invite_withdraw(uuid) to authenticated;

comment on function public.accountant_invite_withdraw(uuid) is
  'Ο λογιστής παίρνει πίσω πρόσκληση που δεν απαντήθηκε. Η γραμμή μένει «withdrawn» (οι 7 ημέρες μετρούν από την αποστολή) και το μήνυμα που δεν έφυγε ακυρώνεται.';

-- ── 4. Η ΠΛΕΥΡΑ ΤΟΥ ΠΕΛΑΤΗ ──────────────────────────────────────────────────
-- Ποιος ρωτά: η επιβεβαιωμένη διεύθυνση πρώτα (`email`), το όνομα που έγραψε
-- ο ίδιος μόνο δευτερεύον (`name`, κενό αν δεν έγραψε). Καμία πρόσκληση πάνω
-- από 90 ημέρες.
create or replace function public.my_accountant_invites()
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me    uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.email(), '')));
  v_rows  json;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_email = '' then return '[]'::json; end if;

  select coalesce(json_agg(json_build_object(
           'id', i.id,
           'name', left(coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), ''), 80),
           'email', lower(btrim(u.email)),
           'sentAt', i.sent_at
         ) order by i.sent_at desc), '[]'::json)
    into v_rows
    from accountant_invites i
    join auth.users u on u.id = i.accountant_id
    left join billing_profiles bp on bp.user_id = i.accountant_id
   where i.email = v_email and i.status = 'sent' and i.accountant_id <> v_me
     and i.sent_at > now() - private.accountant_invite_retention();

  return v_rows;
end $$;

alter function public.my_accountant_invites() owner to postgres;
revoke all     on function public.my_accountant_invites() from public, anon;
grant  execute on function public.my_accountant_invites() to authenticated;

comment on function public.my_accountant_invites() is
  'Ποιοι ζήτησαν πρόσβαση στη διεύθυνση του συνδεδεμένου χρήστη τις τελευταίες 90 ημέρες και δεν έχουν πάρει απάντηση. Η διεύθυνση του αποστολέα είναι από τον λογαριασμό του· το όνομα είναι δικό του κείμενο.';

-- Το σώμα του 20261021090000 με ένα όριο ακόμη: όχι πάνω από 90 ημέρες.
create or replace function public.accountant_invite_answer(p_id uuid, p_accept boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me    uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.email(), '')));
  v_inv   record;
  v_token text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_email = '' then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  select * into v_inv from accountant_invites
   where id = p_id and email = v_email and status = 'sent'
     and sent_at > now() - private.accountant_invite_retention()
   for update;
  if not found then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_inv.accountant_id = v_me then return json_build_object('ok', false, 'reason', 'self'); end if;

  if not coalesce(p_accept, false) then
    update accountant_invites set status = 'declined', answered_at = now() where id = v_inv.id;
    return json_build_object('ok', true, 'status', 'declined');
  end if;

  select token into v_token from accountant_links
   where user_id = v_me and active = true and (expires_at is null or expires_at > now());
  if v_token is null then return json_build_object('ok', false, 'reason', 'no_link'); end if;

  insert into accountant_clients (accountant_id, owner_id, claimed_token)
    values (v_inv.accountant_id, v_me, v_token)
  on conflict (accountant_id, owner_id)
    do update set active = true, linked_at = now(), claimed_token = excluded.claimed_token;

  update accountant_invites set status = 'accepted', answered_at = now() where id = v_inv.id;
  return json_build_object('ok', true, 'status', 'accepted');
end $$;

alter function public.accountant_invite_answer(uuid, boolean) owner to postgres;
revoke all     on function public.accountant_invite_answer(uuid, boolean) from public, anon;
grant  execute on function public.accountant_invite_answer(uuid, boolean) to authenticated;

-- ── 5. Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ ΑΓΝΩΣΤΟΥ ΔΕΝ ΜΕΝΕΙ ΓΙΑ ΠΑΝΤΑ ────────────────────────
create or replace function public.prune_accountant_invites(p_batch int default 5000)
 returns int
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare v_n int; v_total int := 0;
begin
  loop
    delete from accountant_invites a
     where a.id in (
       select id from accountant_invites
        where status in ('sent', 'withdrawn') and sent_at < now() - private.accountant_invite_retention()
        order by sent_at
        limit greatest(p_batch, 1)
          for update skip locked);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    exit when v_n < greatest(p_batch, 1);
  end loop;
  return v_total;
end $$;

alter function public.prune_accountant_invites(int) owner to postgres;
revoke execute on function public.prune_accountant_invites(int) from public, anon, authenticated;
grant  execute on function public.prune_accountant_invites(int) to service_role;

comment on function public.prune_accountant_invites(int) is
  'Σβήνει τις προσκλήσεις λογιστή που δεν απαντήθηκαν (ή αποσύρθηκαν) πάνω από 90 ημέρες: η διεύθυνση του προσκεκλημένου δεν κρατιέται χωρίς λόγο.';

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το σκούπισμα των προσκλήσεων δεν προγραμματίζεται';
    return;
  end if;
  -- accountant-invites-prune: κάθε μέρα 04:41 UTC, μακριά από το :00.
  if exists (select 1 from cron.job where jobname = 'accountant-invites-prune') then
    perform cron.unschedule('accountant-invites-prune');
  end if;
  perform cron.schedule('accountant-invites-prune', '41 4 * * *', 'select public.prune_accountant_invites()');
end $$;

-- ── 5γ. ΕΝΑΝΤΙΩΣΗ ΧΩΡΙΣ ΛΟΓΑΡΙΑΣΜΟ (2ος έλεγχος, 21/10/2026) ───────────────
-- Το «Όχι» θέλει λογαριασμό· οι προσκλήσεις πηγαίνουν και σε ανθρώπους χωρίς
-- (άρθρα 12§2, 21 ΓΚΠΔ). Οποιος απαντήσει στο μήνυμα ή γράψει στην υποστήριξη
-- μπαίνει εδώ από την ομάδα (`accountant_invite_optout`, μόνο `service_role`)
-- και δεν ξαναπαίρνει πρόσκληση από ΚΑΝΕΝΑΝ αποστολέα.
--
-- ΚΑΜΙΑ ΔΙΕΥΘΥΝΣΗ, ΜΟΝΟ ΑΠΟΤΥΠΩΜΑ. Κρατιέται το SHA-256 της διεύθυνσης σε
-- πεζά: αρκεί για να αναγνωριστεί όταν ξαναγραφτεί. ΔΕΝ είναι ανώνυμο: χωρίς
-- αλάτι, όποιος μαντέψει μια διεύθυνση βρίσκει αν είναι εδώ. Είναι
-- ψευδωνυμοποιημένο προσωπικό δεδομένο (αιτ. 26 ΓΚΠΔ) και φυλάσσεται ως τέτοιο:
-- καμία πρόσβαση εκτός από τον ρόλο υπηρεσίας. Ο πίνακας δεν έχει στήλη email,
-- οπότε ο έλεγχος πληρότητας της διαγραφής (20260818100000) δεν τον αφορά.
-- Μένει επ' αόριστον ακόμη και μετά από διαγραφή λογαριασμού: είναι η απόδειξη της
-- εναντίωσης (άρθρα 17§3, 21 ΓΚΠΔ) και χωρίς αυτήν θα ξαναστελνόταν.
create table if not exists public.accountant_invite_optouts (
  address_sha256 text primary key,
  created_at     timestamptz not null default now()
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'accountant_invite_optouts_hash_shape') then
    alter table public.accountant_invite_optouts add constraint accountant_invite_optouts_hash_shape
      check (address_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $c$;

alter table public.accountant_invite_optouts enable row level security;

drop policy if exists mfa_accountant_invite_optouts on public.accountant_invite_optouts;
create policy mfa_accountant_invite_optouts on public.accountant_invite_optouts as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

revoke all on public.accountant_invite_optouts from public, anon, authenticated;

comment on table public.accountant_invite_optouts is
  'Διευθύνσεις (ως SHA-256 σε πεζά) που ζήτησαν να μην ξαναπάρουν πρόσκληση λογιστή από κανέναν. Τις γράφει μόνο η ομάδα υποστήριξης.';

-- Το αποτύπωμα μιας διεύθυνσης, ο ίδιος κανόνας παντού.
create or replace function private.invite_address_sha256(p_email text)
 returns text
 language sql immutable
 set search_path to 'pg_catalog'
as $$ select encode(sha256(convert_to(lower(btrim(coalesce(p_email, ''))), 'UTF8')), 'hex') $$;

alter function private.invite_address_sha256(text) owner to postgres;
revoke all on function private.invite_address_sha256(text) from public, anon, authenticated;

-- Η υποστήριξη καταχωρεί την εναντίωση. Από εκεί και πέρα η διεύθυνση ΔΕΝ
-- μένει πουθενά στις προσκλήσεις: σβήνουν όλα τα μηνύματα `accountant_invite`
-- προς αυτήν στην ουρά (σταλμένα, ακυρωμένα και εκκρεμή) και οι προσκλήσεις
-- της κάθε αποστολέα εκτός από την αποδεκτή, που είναι ίχνος σύνδεσης
-- λογαριασμού. Ετσι το υποσέλιδο λέει αλήθεια: «κρατάμε μόνο αποτύπωμα».
create or replace function public.accountant_invite_optout(p_email text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_n int;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into accountant_invite_optouts (address_sha256)
    values (private.invite_address_sha256(v_email))
  on conflict (address_sha256) do nothing;
  delete from email_outbox
   where copy_id = 'accountant_invite' and lower(btrim(to_email)) = v_email;
  delete from accountant_invites where email = v_email and status in ('sent', 'withdrawn', 'declined');
  get diagnostics v_n = row_count;
  return json_build_object('ok', true, 'invitesRemoved', v_n);
end $$;

alter function public.accountant_invite_optout(text) owner to postgres;
revoke all     on function public.accountant_invite_optout(text) from public, anon, authenticated;
grant  execute on function public.accountant_invite_optout(text) to service_role;

comment on function public.accountant_invite_optout(text) is
  'Για την υποστήριξη: η διεύθυνση δεν ξαναπαίρνει πρόσκληση λογιστή από κανέναν. Κρατιέται μόνο το αποτύπωμά της· οι ανοιχτές προσκλήσεις της σβήνουν.';

-- ── 5α. Ο ΑΠΟΣΤΟΛΕΑΣ ΦΕΥΓΕΙ ΚΑΙ ΑΠΟ ΤΑ ΜΗΝΥΜΑ ΠΟΥ ΣΤΕΙΛΕ ─────────────────────
-- Η `erase_account` σβήνει από την ουρά ό,τι έχει ΠΑΡΑΛΗΠΤΗ τον χρήστη
-- (`to_email`). Η διεύθυνσή του ως ΑΠΟΣΤΟΛΕΑ προσκλήσεων όμως ζούσε στο
-- `params` μηνυμάτων προς τρίτους. Η σκανδάλη του 20261021090000 πάνω στο
-- `auth.users` (τρέχει και μέσα στην `erase_account`) κάνει τώρα και αυτό: όσα
-- δεν έφυγαν ακυρώνονται και από όλα σβήνουν διεύθυνση και όνομα αποστολέα.
-- Οι προσκλήσεις του φεύγουν ήδη με το cascade του `accountant_id`.
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
       set status     = case when status = 'pending' then 'skipped' else status end,
           last_error = case when status = 'pending' then 'sender_erased' else last_error end,
           params     = params - 'accountantEmail' - 'accountantName'
     where copy_id = 'accountant_invite'
       and lower(btrim(coalesce(params->>'accountantEmail', ''))) = v_email;
  end if;
  return old;
end $$;

alter function private.accountant_invites_forget_email() owner to postgres;
revoke all on function private.accountant_invites_forget_email() from public, anon, authenticated;

-- ── 5β. ΟΙ ΔΩΡΕΑΝ ΜΗΝΕΣ ΔΙΝΟΥΝ ΤΟ ΠΑΚΕΤΟ ΤΗΣ ΑΝΤΑΜΟΙΒΗΣ, ΟΧΙ ΤΟΥ ΠΡΟΦΙΛ ────
-- ΤΟ ΣΦΑΛΜΑ (2ος έλεγχος, 21/10/2026). Η `sync_comp_from_referrals`
-- (20261003120000) έγραφε `comp_plan = 'agency'` σε όποιον είχε
-- `profile_type = 'professional'`, όποια βαθμίδα κι αν είχε η ανταμοιβή. Το
-- `profile_type` το αλλάζει ο ίδιος ο χρήστης (Ρυθμίσεις· η
-- `lock_billing_plan` δεν το κλειδώνει, σωστά, γιατί είναι τρόπος χρήσης) και η
-- `claim_referral_bonus('indiv_volume')` δίνει μήνα «Ιδιοκτήτης+» (`tier`
-- 'owner') με τρεις ενεργοποιημένους δωρεάν φίλους. Δηλαδή: τρεις
-- λογαριασμοί, ένα κουμπί στις Ρυθμίσεις και ένας μήνας «Επαγγελματίας»
-- δωρεάν· μαζί του άνοιγαν οι πύλες της μαζικής πρόσκλησης πιο πάνω, του
-- πελατολογίου και της ομάδας (20261003140000).
--
-- Η ΔΙΟΡΘΩΣΗ. Το πακέτο είναι η ΒΑΘΜΙΔΑ ΤΗΣ ΑΝΤΑΜΟΙΒΗΣ (`referral_rewards.tier`,
-- όπως τη γράφουν η `claim_referral_bonus` και η `reconcile_referral_rewards`
-- και όπως την ορίζει το lib/referral/referral.ts, `SideReward.tier`). Με
-- ανταμοιβές πολλών βαθμίδων μετρά μία, γιατί ο ένας `comp_plan` καλύπτει
-- όλους τους μήνες· η ΥΨΗΛΟΤΕΡΗ, ώστε ένας μήνας «Επαγγελματίας» που
-- κερδήθηκε με πέντε συνδρομητές (`pro_paid`) να μη χαθεί επειδή υπάρχει και
-- ένας παλιός «Ιδιοκτήτης+». Η κατάχρηση μένει κλειστή: τις βαθμίδες τις
-- γράφει μόνο ο διακομιστής και η «agency» κερδίζεται μόνο με συνδρομητές.
--
-- ΡΗΤΗ ΕΠΙΛΟΓΗ, ΠΕΡΙΜΕΝΕΙ ΕΓΚΡΙΣΗ ΙΔΙΟΚΤΗΤΗ. Οι μήνες ΑΘΡΟΙΖΟΝΤΑΙ από όλες τις
-- βαθμίδες (ως 12) και ΟΛΟΙ παίρνουν την υψηλότερη: 11 μήνες «Ιδιοκτήτης+» και
-- ένας «Επαγγελματίας» κάνουν 12 μήνες «Επαγγελματίας». Η εναλλακτική είναι
-- λογαριασμός μηνών ανά βαθμίδα, που θέλει δεύτερο `comp_plan` ή διαδοχικά
-- διαστήματα. Στην παραγωγή δεν υπάρχει σήμερα καμία ανταμοιβή. Το
-- scripts/db/rls-probe.sql καρφώνει την τρέχουσα συμπεριφορά (πλήθος μηνών και
-- βαθμίδα), ώστε η αλλαγή να γίνει μόνο ως απόφαση.
--
-- Αν λείπει η βαθμίδα, «owner». Το υπόλοιπο σώμα είναι αυτούσιο, με το
-- `search_path` καρφωμένο όπως στις υπόλοιπες συναρτήσεις αυτού του αρχείου.
create or replace function public.sync_comp_from_referrals()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := auth.uid();
  v_months int;
  v_slots  int;
  v_target text;
  v_cap    int := 12;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return; end if;

  select coalesce(sum(months) filter (where kind = 'months'), 0),
         coalesce(sum(months) filter (where kind = 'slot'), 0)
    into v_months, v_slots
    from referral_rewards
   where user_id = v_uid;

  select t.tier into v_target
    from (select coalesce(nullif(btrim(rr.tier), ''), 'owner') as tier
            from referral_rewards rr
           where rr.user_id = v_uid and rr.kind = 'months') t
   order by public.plan_rank(t.tier) desc
   limit 1;
  v_target := coalesce(v_target, 'owner');

  v_months := least(v_months, v_cap);
  if v_months > 0 then
    update billing_profiles
       set comp_months_granted = greatest(coalesce(comp_months_granted, 0), v_months),
           comp_started_at     = coalesce(comp_started_at, now()),
           comp_plan           = v_target,
           comp_until          = coalesce(comp_started_at, now())
                                 + (greatest(coalesce(comp_months_granted, 0), v_months) || ' months')::interval
     where user_id = v_uid
       and v_months > coalesce(comp_months_granted, 0);
  end if;

  v_slots := least(v_slots, 500);
  if v_slots > 0 then
    update billing_profiles
       set bonus_properties       = greatest(coalesce(bonus_properties, 0), v_slots),
           bonus_properties_until = greatest(coalesce(bonus_properties_until, now()), now() + interval '1 month')
     where user_id = v_uid
       and v_slots > coalesce(bonus_properties, 0);
  end if;
end;
$$;

-- ── 6. ΤΟ ΣΥΝΟΛΟ ΤΟΥ ΕΚΚΑΘΑΡΙΣΤΙΚΟΥ ΕΝΦΙΑ ΤΟ ΣΗΜΑΔΕΥΕΙ Η ΣΑΡΩΣΗ ──────────────
alter table public.property_documents add column if not exists statement_total boolean not null default false;

comment on column public.property_documents.statement_total is
  'Αληθές μόνο όταν η σάρωση έγραψε στο `amount` το ΣΥΝΟΛΟ του εκκαθαριστικού (ΕΝΦΙΑ). Από αυτό και μόνο μετρά πόσες δόσεις έχει (lib/calendar/enfiaTotals.ts).';
