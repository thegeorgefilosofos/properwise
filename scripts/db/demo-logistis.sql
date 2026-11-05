-- ═══════════════════════════════════════════════════════════════════════════
--  DEMO ΛΟΓΙΣΤΙΚΟ ΓΡΑΦΕΙΟ ΓΙΑ ΔΟΚΙΜΕΣ
-- ─────────────────────────────────────────────────────────────────────────
--  ΤΡΕΧΕΙ ΜΟΝΟ ΑΦΟΥ ΕΦΑΡΜΟΣΤΟΥΝ ΟΙ ΜΕΤΑΝΑΣΤΕΥΣΕΙΣ 20261104120000 ΚΑΙ
--  20261104130000 (PR «Λογιστικά γραφεία»). Αλλιώς σταματά στο πρώτο βήμα.
--
--  ΤΙ ΚΑΝΕΙ.
--    · Κάνει τον υπάρχοντα χρήστη demo-logistis@properwise.gr Υπεύθυνο του
--      «Demo Λογιστικό Γραφείο» (λογιστικό, ΑΦΜ 000000012: περνά τον έλεγχο
--      ψηφίου και είναι φανερά δοκιμαστικός· είναι ο ίδιος με τα fixtures του
--      lib/myaade/myaade.test.ts).
--    · Συνδέει ως πελάτη του γραφείου τον demo@properwise.gr, με επίπεδο
--      «Τήρηση για λογαριασμό μου».
--    · Αν υπάρχει ο χρήστης demo-synergatis@properwise.gr, τον κάνει
--      Συνεργάτη του γραφείου με ανάθεση του demo@: για να δοκιμαστεί η μόνο
--      ανάγνωση.
--
--  ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν φτιάχνει χρήστες και δεν γράφει κωδικό πουθενά. Δεν αλλάζει
--  πακέτο ή χρέωση κανενός. Δεν αγγίζει κανένα άλλο email.
--
--  ΒΗΜΑ ΒΗΜΑ.
--    1. Supabase → Authentication → Users → «Add user» → «Create new user»:
--       demo-logistis@properwise.gr, κωδικός της επιλογής σου, «Auto Confirm
--       User» τσεκαρισμένο. Προαιρετικά το ίδιο για demo-synergatis@properwise.gr.
--    2. Supabase → SQL Editor, στο έργο της εφαρμογής: επικόλλησε ΟΛΟ το αρχείο
--       και πάτησε Run. Τρέχει ως `postgres`.
--    3. Το μήνυμα στο τέλος λέει τι έγινε. Ξανατρέχει χωρίς διπλότυπα.
--    4. Σύνδεση στην εφαρμογή ως demo-logistis@properwise.gr. Την πρώτη φορά
--       ζητά επαλήθευση δύο βημάτων (κωδικός QR σε εφαρμογή επαλήθευσης): η
--       βάση δεν απαντά σε μέλος γραφείου χωρίς αυτήν (20261104150000). Μετά
--       ανοίγει ο χώρος του γραφείου, με πελάτη τον demo@. Το ίδιο για τον
--       demo-synergatis@.
--
--  ΤΙ ΝΑ ΔΟΚΙΜΑΣΕΙΣ.
--     1. Σύνδεση ως demo-logistis@: ανοίγει κατευθείαν ο χώρος του γραφείου,
--        όχι ο πίνακας ιδιοκτήτη.
--     2. Η λίστα δείχνει τον demo@ με «Υπεύθυνος» και «Καταχώρηση ▾».
--     3. «Το γραφείο»: μέλη, ρόλοι, «Πρόσκληση μέλους» με email και ρόλο.
--     4. Ανάθεση: τσέκαρε τον πελάτη, «Ανάθεση σε…» τον Συνεργάτη, «Ανάθεση».
--     5. Τα φίλτρα «Οι πελάτες μου», «Υπεύθυνος», «Κατάσταση» κρατούν τους σωστούς.
--     6. Σύνδεση ως demo-synergatis@: βλέπει τον πελάτη, χωρίς «Ζήτησέ το»,
--        χωρίς λήψεις, χωρίς «Καταχώρηση».
--        Πριν από τις καταχωρήσεις: ο demo@ αποδέχεται την τρέχουσα σύμβαση
--        επεξεργασίας στην εφαρμογή· αλλιώς το γραφείο βλέπει «Ο πελάτης πρέπει
--        πρώτα να αποδεχτεί τους όρους επεξεργασίας» (20261105090000).
--     7. Ως demo-logistis@: «Καταχώρηση ▾ → Πληρωμή λογαριασμού» σε ακίνητο του
--        demo@, με ποσό και ημερομηνία.
--     8. «Καταχώρηση ▾ → Δόση φόρου» ή «Δόση δανείου»: σημειώνει πληρωμή σε
--        υπάρχουσα δόση, δεν φτιάχνει νέα.
--     9. «Καταχώρηση ▾ → Παραστατικό»: ανέβασμα PDF. Το βλέπει ο demo@ στο Αρχείο.
--    10. Σύνδεση ως demo@ → Λογιστική → Φάκελος λογιστή: «Demo Λογιστικό
--        Γραφείο»: σήμερα καταχώρησε … με «Δες».
--    11. «Αναίρεση όλων»: φεύγουν μόνο οι σημερινές του γραφείου· οι δικές σου μένουν.
--    12. demo@ → Ρυθμίσεις → Δεδομένα και απόρρητο: το γραφείο, από πότε, ποια
--        μέλη, πότε άνοιξε τον φάκελο και το επίπεδο σε dropdown.
--    13. Άλλαξε το επίπεδο σε «Μόνο ανάγνωση»: το «Καταχώρηση ▾» χάνεται στο γραφείο.
--    14. «Ανάκληση του γραφείου» με επιβεβαίωση: ο demo@ φεύγει από τη λίστα του
--        γραφείου και ο ανοιχτός φάκελός του στο γραφείο λέει «δεν είναι πια
--        ανοιχτός» στην επόμενη ανανέωση. Στις Ρυθμίσεις του demo@: «Ο σύνδεσμος
--        ανανεώθηκε … επειδή ανακάλεσες την πρόσβαση ενός γραφείου».
--    15. Ως demo-logistis@, άνοιξε /dashboard: γυρίζει στον χώρο του γραφείου.
--        Ακίνητο δεν καταχωρείται (η βάση το αρνείται).
--
--  UNDO, στο τέλος του αρχείου, σε σχόλιο.
-- ═══════════════════════════════════════════════════════════════════════════

