-- ═══════════════════════════════════════════════════════════════════════════
-- ΘΩΡΑΚΙΣΗ: ΙΔΙΩΤΙΚΕΣ ΦΩΤΟΓΡΑΦΙΕΣ ΑΠΟΓΡΑΦΗΣ, ΚΛΕΙΣΤΟΣ ANON, ΛΕΙΤΟΥΡΓΙΚΑ ΜΟΝΟ ΣΕ ADMIN
-- ─────────────────────────────────────────────────────────────────────────
-- Πηγή: έλεγχος ασφάλειας της 10/11/2026 στη βάση της παραγωγής, μόνο με
-- SELECT. Τα αποτελέσματα που στηρίζουν κάθε ενότητα γράφονται μέσα της.
-- Κανένα εύρημα δεν έδειχνε ανάγνωση δεδομένων άλλου χρήστη· αυτό είναι
-- άμυνα σε βάθος, ώστε ένα μελλοντικό λάθος να μη γίνει διαρροή.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΤΟ BUCKET «inventory-photos» ΓΙΝΕΤΑΙ ΙΔΙΩΤΙΚΟ ──────────────────────
-- Ηταν `public = true` και ο κώδικας έγραφε στη βάση το μόνιμο δημόσιο URL
-- (getPublicUrl στα HandoverTab.tsx και ItemFormModal.tsx). Οποιος έπαιρνε ένα
-- τέτοιο URL, π.χ. από προωθημένο πρωτόκολλο παράδοσης, έβλεπε για πάντα το
-- εσωτερικό του σπιτιού. Μέτρηση 10/11/2026: 0 αρχεία στο bucket, 0 γραμμές
-- του inventory_items με φωτογραφία, άρα καμία μετάπτωση δεδομένων.
-- Οι πολιτικές INSERT/UPDATE/DELETE ανά uid υπάρχουν ήδη. Ελειπε το SELECT,
-- γιατί το δημόσιο bucket σερβίριζε χωρίς αυτό· χωρίς SELECT δεν βγαίνει
-- υπογεγραμμένος σύνδεσμος (lib/storage/inventoryPhotos.ts).
update storage.buckets set public = false where id = 'inventory-photos';

-- ΤΟ ΑΚΙΝΗΤΟ ΑΠΟΦΑΣΙΖΕΙ, ΟΧΙ Ο ΦΑΚΕΛΟΣ. Η διαδρομή είναι πλέον
-- «<uid όποιου ανεβάζει>/<property_id>/…» (ItemFormModal, HandoverTab). Το
-- bucket είχε 0 αρχεία, οπότε δεν υπάρχουν παλιές διαδρομές προς μετάπτωση.
-- Ο βοηθός private.inventory_photo_visible δίνει την ίδια ορατότητα με τους
-- πίνακες της απογραφής:
--   α) ο φάκελός σου, πάντα·
--   β) αλλιώς, βλέπεις το ακίνητο (ιδιοκτήτης ή ενεργό μέλος οργανισμού του
--      ιδιοκτήτη, με κενό property_scope ή με το ακίνητο μέσα του, όπως η
--      member_sees_property) ΚΑΙ όποιος ανέβασε ανήκει στον κύκλο του
--      ιδιοκτήτη (ο ίδιος ή ενεργό μέλος οργανισμού του).
-- Ετσι ο ιδιοκτήτης βλέπει ό,τι ανέβασε μέλος του, το μέλος με scope δεν
-- βλέπει άλλο ακίνητο και ο άσχετος δεν βλέπει τίποτα. Ελέγχει απευθείας τους
-- πίνακες: η private.org_owner_ids απαντά μόνο για τον ίδιο τον καλούντα.
create or replace function private.inventory_photo_visible(p_name text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with f as (
    select (storage.foldername(p_name))[1] as uploader,
           (storage.foldername(p_name))[2] as prop
  ), p as (
    select up.id, up.user_id
      from user_properties up, f
     where f.prop ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and up.id = f.prop::uuid
  )
  select auth.uid() is not null and (
    exists (select 1 from f where f.uploader = auth.uid()::text)
    or exists (
      select 1 from p, f
       where (p.user_id = auth.uid()
              or exists (select 1 from organization_members m
                           join organizations o on o.id = m.org_id
                          where o.owner_user_id = p.user_id and m.user_id = auth.uid()
                            and m.status = 'active'
                            and (m.property_scope is null or coalesce(array_length(m.property_scope, 1), 0) = 0
                                 or p.id = any (m.property_scope))))
         and (f.uploader = p.user_id::text
              or exists (select 1 from organization_members m2
                           join organizations o2 on o2.id = m2.org_id
                          where o2.owner_user_id = p.user_id and m2.user_id::text = f.uploader
                            and m2.status = 'active'))));
$function$;
revoke execute on function private.inventory_photo_visible(text) from public, anon;
grant execute on function private.inventory_photo_visible(text) to authenticated;

drop policy if exists inventory_photos_select_own on storage.objects;
create policy inventory_photos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'inventory-photos' and (select private.inventory_photo_visible(name)));

