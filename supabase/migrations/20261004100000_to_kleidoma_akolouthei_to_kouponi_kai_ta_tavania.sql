-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΚΛΕΙΔΩΜΑ ΑΚΟΛΟΥΘΕΙ ΤΟ ΚΟΥΠΟΝΙ ΚΑΙ ΦΥΛΑΕΙ ΚΑΙ ΤΑ ΤΑΒΑΝΙΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Τρία κενά που άφησε η 20261004090000. Εκείνη δεν αλλάζει: έχει ήδη τρέξει.
--
-- 1. ΤΟ ΠΑΛΙΟ ΚΟΥΠΟΝΙ ΕΒΛΕΠΕ ΤΟΝ ΝΕΟ ΣΥΝΔΕΣΜΟ. Όταν αλλάζει ο μισθωτής, η
--    εφαρμογή γράφει νέο κουπόνι στην ΙΔΙΑ γραμμή (lib/data/portal.ts,
--    `reissue`). Μια κλήση με το παλιό κουπόνι που περίμενε το κλείδωμα
--    ξαναδιάβαζε τη γραμμή μόνο με το `id` και έβρισκε τη νέα: ο κωδικός
--    ελεγχόταν και η απάντηση έλεγε στον πρώην μισθωτή αν τον βρήκε. Τώρα η
--    δεύτερη ανάγνωση ζητά και `token = p_token`. Αν το κουπόνι άλλαξε στο
--    μεταξύ, 'notfound' και τίποτα δεν γράφεται.
--
-- 2. ΤΟ ΣΚΟΥΠΙΣΜΑ ΕΛΕΓΕ «ΣΕ ΔΟΣΕΙΣ» ΑΛΛΑ ΕΤΡΕΧΕ ΣΕ ΜΙΑ ΣΥΝΑΛΛΑΓΗ. Ο βρόχος
--    κρατούσε όλες τις γραμμές ως το τέλος. Τώρα κάθε κλήση σβήνει ΜΙΑ δόση
--    (έως `p_batch`, προεπιλογή 5000) και επιστρέφει πόσες. Το χρονόμετρο
--    τρέχει κάθε δέκα λεπτά αντί για κάθε ώρα: μία δόση την ώρα θα ήταν
--    120.000 γραμμές την ημέρα, δηλαδή ένα όριο που ένας επίμονος επιτιθέμενος
--    με αρκετά κουπόνια μπορεί να φτάσει. Έξι δόσεις την ώρα κοστίζουν όσο μία
--    όταν ο πίνακας είναι άδειος.
--
-- 3. ΤΑ ΤΑΒΑΝΙΑ ΤΩΝ ΣΥΝΔΕΣΜΩΝ ΧΩΡΙΣ ΚΩΔΙΚΟ ΔΕΝ ΚΡΑΤΟΥΣΑΝ. Η πύλη απαντά 'ok'
--    χωρίς κλείδωμα όταν ο σύνδεσμος δεν έχει κωδικό και η
--    `allow_public_submit` μετρά και μετά γράφει: είκοσι ταυτόχρονες δηλώσεις
--    περνούσαν όλες, με ταβάνι δέκα. Τώρα η `allow_public_submit` κλειδώνει
--    την ίδια γραμμή του `portal_links` πριν μετρήσει και την ενημερώνει
--    όταν γράφει (όπως η πύλη για τις αποτυχίες). Το κλείδωμα το παίρνουν
--    ΜΟΝΟ οι εγγραφές: η ανάγνωση της πύλης χωρίς κωδικό δεν κλειδώνει τίποτα.
--    Το 'checkin' δεν έχει γραμμή στο `portal_links` και μένει όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η πύλη ξαναδιαβάζει με το ΙΔΙΟ κουπόνι ───────────────────────────
create or replace function public.portal_pin_gate(p_token text, p_pin text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_link record; v_fails int;
begin
  select id, pin_hash into v_link from portal_links
   where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return 'notfound'; end if;
  -- Χωρίς κωδικό δεν υπάρχει τίποτα να μετρηθεί, άρα ούτε κλείδωμα.
  if v_link.pin_hash is null then return 'ok'; end if;

  -- Η σειρά. Μετά την αναμονή η γραμμή ξαναδιαβάζεται με το ίδιο κουπόνι:
  -- ο σύνδεσμος μπορεί στο μεταξύ να πήρε νέο κουπόνι, να απενεργοποιήθηκε,
  -- να έληξε ή να άλλαξε κωδικό.
  select id, pin_hash into v_link from portal_links
   where id = v_link.id and token = p_token
     and active = true and (expires_at is null or expires_at > now())
     for no key update;
  if not found then return 'notfound'; end if;
  if v_link.pin_hash is null then return 'ok'; end if;

  -- Μόνο οι παλιές γραμμές ΑΥΤΟΥ του κουπονιού: τις φυλάει το ίδιο κλείδωμα.
  delete from portal_pin_attempts where token = p_token and attempted_at < now() - interval '1 day';

  select count(*) into v_fails
    from portal_pin_attempts
   where token = p_token and success = false and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then return 'locked'; end if;

  if p_pin is null or crypt(p_pin, v_link.pin_hash) <> v_link.pin_hash then
    -- Ο κενός κωδικός είναι η οθόνη κλειδώματος που ρωτά, όχι προσπάθεια.
    if p_pin is not null then
      insert into portal_pin_attempts(token, success) values (p_token, false);
      -- Νέα έκδοση της γραμμής: όποια κλήση περιμένει με παλιά φωτογραφία
      -- (REPEATABLE READ, SERIALIZABLE) παίρνει 40001 αντί να μετρήσει λάθος.
      update portal_links set pin_hash = pin_hash where id = v_link.id;
    end if;
    return 'pin';
  end if;

  delete from portal_pin_attempts where token = p_token;
  return 'ok';
end; $$;

revoke execute on function public.portal_pin_gate(text, text) from public, anon, authenticated;
grant  execute on function public.portal_pin_gate(text, text) to service_role;

-- ── 2. Μία δόση ανά κλήση ────────────────────────────────────────────────
create or replace function public.prune_portal_pin_attempts(p_batch int default 5000)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n int;
begin
  -- `skip locked`: γραμμή που κρατά τώρα μια πύλη μένει για την επόμενη δόση.
  delete from portal_pin_attempts a
   where a.id in (
     select id from portal_pin_attempts
      where attempted_at < now() - interval '1 day'
      limit greatest(p_batch, 1)
        for update skip locked);
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

revoke execute on function public.prune_portal_pin_attempts(int) from public, anon, authenticated;
grant  execute on function public.prune_portal_pin_attempts(int) to service_role;

-- ── 3. Το ταβάνι μετρά με σειρά ──────────────────────────────────────────
create or replace function public.allow_public_submit(
  p_kind text, p_token text, p_limit int, p_window interval
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_key text; v_count int; v_link uuid;
begin
  v_key := p_kind || ':' || p_token;

  -- Η ίδια σειρά με την πύλη: η γραμμή του συνδέσμου. Όταν ο σύνδεσμος έχει
  -- κωδικό, η πύλη την κρατά ήδη και αυτό δεν περιμένει τίποτα.
  select id into v_link from portal_links where token = p_token for no key update;

  select count(*) into v_count
    from portal_pin_attempts
   where token = v_key and attempted_at > now() - p_window;
  if v_count >= p_limit then return false; end if;
  insert into portal_pin_attempts(token, success) values (v_key, true);

  -- Νέα έκδοση της γραμμής, για τον ίδιο λόγο με την πύλη: όποια υποβολή
  -- περιμένει με παλιά φωτογραφία παίρνει 40001 αντί να ξεπεράσει το ταβάνι.
  if v_link is not null then
    update portal_links set pin_hash = pin_hash where id = v_link;
  end if;
  return true;
end; $$;

revoke execute on function public.allow_public_submit(text, text, int, interval) from public, anon, authenticated;
grant  execute on function public.allow_public_submit(text, text, int, interval) to service_role;

-- ── 4. Κάθε δέκα λεπτά, όπου υπάρχει pg_cron ─────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το σκούπισμα των προσπαθειών δεν προγραμματίζεται';
    return;
  end if;

  -- portal-pin-attempts-prune: στα λεπτά 7, 17, 27, 37, 47 και 57, μακριά από το :00.
  if exists (select 1 from cron.job where jobname = 'portal-pin-attempts-prune') then
    perform cron.unschedule('portal-pin-attempts-prune');
  end if;
  perform cron.schedule('portal-pin-attempts-prune', '7,17,27,37,47,57 * * * *', 'select public.prune_portal_pin_attempts()');
end $$;
