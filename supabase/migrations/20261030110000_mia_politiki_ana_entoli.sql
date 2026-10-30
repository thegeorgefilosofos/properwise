-- ═══════════════════════════════════════════════════════════════════════════
-- ΜΙΑ PERMISSIVE ΠΟΛΙΤΙΚΗ ΑΝΑ ΕΝΤΟΛΗ ΚΑΙ ΤΡΙΑ ΠΕΡΙΤΤΑ INDEX ΛΙΓΟΤΕΡΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΠΡΟΒΛΗΜΑ, ΜΕΤΡΗΜΕΝΟ. Ο performance advisor της Supabase (30/10/2026)
-- έβγαζε 240 ευρήματα `multiple_permissive_policies` σε 18 πίνακες. Π.χ. στο
-- `bills` ίσχυαν μαζί η `own_bills` (FOR ALL) και οι `org_read_bills`,
-- `org_edit_bills`, `org_del_bills`. Η Postgres αποτιμά ΚΑΘΕ permissive
-- πολιτική για κάθε γραμμή και κάνει OR στα αποτελέσματα. Και όλες ήταν για τον
-- ρόλο `public`, άρα αποτιμώνταν και για τον `anon`, που δεν περνά ποτέ.
--
-- Η ΔΙΟΡΘΩΣΗ. Για κάθε πίνακα, μία permissive πολιτική ανά εντολή, γραμμένη ως
-- το OR των παλιών που κάλυπταν την εντολή:
--
--   USING      = (qual_1) OR (qual_2) …
--   WITH CHECK = (check_1) OR (check_2) …, όπου μια πολιτική χωρίς WITH CHECK
--                συνεισφέρει το USING της (έτσι κάνει και η Postgres)
--
-- Η FOR ALL συνεισφέρει και στις τέσσερις εντολές. Οι εκφράσεις είναι οι
-- ΠΡΑΓΜΑΤΙΚΟΙ ορισμοί του καταλόγου (pg_policies), αντιγραμμένοι λέξη προς λέξη.
-- Ο κατάλογος του τοπικού replay και της παραγωγής ταυτίζονται για τους 18
-- πίνακες (md5 ανά πίνακα). Τα `auth.uid()` ήταν ήδη τυλιγμένα σε `(select …)`.
--
-- ΡΟΛΟΣ `authenticated` ΑΝΤΙ ΓΙΑ `public`. Κάθε παλιά έκφραση απαιτεί
-- `auth.uid()`. Για τον `anon` αυτό είναι null: το `x = null` δεν είναι αληθές,
-- το `IN (org_owner_ids(null))` είναι κενό και οι `is_org_owner` και
-- `is_active_org_member` ψάχνουν `= null`. Ο `anon` δεν περνούσε καμία, άρα
-- κανένας σκόπιμος δρόμος για τον `anon` δεν χάνεται. Οι restrictive πολιτικές
-- (mfa_, parent_, scope_, plan_) μένουν όπως είναι.
--
-- ΑΠΟΔΕΙΞΗ ΙΣΟΔΥΝΑΜΙΑΣ. Πίνακας προσβάσεων σε πραγματική Postgres, πριν και
-- μετά: 7 πρόσωπα (ιδιοκτήτης, μέλος με επεξεργασία, μέλος χωρίς επεξεργασία
-- με και χωρίς οικονομικά, προσκεκλημένος, ξένος, anon) × 18 πίνακες ×
-- ανάγνωση, ενημέρωση, διαγραφή, εισαγωγή. Ταυτόσημος. Στο CI το
-- scripts/db/write-flows.ts ελέγχει μέλος, ξένο και anon πάνω στο `bills`.
--
-- ΤΑ INDEX. Από τα 32 «αχρησιμοποίητα» του advisor φεύγουν ΜΟΝΟ τρία, όσα είναι
-- αριστερό πρόθεμα άλλου index του ίδιου πίνακα (ίδια στήλη πρώτη, χωρίς
-- UNIQUE, χωρίς constraint, χωρίς μερική συνθήκη). Το ευρύτερο index μένει και
-- καλύπτει και το ξένο κλειδί. Τα άλλα 29 μένουν: με 8 χρήστες το
-- «αχρησιμοποίητο» δεν σημαίνει «περιττό».
--
-- ΜΙΑ ΣΥΝΑΛΛΑΓΗ: ή αλλάζουν όλα ή τίποτα. Ιδιοδύναμη: κάθε `drop` έχει
-- `if exists`, οπότε δεύτερη εκτέλεση ξαναχτίζει τα ίδια.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── bills ─────────────────────────────────────────────────────────────────
-- πριν: org_del_bills, org_edit_bills, org_read_bills, own_bills
drop policy if exists org_del_bills on public.bills;
drop policy if exists org_edit_bills on public.bills;
drop policy if exists org_read_bills on public.bills;
drop policy if exists own_bills on public.bills;
drop policy if exists sel_bills on public.bills;
-- select: own_bills + org_read_bills
create policy sel_bills on public.bills as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (bills.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_bills on public.bills;
-- insert: own_bills
create policy ins_bills on public.bills as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_bills on public.bills;
-- update: own_bills + org_edit_bills
create policy upd_bills on public.bills as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (bills.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (bills.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_bills on public.bills;
-- delete: own_bills + org_del_bills
create policy del_bills on public.bills as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (bills.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── checklist_items ───────────────────────────────────────────────────────
-- πριν: org_del_checklist_items, org_edit_checklist_items, org_read_checklist_items, own_checklist_items
drop policy if exists org_del_checklist_items on public.checklist_items;
drop policy if exists org_edit_checklist_items on public.checklist_items;
drop policy if exists org_read_checklist_items on public.checklist_items;
drop policy if exists own_checklist_items on public.checklist_items;
drop policy if exists sel_checklist_items on public.checklist_items;
-- select: own_checklist_items + org_read_checklist_items
create policy sel_checklist_items on public.checklist_items as permissive for select to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_checklist_items on public.checklist_items;
-- insert: own_checklist_items
create policy ins_checklist_items on public.checklist_items as permissive for insert to authenticated
  with check (
      (EXISTS ( SELECT 1
         FROM user_properties p
        WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id = ( SELECT auth.uid() AS uid)))))
  );
drop policy if exists upd_checklist_items on public.checklist_items;
-- update: own_checklist_items + org_edit_checklist_items
create policy upd_checklist_items on public.checklist_items as permissive for update to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_checklist_items on public.checklist_items;
-- delete: own_checklist_items + org_del_checklist_items
create policy del_checklist_items on public.checklist_items as permissive for delete to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (checklist_items.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── client_stays ──────────────────────────────────────────────────────────
-- πριν: org_del_client_stays, org_edit_client_stays, org_read_client_stays, own_client_stays
drop policy if exists org_del_client_stays on public.client_stays;
drop policy if exists org_edit_client_stays on public.client_stays;
drop policy if exists org_read_client_stays on public.client_stays;
drop policy if exists own_client_stays on public.client_stays;
drop policy if exists sel_client_stays on public.client_stays;
-- select: own_client_stays + org_read_client_stays
create policy sel_client_stays on public.client_stays as permissive for select to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = client_stays.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_client_stays on public.client_stays;
-- insert: own_client_stays
create policy ins_client_stays on public.client_stays as permissive for insert to authenticated
  with check (
      (user_id = ( SELECT auth.uid() AS uid))
  );
drop policy if exists upd_client_stays on public.client_stays;
-- update: own_client_stays + org_edit_client_stays
create policy upd_client_stays on public.client_stays as permissive for update to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = client_stays.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = client_stays.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_client_stays on public.client_stays;
-- delete: own_client_stays + org_del_client_stays
create policy del_client_stays on public.client_stays as permissive for delete to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = client_stays.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── clients ───────────────────────────────────────────────────────────────
-- πριν: org_del_clients, org_edit_clients, org_read_clients, own_clients
drop policy if exists org_del_clients on public.clients;
drop policy if exists org_edit_clients on public.clients;
drop policy if exists org_read_clients on public.clients;
drop policy if exists own_clients on public.clients;
drop policy if exists sel_clients on public.clients;
-- select: own_clients + org_read_clients
create policy sel_clients on public.clients as permissive for select to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))
  );
