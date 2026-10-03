-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΠΕΛΑΤΟΛΟΓΙΟ ΚΑΙ Η ΟΜΑΔΑ ΘΕΛΟΥΝ ΤΟ ΠΑΚΕΤΟ ΚΑΙ ΣΤΗ ΒΑΣΗ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΟΘΟΝΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Η καρτέλα «Πελατολόγιο» ανοίγει από το πακέτο «Επαγγελματίας»
-- (lib/billing/entitlements.ts, `TAB_MIN_PLAN.clients`) και η ενότητα
-- «Οργανισμός και ομάδα» από τον τρόπο «Επαγγελματίας», που ο πίνακας δίνει
-- μόνο όσο το ενεργό πακέτο φτάνει το ίδιο όριο (useDashboard, `proEligible`).
-- Και τα δύο λουκέτα ζούσαν ΜΟΝΟ στη React. Ο ίδιος χρήστης με το διακριτικό
-- της συνεδρίας του μιλούσε κατευθείαν στο PostgREST και έγραφε πελάτες,
-- διαμονές, σχόλια και έγγραφα πελατών, έστηνε οργανισμό και προσκαλούσε μέλη
-- με πακέτο «δωρεάν»: οι πολιτικές των πινάκων ρωτούσαν μόνο «είναι δική σου η
-- γραμμή;» και οι συναρτήσεις SECURITY DEFINER της ομάδας μόνο το δεύτερο βήμα.
--
-- Η ΑΠΟΦΑΣΗ (έγκριση ιδιοκτήτη, 03.10.2026). Ο κανόνας της 20260814070000,
-- γραμμένος εκεί για την επωνυμία και τις κινήσεις τράπεζας, ισχύει και εδώ:
--
--     ό,τι έχεις γραμμένο μένει δικό σου·
--     ό,τι ΝΕΟ γράφει η πληρωμένη λειτουργία, θέλει το πακέτο.
--
-- Δηλαδή INSERT και UPDATE θέλουν το πακέτο. SELECT και DELETE μένουν όπως
-- είναι: ο ιδιοκτήτης που κατέβηκε πακέτο εξάγει το πελατολόγιό του, το
-- διαβάζει στις Αποδόσεις και στη Σύγκριση και σβήνει ό,τι θέλει. Η εφαρμογή
-- που κρύβει τα δεδομένα επειδή σταμάτησε η συνδρομή δεν προστατεύει έσοδο,
-- κρατά όμηρο.
--
-- ΠΟΙΟ ΠΑΚΕΤΟ. Το ίδιο με την οθόνη, από τη μία συνάρτηση που ξέρει τη σειρά
-- των πακέτων: `public.plan_rank('agency')`, δηλαδή 3. Ο ίδιος αριθμός ζει ως
-- `PLAN_ORDER.indexOf('agency')` στο lib/billing/plans.ts και το
-- scripts/db-replay.sh ελέγχει σε κάθε τρέξιμο ότι οι δύο σειρές συμφωνούν. Το
-- lib/billing/planGateSql.test.ts διαβάζει ΑΥΤΟ το αρχείο και απαιτεί το πακέτο
-- κάθε πολιτικής να είναι το `requiredPlanForTab('clients')` για το πελατολόγιο
-- και το `PROFESSIONAL_MIN_PLAN` για την ομάδα, ώστε μια αλλαγή στην οθόνη
-- χωρίς αλλαγή εδώ να κοκκινίζει.
--
-- ΠΟΙΟΙ ΠΙΝΑΚΕΣ, ΜΕ ΤΟΝ ΛΟΓΟ ΤΟΥΣ. Από τον κώδικα, όχι από το όνομα:
--
--   clients            Ο πίνακας της καρτέλας. Γράφεται μόνο από το
--                      clients/useClients.ts και από τη Νόα (useAssistantActions,
--                      `registerClient`). Οι αναγνώσεις τύπου 'owner' από τις
--                      Αποδόσεις, τη Σύγκριση και τη Λογιστική μένουν ελεύθερες.
--   client_notes       Το χρονολόγιο του ντοσιέ. Μόνο η καρτέλα το γράφει.
--   client_documents   Τα έγγραφα του επισκέπτη (ταυτότητα, συμβόλαιο). Μόνο η
--                      καρτέλα γράφει τη γραμμή· το αρχείο ζει στο storage.
--   client_stays       Οι διαμονές. Από την οθόνη τις γράφει ΜΟΝΟ η καρτέλα
--                      (lib/data/stays.ts: `add`, `addBatched`, `update`
--                      καλούνται αποκλειστικά από το useClients). Η Τιμολόγηση,
--                      η Πληρότητα, το Ημερολόγιο, το Χαρτοφυλάκιο και η Ε2 τις
--                      ΔΙΑΒΑΖΟΥΝ: ο ιδιώτης δεν γράφει ποτέ διαμονή, γιατί το
--                      `isTabPurchasable(individual, 'clients')` είναι ψευδές
--                      και η καρτέλα δεν του εμφανίζεται καν. Ο συγχρονισμός
--                      iCal (supabase/functions/ical-sync) γράφει με τον ρόλο
--                      υπηρεσίας, που δεν περνά από πολιτικές.
--   organizations      Ο οργανισμός. Γράφεται από τον ιδιοκτήτη του, απευθείας
--                      (πολιτική `org_owner_all`) ή μέσα από τις συναρτήσεις.
--   organization_members
--                      Τα μέλη. Ο ιδιοκτήτης αλλάζει απευθείας εύρος ακινήτων
--                      και ορατότητα οικονομικών (OrgTeam, `setMemberScope`)·
--                      προσκλήσεις και δικαιώματα περνούν από συναρτήσεις.
--
-- ΤΙ ΔΕΝ ΚΛΕΙΔΩΝΕΙ, ΚΑΙ ΓΙΑΤΙ:
--
--   contacts           Οι επαφές του ακινήτου (υδραυλικός, διαχειριστής,
--                      ενοικιαστής). Καρτέλα κάθε πακέτου, όχι πελατολόγιο.
--   accountant_*       Η πύλη λογιστή έχει δική της κλειδαριά από το
--                      20260819120000 και δεν είναι CRM.
--   user_properties.client_id
--                      Στήλη του ακινήτου, όχι πίνακας· η σύνδεση ακινήτου με
--                      ιδιοκτήτη-πελάτη κρίνεται από την καρτέλα Ακίνητο.
--
-- ΠΟΙΟΣ ΒΑΘΜΟΣ ΓΙΑ ΠΟΙΟΝ. Η `my_plan_rank()` είναι ο βαθμός ΤΟΥ ΚΑΛΟΥΝΤΟΣ.
-- Το μέλος ομάδας με δικαίωμα επεξεργασίας (`org_edit_clients`) κρίνεται από
-- το δικό του πακέτο, όχι του ιδιοκτήτη, ακριβώς όπως στην οθόνη: ο πίνακας
-- δείχνει την καρτέλα από το `effectivePlan` του συνδεδεμένου και κανένα
-- μέλος δεν κληρονομεί το πακέτο του οργανισμού (useDashboard, `effProfileType`).
--
-- ΤΙ ΑΝΕΒΑΖΕΙ ΤΟΝ ΒΑΘΜΟ. Η `user_plan_rank` ξέρει ήδη τους δωρεάν μήνες
-- (`comp_plan`), την κράτηση υποβάθμισης, την ιδιότητα συνεργάτη (πάντα
-- «Επαγγελματίας») και τη δοκιμή. Η δοκιμή δίνει «Ιδιοκτήτης+», βαθμό 2: ο
-- δοκιμαστής δεν βλέπει το πελατολόγιο στην οθόνη και δεν το γράφει ούτε στη
-- βάση. Το scripts/db/rls-probe.sql το αποδεικνύει και για τους τέσσερις.
--
-- ΓΙΑΤΙ RESTRICTIVE ΚΑΙ ΧΩΡΙΣΤΕΣ ΑΠΟ ΤΗΝ ΙΔΙΟΚΤΗΣΙΑ. Ο ίδιος λόγος με την
-- 20260814070000: «είναι δική μου» και «το πληρώνω» είναι δύο ερωτήσεις. Η
-- restrictive κάνει AND με τις permissive που υπάρχουν και με όσες γραφτούν
-- αύριο στους ίδιους πίνακες, χωρίς να ξαναγράψει καμία. Ρητά, μία προς μία:
-- οι φύλακες του scripts/ διαβάζουν το SQL ως κείμενο.
--
-- ΓΙΑΤΙ `(select public.my_plan_rank())`. Γυμνή θα καλούνταν ανά γραμμή·
-- τυλιγμένη γίνεται InitPlan, μία αποτίμηση ανά εντολή (20260808010000). Η
-- `plan_rank(text)` είναι IMMUTABLE, οπότε το `plan_rank('agency')` γίνεται
-- σταθερά στον σχεδιασμό.
--
-- ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΠΟΥ ΠΑΡΑΚΑΜΠΤΟΥΝ ΤΗΝ RLS. Τέσσερις της ομάδας γράφουν για τον
-- ιδιοκτήτη και παίρνουν την ίδια πύλη, αμέσως μετά την πύλη του δεύτερου
-- βήματος της 20261003120000: `rename_organization`, `invite_org_member`,
-- `clear_org_upgrade_request`. Η `set_member_edit` την παίρνει μόνο όταν ΔΙΝΕΙ
-- δικαίωμα επεξεργασίας και η `ensure_organization` μόνο όταν ΦΤΙΑΧΝΕΙ
-- οργανισμό: τον υπάρχοντα τον επιστρέφει πάντα, γιατί από αυτόν φορτώνει η
-- οθόνη της ομάδας και χωρίς αυτόν ο ιδιοκτήτης δεν θα έβλεπε ποιον να βγάλει. Σηκώνουν «plan_required» με
-- 42501, όπως η «mfa_required».
--
-- Η ΑΦΑΙΡΕΣΗ ΠΡΟΣΒΑΣΗΣ ΔΕΝ ΘΕΛΕΙ ΠΟΤΕ ΠΑΚΕΤΟ. Η `revoke_org_member` και η
-- `set_member_edit(…, false)` μένουν ανοιχτές για τον ιδιοκτήτη χωρίς πακέτο.
-- Αλλιώς όποιος σταματούσε τη συνδρομή δεν θα μπορούσε να βγάλει από την ομάδα
-- του έναν πρώην συνεργάτη, που θα συνέχιζε να βλέπει τα ακίνητά του. Ίδιος
-- κανόνας με το DELETE των πινάκων: η πολιτική `org_members_owner` αφήνει ήδη
-- τον ιδιοκτήτη να σβήσει μέλος απευθείας και η οθόνη, που περνά από τη
-- συνάρτηση, δεν πρέπει να μπορεί λιγότερα από τη βάση. Τρεις ΜΕΝΟΥΝ ΑΝΟΙΧΤΕΣ γιατί τις καλεί το μέλος, του οποίου
-- το πακέτο δεν κρίνει τίποτα: `accept_org_invites_for_me` (τρέχει σε κάθε
-- φόρτωση του πίνακα, για όποιον προσκλήθηκε με το email του),
-- `request_member_edit` (το μέλος ζητά δικαίωμα επεξεργασίας) και
-- `request_org_upgrade` (αίτημα αναβάθμισης: η πύλη του πακέτου σε αίτημα για
-- πακέτο θα ήταν αντίφαση). Τα σώματα είναι αυτούσια από την 20261003120000·
-- η μόνη προσθήκη είναι η δεύτερη πύλη. Ο κάτοχος και τα grants μένουν, γιατί
-- το `create or replace` δεν τα αγγίζει.
--
-- ΤΙ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ. Τίποτα, όσο η οθόνη κρύβει ό,τι κρύβει σήμερα. Το
-- lib/core/dbError.ts μεταφράζει το «plan_required» σε «Αυτή η ενέργεια ανοίγει
-- σε ανώτερο πακέτο» και το OrgTeam δείχνει τον λόγο όταν η `ensure_organization`
-- αρνηθεί, αντί για πεδία χωρίς οργανισμό.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `drop policy if exists` πριν από κάθε `create policy` και
-- `create or replace` με ίδια υπογραφή.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΤΟ ΠΕΛΑΤΟΛΟΓΙΟ ─────────────────────────────────────────────────────

