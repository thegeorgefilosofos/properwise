'use client';

import { settingsRow, hasAnySetting } from '@/lib/property/settingsRow';
import { useState, useEffect, useId, useRef, cloneElement, isValidElement, Children, Fragment } from 'react';
import { track, trackOnboarding, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { HEATING_TYPES, normalizeHeating } from '@/lib/property/heating';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
// Το προφίλ χρέωσης έχει ένα σπίτι: lib/data/billing.
import * as billing from '@/lib/data/billing';
import * as billStore from '@/lib/data/bills';
import { readCoOwners, mergeCoOwnerNames, hasCoOwnerDetails, writeCoOwners } from '@/lib/property/coOwners';
import { cleanDigits, powerSupplyFromNote, E2_POWER_SUPPLY_DIGITS } from '@/lib/property/powerSupply';
import { T, fe, fp, Modal, TT, Btn, ChipToggle } from '@/components/Theme';
import { CustomSelect, DatePicker } from './UIComponents';
import { cleanAma, isValidAmaFormat, amaLengthLooksUnusual } from '@/lib/property/ama';
import { ATAK_SOURCE, atakDigits } from '@/lib/property/atak';
import { STATUSES, BY_KEY, readStatus, writeStatus, type PropertyStatus } from '@/lib/property/status';
import { syncOwnerTaxDeadlines } from '@/lib/calendar/taxSync';
import { propertyTypeLabel, LAND_LIKE_TYPES } from '@/lib/property/types';
import { fillOnlyEmpty, firstFilled } from '@/lib/core/prefill';
import { fieldPlacement, PROPERTY_FIELDS, OBJ_VALUE_WHOLE, type FieldContext, type Placement } from '@/lib/property/fields';
import { failed } from '@/lib/core/dbError';
import { notifyError } from '@/components/Toast';
import { PEA_CLASSES } from '@/lib/property/pea';
import { cleanPeaNumber, isoDay, peaReminderDrafts, PEA_NUMBER_MAX, PEA_REMINDER_DAYS } from '@/lib/property/peaExpiry';
import { syncPeaReminders } from '@/lib/calendar/peaSync';
import { athensToday } from '@/lib/core/time';
import { firstTaxOf, taxDeadlineRow } from '@/lib/onboarding/firstTax';
import { ONBOARDING_STEPS, PRIMARY_TYPES, MORE_TYPES, PRIMARY_STATUSES, MORE_STATUSES, typeNeedsMore, statusNeedsMore, defaultPropertyName } from '@/lib/onboarding/steps';
import type { EnfiaWizardInitial } from '@/lib/tools/enfiaCarry';
import { draftKey, readDraft, writeDraft, clearDraft, sameDraft, restoreDraft } from '@/lib/ui/dismiss';
import { confirmDiscard } from '@/components/ConfirmDialog';
import { useBackButton } from '@/components/useBackButton';
import { BulkImportCard } from './BulkImportCard';

// Η ενεργειακή κλάση (ΠΕΑ) ζει στο lib/property/pea.ts: τη γράφει και η σάρωση
// του πιστοποιητικού, με το ίδιο λεξιλόγιο.

// ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΚΑΤΑΣΤΑΣΕΩΝ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ.
//
// Υπήρχε δεύτερος πίνακας ετικετών και είχε ήδη αποκλίνει από τον κανονικό:
// η κεφαλίδα του ακινήτου έλεγε «Μακροχρόνια μίσθωση», ο οδηγός «Ενοικιάζεται»·
// η κεφαλίδα «Βραχυχρόνια μίσθωση», ο οδηγός «Εποχιακό»· και το «Προς πώληση»
// γραφόταν με δύο διαφορετικές κεφαλαιοποιήσεις. Ίδιο πεδίο, ίδια βάση, τρεις
// διαφωνίες — ο χρήστης δεν μπορούσε να ξέρει ότι μιλάει για το ίδιο πράγμα.
//
// Πηγή είναι το `lib/property/status.ts`, που κρατά και τις επεξηγήσεις και
// ξέρει τι γράφεται στη βάση (`writeStatus`) για κάθε επιλογή.

// Τύποι χωρίς όροφο / έτος κατασκευής (γη & βοηθητικοί χώροι): lib/property/types.ts
const LAND_LIKE = LAND_LIKE_TYPES;
// ── ΤΟ ΕΣΟΔΟ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΤΟ ΛΕΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ, ΔΕΝ ΤΟ ΜΑΝΤΕΥΕΙ Η ΟΘΟΝΗ ──
//
// Εδώ ζούσε `const OCCUPANCY = 0.6`: ο οδηγός ζητούσε τιμή ανά διανυκτέρευση
// και έγραφε στο `target_rent` το `τιμή × 365 × 0,6 / 12`. Το εξήντα τοις εκατό
// δεν βγήκε από πουθενά — δεν είναι μέτρηση, δεν είναι πηγή, δεν είναι δική του
// υπόθεση. Και το `target_rent` δεν μένει στον οδηγό: το `computeYields` το
// πολλαπλασιάζει ×12 στη Σύγκριση, στις Αποδόσεις, στο Χαρτοφυλάκιο και στη
// δανειακή ικανότητα και το `buildE2Row` το χρησιμοποιεί ως ακαθάριστο σε
// ΦΟΡΟΛΟΓΙΚΟ ΕΝΤΥΠΟ όταν λείπουν καταγεγραμμένες διαμονές. Για 70€ τη νύχτα
// ήταν 15.330€ τον χρόνο, ενώ ο ίδιος άνθρωπος είχε εισπράξει 6.300€.
//
// Ο ίδιος ο δημόσιος υπολογιστής (ShortVsLongCalculator) το κάνει ήδη σωστά:
// ΖΗΤΑΕΙ την πληρότητα, δείχνει πίνακα ευαισθησίας και γράφει ρητά ότι τα ποσά
// απαντούν για την πληρότητα που μάντεψε ο χρήστης. Ο οδηγός ήταν η μοναδική
// οθόνη που μάντευε μόνη της.
//
// Τώρα ρωτά κατευθείαν το μέσο μηνιαίο έσοδο — αριθμό που ο ιδιοκτήτης βλέπει
// στις πληρωμές του. Ενα πεδίο αντί για δύο, καμία σταθερά και το άνοιγμα για
// επεξεργασία ξαναδείχνει ακριβώς ό,τι γράφτηκε.

// ΤΕΣΣΕΡΑ ΒΗΜΑΤΑ, ΟΧΙ ΠΕΝΤΕ (αξιολόγηση χρήστη, 20/10/2026). Το τέταρτο,
// «Επαφές», ήταν ένα κουμπί «Περισσότερα» και τίποτα άλλο: κάθε πεδίο του
// (ιδιοκτήτης, πάροχοι, διαχειριστής, ασφάλεια) είναι σπάνιο στο μητρώο
// πεδίων, τα στοιχεία του ιδιοκτήτη έρχονται από το προφίλ και οι πάροχοι από
// την πρώτη σάρωση. Ενα ολόκληρο βήμα για ένα πάτημα που κανείς δεν χρειάζεται
// την πρώτη μέρα. Τα ίδια πεδία ζουν τώρα στη «Σύνοψη», κλειστά, κάτω από τα
// στοιχεία που θα αποθηκευτούν: κανένα δεν χάθηκε, ο οδηγός παραμένει ο μόνος
// τους επεξεργαστής.
//
// ΚΑΙ ΔΥΟ ΟΘΟΝΕΣ ΓΙΑ ΝΕΟ ΑΚΙΝΗΤΟ (κριτική σχεδίασης, 13/11/2026). Η υποδοχή
// υπόσχεται τρία βήματα (lib/onboarding/steps.ts): τύπος, μίσθωμα, ο φόρος σου.
// Ο νέος οδηγός είναι ακριβώς αυτά: «Τύπος ακινήτου», «Μίσθωμα» με τον φόρο να
// βγαίνει καθώς γράφεται· η αποθήκευση ανοίγει την Επισκόπηση με τον φόρο
// στην κορυφή. Τα «Βασικά» (διεύθυνση, ΑΤΑΚ, εμβαδόν, ΠΕΑ) συμπληρώνονται μετά,
// από τη λίστα «Από πού ξεκινάς», που ανοίγει αυτόν τον οδηγό στο σωστό βήμα.
// Η επεξεργασία κρατά τρεις ενότητες, ως καρτέλες: όποιος διορθώνει ξέρει πού
// πάει και αποθηκεύει από όποια θέλει.
//
// ΚΑΡΤΕΛΕΣ, ΟΧΙ ΒΗΜΑΤΑ (κριτική σχεδίασης r2, 13/11/2026). Η επεξεργασία που
// άνοιγε από το «Συμπλήρωση» έδειχνε τη ράγα των τεσσάρων αριθμημένων κόμβων
// και διαβαζόταν σαν υποχρεωτικός οδηγός. Τώρα είναι τρεις καρτέλες χωρίς
// αριθμούς. Η «Σύνοψη» έφυγε: επαναλάμβανε όσα φαίνονται ήδη στις καρτέλες.
// Οι επαφές της (ιδιοκτήτης, πάροχοι, διαχειριστής, ασφάλεια) ζουν κλειστές
// στο τέλος των «Βασικών», το ίδιο κουτί με την ίδια ετικέτα.
const EDIT_STEPS = ['Τύπος', 'Βασικά', 'Οικονομικά'];
type Page = 'type' | 'basics' | 'money';
const EDIT_PAGES: readonly Page[] = ['type', 'basics', 'money'];
const NEW_PAGES: readonly Page[] = ['type', 'money'];

/** Μια γραμμή φόρμας: ποιο πεδίο είναι, πόσο πλάτος πιάνει και το χειριστήριό του. */
interface FormRow { id: string; span: 'auto' | 'full'; node: React.ReactNode; label?: string }

/** Η ετικέτα όπως τη γράφει το μητρώο. Αγνωστο id → το ίδιο το id, ώστε να φαίνεται. */
const labelOf = (id: string) => PROPERTY_FIELDS.find(f => f.id === id)?.label ?? id;

// ── property_settings (χωριστός πίνακας, keyed by property_id) ───────────────
// Ίδια πεδία/ετικέτες με την καρτέλα «Ρυθμίσεις» (TabSettings).
interface PropertySettings {
  owner_name: string; owner_afm: string; owner_phone: string; owner_email: string;
  electricity_provider: string; water_provider: string; internet_provider: string;
  property_manager: string; property_manager_phone: string;
  insurance_company: string; insurance_policy: string; insurance_expiry: string; notes: string;
}
const INIT_SETTINGS: PropertySettings = {
  owner_name: '', owner_afm: '', owner_phone: '', owner_email: '',
  electricity_provider: '', water_provider: '', internet_provider: '',
  property_manager: '', property_manager_phone: '',
  insurance_company: '', insurance_policy: '', insurance_expiry: '', notes: '',
};

/**
 * Ό,τι γράφει ο χρήστης στον οδηγό, σε ένα αντικείμενο: για το «υπάρχουν
 * αλλαγές;» και για το πρόχειρο (lib/ui/dismiss.ts). Το βήμα δεν είναι αλλαγή.
 */
interface WizardForm {
  propType: string; statusKey: PropertyStatus | null; ama: string;
  name: string; address: string; postalCode: string; atak: string; sqm: string; floor: string; yearBuilt: string;
  value: string; objValue: string; enfia: string; purchasePrice: string; purchaseDate: string;
  rent: string; ownership: string; coOwners: string[];
  peaClass: string; heating: string; parking: string; storageSqm: string; powerSupply: string; bedrooms: string;
  peaNumber: string; peaIssued: string; peaExpiry: string;
  settings: PropertySettings;
}
const WIZARD_DRAFT = 'property_wizard';

// ── Εικονίδια ανά τύπο ακινήτου (inline SVG, currentColor) ──────────────────
function TypeIcon({ type }: { type: string }) {
  const p = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'apartment': // κτίριο διαμερισμάτων
      return <svg aria-hidden="true" {...p}><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01" /><path d="M11 21v-3h2v3" /></svg>;
    case 'house': // μονοκατοικία
      return <svg aria-hidden="true" {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
    case 'studio': // ενιαίος χώρος
      return <svg aria-hidden="true" {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 14h16M14 4v10" /></svg>;
    case 'maisonette': // δύο επίπεδα
      return <svg aria-hidden="true" {...p}><path d="M4 21V9l8-6 8 6v12" /><path d="M4 13h16" /><path d="M10 21v-4h4v4" /></svg>;
    case 'office': // γραφείο
      return <svg aria-hidden="true" {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></svg>;
    case 'shop': // κατάστημα / storefront
      return <svg aria-hidden="true" {...p}><path d="M4 9l1-4h14l1 4" /><path d="M4 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" /><path d="M5 11v9h14v-9" /><path d="M9 20v-5h4v5" /></svg>;
    case 'warehouse': // αποθήκη
      return <svg aria-hidden="true" {...p}><path d="M3 21V8l9-4 9 4v13" /><path d="M3 21h18" /><rect x="7" y="12" width="10" height="9" /><path d="M7 16h10" /></svg>;
    case 'land': // οικόπεδο / πινακίδα
      return <svg aria-hidden="true" {...p}><path d="M4 20h16" /><path d="M6 20V6l7-2v16" /><path d="M13 8h5v5h-5" /></svg>;
    case 'parking': // parking
      return <svg aria-hidden="true" {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 16V8h3.5a2.5 2.5 0 010 5H9" /></svg>;
    case 'storage': // αποθήκη κτιρίου / κιβώτιο
      return <svg aria-hidden="true" {...p}><rect x="4" y="6" width="16" height="14" rx="1" /><path d="M4 10h16" /><path d="M10 6V4h4v2" /><path d="M10 14h4" /></svg>;
    case 'villa': // φαρδύ σπίτι με δύο παράθυρα· η πισίνα στα 24 διαβαζόταν ως γάντζος
      return <svg aria-hidden="true" {...p}><path d="M2 11l10-7 10 7" /><path d="M4 10v10h16V10" /><path d="M9 20v-5h6v5M8 13h.01M16 13h.01" /></svg>;
    default: // other: «κάτι άλλο», όχι το (i) της πληροφορίας
      return <svg aria-hidden="true" {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>;
  }
}

const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : v; };

// ── Στυλ inputs (ίδιο look με το υπάρχον modal) ─────────────────────────────
const inputStyle: React.CSSProperties = {
  // Ύψος από την κοινή κλίμακα: ήταν καρφωμένο 40 σε ~25 πεδία του οδηγού, άρα
  // δεν ακολουθούσε το 44 που ζητά ο δείκτης-δάχτυλο (globals.css, pointer: coarse).
  width: '100%', padding: '10px 16px', height: T.h.lg, borderRadius: T.radius.xs,
  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: T.font.sans,
  letterSpacing: 0, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
};
const numInputStyle: React.CSSProperties = { ...inputStyle, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' };
const fieldCell: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' };
const labelStyle: React.CSSProperties = {
  ...TT.label, display: 'flex', alignItems: 'flex-end', minHeight: 28, lineHeight: 1.3, marginBottom: 6,
};

// Όροφοι (ελληνική ονοματολογία): κείμενο, όχι αριθμός.
const FLOOR_OPTS = ['Υπόγειο', 'Ημιυπόγειο', 'Ισόγειο', 'Υπερυψωμένο ισόγειο', 'Ημιώροφος', '1ος', '2ος', '3ος', '4ος', '5ος', '6ος', '7ος και άνω', 'Δώμα / Ρετιρέ'];
const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; };
const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; };


// ── Η ΕΤΙΚΕΤΑ ΔΙΝΕΙ ΤΟ ΟΝΟΜΑ, ΔΕΝ ΚΑΘΕΤΑΙ ΑΠΛΩΣ ΑΠΟ ΠΑΝΩ ────────────────────
//
// Η <label> ήταν ΑΔΕΛΦΟΣ του πεδίου μέσα σε <div>: ούτε htmlFor, ούτε id, ούτε
// τύλιγμα. Ο βλέπων διάβαζε το κείμενο από πάνω· ο αναγνώστης οθόνης άκουγε
// «επεξεργασία κειμένου» και τίποτε άλλο. Μετρημένα, 36 πεδία του οδηγού: 31
// ντόπια (30 <input> και 1 <textarea>), 3 CustomSelect και 2 DatePicker.
//
// Ενα id ανά στιγμιότυπο, από το useId. Στα ντόπια γίνεται id + htmlFor, οπότε
// το κλικ στην ετικέτα εστιάζει πλέον στο πεδίο, όπως παντού αλλού· στα σύνθετα
// γίνεται ariaLabel, που και τα δύο το δέχονται ήδη. Τα 36 σημεία κλήσης δεν
// άλλαξαν ούτε κατά μία λέξη.
/**
 * Βάζει όνομα στο ΠΡΩΤΟ χειριστήριο ενός πεδίου, όπου κι αν βρίσκεται.
 *
 * Επιστρέφει και το αν βρέθηκε ντόπιο στοιχείο, γιατί μόνο τότε έχει νόημα το
 * `htmlFor`: ένα CustomSelect παίρνει `ariaLabel` και δεν έχει id να δείξει.
 */
function nameControl(node: React.ReactNode, id: string, label: string): { node: React.ReactNode; native: boolean } {
  let done = false;
  let native = false;
  const walk = (n: React.ReactNode): React.ReactNode => {
    if (done || !isValidElement(n)) return n;
    const el = n as React.ReactElement<{ children?: React.ReactNode }>;
    if (typeof el.type === 'string') {
      // Πλαίσιο ή ομάδα: κατέβα μέσα του, μη το ονομάσεις.
      if (el.type === 'div' || el.type === 'span') {
        return cloneElement(el, undefined, Children.map(el.props.children, walk));
      }
      done = true; native = true;
      return cloneElement(el as React.ReactElement<Record<string, unknown>>, { id });
    }
    if (el.type === Fragment) {
      return cloneElement(el, undefined, Children.map(el.props.children, walk));
    }
    done = true;
    return cloneElement(el as React.ReactElement<Record<string, unknown>>, { ariaLabel: label });
  };
  const out = Children.map(node, walk);
  return { node: out, native };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  // ══════════════════════════════════════════════════════════════════════════
  // ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ ΤΟ ΜΟΝΟ ΠΑΙΔΙ
  //
  // Η πρώτη γραφή κοίταζε μόνο το `isValidElement(children)`. Ισχυε όσο κάθε
  // πεδίο ήταν ένα σκέτο <input>. Μόλις τρία πεδία απέκτησαν και δεύτερο
  // κομμάτι —η υποσημείωση του ΑΤΑΚ, η λίστα συνιδιοκτητών, η γραμμή «ήρθαν
  // από το προφίλ σου»— τα παιδιά έγιναν ΠΙΝΑΚΑΣ, το `isValidElement` γύρισε
  // ψευδές και τα τρία πεδία έμειναν ΧΩΡΙΣ ΟΝΟΜΑ: η ετικέτα από πάνω δεν
  // έδειχνε πουθενά, ο αναγνώστης οθόνης διάβαζε «πλαίσιο κειμένου».
  //
  // Τώρα ψάχνεται το ΠΡΩΤΟ ντόπιο στοιχείο σε όποια μορφή κι αν έρθουν τα
  // παιδιά. Ντόπιο σημαίνει τύπος-συμβολοσειρά («input», «textarea»)· τα
  // σύνθετα (CustomSelect, DatePicker) έχουν συνάρτηση για τύπο και παίρνουν
  // `ariaLabel` αντί για id.
  // ══════════════════════════════════════════════════════════════════════════
  // ΚΑΙ ΤΟ ΚΑΤΕΒΑΙΝΕΙ ΜΕΣΑ ΣΤΟ FRAGMENT. Το `Children.toArray` σε ένα «<>…</>»
  // επιστρέφει ΕΝΑ παιδί, το ίδιο το fragment, του οποίου ο τύπος είναι
  // Symbol και όχι συμβολοσειρά — δηλαδή ένα σκέτο «βρες το πρώτο έγκυρο»
  // θα κολλούσε στο περιτύλιγμα και θα ονόμαζε αυτό. Η αναδρομή σταματά στο
  // πρώτο ντόπιο στοιχείο και δεν κοιτάζει βαθύτερα: όταν ένα πεδίο κρύβει
  // τρία <input> μέσα σε <div>, καθένα έχει τη ΔΙΚΗ του ετικέτα και δεν
  // επιτρέπεται να δανειστεί αυτή του γονέα.
  const named = nameControl(children, id, label);
  // Στο πλέγμα των δύο στηλών μια ετικέτα μπορεί να γίνει δίγραμμη (στα 375 η
  // «Αριθμός ασφαλιστηρίου» δίπλα στην «Ασφαλιστική»). Το κελί τεντώνει στο
  // ύψος της σειράς και το πεδίο κάθεται στη βάση του: τα πεδία μιας σειράς
  // στοιχίζονται χωρίς να μακραίνει κανένα.
  return <div style={fieldCell}><label htmlFor={named.native ? id : undefined} style={labelStyle}>{label}</label>{named.node}</div>;
}


interface ExistingProperty {
  id: string; name?: string | null; prop_type?: string | null; address?: string | null;
  postal_code?: string | null; sqm?: number | null; floor?: number | string | null; year_built?: number | null;
  value?: number | null; purchase_price?: number | null; target_rent?: number | null;
  ownership?: number | string | null; status_detail?: string | null; atak?: string | null;
  obj_value?: number | string | null; enfia?: number | string | null; pea_class?: string | null;
  heating?: string | null; purchase_date?: string | null; parking_spaces?: number | string | null;
  storage_sqm?: number | string | null; bedrooms?: number | string | null; rental_mode?: string | null;
  co_owners?: unknown; ama?: string | null; power_supply_no?: string | null;
  pea_number?: string | null; pea_issued?: string | null; pea_expiry?: string | null;
}
const s = (v: number | string | null | undefined) => (v == null ? '' : String(v));

// ── Layout helpers ──────────────────────────────────────────────────────────
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 16 };

/**
 * Μια γραμμή της φόρμας: ταυτότητα πεδίου, πλάτος και το ίδιο το χειριστήριο.
 *
 * Η ΕΤΙΚΕΤΑ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ, εκτός αν το πεδίο αλλάζει όνομα ανάλογα με
 * την περίπτωση: το «Εμβαδόν» γίνεται «Εμβαδόν οικοπέδου» και ο «Στόχος
 * ενοικίου» γίνεται «Μέσο μηνιαίο έσοδο». Σε αυτές τις περιπτώσεις η οθόνη
 * περνά τη δική της, γιατί το μητρώο κρατά τον ΛΟΓΟ του πεδίου και όχι τη
 * διατύπωση της στιγμής.
 */
const row = (id: string, span: 'auto' | 'full', node: React.ReactNode, label?: string): FormRow =>
  ({ id, span, node, label });

/**
 * Το σώμα ενός βήματος: ό,τι χρειάζεται τώρα και από κάτω ένα κουμπί για ό,τι
 * χρειάζεται κάποτε.
 *
 * ΤΟ JSX ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΙΠΟΤΑ. Η σειρά των γραμμών είναι η σειρά που τις
 * γράφει η οθόνη· το ΠΟΥ πάει η καθεμία το λέει το μητρώο. Ετσι ένας κανόνας
 * που αλλάζει (π.χ. τα υπνοδωμάτια γίνονται βασικά και στη μακροχρόνια)
 * αλλάζει σε ΕΝΑ σημείο και όχι σε τρία βήματα φόρμας.
 *
 * ΚΑΙ ΖΕΙ ΣΤΟ ΕΠΙΠΕΔΟ ΤΟΥ ΑΡΧΕΙΟΥ, ΟΧΙ ΜΕΣΑ ΣΤΟΝ ΟΔΗΓΟ. Γραμμένο μέσα στο
 * component, ο τύπος του θα ήταν ΝΕΟΣ σε κάθε απόδοση: η React θα το θεωρούσε
 * άλλο στοιχείο, θα ξήλωνε το προηγούμενο και θα προσάρτιζε καινούριο. Δηλαδή
 * το «Περισσότερα» θα έκλεινε μόνο του σε κάθε πληκτρολόγηση και ο χρήστης θα
 * έχανε το κουτί που έγραφε. Το `react-hooks/static-components` το είπε και
 * είχε δίκιο.
 */
function StepBody({ rows, place, after, moreTitle = 'Περισσότερα στοιχεία', lessTitle = 'Λιγότερα στοιχεία', defaultOpen = false }: {
  rows: FormRow[];
  place: (id: string) => Placement;
  after?: React.ReactNode;
  /** Η κεφαλίδα του κλειστού κουτιού· δίπλα της, σε παρένθεση, πόσα κρύβει. */
  moreTitle?: string;
  /** Η κεφαλίδα του ανοιχτού κουτιού. */
  lessTitle?: string;
  /** Ανοιχτό από την αρχή: όταν ο οδηγός ανοίγει για να γραφτεί ακριβώς κάτι από μέσα. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const core = rows.filter(r => place(r.id) === 'core');
  // Η ΣΕΙΡΑ ΤΩΝ ΚΡΥΜΜΕΝΩΝ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ. Το JSX γράφει πρώτα όσα
  // ΣΥΝΗΘΩΣ φαίνονται και μετά τα σπάνια· όταν ένας κανόνας στέλνει κάποιο από
  // τα πρώτα στα «Περισσότερα» (τα υπνοδωμάτια σε μακροχρόνια μίσθωση), εκείνο
  // εμφανιζόταν ΠΡΩΤΟ στη λίστα, πριν από τον ταχυδρομικό κώδικα. Δύο
  // διαφορετικές σειρές για την ίδια φόρμα, ανάλογα με την κατάσταση του
  // ακινήτου, κάνουν τον χρήστη να ψάχνει.
  const order = new Map(PROPERTY_FIELDS.map((f, i) => [f.id, i]));
  const more = rows.filter(r => place(r.id) === 'more')
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const cell = (r: FormRow) => (
    <div key={r.id} style={r.span === 'full' ? { gridColumn: '1 / -1' } : undefined}>
      <Field label={r.label ?? labelOf(r.id)}>{r.node}</Field>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {core.length > 0 && <div style={grid2}>{core.map(cell)}</div>}
      {after}
      {more.length > 0 && (
        <>
          {/* ΗΣΥΧΗ ΑΠΟΚΑΛΥΨΗ, ΟΧΙ ΤΡΙΤΗ ΚΑΡΤΑ (κριτική σχεδίασης r2, 13/11/2026).
              Ηταν κουτί με περίγραμμα και φόντο που απαριθμούσε δύο ονόματα
              («… και 4 ακόμη»): δύο γραμμές στα 375, κομμένο στα 320 και δίπλα
              στην κάρτα του φόρου διαβαζόταν σαν τρίτη κάρτα. Τώρα ένα κουμπί
              κειμένου με το πλήθος σε παρένθεση, 44 ύψος, χωρίς πλαίσιο. */}
          <button
            type="button"
            data-more
            className="wiz-disclose"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >
            <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><path d="m9 18 6-6-6-6" /></svg>
            <span>{open ? lessTitle : `${moreTitle} (${more.length})`}</span>
          </button>
          {open && <div style={grid2}>{more.map(cell)}</div>}
        </>
      )}
    </div>
  );
}

