-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΦΥΛΑΕΙ ΚΑΙ ΤΑ ΔΕΔΟΜΕΝΑ, ΟΧΙ ΜΟΝΟ ΤΙΣ ΣΕΛΙΔΕΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΕΜΕΝΕ ΑΝΟΙΧΤΟ. Ο χρήστης με δηλωμένη συσκευή TOTP που κρατά συνεδρία
-- «aal1» (μόνο κωδικός, χωρίς τον εξαψήφιο) γύριζε στη σύνδεση ΜΟΝΟ όταν
-- ζητούσε σελίδα (proxy.ts). Το ίδιο διακριτικό μιλούσε κατευθείαν στο
-- PostgREST του παρόχου: καμία πολιτική RLS δεν κοίταζε το «aal», οπότε ένας
-- κωδικός που διέρρευσε διάβαζε και έγραφε ΟΛΑ τα δεδομένα του λογαριασμού
-- με τον δεύτερο παράγοντα δηλωμένο ενεργό. Η μόνη πύλη στη βάση ζούσε μέσα
-- στη `delete_my_account` (20260917120000).
--
-- Η ΑΠΟΦΑΣΗ (έγκριση ιδιοκτήτη, 03.10.2026): η βάση κρίνει μόνη της.
--
--   1. `private.mfa_satisfied()`: αληθής όταν το διακριτικό λέει «aal2» Ή όταν
--      ο καλών δεν έχει ΚΑΝΕΝΑΝ επαληθευμένο παράγοντα. Ο χρήστης χωρίς 2FA δεν
--      βλέπει καμία διαφορά. Ο ρόλος υπηρεσίας και ο χρονοπρογραμματιστής δεν
--      έχουν `auth.uid()`, οπότε περνούν κι αυτοί.
--   2. Μία RESTRICTIVE πολιτική ανά πίνακα δεδομένων χρήστη, για τον
--      `authenticated`. Η restrictive κάνει AND με τις permissive που υπάρχουν:
--      δεν δίνει πρόσβαση πουθενά, δεν ξαναγράφει καμία πολιτική και ισχύει
--      και για όσες γραφτούν αύριο στους ίδιους πίνακες.
--   3. Η ίδια πύλη μέσα στις συναρτήσεις SECURITY DEFINER που φτάνει ο
--      `authenticated` και αγγίζουν δεδομένα του καλούντα. Αυτές παρακάμπτουν
--      την RLS εκ κατασκευής, οπότε το βήμα 2 δεν τις πιάνει.
--
-- ΓΙΑΤΙ `(select private.mfa_satisfied())`. Γυμνή, η συνάρτηση θα καλούνταν
-- για κάθε γραμμή που εξετάζεται. Τυλιγμένη γίνεται InitPlan: μία αποτίμηση
-- ανά εντολή, δηλαδή μία ανάγνωση του `auth.mfa_factors` με το ευρετήριο του
-- `user_id`, όσες γραμμές κι αν έχει ο πίνακας.
--
-- ΓΙΑΤΙ ΣΤΟ `private`. Εκεί ζουν οι βοηθοί των πολιτικών (20260812160000).
-- Το `public` το εκθέτει το PostgREST ως RPC.
--
-- ΤΙ ΜΕΝΕΙ ΕΞΩ ΑΠΟ ΤΙΣ ΠΟΛΙΤΙΚΕΣ, ΕΠΙΤΗΔΕΣ:
--   · οι πέντε δημόσιοι πίνακες αναφοράς (`bank_rates`, `energy_tariffs`,
--     `loan_programs`, `market_rates`, `product_updates`). Τους διαβάζει και ο
--     ανώνυμος, οπότε ένα «όχι» στον μισοσυνδεδεμένο δεν προστατεύει τίποτα·
--     θα έσπαγε μόνο τους δημόσιους υπολογιστές του. Οι εγγραφές διαχειριστή
--     στα επιτόκια ρωτούν το `app_admins`, που ΠΑΙΡΝΕΙ την πύλη: σε «aal1» ο
--     διαχειριστής δεν βρίσκει τον εαυτό του εκεί και η εγγραφή κόβεται.
--   · οι πίνακες μόνο υπηρεσίας (RLS χωρίς καμία permissive πολιτική). Είναι
--     ήδη κλειστοί για τον `authenticated`· μια restrictive δεν αλλάζει τίποτα.
--   · τίποτα δεν χρειάζεται η σύνδεση πριν τον εξαψήφιο. Η οθόνη σύνδεσης, ο
--     διαμεσολαβητής και η επιστροφή της Google μιλούν μόνο στον διακομιστή
--     ταυτότητας, όχι σε πίνακα του `public` (app/login/page.tsx, proxy.ts,
--     app/signup/page.tsx, lib/auth/**). Η εγγραφή καινούριου λογαριασμού
--     γράφει σε πίνακες, αλλά καινούριος λογαριασμός δεν έχει συσκευή.
--
-- ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΧΩΡΙΣ ΠΥΛΗ, ΜΕ ΤΟΝ ΛΟΓΟ ΤΟΥΣ:
--   · `delete_my_account`: έχει ήδη την ίδια πύλη γραμμένη μέσα της.
--   · `bump_ai_usage`, `bump_scan_usage`, `bump_send_quota`: μετρητές. Μόνο
--     ανεβάζουν το όριο του ίδιου του καλούντα και τους καλούν η /api/anthropic
--     και οι συναρτήσεις άκρου ΜΕΤΑ τον δικό τους έλεγχο.
--   · `my_plan_rank`: ένας ακέραιος (ο βαθμός του πακέτου), κανένα προσωπικό
--     δεδομένο. Τον ρωτά η `requireFeature`, που κόβει πρώτα η ίδια.
--   · `community_market_stats`, `get_referral_social_proof`,
--     `bank_feed_health`, `bank_feed_held`, `market_feed_health`: συγκεντρωτικά
--     ή δημόσια, δεν κοιτούν ποιος ρωτά.
--   · οι πύλες με διακριτικό (μισθωτής, λογιστής, άφιξη, email): δεν έχουν
--     συνεδρία και τις φτάνει και ο ανώνυμος (scripts/db/anon-surface.sql).
--
-- ΤΑ ΣΩΜΑΤΑ ΜΕΝΟΥΝ ΑΥΤΟΥΣΙΑ. Είναι οι τρέχοντες ορισμοί, όπως τους δίνει το
-- `pg_get_functiondef` μετά από όλες τις προηγούμενες μεταναστεύσεις. Η μόνη
-- προσθήκη είναι η πύλη, πρώτη εντολή μετά το `begin`, που σηκώνει
-- «mfa_required» με 42501. Η `my_activity` είναι SQL χωρίς `begin`: εκεί η πύλη
-- μπαίνει στο `where` και η απάντηση είναι κενή λίστα. Τα σχόλια των σωμάτων
-- μένουν στις μεταναστεύσεις που τα έγραψαν.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create or replace` με ίδια υπογραφή (κάτοχος και grants μένουν)
-- και `drop policy if exists` πριν από κάθε `create policy`.
--
-- Ο ΕΛΕΓΧΟΣ ΠΟΥ ΤΑ ΚΡΑΤΑ. Το scripts/db/rls-probe.sql δείχνει τη συμπεριφορά σε
-- πραγματική Postgres (aal1 με συσκευή: μηδέν γραμμές και άρνηση εγγραφής·
-- aal2: κανονικά· χωρίς συσκευή: κανονικά) και ρωτά τον κατάλογο: ΚΑΘΕ πίνακας
-- με permissive πολιτική έχει την restrictive και ΚΑΘΕ τέτοια συνάρτηση έχει
-- την πύλη, εκτός από όσα γράφονται ονομαστικά εκεί με τον λόγο τους.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η ΕΡΩΤΗΣΗ, ΣΕ ΕΝΑ ΣΗΜΕΙΟ ───────────────────────────────────────────
-- SECURITY DEFINER γιατί ο `authenticated` δεν διαβάζει το `auth.mfa_factors`.
-- Η αξίωση `aal` λείπει από το διακριτικό του ρόλου υπηρεσίας· εκεί όμως δεν
-- υπάρχει `auth.uid()`, οπότε απαντά το δεύτερο σκέλος.
create or replace function private.mfa_satisfied()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1
          from auth.mfa_factors f
         where f.user_id = auth.uid()
           and f.status = 'verified'
      )
$$;

alter function private.mfa_satisfied() owner to postgres;
revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated, service_role;

comment on function private.mfa_satisfied() is
  'Πέρασε ο καλών το δεύτερο βήμα, ή δεν έχει συσκευή να περάσει; Η πύλη 2FA των πολιτικών και των RPC.';

-- ── 2. ΜΙΑ RESTRICTIVE ΑΝΑ ΠΙΝΑΚΑ ΔΕΔΟΜΕΝΩΝ ΧΡΗΣΤΗ ─────────────────────────
-- Ρητά, μία προς μία: οι φύλακες του scripts/ διαβάζουν το SQL ως κείμενο και
-- ένας βρόχος με `execute format` θα τους έκρυβε ποιοι πίνακες καλύφθηκαν.
-- `for all`: το `using` κόβει ανάγνωση, ενημέρωση και διαγραφή, το `with
-- check` την εισαγωγή και τη νέα μορφή της ενημέρωσης.

drop policy if exists mfa_accountant_clients on public.accountant_clients;
create policy mfa_accountant_clients on public.accountant_clients as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_accountant_dossier on public.accountant_dossier;
create policy mfa_accountant_dossier on public.accountant_dossier as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_accountant_links on public.accountant_links;
create policy mfa_accountant_links on public.accountant_links as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_accountant_packs on public.accountant_packs;
create policy mfa_accountant_packs on public.accountant_packs as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_accountant_requests on public.accountant_requests;
create policy mfa_accountant_requests on public.accountant_requests as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_activity_log on public.activity_log;
create policy mfa_activity_log on public.activity_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_airbnb_bookings on public.airbnb_bookings;
create policy mfa_airbnb_bookings on public.airbnb_bookings as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_app_admins on public.app_admins;
create policy mfa_app_admins on public.app_admins as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_bank_connections on public.bank_connections;
create policy mfa_bank_connections on public.bank_connections as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_bank_transactions on public.bank_transactions;
create policy mfa_bank_transactions on public.bank_transactions as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_billing_profiles on public.billing_profiles;
create policy mfa_billing_profiles on public.billing_profiles as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_bills on public.bills;
create policy mfa_bills on public.bills as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_bills_history on public.bills_history;
create policy mfa_bills_history on public.bills_history as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_bills_settings on public.bills_settings;
create policy mfa_bills_settings on public.bills_settings as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_book_closings on public.book_closings;
create policy mfa_book_closings on public.book_closings as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_calendar_events on public.calendar_events;
create policy mfa_calendar_events on public.calendar_events as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_calendar_feed_tokens on public.calendar_feed_tokens;
create policy mfa_calendar_feed_tokens on public.calendar_feed_tokens as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_category_hints on public.category_hints;
create policy mfa_category_hints on public.category_hints as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_checkin_links on public.checkin_links;
create policy mfa_checkin_links on public.checkin_links as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_checklist_items on public.checklist_items;
create policy mfa_checklist_items on public.checklist_items as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_client_documents on public.client_documents;
create policy mfa_client_documents on public.client_documents as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_client_notes on public.client_notes;
create policy mfa_client_notes on public.client_notes as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_client_stays on public.client_stays;
create policy mfa_client_stays on public.client_stays as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_clients on public.clients;
create policy mfa_clients on public.clients as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_contacts on public.contacts;
create policy mfa_contacts on public.contacts as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_e2_prefilled on public.e2_prefilled;
create policy mfa_e2_prefilled on public.e2_prefilled as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_email_campaigns on public.email_campaigns;
create policy mfa_email_campaigns on public.email_campaigns as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_email_marketing_prefs on public.email_marketing_prefs;
create policy mfa_email_marketing_prefs on public.email_marketing_prefs as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_email_recipients on public.email_recipients;
create policy mfa_email_recipients on public.email_recipients as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_expenses on public.expenses;
create policy mfa_expenses on public.expenses as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_guest_checkins on public.guest_checkins;
create policy mfa_guest_checkins on public.guest_checkins as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_ical_feeds on public.ical_feeds;
create policy mfa_ical_feeds on public.ical_feeds as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inbound_mailboxes on public.inbound_mailboxes;
create policy mfa_inbound_mailboxes on public.inbound_mailboxes as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inbound_messages on public.inbound_messages;
create policy mfa_inbound_messages on public.inbound_messages as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inventory on public.inventory;
create policy mfa_inventory on public.inventory as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inventory_handovers on public.inventory_handovers;
create policy mfa_inventory_handovers on public.inventory_handovers as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inventory_items on public.inventory_items;
create policy mfa_inventory_items on public.inventory_items as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inventory_maintenance on public.inventory_maintenance;
create policy mfa_inventory_maintenance on public.inventory_maintenance as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_inventory_repairs on public.inventory_repairs;
create policy mfa_inventory_repairs on public.inventory_repairs as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_invoices on public.invoices;
create policy mfa_invoices on public.invoices as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_issued_documents on public.issued_documents;
create policy mfa_issued_documents on public.issued_documents as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_loans on public.loans;
create policy mfa_loans on public.loans as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_maintenance_requests on public.maintenance_requests;
create policy mfa_maintenance_requests on public.maintenance_requests as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_maintenance_tasks on public.maintenance_tasks;
create policy mfa_maintenance_tasks on public.maintenance_tasks as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_mobile_waitlist on public.mobile_waitlist;
create policy mfa_mobile_waitlist on public.mobile_waitlist as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_notification_log on public.notification_log;
create policy mfa_notification_log on public.notification_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_notification_preferences on public.notification_preferences;
create policy mfa_notification_preferences on public.notification_preferences as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_onboarding_progress on public.onboarding_progress;
create policy mfa_onboarding_progress on public.onboarding_progress as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_organization_members on public.organization_members;
create policy mfa_organization_members on public.organization_members as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_organizations on public.organizations;
create policy mfa_organizations on public.organizations as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_portal_links on public.portal_links;
create policy mfa_portal_links on public.portal_links as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_pricing_settings on public.pricing_settings;
create policy mfa_pricing_settings on public.pricing_settings as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_property_data on public.property_data;
create policy mfa_property_data on public.property_data as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_property_documents on public.property_documents;
create policy mfa_property_documents on public.property_documents as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_property_plan on public.property_plan;
create policy mfa_property_plan on public.property_plan as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_property_settings on public.property_settings;
create policy mfa_property_settings on public.property_settings as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_push_subscriptions on public.push_subscriptions;
create policy mfa_push_subscriptions on public.push_subscriptions as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_referral_codes on public.referral_codes;
create policy mfa_referral_codes on public.referral_codes as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_referral_partners on public.referral_partners;
create policy mfa_referral_partners on public.referral_partners as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_referral_rewards on public.referral_rewards;
create policy mfa_referral_rewards on public.referral_rewards as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_rent_comparables on public.rent_comparables;
create policy mfa_rent_comparables on public.rent_comparables as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_rent_config on public.rent_config;
create policy mfa_rent_config on public.rent_config as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_rent_payments on public.rent_payments;
create policy mfa_rent_payments on public.rent_payments as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_report_branding on public.report_branding;
create policy mfa_report_branding on public.report_branding as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_tenant_comm_log on public.tenant_comm_log;
create policy mfa_tenant_comm_log on public.tenant_comm_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_tenant_damages on public.tenant_damages;
create policy mfa_tenant_damages on public.tenant_damages as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_tenants on public.tenants;
create policy mfa_tenants on public.tenants as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_user_feedback on public.user_feedback;
create policy mfa_user_feedback on public.user_feedback as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_user_properties on public.user_properties;
create policy mfa_user_properties on public.user_properties as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ── 3. ΚΑΙ ΤΑ ΑΡΧΕΙΑ ─────────────────────────────────────────────────────────
-- Οι πολιτικές του `storage.objects` είναι γραμμένες στις μεταναστεύσεις
-- (ιδιωτικοί κάδοι ιδιοκτήτη, φάκελος λογιστή, φωτογραφίες βλαβών). Ένα
-- διακριτικό «aal1» κατέβαζε συμβόλαια και ταυτότητες μισθωτών με τον ίδιο
-- τρόπο που διάβαζε τους πίνακες. Οι δημόσιοι κάδοι σερβίρονται από τη
-- δημόσια διεύθυνση χωρίς RLS, οπότε δεν αλλάζει τίποτα για αυτούς. Ο
-- ανώνυμος μισθωτής που ανεβάζει φωτογραφία βλάβης δεν είναι `authenticated`.
drop policy if exists mfa_storage_objects on storage.objects;
create policy mfa_storage_objects on storage.objects as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ── 4. ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΠΟΥ ΠΑΡΑΚΑΜΠΤΟΥΝ ΤΗΝ RLS ──────────────────────────────
-- Αλφαβητικά. Καθεμία είναι ο τρέχων ορισμός της με μία προσθήκη: την πύλη.

create or replace function public.accept_org_invites_for_me()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update organization_members
     set user_id = auth.uid(), status = 'active', joined_at = coalesce(joined_at, now())
   where lower(email) = lower(coalesce(auth.email(), '')) and status = 'invited';
end; $$;

create or replace function public.accountant_claim(p_token text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_link record;
  v_me uuid := auth.uid();
  v_name text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  select * into v_link from accountant_links
   where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return json_build_object('ok', false, 'reason', 'invalid'); end if;

  if v_link.user_id = v_me then return json_build_object('ok', false, 'reason', 'self'); end if;

  if exists (select 1 from accountant_clients
              where accountant_id = v_me and owner_id = v_link.user_id and active = false) then
    return json_build_object('ok', false, 'reason', 'revoked');
  end if;

  insert into accountant_clients (accountant_id, owner_id, claimed_token)
    values (v_me, v_link.user_id, p_token)
  on conflict (accountant_id, owner_id)
    do update set active = true, linked_at = now(), claimed_token = excluded.claimed_token;

  select coalesce(nullif(trim(owner_name), ''), nullif(trim(full_name), ''), 'Ιδιοκτήτης')
    into v_name from billing_profiles where user_id = v_link.user_id;

  return json_build_object('ok', true, 'owner', coalesce(v_name, 'Ιδιοκτήτης'));
end $$;

create or replace function public.accountant_clients_overview(p_year integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_rows json;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;

  select coalesce(json_agg(r order by r->>'name'), '[]'::json) into v_rows from (
    select json_build_object(
      'ownerId',      ac.owner_id,
      'name',         coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ιδιοκτήτης'),
      'afm',          bp.afm,
      'linkedAt',     ac.linked_at,
      'token',        (select al.token from accountant_links al
                        where al.user_id = ac.owner_id
                          and coalesce(al.active, true)
                          and (al.expires_at is null or al.expires_at > now())
                        limit 1),
      'lastActivity', (
        select max(t) from (
          select max(e.created_at) as t from expenses e where e.user_id = ac.owner_id
          union all
          select max(rp.created_at) from rent_payments rp where rp.user_id = ac.owner_id
          union all
          select max(s.created_at) from client_stays s where s.user_id = ac.owner_id
          union all
          select max(d.created_at) from property_documents d where d.user_id = ac.owner_id
        ) moves
      ),
      'requests', coalesce((
        select json_agg(json_build_object(
          'id', ar.id, 'item', ar.item, 'note', ar.note, 'createdAt', ar.created_at
        ) order by ar.created_at)
        from accountant_requests ar
        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open'
      ), '[]'::json),
      'properties',   (select count(*) from user_properties up where up.user_id = ac.owner_id),
      'expenses',     (select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year),
      'uncategorised',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.category), ''), '') = ''),
      'noSupplierAfm',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.supplier_afm), ''), '') = ''),
      'rentsUnpaid',  (select count(*) from rent_payments rp
                        where rp.user_id = ac.owner_id and rp.period_year = p_year and rp.paid is not true),
      'stays',        (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year),
      'staysNoFee',   (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year
                          and s.channel in ('airbnb', 'booking')
                          and coalesce(s.platform_fee, 0) <= 0),
      'openRequests', (select count(*) from accountant_requests ar
                        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open'),
      'e2', json_build_object(
        'aadeRows',      (select count(*) from e2_prefilled ep
                           where ep.user_id = ac.owner_id and ep.tax_year = p_year),
        'aadeChangedAt', (select max(ep.updated_at) from e2_prefilled ep
                           where ep.user_id = ac.owner_id and ep.tax_year = p_year),
        'packs', coalesce((
          select json_agg(json_build_object(
            'ownerAfm', pk.owner_afm,
            'differences', pk.aade_differences,
            'checkedAt', pk.aade_checked_at,
            'missingCount', pk.missing_count,
            'missingTop', pk.missing_top,
            'filePath', pk.file_path,
            'sizeBytes', pk.size_bytes,
            'sharedAt', pk.shared_at
          ) order by pk.owner_afm)
          from accountant_packs pk
          where pk.user_id = ac.owner_id and pk.tax_year = p_year
        ), '[]'::json)
      )
    ) as r
    from accountant_clients ac
    left join billing_profiles bp on bp.user_id = ac.owner_id
    where ac.accountant_id = v_me
      and public.accountant_link_live(v_me, ac.owner_id)
      -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗΣ `get_accountant_data`: ο
      -- δωρεάν «Ιδιοκτήτης» στέλνει κι αυτός τον φάκελο στον λογιστή του.
  ) sub;

  return v_rows;
end;
$$;

create or replace function public.accountant_request_item(p_owner uuid, p_item text, p_note text DEFAULT NULL::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_item text := left(btrim(coalesce(p_item, '')), 160);
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if v_item = '' then return json_build_object('ok', false, 'reason', 'empty'); end if;
  if not public.accountant_link_live(v_me, p_owner) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;

  select id into v_id from accountant_requests
   where accountant_id = v_me and owner_id = p_owner and item = v_item and status = 'open'
   limit 1;
  if v_id is not null then return json_build_object('ok', true, 'id', v_id, 'existing', true); end if;

  insert into accountant_requests (accountant_id, owner_id, item, note)
    values (v_me, p_owner, v_item, left(btrim(coalesce(p_note, '')), 500))
    returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'existing', false);
end $$;

create or replace function public.claim_referral_bonus(p_code text, p_kind text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_owner uuid; v_count int; v_target int; v_months int; v_tier text; v_exists int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner <> auth.uid() then return json_build_object('ok', false, 'reason', 'not_owner'); end if;

  if    p_kind = 'indiv_volume' then v_target := 3; v_months := 1; v_tier := 'owner';
  elsif p_kind = 'pro_paid'     then v_target := 5; v_months := 1; v_tier := 'agency';
  else return json_build_object('ok', false, 'reason', 'bad_kind'); end if;

  perform pg_advisory_xact_lock(hashtext('referral_bonus:' || p_kind || ':' || v_owner::text));

  select
    case p_kind
      when 'indiv_volume' then count(*) filter (where coalesce(bp.profile_type,'individual') <> 'professional')
      when 'pro_paid'     then count(*) filter (where is_paying_plan(bp.plan))
    end::int
  into v_count
  from referrals r
  left join billing_profiles bp on bp.user_id = r.referred_user_id
  where r.referrer_user_id = v_owner and r.activated_at is not null
    and date_trunc('month', r.activated_at) = date_trunc('month', now());

  if v_count < v_target then return json_build_object('ok', false, 'reason', 'not_reached', 'count', v_count, 'target', v_target); end if;

  select count(*)::int into v_exists from referral_rewards
   where user_id = v_owner and reason = p_kind
     and date_trunc('month', created_at) = date_trunc('month', now());
  if v_exists > 0 then return json_build_object('ok', false, 'reason', 'already_claimed'); end if;

  insert into referral_rewards (user_id, kind, months, tier, reason, status)
       values (v_owner, 'months', v_months, v_tier, p_kind, 'pending');
  return json_build_object('ok', true, 'status', 'pending', 'months', v_months, 'tier', v_tier);
end; $$;

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
    insert into organizations(owner_user_id, name) values (auth.uid(), '') returning * into v_org;
    insert into organization_members(org_id, user_id, email, role, status, joined_at)
      values (v_org.id, auth.uid(), coalesce(auth.email(), ''), 'owner', 'active', now())
    on conflict (org_id, email) do nothing;
  end if;
  return v_org;
end; $$;

create or replace function public.export_my_data()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid  uuid  := auth.uid();
  v_out  jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_acct jsonb;
  r      record;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for r in
    select w.tbl,
           string_agg(format('t.%I::text = $1', w.col), ' or ' order by w.col) as pred
      from (
        select c.table_name::text as tbl, c.column_name::text as col
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = 'public'
           and c.column_name  = 'user_id'
           and t.table_type   = 'BASE TABLE'
        union
        select cl.relname::text, a.attname::text
          from pg_constraint k
          join pg_class     cl on cl.oid = k.conrelid
          join pg_namespace n  on n.oid  = cl.relnamespace
          join pg_attribute a  on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
         where k.contype   = 'f'
           and k.confrelid = 'auth.users'::regclass
           and n.nspname   = 'public'
           and cl.relkind in ('r', 'p')
           and cardinality(k.conkey) = 1
      ) w
     group by w.tbl
     order by w.tbl
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where %s',
      r.tbl, r.pred
    )
    into v_rows
    using v_uid::text;

    if v_rows <> '[]'::jsonb then
      v_out := v_out || jsonb_build_object(r.tbl, v_rows);
    end if;
  end loop;

  select to_jsonb(u) into v_acct
    from (
      select email, phone, created_at, last_sign_in_at
        from auth.users where id = v_uid
    ) u;

  return jsonb_build_object(
    'exported_at', now(),
    'user_id',     v_uid,
    'account',     coalesce(v_acct, 'null'::jsonb),
    'data',        v_out
  );
end;
$$;

create or replace function public.get_referral_list(p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_owner uuid; v_rows json;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner <> auth.uid() then return json_build_array(); end if;

  select coalesce(json_agg(t order by t.created_at desc), json_build_array())
    into v_rows
    from (
      select r.created_at, r.activated_at
        from referrals r
       where r.referrer_user_id = v_owner
    ) t;

  return v_rows;
end;
$$;

create or replace function public.get_referral_overview(p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_invites int; v_activated int;
  v_m_pro int; v_m_indiv int; v_m_paid int; v_m_free int;
  v_streak int := 0; v_partner boolean; v_monthly json;
  r record;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner <> auth.uid() then
    return json_build_object('invites',0,'activated',0,'m_pro',0,'m_indiv',0,
      'm_paid',0,'m_free',0,'streak',0,'partner',false,'paid_monthly_counts',json_build_array());
  end if;

  select count(*)::int into v_invites   from referrals where referrer_user_id = v_owner;
  select count(*)::int into v_activated from referrals where referrer_user_id = v_owner and activated_at is not null;

  select
    (count(*) filter (where coalesce(bp.profile_type,'individual') = 'professional'))::int,
    (count(*) filter (where coalesce(bp.profile_type,'individual') <> 'professional'))::int,
    (count(*) filter (where coalesce(bp.plan,'') in ('monthly','annual')))::int,
    (count(*) filter (where coalesce(bp.plan,'') not in ('monthly','annual')))::int
  into v_m_pro, v_m_indiv, v_m_paid, v_m_free
  from referrals r2
  left join billing_profiles bp on bp.user_id = r2.referred_user_id
  where r2.referrer_user_id = v_owner and r2.activated_at is not null
    and date_trunc('month', r2.activated_at) = date_trunc('month', now());

  for r in
    select (
      select (count(*) filter (where coalesce(bp.plan,'') in ('monthly','annual')))::int
        from referrals rr
        left join billing_profiles bp on bp.user_id = rr.referred_user_id
       where rr.referrer_user_id = v_owner and rr.activated_at is not null
         and date_trunc('month', rr.activated_at) = gs.m) as paid
      from generate_series(
             date_trunc('month', now()) - interval '1 month',
             date_trunc('month', now()) - interval '12 months',
             interval '-1 month') as gs(m)
      order by gs.m desc
  loop
    if r.paid >= 5 then v_streak := v_streak + 1; else exit; end if;
  end loop;

  if v_streak >= 3 then
    insert into referral_partners (user_id) values (v_owner) on conflict (user_id) do nothing;
  end if;
  select exists(select 1 from referral_partners where user_id = v_owner) into v_partner;

  select json_agg(paid order by m) into v_monthly from (
      select gs.m as m, (
             select (count(*) filter (where coalesce(bp.plan,'') in ('monthly','annual')))::int
               from referrals rr
               left join billing_profiles bp on bp.user_id = rr.referred_user_id
              where rr.referrer_user_id = v_owner and rr.activated_at is not null
                and date_trunc('month', rr.activated_at) = gs.m) as paid
        from generate_series(
               date_trunc('month', now()) - interval '6 months',
               date_trunc('month', now()) - interval '1 month',
               interval '1 month') as gs(m)
    ) months;

  return json_build_object(
    'invites', v_invites, 'activated', v_activated,
    'm_pro', v_m_pro, 'm_indiv', v_m_indiv, 'm_paid', v_m_paid, 'm_free', v_m_free,
    'streak', v_streak, 'partner', v_partner,
    'paid_monthly_counts', coalesce(v_monthly, json_build_array())
  );
end; $$;

create or replace function public.get_referral_standing()
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare v_me int; v_total int; v_below int; v_top int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select count(*) into v_me from referrals
   where referrer_user_id = auth.uid() and activated_at is not null
     and date_trunc('month', activated_at) = date_trunc('month', now());
  if v_me < 1 then return 0; end if;

  select count(*) into v_total from (
    select referrer_user_id from referrals
     where activated_at is not null
       and date_trunc('month', activated_at) = date_trunc('month', now())
     group by referrer_user_id) t;
  if v_total < 5 then return 0; end if;

  select count(*) into v_below from (
    select referrer_user_id from referrals
     where activated_at is not null
       and date_trunc('month', activated_at) = date_trunc('month', now())
     group by referrer_user_id
    having count(*) < v_me) t;

  v_top := greatest(1, round(100.0 * (v_total - v_below) / v_total)::int);
  if v_top > 50 then return 0; end if;
  return v_top;
end;
$$;

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
  select id into v_org from organizations where owner_user_id = auth.uid();
  if v_org is null or p_email is null or position('@' in p_email) = 0 then return; end if;
  insert into organization_members(org_id, email, role, status)
    values (v_org, lower(trim(p_email)), case when p_role in ('admin','member') then p_role else 'member' end, 'invited')
  on conflict (org_id, email) do update set role = excluded.role, status = case when organization_members.status = 'revoked' then 'invited' else organization_members.status end;
end; $$;

create or replace function public.issue_reminder_email_token()
 returns TABLE(email text, token uuid)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare v_uid uuid := auth.uid(); v_token uuid := gen_random_uuid(); v_email text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return; end if;
  select nullif(trim(reminder_email), '') into v_email
    from notification_preferences where notification_preferences.user_id = v_uid;
  if v_email is null then return; end if;

  update notification_preferences
     set reminder_email_token = v_token, reminder_email_token_at = now()
   where notification_preferences.user_id = v_uid;

  return query select v_email, v_token;
end $$;

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
  on conflict (user_id) do update set email = excluded.email;

  insert into billing_profiles(user_id, wants_mobile) values (v_uid, true)
  on conflict (user_id) do update set wants_mobile = true;
end; $$;

create or replace function public.leave_mobile_waitlist()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return; end if;
  delete from mobile_waitlist where user_id = v_uid;
  update billing_profiles set wants_mobile = false where user_id = v_uid;
end; $$;

create or replace function public.log_activity(p_action text, p_entity text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_owner uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null or coalesce(p_action, '') = '' then return; end if;
  select email into v_email from auth.users where id = v_uid;

  if p_entity = 'property'
     and p_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.user_id into v_owner
      from user_properties p
     where p.id = p_entity_id::uuid
       and p.user_id in (select private.org_owner_ids(v_uid));
  end if;

  insert into activity_log(user_id, actor_id, actor_email, action, entity, entity_id, metadata)
  values (coalesce(v_owner, v_uid), v_uid, v_email,
          left(p_action, 60), left(p_entity, 40), left(p_entity_id, 100),
          coalesce(p_metadata, '{}'::jsonb));
end $$;

create or replace function public.mark_referral_activated()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_props int; v_docs int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select count(*)::int into v_props from user_properties where user_id = auth.uid();
  select count(*)::int into v_docs  from property_documents where user_id = auth.uid();
  if v_props >= 1 and v_docs >= 1 then
    update referrals set activated_at = now()
     where referred_user_id = auth.uid() and activated_at is null;
  end if;
end; $$;

create or replace function public.my_accountants()
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'accountantId', ac.accountant_id,
      'name', coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ο λογιστής σου'),
      'linkedAt', ac.linked_at
    ) order by ac.linked_at)
    from accountant_clients ac
    left join billing_profiles bp on bp.user_id = ac.accountant_id
    where ac.owner_id = v_me and ac.active
  ), '[]'::json);
end $$;

create or replace function public.my_activity(p_limit integer DEFAULT 30)
 returns SETOF activity_log
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select * from activity_log
   where (user_id = auth.uid() or actor_id = auth.uid())
     and private.mfa_satisfied()
   order by created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

create or replace function public.my_feedback_status()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_has boolean; v_active boolean; v_camp text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return jsonb_build_object('status', 'error'); end if;
  select exists(
    select 1 from user_feedback
     where user_id = v_uid and date_trunc('month', created_at) = date_trunc('month', now())
  ) into v_has;
  select campaign_id, active into v_camp, v_active from public.feedback_campaign(now());
  return jsonb_build_object('submitted_this_month', v_has, 'campaign_active', v_active, 'campaign', v_camp);
end; $$;

create or replace function public.my_storage_objects()
 returns TABLE(bucket_id text, name text)
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  uid      uuid := auth.uid();
  prefixes text[];
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if uid is null then
    raise exception 'Δεν υπάρχει συνδεδεμένος χρήστης';
  end if;
  prefixes := private.storage_prefixes(uid);
  return query
    select o.bucket_id, o.name
      from storage.objects o
     where o.owner = uid
        or exists (select 1 from unnest(prefixes) pfx where starts_with(o.name, pfx));
end $$;

create or replace function public.reconcile_referral_rewards(p_code text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_ptype text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner <> auth.uid() then return; end if;

  select coalesce(profile_type, 'individual') into v_ptype
    from billing_profiles where user_id = v_owner;
  v_ptype := coalesce(v_ptype, 'individual');

  if v_ptype = 'professional' then return; end if;

  insert into referral_rewards (user_id, referral_id, kind, months, tier, reason, status)
  select v_owner, r.id, 'slot', 1, 'owner', 'per_referral', 'pending'
    from referrals r
   where r.referrer_user_id = v_owner and r.activated_at is not null
  on conflict (user_id, referral_id, reason) where referral_id is not null do nothing;

  insert into referral_rewards (user_id, referral_id, kind, months, tier, reason, status)
  select v_owner, r.id, 'months', 1, 'owner', 'per_referral_pro', 'pending'
    from referrals r
    join billing_profiles bp on bp.user_id = r.referred_user_id
   where r.referrer_user_id = v_owner and r.activated_at is not null
     and coalesce(bp.profile_type, 'individual') = 'professional'
  on conflict (user_id, referral_id, reason) where referral_id is not null do nothing;
end;
$$;

create or replace function public.redeem_referral(p_code text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_created timestamptz;
  v_ref_phone text;
  v_new_phone text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_code is null or length(trim(p_code)) = 0 then return; end if;

  select user_id into v_owner from referral_codes where code = p_code;
  if v_owner is null or v_owner = auth.uid() then return; end if;

  select created_at into v_created from auth.users where id = auth.uid();
  if v_created is null or v_created < now() - interval '14 days' then return; end if;

  select nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
    into v_ref_phone from billing_profiles where user_id = v_owner;
  select nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
    into v_new_phone from billing_profiles where user_id = auth.uid();

  v_ref_phone := case
    when v_ref_phone like '0030%' then substr(v_ref_phone, 5)
    when v_ref_phone like '30%' and length(v_ref_phone) = 12 then substr(v_ref_phone, 3)
    else v_ref_phone end;
  v_new_phone := case
    when v_new_phone like '0030%' then substr(v_new_phone, 5)
    when v_new_phone like '30%' and length(v_new_phone) = 12 then substr(v_new_phone, 3)
    else v_new_phone end;

  if v_ref_phone is not null and length(v_ref_phone) >= 9 and v_ref_phone = v_new_phone then
    return;
  end if;

  insert into referrals (code, referred_user_id, referrer_user_id)
       values (p_code, auth.uid(), v_owner)
  on conflict (referred_user_id) do nothing;
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
  update organizations set name = coalesce(nullif(trim(p_name), ''), name) where owner_user_id = auth.uid();
end; $$;

create or replace function public.request_member_edit()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update organization_members set edit_requested_at = now()
   where user_id = auth.uid() and status = 'active' and role <> 'owner' and coalesce(can_edit, false) = false;
end; $$;

create or replace function public.request_org_upgrade()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update organizations set upgrade_requested_at = now()
   where owner_user_id = auth.uid();
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

create or replace function public.rotate_calendar_feed()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
  fresh text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if uid is null then
    raise exception 'CALENDAR_ANON: χωρίς σύνδεση δεν αλλάζει διεύθυνση'
      using errcode = 'insufficient_privilege';
  end if;
  fresh := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.calendar_feed_tokens (user_id, token)
  values (uid, fresh)
  on conflict (user_id) do update
    set token = excluded.token, expires_at = excluded.expires_at;
  return fresh;
end;
$$;

create or replace function public.rotate_inbound_mailbox()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
  fresh text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if uid is null then
    raise exception 'INBOUND_ANON: χωρίς σύνδεση δεν αλλάζει διεύθυνση'
      using errcode = 'insufficient_privilege';
  end if;
  fresh := public.new_inbound_token();
  insert into public.inbound_mailboxes (user_id, token, rotated_at)
  values (uid, fresh, now())
  on conflict (user_id) do update
    set token = excluded.token, rotated_at = now(), active = true;
  return fresh;
end;
$$;

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
  select id into v_org from organizations where owner_user_id = auth.uid();
  if v_org is null then return; end if;
  update organization_members
     set can_edit = coalesce(p_can, false), edit_requested_at = null
   where org_id = v_org and lower(email) = lower(p_email) and role <> 'owner';
end; $$;

create or replace function public.set_portal_pin(p_token text, p_pin text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare v_ok int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update portal_links
    set pin_hash = case when coalesce(trim(p_pin), '') = '' then null else crypt(p_pin, gen_salt('bf')) end
    where token = p_token and user_id = auth.uid();
  get diagnostics v_ok = row_count;
  return v_ok > 0;
end; $$;

create or replace function public.submit_feedback(p_body text, p_target text DEFAULT 'general'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_words int;
  v_camp  text;
  v_active boolean;
  v_email text;
  v_min   int := 12;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return jsonb_build_object('status', 'error'); end if;

  v_words := public.count_real_words(p_body);
  if v_words < v_min then
    return jsonb_build_object('status', 'too_short', 'min', v_min, 'words', v_words);
  end if;

  if exists (
    select 1 from user_feedback
     where user_id = v_uid and date_trunc('month', created_at) = date_trunc('month', now())
  ) then
    return jsonb_build_object('status', 'already');
  end if;

  select campaign_id, active into v_camp, v_active from public.feedback_campaign(now());
  select email into v_email from auth.users where id = v_uid;

  insert into user_feedback(user_id, email, body, word_count, target, campaign_id, in_pool)
  values (v_uid, v_email, left(p_body, 4000), v_words,
          coalesce(nullif(p_target, ''), 'general'),
          case when v_active then v_camp else null end,
          v_active);

  return jsonb_build_object('status', 'ok', 'in_pool', v_active,
                            'campaign', case when v_active then v_camp else null end);
end; $$;

create or replace function public.sync_comp_from_referrals()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_months int;
  v_slots  int;
  v_ptype  text;
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

  select coalesce(profile_type, 'individual') into v_ptype
    from billing_profiles where user_id = v_uid;
  v_target := case when v_ptype = 'professional' then 'agency' else 'owner' end;

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
