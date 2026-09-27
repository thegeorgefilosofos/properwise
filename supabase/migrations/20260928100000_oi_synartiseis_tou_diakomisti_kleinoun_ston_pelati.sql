-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΚΛΕΙΝΟΥΝ ΣΤΟΝ ΣΥΝΔΕΔΕΜΕΝΟ ΠΕΛΑΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: έλεγχος 27.09.2026, ελεγκτές ασφαλείας και απόδοσης της Supabase
-- (lints 0028 και 0029: SECURITY DEFINER εκτελέσιμη από `anon` και από
-- `authenticated`).
--
-- ΤΙ ΜΕΤΡΗΘΗΚΕ ΣΤΟ STAGING ΠΡΙΝ. 11 συναρτήσεις SECURITY DEFINER εκτελέσιμες
-- από `anon`, 62 από `authenticated`. Κάθε μία ελέγχθηκε με τρεις ερωτήσεις:
-- ποιος κώδικας την καλεί (`.rpc('…')` σε app/, lib/, components/,
-- supabase/functions/, scripts/), ποια SQL την καλεί (σώματα συναρτήσεων,
-- πολιτικές RLS, εντολές cron, triggers) και με ποιον ρόλο φτάνει η κλήση.
--
-- ΤΡΕΙΣ ΚΑΤΗΓΟΡΙΕΣ:
--   (α) την καλεί ο περιηγητής χωρίς λογαριασμό, με token στο χέρι: μένει σε
--       `anon` ΚΑΙ σε `authenticated`, γιατί ο ίδιος σύνδεσμος ανοίγει και από
--       περιηγητή όπου ο χρήστης είναι συνδεδεμένος.
--   (β) την καλεί ο συνδεδεμένος χρήστης, από τον περιηγητή ή από διαδρομή
--       διακομιστή με το δικό του διακριτικό (`auth.uid()` μέσα στο σώμα): μένει
--       σε `authenticated`, όχι σε `anon`.
--   (γ) την καλεί μόνο το cron, άλλη SECURITY DEFINER συνάρτηση ή κανείς: φεύγει
--       από `public`, `anon` και `authenticated`. Μένει στον `service_role` και
--       στον ιδιοκτήτη `postgres`, που είναι ο ρόλος του cron.
--
-- (α) ΜΕΝΟΥΝ ΑΝΟΙΧΤΕΣ ΣΤΟΝ ΑΝΩΝΥΜΟ: 11. Είναι ακριβώς ο κατάλογος του
--     scripts/db/anon-surface.sql, με τον λόγο της καθεμιάς εκεί.
--   confirm_reminder_email       app/epivevaiosi-email/[token]/page.tsx
--   declare_rent_payment         app/portal/[token]/page.tsx
--   get_accountant_data          app/accountant/[token]/page.tsx, app/accountant/bulk.ts
--   get_checkin_context          app/checkin/[token]/page.tsx
--   get_portal_data              app/portal/[token]/page.tsx
--   marketing_prefs_by_token     app/unsubscribe/[token]/page.tsx
--   portal_meta                  app/portal/[token]/page.tsx
--   submit_checkin               app/checkin/[token]/page.tsx
--   submit_maintenance_request   app/portal/[token]/page.tsx
--   unsubscribe_email            app/unsubscribe/[token]/page.tsx και one-click/route.ts
--   verify_document              app/verify/[id]/page.tsx
--   Τέσσερις από αυτές (get_accountant_data, get_checkin_context,
--   get_portal_data, portal_meta) είχαν ΚΑΙ το εξ ορισμού EXECUTE του `PUBLIC`.
--   Φεύγει το `PUBLIC`, μένουν τα ρητά `anon`, `authenticated`, `service_role`:
--   ίδια συμπεριφορά για όποιον καλεί μέσω PostgREST.
--
-- (β) ΜΕΝΟΥΝ ΣΤΟΝ ΣΥΝΔΕΔΕΜΕΝΟ: 45.
--   accept_org_invites_for_me, mark_referral_activated, redeem_referral,
--   sync_comp_from_referrals              app/dashboard/page.tsx
--   accountant_claim, accountant_clients_overview, accountant_request_item,
--   my_accountants                        lib/data/accountant.ts
--   bank_feed_health, bank_feed_held      BankRatesAdmin.tsx, useMarketData.ts
--   market_feed_health                    app/hooks/useMarketData.ts
--   bump_ai_usage(8 ορίσματα), bump_scan_usage
--                                         app/api/anthropic/route.tsx με τη συνεδρία του χρήστη,
--                                         supabase/functions/smart-suggestions με το JWT του
--   bump_send_quota                       api/billing/tester και τέσσερις edge functions,
--                                         όλες με το JWT του χρήστη (το σώμα απαιτεί auth.uid())
--   claim_referral_bonus, get_referral_list, get_referral_overview,
--   get_referral_social_proof, get_referral_standing,
--   reconcile_referral_rewards            TabReferral.tsx
--   clear_org_upgrade_request, ensure_organization, invite_org_member,
--   rename_organization, request_member_edit, request_org_upgrade,
--   revoke_org_member, set_member_edit    OrgTeam.tsx
--   community_market_stats                TabRentROI.tsx
--   delete_my_account                     app/api/account/delete/route.ts (πύλη aal2 μέσα στη βάση)
--   export_my_data                        lib/dataExport.ts
--   issue_reminder_email_token            send-test-notification με το JWT του χρήστη
--   join_mobile_waitlist, leave_mobile_waitlist  SettingsRoadmap.tsx
--   log_activity                          lib/activity.ts
--   log_event                             lib/analytics/events.ts
--   my_activity                           ActivityLog.tsx
--   my_feedback_status, submit_feedback   Feedback.tsx
--   my_plan_rank                          ΠΟΛΙΤΙΚΕΣ RLS (plan_* σε bank_transactions,
--                                         report_branding): η πολιτική τρέχει με τον ρόλο του
--                                         καλούντος, άρα η αφαίρεση θα έσπαγε κάθε ανάγνωση
--   my_storage_objects                    lib/storage/accountSweep.ts
--   rotate_calendar_feed                  lib/data/calendarFeed.ts
--   rotate_inbound_mailbox                lib/data/inbound.ts
--   set_portal_pin                        PortalShare.tsx
--   user_plan_rank                        lib/billing/requireFeature.ts με τη συνεδρία του
--                                         χρήστη. Μένει, με μια σημείωση: δέχεται οποιοδήποτε
--                                         uid, άρα λέει σε κάθε συνδεδεμένο τη βαθμίδα πακέτου
--                                         ενός άλλου λογαριασμού. Διαρροή μικρή, όχι δεδομένων·
--                                         για να κλείσει θέλει αλλαγή υπογραφής, όχι grant.
--   Και οι 11 της κατηγορίας (α), που μένουν και εδώ για τον λόγο που γράφεται εκεί.
--
-- (γ) ΚΛΕΙΝΟΥΝ: 6.
--   drain_email_outbox(integer)
--       Την καλεί ΜΟΝΟ το cron `email-outbox-drain` ως `postgres`. Είναι και η
--       μόνη συνάρτηση του `public` που καλεί net.http_post. Το
--       20260806120000 την είχε ξαναδώσει ρητά στον `authenticated` μέσα σε
--       βρόχο, οπότε ο φύλακας scripts/guard-http-bridge.mjs, που διαβάζει
--       κείμενο, δεν το έβλεπε: οποιοσδήποτε συνδεδεμένος μπορούσε να αδειάσει
--       την ουρά email εκτός χρονοπρογράμματος.
--   enqueue_email(text,text,text,jsonb,text,text,interval)
--       Κανένας καλών: ούτε κώδικας ούτε SQL. Και το σώμα της δεν ελέγχει
--       κανέναν: παίρνει παραλήπτη, πρότυπο και παραμέτρους από τον καλούντα.
--       Στον `authenticated` ήταν ανοιχτός αναμεταδότης email με τη διεύθυνση
--       αποστολέα μας.
--   accountant_link_live(uuid,uuid)
--       Την καλούν μόνο οι accountant_clients_overview και
--       accountant_request_item, SECURITY DEFINER και οι δύο, άρα τρέχει ως
--       `postgres`. Το scripts/db/rls-probe.sql την καλεί επίσης ως `postgres`.
--       Απευθείας απαντούσε σε κάθε συνδεδεμένο «είναι ο λογιστής Χ συνδεδεμένος
--       με τον ιδιοκτήτη Υ;».
--   set_org_member_role(text,text)
--       Κανένας καλών πουθενά. Αν γραφτεί ποτέ οθόνη που την καλεί, το grant
--       ξαναδίνεται ρητά μαζί της.
--   bump_ai_usage(integer,integer[],integer[],integer)
--   bump_ai_usage(integer,integer[],integer[],integer,integer,integer)
--       Παλιές υπογραφές. Οι δύο καλούντες (app/api/anthropic/route.tsx,
--       supabase/functions/smart-suggestions) στέλνουν από τις 30.08.2026 τα
--       `p_tester_day`, `p_tester_month`, που υπάρχουν ΜΟΝΟ στην υπογραφή των
--       οκτώ ορισμάτων· το PostgREST διαλέγει υπερφόρτωση από τα ονόματα, άρα
--       στις δύο παλιές δεν φτάνει καμία κλήση. Δεν σβήνονται εδώ: τις
--       αναφέρουν ιστορικές μεταναστεύσεις και η διαγραφή είναι άλλη απόφαση.
--
-- ΚΑΙ ΕΝΑ SEARCH_PATH ΠΟΥ ΔΕΝ ΕΛΕΓΕ ΑΥΤΟ ΠΟΥ ΕΓΡΑΦΕ. Το staging κρατά για την
-- `marketing_prefs_for_email` την τιμή `search_path="public, pg_temp"`: ΕΝΑ
-- όνομα σχήματος με κόμμα μέσα, που δεν υπάρχει. Στην πράξη το `public` έλειπε
-- και το `pg_temp` έμπαινε σιωπηρά ΠΡΩΤΟ για πίνακες. Δεν ήταν εκμεταλλεύσιμο
-- (κάθε αναφορά του σώματος γράφει σχήμα, η συνάρτηση ανήκει μόνο στον
-- `service_role`), αλλά ο έλεγχος «κάθε SECURITY DEFINER κλειδώνει το
-- search_path» το μετρούσε ως κλειδωμένο. Γράφεται ξανά σωστά.
--
-- ΕΠΑΛΗΘΕΥΣΗ ΣΤΟ STAGING, σε συναλλαγή που αναιρέθηκε: οι έξι έγιναν μη
-- εκτελέσιμες από `anon` και `authenticated`, εκτελέσιμες από `service_role`
-- και `postgres`. Ως `authenticated` η accountant_clients_overview και η
-- accountant_request_item συνέχισαν να απαντούν (η εσωτερική κλήση τρέχει ως
-- ιδιοκτήτης), ενώ η απευθείας κλήση της accountant_link_live έδωσε 42501.
-- Μετρητές: anon 11 σε 11, authenticated 62 σε 56.
--
-- ΙΔΙΟΔΥΝΑΜΗ. REVOKE και GRANT ξανατρέχουν χωρίς σφάλμα· κάθε υπογραφή
-- περνά από `to_regprocedure`, οπότε μια συνάρτηση που δεν υπάρχει (τοπικό
-- αντίγραφο, μελλοντική διαγραφή) προσπερνιέται αντί να σταματήσει τον αγωγό.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  s text;
  f regprocedure;
begin
  -- (γ) μόνο διακομιστής, cron ή άλλη SQL
  foreach s in array array[
    'public.drain_email_outbox(integer)',
    'public.enqueue_email(text,text,text,jsonb,text,text,interval)',
    'public.accountant_link_live(uuid,uuid)',
    'public.set_org_member_role(text,text)',
    'public.bump_ai_usage(integer,integer[],integer[],integer)',
    'public.bump_ai_usage(integer,integer[],integer[],integer,integer,integer)'
  ] loop
    f := to_regprocedure(s);
    continue when f is null;
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  -- (α) το εξ ορισμού EXECUTE του PUBLIC φεύγει, τα ρητά μένουν
  foreach s in array array[
    'public.get_accountant_data(text,integer)',
    'public.get_checkin_context(text)',
    'public.get_portal_data(text,text)',
    'public.portal_meta(text)'
  ] loop
    f := to_regprocedure(s);
    continue when f is null;
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
    execute format('revoke execute on function %s from public', f);
  end loop;

  if to_regprocedure('public.marketing_prefs_for_email(text)') is not null then
    alter function public.marketing_prefs_for_email(text) set search_path = public, pg_temp;
  end if;
end
$$;