drop policy if exists plan_ins_clients on public.clients;
create policy plan_ins_clients on public.clients as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_clients on public.clients;
create policy plan_upd_clients on public.clients as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

drop policy if exists plan_ins_client_notes on public.client_notes;
create policy plan_ins_client_notes on public.client_notes as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_client_notes on public.client_notes;
create policy plan_upd_client_notes on public.client_notes as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

drop policy if exists plan_ins_client_documents on public.client_documents;
create policy plan_ins_client_documents on public.client_documents as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_client_documents on public.client_documents;
create policy plan_upd_client_documents on public.client_documents as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

drop policy if exists plan_ins_client_stays on public.client_stays;
create policy plan_ins_client_stays on public.client_stays as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_client_stays on public.client_stays;
create policy plan_upd_client_stays on public.client_stays as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

-- ── 2. Η ΟΜΑΔΑ ────────────────────────────────────────────────────────────

drop policy if exists plan_ins_organizations on public.organizations;
create policy plan_ins_organizations on public.organizations as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_organizations on public.organizations;
create policy plan_upd_organizations on public.organizations as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

drop policy if exists plan_ins_organization_members on public.organization_members;
create policy plan_ins_organization_members on public.organization_members as restrictive for insert to authenticated
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));
drop policy if exists plan_upd_organization_members on public.organization_members;
create policy plan_upd_organization_members on public.organization_members as restrictive for update to authenticated
  using ((select public.my_plan_rank()) >= public.plan_rank('agency'))
  with check ((select public.my_plan_rank()) >= public.plan_rank('agency'));

