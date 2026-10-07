-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΕΝΟΙΚΙΑΣΤΗΣ ΣΒΗΝΕΤΑΙ ΟΛΟΣ Ή ΚΑΘΟΛΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΗ ΔΙΑΔΡΟΜΗ. Πηγή του ευρήματος: ανάγνωση του
-- κώδικα (07/10/2026) και των περιορισμών του staging, όχι νόμος ή ΦΕΚ, γιατί
-- το εύρημα είναι ακεραιότητας δεδομένων. Δεν αλλάζει κανένα σχήμα· προστίθεται
-- μόνο μία συνάρτηση.
--
-- ΤΟ ΣΦΑΛΜΑ. Η «Οριστική διαγραφή» ενοικιαστή (TabTenant.tsx, `delTenant`)
-- έτρεχε από τον περιηγητή τέσσερα χωριστά αιτήματα με αυτή τη σειρά:
--
--   1. σβήσιμο του μισθωτηρίου (PDF) από τον χώρο αποθήκευσης·
--   2. delete στις δόσεις του (`rent_payments`)·
--   3. delete στις φθορές του (`tenant_damages`)·
--   4. delete στον ίδιο τον ενοικιαστή.
--
-- Τα δύο πρώτα δεν αναιρούνται. Αν το 3 ή το 4 αποτύγχανε (δίκτυο, δικαίωμα,
-- λήξη συνεδρίας) ο ενοικιαστής έμενε στην οθόνη χωρίς μισθωτήριο ΚΑΙ χωρίς
-- ιστορικό πληρωμών: οι δόσεις τροφοδοτούν το Ε2 και τα έσοδα της χρονιάς,
-- οπότε έλειπαν σιωπηλά από τη δήλωση.
--
-- ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Ο CASCADE. Μετρημένο στο staging:
--   · `tenant_damages.tenant_id`  → ON DELETE CASCADE
--   · `tenant_comm_log.tenant_id` → ON DELETE CASCADE
--   · `portal_links.tenant_id`    → ON DELETE CASCADE
--   · `rent_payments.tenant_id`   → ON DELETE SET NULL
--   · `maintenance_requests.tenant_id` → ON DELETE SET NULL
-- Ένα σκέτο delete στον ενοικιαστή θα άφηνε τις δόσεις του ορφανές, χωρίς
-- μισθωτή, να μετρούν ακόμη στα αθροίσματα. Η αλλαγή του περιορισμού σε
-- CASCADE θα άλλαζε τη συμπεριφορά για κάθε άλλη διαδρομή που σβήνει
-- ενοικιαστή (π.χ. διαγραφή ακινήτου) χωρίς να το ζητά κανείς. Άρα μία
-- συνάρτηση για αυτή τη μία ενέργεια.
--
-- Η ΔΙΟΡΘΩΣΗ. Η `delete_tenant(p_tenant_id)`:
--   · είναι SECURITY INVOKER: τρέχει με τα δικαιώματα του καλούντα, οπότε η
--     RLS κρίνει τι βλέπει και τι σβήνει, ακριβώς όπως πριν από τον περιηγητή·
--   · κλειδώνει τη γραμμή του ενοικιαστή (FOR UPDATE), ώστε δόση που γράφεται
--     ταυτόχρονα να περιμένει και να αποτύχει στο ξένο κλειδί αντί να μείνει
--     ορφανή·
--   · σβήνει φθορές, δόσεις και ενοικιαστή στην ΙΔΙΑ συναλλαγή. Αν η RLS
--     κρύψει από τη διαγραφή έστω μία γραμμή που ο καλών βλέπει, σηκώνει
--     εξαίρεση και τίποτα δεν σβήνεται (π.χ. μέλος ομάδας που μπορεί να σβήσει
--     ενοικιαστή αλλά όχι δόσεις: πριν, οι δόσεις έμεναν ορφανές)·
--   · ΔΕΝ αγγίζει τον χώρο αποθήκευσης (scripts/guard-storage-delete.mjs). Επιστρέφει
--     τις διαδρομές των αρχείων του φακέλου `<ιδιοκτήτης>/<ενοικιαστής>/` στο
--     `lease-documents`, όσες βλέπει ο καλών, για να τις σβήσει ο περιηγητής
--     ΜΕΤΑ την επιτυχία. Αν εκείνο αποτύχει, μένει αρχείο χωρίς κάτοχο, όχι
--     ενοικιαστής χωρίς ιστορικό.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `create or replace` με σταθερή υπογραφή· τα revoke/grant
-- ξανατρέχουν χωρίς σφάλμα.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.delete_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_owner    uuid;
  v_seen     integer;
  v_payments integer;
  v_damages  integer;
  v_paths    text[];
