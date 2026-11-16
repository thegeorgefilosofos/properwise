-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΚΑΝΟΝΕΣ ΠΡΟΣΒΑΣΗΣ ΑΝΤΕΧΟΥΝ 100.000 ΑΚΙΝΗΤΑ, ΧΩΡΙΣ ΝΑ ΑΛΛΑΞΕΙ Η ΣΗΜΑΣΙΑ ΤΟΥΣ
-- ─────────────────────────────────────────────────────────────────────────
-- Έλεγχος κλίμακας 10/11/2026, με EXPLAIN στην παραγωγή ως authenticated. Για
-- μέλος οργανισμού ή λογιστή κάθε ανάγνωση σάρωνε ΟΛΟ το user_properties, γιατί:
--   1. 50 πολιτικές συνέκριναν `(user_id)::text = (auth.uid())::text` και
--      `(p.id)::text = (x.property_id)::text`. Το cast σε text κρύβει το ευρετήριο
--      uuid. ΟΛΕΣ οι στήλες είναι uuid (επαληθευμένο στο information_schema). Και
--      για uuid η σύγκριση κειμένου ισοδυναμεί ακριβώς με τη σύγκριση uuid: κάθε
--      τιμή έχει μία μόνο μορφή κειμένου και το NULL δίνει NULL και στις δύο.
--   2. Οι 44 restrictive πολιτικές scope_* καλούσαν ανά γραμμή τις
--      member_sees_property / member_sees_financials (SECURITY DEFINER, δεν γίνονται
--      inline). Και οι δύο επιστρέφουν «όχι» ΜΟΝΟ για ενεργό μέλος οργανισμού
--      (organization_members.status = 'active'). Ο φρουρός
--      `( SELECT private.not_active_org_member()) OR <ίδια έκφραση>` αξιολογείται
--      ΜΙΑ φορά ανά ερώτημα (initplan). Όταν είναι αληθής, η αρχική έκφραση είναι
--      κι αυτή αληθής, άρα το αποτέλεσμα δεν αλλάζει ποτέ. Όλες οι 44 εκφράσεις
--      είναι καθαρές διαζεύξεις με τη συνάρτηση στην κορυφή (επαληθευμένο).
--   3. Οι 4 πολιτικές του e2_prefilled καλούσαν ανά γραμμή τη sees_owner(user_id),
--      που επιστρέφει αληθές όταν user_id = auth.uid(). Το
--      `user_id = auth.uid() OR sees_owner(user_id)` είναι ακριβώς ισοδύναμο.
--   4. Οι org_owner_ids / org_editor_owner_ids είχαν ROWS 1000 και ο planner
--      διάλεγε πλήρη σάρωση. Σε πραγματικότητα επιστρέφουν 1 έως λίγες γραμμές.
--      Το ROWS είναι μόνο εκτίμηση για τον planner, όχι συμπεριφορά.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΞΕ, ΣΚΟΠΙΜΑ. Το `user_id = auth.uid()` ως γρήγορο κλαδί στις
-- member_sees_* ΔΕΝ είναι ισοδύναμο: μια γραμμή μπορεί να έχει user_id τον χρήστη
-- και property_id ακινήτου άλλου ιδιοκτήτη. Η owns_parent_property δεν έχει
-- ισοδύναμο φθηνό κλαδί και μένει όπως είναι.
--
-- ΤΙ ΜΕΝΕΙ ΓΙΑ ΕΠΟΜΕΝΟ ΒΗΜΑ. Για ΕΝΕΡΓΟ μέλος οργανισμού ο φρουρός είναι ψευδής
-- και οι member_sees_* τρέχουν ακόμη ανά γραμμή. Το COST δεν βοηθά: ο Postgres
-- δεν αναδιατάσσει τους όρους ασφαλείας ανάμεσα σε πολιτικές (μετρημένο). Η λύση
-- είναι σύνολο «κρυφών ακινήτων» μία φορά ανά ερώτημα, με προσοχή στις
-- εκδοχές text. Θέλει δικό της PR και έλεγχο.
--
-- ΠΩΣ ΓΡΑΦΤΗΚΕ. Οι εντολές ALTER POLICY παράχθηκαν μηχανικά από τους ορισμούς
-- (pg_policies) με την ίδια γεννήτρια και στην παραγωγή και στο τοπικό replay
-- όλων των migrations. Οι δύο έξοδοι έχουν ίδιο md5
-- (0ada8314c3c5f168506e043631360df9), άρα η παραγωγή είναι ίδια με το
-- αποθετήριο. Το ALTER POLICY κρατά roles, εντολή και permissive/restrictive.
-- Ιδιοδύναμο: create or replace, alter function, alter policy με σταθερό κείμενο.
-- ═══════════════════════════════════════════════════════════════════════════

