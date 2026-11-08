-- ═══════════════════════════════════════════════════════════════════════════
--  ΟΙ ΣΤΗΛΕΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ: Ο ΠΕΛΑΤΗΣ ΔΕΝ ΤΙΣ ΓΡΑΦΕΙ, Η ΝΟΜΙΜΗ ΡΟΗ ΝΑΙ
-- ─────────────────────────────────────────────────────────────────────────
--  Η μετανάστευση 20261108153700 κλειδώνει με σκανδάλες στήλες που γράφει
--  μόνο ο διακομιστής ή η βάση. Εδώ ρωτιέται η ίδια η βάση ως `authenticated`,
--  με τα δικαιώματα που δίνει το Supabase σε κάθε πίνακα, ώστε να κρίνεται η
--  σκανδάλη και όχι ένα `revoke`:
--
--    1. επιβεβαίωση email υπενθυμίσεων: ούτε απευθείας, ούτε με δικό του
--       διακριτικό· η ροή issue → confirm δουλεύει· η αλλαγή διεύθυνσης
--       σβήνει ακόμη την επιβεβαίωση·
--    2. billing_cycle / lapsed_at: αγνοούνται σε INSERT και UPDATE· το όνομα
--       του προφίλ γράφεται κανονικά·
--    3. μέλος ομάδας: ο ιδιοκτήτης δεν βάζει ενεργό μέλος, δεν αλλάζει ρόλο
--       ή δικαίωμα επεξεργασίας· το εύρος και η ορατότητα οικονομικών
--       γράφονται· η αποδοχή του ίδιου του προσκεκλημένου δουλεύει·
--    4. αίτημα λογιστή: ο ιδιοκτήτης απαντά, δεν ξαναγράφει παραλήπτη/κείμενο·
--    5. σύνδεση λογιστή: ο ιδιοκτήτης ανακαλεί, δεν αλλάζει λογιστή.
--
--  Ολα μέσα σε συναλλαγή που ακυρώνεται: η βάση μένει όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
begin;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('probe.uid', true), '')::uuid $$;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

do $probe$
declare
  o  uuid := '5c5c5c5c-0000-4000-8000-0000000000a1';  -- ο ιδιοκτήτης
  x  uuid := '5c5c5c5c-0000-4000-8000-0000000000b1';  -- ξένος λογαριασμός
  l  uuid := '5c5c5c5c-0000-4000-8000-0000000000c1';  -- ο λογιστής
  n  uuid := '5c5c5c5c-0000-4000-8000-0000000000d1';  -- νέος χωρίς προφίλ
  i  uuid := '5c5c5c5c-0000-4000-8000-0000000000e1';  -- ο προσκεκλημένος
begin
  insert into auth.users(id, email) values
    (o, 'owner@cols.test'), (x, 'xenos@cols.test'), (l, 'logistis@cols.test'),
    (n, 'neos@cols.test'), (i, 'invitee@cols.test')
    on conflict (id) do nothing;
  insert into public.billing_profiles(user_id) values (o) on conflict (user_id) do nothing;
  update public.billing_profiles set billing_cycle = 'monthly', lapsed_at = now() - interval '3 days'
   where user_id = o;
  delete from public.billing_profiles where user_id = n;
  insert into public.notification_preferences(user_id, reminder_email)
    values (o, 'allo@cols.test')
    on conflict do nothing;
  update public.notification_preferences
     set reminder_email = 'allo@cols.test', reminder_email_verified = null,
         reminder_email_token = null, reminder_email_token_at = null
   where user_id = o;
  delete from public.notification_preferences where user_id = n;
  -- Ο ιδιοκτήτης έχει «Επαγγελματία» (συνεργάτης), άρα γράφει στην ομάδα του.
  insert into public.referral_partners(user_id) values (o) on conflict do nothing;
  insert into public.organizations(id, owner_user_id, name)
    values ('5c5c5c5c-0000-4000-8000-00000000a0a1', o, 'Γραφείο');
  insert into public.organization_members(org_id, email, role, status)
    values ('5c5c5c5c-0000-4000-8000-00000000a0a1', 'invitee@cols.test', 'member', 'invited');
  insert into public.accountant_clients(accountant_id, owner_id, claimed_token) values (l, o, gen_random_uuid()::text);
  insert into public.accountant_requests(id, accountant_id, owner_id, item)
    values ('5c5c5c5c-0000-4000-8000-0000000000f1', l, o, 'Το Ε9');
