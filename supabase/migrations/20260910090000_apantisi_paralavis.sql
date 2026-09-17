-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΑΥΤΟΜΑΤΗ ΕΠΙΒΕΒΑΙΩΣΗ ΠΑΡΑΛΑΒΗΣ (reply_ack)
-- ─────────────────────────────────────────────────────────────────────────
-- Οταν ένας πελάτης γράφει στο support@ / privacy@ / security@properwise.gr,
-- του φεύγει ΜΙΑ επώνυμη επιβεβαίωση «το λάβαμε». Τρία αντικείμενα το κρατούν
-- σωστό και ασφαλές, με λόγο ύπαρξης το καθένα:
--
--   name_for_email   ΤΟ ΟΝΟΜΑ ΑΠΟ ΤΗ ΔΙΕΥΘΥΝΣΗ, ΧΩΡΙΣ ΝΑ ΕΚΘΕΤΕΙ ΠΟΙΟΣ ΥΠΑΡΧΕΙ.
--                    Διαβάζει `auth.users`, που καμία πολιτική δεν εκθέτει σε
--                    πελάτη. Γι' αυτό SECURITY DEFINER και εκτέλεση ΜΟΝΟ από
--                    τον ρόλο υπηρεσίας: αλλιώς θα ήταν μηχανή απαρίθμησης
--                    λογαριασμών («υπάρχει αυτό το email;»). Γυρίζει ΚΕΝΟ όταν
--                    δεν ξέρει — την προσφώνηση της άγνοιας την αποφασίζει η
--                    εφαρμογή, όχι η βάση.
--
--   support_ack_log  ΠΟΙΟΝ ΑΠΑΝΤΗΣΑΜΕ ΚΑΙ ΠΟΤΕ — ΧΩΡΙΣ ΝΑ ΚΡΑΤΑΜΕ ΤΗ ΔΙΕΥΘΥΝΣΗ.
--                    Το φρένο θέλει μόνο ΙΣΟΤΗΤΑ («του απαντήσαμε ήδη;»), όχι
--                    την ίδια τη διεύθυνση. Αποθηκεύουμε λοιπόν ΜΟΝΟ ένα hash
--                    της: κανένα ωμό email δεν μένει πίσω (ελαχιστοποίηση
--                    δεδομένων), οπότε δεν υπάρχει καν προσωπικό δεδομένο να
--                    σβηστεί σε διαγραφή λογαριασμού. RLS ενεργό, ΚΑΜΙΑ πολιτική:
--                    ο ρόλος υπηρεσίας παρακάμπτει την RLS, όλοι οι άλλοι μηδέν.
--
--   try_support_ack  ΤΟ ΦΡΕΝΟ ΤΟΥ ΒΡΟΧΟΥ, ΑΤΟΜΙΚΑ. Δέχεται τη διεύθυνση (ΔΕΝ
--                    την αποθηκεύει — την κάνει hash επιτόπου) και επιστρέφει
--                    true ΜΟΝΟ όταν πρέπει όντως να σταλεί επιβεβαίωση (πρώτη
--                    επαφή ή αφού πέρασε η περίοδος ησυχίας), false μέσα στην περίοδο.
--
-- Το `search_path` καρφώνεται και στις δύο συναρτήσεις: χωρίς αυτό, μια
-- SECURITY DEFINER μπορεί να παρασυρθεί σε ομώνυμο αντικείμενο άλλου σχήματος.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Ο κατάλογος όσων απαντήθηκαν, σε hash ───────────────────────────────────
-- ΓΙΑΤΙ HASH ΚΑΙ ΟΧΙ ΔΙΕΥΘΥΝΣΗ. Το φρένο κρίνει μόνο «τον έχω ξαναδεί;» — αυτό
-- το απαντά η ισότητα ενός hash εξίσου καλά. Κρατώντας hash αντί για email δεν
-- υπάρχει λίστα ανθρώπων που επικοινώνησαν με την υποστήριξη ούτε για τον
-- service_role και ο έλεγχος πληρότητας της διαγραφής λογαριασμού δεν έχει
-- ωμή διεύθυνση να απαιτήσει να σβηστεί. Το md5 αρκεί: δεν είναι όριο ασφαλείας,
-- μια σύγκρουση θα στοίχιζε το πολύ μία επιβεβαίωση παραπάνω ή λιγότερη.
create table if not exists public.support_ack_log (
  sender_hash text primary key,
  last_ack_at timestamptz not null default now(),
  ack_count int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.support_ack_log owner to postgres;

-- RLS ΕΝΕΡΓΟ, ΜΗΔΕΝ ΠΟΛΙΤΙΚΕΣ. Ο service_role παρακάμπτει την RLS και είναι ο
-- μόνος που τον αγγίζει, μέσω της try_support_ack· κανένας πελάτης δεν διαβάζει.
alter table public.support_ack_log enable row level security;

revoke all on table public.support_ack_log from public, anon, authenticated;
grant all on table public.support_ack_log to service_role;

comment on table public.support_ack_log is
  'Ποιον απαντήσαμε αυτόματα και πότε, ΣΕ HASH (όχι διεύθυνση). Μόνο service_role.';

-- ── Το όνομα από τη διεύθυνση ───────────────────────────────────────────────
create or replace function public.name_for_email(p_email text)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_name text;
begin
  -- Ο ίδιος κανονικός τύπος ονόματος που χρησιμοποιείται σε όλο το έργο:
  -- owner_name, μετά full_name, αλλιώς ΚΕΝΟ. Το «Ιδιοκτήτης» ΔΕΝ μπαίνει εδώ —
  -- η άγνοια της βάσης δεν πρέπει να μοιάζει με γνώση στην εφαρμογή.
  select coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), '')
    into v_name
    from auth.users u
    left join public.billing_profiles bp on bp.user_id = u.id
   where lower(u.email) = lower(trim(p_email))
     and u.email_confirmed_at is not null
   limit 1;

  -- Κανένας χρήστης: το select δεν βρίσκει γραμμή, το v_name μένει null.
  return coalesce(v_name, '');