-- Ο φρουρός: αληθής όταν ο καλών ΔΕΝ είναι ενεργό μέλος κανενός οργανισμού.
-- Επιστρέφει μόνο ναι/όχι για τον ίδιο τον καλούντα. Ίδια δικαιώματα εκτέλεσης
-- με τη member_sees_property, γιατί οι restrictive πολιτικές ισχύουν σε `public`.
create or replace function private.not_active_org_member()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not exists (
    select 1 from organization_members m
     where m.user_id = auth.uid() and m.status = 'active'
  )
$function$;

alter function private.org_owner_ids(uuid) rows 5;
alter function private.org_editor_owner_ids(uuid) rows 5;


alter policy scope_fin_airbnb_bookings on public.airbnb_bookings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_airbnb_bookings on public.airbnb_bookings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_fin_bank_transactions on public.bank_transactions
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_bank_transactions on public.bank_transactions
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_bills on public.bills
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = bills.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_bills on public.bills
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_bills on public.bills
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_bills on public.bills
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_bills on public.bills
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = bills.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_bills on public.bills
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = bills.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = bills.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy own_bills_history on public.bills_history
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_bills_history on public.bills_history
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_bills_history on public.bills_history
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy own_bills_settings on public.bills_settings
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_bills_settings on public.bills_settings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_fin_book_closings on public.book_closings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_book_closings on public.book_closings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy own_calendar_events on public.calendar_events
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_calendar_events on public.calendar_events
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_checkin_links on public.checkin_links
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_checklist_items on public.checklist_items
  using (((EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_checklist_items on public.checklist_items
  with check ((EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))));
alter policy scope_property_checklist_items on public.checklist_items
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_checklist_items on public.checklist_items
  using (((EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_checklist_items on public.checklist_items
  using (((EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check (((EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = checklist_items.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_fin_client_stays on public.client_stays
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_client_stays on public.client_stays
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_contacts on public.contacts
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = contacts.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_contacts on public.contacts
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_contacts on public.contacts
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_contacts on public.contacts
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = contacts.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_contacts on public.contacts
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = contacts.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = contacts.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy e2_prefilled_delete on public.e2_prefilled
  using (((user_id = ( SELECT auth.uid() AS uid)) OR private.sees_owner(user_id)));
alter policy e2_prefilled_insert on public.e2_prefilled
  with check (((user_id = ( SELECT auth.uid() AS uid)) OR private.sees_owner(user_id)));
alter policy e2_prefilled_read on public.e2_prefilled
  using (((user_id = ( SELECT auth.uid() AS uid)) OR private.sees_owner(user_id)));
alter policy e2_prefilled_update on public.e2_prefilled
  using (((user_id = ( SELECT auth.uid() AS uid)) OR private.sees_owner(user_id)))
  with check (((user_id = ( SELECT auth.uid() AS uid)) OR private.sees_owner(user_id)));
alter policy del_expenses on public.expenses
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = expenses.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_expenses on public.expenses
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_expenses on public.expenses
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_expenses on public.expenses
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_expenses on public.expenses
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = expenses.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_expenses on public.expenses
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = expenses.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = expenses.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_property_guest_checkins on public.guest_checkins
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_ical_feeds on public.ical_feeds
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_inventory on public.inventory
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_inventory_handovers on public.inventory_handovers
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_inventory_items on public.inventory_items
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_inventory_maintenance on public.inventory_maintenance
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy own_inventory_repairs on public.inventory_repairs
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM (inventory_items i
     JOIN user_properties p ON ((p.id = i.property_id)))
  WHERE (((i.id = inventory_repairs.item_id)) AND (p.user_id = ( SELECT auth.uid() AS uid)))))))
  with check (((EXISTS ( SELECT 1
   FROM (inventory_items i
     JOIN user_properties p ON ((p.id = i.property_id)))
  WHERE (((i.id = inventory_repairs.item_id)) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR ((item_id IS NULL) AND ((user_id = ( SELECT auth.uid() AS uid))))));
alter policy del_loans on public.loans
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = loans.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_loans on public.loans
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_loans on public.loans
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_loans on public.loans
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_loans on public.loans
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = loans.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_loans on public.loans
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = loans.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = loans.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_property_maintenance_requests on public.maintenance_requests
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_maintenance_tasks on public.maintenance_tasks
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = maintenance_tasks.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_maintenance_tasks on public.maintenance_tasks
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_maintenance_tasks on public.maintenance_tasks
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_maintenance_tasks on public.maintenance_tasks
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = maintenance_tasks.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_maintenance_tasks on public.maintenance_tasks
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = maintenance_tasks.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = maintenance_tasks.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy own_notification_preferences on public.notification_preferences
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_portal_links on public.portal_links
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_pricing_settings on public.pricing_settings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy own_property_data on public.property_data
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy del_property_documents on public.property_documents
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_documents.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_property_documents on public.property_documents
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_property_documents on public.property_documents
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_property_documents on public.property_documents
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_documents.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_property_documents on public.property_documents
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_documents.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_documents.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_property_property_plan on public.property_plan
  using ((( SELECT private.not_active_org_member()) OR private.member_sees_property(property_id)))
  with check ((( SELECT private.not_active_org_member()) OR private.member_sees_property(property_id)));
alter policy del_property_settings on public.property_settings
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_settings.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy ins_property_settings on public.property_settings
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_property_settings on public.property_settings
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_property_settings on public.property_settings
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_settings.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_property_settings on public.property_settings
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_settings.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = property_settings.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_property_rent_comparables on public.rent_comparables
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy own_rent_config on public.rent_config
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_rent_config on public.rent_config
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_rent_config on public.rent_config
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_rent_payments on public.rent_payments
  using (((user_id = ( SELECT auth.uid() AS uid))));
alter policy ins_rent_payments on public.rent_payments
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_fin_rent_payments on public.rent_payments
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_rent_payments on public.rent_payments
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_rent_payments on public.rent_payments
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = rent_payments.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_rent_payments on public.rent_payments
  using (((user_id = ( SELECT auth.uid() AS uid))))
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_tenant_comm_log on public.tenant_comm_log
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy scope_property_tenant_damages on public.tenant_damages
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy del_tenants on public.tenants
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = tenants.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy scope_fin_tenants on public.tenants
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_financials(property_id))));
alter policy scope_property_tenants on public.tenants
  using ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))))
  with check ((( SELECT private.not_active_org_member()) OR ((property_id IS NULL) OR private.member_sees_property(property_id))));
alter policy sel_tenants on public.tenants
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = tenants.property_id)) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))))));
alter policy upd_tenants on public.tenants
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = tenants.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))))
  with check (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM user_properties p
  WHERE (((p.id = tenants.property_id)) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))))));
alter policy del_user_properties on public.user_properties
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))));
alter policy ins_user_properties on public.user_properties
  with check (((user_id = ( SELECT auth.uid() AS uid))));
alter policy scope_property_user_properties on public.user_properties
  using ((( SELECT private.not_active_org_member()) OR private.member_sees_property(id)))
  with check ((( SELECT private.not_active_org_member()) OR private.member_sees_property(id)));
alter policy sel_user_properties on public.user_properties
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))));
alter policy upd_user_properties on public.user_properties
  using ((((user_id = ( SELECT auth.uid() AS uid))) OR (user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))
  with check ((((user_id = ( SELECT auth.uid() AS uid))) OR (user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))));