-- ── 3. ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΤΗΣ ΟΜΑΔΑΣ ΠΟΥ ΓΡΑΦΟΥΝ ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ ──────────────
-- Αλφαβητικά. Η πύλη του πακέτου μπαίνει δεύτερη, μετά το δεύτερο βήμα.

create or replace function public.clear_org_upgrade_request()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if public.my_plan_rank() < public.plan_rank('agency') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  update organizations set upgrade_requested_at = null where owner_user_id = auth.uid();
end; $$;

create or replace function public.ensure_organization()
 returns organizations
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org public.organizations;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select * into v_org from organizations where owner_user_id = auth.uid();
  if v_org.id is null then
    -- Μόνο ο ΝΕΟΣ οργανισμός θέλει πακέτο. Ο υπάρχων επιστρέφεται πάντα, ώστε ο
    -- ιδιοκτήτης χωρίς συνδρομή να βλέπει την ομάδα του και να βγάζει μέλη.
    if public.my_plan_rank() < public.plan_rank('agency') then
      raise exception 'plan_required' using errcode = '42501';
    end if;
    insert into organizations(owner_user_id, name) values (auth.uid(), '') returning * into v_org;
    insert into organization_members(org_id, user_id, email, role, status, joined_at)
      values (v_org.id, auth.uid(), coalesce(auth.email(), ''), 'owner', 'active', now())
    on conflict (org_id, email) do nothing;
  end if;
  return v_org;