end $probe$;

set role authenticated;
set session "probe.uid" = '5c5c5c5c-0000-4000-8000-0000000000a1';

-- ── 1. Η ΕΠΙΒΕΒΑΙΩΣΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΥΠΕΝΘΥΜΙΣΕΩΝ ─────────────────────────
do $probe$
declare
  r record;
  tok uuid := '5c5c5c5c-0000-4000-8000-00000000eeee';
  ok boolean;
begin
  -- Απευθείας «επιβεβαιωμένη».
  update public.notification_preferences
     set reminder_email_verified = 'allo@cols.test'
   where user_id = auth.uid();
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.reminder_email_verified is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης δήλωσε μόνος του επιβεβαιωμένη διεύθυνση υπενθυμίσεων';
  end if;
  -- Δικό του διακριτικό και μετά η επίσημη επιβεβαίωση με αυτό.
  update public.notification_preferences
     set reminder_email_token = tok, reminder_email_token_at = now()
   where user_id = auth.uid();
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.reminder_email_token is not null or r.reminder_email_token_at is not null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης έγραψε δικό του διακριτικό επιβεβαίωσης';
  end if;
  if public.confirm_reminder_email(tok) then
    raise exception 'ΔΙΑΡΡΟΗ: το διακριτικό που έγραψε ο ίδιος ο πελάτης επιβεβαίωσε τη διεύθυνση';
  end if;
  -- Το upsert ολόκληρης γραμμής (όπως το έστελνε η οθόνη πριν από το #491).
  insert into public.notification_preferences(user_id, reminder_email, reminder_email_verified, reminder_email_token, reminder_email_token_at)
    values (auth.uid(), 'allo@cols.test', 'allo@cols.test', tok, now())
    on conflict (user_id) do update
      set reminder_email = excluded.reminder_email,
          reminder_email_verified = excluded.reminder_email_verified,
          reminder_email_token = excluded.reminder_email_token,
          reminder_email_token_at = excluded.reminder_email_token_at;
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.reminder_email_verified is not null or r.reminder_email_token is not null then
    raise exception 'ΔΙΑΡΡΟΗ: το upsert πέρασε επιβεβαίωση ή διακριτικό';
  end if;
  raise notice 'probe: ο πελάτης δεν επιβεβαιώνει μόνος του διεύθυνση υπενθυμίσεων';

  -- Η ΝΟΜΙΜΗ ΡΟΗ: issue_reminder_email_token → confirm_reminder_email.
  select t.token into tok from public.issue_reminder_email_token() t;
  if tok is null then raise exception 'ΡΟΗ: η issue_reminder_email_token δεν έβγαλε διακριτικό'; end if;
  ok := public.confirm_reminder_email(tok);
  select * into r from public.notification_preferences where user_id = auth.uid();
  if not ok or r.reminder_email_verified is distinct from 'allo@cols.test' then
    raise exception 'ΡΟΗ: η επιβεβαίωση μέσω συνάρτησης δεν γράφτηκε (ok=%, verified=%)', ok, r.reminder_email_verified;
  end if;
  -- Μια προτίμηση γράφεται, η επιβεβαίωση μένει.
  update public.notification_preferences set dunning_every_days = 14 where user_id = auth.uid();
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.dunning_every_days <> 14 or r.reminder_email_verified is distinct from 'allo@cols.test' then
    raise exception 'ΡΟΗ: η αλλαγή προτίμησης δεν γράφτηκε ή έσβησε την επιβεβαίωση';
  end if;
  -- Η αλλαγή διεύθυνσης σβήνει ακόμη την επιβεβαίωση.
  update public.notification_preferences set reminder_email = 'trito@cols.test' where user_id = auth.uid();
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.reminder_email_verified is not null then
    raise exception 'ΡΟΗ: η αλλαγή διεύθυνσης δεν ακύρωσε την επιβεβαίωση';
  end if;
  raise notice 'probe: η επιβεβαίωση μέσω συνάρτησης δουλεύει και η αλλαγή διεύθυνσης την ακυρώνει';
end $probe$;

-- ── 2. ΚΥΚΛΟΣ ΧΡΕΩΣΗΣ ΚΑΙ ΠΡΟΘΕΣΜΙΑ ΔΙΑΓΡΑΦΗΣ ─────────────────────────────
do $probe$
declare r record;
begin
  update public.billing_profiles
     set billing_cycle = 'annual', lapsed_at = null, full_name = 'Νέο όνομα'
   where user_id = auth.uid();
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.billing_cycle <> 'monthly' then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης άλλαξε μόνος του τον κύκλο χρέωσης';
  end if;
  if r.lapsed_at is null then
    raise exception 'ΔΙΑΡΡΟΗ: ο πελάτης μηδένισε την προθεσμία διαγραφής του λογαριασμού';
  end if;
  if r.full_name is distinct from 'Νέο όνομα' then
    raise exception 'ΡΟΗ: το όνομα του προφίλ δεν γράφτηκε';
  end if;
end $probe$;

set session "probe.uid" = '5c5c5c5c-0000-4000-8000-0000000000d1';
do $probe$
declare r record;
begin
  insert into public.billing_profiles(user_id, full_name, billing_cycle, lapsed_at)
    values (auth.uid(), 'Νέος', 'annual', now() + interval '50 years');
  select * into r from public.billing_profiles where user_id = auth.uid();
  if r.billing_cycle <> 'monthly' or r.lapsed_at is not null then
    raise exception 'ΔΙΑΡΡΟΗ: το INSERT πέρασε κύκλο χρέωσης ή προθεσμία διαγραφής';
  end if;
  if r.full_name is distinct from 'Νέος' then
    raise exception 'ΡΟΗ: το πρώτο προφίλ δεν γράφτηκε';
  end if;
  insert into public.notification_preferences(user_id, reminder_email, reminder_email_verified)
    values (auth.uid(), 'xeni@cols.test', 'xeni@cols.test');
  select * into r from public.notification_preferences where user_id = auth.uid();
  if r.reminder_email_verified is not null then
    raise exception 'ΔΙΑΡΡΟΗ: το πρώτο INSERT των προτιμήσεων πέρασε επιβεβαιωμένη διεύθυνση';
  end if;
  raise notice 'probe: κύκλος χρέωσης και προθεσμία διαγραφής μένουν στον διακομιστή';
end $probe$;

-- ── 3. ΜΕΛΟΣ ΟΜΑΔΑΣ ─────────────────────────────────────────────────────────
set session "probe.uid" = '5c5c5c5c-0000-4000-8000-0000000000a1';
do $probe$
declare
  org uuid := '5c5c5c5c-0000-4000-8000-00000000a0a1';
  x   uuid := '5c5c5c5c-0000-4000-8000-0000000000b1';
  r record;
begin
  -- Ενεργό μέλος χωρίς αποδοχή.
  insert into public.organization_members(org_id, user_id, email, role, status, joined_at, can_edit)
    values (org, x, 'xenos@cols.test', 'owner', 'active', now(), true);
  select * into r from public.organization_members where org_id = org and email = 'xenos@cols.test';
  if r.user_id is not null or r.status <> 'invited' or r.joined_at is not null
     or r.role <> 'member' or coalesce(r.can_edit, false) then
    raise exception 'ΔΙΑΡΡΟΗ: ο ιδιοκτήτης έβαλε απευθείας μέλος (user_id=%, status=%, role=%, can_edit=%)',
      r.user_id, r.status, r.role, r.can_edit;
  end if;
  -- Ενεργοποίηση με UPDATE.
  update public.organization_members
     set user_id = x, status = 'active', joined_at = now(), role = 'admin', can_edit = true
   where org_id = org and email = 'xenos@cols.test';
  select * into r from public.organization_members where org_id = org and email = 'xenos@cols.test';
  if r.user_id is not null or r.status <> 'invited' or r.role <> 'member' or coalesce(r.can_edit, false) then
    raise exception 'ΔΙΑΡΡΟΗ: ο ιδιοκτήτης ενεργοποίησε μέλος με UPDATE';
  end if;
  -- Ό,τι γράφει η οθόνη (OrgTeam.setMemberScope).
  update public.organization_members
     set property_scope = array['5c5c5c5c-0000-4000-8000-00000000beef']::uuid[], can_view_financials = false
   where org_id = org and email = 'invitee@cols.test';
  select * into r from public.organization_members where org_id = org and email = 'invitee@cols.test';
  if r.can_view_financials or r.property_scope is null then
    raise exception 'ΡΟΗ: το εύρος ή η ορατότητα οικονομικών του μέλους δεν γράφτηκε';
  end if;
  raise notice 'probe: ο ιδιοκτήτης δεν βάζει ενεργό μέλος· εύρος και οικονομικά γράφονται';
end $probe$;

-- Η αποδοχή του ίδιου του προσκεκλημένου.
set session "probe.uid" = '5c5c5c5c-0000-4000-8000-0000000000e1';
do $probe$ begin perform public.accept_org_invites_for_me(); end $probe$;
reset role;
do $probe$
declare r record;
begin
  select * into r from public.organization_members where email = 'invitee@cols.test';
  if r.status <> 'active' or r.user_id is distinct from '5c5c5c5c-0000-4000-8000-0000000000e1'::uuid then
    raise exception 'ΡΟΗ: η αποδοχή πρόσκλησης δεν ενεργοποίησε το μέλος (status=%)', r.status;
  end if;
  raise notice 'probe: η αποδοχή πρόσκλησης από τον ίδιο δουλεύει';
end $probe$;

-- ── 4. ΑΙΤΗΜΑ ΛΟΓΙΣΤΗ ΚΑΙ 5. ΣΥΝΔΕΣΗ ΛΟΓΙΣΤΗ ───────────────────────────────
set role authenticated;
set session "probe.uid" = '5c5c5c5c-0000-4000-8000-0000000000a1';
do $probe$
declare
  l uuid := '5c5c5c5c-0000-4000-8000-0000000000c1';
  x uuid := '5c5c5c5c-0000-4000-8000-0000000000b1';
  r record;
begin
  update public.accountant_requests
     set accountant_id = x, item = 'Πάτα εδώ', status = 'done', resolved_at = now()
   where id = '5c5c5c5c-0000-4000-8000-0000000000f1';
  select * into r from public.accountant_requests where id = '5c5c5c5c-0000-4000-8000-0000000000f1';
  if r.accountant_id <> l or r.item <> 'Το Ε9' then
    raise exception 'ΔΙΑΡΡΟΗ: ο ιδιοκτήτης ξανάγραψε παραλήπτη ή κείμενο του αιτήματος';
  end if;
  if r.status <> 'done' or r.resolved_at is null then
    raise exception 'ΡΟΗ: η απάντηση στο αίτημα δεν γράφτηκε';
  end if;

  update public.accountant_clients set accountant_id = x, active = false where owner_id = auth.uid();
  select * into r from public.accountant_clients where owner_id = auth.uid();
  if r.accountant_id <> l then
    raise exception 'ΔΙΑΡΡΟΗ: ο ιδιοκτήτης έστρεψε τη σύνδεση σε άλλον λογιστή';
  end if;
  if r.active then
    raise exception 'ΡΟΗ: η ανάκληση της σύνδεσης δεν γράφτηκε';
  end if;
  raise notice 'probe: ο ιδιοκτήτης απαντά και ανακαλεί, δεν ξαναγράφει λογιστή';
end $probe$;

reset role;
set session "probe.uid" = '';

-- ── Ο ΔΙΑΚΟΜΙΣΤΗΣ ΓΡΑΦΕΙ ΑΚΟΜΗ ─────────────────────────────────────────────
set role service_role;
do $probe$
declare r record;
begin
  update public.billing_profiles set billing_cycle = 'annual', lapsed_at = null
   where user_id = '5c5c5c5c-0000-4000-8000-0000000000a1';
  select * into r from public.billing_profiles where user_id = '5c5c5c5c-0000-4000-8000-0000000000a1';
  if r.billing_cycle <> 'annual' or r.lapsed_at is not null then
    raise exception 'ΡΟΗ: ο service_role (webhook) δεν γράφει πια κύκλο χρέωσης / προθεσμία';
  end if;
  raise notice 'probe: ο service_role γράφει κανονικά τις στήλες του διακομιστή';
end $probe$;
reset role;

rollback;