-- ── 2. ΟΙ ΚΡΑΤΗΜΕΝΕΣ ΑΛΛΑΓΕΣ ΕΠΙΤΟΚΙΩΝ ΜΟΝΟ ΣΕ ADMIN ──────────────────────
-- Η bank_feed_held() είναι security definer και την εκτελούσε κάθε
-- συνδεδεμένος χρήστης. Την καλεί μόνο η οθόνη BankRatesAdmin.tsx. Οι
-- bank_feed_health() και market_feed_health() ΜΕΝΟΥΝ ανοιχτές: τις διαβάζει
-- το app/hooks/useMarketData.ts για να πει στον χρήστη αν τα επιτόκια είναι
-- φρέσκα. Επιστρέφουν μόνο κατάσταση, όχι δεδομένα χρηστών.
-- Ο έλεγχος admin είναι ο ίδιος με την account_is_exempt. Οποιος δεν είναι
-- admin παίρνει κενή λίστα. Η αλλαγή από sql σε plpgsql είναι για την πύλη.
create or replace function public.bank_feed_held()
 returns table(ran_at timestamp with time zone, bank_id text, field text, old_value numeric, new_value numeric, reason text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  -- Ιδια πύλη δεύτερου βήματος με κάθε definer που κρίνει με auth.uid()
  -- (scripts/db/rls-probe.sql). Ο πίνακας app_admins την έχει ήδη, οπότε η
  -- οθόνη διαχειριστή δουλεύει μόνο με δεύτερο βήμα έτσι κι αλλιώς.
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  return query
  select c.ran_at, c.bank_id, c.field, c.old_value, c.new_value, c.reason
    from public.bank_rate_changes c
   where not c.applied and c.ran_at > now() - interval '7 days'
     and exists (
       select 1 from public.app_admins a
         join auth.users u on lower(btrim(u.email)) = lower(btrim(a.email))
        where u.id = auth.uid())
   order by c.ran_at desc, c.bank_id, c.field;
end;
$function$;
revoke execute on function public.bank_feed_held() from public, anon;
grant execute on function public.bank_feed_held() to authenticated;

-- ── 3. Ο ANON ΧΑΝΕΙ ΚΑΘΕ ΔΙΚΑΙΩΜΑ ΣΤΟΥΣ ΠΙΝΑΚΕΣ, ΕΚΤΟΣ ΑΠΟ ΤΑ ΔΕΔΟΜΕΝΑ ΑΝΑΦΟΡΑΣ
-- Μέτρηση: ο anon είχε SELECT/INSERT/UPDATE/DELETE σε περίπου 70 πίνακες
-- (tenants, bank_transactions, billing_profiles, app_admins κ.ά.), δηλαδή η
-- προεπιλογή της Supabase. Τους έφραζε μόνο η RLS: ένα migration που θα
-- ξεχνούσε `enable row level security` θα άνοιγε τον πίνακα αμέσως.
-- Οι πολιτικές που αφήνουν τον anon να διαβάσει κάτι (pg_policies, ρόλος
-- public ή anon, χωρίς auth.uid) είναι μόνο: bank_rates, energy_tariffs,
-- loan_programs, market_rates, product_updates (published) και το view
-- active_loan_programs (security_invoker, διαβάζει loan_programs). Αυτά
-- ξαναπαίρνουν ΜΟΝΟ SELECT. Οι πύλες, ο έλεγχος εγγράφων και το «Πλήρωσα»
-- περνούν από security definer συναρτήσεις και δεν θέλουν δικαίωμα πίνακα.
-- Τα δικαιώματα του authenticated δεν αλλάζουν.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.bank_rates, public.energy_tariffs, public.loan_programs,
  public.market_rates, public.product_updates, public.active_loan_programs to anon;

-- Οι μελλοντικοί πίνακες ξεκινούν κλειστοί για τον anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ── 4. ΣΥΝΑΡΤΗΣΕΙΣ ΤΟΥ «private» ΠΟΥ ΔΕΧΟΝΤΑΙ ΑΥΘΑΙΡΕΤΟ UID ─────────────────
-- Ο anon εκτελούσε 13 συναρτήσεις του schema private. Οι εννέα κρίνουν με
-- auth.uid() ή με token και για τον anon απαντούν «όχι»· η
-- is_active_portal_token χρειάζεται στον anon για τις πολιτικές της πύλης.
-- Τέσσερις όμως δέχονται οποιοδήποτε uid και απαντούν για σχέσεις οργανισμού
-- (is_active_org_member, is_org_owner, org_owner_ids, org_editor_owner_ids).
-- Τις χρησιμοποιούν ΜΟΝΟ πολιτικές του ρόλου authenticated και οι definer
-- private.owns_parent_property και public.log_activity (pg_policies και
-- pg_proc, 10/11/2026). Φεύγουν από τον anon και από το public, μένουν στον
-- authenticated.
revoke execute on function private.is_active_org_member(uuid, uuid) from public, anon;
revoke execute on function private.is_org_owner(uuid, uuid) from public, anon;
revoke execute on function private.org_owner_ids(uuid) from public, anon;
revoke execute on function private.org_editor_owner_ids(uuid) from public, anon;
grant execute on function private.is_active_org_member(uuid, uuid) to authenticated;
grant execute on function private.is_org_owner(uuid, uuid) to authenticated;
grant execute on function private.org_owner_ids(uuid) to authenticated;
grant execute on function private.org_editor_owner_ids(uuid) to authenticated;
