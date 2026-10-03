-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΕΓΓΡΑΦΕΣ ΤΗΣ ΠΥΛΗΣ ΖΗΤΟΥΝ ΤΟΝ ΚΩΔΙΚΟ ΟΠΩΣ Η ΑΝΑΓΝΩΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Ο ιδιοκτήτης βάζει κωδικό στον σύνδεσμο της πύλης ακριβώς για τη
-- μέρα που ο σύνδεσμος θα φτάσει σε λάθος χέρια: προωθημένο μήνυμα, κοινός
-- υπολογιστής, πρώην ενοικιαστής. Ο κωδικός όμως ελεγχόταν ΜΟΝΟ μέσα στην
-- `get_portal_data`. Οι τρεις εγγραφές της πύλης τον αγνοούσαν:
--
--   declare_rent_payment         χωρίς κωδικό και χωρίς κανένα ταβάνι
--   submit_maintenance_request   χωρίς κωδικό (πέντε ανά ώρα, αυτό μόνο)
--   φωτογραφίες βλάβης           ο ανώνυμος έγραφε απευθείας στο ιδιωτικό
--                                `maintenance-photos`, με μόνο έλεγχο ότι ο
--                                φάκελος είναι ενεργό κουπόνι· ούτε κωδικός
--                                ούτε όριο πλήθους
--
-- Δηλαδή όποιος κρατούσε το κουπόνι χωρίς τον κωδικό δεν έβλεπε τίποτα αλλά
-- μπορούσε να δηλώσει πληρωμές που δεν έγιναν, να γεμίσει τα αιτήματα του
-- ιδιοκτήτη και να ανεβάζει αρχεία δέκα MB το ένα χωρίς τέλος.
--
-- ΤΙ ΑΛΛΑΖΕΙ.
--   1. ΕΝΑΣ ΕΛΕΓΧΟΣ ΚΩΔΙΚΟΥ ΓΙΑ ΟΛΕΣ. Η `portal_pin_gate` κάνει ό,τι έκανε μέσα
--      της η `get_portal_data`: ενεργός σύνδεσμος, κλείδωμα μετά από πέντε
--      αποτυχίες σε δεκαπέντε λεπτά, καταγραφή κάθε λάθος κωδικού. Την καλούν
--      πλέον η ανάγνωση και οι τρεις εγγραφές, οπότε μια αποτυχία στη δήλωση
--      μετρά στο ΙΔΙΟ κλείδωμα με μια αποτυχία στην είσοδο. Χωρίς κωδικό στον
--      σύνδεσμο τίποτα δεν αλλάζει για τον ενοικιαστή.
--   2. ΟΙ ΠΑΛΙΕΣ ΥΠΟΓΡΑΦΕΣ ΣΒΗΝΟΝΤΑΙ. Μια νέα παράμετρος `p_pin` σε
--      `create or replace` θα γεννούσε ΔΕΥΤΕΡΗ συνάρτηση δίπλα στην παλιά και
--      η παλιά θα έμενε καλέσιμη χωρίς κωδικό: η διόρθωση θα υπήρχε μόνο για
--      όποιον την ήθελε. Γι' αυτό `drop` πρώτα και μία υπογραφή μετά.
--   3. Η ΔΗΛΩΣΗ ΠΑΙΡΝΕΙ ΤΑΒΑΝΙ: δέκα ανά ώρα ανά σύνδεσμο, με τον ίδιο μετρητή
--      `allow_public_submit` που ήδη κόβει τα αιτήματα βλάβης.
--   4. ΟΙ ΦΩΤΟΓΡΑΦΙΕΣ ΠΕΡΝΟΥΝ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ. Η διαδρομή
--      app/api/portal/upload-url ρωτά την `portal_upload_slot` (κουπόνι,
--      κωδικός, είκοσι ανά ώρα) και μόνο τότε υπογράφει διεύθυνση ανεβάσματος
--      για τον φάκελο του κουπονιού. Η πολιτική `maint_photos_insert` φεύγει:
--      ο ανώνυμος δεν γράφει πια απευθείας στο bucket. Μένουν η ανάγνωση και η
--      διαγραφή του ιδιοκτήτη και τα όρια δέκα MB και μόνο εικόνες.
--   5. ΤΟ ΑΙΤΗΜΑ ΚΡΑΤΑ ΜΟΝΟ ΔΙΑΔΡΟΜΕΣ ΤΟΥ ΔΙΚΟΥ ΤΟΥ ΦΑΚΕΛΟΥ. Ο,τι δεν ξεκινά
--      από «<κουπόνι>/» πετιέται πριν γραφτεί.
--
-- ΠΩΣ ΑΠΑΝΤΟΥΝ ΟΙ ΔΥΟ ΕΓΓΡΑΦΕΣ. Ο τύπος μένει boolean, ώστε ένα ανοιχτό
-- παλιό παράθυρο που διαβάζει «false ή σφάλμα σημαίνει αποτυχία» να μη δείξει
-- ποτέ επιτυχία που δεν έγινε:
--   true   έγινε
--   false  δεν έγινε (άκυρος σύνδεσμος, λάθος στοιχεία)
--   null   ο κωδικός δεν έγινε δεκτός· αν δόθηκε, η αποτυχία ΓΡΑΦΤΗΚΕ
--   σφάλμα `portal_locked` ή `portal_rate_limited` όταν δεν υπάρχει τίποτα
--          να κρατηθεί: το κλείδωμα δεν καταγράφει νέα προσπάθεια και το
--          ταβάνι δεν μετρά την υποβολή που αρνήθηκε.
-- Ο λάθος κωδικός ΔΕΝ γίνεται σφάλμα: ένα σφάλμα αναιρεί τη συναλλαγή και
-- μαζί της την καταγραφή της αποτυχίας, δηλαδή το κλείδωμα δεν θα μετρούσε
-- ποτέ τίποτα.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ο κοινός έλεγχος ──────────────────────────────────────────────────
-- 'notfound'  ο σύνδεσμος δεν υπάρχει, έληξε ή απενεργοποιήθηκε
-- 'locked'    πέντε λάθος κωδικοί σε δεκαπέντε λεπτά· δεν καταγράφεται άλλη
-- 'pin'       ο σύνδεσμος έχει κωδικό και αυτός έλειπε ή ήταν λάθος
-- 'ok'        χωρίς κωδικό, ή με τον σωστό· οι αποτυχίες του κουπονιού σβήνουν
create or replace function public.portal_pin_gate(p_token text, p_pin text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_link record; v_fails int;
begin
  select * into v_link from portal_links
   where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return 'notfound'; end if;
  if v_link.pin_hash is null then return 'ok'; end if;

  -- Ο πίνακας κρατά ένα εικοσιτετράωρο, για όλα τα κουπόνια μαζί.
  delete from portal_pin_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_fails
    from portal_pin_attempts
   where token = p_token and success = false and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then return 'locked'; end if;

  if p_pin is null or crypt(p_pin, v_link.pin_hash) <> v_link.pin_hash then
    -- Ο κενός κωδικός είναι η οθόνη κλειδώματος που ρωτά, όχι προσπάθεια.
    if p_pin is not null then
      insert into portal_pin_attempts(token, success) values (p_token, false);
    end if;
    return 'pin';
  end if;

  delete from portal_pin_attempts where token = p_token;
  return 'ok';
end; $$;

-- Δεν καλείται ποτέ απευθείας: μόνο από τις συναρτήσεις της πύλης, που
-- τρέχουν ήδη ως SECURITY DEFINER.
revoke execute on function public.portal_pin_gate(text, text) from public, anon, authenticated;
grant  execute on function public.portal_pin_gate(text, text) to service_role;

-- ── 2. Η ανάγνωση ρωτά τον ίδιο έλεγχο ──────────────────────────────────
-- Ίδια υπογραφή, ίδιες απαντήσεις με πριν· το σώμα του ελέγχου μετακόμισε
-- στην `portal_pin_gate`. Το `create or replace` κρατά τα δικαιώματα.
create or replace function public.get_portal_data(p_token text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_gate text; v_link record; v_prop record; v_ten record; v_due json; v_total numeric;
begin
  v_gate := public.portal_pin_gate(p_token, p_pin);
  if v_gate = 'notfound' then return null; end if;
  if v_gate = 'locked' then return json_build_object('locked', true, 'rate_limited', true); end if;
  if v_gate = 'pin' then return json_build_object('locked', true); end if;

  select * into v_link from portal_links where token = p_token;

  select name, address, prop_type into v_prop from user_properties where id = v_link.property_id::uuid;

  -- Με δεμένο ενοικιαστή φέρνουμε ΕΚΕΙΝΟΝ: ο σύνδεσμος ανήκει σε πρόσωπο, όχι
  -- σε ακίνητο και ο προηγούμενος κάτοικος δεν επιτρέπεται να δει τον επόμενο.
  if v_link.tenant_id is not null then
    select id, monthly_rent, lease_start, lease_end, deposit_amount, full_name, rent_iban into v_ten
      from tenants where id = v_link.tenant_id;
  else
    select id, monthly_rent, lease_start, lease_end, deposit_amount, full_name, rent_iban into v_ten
      from tenants where id = public.current_tenant_of(v_link.property_id);
  end if;

  select coalesce(json_agg(json_build_object(
           'id', rp.id, 'year', rp.period_year, 'month', rp.period_month,
           'amount', rp.amount, 'due_date', rp.due_date, 'declared', rp.tenant_declared
         ) order by rp.period_year, rp.period_month), '[]'::json),
         coalesce(sum(rp.amount), 0)
    into v_due, v_total
    from rent_payments rp
    where rp.tenant_id = v_ten.id and rp.paid = false;
  return json_build_object(
    'property', json_build_object('name', v_prop.name, 'address', v_prop.address, 'type', v_prop.prop_type),
    'tenant',   json_build_object('name', v_ten.full_name, 'rent', v_ten.monthly_rent,
      'lease_start', v_ten.lease_start, 'lease_end', v_ten.lease_end, 'deposit', v_ten.deposit_amount,
      'rent_iban', v_ten.rent_iban),
    'payment_link', v_link.payment_link,
    'due',      v_due,
    'total_due', v_total
  );
end; $$;

-- ── 3. Η δήλωση πληρωμής ─────────────────────────────────────────────────
drop function if exists public.declare_rent_payment(text, uuid, text);

create or replace function public.declare_rent_payment(
  p_token text, p_payment_id uuid, p_note text, p_pin text default null
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_gate text; v_link record; v_ok int;
begin
  v_gate := public.portal_pin_gate(p_token, p_pin);
  if v_gate = 'notfound' then return false; end if;
  if v_gate = 'locked' then raise exception 'portal_locked' using errcode = 'P0001'; end if;
  if v_gate = 'pin' then return null; end if;

  if not allow_public_submit('declare', p_token, 10, interval '1 hour') then
    raise exception 'portal_rate_limited' using errcode = 'P0001';
  end if;

  select * into v_link from portal_links where token = p_token;
  if not found then return false; end if;

  update rent_payments rp
     set tenant_declared = true,
         tenant_declared_at = now(),
         tenant_note = left(coalesce(p_note,''), 500)
   where rp.id = p_payment_id
     and rp.property_id = v_link.property_id::uuid
     and rp.paid = false
     and (v_link.tenant_id is null or rp.tenant_id = v_link.tenant_id);

  get diagnostics v_ok = row_count;
  return v_ok > 0;
end; $$;

revoke execute on function public.declare_rent_payment(text, uuid, text, text) from public;
grant  execute on function public.declare_rent_payment(text, uuid, text, text) to anon, authenticated, service_role;

-- ── 4. Το αίτημα βλάβης ──────────────────────────────────────────────────
drop function if exists public.submit_maintenance_request(text, text, text, text, jsonb);

create or replace function public.submit_maintenance_request(
  p_token text, p_title text, p_description text, p_contact text,
  p_photos jsonb default '[]'::jsonb, p_pin text default null
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_gate text; v_link record; v_ten_id uuid; v_photos jsonb;
begin
  v_gate := public.portal_pin_gate(p_token, p_pin);
  if v_gate = 'notfound' then return false; end if;
  if v_gate = 'locked' then raise exception 'portal_locked' using errcode = 'P0001'; end if;
  if v_gate = 'pin' then return null; end if;

  if coalesce(trim(p_title), '') = '' then return false; end if;
  if not allow_public_submit('maint', p_token, 5, interval '1 hour') then
    raise exception 'portal_rate_limited' using errcode = 'P0001';
  end if;

  select * into v_link from portal_links where token = p_token;
  if not found then return false; end if;
  if v_link.tenant_id is not null then
    v_ten_id := v_link.tenant_id;
  else
    v_ten_id := public.current_tenant_of(v_link.property_id);
  end if;

  -- Μόνο διαδρομές του φακέλου ΑΥΤΟΥ του κουπονιού και το πολύ πέντε, όσες
  -- ανεβάζει και η φόρμα. Ο ιδιοκτήτης θα υπογράψει ό,τι μείνει εδώ.
  v_photos := coalesce(p_photos, '[]'::jsonb);
  if jsonb_typeof(v_photos) <> 'array' then v_photos := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_photos
    from (
      select value from jsonb_array_elements(v_photos)
       where jsonb_typeof(value) = 'string'
         and left(value #>> '{}', length(p_token) + 1) = p_token || '/'
         and position('..' in value #>> '{}') = 0
       limit 5
    ) t;

  insert into maintenance_requests(property_id, user_id, token, tenant_id, title, description, contact, photos)
    values (v_link.property_id, v_link.user_id, p_token, v_ten_id, left(p_title, 200), left(p_description, 2000), left(p_contact, 200), v_photos);
  return true;
end; $$;

revoke execute on function public.submit_maintenance_request(text, text, text, text, jsonb, text) from public;
grant  execute on function public.submit_maintenance_request(text, text, text, text, jsonb, text) to anon, authenticated, service_role;

-- ── 5. Η άδεια για μία φωτογραφία ────────────────────────────────────────
-- Την καλεί ΜΟΝΟ η διαδρομή του διακομιστή, με τον ρόλο υπηρεσίας, πριν
-- υπογράψει διεύθυνση ανεβάσματος. Εδώ μπορεί να απαντά json: κανένας παλιός
-- πελάτης δεν τη διαβάζει.
create or replace function public.portal_upload_slot(p_token text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_gate text;
begin
  v_gate := public.portal_pin_gate(p_token, p_pin);
  if v_gate <> 'ok' then return json_build_object('ok', false, 'reason', v_gate); end if;
  if not allow_public_submit('photo', p_token, 20, interval '1 hour') then
    return json_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  return json_build_object('ok', true);
end; $$;

revoke execute on function public.portal_upload_slot(text, text) from public, anon, authenticated;
grant  execute on function public.portal_upload_slot(text, text) to service_role;

-- ── 6. Ο ανώνυμος δεν γράφει πια στο bucket ──────────────────────────────
-- Οι διευθύνσεις ανεβάσματος που υπογράφει ο διακομιστής δεν χρειάζονται
-- πολιτική εισαγωγής: η υπογραφή είναι η άδεια. Μένουν οι δύο πολιτικές του
-- ιδιοκτήτη (ανάγνωση και διαγραφή) όπως είναι.
drop policy if exists "maint_photos_insert" on storage.objects;

-- Τα όρια του bucket ισχύουν και για την υπογεγραμμένη διεύθυνση. Γράφονται
-- ξανά εδώ για να φαίνεται ότι μένουν: δέκα MB, μόνο εικόνες.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif']
 where id = 'maintenance-photos';