end;
$$;

alter function public.name_for_email(text) owner to postgres;

-- Ο πελάτης ΔΕΝ την καλεί ποτέ: θα ήταν απαρίθμηση λογαριασμών.
revoke all on function public.name_for_email(text) from public, anon, authenticated;
grant execute on function public.name_for_email(text) to service_role;

comment on function public.name_for_email(text) is
  'Το όνομα λογαριασμού από διεύθυνση, ή κενό. Μόνο service_role: για τον πελάτη θα ήταν απαρίθμηση λογαριασμών.';

-- ── Το ατομικό φρένο του βρόχου ─────────────────────────────────────────────
create or replace function public.try_support_ack(p_email text, p_cooldown interval)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_sent boolean;
  v_key  text;
begin
  -- Η διεύθυνση γίνεται hash ΕΔΩ και δεν αποθηκεύεται πουθενά ωμή: το όρισμα
  -- είναι εφήμερο, μόνο το md5 του μπαίνει στον πίνακα.
  v_key := md5(lower(btrim(p_email)));

  -- ΓΙΑΤΙ ΕΝΑ INSERT ... ON CONFLICT ΚΑΙ ΟΧΙ «ΚΟΙΤΑ, ΜΕΤΑ ΓΡΑΨΕ». Δύο παραδόσεις
  -- του ίδιου webhook για τον ίδιο αποστολέα φτάνουν σχεδόν ταυτόχρονα. Ενα
  -- ξεχωριστό select-και-μετά-update θα άφηνε και τα δύο να δουν «πέρασε η
  -- περίοδος» και να στείλουν δύο φορές. Εδώ το ON CONFLICT κλειδώνει τη γραμμή:
  -- η δεύτερη κλήση περιμένει την πρώτη και μετά ξανακρίνει πάνω στο ΝΕΟ
  -- last_ack_at, οπότε βλέπει «μόλις απαντήθηκε» και δεν στέλνει.
  --
  -- Το RETURNING δίνει γραμμή ΜΟΝΟ όταν έγινε insert (πρώτη επαφή) ή όταν το
  -- WHERE του update ίσχυσε (πέρασε η περίοδος). Μέσα στην περίοδο, το WHERE
  -- είναι ψευδές, καμία γραμμή δεν αλλάζει και το RETURNING δεν δίνει τίποτα.
  insert into public.support_ack_log (sender_hash)
       values (v_key)
  on conflict (sender_hash) do update
     set last_ack_at = now(),
         ack_count   = support_ack_log.ack_count + 1
   where support_ack_log.last_ack_at < now() - p_cooldown
  returning true into v_sent;

  return coalesce(v_sent, false);
end;
$$;

alter function public.try_support_ack(text, interval) owner to postgres;

-- Ο πελάτης ΔΕΝ την καλεί ποτέ: θα έγραφε στον κατάλογο της υποστήριξης.
revoke all on function public.try_support_ack(text, interval) from public, anon, authenticated;
grant execute on function public.try_support_ack(text, interval) to service_role;

comment on function public.try_support_ack(text, interval) is
  'Ατομικό dedup/cooldown ανά αποστολέα (σε hash). true όταν πρέπει να σταλεί επιβεβαίωση, false μέσα στην περίοδο ησυχίας. Μόνο service_role.';
