-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE ΜΕΤΡΙΕΤΑΙ ΚΑΙ ΑΝΑΙΡΕΙΤΑΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΠΙΝΑΚΑΣ. Δύο αποφάσεις του ιδιοκτήτη (30/10/2026) δεν
-- γίνονται με τους υπάρχοντες πίνακες:
--
--   · ΟΡΙΟ 10 ΕΙΣΑΓΩΓΩΝ ΤΗΝ ΗΜΕΡΑ, ΜΕΤΡΗΜΕΝΟ ΣΤΗ ΒΑΣΗ. Μια εισαγωγή γράφει σε
--     ακίνητα και έγγραφα που υπάρχουν ήδη (ενημέρωση κενών, αντικατάσταση
--     συνόλου): από αυτούς τους πίνακες δεν μετριέται πόσες εισαγωγές έγιναν.
--     Ο μετρητής του περιηγητή δεν είναι όριο.
--   · ΑΝΑΙΡΕΣΗ ΓΙΑ 24 ΩΡΕΣ, όπως στο «Πλήρωσα» (PAY_UNDO_HOURS). Η αναίρεση
--     πρέπει να ξέρει τι ΔΗΜΙΟΥΡΓΗΣΕ η εισαγωγή και ποιο ποσό ΑΝΤΙΚΑΤΕΣΤΗΣΕ,
--     και μετά από ανανέωση της σελίδας.
--
-- ΤΙ ΚΡΑΤΑ. ΚΑΝΕΝΑ περιεχόμενο του PDF: ούτε ΑΦΜ, ούτε όνομα, ούτε διεύθυνση,
-- ούτε hash του αρχείου. Μόνο το είδος, το έτος, πόσα ακίνητα βρέθηκαν, τα
-- αναγνωριστικά όσων δημιουργήθηκαν, τη γραμμή «ΕΝΦΙΑ YYYY» που γράφτηκε και
-- τα ποσά που αντικατέστησε (για να επιστρέψουν στην αναίρεση).
--
-- ΠΟΙΟΣ ΓΡΑΦΕΙ ΤΙ.
--   · Εισαγωγή: μόνο ο ίδιος, μόνο τα τέσσερα πρώτα πεδία (δικαίωμα ανά
--     στήλη). Η σκανδάλη ξαναγράφει χρόνο και κενά πεδία, ώστε η ώρα να μη
--     δίνεται από τον περιηγητή. Μετά μετρά.
--   · Ενημέρωση: μόνο ο ίδιος, μόνο όσο δεν έχει αναιρεθεί και μέσα σε 24 ώρες
--     από τη δημιουργία, μόνο τα πεδία του αποτελέσματος και της αναίρεσης.
--   · Διαγραφή: κανείς από τον περιηγητή. Μια σβησμένη γραμμή θα άδειαζε το
--     όριο της ημέρας. Φεύγει μόνο μαζί με τον λογαριασμό (on delete cascade).
--
-- 2FA. Restrictive `mfa_myaade_imports`, όπως σε κάθε πίνακα χρήστη
-- (20261003120000).
--
-- ΙΔΙΟΔΥΝΑΜΗ: `if not exists`, φυλαγμένα περιορίσματα, `drop … if exists`
-- πριν από κάθε πολιτική και σκανδάλη.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.myaade_imports (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                 text not null default 'enfia_act',
  tax_year             integer,
  found_count          integer not null default 0,
  created_property_ids uuid[] not null default '{}',
  document_id          uuid,
  replaced             jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  undone_at            timestamptz
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'myaade_imports_kind_known') then
    alter table public.myaade_imports add constraint myaade_imports_kind_known
      check (kind in ('enfia_act', 'e9'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'myaade_imports_year_sane') then
    alter table public.myaade_imports add constraint myaade_imports_year_sane
      check (tax_year is null or tax_year between 2014 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'myaade_imports_counts_sane') then
    alter table public.myaade_imports add constraint myaade_imports_counts_sane
      check (found_count between 0 and 500 and cardinality(created_property_ids) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'myaade_imports_replaced_array') then
    alter table public.myaade_imports add constraint myaade_imports_replaced_array
      check (jsonb_typeof(replaced) = 'array' and jsonb_array_length(replaced) <= 500);
  end if;
end $c$;

-- Το όριο και η λίστα «τελευταίες εισαγωγές» διαβάζουν με χρήστη και χρόνο.
create index if not exists myaade_imports_user_time_idx on public.myaade_imports (user_id, created_at desc);

alter table public.myaade_imports enable row level security;

-- ── ΤΟ ΟΡΙΟ ΤΗΣ ΗΜΕΡΑΣ ──────────────────────────────────────────────────────
-- Κυλιόμενες 24 ώρες, όπως το `send_quota_rule`. Η κλειδαριά ανά χρήστη κάνει
-- δύο καρτέλες που αποθηκεύουν μαζί να μετρηθούν η μία μετά την άλλη. Η
-- αναιρεμένη εισαγωγή ΜΕΤΡΑ: αλλιώς «εισαγωγή, αναίρεση» θα ήταν άπειρος βρόχος.
-- SECURITY INVOKER: η μέτρηση περνά από την RLS και βλέπει μόνο τα δικά του,
-- που είναι ακριβώς αυτά που πρέπει να μετρήσει.
create or replace function public.myaade_import_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_used int;
begin
  new.created_at := now();
  new.undone_at := null;
  new.created_property_ids := '{}';
  new.document_id := null;
  new.replaced := '[]'::jsonb;
  perform pg_advisory_xact_lock(hashtextextended('myaade_import:' || new.user_id::text, 0));
  select count(*) into v_used
    from public.myaade_imports
   where user_id = new.user_id and created_at > now() - interval '24 hours';
  if v_used >= 10 then
    raise exception 'MYAADE_DAILY_LIMIT: έως 10 εισαγωγές σε 24 ώρες'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.myaade_import_before_insert() from public, anon;

drop trigger if exists myaade_imports_before_insert on public.myaade_imports;
create trigger myaade_imports_before_insert
  before insert on public.myaade_imports
  for each row execute function public.myaade_import_before_insert();

-- ── ΠΟΛΙΤΙΚΕΣ ───────────────────────────────────────────────────────────────
drop policy if exists sel_myaade_imports on public.myaade_imports;
create policy sel_myaade_imports on public.myaade_imports
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists ins_myaade_imports on public.myaade_imports;
create policy ins_myaade_imports on public.myaade_imports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Η ΑΝΑΙΡΕΣΗ ΚΛΕΙΝΕΙ ΣΤΙΣ 24 ΩΡΕΣ ΚΑΙ ΣΤΗ ΒΑΣΗ. Το `using` κρίνει την ΠΑΛΙΑ
-- γραμμή: όταν γραφτεί `undone_at`, καμία επόμενη ενημέρωση δεν περνά.
drop policy if exists upd_myaade_imports on public.myaade_imports;
create policy upd_myaade_imports on public.myaade_imports
  for update to authenticated
  using (user_id = (select auth.uid()) and undone_at is null and created_at > now() - interval '24 hours')
  with check (user_id = (select auth.uid()));

drop policy if exists mfa_myaade_imports on public.myaade_imports;
create policy mfa_myaade_imports on public.myaade_imports as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

revoke all on public.myaade_imports from anon, authenticated;
grant select on public.myaade_imports to authenticated;
grant insert (user_id, kind, tax_year, found_count) on public.myaade_imports to authenticated;
grant update (created_property_ids, document_id, replaced, undone_at) on public.myaade_imports to authenticated;
grant all on public.myaade_imports to service_role;

comment on table public.myaade_imports is
  'Οι εισαγωγές από το myAADE: για το όριο των 10 σε 24 ώρες και την αναίρεση 24 ωρών. Κανένα περιεχόμενο του PDF (lib/myaade/commit.ts).';