do $demo$
declare
  v_firm_name constant text := 'Demo Λογιστικό Γραφείο';
  v_afm       constant text := '000000012';
  v_mgr  uuid;
  v_own  uuid;
  v_ass  uuid;
  v_firm uuid;
  v_tok  text;
  v_other text;
begin
  -- 0. Οι μεταναστεύσεις έχουν τρέξει;
  if to_regclass('public.firms') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'accountant_clients' and column_name = 'access_level') then
    raise exception 'Λείπουν οι μεταναστεύσεις 20261104120000 και 20261104130000. Τρέξε πρώτα αυτές.';
  end if;

  -- 1. Οι χρήστες υπάρχουν; Μόνο αυτά τα email.
  select id into v_mgr from auth.users where lower(email) = 'demo-logistis@properwise.gr';
  select id into v_own from auth.users where lower(email) = 'demo@properwise.gr';
  select id into v_ass from auth.users where lower(email) = 'demo-synergatis@properwise.gr';
  if v_mgr is null then raise exception 'Δεν βρέθηκε ο demo-logistis@properwise.gr. Φτιάξ'' τον πρώτα: Authentication → Users → Add user.'; end if;
  if v_own is null then raise exception 'Δεν βρέθηκε ο demo@properwise.gr.'; end if;

  -- 2. Ο λογαριασμός γραφείου δεν κρατά ακίνητα ιδιοκτήτη.
  if exists (select 1 from public.user_properties where user_id = v_mgr) then
    raise exception 'Ο demo-logistis@ έχει δικά του ακίνητα. Ο λογαριασμός γραφείου δεν κρατά ακίνητα: χρησιμοποίησε άλλο email.';
  end if;
  if v_ass is not null and exists (select 1 from public.user_properties where user_id = v_ass) then
    raise exception 'Ο demo-synergatis@ έχει δικά του ακίνητα. Ο λογαριασμός γραφείου δεν κρατά ακίνητα.';
  end if;

  -- 3. Ο demo@ δεν έχει ήδη ΑΛΛΟ γραφείο με πρόσβαση.
  select f.name into v_other
    from public.accountant_clients ac join public.firms f on f.id = ac.firm_id
   where ac.owner_id = v_own and ac.active and f.name <> v_firm_name
   limit 1;
  if v_other is not null then
    raise exception 'Ο demo@ έχει ήδη πρόσβαση από το γραφείο «%». Ανακάλεσέ την πρώτα ή τρέξε το UNDO.', v_other;
  end if;

  -- 4. Το γραφείο: το ίδιο σε κάθε εκτέλεση.
  select m.firm_id into v_firm from public.firm_members m
   where m.user_id = v_mgr and m.status = 'active' limit 1;
  if v_firm is not null and not exists (select 1 from public.firms where id = v_firm and name = v_firm_name) then
    raise exception 'Ο demo-logistis@ είναι ήδη μέλος άλλου γραφείου. Δεν το αλλάζω.';
  end if;
  if v_firm is null then
    insert into public.firms (name, afm, kind, created_by) values (v_firm_name, v_afm, 'accounting', v_mgr)
      returning id into v_firm;
    insert into public.firm_members (firm_id, user_id, email, role, status, invited_by, joined_at, firm_only)
      values (v_firm, v_mgr, 'demo-logistis@properwise.gr', 'manager', 'active', v_mgr, now(), true);
  else
    update public.firms set afm = v_afm, kind = 'accounting' where id = v_firm;
  end if;

  -- Ο λογαριασμός ανοίγει στον χώρο του γραφείου (app/dashboard: account_kind).
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"account_kind":"firm"}'::jsonb
   where id = v_mgr;

  -- 5. Ο Συνεργάτης, αν υπάρχει.
  if v_ass is not null then
    if exists (select 1 from public.firm_members where user_id = v_ass and status = 'active' and firm_id <> v_firm) then
      raise exception 'Ο demo-synergatis@ είναι ήδη μέλος άλλου γραφείου. Δεν το αλλάζω.';
    end if;
    if not exists (select 1 from public.firm_members where firm_id = v_firm and user_id = v_ass and status = 'active') then
      delete from public.firm_members where firm_id = v_firm and lower(email) = 'demo-synergatis@properwise.gr' and status <> 'active';
      insert into public.firm_members (firm_id, user_id, email, role, status, invited_by, joined_at, firm_only)
        values (v_firm, v_ass, 'demo-synergatis@properwise.gr', 'associate', 'active', v_mgr, now(), true);
    end if;
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"account_kind":"firm"}'::jsonb
     where id = v_ass;
  end if;

  -- 6. Ο σύνδεσμος του demo@: ο ενεργός του, ή ένας νέος.
  select token into v_tok from public.accountant_links
   where user_id = v_own and active and (expires_at is null or expires_at > now()) limit 1;
  if v_tok is null then
    v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.accountant_links (user_id, token, active) values (v_own, v_tok, true);
  end if;

  -- 7. Η άδεια: του γραφείου, με «Τήρηση για λογαριασμό μου».
  insert into public.accountant_clients (accountant_id, owner_id, claimed_token, active, firm_id, access_level)
    values (v_mgr, v_own, v_tok, true, v_firm, 'keep')
  on conflict (accountant_id, owner_id) do update
    set claimed_token = excluded.claimed_token, active = true, firm_id = v_firm, access_level = 'keep';

  -- 8. Ο Συνεργάτης αναλαμβάνει τον demo@ (ο Υπεύθυνος τους βλέπει όλους).
  if v_ass is not null then
    insert into public.firm_client_assignees (firm_id, owner_id, user_id, assigned_by)
      values (v_firm, v_own, v_ass, v_mgr) on conflict do nothing;
  end if;

  raise notice 'Έγινε. «%» με Υπεύθυνο τον demo-logistis@ και πελάτη τον demo@ (Τήρηση για λογαριασμό μου)%.',
    v_firm_name, case when v_ass is null then '' else '. Συνεργάτης: demo-synergatis@' end;
