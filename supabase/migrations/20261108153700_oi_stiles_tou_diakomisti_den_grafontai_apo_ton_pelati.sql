-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΣΤΗΛΕΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΕΥΡΗΜΑ. Ο συνδεδεμένος χρήστης, με το δημόσιο κλειδί και ένα σκέτο
-- `PATCH /rest/v1/notification_preferences`, έγραφε μόνος του
-- `reminder_email_verified = 'ξένος@…'` — δηλαδή δήλωνε «επιβεβαιωμένη» μια
-- διεύθυνση που δεν είπε ποτέ «ναι»· η `reminder_recipients()` άρχιζε να
-- στέλνει εκεί υπενθυμίσεις από το δικό μας domain. Το ίδιο με το
-- `reminder_email_token` + `reminder_email_token_at`: έγραφε δικό του
-- διακριτικό και καλούσε την `confirm_reminder_email` με αυτό. Ο κώδικας της
-- εφαρμογής δεν τις στέλνει πια (#491), αλλά η κλειδαριά ανήκει στη ΒΑΣΗ:
-- την κονσόλα του περιηγητή δεν τη διορθώνει κανένα PR.
--
-- ΓΙΑΤΙ ΓΙΝΟΤΑΝ. Ο ρόλος `authenticated` έχει δικαίωμα INSERT/UPDATE σε όλο
-- τον πίνακα και η πολιτική RLS κρίνει ΓΡΑΜΜΕΣ, όχι στήλες: «η γραμμή είναι
-- δική σου» άφηνε να αλλάξει οτιδήποτε μέσα της.
--
-- Η ΣΑΡΩΣΗ. Κοιτάχτηκε κάθε πίνακας του `public` όπου ο `authenticated` έχει
-- δικαίωμα εγγραφής ΚΑΙ μια επιτρεπτική πολιτική εγγραφής. Ό,τι ήταν ήδη
-- κλειστό (πακέτο/δοκιμή/συνδρομή στη `lock_billing_plan`, παράδοση push, τα
-- γεγονότα του εισερχόμενου, η σφραγίδα του Ε2, οι εισαγωγές myAADE, το
-- `send_quota`) μένει όπως είναι. Βρέθηκαν ανοιχτά:
--
--   notification_preferences.reminder_email_verified / _token / _token_at
--       ο πελάτης δήλωνε μόνος του επιβεβαιωμένη διεύθυνση υπενθυμίσεων.
--   billing_profiles.billing_cycle
--       ο κύκλος χρέωσης τον γράφει ο webhook του εμπόρου. Η σκανδάλη δεν τον
--       φύλαγε, ενώ το app/api/billing/plan/route.ts γράφει ότι τον φυλάει.
--   billing_profiles.lapsed_at
--       η αρχή της προθεσμίας διαγραφής λογαριασμού χωρίς συνδρομή. Με
--       `lapsed_at = null` κάθε μέρα, ή μια ημερομηνία του μέλλοντος, το
--       ρολόι δεν έφτανε ποτέ στο τέλος.
--   organization_members.user_id / status / joined_at / role / can_edit /
--   edit_requested_at
--       η αποδοχή πρόσκλησης γίνεται ΜΟΝΟ με την `accept_org_invites_for_me`
--       του ίδιου του προσκεκλημένου. Ο ιδιοκτήτης έγραφε απευθείας
--       `status = 'active', user_id = <ξένος>` και έβαζε άλλον λογαριασμό
--       στην ομάδα του χωρίς να ρωτηθεί· η οθόνη εκείνου γύριζε σε «όψη
--       μέλους» και έχανε τη δική του ομάδα.
--   accountant_requests.accountant_id / item / note / created_at
--       ο ιδιοκτήτης απαντά σε αίτημα (status, resolved_at). Με αλλαγή του
--       `accountant_id` και `status = 'done'`, η σκανδάλη
--       `notify_accountant_request_done` έστελνε μήνυμα με κείμενο της
--       επιλογής του σε ΟΠΟΙΟΝ λογαριασμό ήθελε.
--   accountant_clients.accountant_id / linked_at / claimed_token
--       η σύνδεση με λογιστή γίνεται όταν ΕΚΕΙΝΟΣ δεχτεί. Ο ιδιοκτήτης
--       άλλαζε το `accountant_id` και «συνέδεε» όποιον ήθελε.
--
-- ΤΟ ΜΟΤΙΒΟ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΗ `lock_billing_plan`. Σκανδάλη BEFORE που, όταν
-- γράφει ρόλος πελάτη (`current_user in ('authenticated', 'anon')`), κρατά την
-- παλιά τιμή στο UPDATE και την προεπιλογή στο INSERT. Οι SECURITY DEFINER
-- συναρτήσεις τρέχουν ως ιδιοκτήτης τους (postgres) και ο webhook ως
-- `service_role`: γράφουν όπως πριν. Σιωπηλή αγνόηση, όχι σφάλμα — ένα
-- `upsert({ ...ολόκληρη η γραμμή })` μιας οθόνης δεν σπάει, απλώς δεν αλλάζει
-- αυτό που δεν του ανήκει.
--
-- ΤΙ ΔΕΝ ΚΛΕΙΔΩΘΗΚΕ, ΕΠΙΤΗΔΕΣ. Ό,τι γράφει νόμιμα η οθόνη: προτιμήσεις
-- (`dunning_*`, `share_market_data*`, `wants_mobile`), το εύρος ακινήτων και
-- η ορατότητα οικονομικών του μέλους (OrgTeam, απευθείας UPDATE), η απάντηση
-- στο αίτημα του λογιστή (`status`, `resolved_at`), το κλείδωμα βιβλίων, οι
-- συνδέσεις τραπεζών, τα διακριτικά συνδέσμων που φτιάχνει ο ίδιος για τα
-- δικά του δεδομένα.
--
-- Ελέγχεται στο scripts/db/server-columns-probe.sql, που τρέχει στο db-replay.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η ΕΠΙΒΕΒΑΙΩΣΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΥΠΕΝΘΥΜΙΣΕΩΝ ─────────────────────────
-- Τη γράφουν μόνο η `issue_reminder_email_token` (διακριτικό) και η
-- `confirm_reminder_email` (επιβεβαίωση): SECURITY DEFINER και οι δύο.
--
-- ΤΟ ΟΝΟΜΑ ΜΕΤΡΑΕΙ. Οι σκανδάλες ίδιου χρόνου τρέχουν αλφαβητικά: η
-- `lock_…` πριν από την `trg_reminder_email_reverify`. Πρώτα ξαναμπαίνει η
-- παλιά τιμή, μετά η αλλαγή διεύθυνσης τη σβήνει — όπως πριν.
create or replace function public.lock_reminder_email_verification() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.reminder_email_verified := null;
      new.reminder_email_token    := null;
      new.reminder_email_token_at := null;
    else
      new.reminder_email_verified := old.reminder_email_verified;
      new.reminder_email_token    := old.reminder_email_token;
      new.reminder_email_token_at := old.reminder_email_token_at;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.lock_reminder_email_verification() is
  'Η επιβεβαίωση της διεύθυνσης υπενθυμίσεων και το διακριτικό της γράφονται μόνο από τις issue_reminder_email_token / confirm_reminder_email. Ο πελάτης δεν δηλώνει μόνος του επιβεβαιωμένη διεύθυνση.';

drop trigger if exists lock_reminder_email_verification_trg on public.notification_preferences;
create trigger lock_reminder_email_verification_trg
  before insert or update on public.notification_preferences
  for each row execute function public.lock_reminder_email_verification();

-- ── 2. Ο ΚΥΚΛΟΣ ΧΡΕΩΣΗΣ ΚΑΙ Η ΠΡΟΘΕΣΜΙΑ ΔΙΑΓΡΑΦΗΣ ──────────────────────────
-- Ολόκληρη η σκανδάλη, γιατί η `create or replace` δεν δέχεται προσθήκη
-- γραμμής. Οι δύο νέες γραμμές στο τέλος κάθε σκέλους.
create or replace function public.lock_billing_plan() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'free';
      new.comp_plan := null;
      new.comp_until := null;
      new.comp_months_granted := 0;
      new.comp_started_at := null;
      new.extra_properties := 0;
      new.bonus_properties := 0;
      new.bonus_properties_until := null;
      new.subscription_status := null;
      new.mor_customer_id := null;
      new.mor_subscription_id := null;
      new.mor_variant_id := null;
      new.mor_renews_at := null;
      new.mor_ends_at := null;
      new.mor_event_at := null;
      new.trial_used_at := null;
      new.tester_since := null;
      new.hold_plan := null;
      new.hold_until := null;
      new.billing_cycle := 'monthly';
      new.lapsed_at := null;
    else
      if new.plan is distinct from old.plan then new.plan := old.plan; end if;
      new.comp_plan          := old.comp_plan;
      new.comp_until         := old.comp_until;
      new.comp_months_granted := old.comp_months_granted;
      new.comp_started_at    := old.comp_started_at;
      new.extra_properties   := old.extra_properties;
      new.bonus_properties   := old.bonus_properties;
      new.bonus_properties_until := old.bonus_properties_until;
      new.subscription_status := old.subscription_status;
      new.mor_customer_id    := old.mor_customer_id;
      new.mor_subscription_id := old.mor_subscription_id;
      new.mor_variant_id     := old.mor_variant_id;
      new.mor_renews_at      := old.mor_renews_at;
      new.mor_ends_at        := old.mor_ends_at;
      new.mor_event_at       := old.mor_event_at;
      new.trial_used_at      := old.trial_used_at;
      new.tester_since       := old.tester_since;
      new.hold_plan          := old.hold_plan;
      new.hold_until         := old.hold_until;
      new.billing_cycle      := old.billing_cycle;
      new.lapsed_at          := old.lapsed_at;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.lock_billing_plan() is
  'Κρατά στον διακομιστή κάθε στήλη που δίνει πρόσβαση ή δωρεάν χρήση. Ο χρήστης με το δημόσιο κλειδί δεν μπορεί να γράψει πακέτο, κύκλο χρέωσης, δωρεάν μήνες, κατάσταση συνδρομής, χρήση δοκιμής, ιδιότητα δοκιμαστή, κράτηση υποβάθμισης, ούτε την αρχή της προθεσμίας διαγραφής (lapsed_at).';

-- ── 3. Η ΘΕΣΗ ΣΤΗΝ ΟΜΑΔΑ ΤΗ ΓΡΑΦΟΥΝ ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΤΗΣ ΟΜΑΔΑΣ ──────────────
-- invite_org_member (πρόσκληση, ρόλος), accept_org_invites_for_me (αποδοχή),
-- set_member_edit (δικαίωμα επεξεργασίας), request_member_edit (αίτημα),
-- ensure_organization (ο ιδιοκτήτης). Η οθόνη γράφει απευθείας ΜΟΝΟ
-- `property_scope` και `can_view_financials`, που μένουν ανοιχτά.
create or replace function public.lock_org_member_standing() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.user_id := null;
      new.status := 'invited';
      new.joined_at := null;
      new.role := case when new.role = 'admin' then 'admin' else 'member' end;
      new.can_edit := false;
      new.edit_requested_at := null;
    else
      new.user_id           := old.user_id;
      new.status            := old.status;
      new.joined_at         := old.joined_at;
      new.role              := old.role;
      new.can_edit          := old.can_edit;
      new.edit_requested_at := old.edit_requested_at;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.lock_org_member_standing() is
  'Ποιος είναι μέλος, σε ποια κατάσταση, με ποιον ρόλο και αν επεξεργάζεται: μόνο από τις συναρτήσεις της ομάδας. Ο ιδιοκτήτης δεν βάζει απευθείας ενεργό μέλος χωρίς την αποδοχή του.';

drop trigger if exists lock_org_member_standing_trg on public.organization_members;
create trigger lock_org_member_standing_trg
  before insert or update on public.organization_members
  for each row execute function public.lock_org_member_standing();

-- ── 4. ΤΟ ΑΙΤΗΜΑ ΤΟΥ ΛΟΓΙΣΤΗ: Ο ΙΔΙΟΚΤΗΤΗΣ ΑΠΑΝΤΑ, ΔΕΝ ΤΟ ΞΑΝΑΓΡΑΦΕΙ ──────
-- Ο ιδιοκτήτης έχει μόνο UPDATE (accountant_requests_owner_answer)· το
-- answerRequest του lib/data/accountant.ts γράφει `status` και `resolved_at`.
create or replace function public.lock_accountant_request_facts() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.accountant_id := old.accountant_id;
    new.owner_id      := old.owner_id;
    new.item          := old.item;
    new.note          := old.note;
    new.created_at    := old.created_at;
  end if;
  return new;
end;
$$;

comment on function public.lock_accountant_request_facts() is
  'Ο ιδιοκτήτης απαντά σε αίτημα λογιστή (status, resolved_at). Ποιος ζήτησε, τι και πότε δεν αλλάζει από τον πελάτη: αλλιώς η ειδοποίηση «απαντήθηκε» πήγαινε σε όποιον λογαριασμό ήθελε, με δικό του κείμενο.';

drop trigger if exists lock_accountant_request_facts_trg on public.accountant_requests;
create trigger lock_accountant_request_facts_trg
  before update on public.accountant_requests
  for each row execute function public.lock_accountant_request_facts();

-- ── 5. Η ΣΥΝΔΕΣΗ ΜΕ ΛΟΓΙΣΤΗ: ΤΗΝ ΚΑΝΕΙ Ο ΛΟΓΙΣΤΗΣ ΠΟΥ ΔΕΧΕΤΑΙ ─────────────
-- Ο ιδιοκτήτης έχει UPDATE (accountant_clients_owner_revoke) για να
-- απενεργοποιεί. Το ποιος είναι ο λογιστής δεν είναι δική του εγγραφή.
create or replace function public.lock_accountant_client_link() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.accountant_id := old.accountant_id;
    new.linked_at     := old.linked_at;
    new.claimed_token := old.claimed_token;
  end if;
  return new;
end;
$$;

comment on function public.lock_accountant_client_link() is
  'Ο ιδιοκτήτης ανακαλεί τη σύνδεση με λογιστή· δεν την ξαναστρέφει σε άλλον λογαριασμό που δεν δέχτηκε.';

drop trigger if exists lock_accountant_client_link_trg on public.accountant_clients;
create trigger lock_accountant_client_link_trg
  before update on public.accountant_clients
  for each row execute function public.lock_accountant_client_link();
