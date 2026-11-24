-- ═══════════════════════════════════════════════════════════════════════════
--  myDATA: ΠΟΙΟΙ ΛΟΓΙΣΤΕΣ ΕΙΔΟΠΟΙΟΥΝΤΑΙ ΣΕ ΠΕΡΙΣΤΑΤΙΚΟ (Ε-6, μόνο ανάγνωση)
-- ─────────────────────────────────────────────────────────────────────────
--  Για το βήμα 2 της §2α του docs/compliance/data-retention-and-incidents.md:
--  ειδοποίηση αμέσως, το αργότερο σε 24 ώρες. Ε2: κανένα κλειδί δεν φυλάσσεται,
--  οπότε αφορά όσους ΧΡΗΣΙΜΟΠΟΙΗΣΑΝ το κλειδί τους στο διάστημα του περιστατικού
--  (`key_used`), με το email τους και τους πελάτες που ζητήθηκαν.
--
--  Τρέχει με τον ρόλο υπηρεσίας ή από τον SQL editor, ΜΟΝΟ με SELECT:
--    psql "$DB" -v from="'2026-11-24 00:00+02'" -v to="'2026-11-25 00:00+02'" -f scripts/db/mydata-contacts.sql
--  Το αποτέλεσμα έχει email και ΑΦΜ: μένει στον υπεύθυνο του περιστατικού, όχι σε
--  εισιτήριο, log ή συνομιλία.
-- ═══════════════════════════════════════════════════════════════════════════
begin transaction read only;
select u.email,
       l.accountant_id,
       min(l.at) filter (where l.action = 'key_used') as first_use,
       max(l.at) filter (where l.action = 'key_used') as last_use,
       count(distinct l.afm) filter (where l.action = 'sync_fetch') as clients_fetched,
       c.joint_version, c.joint_at
  from public.mydata_access_log l
  join auth.users u on u.id = l.accountant_id
  left join public.mydata_connections c on c.accountant_id = l.accountant_id
 where l.at >= :from and l.at < :to
   and l.action in ('key_used', 'sync_fetch')
 group by u.email, l.accountant_id, c.joint_version, c.joint_at
 order by last_use desc nulls last;
rollback;