drop policy if exists ins_clients on public.clients;
-- insert: own_clients
create policy ins_clients on public.clients as permissive for insert to authenticated
  with check (
      (user_id = ( SELECT auth.uid() AS uid))
  );
drop policy if exists upd_clients on public.clients;
-- update: own_clients + org_edit_clients
create policy upd_clients on public.clients as permissive for update to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  )
  with check (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  );
drop policy if exists del_clients on public.clients;
-- delete: own_clients + org_del_clients
create policy del_clients on public.clients as permissive for delete to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  );

-- ── contacts ──────────────────────────────────────────────────────────────
-- πριν: org_del_contacts, org_edit_contacts, org_read_contacts, own_contacts
drop policy if exists org_del_contacts on public.contacts;
drop policy if exists org_edit_contacts on public.contacts;
drop policy if exists org_read_contacts on public.contacts;
drop policy if exists own_contacts on public.contacts;
drop policy if exists sel_contacts on public.contacts;
-- select: own_contacts + org_read_contacts
create policy sel_contacts on public.contacts as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (contacts.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_contacts on public.contacts;
-- insert: own_contacts
create policy ins_contacts on public.contacts as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_contacts on public.contacts;
-- update: own_contacts + org_edit_contacts
create policy upd_contacts on public.contacts as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (contacts.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (contacts.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_contacts on public.contacts;
-- delete: own_contacts + org_del_contacts
create policy del_contacts on public.contacts as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (contacts.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── expenses ──────────────────────────────────────────────────────────────
-- πριν: org_del_expenses, org_edit_expenses, org_read_expenses, own_expenses
drop policy if exists org_del_expenses on public.expenses;
drop policy if exists org_edit_expenses on public.expenses;
drop policy if exists org_read_expenses on public.expenses;
drop policy if exists own_expenses on public.expenses;
drop policy if exists sel_expenses on public.expenses;
-- select: own_expenses + org_read_expenses
create policy sel_expenses on public.expenses as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (expenses.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_expenses on public.expenses;
-- insert: own_expenses
create policy ins_expenses on public.expenses as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_expenses on public.expenses;
-- update: own_expenses + org_edit_expenses
create policy upd_expenses on public.expenses as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (expenses.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (expenses.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_expenses on public.expenses;
-- delete: own_expenses + org_del_expenses
create policy del_expenses on public.expenses as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (expenses.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── inventory_items ───────────────────────────────────────────────────────
-- πριν: org_del_inventory_items, org_edit_inventory_items, org_read_inventory_items, own_inventory_items
drop policy if exists org_del_inventory_items on public.inventory_items;
drop policy if exists org_edit_inventory_items on public.inventory_items;
drop policy if exists org_read_inventory_items on public.inventory_items;
drop policy if exists own_inventory_items on public.inventory_items;
drop policy if exists sel_inventory_items on public.inventory_items;
-- select: own_inventory_items + org_read_inventory_items
create policy sel_inventory_items on public.inventory_items as permissive for select to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_inventory_items on public.inventory_items;
-- insert: own_inventory_items
create policy ins_inventory_items on public.inventory_items as permissive for insert to authenticated
  with check (
      (EXISTS ( SELECT 1
         FROM user_properties p
        WHERE ((p.id = inventory_items.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))
  );
drop policy if exists upd_inventory_items on public.inventory_items;
-- update: own_inventory_items + org_edit_inventory_items
create policy upd_inventory_items on public.inventory_items as permissive for update to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_inventory_items on public.inventory_items;
-- delete: own_inventory_items + org_del_inventory_items
create policy del_inventory_items on public.inventory_items as permissive for delete to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_items.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── inventory_maintenance ─────────────────────────────────────────────────
-- πριν: org_del_inventory_maintenance, org_edit_inventory_maintenance, org_read_inventory_maintenance, own_inventory_maintenance
drop policy if exists org_del_inventory_maintenance on public.inventory_maintenance;
drop policy if exists org_edit_inventory_maintenance on public.inventory_maintenance;
drop policy if exists org_read_inventory_maintenance on public.inventory_maintenance;
drop policy if exists own_inventory_maintenance on public.inventory_maintenance;
drop policy if exists sel_inventory_maintenance on public.inventory_maintenance;
-- select: own_inventory_maintenance + org_read_inventory_maintenance
create policy sel_inventory_maintenance on public.inventory_maintenance as permissive for select to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_inventory_maintenance on public.inventory_maintenance;
-- insert: own_inventory_maintenance
create policy ins_inventory_maintenance on public.inventory_maintenance as permissive for insert to authenticated
  with check (
      (EXISTS ( SELECT 1
         FROM user_properties p
        WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))
  );
drop policy if exists upd_inventory_maintenance on public.inventory_maintenance;
-- update: own_inventory_maintenance + org_edit_inventory_maintenance
create policy upd_inventory_maintenance on public.inventory_maintenance as permissive for update to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_inventory_maintenance on public.inventory_maintenance;
-- delete: own_inventory_maintenance + org_del_inventory_maintenance
create policy del_inventory_maintenance on public.inventory_maintenance as permissive for delete to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = inventory_maintenance.property_id) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── loans ─────────────────────────────────────────────────────────────────
-- πριν: org_del_loans, org_edit_loans, org_read_loans, own_loans
drop policy if exists org_del_loans on public.loans;
drop policy if exists org_edit_loans on public.loans;
drop policy if exists org_read_loans on public.loans;
drop policy if exists own_loans on public.loans;
drop policy if exists sel_loans on public.loans;
-- select: own_loans + org_read_loans
create policy sel_loans on public.loans as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (loans.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_loans on public.loans;
-- insert: own_loans
create policy ins_loans on public.loans as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_loans on public.loans;
-- update: own_loans + org_edit_loans
create policy upd_loans on public.loans as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (loans.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (loans.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_loans on public.loans;
-- delete: own_loans + org_del_loans
create policy del_loans on public.loans as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (loans.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── maintenance_tasks ─────────────────────────────────────────────────────
-- πριν: org_del_maintenance_tasks, org_edit_maintenance_tasks, org_read_maintenance_tasks, own_maintenance_tasks
drop policy if exists org_del_maintenance_tasks on public.maintenance_tasks;
drop policy if exists org_edit_maintenance_tasks on public.maintenance_tasks;
drop policy if exists org_read_maintenance_tasks on public.maintenance_tasks;
drop policy if exists own_maintenance_tasks on public.maintenance_tasks;
drop policy if exists sel_maintenance_tasks on public.maintenance_tasks;
-- select: own_maintenance_tasks + org_read_maintenance_tasks
create policy sel_maintenance_tasks on public.maintenance_tasks as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (maintenance_tasks.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_maintenance_tasks on public.maintenance_tasks;
-- insert: own_maintenance_tasks
create policy ins_maintenance_tasks on public.maintenance_tasks as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_maintenance_tasks on public.maintenance_tasks;
-- update: own_maintenance_tasks + org_edit_maintenance_tasks
create policy upd_maintenance_tasks on public.maintenance_tasks as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (maintenance_tasks.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (maintenance_tasks.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_maintenance_tasks on public.maintenance_tasks;
-- delete: own_maintenance_tasks + org_del_maintenance_tasks
create policy del_maintenance_tasks on public.maintenance_tasks as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (maintenance_tasks.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── organization_members ──────────────────────────────────────────────────
-- πριν: org_members_owner, org_members_self_read
drop policy if exists org_members_owner on public.organization_members;
drop policy if exists org_members_self_read on public.organization_members;
drop policy if exists sel_organization_members on public.organization_members;
-- select: org_members_owner + org_members_self_read
create policy sel_organization_members on public.organization_members as permissive for select to authenticated
  using (
      (private.is_org_owner(org_id, ( SELECT auth.uid() AS uid)))
   OR ((user_id = ( SELECT auth.uid() AS uid)))
  );
drop policy if exists ins_organization_members on public.organization_members;
-- insert: org_members_owner
create policy ins_organization_members on public.organization_members as permissive for insert to authenticated
  with check (
      private.is_org_owner(org_id, ( SELECT auth.uid() AS uid))
  );
drop policy if exists upd_organization_members on public.organization_members;
-- update: org_members_owner
create policy upd_organization_members on public.organization_members as permissive for update to authenticated
  using (
      private.is_org_owner(org_id, ( SELECT auth.uid() AS uid))
  )
  with check (
      private.is_org_owner(org_id, ( SELECT auth.uid() AS uid))
  );
drop policy if exists del_organization_members on public.organization_members;
-- delete: org_members_owner
create policy del_organization_members on public.organization_members as permissive for delete to authenticated
  using (
      private.is_org_owner(org_id, ( SELECT auth.uid() AS uid))
  );

-- ── organizations ─────────────────────────────────────────────────────────
-- πριν: org_member_read, org_owner_all
drop policy if exists org_member_read on public.organizations;
drop policy if exists org_owner_all on public.organizations;
drop policy if exists sel_organizations on public.organizations;
-- select: org_owner_all + org_member_read
create policy sel_organizations on public.organizations as permissive for select to authenticated
  using (
      ((owner_user_id = ( SELECT auth.uid() AS uid)))
   OR (private.is_active_org_member(id, ( SELECT auth.uid() AS uid)))
  );
drop policy if exists ins_organizations on public.organizations;
-- insert: org_owner_all
create policy ins_organizations on public.organizations as permissive for insert to authenticated
  with check (
      (owner_user_id = ( SELECT auth.uid() AS uid))
  );
drop policy if exists upd_organizations on public.organizations;
-- update: org_owner_all
create policy upd_organizations on public.organizations as permissive for update to authenticated
  using (
      (owner_user_id = ( SELECT auth.uid() AS uid))
  )
  with check (
      (owner_user_id = ( SELECT auth.uid() AS uid))
  );
drop policy if exists del_organizations on public.organizations;
-- delete: org_owner_all
create policy del_organizations on public.organizations as permissive for delete to authenticated
  using (
      (owner_user_id = ( SELECT auth.uid() AS uid))
  );

-- ── property_documents ────────────────────────────────────────────────────
-- πριν: org_del_property_documents, org_edit_property_documents, org_read_property_documents, own_property_documents
drop policy if exists org_del_property_documents on public.property_documents;
drop policy if exists org_edit_property_documents on public.property_documents;
drop policy if exists org_read_property_documents on public.property_documents;
drop policy if exists own_property_documents on public.property_documents;
drop policy if exists sel_property_documents on public.property_documents;
-- select: own_property_documents + org_read_property_documents
create policy sel_property_documents on public.property_documents as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_documents.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_property_documents on public.property_documents;
-- insert: own_property_documents
create policy ins_property_documents on public.property_documents as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_property_documents on public.property_documents;
-- update: own_property_documents + org_edit_property_documents
create policy upd_property_documents on public.property_documents as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_documents.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_documents.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_property_documents on public.property_documents;
-- delete: own_property_documents + org_del_property_documents
create policy del_property_documents on public.property_documents as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_documents.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── property_plan ─────────────────────────────────────────────────────────
-- πριν: org_edit_property_plan, org_read_property_plan, org_write_property_plan, own_property_plan
drop policy if exists org_edit_property_plan on public.property_plan;
drop policy if exists org_read_property_plan on public.property_plan;
drop policy if exists org_write_property_plan on public.property_plan;
drop policy if exists own_property_plan on public.property_plan;
drop policy if exists sel_property_plan on public.property_plan;
-- select: own_property_plan + org_read_property_plan
create policy sel_property_plan on public.property_plan as permissive for select to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_property_plan on public.property_plan;
-- insert: own_property_plan + org_write_property_plan
create policy ins_property_plan on public.property_plan as permissive for insert to authenticated
  with check (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists upd_property_plan on public.property_plan;
-- update: own_property_plan + org_edit_property_plan
create policy upd_property_plan on public.property_plan as permissive for update to authenticated
  using (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  )
  with check (
      ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE ((p.id = property_plan.property_id) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists del_property_plan on public.property_plan;
-- delete: own_property_plan
create policy del_property_plan on public.property_plan as permissive for delete to authenticated
  using (
      (EXISTS ( SELECT 1
         FROM user_properties p
        WHERE ((p.id = property_plan.property_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))
  );

-- ── property_settings ─────────────────────────────────────────────────────
-- πριν: org_del_property_settings, org_edit_property_settings, org_read_property_settings, own_property_settings
drop policy if exists org_del_property_settings on public.property_settings;
drop policy if exists org_edit_property_settings on public.property_settings;
drop policy if exists org_read_property_settings on public.property_settings;
drop policy if exists own_property_settings on public.property_settings;
drop policy if exists sel_property_settings on public.property_settings;
-- select: own_property_settings + org_read_property_settings
create policy sel_property_settings on public.property_settings as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_settings.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_property_settings on public.property_settings;
-- insert: own_property_settings
create policy ins_property_settings on public.property_settings as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_property_settings on public.property_settings;
-- update: own_property_settings + org_edit_property_settings
create policy upd_property_settings on public.property_settings as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_settings.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_settings.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_property_settings on public.property_settings;
-- delete: own_property_settings + org_del_property_settings
create policy del_property_settings on public.property_settings as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (property_settings.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── rent_payments ─────────────────────────────────────────────────────────
-- πριν: org_read_rent_payments, own_rent_payments
drop policy if exists org_read_rent_payments on public.rent_payments;
drop policy if exists own_rent_payments on public.rent_payments;
drop policy if exists sel_rent_payments on public.rent_payments;
-- select: own_rent_payments + org_read_rent_payments
create policy sel_rent_payments on public.rent_payments as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (rent_payments.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_rent_payments on public.rent_payments;
-- insert: own_rent_payments
create policy ins_rent_payments on public.rent_payments as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_rent_payments on public.rent_payments;
-- update: own_rent_payments
create policy upd_rent_payments on public.rent_payments as permissive for update to authenticated
  using (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  )
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists del_rent_payments on public.rent_payments;
-- delete: own_rent_payments
create policy del_rent_payments on public.rent_payments as permissive for delete to authenticated
  using (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );

-- ── tenants ───────────────────────────────────────────────────────────────
-- πριν: org_del_tenants, org_edit_tenants, org_read_tenants, own_tenants
drop policy if exists org_del_tenants on public.tenants;
drop policy if exists org_edit_tenants on public.tenants;
drop policy if exists org_read_tenants on public.tenants;
drop policy if exists own_tenants on public.tenants;
drop policy if exists sel_tenants on public.tenants;
-- select: own_tenants + org_read_tenants
create policy sel_tenants on public.tenants as permissive for select to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (tenants.property_id)::text) AND (p.user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids))))))
  );
drop policy if exists ins_tenants on public.tenants;
-- insert: own_tenants
create policy ins_tenants on public.tenants as permissive for insert to authenticated
  with check (
      (user_id = ( SELECT auth.uid() AS uid))
  );
drop policy if exists upd_tenants on public.tenants;
-- update: own_tenants + org_edit_tenants
create policy upd_tenants on public.tenants as permissive for update to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (tenants.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  )
  with check (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (tenants.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );
drop policy if exists del_tenants on public.tenants;
-- delete: own_tenants + org_del_tenants
create policy del_tenants on public.tenants as permissive for delete to authenticated
  using (
      ((user_id = ( SELECT auth.uid() AS uid)))
   OR ((EXISTS ( SELECT 1
          FROM user_properties p
         WHERE (((p.id)::text = (tenants.property_id)::text) AND (p.user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids))))))
  );

-- ── user_properties ───────────────────────────────────────────────────────
-- πριν: org_del_properties, org_edit_properties, org_read_properties, own_user_properties
drop policy if exists org_del_properties on public.user_properties;
drop policy if exists org_edit_properties on public.user_properties;
drop policy if exists org_read_properties on public.user_properties;
drop policy if exists own_user_properties on public.user_properties;
drop policy if exists sel_user_properties on public.user_properties;
-- select: own_user_properties + org_read_properties
create policy sel_user_properties on public.user_properties as permissive for select to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((user_id IN ( SELECT private.org_owner_ids(( SELECT auth.uid() AS uid)) AS org_owner_ids)))
  );
drop policy if exists ins_user_properties on public.user_properties;
-- insert: own_user_properties
create policy ins_user_properties on public.user_properties as permissive for insert to authenticated
  with check (
      ((user_id)::text = (( SELECT auth.uid() AS uid))::text)
  );
drop policy if exists upd_user_properties on public.user_properties;
-- update: own_user_properties + org_edit_properties
create policy upd_user_properties on public.user_properties as permissive for update to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  )
  with check (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  );
drop policy if exists del_user_properties on public.user_properties;
-- delete: own_user_properties + org_del_properties
create policy del_user_properties on public.user_properties as permissive for delete to authenticated
  using (
      (((user_id)::text = (( SELECT auth.uid() AS uid))::text))
   OR ((user_id IN ( SELECT private.org_editor_owner_ids(( SELECT auth.uid() AS uid)) AS org_editor_owner_ids)))
  );
-- ── Index: αριστερά προθέματα άλλου index ──────────────────────────────────
drop index if exists public.tenants_property_idx;       -- μένει: tenants_property_created_idx (property_id, created_at desc)
drop index if exists public.idx_rent_payments_tenant;   -- μένει: rent_payments_tenant_period_key (tenant_id, period_year, period_month), unique
drop index if exists public.portal_links_property_idx;  -- μένει: portal_links_property_id_user_id_key (property_id, user_id), constraint

commit;