end; $$;

create or replace function public.invite_org_member(p_email text, p_role text DEFAULT 'member'::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if public.my_plan_rank() < public.plan_rank('agency') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  select id into v_org from organizations where owner_user_id = auth.uid();
  if v_org is null or p_email is null or position('@' in p_email) = 0 then return; end if;
  insert into organization_members(org_id, email, role, status)
    values (v_org, lower(trim(p_email)), case when p_role in ('admin','member') then p_role else 'member' end, 'invited')
  on conflict (org_id, email) do update set role = excluded.role, status = case when organization_members.status = 'revoked' then 'invited' else organization_members.status end;
end; $$;

create or replace function public.rename_organization(p_name text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if public.my_plan_rank() < public.plan_rank('agency') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  update organizations set name = coalesce(nullif(trim(p_name), ''), name) where owner_user_id = auth.uid();
end; $$;

create or replace function public.revoke_org_member(p_email text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select id into v_org from organizations where owner_user_id = auth.uid();
  if v_org is null then return; end if;
  delete from organization_members where org_id = v_org and lower(email) = lower(p_email) and role <> 'owner';
end; $$;

create or replace function public.set_member_edit(p_email text, p_can boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  -- Μόνο η ΠΑΡΑΧΩΡΗΣΗ δικαιώματος θέλει πακέτο. Η αφαίρεση μένει πάντα ανοιχτή.
  if coalesce(p_can, false) and public.my_plan_rank() < public.plan_rank('agency') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  select id into v_org from organizations where owner_user_id = auth.uid();
  if v_org is null then return; end if;
  update organization_members
     set can_edit = coalesce(p_can, false), edit_requested_at = null
   where org_id = v_org and lower(email) = lower(p_email) and role <> 'owner';
end; $$;

comment on policy plan_ins_clients on public.clients is
  'Νέος πελάτης θέλει το πακέτο «Επαγγελματίας» (20261003140000). Ανάγνωση και διαγραφή μένουν ελεύθερες.';
comment on policy plan_ins_organizations on public.organizations is
  'Νέος οργανισμός θέλει το πακέτο «Επαγγελματίας» (20261003140000). Ανάγνωση και διαγραφή μένουν ελεύθερες.';