end
$demo$;

-- ── ΕΠΙΒΕΒΑΙΩΣΗ ────────────────────────────────────────────────────────────
select f.name as firm, f.afm, m.email, m.role, m.status
  from public.firms f join public.firm_members m on m.firm_id = f.id
 where f.name = 'Demo Λογιστικό Γραφείο'
 order by m.role;

-- ═══════════════════════════════════════════════════════════════════════════
--  UNDO. Βγάζει το demo γραφείο και ό,τι κράτησε. Οι εγγραφές που καταχώρησε
--  το γραφείο στον demo@ μένουν δικές του, με την ένδειξη προέλευσης· για να
--  φύγουν κι αυτές, τρέξε πρώτα από την εφαρμογή «Αναίρεση όλων».
--
--  do $undo$
--  declare v_firm uuid := (select id from public.firms where name = 'Demo Λογιστικό Γραφείο');
--  begin
--    delete from public.accountant_clients where firm_id = v_firm;
--    delete from public.firm_client_assignees where firm_id = v_firm;
--    delete from public.firm_members where firm_id = v_firm;
--    delete from public.firms where id = v_firm;
--    update auth.users set raw_user_meta_data = raw_user_meta_data - 'account_kind'
--     where lower(email) in ('demo-logistis@properwise.gr', 'demo-synergatis@properwise.gr');
--  end $undo$;
-- ═══════════════════════════════════════════════════════════════════════════