export default function AddPropertyWizard({ userId, onClose, onSaved, existing, focus, initial, onBulkImport, hasProperties = false }: {
  userId: string; onClose: () => void; onSaved: (propertyId: string | null) => void; existing?: ExistingProperty | null;
  /**
   * Ο,ΤΙ ΕΓΡΑΨΕ ΗΔΗ Ο ΕΠΙΣΚΕΠΤΗΣ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ΕΝΦΙΑ (lib/tools/enfiaCarry.ts):
   * τετραγωνικά, ποσοστό, όροφος, βοηθητικοί χώροι. Μόνο σε νέο ακίνητο· στην
   * επεξεργασία μιλά το ίδιο το ακίνητο. Ο όροφος περνά μόνο αν είναι μία από
   * τις επιλογές του οδηγού.
   */
  initial?: EnfiaWizardInitial;
  /**
   * ΑΠΟ ΠΟΥ ΑΝΟΙΓΕΙ Ο ΟΔΗΓΟΣ. Η Λογιστική ζητά το ΑΦΜ του ιδιοκτήτη· με
   * `owner_afm` ο οδηγός ανοίγει στα «Βασικά» με τις επαφές ανοιχτές και τον
   * κέρσορα στο ΑΦΜ, αντί ο χρήστης να ψάξει καρτέλες για να το βρει.
   */
  focus?: 'owner_afm' | 'rent' | 'basics' | null;
  /**
   * Η ΜΑΖΙΚΗ ΚΑΤΑΧΩΡΗΣΗ ΩΣ ΠΡΩΤΗ ΕΠΙΛΟΓΗ. Ο πίνακας τη δίνει σε ΚΑΘΕ νέα
   * καταχώρηση, με ή χωρίς ακίνητα (απόφαση ιδιοκτήτη 10/11/2026· ως τις
   * 09/11 μόνο χωρίς κανένα). Η κάρτα στέκει πάνω από τον τύπο ακινήτου και
   * ανοίγει την εισαγωγή από Ε9 ή πράξη ΕΝΦΙΑ. Στην επεξεργασία δεν φαίνεται.
   */
  onBulkImport?: () => void;
  /** Ο χρήστης έχει ήδη ακίνητα: η κάρτα λέει πώς τα βρίσκει η εισαγωγή. */
  hasProperties?: boolean;
}) {
  const supabase = createClient();
  const isEdit = !!existing?.id;
  const seed = existing ? undefined : initial;
  const focusAfm = isEdit && focus === 'owner_afm';

  // ══════════════════════════════════════════════════════════════════════════
  // ΤΟ ΠΑΡΑΘΥΡΟ ΔΕΝ ΧΑΝΕΙ Ο,ΤΙ ΓΡΑΦΤΗΚΕ (έλεγχος 19/10/2026)
  //
  // Ένα σύρσιμο επιλογής κειμένου έξω από το πλαίσιο ή ένα αθέλητο Escape
  // έσβηνε πέντε βήματα. Τώρα:
  //   • `pristine` είναι η φόρμα όπως άνοιξε. Όσο η τρέχουσα διαφέρει, κάθε
  //     δρόμος κλεισίματος (φόντο, Escape, «×», «Ακύρωση») ρωτά πρώτα.
  //   • Σε νέο ακίνητο η φόρμα γράφεται ως πρόχειρο στο sessionStorage και
  //     ξαναγεμίζει στο επόμενο άνοιγμα στην ίδια καρτέλα. Σβήνει με την
  //     αποθήκευση, με το «Κλείσιμο χωρίς αποθήκευση» και με την αποσύνδεση.
  //   • Η προσυμπλήρωση από το προφίλ και η φόρτωση των ρυθμίσεων ενημερώνουν
  //     ΚΑΙ το `pristine`: δεν είναι αλλαγές του χρήστη.
  // ══════════════════════════════════════════════════════════════════════════
  const formKey = draftKey(WIZARD_DRAFT, userId);
  const [pristine, setPristine] = useState<WizardForm>(() => {
    const known = readCoOwners(existing?.co_owners);
    return {
      propType: existing?.prop_type || 'apartment',
      // ΜΙΑ κατάσταση, στο λεξιλόγιο της εφαρμογής (βλ. `statusKey` πιο κάτω).
      statusKey: existing ? readStatus(existing) : null,
      ama: cleanAma(existing?.ama || ''),
      name: existing?.name || '', address: existing?.address || '', postalCode: existing?.postal_code || '',
      // Το 0 είναι το «δεν δόθηκε» της βάσης (NOT NULL, προεπιλογή 0): ανοίγει
      // κενό, όχι «0», όπως το δείχνει και η σύνοψη (ABSENT).
      atak: existing?.atak || '', sqm: (Number(existing?.sqm) > 0 ? s(existing?.sqm) : '') || seed?.sqm || '',
      floor: s(existing?.floor) || (seed?.floor && FLOOR_OPTS.includes(seed.floor) ? seed.floor : ''),
      yearBuilt: s(existing?.year_built),
      value: s(existing?.value), objValue: s(existing?.obj_value), enfia: s(existing?.enfia),
      purchasePrice: s(existing?.purchase_price), purchaseDate: existing?.purchase_date || '',
      // Στη βραχυχρόνια το πεδίο ζητά τιμή ΑΝΑ ΔΙΑΝΥΚΤΕΡΕΥΣΗ, ενώ η βάση κρατά
      // μηνιαίο. Το πεδίο φόρτωνε ωμό το `target_rent`: άνοιγες ένα Airbnb ακίνητο
      // για να αλλάξεις τη διεύθυνση και έβρισκες 3.000 στην «τιμή ανά
      // διανυκτέρευση», με την προεπισκόπηση να λέει 657.000€ ετήσια έσοδα. Κάθε
      // αποθήκευση πολλαπλασίαζε ξανά το νούμερο.
      rent: s(existing?.target_rent),
      ownership: s(existing?.ownership) || seed?.ownership || '100',
      coOwners: known.length ? known.map(c => c.name) : [''],
      peaClass: existing?.pea_class || '', heating: normalizeHeating(existing?.heating),
      parking: s(existing?.parking_spaces), storageSqm: s(existing?.storage_sqm) || seed?.storageSqm || '',
      powerSupply: existing?.power_supply_no || '', bedrooms: s(existing?.bedrooms),
      peaNumber: existing?.pea_number || '', peaIssued: isoDay(existing?.pea_issued), peaExpiry: isoDay(existing?.pea_expiry),
      settings: INIT_SETTINGS,
    };
  });
  // Το πρόχειρο διαβάζεται ΜΙΑ φορά, μόνο για νέο ακίνητο και μόνο ό,τι έχει
  // τον σωστό τύπο (`restoreDraft`). Κατάσταση εκτός λίστας δεν περνά.
  const [draft] = useState<{ form: WizardForm; step: number } | null>(() => {
    if (isEdit) return null;
    const d = readDraft<Partial<WizardForm> & { step?: unknown }>(formKey);
    if (!d) return null;
    const form = restoreDraft(pristine as unknown as Record<string, unknown>, d) as unknown as WizardForm;
    if (form.statusKey !== null && !STATUSES.some(x => x.key === form.statusKey)) form.statusKey = null;
    if (!form.coOwners.length) form.coOwners = [''];
    if (sameDraft(form, pristine)) return null;
    // Πρόχειρο από τον οδηγό των πέντε βημάτων: το παλιό 4 (Σύνοψη) και το
    // παλιό 3 (Επαφές) πέφτουν και τα δύο στη Σύνοψη, όπου ζουν πια οι επαφές.
    // Και πρόχειρο από τον οδηγό των τεσσάρων: πέφτει στο «Μίσθωμα», το τελευταίο του νέου.
    const step = typeof d.step === 'number' && Number.isInteger(d.step) && d.step >= 0 ? Math.min(d.step, NEW_PAGES.length - 1) : 0;
    return { form, step };
  });
  const start = draft?.form ?? pristine;

  // Η Επισκόπηση ανοίγει την επεξεργασία στο μίσθωμα που λείπει («Οικονομικά»)
  // και η λίστα «Από πού ξεκινάς» στα «Βασικά», όχι στον τύπο.
  const focusRent = isEdit && focus === 'rent';
  const focusBasics = isEdit && focus === 'basics';
  const pages = isEdit ? EDIT_PAGES : NEW_PAGES;
  const [step, setStep] = useState(focusAfm ? EDIT_PAGES.indexOf('basics') : focusRent ? EDIT_PAGES.indexOf('money') : focusBasics ? EDIT_PAGES.indexOf('basics') : draft?.step ?? 0);
  const page = pages[Math.min(step, pages.length - 1)];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Αλλαγή βήματος = νέα προσπάθεια· το παλιό σφάλμα δεν αφορά πια την οθόνη.
  const goStep = (next: (s: number) => number) => { setError(''); setStep(next); };
  // Id του ακινήτου που δημιουργήθηκε σε προηγούμενη, μισοτελειωμένη προσπάθεια
  // αποθήκευσης (βλ. save()) — κρατά το «δοκίμασε ξανά» πάνω στο ίδιο ακίνητο.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [propType, setPropType] = useState(start.propType);
  // «Όλοι οι τύποι» και «Όλες οι καταστάσεις»: ανοιχτά από την αρχή όταν η επιλογή ζει εκεί.
  const [moreTypes, setMoreTypes] = useState(() => typeNeedsMore(start.propType));
  // ΜΙΑ κατάσταση, στο λεξιλόγιο της εφαρμογής. Η μετάφραση προς τις δύο
  // στήλες της βάσης γίνεται από το `writeStatus`, που τις γράφει ΜΑΖΙ.
  //
  // ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ ΣΕ ΝΕΟ ΑΚΙΝΗΤΟ. Ηταν «Κενό» φωτισμένο από την αρχή, οπότε
  // ένα γρήγορο «Συνέχεια» έγραφε λάθος κατάσταση. Η κατάσταση κρίνει καρτέλες
  // και φορολογία. Το πρώτο βήμα δεν προχωρά χωρίς επιλογή (`canNext`).
  const [statusKey, setStatusKey] = useState<PropertyStatus | null>(start.statusKey);
  const [moreStatuses, setMoreStatuses] = useState(() => statusNeedsMore(start.statusKey));
  // Από το δεύτερο βήμα και μετά η επιλογή υπάρχει πάντα· το «vacant» εδώ μόνο
  // ικανοποιεί τον τύπο και δεν φτάνει ποτέ στη βάση.
  const status: PropertyStatus = statusKey ?? 'vacant';
  // Η βραχυχρόνια ΔΕΝ είναι πια ξεχωριστός διακόπτης: είναι μία από τις επτά καταστάσεις.
  const airbnb = statusKey === 'rent_short';
  // ΑΜΑ: πεδίο ΤΟΥ ΑΚΙΝΗΤΟΥ, ζητούμενο τη στιγμή που η κατάσταση γίνεται
  // βραχυχρόνια — όχι κρυμμένο σε accordion άλλης καρτέλας πίσω από τρίτο
  // διακόπτη (βλ. AMA_DEACTIVATIONS).
  const [ama, setAma] = useState(start.ama);

  const [name, setName] = useState(start.name);
  const [address, setAddress] = useState(start.address);
  const [postalCode, setPostalCode] = useState(start.postalCode);
  const [atak, setAtak] = useState(start.atak);
  const [sqm, setSqm] = useState(start.sqm);
  const [floor, setFloor] = useState(start.floor);
  const [yearBuilt, setYearBuilt] = useState(start.yearBuilt);

  const [value, setValue] = useState(start.value);
  const [objValue, setObjValue] = useState(start.objValue);
  const [enfia, setEnfia] = useState(start.enfia);
  const [purchasePrice, setPurchasePrice] = useState(start.purchasePrice);
  const [purchaseDate, setPurchaseDate] = useState(start.purchaseDate);
  const [rent, setRent] = useState(start.rent);
  const [ownership, setOwnership] = useState(start.ownership);
  // Συνιδιοκτήτες: όταν το ποσοστό < 100%, ζητάμε πλήθος (1–99) και ονόματα.
  // Η στήλη κρατά αντικείμενα {name, afm, pct, address}· ο οδηγός αλλάζει μόνο
  // ονόματα και τα υπόλοιπα (από την Κατανομή σε συνιδιοκτήτες) ξαναδένονται
  // στην αποθήκευση με το `mergeCoOwnerNames`.
  const knownCoOwners = readCoOwners(existing?.co_owners);
  const [coOwners, setCoOwners] = useState<string[]>(start.coOwners);
  const setCoOwnerCount = (n: number) => {
    const c = Math.max(1, Math.min(99, Math.floor(n) || 1));
    setCoOwners(prev => {
      const next = prev.slice(0, c);
      while (next.length < c) next.push('');
      return next;
    });
  };
  const setCoOwnerAt = (i: number, val: string) => setCoOwners(prev => prev.map((v, idx) => idx === i ? val : v));
  const [peaClass, setPeaClass] = useState(start.peaClass);
  // Τα στοιχεία του πιστοποιητικού: ο αριθμός μπαίνει στη δήλωση μίσθωσης και
  // από τη λήξη βγαίνουν οι υπενθυμίσεις (lib/property/peaExpiry.ts).
  const [peaNumber, setPeaNumber] = useState(start.peaNumber);
  const [peaIssued, setPeaIssued] = useState(start.peaIssued);
  const [peaExpiry, setPeaExpiry] = useState(start.peaExpiry);
  const peaDatesBad = !!peaIssued && !!peaExpiry && peaIssued > peaExpiry;
  const [heating, setHeating] = useState(start.heating);
  const [parking, setParking] = useState(start.parking);
  const [storageSqm, setStorageSqm] = useState(start.storageSqm);
  // Ε2 στήλη 18: ο αριθμός παροχής ρεύματος, όπως τον γράφει ο χρήστης.
  const [powerSupply, setPowerSupply] = useState(start.powerSupply);
  const powerCheck = cleanDigits(powerSupply);
  // Πρόταση από σαρωμένο λογαριασμό ρεύματος. Δεν γράφεται μόνη της: ο
  // χρήστης την επιβεβαιώνει με ένα πάτημα, γιατί η σάρωση μπορεί να διάβασε
  // αριθμό λογαριασμού πελάτη αντί για παροχή.
  const [powerHint, setPowerHint] = useState<string | null>(null);
  useEffect(() => {
    if (!existing?.id || existing.power_supply_no) return;
    let active = true;
    billStore.ofProperty<{ notes: string | null; created_at: string | null }>(
      supabase, existing.id, 'notes,created_at', userId, { category: 'electricity' },
    ).then(rows => {
      if (!active) return;
      const latest = [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
      setPowerHint(latest.map(r => powerSupplyFromNote(r.notes)).find(Boolean) ?? null);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);
  const [bedrooms, setBedrooms] = useState(start.bedrooms);

  // property_settings (μόνο για υπάρχον ακίνητο υπάρχει ήδη γραμμή· για νέο τη δημιουργούμε στο save)
  const [settings, setSettings] = useState<PropertySettings>(start.settings);
  const setSf = (k: keyof PropertySettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!existing?.id) return;
    let active = true;
    supabase.from('property_settings').select('*').eq('property_id', existing.id).maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const loaded = { ...INIT_SETTINGS, ...(data as Partial<PropertySettings>) };
        setSettings(loaded);
        setPristine(p => ({ ...p, settings: loaded }));
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // ── Ο ΙΔΙΟΚΤΗΤΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΣΕ ΚΑΘΕ ΑΚΙΝΗΤΟ ΤΟΥ ────────────────────────
  //
  // Ο πίνακας `property_settings` έχει `UNIQUE (property_id)`, άρα κρατά τα
  // στοιχεία ιδιοκτήτη ΑΝΑ ΑΚΙΝΗΤΟ. Ο οδηγός τα ζητούσε κενά κάθε φορά: όνομα,
  // ΑΦΜ, τηλέφωνο, email — τέσσερα πεδία επί κάθε νέο ακίνητο, για το ίδιο
  // ακριβώς πρόσωπο. Το ΑΦΜ είναι εννιά ψηφία που πληκτρολογούνται λάθος· και
  // αρκεί ένα λάθος ψηφίο σε ένα ακίνητο για να κοπεί η δήλωση μισθωτηρίου.
  //
  // Η μία πηγή είναι το προφίλ του χρήστη (`billing_profiles`, μία γραμμή ανά
  // χρήστη) — εκεί όπου ήδη συμπληρώνει τα ίδια στοιχεία για τα παραστατικά.
  // Δεν αντιγράφουμε από «κάποιο άλλο ακίνητο»: αυτό θα διαιώνιζε το λάθος του
  // πρώτου. Το email έρχεται από τον λογαριασμό σύνδεσης, που είναι βέβαιο.
  //
  // Ισχύει ΜΟΝΟ για νέο ακίνητο και μόνο σε κενά πεδία: αν ο χρήστης πρόλαβε
  // να γράψει κάτι όσο φόρτωνε, ό,τι έγραψε μένει (fillOnlyEmpty).
  useEffect(() => {
    if (existing?.id) return;
    let active = true;
    (async () => {
      const [prof, { data: auth }] = await Promise.all([
        billing.profile<Record<string, string | null>>(
          supabase, userId, 'owner_name, full_name, company_name, afm, phone'),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      const p = prof;
      const proposed = {
        // ΚΑΙ ΤΟ ΟΝΟΜΑ ΤΗΣ ΕΓΓΡΑΦΗΣ (20.10.2026). Η φόρμα εγγραφής το γράφει στο
        // `user_metadata.full_name` και όχι στο προφίλ, οπότε σε 5 από 5
        // λογαριασμούς ο οδηγός ζητούσε ξανά το όνομα που ο χρήστης είχε δώσει
        // ένα λεπτό πριν. Μένει τελευταίο: ό,τι έγραψε στο προφίλ υπερισχύει.
        owner_name:  firstFilled(p?.owner_name, p?.full_name, p?.company_name,
          (auth?.user?.user_metadata as { full_name?: string } | undefined)?.full_name),
        owner_afm:   firstFilled(p?.afm),
        owner_phone: firstFilled(p?.phone),
        owner_email: firstFilled(auth?.user?.email),
      };
      setSettings(cur => ({ ...cur, ...fillOnlyEmpty(proposed, { ...cur }) }));
      setPristine(p => ({ ...p, settings: { ...p.settings, ...fillOnlyEmpty(proposed, { ...p.settings }) } }));
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, userId]);

  const isLandLike = LAND_LIKE.has(propType);
  // Συνιδιοκτησία: ποσοστό < 100% ⇒ ζητάμε συνιδιοκτήτες.
  const ownershipN = num(ownership);
  const isShared = ownershipN != null && ownershipN > 0 && ownershipN < 100;
  // Airbnb ⇒ status seasonal
  const dbStatus = writeStatus(status);

  const valueN = num(value);
  // Η αντικειμενική αξία τροφοδοτεί την προεπισκόπηση απόδοσης όταν λείπει η εμπορική
  // (καθρέφτης του resolveValue: εμπορική > αντικειμενική).
  const effValueN = valueN ?? num(objValue);
  const rentN = num(rent);
  const annualRent = rentN != null ? rentN * 12 : null;
  const grossYield = (annualRent != null && effValueN != null && effValueN > 0) ? (annualRent / effValueN) * 100 : null;

  // ── Ο ΦΟΡΟΣ ΤΟΥ ΜΙΣΘΩΜΑΤΟΣ, ΚΑΘΩΣ ΓΡΑΦΕΤΑΙ ──────────────────────────────
  // Ο ίδιος υπολογισμός με την κάρτα του πρώτου φόρου και το πλακίδιο της
  // Επισκόπησης (lib/onboarding/firstTax.ts). Ο χρήστης βλέπει τι σημαίνει το
  // ποσό που γράφει πριν πατήσει αποθήκευση, όχι τρεις οθόνες μετά.
  //
  // ΚΑΙ ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΖΟΥΝ ΣΤΗΝ ΙΔΙΑ ΚΑΡΤΑ. Ηταν δεύτερο παράθυρο μετά την
  // αποθήκευση («Το ακίνητο αποθηκεύτηκε»), ένα πέπλο ακόμη πριν φτάσει ο
  // χρήστης στην Επισκόπηση. Εδώ τις βλέπει τη στιγμή που γράφει το ποσό.
  const [today] = useState(athensToday);
  const taxLabelId = useId();
  const draftTax = statusKey
    ? firstTaxOf({ id: existing?.id ?? 'draft', ...dbStatus, target_rent: rentN != null && rentN > 0 ? rentN : null, ownership: num(ownership) ?? 100 }, today)
    : null;
  // ΜΙΑ ΓΡΑΜΜΗ, Ο ΙΔΙΟΣ ΦΟΡΟΣ (κριτική σχεδίασης r2, 13/11/2026). Ηταν οι δύο
  // επόμενες προθεσμίες του προφίλ, με πρώτη τη δόση του ΕΝΦΙΑ κάτω από τον
  // φόρο ενοικίων. Τώρα η ίδια γραμμή με την υποδοχή (`taxDeadlineRow`): η
  // επόμενη προθεσμία του φόρου εισοδήματος, μόνο σε νοικιασμένο ακίνητο.
  const draftRow = draftTax?.rented ? taxDeadlineRow(status, today) : null;
  const taxShown = !!draftTax && draftTax.rented && draftTax.annual > 0;
  const rentTaxPreview = draftTax && (
    <section className="wiz-tax" aria-labelledby={taxLabelId} style={{ '--radius-inner': `${T.radius.inner}px` } as React.CSSProperties}>
      <div id={taxLabelId} className="wiz-tax-label">{draftTax.rented ? `Φόρος ενοικίων ${draftTax.year}` : 'Φόρος ενοικίων'}</div>
      {/* Μόνο το ποσό ακούγεται όταν αλλάζει, όχι όλη η κάρτα σε κάθε πλήκτρο. */}
      <div aria-live="polite">
        {taxShown
          ? <>
            <div className="wiz-tax-amount">{fe(draftTax.tax)}</div>
            <div className="wiz-tax-note">{`Ενδεικτικά, για έσοδα ${fe(draftTax.annual)} τον χρόνο.`}</div>
          </>
          : <div className="wiz-tax-empty">{draftTax.rented ? 'Γράψε το μίσθωμα και ο φόρος βγαίνει εδώ.' : 'Δεν νοικιάζεται, άρα δεν έχει φόρο ενοικίων.'}</div>}
      </div>
      {draftRow && (
        <div className="wiz-tax-row">
          <span className="po-elide">{draftRow.title}</span>
          <span className="wiz-tax-date">{draftRow.date}</span>
        </div>
      )}
    </section>
  );

  // ΣΕ ΝΟΙΚΙΑΣΜΕΝΟ ΑΚΙΝΗΤΟ ΡΩΤΑΜΕ ΤΟ ΕΝΟΙΚΙΟ, ΟΧΙ ΤΟΝ ΣΤΟΧΟ (αξιολόγηση
  // χρήστη, 20/10/2026). Ο ιδιοκτήτης που μόλις διάλεξε «Μακροχρόνια μίσθωση»
  // διάβαζε «Στόχος ενοικίου» και δεν ήξερε τι να γράψει: έχει ενοίκιο, όχι
  // στόχο. Το πεδίο είναι το ίδιο (`target_rent`) και πηγαίνει εκεί όπου η
  // εφαρμογή ζητά ήδη το μίσθωμα μισθωμένου ακινήτου χωρίς καταχωρημένη μίσθωση:
  // απόδοση, φόρος ενοικίων (lib/facts/taxIncome.ts, κανόνας 4) και Ε2
  // (lib/billing/e2.ts). Μόλις γραφτεί ενοικιαστής με μίσθωμα, μετρά εκείνο,
  // οπότε δεν υπάρχει δεύτερη πηγή που να διαφωνεί. Στο κενό, στην ανακαίνιση,
  // στην πώληση και στο αμφισβητούμενο μένει «στόχος», γιατί εκεί είναι.
  const leased = statusKey === 'rent_long';
  // Το «€» ζει μέσα στο πεδίο, ως κατάληξη (κριτική σχεδίασης r2), όχι δεύτερη φορά στην ετικέτα.
  const rentLabel = airbnb ? 'Μέσο μηνιαίο έσοδο' : leased ? 'Μηνιαίο μίσθωμα' : 'Στόχος ενοικίου ανά μήνα';
  const sqmLabel = propType === 'land' ? 'Εμβαδόν οικοπέδου (τ.μ.)' : 'Εμβαδόν (τ.μ.)';

  const canNext = page === 'type' ? !!propType && statusKey !== null : true;
  // Οι ομάδες επιλογών του πρώτου βήματος ονομάζονται από τον τίτλο τους.
  const typeGroupId = useId();
  const statusGroupId = useId();
  const nameId = useId();

  // ═══ Η «ΣΥΝΕΧΕΙΑ» ΛΕΕΙ ΤΙ ΛΕΙΠΕΙ, ΔΕΝ ΣΒΗΝΕΙ ═══════════════════════════════
  // Ηταν `disabled={!canNext}`. Στα 390 η υπόδειξη «Διάλεξε μία» της
  // κατάστασης κάθεται πεντακόσια εικονοστοιχεία πάνω από το υποσέλιδο, οπότε
  // ο χρήστης έβλεπε ένα σβηστό κουμπί χωρίς λόγο. Τώρα το πάτημα λέει τι
  // λείπει και φέρνει στο βλέμμα το σημείο που το ζητά.
  const next = () => {
    if (canNext) { goStep(s => s + 1); return; }
    setError('Διάλεξε κατάσταση για να συνεχίσεις.');
    document.getElementById(statusGroupId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // ΤΟ ΟΝΟΜΑ ΔΕΝ ΖΗΤΙΕΤΑΙ ΣΤΟ ΝΕΟ ΑΚΙΝΗΤΟ. Ηταν το μόνο υποχρεωτικό πεδίο που
  // ζητούσε πληκτρολόγηση και ο νέος χρήστης σταματούσε σε κενό κουτί για να
  // σκεφτεί ένα όνομα. Παίρνει τη διεύθυνση ή τον τύπο («Διαμέρισμα») και
  // αλλάζει από τα «Βασικά στοιχεία». Στην επεξεργασία το όνομα που σβήστηκε
  // ζητιέται ξανά: εκεί ο χρήστης το άλλαξε ο ίδιος.
  const finalName = name.trim() || (isEdit ? '' : defaultPropertyName(propertyTypeLabel(propType), address));
  const basicsStep = EDIT_PAGES.indexOf('basics');

  const save = async () => {
    if (!finalName) { setStep(basicsStep); setError('Γράψε ένα όνομα για το ακίνητο.'); return; }
    if (powerCheck.error) { if (isEdit) setStep(basicsStep); setError(`Αριθμός παροχής ρεύματος: ${powerCheck.error}`); return; }
    if (peaDatesBad && !isLandLike) { if (isEdit) setStep(basicsStep); setError('ΠΕΑ: η λήξη δεν μπορεί να είναι πριν από την έκδοση.'); return; }
    setSaving(true); setError('');

    // Συνιδιοκτήτες: τα ονόματα του οδηγού ξαναδένονται με ΑΦΜ, ποσοστό και
    // διεύθυνση που ήξερε ήδη η βάση. Στο 100% η λίστα σβήνει, εκτός αν η
    // Κατανομή σε συνιδιοκτήτες έχει γράψει στοιχεία που ο οδηγός δεν δείχνει.
    const coOwnersOut = isShared
      ? writeCoOwners(mergeCoOwnerNames(knownCoOwners, coOwners))
      : hasCoOwnerDetails(knownCoOwners) ? writeCoOwners(knownCoOwners) : null;

    const payload = {
      name: finalName,
      prop_type: propType,
      address: address.trim() || null,
      postal_code: postalCode.trim() || null,
      atak: atak.trim() || null,
      sqm: num(sqm),
      value: valueN,
      purchase_price: num(purchasePrice),
      target_rent: rentN,
      floor: isLandLike ? null : (floor.trim() || null),
      year_built: isLandLike ? null : (yearBuilt ? parseInt(yearBuilt) : null),
      ownership: num(ownership) ?? 100,
      co_owners: coOwnersOut,
      power_supply_no: powerCheck.value,
      status_detail: dbStatus.status_detail,
      obj_value: num(objValue),
      enfia: num(enfia),
      purchase_date: purchaseDate || null,
      pea_class: isLandLike ? null : (peaClass || null),
      pea_number: isLandLike ? null : cleanPeaNumber(peaNumber),
      pea_issued: isLandLike ? null : (isoDay(peaIssued) || null),
      pea_expiry: isLandLike ? null : (isoDay(peaExpiry) || null),
      heating: isLandLike ? null : (heating || null),
      parking_spaces: isLandLike ? null : (parking ? parseInt(parking) : null),
      storage_sqm: isLandLike ? null : num(storageSqm),
      bedrooms: isLandLike ? null : (bedrooms ? parseInt(bedrooms) : null),
      rental_mode: dbStatus.rental_mode,
      // Ο ΑΜΑ γράφεται μόνο όταν το ακίνητο είναι βραχυχρόνιο. Αν γυρίσει σε
      // μακροχρόνια, ΔΕΝ σβήνεται (μπορεί να ξαναγίνει Airbnb και ο αριθμός
      // μένει ο ίδιος) — απλώς παύει να ζητείται.
      ...(airbnb ? { ama: isValidAmaFormat(ama) ? ama : null } : {}),
    };
    // Η αποθήκευση είναι δύο κλήσεις: πρώτα το ακίνητο, μετά οι «Ρυθμίσεις».
    // Αν έσκαγε η δεύτερη (π.χ. χάθηκε το δίκτυο ενδιάμεσα), το ακίνητο είχε
    // ΗΔΗ δημιουργηθεί αλλά ο οδηγός το ξεχνούσε: το «Προσθήκη ακινήτου» που
    // πατούσε ο χρήστης βλέποντας το σφάλμα έκανε ΔΕΥΤΕΡΟ insert. Έβρισκε το
    // ίδιο ακίνητο δύο φορές στη λίστα — και επειδή τα ακίνητα μετρούν στο όριο
    // του πακέτου, το διπλό κατανάλωνε θέση που είχε πληρώσει.
    const savedId = existing?.id ?? createdId;
    let propertyId: string | null = savedId;
    let err: { message?: string } | null = null;
    if (savedId) {
      const { error: uErr } = await properties.update(supabase, savedId, payload, userId);
      err = uErr;
    } else {
      const { data: created, error: iErr } = await properties.add(supabase, { user_id: userId, ...payload });
      err = iErr;
      propertyId = created?.id ?? null;
      // Το κρατάμε ΠΡΙΝ από το δεύτερο βήμα: από εδώ και πέρα κάθε νέα
      // προσπάθεια ενημερώνει αυτό το ακίνητο αντί να φτιάχνει άλλο.
      if (propertyId) setCreatedId(propertyId);
    }
    if (err) { setSaving(false); setError(failed('Το ακίνητο δεν αποθηκεύτηκε', err)); return; }

    // ── ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΤΟΥ ΑΚΙΝΗΤΟΥ ΜΠΑΙΝΟΥΝ ΤΩΡΑ ─────────────────────────────
    // ΕΝΦΙΑ, Ε1/Ε2, Ε9 και, για βραχυχρόνια, οι μηνιαίες δηλώσεις: στο
    // ημερολόγιο, στις υπενθυμίσεις και στη συνδρομή του κινητού, χωρίς να
    // ψάξει ο χρήστης κουμπί συγχρονισμού (lib/calendar/taxSync.ts). Χωρίς
    // αναμονή: ο οδηγός δεν καθυστερεί και αν αποτύχει, το πρόγραμμα του
    // πρωινού τις γράφει.
    if (propertyId) void syncOwnerTaxDeadlines(supabase, userId);

    // ── ΟΙ ΥΠΕΝΘΥΜΙΣΕΙΣ ΤΟΥ ΠΕΑ ΑΚΟΛΟΥΘΟΥΝ ΤΗ ΛΗΞΗ ─────────────────────────────
    // Μόνο όταν η λήξη άλλαξε: η αποθήκευση για άλλο λόγο δεν ξαναγράφει
    // υπενθυμίσεις που ο χρήστης μπορεί να έχει ήδη σημειώσει. Η κενή λήξη τις
    // σβήνει. Με αναμονή, γιατί μια υπενθύμιση που δεν γράφτηκε δεν φαίνεται.
    // ΧΩΡΙΣ ΝΑ ΣΤΑΜΑΤΑ Η ΑΠΟΘΗΚΕΥΣΗ: το ακίνητο έχει ήδη γραφτεί, οπότε οι
    // επαφές, το σκαλί της αξίας και το `onSaved` γίνονται κανονικά και η
    // αποτυχία λέγεται σε ειδοποίηση που μένει μετά το κλείσιμο του οδηγού.
    const nextExpiry = payload.pea_expiry ?? '';
    if (propertyId && nextExpiry !== isoDay(existing?.pea_expiry)) {
      const { error: pErr } = await syncPeaReminders(supabase, { propertyId, userId }, peaReminderDrafts(nextExpiry, athensToday()));
      if (pErr) notifyError(failed('Το ακίνητο αποθηκεύτηκε, αλλά οι υπενθυμίσεις λήξης του ΠΕΑ δεν μπήκαν στο ημερολόγιο', pErr));
    }

    // ── ΤΟ ΣΚΑΛΙ ΤΗΣ ΑΞΙΑΣ ─────────────────────────────────────────────────
    // Το πρώτο ακίνητο είναι η στιγμή που η εφαρμογή αρχίζει να χρησιμεύει, το
    // δεύτερο είναι το πιο δυνατό σημάδι ότι κάποιος έμεινε. Τα δύο μετρώνται
    // χωριστά, γιατί απαντούν σε διαφορετική ερώτηση. Καταγράφεται ΜΟΝΟ σε νέο
    // ακίνητο: η επεξεργασία υπάρχοντος δεν είναι σκαλί.
    //
    // ΑΜΕΣΩΣ ΜΕΤΑ ΤΗ ΔΗΜΙΟΥΡΓΙΑ, ΟΧΙ ΣΤΟ ΤΕΛΟΣ. Αν έσκαγαν οι «Ρυθμίσεις» πιο
    // κάτω και ο χρήστης έκλεινε τον οδηγό, το ακίνητο υπήρχε και το γεγονός
    // όχι. Χωρίς αναμονή, για να μην προστεθεί γύρος πριν από τις Ρυθμίσεις·
    // το count() δεν πετάει.
    //
    // Πλήθος και μόνο, κανένα όνομα, καμία διεύθυνση, κανένα αναγνωριστικό.
    if (!savedId && propertyId) {
      void (async () => {
        const n = await properties.count(supabase, userId);
        void track(supabase, n >= 2 ? PRODUCT_EVENTS.second_property_added : PRODUCT_EVENTS.property_added, { count: n });
      })();
    }

    // property_settings: αποθήκευση μόνο αν έχει συμπληρωθεί κάτι (αποφυγή κενής γραμμής)
    // ΤΟ ΚΕΝΟ ΓΙΝΕΤΑΙ null (lib/property/settingsRow.ts): το '' στη λήξη
    // ασφάλισης, που είναι στήλη ημερομηνίας, απέρριπτε όλη τη γραμμή.
    if (propertyId && hasAnySetting(settings)) {
      const { error: sErr } = await supabase.from('property_settings')
        .upsert({ ...settingsRow(settings), property_id: propertyId, user_id: userId }, { onConflict: 'property_id' });
      // Το ακίνητο έχει ήδη αποθηκευτεί — λέμε ρητά τι έμεινε πίσω, ώστε το
      // «δοκίμασε ξανά» να μη διαβάζεται ως «ξαναφτιάξ' το από την αρχή».
      if (sErr) { setSaving(false); setError(failed('Το ακίνητο αποθηκεύτηκε, αλλά οι επαφές και οι σημειώσεις του δεν καταχωρήθηκαν', sErr)); return; }
    }

    setSaving(false);
    clearDraft(formKey);
    onSaved(propertyId);
  };

  // ── Η ΦΟΡΜΑ ΤΩΡΑ, ΤΑ «ΑΛΛΑΓΕΣ;» ΚΑΙ ΤΟ ΠΡΟΧΕΙΡΟ ─────────────────────────────
  const form: WizardForm = {
    propType, statusKey, ama, name, address, postalCode, atak, sqm, floor, yearBuilt,
    value, objValue, enfia, purchasePrice, purchaseDate, rent, ownership, coOwners,
    peaClass, heating, parking, storageSqm, powerSupply, bedrooms, peaNumber, peaIssued, peaExpiry, settings,
  };
  const dirty = !sameDraft(form, pristine);
  const formJson = JSON.stringify(form);
  // Μόνο νέο ακίνητο που δεν έχει γραφτεί ακόμη: μετά το πρώτο insert
  // (`createdId`) ένα πρόχειρο θα ξανάφτιαχνε το ίδιο ακίνητο από την αρχή.
  useEffect(() => {
    if (isEdit || saving) return;
    if (createdId || !dirty) { clearDraft(formKey); return; }
    writeDraft(formKey, { ...JSON.parse(formJson), step });
  }, [isEdit, saving, createdId, dirty, formKey, formJson, step]);

  // ══════════════════════════════════════════════════════════════════════════
  // ΤΟ ΣΥΜΦΡΑΖΟΜΕΝΟ ΠΟΥ ΚΡΙΝΕΙ ΤΙ ΦΑΙΝΕΤΑΙ
  //
  // Καμία είσοδος εδώ δεν είναι συμπέρασμα: και οι τέσσερις είναι πράγματα που
  // ο ΙΔΙΟΣ ο χρήστης δήλωσε λίγα δευτερόλεπτα νωρίτερα, στο πρώτο βήμα ή στο
  // ποσοστό ιδιοκτησίας. Ενα συμπέρασμα που πέφτει έξω κρύβει πεδίο που κάποιος
  // χρειάζεται και δεν του δίνει κανέναν τρόπο να το βρει.
  //
  // Τα `business` και `doubleEntry` μένουν ψευδή: κανένα πεδίο ΤΟΥ ΑΚΙΝΗΤΟΥ δεν
  // κρέμεται από τη νομική μορφή — αυτά κρίνουν τη φόρμα των λογιστικών, που
  // ζει αλλού.
  // ══════════════════════════════════════════════════════════════════════════
  const fieldCtx: FieldContext = {
    status,
    business: false,
    doubleEntry: false,
    // ΕΝΑ ΚΑΙ ΟΧΙ ΑΠΟ ΑΓΝΟΙΑ. Το πλήθος ακινήτων κρίνει ΜΟΝΟ την ενοποίηση
    // χαρτοφυλακίου, που ζει στη φόρμα των λογιστικών. Κανένα πεδίο του
    // ακινήτου δεν το ρωτά, οπότε ένα prop που θα έπρεπε να ταξιδέψει από τρεις
    // οθόνες ως εδώ δεν θα άλλαζε ούτε ένα κουτί.
    propertyCount: 1,
    land: isLandLike,
    shared: isShared,
  };
  const place = (id: string) => fieldPlacement(id, fieldCtx);
  // ΤΟ ΜΙΣΘΩΜΑ ΠΡΩΤΟ, Η ΑΝΤΙΚΕΙΜΕΝΙΚΗ ΣΤΑ «ΠΕΡΙΣΣΟΤΕΡΑ». Η αντικειμενική αξία
  // δεν αλλάζει τον φόρο ενοικίων που βλέπει ο χρήστης στο ίδιο βήμα και
  // ζητούσε ένα χαρτί (το Ε9) που ο νέος χρήστης σπάνια έχει μπροστά του.
  const placeMoney = (id: string): Placement => (id === 'prop.obj_value' && place(id) === 'core' ? 'more' : place(id));

  const railLabels = isEdit ? EDIT_STEPS : ONBOARDING_STEPS.map(s => s.label);
  const railRef = useRef<HTMLDivElement>(null);
  // Η λεπτή γραμμή κάτω από τη ράγα, μόνο όταν το σώμα έχει κυλήσει.
  useEffect(() => {
    const rail = railRef.current;
    const body = rail?.closest<HTMLElement>('.po-modal-body');
    if (!rail || !body) return;
    const sync = () => { if (body.scrollTop > 0) rail.dataset.scrolled = ''; else delete rail.dataset.scrolled; };
    sync();
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, []);
  // Νέο βήμα, από την κορυφή: το σώμα δεν κρατά την κύλιση του προηγούμενου.
  useEffect(() => { railRef.current?.closest<HTMLElement>('.po-modal-body')?.scrollTo({ top: 0 }); }, [step]);

  // ── ΔΕΝ ΚΛΕΙΝΕΙ ΟΣΟ ΑΠΟΘΗΚΕΥΕΙ ────────────────────────────────────────────
  // Το χειρόγραφο κέλυφος έκλεινε μόνο με κλικ στο φόντο ή στο «✕». Το Modal
  // προσθέτει Escape, δηλαδή έναν δρόμο εξόδου που πατιέται κατά λάθος — και η
  // `save()` είναι ΔΥΟ εγγραφές στη σειρά (user_properties, μετά
  // property_settings). Αν το παράθυρο φύγει ανάμεσά τους, χάνεται και το
  // `createdId`: η επόμενη προσπάθεια ΞΑΝΑΦΤΙΑΧΝΕΙ το ακίνητο αντί να το
  // ενημερώσει — ακριβώς το διπλό insert που ο κώδικας της `save()` μπήκε στον
  // κόπο να αποτρέψει. Και το μήνυμα «αποθηκεύτηκε το ακίνητο, όχι οι ρυθμίσεις»
  // δεν προλαβαίνει να διαβαστεί. Όσο γράφει, το παράθυρο μένει.
  //
  // ΤΟ ΒΗΜΑ ΟΠΟΥ ΕΚΛΕΙΣΕ. Νέο ακίνητο που δεν αποθηκεύτηκε ποτέ: το σκαλί
  // `wizard_closed` λέει σε ποιο από τα τέσσερα βήματα σταμάτησε. Η επεξεργασία
  // υπάρχοντος, ή ο οδηγός που έχει ήδη γράψει το ακίνητο, δεν μετρά.
  //
  // ΚΑΙ ΔΕΝ ΚΛΕΙΝΕΙ ΧΩΡΙΣ ΕΡΩΤΗΣΗ ΟΣΟ ΥΠΑΡΧΟΥΝ ΑΛΛΑΓΕΣ. Ένας δρόμος για όλα: το
  // φόντο, το Escape, το «×» και το «Ακύρωση» περνούν από εδώ.
  const requestClose = async (): Promise<boolean> => {
    if (saving) return false;
    if (dirty && !(await confirmDiscard())) return false;
    clearDraft(formKey);
    // ΤΟ ΑΚΙΝΗΤΟ ΥΠΑΡΧΕΙ ΗΔΗ: η λίστα ανανεώνεται. Αν έσκαγε το δεύτερο βήμα και
    // ο χρήστης έκλεινε τον οδηγό, η σελίδα δεν ξαναδιάβαζε τα ακίνητα και το
    // νέο ακίνητο φαινόταν να μην αποθηκεύτηκε ποτέ (αναφορά λογιστή, 06/11/2026).
    if (createdId && !isEdit) { onSaved(createdId); return true; }
    if (!isEdit && !createdId) void trackOnboarding(supabase, { event: PRODUCT_EVENTS.wizard_closed, step: step + 1 });
    onClose();
    return true;
  };

  // ΤΟ «ΠΙΣΩ» ΤΟΥ ΠΕΡΙΗΓΗΤΗ ΕΙΝΑΙ ΤΟ «ΠΙΣΩ» ΤΟΥ ΥΠΟΣΕΛΙΔΟΥ (components/useBackButton.ts):
  // στο δεύτερο βήμα γυρίζει στο πρώτο, στο πρώτο κλείνει, με την ίδια ερώτηση
  // για τις αλλαγές. Ποτέ έξω από τον πίνακα με μισογραμμένο ακίνητο.
  useBackButton(rearm => {
    if (saving) { rearm(); return; }
    if (!isEdit && step > 0) { goStep(s => s - 1); rearm(); return; }
    void requestClose().then(closed => { if (!closed) rearm(); });
  });

  return (
    // ΠΟΛΥΒΗΜΑΤΙΚΟ, ΑΛΛΑ ΠΑΡΑΘΥΡΟ — ΟΧΙ ΟΛΟΣΕΛΙΔΗ ΕΜΠΕΙΡΙΑ.
    // Κεντραρισμένο, 640 πλάτος, με τίτλο και ενέργειες: ό,τι ακριβώς είναι το
    // Modal. Ο τίτλος μένει σταθερός και ο υπότιτλος αλλάζει ανά βήμα («Βήμα 2
    // από 5 · Βασικά»), οπότε το βήμα λέγεται μία φορά, εκεί που το περιμένει ο
    // χρήστης. Το χειρόγραφο κέλυφος δεν άκουγε Escape, δεν επέστρεφε την
    // εστίαση και δεν κλείδωνε την κύλιση του φόντου· και το «✕» του ήταν
    // 36×36 με radius 18, δηλαδή τέταρτο σχήμα κλεισίματος στην ίδια εφαρμογή.
    <Modal open onClose={requestClose} size="md" className="wiz-scrim"
      ariaLabel={isEdit ? 'Επεξεργασία ακινήτου' : 'Νέο ακίνητο'}
      // Ο ΥΠΟΤΙΤΛΟΣ ΕΛΕΓΕ «Βήμα 1 από 5 · Τύπος» ΚΑΙ ΑΠΟ ΚΑΤΩ Η ΡΑΓΑ ΤΟ ΙΔΙΟ.
      // Η ράγα λέει περισσότερα με μια ματιά· η φράση ήταν η ίδια πληροφορία δεύτερη φορά.
      title={isEdit ? 'Επεξεργασία ακινήτου' : 'Νέο ακίνητο'}
      // ═══ ΕΝΑ ΚΥΡΙΟ ΚΟΥΜΠΙ ΑΝΑ ΒΗΜΑ ΚΑΙ ΕΝΑ ΗΣΥΧΟ ΓΙΑ ΠΙΣΩ ═══════════════
      // Ηταν τρία: «Πίσω», «Αποθήκευση τώρα» με περίγραμμα στη μέση και
      // «Συνέχεια», με λεκτικά που άλλαζαν κάτω από τα 420 εικονοστοιχεία. Ο
      // νέος οδηγός έχει δύο οθόνες, οπότε η αποθήκευση είναι απλώς το κύριο
      // κουμπί της δεύτερης. Η επεξεργασία έχει καρτέλες στη ράγα και
      // αποθηκεύει από όποια καρτέλα. Τα λεκτικά δεν αλλάζουν με το πλάτος.
      footer={isEdit ? <>
        <Btn variant="ghost" size="lg" onClick={requestClose}>Ακύρωση</Btn>
        <Btn variant="primary" size="lg" onClick={save} disabled={saving}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</Btn>
      </> : <>
        {/* ΣΤΟ ΠΡΩΤΟ ΒΗΜΑ ΜΟΝΟ «Συνέχεια» (κριτική σχεδίασης r2). Το «Ακύρωση»
            έκανε ό,τι το «×» της κεφαλίδας και στο τηλέφωνο έκοβε το κύριο
            κουμπί στη μέση· τώρα εκείνο πιάνει όλο το πλάτος (`act-fill`). */}
        {step > 0 && <Btn variant="ghost" size="lg" onClick={() => goStep(s => s - 1)}>Πίσω</Btn>}
        {step < pages.length - 1
          ? <Btn variant="primary" size="lg" className="act-fill" onClick={next}>Συνέχεια</Btn>
          : <Btn variant="primary" size="lg" onClick={save} disabled={saving}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</Btn>}
      </>}>

      {/* ═══ Η ΡΑΓΑ: ΙΣΕΣ ΣΤΗΛΕΣ, ΟΛΑ ΤΑ ΟΝΟΜΑΤΑ, ΚΟΛΛΗΜΕΝΗ ΣΤΗΝ ΚΟΡΥΦΗ ═════════
          ΙΣΕΣ ΣΤΗΛΕΣ. Κάθε βήμα παίρνει το ίδιο κλάσμα του πλάτους και ο κόμβος
          κάθεται στο κέντρο της στήλης του· η γραμμή ένωσης πάει από κέντρο σε
          κέντρο (globals.css, `.wiz-rail`). Ετσι τα κενά είναι ίσα σε κάθε
          πλάτος, χωρίς να μετρά κανείς ονόματα.

          ΟΛΑ ΤΑ ΟΝΟΜΑΤΑ ΦΑΙΝΟΝΤΑΙ. Στα 320 ο νέος οδηγός έχει τρία ονόματα σε
          στήλες των 90: χωρούν. Πριν,
          τα ονόματα των άλλων βημάτων έκρυβαν στο κινητό και ο χρήστης έβλεπε
          κύκλους χωρίς λόγια.

          ΚΟΛΛΗΜΕΝΗ. Σε μακρύ βήμα η ράγα έφευγε με την κύλιση και άφηνε ένα
          ορφανό όνομα στη μέση. Τώρα μένει στην κορυφή του σώματος, με μια
          λεπτή γραμμή από κάτω μόλις το σώμα κυλήσει (`data-scrolled`).

          ΣΤΟ ΝΕΟ ΑΚΙΝΗΤΟ, ΤΑ ΒΗΜΑΤΑ ΤΗΣ ΥΠΟΔΟΧΗΣ. Το τρίτο, «Ο φόρος σου», είναι
          ο προορισμός: η Επισκόπηση μετά την αποθήκευση. Στην επεξεργασία η
          ράγα δίνει τη θέση της σε τρεις καρτέλες (`.wiz-seg`).

          ΣΥΜΠΑΓΗΣ (κριτική σχεδίασης r2). Κεφαλίδα και ράγα έπιαναν 147 από τα
          640 ύψος στα 320· τώρα η ράγα είναι ως 64, με κόμβους 24. */}
      <div ref={railRef} className="wiz-rail" data-kind={isEdit ? 'tabs' : 'steps'}>
        {isEdit ? (
          // ΣΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ, ΚΑΡΤΕΛΕΣ: τρία τμήματα χωρίς αριθμούς και χωρίς
          // γραμμές ένωσης, ώστε να μη διαβάζονται ως βήματα που πρέπει να
          // περάσεις. Τα βέλη μετακινούν την επιλογή, όπως σε κάθε σειρά καρτελών.
          <div role="tablist" aria-label="Ενότητες" className="wiz-seg"
            onKeyDown={e => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
              e.preventDefault();
              const n = railLabels.length;
              const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (step + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
              goStep(() => to);
              requestAnimationFrame(() => railRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus());
            }}>
            {railLabels.map((label, i) => (
              <button key={label} type="button" role="tab" className="wiz-tab" aria-selected={i === step} tabIndex={i === step ? 0 : -1}
                onClick={() => goStep(() => i)}>{label}</button>
            ))}
          </div>
        ) : (
          <ol aria-label="Βήματα" style={{ gridTemplateColumns: `repeat(${railLabels.length}, minmax(0, 1fr))` }}>
            {railLabels.map((label, i) => {
              const done = i < step, active = i === step;
              // Ο ΤΡΙΤΟΣ ΚΟΜΒΟΣ ΕΙΝΑΙ ΠΡΟΟΡΙΣΜΟΣ, ΟΧΙ ΟΘΟΝΗ (κριτική σχεδίασης r2).
              // Η αποθήκευση ανοίγει την Επισκόπηση με τον φόρο στην κορυφή, οπότε
              // ο κόμβος δεν γίνεται ποτέ «τρέχων» μέσα στο παράθυρο: διακεκομμένο
              // περίγραμμα, χωρίς αριθμό, ώστε να μην υπόσχεται τρίτη οθόνη.
              const dest = i >= pages.length;
              return (
                <li key={label} className="wiz-rail-col" data-reached={i <= step ? '' : undefined} aria-current={active ? 'step' : undefined}>
                  <span className="wiz-node" data-state={dest ? 'dest' : active ? 'now' : done ? 'done' : 'todo'} aria-hidden>
                    {dest ? null : done ? <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : i + 1}
                  </span>
                  <span className={`wiz-step${active ? ' wiz-step-on' : ''}`}>{label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {/* ΤΟ ΠΡΟΧΕΙΡΟ ΛΕΓΕΤΑΙ. Χωρίς αυτή τη γραμμή, ένας οδηγός που ανοίγει
          γεμάτος μοιάζει με λάθος: «ποιος τα έγραψε αυτά;». */}
      {draft && (
        <p role="status" style={{ ...TT.bodySm, margin: 0 }}>
          Συνεχίζεις από εκεί που σταμάτησες. Το πρόχειρο μένει μόνο σε αυτή την καρτέλα.
        </p>
      )}

      {/* STEP 1, Τύπος & Κατάσταση */}
      {page === 'type' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Η ΜΑΖΙΚΗ ΚΑΤΑΧΩΡΗΣΗ: στο παράθυρο πρώτη, σε ουδέτερη επιφάνεια· στο
              τηλέφωνο μία ήσυχη γραμμή κάτω από την κατάσταση (BulkImportCard). */}
          {!isEdit && onBulkImport && <BulkImportCard onStart={onBulkImport} hasProperties={hasProperties} />}
          <div>
            {/* ΕΝΑ ΜΟΤΙΒΟ ΓΙΑ «ΔΕΙΞΕ ΚΙ ΑΛΛΑ», ΣΤΟΥΣ ΤΥΠΟΥΣ ΚΑΙ ΣΤΙΣ ΚΑΤΑΣΤΑΣΕΙΣ
                (κριτική σχεδίασης r2). Κουμπί κειμένου στη γραμμή της ετικέτας,
                δεξιά, που δεν εξαφανίζεται: «Όλοι οι τύποι» ανοίγει, «Λιγότεροι»
                κλείνει. Ηταν «Άλλο…» που αποκάλυπτε πλακίδιο με το ίδιο όνομα
                («Άλλο») και χανόταν χωρίς τρόπο να ξανακλείσει. */}
            <div className="wiz-group-head">
              <div id={typeGroupId} style={labelStyle}>Τύπος ακινήτου</div>
              <button type="button" className="wiz-more-link" aria-expanded={moreTypes} onClick={() => setMoreTypes(o => !o)}>
                {moreTypes ? 'Λιγότεροι' : 'Όλοι οι τύποι'}
              </button>
            </div>
            {/* ΕΞΙ ΠΛΑΚΙΔΙΑ ΚΑΙ «ΟΛΟΙ ΟΙ ΤΥΠΟΙ». Δώδεκα πλακίδια έπιαναν μισή οθόνη
                πριν φτάσει ο χρήστης στην ερώτηση που μετρά (την κατάσταση). Οι
                έξι συνηθέστεροι τύποι φαίνονται, οι υπόλοιποι ένα πάτημα πιο κάτω
                (lib/onboarding/steps.ts). Επιλογή από τους υπόλοιπους μένει
                ορατή και με κλειστή τη λίστα. Εξι στήλες στο παράθυρο, τρεις στο
                τηλέφωνο. Το `1fr` στις γραμμές δίνει σε όλα το ύψος του ψηλότερου. */}
            <div role="group" aria-labelledby={typeGroupId} className="wiz-types">
              {[...PRIMARY_TYPES, ...MORE_TYPES.filter(t => moreTypes || t === propType)].map(t => {
                const sel = propType === t;
                return (
                  // Πλακίδιο με ΚΑΤΑΣΤΑΣΗ, όχι ενέργεια: το `aria-pressed` το δηλώνει.
                  <ChipToggle key={t} on={sel} className="wiz-type" onClick={() => setPropType(t)}>
                    <span className="wiz-type-in">
                      <TypeIcon type={t} />
                      {/* Ίδιο βάρος επιλεγμένο και μη, όπως ζητά το ChipToggle: αλλιώς το
                          λεκτικό φαρδαίνει με το πάτημα και αλλάζει γραμμές. */}
                      <span style={{ fontWeight: 500, color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{propertyTypeLabel(t)}</span>
                    </span>
                  </ChipToggle>
                );
              })}
            </div>
          </div>

          <div>
            <div className="wiz-group-head">
              <div id={statusGroupId} style={labelStyle}>Κατάσταση</div>
              <button type="button" className="wiz-more-link" aria-expanded={moreStatuses} onClick={() => setMoreStatuses(o => !o)}>
                {moreStatuses ? 'Λιγότερες' : 'Όλες οι καταστάσεις'}
              </button>
            </div>
            {/* ΤΕΣΣΕΡΙΣ ΓΡΑΜΜΕΣ ΚΑΙ ΟΙ ΥΠΟΛΟΙΠΕΣ ΣΤΟ ΙΔΙΟ ΣΧΗΜΑ. Οι τέσσερις
                καταστάσεις που ζει σχεδόν κάθε ακίνητο φαίνονται με την επεξήγησή
                τους· οι τρεις σπάνιες έρχονται από κάτω ως ίδιες γραμμές, όχι ως
                πεδίο λίστας ανάμεσα σε κάρτες επιλογής (ήταν CustomSelect, άλλο
                ύψος, άλλο βάρος, άλλο χρώμα). Δύο στήλες στο παράθυρο, μία στο τηλέφωνο. */}
            <div role="group" aria-labelledby={statusGroupId} className="wiz-statuses">
              {[...PRIMARY_STATUSES, ...MORE_STATUSES.filter(k => moreStatuses || k === statusKey)].map(key => {
                const st = BY_KEY[key];
                const sel = statusKey === key;
                return (
                  <ChipToggle key={key} on={sel} className="wiz-status" onClick={() => { setStatusKey(key); setError(''); }}>
                    <span className="wiz-status-in">
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--text-primary)' }}>{st.label}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.4, color: 'var(--text-tertiary)' }}>{st.hint}</span>
                    </span>
                  </ChipToggle>
                );
              })}
            </div>
          </div>
          {!isEdit && onBulkImport && <BulkImportCard compact onStart={onBulkImport} hasProperties={hasProperties} />}

          {/* Ο ΔΙΑΚΟΠΤΗΣ «Βραχυχρόνια μίσθωση (Airbnb / Booking)» ΕΦΥΓΕ.
              Έκανε ό,τι ακριβώς και το chip «Βραχυχρόνια μίσθωση» — έγραφε
              την ίδια κατάσταση — και όσο ήταν αναμμένος ΝΕΚΡΩΝΕ ολόκληρη τη
              σειρά των chips (opacity 0.5, pointerEvents none). Δύο
              χειριστήρια για ένα πεδίο, με το ένα να απενεργοποιεί το άλλο:
              ο χρήστης δεν μπορούσε να καταλάβει ποιο είναι το κανονικό.
              Ο ΑΜΑ, που ήταν ο πραγματικός λόγος να ξεχωρίζει η βραχυχρόνια,
              εμφανίζεται από μόνος του μόλις επιλεγεί εκείνη η κατάσταση. */}

          {/* Ο ΑΜΑ ΕΜΦΑΝΙΖΕΤΑΙ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΤΟ ΑΚΙΝΗΤΟ ΓΙΝΕΤΑΙ ΒΡΑΧΥΧΡΟΝΙΟ.
              Δεν υπάρχει ξεχωριστός διακόπτης και δεν κρύβεται σε accordion
              άλλης καρτέλας: η κατάσταση του ακινήτου είναι η ερώτηση, ο ΑΜΑ
              είναι η αμέσως επόμενη. Δεν είναι υποχρεωτικό πεδίο εδώ (ο
              χρήστης μπορεί να μην τον έχει ακόμη) — αν λείψει, η μόνιμη
              γραμμή στους «Επισκέπτες» και στην «Τιμολόγηση» τον ζητά ξανά. */}
          {airbnb && (
            <div style={{ marginTop: -8 }}>
              <Field label="Αριθμός Μητρώου Ακινήτου (ΑΜΑ)">
                <input style={inputStyle} value={ama} onChange={e => setAma(cleanAma(e.target.value))}
                  // Η ΥΠΟΔΕΙΞΗ ΚΟΒΟΤΑΝ ΣΤΑ 320: ήθελε 234 και το πεδίο δίνει 204.
                  // Το «μόνο ψηφία» το λέει ήδη το πληκτρολόγιο που ανοίγει
                  // (inputMode numeric) και ο έλεγχος που απορρίπτει γράμματα· η
                  // πηγή δεν λέγεται πουθενά αλλού και μένει.
                  inputMode="numeric" placeholder="Από το myAADE"
                  onFocus={onFocus} onBlur={onBlur} />
              </Field>
              <div style={{ fontFamily: T.font.sans, fontSize: 12, color: amaLengthLooksUnusual(ama) ? 'var(--warning)' : 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                {amaLengthLooksUnusual(ama)
                  ? `Ο αριθμός έχει ${ama.length} ψηφία, που είναι ασυνήθιστο. Έλεγξέ τον στο myAADE πριν συνεχίσεις.`
                  // Η υποχρέωση αφορά κάθε αγγελία, σε όποιον ιστότοπο. Ο αριθμός
                  // των απενεργοποιήσεων δεν μπαίνει εδώ ώσπου να έχει πηγή με
                  // ημερομηνία και τίτλο της ΑΑΔΕ (βλ. lib/property/ama.ts).
                  : 'Ο ΑΜΑ πρέπει να αναγράφεται σε κάθε αγγελία του ακινήτου, σε όποια ιστοσελίδα κι αν δημοσιεύεται.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2, Βασικά Στοιχεία */}
      {/* ══════════════════════════════════════════════════════════════════
          ΤΑ ΤΡΙΑ ΒΗΜΑΤΑ ΠΕΡΑΣΑΝ ΑΠΟ ΤΟ ΜΗΤΡΩΟ ΠΕΔΙΩΝ

          Κάθε πεδίο ρωτά πρώτα το `lib/property/fields.ts` αν έχει νόημα για
          ΑΥΤΟΝ τον χρήστη και αν ναι, αν το χρειάζεται τώρα ή αργότερα. Ο
          κανόνας ζει εκεί μαζί με τον γραπτό λόγο ύπαρξης του πεδίου· εδώ
          μένει μόνο η τοποθέτηση. Τρία επίπεδα, το ίδιο με τη φόρμα
          ενοικιαστή, την απογραφή και τις επαφές:

            ορατό          → το χρειάζεται από την πρώτη μέρα
            «Περισσότερα»  → υπάρχει, με ένα πάτημα, όποτε βρεθούν τα χαρτιά
            δεν υπάρχει    → δεν έχει νόημα εδώ (όροφος σε οικόπεδο)

          Ο ΛΟΓΟΣ, ΜΕΤΡΗΜΕΝΟΣ. Τα τρία βήματα έδειχναν 72 χειριστήρια, από τα
          οποία ΔΥΟ είναι υποχρεωτικά. Τώρα ένα κενό διαμέρισμα δείχνει έξι
          και μια μακροχρόνια μίσθωση επτά. Κανένα πεδίο δεν σβήστηκε: ο
          οδηγός είναι ο ΜΟΝΟΣ επεξεργαστής των ρυθμίσεων ακινήτου, οπότε ό,τι
          φύγει από εδώ δεν υπάρχει πουθενά αλλού.
          ══════════════════════════════════════════════════════════════════ */}

      {page === 'basics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StepBody
            place={place}
            rows={[
              // Η ΔΙΕΥΘΥΝΣΗ ΠΡΩΤΗ, ΤΟ ΟΝΟΜΑ ΜΕΤΑ (κριτική σχεδίασης r2). Η λίστα «Από
              // πού ξεκινάς» υπόσχεται «Διεύθυνση, ΑΤΑΚ, εμβαδόν και ΠΕΑ» και ο
              // δρομέας περίμενε στο «Ονομασία». Το όνομα παίρνει ήδη τη διεύθυνση
              // όταν μένει κενό (`defaultPropertyName`), οπότε έρχεται δεύτερο.
              row('prop.address', 'full',
                <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Οδός Παραδείγματος 12, Αθήνα" onFocus={onFocus} onBlur={onBlur} autoFocus={!focusAfm} />),
              row('prop.name', 'full',
                <input id={nameId} style={inputStyle} value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Διαμέρισμα στο κέντρο" onFocus={onFocus} onBlur={onBlur} />),
              /* Η οδηγία ΔΕΝ ζει σε placeholder: το placeholder σβήνει με το πρώτο
                 ψηφίο, δηλαδή τη στιγμή ακριβώς που ο χρήστης το χρειάζεται. */
              row('prop.atak', 'full', <>
                <input style={numInputStyle} value={atak} onChange={e => setAtak(atakDigits(e.target.value))} inputMode="numeric" onFocus={onFocus} onBlur={onBlur} />
                <p style={{ ...TT.caption, marginTop: 6 }}>{ATAK_SOURCE}</p>
              </>, 'ΑΤΑΚ (Αριθμός Ταυτότητας Ακινήτου)'),
              row('prop.sqm', 'auto',
                <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={sqm} onChange={e => setSqm(e.target.value)} onFocus={onFocus} onBlur={onBlur} />, sqmLabel),
              row('prop.pea', 'auto',
                <CustomSelect ariaLabel="Ενεργειακή κλάση (ΠΕΑ)" value={peaClass} onChange={setPeaClass} placeholder="Επίλεξε" options={PEA_CLASSES.map(c => ({ value: c, label: c }))} />, 'Ενεργειακή κλάση (ΠΕΑ)'),
              row('prop.pea_cert', 'full', <>
                <div style={grid3}>
                  <Field label="Αριθμός ΠΕΑ"><input style={inputStyle} value={peaNumber} maxLength={PEA_NUMBER_MAX} onChange={e => setPeaNumber(e.target.value)} onFocus={onFocus} onBlur={onBlur} /></Field>
                  <Field label="Έκδοση ΠΕΑ"><DatePicker value={peaIssued} onChange={v => { setPeaIssued(v); setError(''); }} /></Field>
                  <Field label="Λήξη ΠΕΑ"><DatePicker value={peaExpiry} onChange={v => { setPeaExpiry(v); setError(''); }} /></Field>
                </div>
                <p style={{ ...TT.caption, marginTop: 6, color: peaDatesBad ? 'var(--negative)' : undefined }}>
                  {peaDatesBad ? 'Η λήξη δεν μπορεί να είναι πριν από την έκδοση.' : `Όπως τυπώνονται στο πιστοποιητικό. Από τη λήξη μπαίνουν υπενθυμίσεις ${PEA_REMINDER_DAYS.join(' και ')} ημέρες πριν και την ημέρα της λήξης.`}
                </p>
              </>),
              row('prop.bedrooms', 'auto',
                <input style={numInputStyle} type="number" min={0} value={bedrooms} onChange={e => setBedrooms(e.target.value)} onFocus={onFocus} onBlur={onBlur} />),
              row('prop.postal_code', 'auto',
                <input style={inputStyle} value={postalCode} onChange={e => setPostalCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" placeholder="10000" onFocus={onFocus} onBlur={onBlur} />),
              row('prop.floor', 'auto',
                <CustomSelect ariaLabel="Όροφος" value={floor} onChange={setFloor} placeholder="Επίλεξε" options={FLOOR_OPTS.map(f => ({ value: f, label: f }))} />),
              row('prop.year_built', 'auto',
                <input style={numInputStyle} type="number" min={0} value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} onFocus={onFocus} onBlur={onBlur} />),
              row('prop.heating', 'auto',
                <CustomSelect ariaLabel="Θέρμανση" value={heating} onChange={setHeating} placeholder="Επίλεξε" options={[...HEATING_TYPES]} />),
              row('prop.parking', 'auto',
                <input style={numInputStyle} type="number" min={0} value={parking} onChange={e => setParking(e.target.value)} onFocus={onFocus} onBlur={onBlur} />),
              row('prop.power_supply_no', 'full', <>
                <input style={numInputStyle} value={powerSupply} onChange={e => { setPowerSupply(e.target.value); setError(''); }} inputMode="numeric" aria-invalid={!!powerCheck.error} onFocus={onFocus} onBlur={onBlur} />
                <p style={{ ...TT.caption, marginTop: 6, color: powerCheck.error ? 'var(--negative)' : undefined }}>
                  {powerCheck.error ?? `Από τον λογαριασμό ρεύματος. Στο Ε2 μπαίνουν τα ${E2_POWER_SUPPLY_DIGITS} πρώτα ψηφία, ακόμη και σε κενό ακίνητο.`}
                </p>
                {!powerSupply.trim() && powerHint && (
                  <div style={{ marginTop: 8 }}>
                    <Btn variant="secondary" onClick={() => setPowerSupply(powerHint)}>
                      Από σαρωμένο λογαριασμό: {powerHint}
                    </Btn>
                  </div>
                )}
              </>, 'Αριθμός παροχής ρεύματος'),
              row('prop.storage_sqm', 'auto',
                <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={storageSqm} onChange={e => setStorageSqm(e.target.value)} onFocus={onFocus} onBlur={onBlur} />, 'Αποθήκη (τ.μ.)'),
            ]}
          />
          {/* ΟΙ ΕΠΑΦΕΣ ΖΟΥΝ ΣΤΟ ΤΕΛΟΣ ΤΩΝ «ΒΑΣΙΚΩΝ», ΚΛΕΙΣΤΕΣ. Ηταν η «Σύνοψη»·
              κανένα πεδίο τους δεν χρειάζεται για να υπάρξει το ακίνητο: τα
              στοιχεία του ιδιοκτήτη έρχονται από το προφίλ και οι πάροχοι από
              την πρώτη σάρωση λογαριασμού. Στις ετικέτες του μητρώου λέγεται
              ΤΙΝΟΣ είναι το στοιχείο («Ονοματεπώνυμο ιδιοκτήτη»). */}
          <StepBody
            place={place}
            moreTitle="Επαφές, προαιρετικά"
            lessTitle="Απόκρυψη επαφών"
            defaultOpen={focusAfm}
            rows={[
              row('prop.owner_name', 'full', <>
                {/* Λέμε από πού ήρθαν τα στοιχεία. Προσυμπληρωμένο ΑΦΜ που δεν
                    ελέγχθηκε είναι χειρότερο από κενό: φαίνεται επιβεβαιωμένο. */}
                {!existing?.id && (settings.owner_name || settings.owner_afm) && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginBottom: 6 }}>
                    Συμπληρώθηκαν από το προφίλ σου. Έλεγξέ τα και άλλαξε ό,τι χρειάζεται.
                  </div>
                )}
                <input style={inputStyle} value={settings.owner_name} onChange={setSf('owner_name')} onFocus={onFocus} onBlur={onBlur} />
              </>),
              row('prop.owner_afm', 'auto',
                <input style={numInputStyle} value={settings.owner_afm} onChange={setSf('owner_afm')} inputMode="numeric" autoFocus={focusAfm} onFocus={onFocus} onBlur={onBlur} />),
              row('prop.owner_phone', 'auto',
                <input style={inputStyle} value={settings.owner_phone} onChange={setSf('owner_phone')} inputMode="tel" onFocus={onFocus} onBlur={onBlur} />),
              row('prop.owner_email', 'full',
                <input type="email" style={inputStyle} value={settings.owner_email} onChange={setSf('owner_email')} onFocus={onFocus} onBlur={onBlur} />),
              /* ΤΟ «ΠΡΟΓΡΑΜΜΑ» ΕΦΥΓΕ. Ζητούσε το εμπορικό όνομα του πακέτου
                 internet — κάτι που ούτε ο ίδιος ο συνδρομητής θυμάται, δεν
                 χρησιμοποιείται πουθενά στην εφαρμογή και δεν αλλάζει καμία
                 απόφαση. Μια φόρμα καταχώρησης δεν έχει δικαίωμα να ρωτά κάτι
                 που δεν πρόκειται να χρησιμοποιήσει. */
              row('prop.providers', 'full', <div style={grid3}>
                <Field label="Ρεύμα"><input style={inputStyle} value={settings.electricity_provider} onChange={setSf('electricity_provider')} onFocus={onFocus} onBlur={onBlur} /></Field>
                <Field label="Νερό"><input style={inputStyle} value={settings.water_provider} onChange={setSf('water_provider')} onFocus={onFocus} onBlur={onBlur} /></Field>
                <Field label="Internet"><input style={inputStyle} value={settings.internet_provider} onChange={setSf('internet_provider')} onFocus={onFocus} onBlur={onBlur} /></Field>
              </div>),
              row('prop.manager', 'full', <div style={grid2}>
                <Field label="Ονοματεπώνυμο"><input style={inputStyle} value={settings.property_manager} onChange={setSf('property_manager')} onFocus={onFocus} onBlur={onBlur} /></Field>
                <Field label="Τηλέφωνο"><input style={inputStyle} value={settings.property_manager_phone} onChange={setSf('property_manager_phone')} inputMode="tel" onFocus={onFocus} onBlur={onBlur} /></Field>
              </div>),
              row('prop.insurance', 'full', <div style={grid3}>
                <Field label="Ασφαλιστική"><input style={inputStyle} value={settings.insurance_company} onChange={setSf('insurance_company')} onFocus={onFocus} onBlur={onBlur} /></Field>
                <Field label="Αριθμός ασφαλιστηρίου"><input style={inputStyle} value={settings.insurance_policy} onChange={setSf('insurance_policy')} onFocus={onFocus} onBlur={onBlur} /></Field>
                <Field label="Λήξη"><DatePicker value={settings.insurance_expiry} onChange={v => setSettings(p => ({ ...p, insurance_expiry: v }))} /></Field>
              </div>),
              row('prop.notes', 'full',
                <textarea value={settings.notes} onChange={setSf('notes')} rows={4} style={{ ...inputStyle, height: 'auto', resize: 'none' }} />, 'Σημειώσεις'),
            ]}
          />
        </div>
      )}

      {/* STEP 3, Οικονομικά */}
      {page === 'money' && (
        <StepBody
          place={placeMoney}
          rows={[
            row('prop.rent', airbnb ? 'full' : 'auto', <>
              {/* Στο νέο ακίνητο ο δρομέας περιμένει ήδη στο ποσό και το Enter
                  αποθηκεύει: το βήμα γίνεται χωρίς ποντίκι και χωρίς ψάξιμο. */}
              {/* ΧΩΡΙΣ ΑΡΙΘΜΟ-ΥΠΟΔΕΙΓΜΑ (κριτική σχεδίασης r2): το «820» δίπλα στο
                  «Γράψε το μίσθωμα» έμοιαζε ήδη γραμμένο. Το πεδίο ανοίγει κενό,
                  με το «€» ως ήσυχη κατάληξη μέσα του. */}
              <div className="wiz-suffix">
                <input style={{ ...numInputStyle, paddingRight: 36 }} type="number" min={0} inputMode="decimal" value={rent} onChange={e => setRent(e.target.value)} onFocus={onFocus} onBlur={onBlur}
                  autoFocus={!isEdit || focusRent}
                  onKeyDown={e => { if (e.key === 'Enter' && !isEdit) { e.preventDefault(); void save(); } }} />
                <span aria-hidden>€</span>
              </div>
              {airbnb && (
                <div style={{ ...TT.caption, marginTop: 6 }}>
                  Τιμή ανά νύχτα επί τις νύχτες του μήνα, κατά μέσο όρο.
                </div>
              )}
              {leased && (
                <div style={{ ...TT.caption, marginTop: 6 }}>
                  Όπως γράφει το μισθωτήριο.
                </div>
              )}
            </>, rentLabel),
            row('prop.obj_value', 'auto', <>
              <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={objValue} onChange={e => setObjValue(e.target.value)} onFocus={onFocus} onBlur={onBlur} />
              {/* Ο ΕΝΦΙΑ κόβει μόνος του το ποσοστό ιδιοκτησίας: η αξία του
                  μεριδίου εδώ θα το έκοβε δεύτερη φορά. */}
              <div style={{ fontFamily: T.font.sans, fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                {OBJ_VALUE_WHOLE}
              </div>
            </>, 'Αντικειμενική αξία (€)'),
            row('prop.co_owners', 'full', <>
              <input style={numInputStyle} type="number" inputMode="numeric" min={1} max={99} value={coOwners.length}
                onChange={e => setCoOwnerCount(parseInt(e.target.value, 10))} onFocus={onFocus} onBlur={onBlur} />
              <div style={{ ...grid2, marginTop: 12 }}>
                {coOwners.map((nm, i) => (
                  <Field key={i} label={coOwners.length === 1 ? 'Όνομα συνιδιοκτήτη' : `Όνομα συνιδιοκτήτη ${i + 1}`}>
                    <input style={inputStyle} type="text" value={nm} onChange={e => setCoOwnerAt(i, e.target.value)} placeholder="Ονοματεπώνυμο" onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                ))}
              </div>
            </>, 'Αριθμός συνιδιοκτητών'),
            row('prop.value', 'auto',
              <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} onFocus={onFocus} onBlur={onBlur} />, 'Εμπορική αξία (€)'),
            row('prop.purchase_price', 'auto',
              <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} onFocus={onFocus} onBlur={onBlur} />, 'Τιμή αγοράς (€)'),
            row('prop.purchase_date', 'auto',
              <DatePicker value={purchaseDate} onChange={setPurchaseDate} />),
            row('prop.enfia', 'auto',
              <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={enfia} onChange={e => setEnfia(e.target.value)} onFocus={onFocus} onBlur={onBlur} />, 'ΕΝΦΙΑ που πληρώνεις (€/έτος)'),
            row('prop.ownership', 'auto',
              <input style={numInputStyle} type="number" min={0} inputMode="decimal" value={ownership} onChange={e => setOwnership(e.target.value)} max={100} onFocus={onFocus} onBlur={onBlur} />, 'Ποσοστό ιδιοκτησίας (%)'),
          ]}
          after={<>{rentTaxPreview}{grossYield != null && (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.card, padding: 16 }}>
              <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-base)', fontWeight: 600, lineHeight: 1.3, color: 'var(--accent)', marginBottom: 6 }}>Εκτιμώμενη μεικτή απόδοση</div>
              <div style={{ fontFamily: T.font.num, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fp(grossYield)}</div>
              <div style={{ fontFamily: T.font.sans, fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {`Ετήσια έσοδα ${fe(annualRent!)} επί ${valueN != null ? 'εμπορικής' : 'αντικειμενικής'} αξίας ${fe(effValueN!)}`}
              </div>
            </div>
          )}</>}
        />
      )}

      {/* ΤΟ ΣΦΑΛΜΑ ΖΟΥΣΕ ΜΟΝΟ ΣΤΟ ΤΕΛΕΥΤΑΙΟ ΒΗΜΑ. Η «Αποθήκευση τώρα» υπάρχει από
          το δεύτερο βήμα και καλεί την ίδια `save()`: αν η βάση την αρνιόταν
          (όριο πακέτου, δίκτυο), το κουμπί γύριζε πίσω και δεν εμφανιζόταν
          τίποτα. Ο χρήστης νόμιζε ότι αποθηκεύτηκε. Τώρα φαίνεται σε κάθε βήμα
          και ανακοινώνεται. */}
      {error && (
        <div role="alert" style={{ marginTop: 16, background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: 10, padding: '10px 14px', fontFamily: T.font.sans, fontSize: 'var(--fs-base)', color: 'var(--negative)' }}>{error}</div>
      )}
    </Modal>
  );
}
