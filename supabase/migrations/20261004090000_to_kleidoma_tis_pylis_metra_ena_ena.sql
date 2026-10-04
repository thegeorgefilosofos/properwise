-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΠΥΛΗΣ ΜΕΤΡΑ ΤΙΣ ΠΡΟΣΠΑΘΕΙΕΣ ΜΙΑ ΜΙΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΣΦΑΛΜΑ. Η `portal_pin_gate` (20261003110000) μετρούσε τις αποτυχίες του
-- κουπονιού, μετά έλεγχε τον κωδικό και μετά έγραφε την αποτυχία. Τρία βήματα
-- χωρίς καμία σειρά ανάμεσα σε ταυτόχρονες κλήσεις: οκτώ λάθος κωδικοί που
-- φτάνουν μαζί διαβάζουν όλοι «τέσσερις αποτυχίες», περνούν όλοι τον έλεγχο
-- του ορίου και γράφουν όλοι. Εξωτερικός δοκιμαστής σε Postgres 16.4 ξεκίνησε
-- με τέσσερις αποτυχίες, έστειλε οκτώ μαζί και βρήκε δώδεκα. Το όριο είναι
-- πέντε. Δηλαδή το κλείδωμα κρατούσε μόνο όποιον δοκίμαζε έναν έναν· όποιος
-- έστελνε παράλληλα δοκίμαζε όσους κωδικούς ήθελε.
--
-- Δεύτερο, μικρότερο: μέσα στην ίδια ακολουθία έτρεχε `delete` σε ΟΛΟ τον
-- πίνακα προσπαθειών, για όλα τα κουπόνια. Κάθε είσοδος σε πύλη με κωδικό
-- κλείδωνε γραμμές άλλων κουπονιών.
--
-- ΤΙ ΑΛΛΑΖΕΙ.
--   1. Η ΓΡΑΜΜΗ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΕΙΝΑΙ Η ΣΕΙΡΑ. Πριν μετρήσει, η συνάρτηση
--      κλειδώνει τη γραμμή του συνδέσμου στο `portal_links` (`for no key
--      update`: δεν εμποδίζει τα ξένα κλειδιά άλλων πινάκων). Δύο κλήσεις για
--      το ΙΔΙΟ κουπόνι περιμένουν η μία την άλλη· δύο διαφορετικά κουπόνια δεν
--      συναντιούνται ποτέ. Σε READ COMMITTED, που είναι η προεπιλογή της
--      Supabase, η δεύτερη ξαναδιαβάζει μετά την αναμονή και βλέπει την
--      αποτυχία της πρώτης.
--   2. Η ΑΠΟΤΥΧΙΑ ΑΛΛΑΖΕΙ ΚΑΙ ΤΗ ΓΡΑΜΜΗ. Σε REPEATABLE READ ή SERIALIZABLE η
--      αναμονή δεν φτάνει: η δεύτερη κλήση κρατά τη φωτογραφία της βάσης από
--      πριν και θα μετρούσε ξανά τέσσερις. Γι' αυτό όποια κλήση γράφει
--      αποτυχία ενημερώνει και τη γραμμή του συνδέσμου (ίδια τιμή, νέα
--      έκδοση). Η Postgres τότε αρνείται στη δεύτερη το κλείδωμα με σφάλμα
--      σειριοποίησης 40001, πριν ελέγξει κωδικό: τίποτα δεν δοκιμάστηκε,
--      τίποτα δεν γράφτηκε.
--   3. ΤΟ ΣΚΟΥΠΙΣΜΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΑΚΟΛΟΥΘΙΑ. Μέσα στο κλείδωμα μένει μόνο
--      ο καθαρισμός των γραμμών ΑΥΤΟΥ του κουπονιού, που τις προστατεύει ήδη
--      το ίδιο κλείδωμα. Οι παλιές γραμμές όλων των άλλων (σύνδεσμοι που
--      έληξαν, σβήστηκαν ή απλώς δεν ξανανοίχτηκαν, μαζί με τους μετρητές
--      `allow_public_submit`) φεύγουν από τη `prune_portal_pin_attempts`, κάθε
--      ώρα μέσω pg_cron. Εκείνη δεν περιμένει ποτέ κανέναν (`skip locked`),
--      οπότε δεν μπορεί να κλείσει κύκλο αδιεξόδου με την πύλη.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Οι απαντήσεις ('notfound', 'locked', 'pin', 'ok'), το όριο
-- και το παράθυρο, ο κενός κωδικός που δεν μετρά, τα δικαιώματα. Σύνδεσμος
-- χωρίς κωδικό δεν κλειδώνει τίποτα.
--
-- ΤΟ ΧΡΟΝΟΜΕΤΡΟ υπάρχει μόνο όπου υπάρχει pg_cron. Η εργασία δημιουργείται
-- όταν τρέξει αυτή η μετανάστευση, όχι πριν.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ο κοινός έλεγχος, με σειρά ────────────────────────────────────────
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

  -- Η σειρά. Μετά την αναμονή η γραμμή ξαναδιαβάζεται: ο σύνδεσμος μπορεί
  -- στο μεταξύ να απενεργοποιήθηκε, να έληξε ή να άλλαξε κωδικό.
  select id, pin_hash into v_link from portal_links
   where id = v_link.id and active = true and (expires_at is null or expires_at > now())
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

-- Ίδιο μοντέλο με το 20261003110000: μόνο οι συναρτήσεις της πύλης και ο
-- ρόλος υπηρεσίας.
revoke execute on function public.portal_pin_gate(text, text) from public, anon, authenticated;
grant  execute on function public.portal_pin_gate(text, text) to service_role;

-- ── 2. Το σκούπισμα, έξω από την πύλη ────────────────────────────────────
-- Ό,τι πέρασε το εικοσιτετράωρο δεν μετρά σε κανένα παράθυρο (το μεγαλύτερο
-- είναι μία ώρα). Σε δόσεις, με `skip locked`: γραμμή που κρατά τώρα μια
-- πύλη μένει για το επόμενο πέρασμα.
create or replace function public.prune_portal_pin_attempts(p_batch int default 5000)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_total int := 0; v_n int;
begin
  loop
    delete from portal_pin_attempts a
     where a.id in (
       select id from portal_pin_attempts
        where attempted_at < now() - interval '1 day'
        order by id
        limit greatest(p_batch, 1)
          for update skip locked);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    exit when v_n < greatest(p_batch, 1);
  end loop;
  return v_total;
end; $$;

revoke execute on function public.prune_portal_pin_attempts(int) from public, anon, authenticated;
grant  execute on function public.prune_portal_pin_attempts(int) to service_role;

-- ── 3. Κάθε ώρα, όπου υπάρχει pg_cron ────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το σκούπισμα των προσπαθειών δεν προγραμματίζεται';
    return;
  end if;

  -- portal-pin-attempts-prune: στο 17ο λεπτό κάθε ώρας, μακριά από το :00.
  if exists (select 1 from cron.job where jobname = 'portal-pin-attempts-prune') then
    perform cron.unschedule('portal-pin-attempts-prune');
  end if;
  perform cron.schedule('portal-pin-attempts-prune', '17 * * * *', 'select public.prune_portal_pin_attempts()');
end $$;