begin
  -- 1. Ο ενοικιαστής πρέπει να φαίνεται στον καλούντα. Το κλείδωμα κρατά έξω
  --    κάθε νέα δόση ή φθορά ως το τέλος της συναλλαγής.
  select t.user_id into v_owner
    from public.tenants t
   where t.id = p_tenant_id
     for update;
  if not found then
    raise exception 'tenant_not_found' using errcode = 'P0002';
  end if;

  -- 2. Φθορές. Ο CASCADE θα τις έπαιρνε έτσι κι αλλιώς· εδώ μετριούνται, ώστε
  --    όσες βλέπει ο καλών να φεύγουν με το δικό του δικαίωμα ή καθόλου.
  select count(*) into v_seen from public.tenant_damages where tenant_id = p_tenant_id;
  delete from public.tenant_damages where tenant_id = p_tenant_id;
  get diagnostics v_damages = row_count;
  if v_damages <> v_seen then
    raise exception 'damages_not_deletable' using errcode = '42501',
      detail = format('%s από %s φθορές', v_damages, v_seen);
  end if;

  -- 3. Δόσεις. Με SET NULL στο ξένο κλειδί, όποια μείνει πίσω γίνεται ορφανή
  --    και μετρά ακόμη στα έσοδα· γι' αυτό η απόκλιση ακυρώνει τα πάντα.
  select count(*) into v_seen from public.rent_payments where tenant_id = p_tenant_id;
  delete from public.rent_payments where tenant_id = p_tenant_id;
  get diagnostics v_payments = row_count;
  if v_payments <> v_seen then
    raise exception 'payments_not_deletable' using errcode = '42501',
      detail = format('%s από %s δόσεις', v_payments, v_seen);
  end if;

  -- 4. Ο ενοικιαστής. Αν η RLS επιτρέπει ανάγνωση αλλά όχι διαγραφή, εδώ
  --    σταματά και η συναλλαγή γυρίζει πίσω τα 2 και 3.
  delete from public.tenants where id = p_tenant_id;
  if not found then
    raise exception 'tenant_not_deletable' using errcode = '42501';
  end if;

  -- 5. Τα αρχεία που πρέπει να σβήσει ο περιηγητής, όσα του επιτρέπει να δει
  --    η πολιτική του χώρου αποθήκευσης.
  select coalesce(array_agg(o.name order by o.name), '{}'::text[]) into v_paths
    from storage.objects o
   where o.bucket_id = 'lease-documents'
     and o.name like v_owner::text || '/' || p_tenant_id::text || '/%';

  return jsonb_build_object(
    'paths', to_jsonb(v_paths),
    'payments', v_payments,
    'damages', v_damages
  );
end $$;

revoke all on function public.delete_tenant(uuid) from public, anon;
grant execute on function public.delete_tenant(uuid) to authenticated;

comment on function public.delete_tenant(uuid) is
  'Οριστική διαγραφή ενοικιαστή με τις φθορές και τις δόσεις του, σε μία συναλλαγή, με τα δικαιώματα του καλούντα (RLS). Δεν σβήνει αρχεία: επιστρέφει {paths, payments, damages} και ο περιηγητής σβήνει τα paths από το lease-documents μετά την επιτυχία.';
