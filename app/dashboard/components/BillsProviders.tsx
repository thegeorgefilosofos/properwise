'use client';

import { daysUntil } from '@/lib/core/time';
import { NumberInput, CustomSelect, TextInput, Toggle, DatePicker } from './UIComponents';
import { useBillsSettings } from './BillsSettings';
import { usePropertyHeating } from './usePropertyHeating';
import { HEATING_TYPES, isCentralHeating } from '@/lib/property/heating';
import { T, fe, feRate, fieldRow, fixedCols, fp, Spinner, pressable } from '@/components/Theme';
import { waterMonthly, waterMonthlyText } from '@/lib/energy/tariff';
import { AsOfNote } from '@/components/AsOfNote';
import { telecomAsOf, asOfDate } from '@/lib/facts/prices';

const INTERNET_PROVIDERS = [
  { value: 'cosmote',   label: 'Telekom',   url: 'https://www.telekom.gr',    color: '#e20074' },
  { value: 'nova',      label: 'Nova',       url: 'https://www.nova.gr',       color: '#e4002b' },
  { value: 'vodafone',  label: 'Vodafone',   url: 'https://www.vodafone.gr',   color: '#e60000' },
  { value: 'inalan',    label: 'Inalan',     url: 'https://www.inalan.gr',     color: '#0073ff' },
  { value: 'hol',       label: 'HOL',        url: 'https://www.hol.gr',        color: '#f97316' },

  { value: 'dei',       label: 'ΔΕΗ Telecom', url: 'https://www.dei.gr',         color: '#1a7fe0' },
  { value: 'other',     label: 'Άλλος',       url: '',                           color: '#94a3b8' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΑΚΕΤΑ ΣΥΝΔΡΟΜΗΤΙΚΗΣ ΤΗΛΕΟΡΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΗΤΑΝ ΑΔΕΙΟΣ ΚΑΙ ΣΩΣΤΑ: οι τιμές των πακέτων αλλάζουν και το μόνο που τα
// κάνει χρήσιμα είναι να είναι ΣΩΣΤΑ. Ένα επινοημένο «MagentaTV Full, 30€»
// δεν είναι προσέγγιση — είναι λάθος νούμερο σε οθόνη που ο ιδιοκτήτης θα
// συγκρίνει με τον λογαριασμό του. Γέμισε από τις επίσημες σελίδες.
//
// ΤΙ ΜΠΗΚΕ ΚΑΙ ΤΙ ΟΧΙ. Μόνο πακέτα ΣΚΕΤΗΣ τηλεόρασης. Οι συνδυασμοί με
// internet (Fiber 100 με Vodafone TV, Double Play με Τηλεόραση) ΔΕΝ μπαίνουν
// εδώ: είναι προγράμματα σύνδεσης και ζουν στο INTERNET_PLANS. Αν έμπαιναν και
// στα δύο, το ίδιο ποσό θα μετριόταν δύο φορές στο μηνιαίο σύνολο.
//
// ΤΟ `sports` ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ Ο ΠΙΝΑΚΑΣ: όταν το πακέτο περιέχει
// αθλητικά κανάλια, ο διακόπτης ανάβει μόνος του. Ο χρήστης δεν ξαναδηλώνει
// κάτι που ήδη είπε διαλέγοντας το πακέτο. Ανάβει, δεν σβήνει: πακέτο χωρίς
// αθλητικά δεν σημαίνει ότι δεν έχει ξεχωριστή συνδρομή.
//
// ΟΙ ΤΙΜΕΣ ΠΕΡΙΛΑΜΒΑΝΟΥΝ ΦΠΑ 24%, όπως τις δείχνουν οι πάροχοι. Όπου η τιμή δεν
// επιβεβαιώνεται, μπαίνει το πακέτο χωρίς ποσό και το γράφει ο χρήστης.
// ═══════════════════════════════════════════════════════════════════════════
const TV_PROVIDERS = [
  { value: 'cosmote',     label: 'MagentaTV',   url: 'https://www.telekom.gr/static/residential/el/tv' },
  { value: 'nova',        label: 'Nova / EON',  url: 'https://nova.gr/eon-tv/programmata/eon' },
  { value: 'vodafone',    label: 'Vodafone TV', url: 'https://www.vodafone.gr/tv' },
  { value: 'skyshowtime', label: 'SkyShowtime', url: 'https://www.skyshowtime.com/gr' },
  { value: 'other',       label: 'Άλλος',       url: '' },
];

interface TvPack { id: string; name: string; price?: number; sports?: boolean }

/**
 * ΑΠΟ ΤΟ ΦΘΗΝΟΤΕΡΟ ΣΤΟ ΑΚΡΙΒΟΤΕΡΟ ΚΑΙ ΤΑ ΑΤΙΜΟΛΟΓΗΤΑ ΣΤΟ ΤΕΛΟΣ.
 *
 * Τα πακέτα μπήκαν όπως τα βρήκαμε στη σελίδα του καθενός: συμβολαίου, μετά
 * χωρίς δέσμευση, μετά δορυφορικά. Στον επιλογέα αυτό δεν φαίνεται ως ομάδες —
 * φαίνεται ως 8,15, 10,90, 25,45, 28,20, 16,00, δηλαδή ως αταξία. Η μόνη σειρά
 * που βοηθά όποιον διαλέγει πακέτο είναι η τιμή και τη βγάζει ο κώδικας ώστε
 * να μη χρειάζεται να τη θυμάται όποιος προσθέτει γραμμή.
 */
const byPrice = (packs: TvPack[]): TvPack[] =>
  [...packs].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

const TV_PACKS: Record<string, TvPack[]> = Object.fromEntries(Object.entries({
  cosmote: [
    // Πακέτα συμβολαίου
    { id: 'cos_entry',        name: 'Entry', price: 8.15 },
    { id: 'cos_cinema',       name: 'Cinema', price: 10.90 },
    { id: 'cos_sports',       name: 'Sports', price: 25.45, sports: true },
    { id: 'cos_full',         name: 'Full', price: 28.20, sports: true },
    // Μηνιαία, χωρίς δέσμευση
    { id: 'cos_ent_m',        name: 'Entertainment, χωρίς δέσμευση', price: 16.00 },
    { id: 'cos_sports_m',     name: 'Sports, χωρίς δέσμευση', price: 30.82, sports: true },
    { id: 'cos_full_m',       name: 'Full, χωρίς δέσμευση', price: 33.54, sports: true },
    // Με Netflix
    { id: 'cos_cinema_nflx',  name: 'Cinema και Netflix', price: 17.90 },
    { id: 'cos_full_nflx',    name: 'Full και Netflix', price: 35.17, sports: true },
    // Μέσω δορυφόρου
    { id: 'cos_sat_family',   name: 'Family, μέσω δορυφόρου', price: 11.73 },
    { id: 'cos_sat_cinema',   name: 'Cinema, μέσω δορυφόρου', price: 15.36 },
    { id: 'cos_sat_sports',   name: 'Sports, μέσω δορυφόρου', price: 27.18, sports: true },
    { id: 'cos_sat_full',     name: 'Full, μέσω δορυφόρου', price: 29.91, sports: true },
  ],
  nova: [
    { id: 'eon_nobox',   name: 'EON, χωρίς Smart Box', price: 10, sports: true },
    { id: 'eon',         name: 'EON', price: 12, sports: true },
    { id: 'eonp_nobox',  name: 'EON+, χωρίς Smart Box', price: 26, sports: true },
    { id: 'eonp',        name: 'EON+', price: 28, sports: true },
  ],
  // ΤΟ VODAFONE TV START ΕΙΝΑΙ 3,90€, ΟΠΩΣ ΤΟ ΓΡΑΦΕΙ Η ΣΕΛΙΔΑ ΤΟΥ.
  //
  // Είχε γίνει 9,90€ από δημοσιεύματα για την αναπροσαρμογή της 17ης Μαρτίου
  // 2026 (6,30€ → 9,90€). Η ζωντανή σελίδα δείχνει «Μόνο 3,90€/μήνα» και η
  // σελίδα του παρόχου υπερισχύει κάθε δημοσιεύματος: μια ανακοίνωση αύξησης
  // δεν είναι η τιμή που θα δει ο ιδιοκτήτης στο καλάθι του.
  //
  // Ο ΜΟΝΟΣ ΚΑΤΑΛΟΓΟΣ ΤΗΣ VODAFONE ΜΕ ΣΚΕΤΗ ΤΗΛΕΟΡΑΣΗ. Τα άλλα δύο της σελίδας
  // («Fiber 100 με Vodafone TV», «Full Fiber 300 Plus με Vodafone TV Plus»)
  // είναι προγράμματα σύνδεσης και ζουν στο INTERNET_PLANS, αλλιώς το ίδιο ποσό
  // μετριέται δύο φορές στο μηνιαίο σύνολο.
  vodafone: [
    { id: 'vf_start', name: 'Vodafone TV Start', price: 3.90 },
  ],
  // ΤΑ ΔΥΟ ΑΚΡΙΒΟΤΕΡΑ ΠΑΚΕΤΑ ΤΟΥ SKYSHOWTIME ΜΠΑΙΝΟΥΝ ΧΩΡΙΣ ΤΙΜΗ, ΕΠΙΤΗΔΕΣ.
  // Η πηγή που τα αναφέρει γράφει «περίπου» και για τα δύο. Ένα «περίπου» σε
  // πεδίο που αθροίζεται παύει να είναι επιφύλαξη και γίνεται νούμερο: ο χρήστης
  // βλέπει σύνολο που δεν συμφωνεί με την κάρτα του και ψάχνει τη διαφορά. Το
  // όνομα του πακέτου το ξέρουμε, οπότε δίνεται· το ποσό το γράφει ο ίδιος στο
  // διπλανό πεδίο.
  skyshowtime: [
    { id: 'sky_ads',  name: 'Standard, με διαφημίσεις', price: 4.99 },
    { id: 'sky_std',  name: 'Standard, χωρίς διαφημίσεις' },
    { id: 'sky_prem', name: 'Premium' },
  ],
}).map(([provider, packs]) => [provider, byPrice(packs)]));

// ΤΟ `null` ΣΗΜΑΙΝΕΙ «ΔΕΝ ΕΠΙΒΕΒΑΙΩΘΗΚΕ», ΟΧΙ «ΟΧΙ» (12/10/2026). Ένα
// `hasPhone: false` γράφει «Όχι» στη στήλη του σταθερού και ένα `contract` που
// λείπει γράφει «Χωρίς δέσμευση»: δύο ισχυρισμοί. Όπου η ανάγνωση της πηγής δεν
// τους στηρίζει (δορυφορικά, φοιτητικό της Telekom), ο πίνακας γράφει «Δεν
// επιβεβαιώθηκε» και η επιλογή του προγράμματος δεν αλλάζει τον διακόπτη του
// σταθερού.
export const INTERNET_PLANS: Record<string, {
  id: string; name: string; speed: string; price: number;
  hasPhone: boolean | null; hasTV?: boolean; hasMobile?: boolean;
  note: string; contract?: string | null; student?: boolean; backup?: boolean;
  networkType?: string; // ADSL | VDSL | Fiber | 5G | Δορυφορικό
}[]> = {
  cosmote: [
    // ── Double Play (Σταθερή + Internet) ─────────────────────────────────
    // ═══ ΤΟ ΠΑΛΙΟ ADSL ΤΩΝ 24 Mbps ΔΕΝ ΠΩΛΕΙΤΑΙ ΠΙΑ ══════════════════════════
    // Ο κατάλογος του eshop (07/09/2026) φιλτράρει ταχύτητες 50, 100, 300 και
    // 500 — καμία εγγραφή στα 24. Η γραμμή ΜΕΝΕΙ γιατί το `internetPlanId`
    // αποθηκεύεται: όποιος είναι ήδη σε αυτό το συμβόλαιο πρέπει να μπορεί να
    // το κρατήσει επιλεγμένο. Το λέει όμως η ίδια, ώστε κανείς να μη νομίσει
    // ότι μπορεί να το πάρει σήμερα.
    //
    // Η ΤΙΜΗ ΜΕΤΑ ΤΗ ΛΗΞΗ ΕΛΕΙΠΕ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ. Ο κατάλογος προσφορών οικιακών
    // της Telekom (https://www.cosmote.gr/static/uploads/programmata_prosfores_2_2_2026_out.pdf,
    // ανάγνωση 12/10/2026, ΦΠΑ 24% μέσα) δίνει για κάθε πρόγραμμα δύο ποσά: την
    // προσφορά των 24 μηνών και το πάγιο μετά. Ο πίνακας εδώ έδειχνε μόνο το
    // πρώτο· όποιος συγκρίνει με λογαριασμό τρίτου χρόνου έβλεπε πολύ μεγαλύτερο
    // πάγιο χωρίς εξήγηση. Το δεύτερο ποσό μπαίνει στη σημείωση. Το ίδιο
    // PDF έχει ακόμη το «Double Play Unlimited» των 24 Mbps (19,90€, μετά
    // 42,90€, «από 2/2/2026»). Το «δεν προσφέρεται πλέον» μένει, γιατί το eshop
    // της 07/09/2026 είναι νεότερο από το PDF· η τιμή μετά τη λήξη αφορά
    // ακριβώς όσους το έχουν ήδη.
    { id:'c_dp_24',    name: 'Double Play Unlimited 24 (παλαιό)', speed: '24 Mbps', price: 19.90, hasPhone: true,  note: 'ADSL. Δεν προσφέρεται πλέον σε νέες συνδέσεις· μένει για όσους το έχουν ήδη. Μετά τους 24 μήνες 42,90€.', networkType: 'ADSL', contract: '24 μήνες' },
    { id:'c_dp_50',    name: 'Telekom Double Play Advanced Unlimited', speed: '50 Mbps', price: 22.90, hasPhone: true,  note: '100% οπτική ίνα ως την πρίζα, με εγγύηση καλής εγκατάστασης. Μετά τους 24 μήνες 47,90€.', networkType: 'Fiber', contract: '24 μήνες' },
    // ═══ ΔΥΟ ΠΑΚΕΤΑ ΜΕ ΤΟ ΙΔΙΟ ΟΝΟΜΑ ΚΑΙ ΤΗΝ ΙΔΙΑ ΤΙΜΗ ══════════════════════
    // ΤΟ 23,71€ ΔΕΝ ΥΠΑΡΧΕΙ ΣΕ ΚΑΝΕΝΑ ΑΠΟ ΤΑ ΔΥΟ PDF ΤΗΣ TELEKOM. Ήταν η τιμή
    // του eshop στις 07/09/2026, με τα 24,90€ διαγραμμένα δίπλα της· έτσι το
    // έγραφε το παλιό σχόλιο («στα 23,71€, διαγραμμένο από 24,90€»). Έμεινε
    // εδώ ως τιμή του προγράμματος. Ο κατάλογος προσφορών (ανάγνωση
    // 12/10/2026) γράφει 24,90€ και για τα δύο «Fiber 100 Unlimited», με 52,90€
    // μετά τους 24 μήνες. Η διαφορά τους δεν είναι πια στην τιμή αλλά στη
    // γραμμή: το ένα είναι 100% οπτική ίνα ως την πρίζα με εγγύηση
    // εγκατάστασης· το άλλο «έως 100 Mbps» με μόνο δωρεάν router. Γι' αυτό
    // το λέει η σημείωση του καθενός: από την τιμή δεν ξεχωρίζουν.
    { id:'c_f100',     name: 'Telekom Fiber 100 Unlimited', speed: '100 Mbps',  price: 24.90, hasPhone: true,  note: '100% οπτική ίνα ως την πρίζα, με εγγύηση καλής εγκατάστασης. Μετά τους 24 μήνες 52,90€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f100_vdsl', name: 'Telekom Fiber 100 Unlimited (έως 100)', speed: '100 Mbps', price: 24.90, hasPhone: true, note: 'Έως 100 Mbps, χωρίς εγγύηση εγκατάστασης. Δωρεάν ασύρματο router. Μετά τους 24 μήνες 52,90€.', networkType: 'VDSL', contract: '24 μήνες' },
    // ΤΟ FIBER 100 XL ΕΛΕΙΠΕ. Ίδιος κατάλογος, ανάγνωση 12/10/2026: 33,90€ και
    // 51,90€ μετά τους 24 μήνες. Τα 500 λεπτά προς κινητά είναι από την
    // ανάγνωση του ίδιου PDF στις 05/10/2026. Ο τύπος γραμμής δεν αναγράφεται
    // στον έλεγχο και δεν συμπληρώνεται εδώ.
    { id:'c_f100_xl',  name: 'Telekom Fiber 100 XL',        speed: '100 Mbps',  price: 33.90, hasPhone: true,  note: '500 λεπτά προς κινητά. Μετά τους 24 μήνες 51,90€.', contract: '24 μήνες' },
    // Η ΒΑΘΜΙΔΑ ΤΩΝ 200 ΕΛΕΙΠΕ. Από τον κατάλογο προσφορών οικιακών της Telekom
    // (πρώην Cosmote, cosmote.gr/static/uploads/programmata_prosfores_2_2_2026_out.pdf), ανάγνωση 05/10/2026
    // και ξανά 12/10/2026, ΦΠΑ 24% μέσα. Η τιμή μετά τη λήξη του 24μήνου πάει στη σημείωση.
    { id:'c_f200',     name: 'Telekom Fiber 200 Unlimited', speed: '200 Mbps',  price: 34.20, hasPhone: true,  note: 'Μόνο οπτική ίνα FTTH. Μετά τους 24 μήνες 64,67€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f300',     name: 'Telekom Fiber 300 Unlimited', speed: '300 Mbps',  price: 27.90, hasPhone: true,  note: 'Οπτική ίνα FTTH, 150 Mbps upload. Με MagentaTV Start δώρο. Μετά τους 24 μήνες 58,00€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f500',     name: 'Telekom Fiber 500 Unlimited', speed: '500 Mbps',  price: 31.90, hasPhone: true,  note: 'Οπτική ίνα FTTH, 250 Mbps upload. Με MagentaTV Start δώρο. Μετά τους 24 μήνες 67,53€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f1g',      name: 'Telekom Fiber 1Gbps Unlimited', speed: '1 Gbps',  price: 35.90, hasPhone: true,  note: 'Οπτική ίνα FTTH, 500 Mbps upload. Με MagentaTV Start δώρο. Μετά τους 24 μήνες 81,81€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f3g',      name: 'Telekom Fiber 3Gbps Unlimited', speed: '3 Gbps',  price: 70.39, hasPhone: true,  note: 'Οπτική ίνα FTTH, 1.500 Mbps upload. Με MagentaTV Start δώρο. Μετά τους 24 μήνες 105,62€.', networkType: 'Fiber', contract: '24 μήνες' },
    // ΤΟ ΦΟΙΤΗΤΙΚΟ ΤΗΣ TELEKOM ΕΛΕΙΠΕ. Ίδιος κατάλογος, ανάγνωση 12/10/2026:
    // What's Up Student 1000 S, μόνο για φοιτητές, 24,90€ και 71,90€ μετά τους
    // 24 μήνες. Ο τύπος γραμμής δεν αναγράφεται στον έλεγχο. Ούτε η τηλεφωνία:
    // `hasPhone: null`.
    { id:'c_wus_1g',   name: "Telekom What's Up Student 1000 S", speed: '1 Gbps', price: 24.90, hasPhone: null,  note: 'Μόνο για φοιτητές. Μετά τους 24 μήνες 71,90€.', contract: '24 μήνες', student: true },
    // ── 5G WiFi (Internet backup μέσω 5G) ────────────────────────────────
    // ΔΕΝ ΞΑΝΑΕΠΙΒΕΒΑΙΩΘΗΚΑΝ ΜΕΤΑ ΤΗ ΜΕΤΟΝΟΜΑΣΙΑ. Ο κατάλογος που ελέγχθηκε
    // στις 07/09/2026 ήταν των Double Play οπτικής ίνας· τα ασύρματα ζουν σε
    // άλλη σελίδα. Ούτε στον έλεγχο της 12/10/2026 δεν διαβάστηκε η σελίδα
    // 5G της Telekom. Τα ποσά μένουν ως έχουν, χωρίς να δηλώνονται ελεγμένα.
    { id:'c_5g50',     name: '5G WiFi Double Play 50',      speed: '50 Mbps',   price: 30.90, hasPhone: true,  note: 'Ασύρματο 5G, Internet backup. Χωρίς καλωδίωση. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: '5G', backup: true },
    { id:'c_5g300',    name: '5G WiFi Double Play 300',     speed: '300 Mbps',  price: 35.90, hasPhone: true,  note: 'Ασύρματο 5G, Internet backup. Χωρίς καλωδίωση. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: '5G', backup: true },
    { id:'c_5g_free',  name: '5G WiFi 300 Χωρίς Σύμβαση',  speed: '300 Mbps',  price: 35.90, hasPhone: true,  note: 'Ασύρματο 5G χωρίς δέσμευση. Εξοπλισμός 349€. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: '5G', backup: true },
    // ── Δορυφορικό, για ακίνητα χωρίς καλώδιο ────────────────────────────
    // Τιμοκατάλογος xDSL/FTTH της Telekom (έγγραφο 15/01/2026,
    // https://help.telekom.gr/uploads/Prosvasi%CE%A7DSL_evrizonikes_150126.pdf),
    // ανάγνωση 05/10/2026. Το 50 με τιμή προσφοράς· ο κατάλογος γράφει 59,90€.
    // Ο έλεγχος της 12/10/2026 δεν ξαναγράφει τα δορυφορικά, οπότε η σημείωση
    // κρατά τη δική τους ημερομηνία αντί να δανειστεί του παρόχου. Δέσμευση και
    // τηλεφωνία δεν τις καταγράφει η ανάγνωση: `null` και στα δύο.
    { id:'c_sat25',    name: 'Telekom Satellite Internet 25 Unlimited', speed: '25/6 Mbps', price: 44.90, hasPhone: null, contract: null, note: 'Δορυφορικό internet, όπου δεν φτάνει καλώδιο. Από τον τιμοκατάλογο xDSL/FTTH της Telekom, ανάγνωση 05/10/2026.', networkType: 'Δορυφορικό' },
    { id:'c_sat50',    name: 'Telekom Satellite Internet 50 Unlimited', speed: '50/6 Mbps', price: 49.90, hasPhone: null, contract: null, note: 'Δορυφορικό internet, όπου δεν φτάνει καλώδιο. Τιμή προσφοράς· ο τιμοκατάλογος xDSL/FTTH της Telekom γράφει 59,90€ (ανάγνωση 05/10/2026).', networkType: 'Δορυφορικό' },
    // ── Triple Play (Σταθερή + Internet + Τηλεόραση) ─────────────────────
    // ΚΑΝΕΝΑ ΠΟΣΟ ΕΔΩ ΔΕΝ ΕΙΝΑΙ ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΣΗΜΕΡΙΝΗ ΠΡΟΣΦΟΡΑ. Το 48,77€ και
    // το 51,85€ που έγραφαν οι δύο πρώτες γραμμές δεν υπάρχουν στο PDF ούτε
    // είχαν άλλη πηγή. Ο κατάλογος
    // προσφορών της Telekom (PDF 02/02/2026) έχει «Fiber 100 Unlimited + TV
    // Full» 57,91€ (μετά 73,83€) και «New Fiber 300 + TV Full» 61,55€ (μετά
    // 75,75€) «από 23/8/2024»: γραμμές παλαιότερων προσφορών μέσα στο ίδιο
    // έγγραφο, που η ανάγνωση της 12/10/2026 δεν επιβεβαιώνει ως σημερινές.
    // Οι δύο γραμμές μένουν γιατί το `id` τους αποθηκεύεται. Παίρνουν την τιμή
    // του PDF, που τουλάχιστον έχει πηγή. Το c_f300_tv παίρνει και το όνομα
    // της γραμμής του PDF («New Fiber 300 + TV Full»): δεν είναι το σημερινό
    // c_f300 με τηλεόραση. Η σημείωση λέει ότι η διάθεση
    // δεν επιβεβαιώθηκε. Οι υπόλοιποι συνδυασμοί με τηλεόραση του ίδιου PDF
    // (Double Play Advanced με Entry, Cinema ή Full· Fiber 200, 500 και 1G με
    // Full) δεν μπαίνουν για τον ίδιο λόγο. Τα δύο με Netflix δεν υπάρχουν
    // στο PDF.
    { id:'c_f100_tv',  name: 'Telekom Fiber 100 Unlimited + MagentaTV Full', speed: '100 Mbps',  price: 57.91, hasPhone: true, hasTV: true, note: 'FTTH + MagentaTV Full. Μετά τους 24 μήνες 73,83€. Τιμή από τον κατάλογο προσφορών της Telekom (PDF 02/02/2026)· η διάθεση σήμερα δεν επιβεβαιώθηκε (12/10/2026).', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f300_tv',  name: 'Telekom New Fiber 300 + TV Full', speed: '300 Mbps',  price: 61.55, hasPhone: true, hasTV: true, note: 'FTTH + MagentaTV Full. Μετά τους 24 μήνες 75,75€. Τιμή από τον κατάλογο προσφορών της Telekom (PDF 02/02/2026), γραμμή με ισχύ από 23/08/2024· η διάθεση σήμερα δεν επιβεβαιώθηκε (12/10/2026).', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f500_tv',  name: 'Fiber 500 + TV + Netflix',    speed: '500 Mbps',  price: 62.06, hasPhone: true, hasTV: true, note: 'FTTH + MagentaTV + Netflix. Δωρεάν εξοπλισμός. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'c_f1g_tv',   name: 'Fiber 1 Gbps + TV + Netflix', speed: '1 Gbps',    price: 65.30, hasPhone: true, hasTV: true, note: 'FTTH + MagentaTV + Netflix. Δωρεάν εξοπλισμός. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
  ],
  nova: [
    // ── Double Play (Σταθερή + Internet) ─────────────────────────────────
    // Ούτε στον έλεγχο της 12/10/2026 δεν εμφανίστηκαν στις σελίδες της Nova:
    // τα ποσά μένουν και η σημείωση λέει ότι δεν επαληθεύτηκαν.
    { id:'n_24',       name: 'Nova 24 Double Play',         speed: '24 Mbps',   price: 18.90, hasPhone: true,  note: 'ADSL. Απεριόριστα λεπτά σταθερά και κινητά. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: 'ADSL', contract: '24 μήνες' },
    { id:'n_50',       name: 'Nova 50 Double Play',         speed: '50 Mbps',   price: 22.90, hasPhone: true,  note: 'VDSL. Απεριόριστα λεπτά σταθερά και κινητά. Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026.', networkType: 'VDSL', contract: '24 μήνες' },
    // ═══ ΟΙ ΒΑΘΜΙΔΕΣ ΟΠΤΙΚΗΣ ΙΝΑΣ, ΑΠΟ ΤΗ ΣΕΛΙΔΑ ΤΗΣ NOVA (28/09/2026) ═══════
    // Πηγή: https://nova.gr/statheri-tilefonia/programmata/stathero-internet,
    // ανάγνωση ομάδας Grok 28/09/2026 (ops.handoffs a41bd5b2, P1-11). Ίδια
    // ποσά στις αναγνώσεις της 05/10/2026 και της 12/10/2026.
    // Ο κατάλογος έγραφε 24,90 · 27,90 · 32,90 · 37,90 για 100/300/600/1G. Η
    // σελίδα γράφει 21 · 23 · 26 · 31 · 54 για 100/300/500/1G/3G και δεν έχει
    // βαθμίδα 600: ήταν ανύπαρκτο προϊόν, που έβγαινε και φθηνότερο από το 1G.
    { id:'n_f100',     name: 'Nova Fiber 100',              speed: '100 Mbps',  price: 21.00, hasPhone: true,  note: 'Οπτική ίνα FTTH. Απεριόριστα λεπτά.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f300',     name: 'Nova Fiber 300',              speed: '300 Mbps',  price: 23.00, hasPhone: true,  note: 'Οπτική ίνα FTTH. Απεριόριστα λεπτά. Τιμή προσφοράς· η σελίδα της Nova γράφει από 26€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f500',     name: 'Nova Fiber 500',              speed: '500 Mbps',  price: 26.00, hasPhone: true,  note: 'Οπτική ίνα FTTH. Απεριόριστα λεπτά.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f1g',      name: 'Nova Fiber 1 Gbps',           speed: '1 Gbps',    price: 31.00, hasPhone: true,  note: 'Οπτική ίνα FTTH. Απεριόριστα λεπτά.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f3g',      name: 'Nova Fiber 3 Gbps',           speed: '3 Gbps',    price: 54.00, hasPhone: true,  note: 'Οπτική ίνα FTTH. Απεριόριστα λεπτά.', networkType: 'Fiber', contract: '24 μήνες' },
    // ── Triple Play (Σταθερή + Internet + EON) ───────────────────────────
    // ΕΠΑΛΗΘΕΥΜΕΝΑ 05/10/2026 ΚΑΙ ΞΑΝΑ 12/10/2026 από
    // https://nova.gr/eon-tv/programmata/eon-me-statheri:
    // νέες ενεργοποιήσεις, 24 μήνες, χωρίς Smart Box, ΦΠΑ 24% μέσα. Ως τότε
    // έγραφαν 41,90 · 44,90 · 54,90€ «μη επαληθευμένη» και το 1 Gbps
    // ανέφερε Netflix, που η σελίδα δεν δείχνει. Τα τρία παλιά `id`
    // μένουν (αποθηκεύονται) και δείχνουν τώρα το EON+, το πακέτο με τα
    // αθλητικά που περιέγραφαν. Πρόσθετα της ίδιας σελίδας (05/10/2026): EON
    // Extra +2,73€, διεθνείς κλήσεις +7,00€ τον μήνα.
    { id:'n_f100_eon', name: 'Nova Fiber 100 EON',          speed: '100/10 Mbps', price: 27.00, hasPhone: true, hasTV: true, note: 'FTTH + EON, 89 κανάλια (65 HD). Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f300_eon', name: 'Nova Fiber 300 EON',          speed: '300/150 Mbps', price: 29.00, hasPhone: true, hasTV: true, note: 'FTTH + EON, 89 κανάλια (65 HD). Χωρίς Smart Box. Τιμή προσφοράς· η σελίδα γράφει από 32€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f500_eon', name: 'Nova Fiber 500 EON',          speed: '500/250 Mbps', price: 32.00, hasPhone: true, hasTV: true, note: 'FTTH + EON, 89 κανάλια (65 HD). Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f1g_eon',  name: 'Nova Fiber 1 Gbps EON',       speed: '1 Gbps/500 Mbps', price: 37.00, hasPhone: true, hasTV: true, note: 'FTTH + EON, 89 κανάλια (65 HD). Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f3g_eon',  name: 'Nova Fiber 3 Gbps EON',       speed: '3 Gbps/1,5 Gbps', price: 60.00, hasPhone: true, hasTV: true, note: 'FTTH + EON, 89 κανάλια (65 HD). Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f100_tv',  name: 'Nova Fiber 100 EON+',         speed: '100/10 Mbps', price: 40.00, hasPhone: true, hasTV: true, note: 'FTTH + EON+, 117 κανάλια (92 HD) με Novasports. Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f300_tv',  name: 'Nova Fiber 300 EON+',         speed: '300/150 Mbps', price: 42.00, hasPhone: true, hasTV: true, note: 'FTTH + EON+, 117 κανάλια (92 HD) με Novasports. Χωρίς Smart Box. Τιμή προσφοράς· η σελίδα γράφει από 45€.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f500_eonp', name: 'Nova Fiber 500 EON+',        speed: '500/250 Mbps', price: 45.00, hasPhone: true, hasTV: true, note: 'FTTH + EON+, 117 κανάλια (92 HD) με Novasports. Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f1g_tv',   name: 'Nova Fiber 1 Gbps EON+',      speed: '1 Gbps/500 Mbps', price: 50.00, hasPhone: true, hasTV: true, note: 'FTTH + EON+, 117 κανάλια (92 HD) με Novasports. Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'n_f3g_eonp', name: 'Nova Fiber 3 Gbps EON+',      speed: '3 Gbps/1,5 Gbps', price: 73.00, hasPhone: true, hasTV: true, note: 'FTTH + EON+, 117 κανάλια (92 HD) με Novasports. Χωρίς Smart Box.', networkType: 'Fiber', contract: '24 μήνες' },
  ],
  vodafone: [
    // ── Double Play (Σταθερή + Internet) ─────────────────────────────────
    { id:'v_24',       name: 'Vodafone 24',                 speed: '24 Mbps',   price: 21.00, hasPhone: true,  note: 'ADSL. Απεριόριστα σταθερά, 300 λεπτά κινητά. Η σελίδα της Vodafone δεν δείχνει τιμή (05/10/2026): μη επαληθευμένη.', networkType: 'ADSL', contract: '24 μήνες' },
    { id:'v_50',       name: 'Vodafone 50',                 speed: '50 Mbps',   price: 24.00, hasPhone: true,  note: 'VDSL. Απεριόριστα σταθερά, 300 λεπτά κινητά. Η σελίδα της Vodafone δεν δείχνει τιμή (05/10/2026): μη επαληθευμένη.', networkType: 'VDSL', contract: '24 μήνες' },
    // ΤΟ FIBER 100 ΧΩΡΙΣ ΤΗΛΕΟΡΑΣΗ ΕΛΕΙΠΕ. Από https://www.vodafone.gr/statheri-internet-programmata,
    // ανάγνωση 05/10/2026. Η ημερομηνία μπαίνει και στη σημείωση: η Vodafone
    // έχει ημερομηνία ελέγχου 04/10/2026 από άλλη σελίδα (fiber-to-the-home) και
    // χωρίς αυτήν η γραμμή θα φαινόταν να την καλύπτει. Το ίδιο για τις τρεις
    // γραμμές με τηλεόραση πιο κάτω.
    { id:'v_f100',     name: 'Fiber 100',                   speed: '100 Mbps',  price: 26.00, hasPhone: true,  note: 'Εγγυημένη ταχύτητα 93 Mbps. Απεριόριστα σταθερά, 360 λεπτά προς κινητά και διεθνή 45 χωρών. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα προγραμμάτων της Vodafone, ανάγνωση 05/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
    // Πηγή: https://www.vodafone.gr/statheri-internet-programmata/fiber-to-the-home
    // (04/10/2026, ανάγνωση της ομάδας Grok, οδηγία ιδιοκτήτη). Τιμή χωρίς
    // κινητή Vodafone στο `price` (χωρίς όρο), με κινητή στη σημείωση. Πριν:
    // 35,00 / 42,00 / 49,00. ΟΧΙ ο τιμοκατάλογος Μαρτίου 2026 (52,38 / 57,14 /
    // 66,67): εκείνα είναι άλλα προϊόντα (Homedouble play FTTH Pro).
    { id:'v_ff300',    name: 'Full Fiber 300 Plus',         speed: '300 Mbps',  price: 24.22, hasPhone: true,  note: 'Οπτική ίνα FTTH. Με συμβόλαιο κινητής Vodafone 22,80€/μήνα. ΦΠΑ 24% μέσα. Η σελίδα γράφει ότι οι προσφορές ισχύουν για νέους πελάτες με 24μηνο συμβόλαιο και ότι για αιτήσεις από 01/05/26 η τιμή προσφοράς ισχύει τους 12 πρώτους μήνες, με αναπροσαρμογή του παγίου έως 3€ από τον 13ο.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'v_ff500',    name: 'Full Fiber 500 Plus',         speed: '500 Mbps',  price: 28.35, hasPhone: true,  note: 'Οπτική ίνα FTTH. Με συμβόλαιο κινητής Vodafone 26,90€/μήνα. ΦΠΑ 24% μέσα. Η σελίδα γράφει ότι οι προσφορές ισχύουν για νέους πελάτες με 24μηνο συμβόλαιο και ότι για αιτήσεις από 01/05/26 η τιμή προσφοράς ισχύει τους 12 πρώτους μήνες, με αναπροσαρμογή του παγίου έως 3€ από τον 13ο.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'v_ff1g',     name: 'Full Fiber 1 Gbps Plus',      speed: '1 Gbps',    price: 31.33, hasPhone: true,  note: 'Οπτική ίνα FTTH. Με συμβόλαιο κινητής Vodafone 29,90€/μήνα. ΦΠΑ 24% μέσα. Η σελίδα γράφει ότι οι προσφορές ισχύουν για νέους πελάτες με 24μηνο συμβόλαιο και ότι για αιτήσεις από 01/05/26 η τιμή προσφοράς ισχύει τους 12 πρώτους μήνες, με αναπροσαρμογή του παγίου έως 3€ από τον 13ο.', networkType: 'Fiber', contract: '24 μήνες' },
    // ── Triple Play (+ Vodafone TV) ───────────────────────────────────────
    // ΤΑ ΔΥΟ ΠΡΩΤΑ ΕΙΝΑΙ ΟΣΑ ΔΕΙΧΝΕΙ ΣΗΜΕΡΑ Η ΣΕΛΙΔΑ vodafone.gr/tv, δίπλα στο
    // σκέτο Vodafone TV Start. Γράφονται με την τιμή εκκίνησης που δηλώνει η
    // ίδια η σελίδα («Από») και με το τέλος ενεργοποίησης στη σημείωση: είναι
    // εφάπαξ, δεν μπαίνει στο μηνιαίο.
    //
    // Η ΑΝΑΓΝΩΣΗ ΤΟΥΣ ΔΕΝ ΕΧΕΙ ΗΜΕΡΟΜΗΝΙΑ (έλεγχος 12/10/2026). Το «σήμερα» του
    // σχολίου δεν λέει ποια μέρα και ούτε ο χάρτης αγοράς της 05/10 ούτε της
    // 12/10/2026 έχει αυτά τα δύο ποσά. Χωρίς λέξη στη σημείωση η γραμμή τους
    // φαινόταν να την καλύπτει η ημερομηνία της Vodafone (04/10/2026), που είναι
    // μόνο της σελίδας fiber-to-the-home. Η σημείωση το λέει και το
    // `planCaveat` βάζει ένδειξη.
    { id:'v_f100_tv',  name: 'Fiber 100 με Vodafone TV',     speed: '100 Mbps', price: 33.90, hasPhone: true, hasTV: true, note: 'Τιμή εκκίνησης. Εγγυημένη ταχύτητα 93 Mbps, απεριόριστα σταθερά και 360 λεπτά κινητά. HBO Max και Viaplay. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα τηλεόρασης της Vodafone, χωρίς ημερομηνία ανάγνωσης.', networkType: 'Fiber' },
    { id:'v_ff300p_tv', name: 'Full Fiber 300 Plus με Vodafone TV Plus', speed: '300 Mbps', price: 37.00, hasPhone: true, hasTV: true, note: 'Τιμή εκκίνησης. Εγγυημένη ταχύτητα 100%, router Wi-Fi 6, απεριόριστα σταθερά και κινητά. HBO Max, Disney+ και Viaplay. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα τηλεόρασης της Vodafone, χωρίς ημερομηνία ανάγνωσης.', networkType: 'Fiber' },
    // ΟΙ ΤΡΕΙΣ ΠΑΛΙΕΣ ΓΡΑΜΜΕΣ ΕΓΡΑΦΑΝ 44 · 51 · 58€ ΧΩΡΙΣ ΠΗΓΗ. Η σελίδα
    // προγραμμάτων της Vodafone (ανάγνωση 05/10/2026) δείχνει Full Fiber 300 Plus
    // με Vodafone TV 32,00€ και Full Fiber 500 Plus με Vodafone TV Plus 46,40€. Το
    // 1 Gbps με τηλεόραση δεν εμφανίζεται εκεί και το λέει η σημείωσή του.
    { id:'v_f100_tvs', name: 'Fiber 100 με Vodafone TV Start', speed: '100 Mbps', price: 29.90, hasPhone: true, hasTV: true, note: 'Εγγυημένη ταχύτητα 93 Mbps + Vodafone TV Start. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα προγραμμάτων της Vodafone, ανάγνωση 05/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'v_ff300_tv', name: 'Full Fiber 300 Plus με Vodafone TV', speed: '300 Mbps', price: 32.00, hasPhone: true, hasTV: true, note: 'FTTH + Vodafone TV χωρίς αποκωδικοποιητή· αποκωδικοποιητής προαιρετικά +3,00€ τον μήνα. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα προγραμμάτων της Vodafone, ανάγνωση 05/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'v_ff500_tv', name: 'Full Fiber 500 Plus με Vodafone TV Plus', speed: '500 Mbps', price: 46.40, hasPhone: true, hasTV: true, note: 'FTTH + Vodafone TV Plus. Τέλος ενεργοποίησης 6,00€ εφάπαξ. Από τη σελίδα προγραμμάτων της Vodafone, ανάγνωση 05/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'v_ff1g_tv',  name: 'Full Fiber 1 Gbps + TV',       speed: '1 Gbps',   price: 58.00, hasPhone: true, hasTV: true, note: 'FTTH + Vodafone TV + αποκωδικοποιητής +2,50€. Τιμή μη επαληθευμένη στον έλεγχο της 05/10/2026.', networkType: 'Fiber', contract: '24 μήνες' },
  ],
  dei: [
    // ΤΟ «ΦΘΗΝΟΤΕΡΟ FIBER ΣΤΗΝ ΑΓΟΡΑ» ΔΕΝ ΕΙΧΕ ΠΗΓΗ (12/10/2026). Ο χάρτης αγοράς
    // της 12/10/2026 γράφει τις τιμές της ΔΕΗ μη επαληθευμένες και ο πάροχος
    // δεν έχει ημερομηνία ελέγχου στο lib/facts/prices. Ούτε ο ίδιος ο πίνακας
    // το στηρίζει: το φοιτητικό 300 της Inalan (i_300_st) είναι φθηνότερο. Η
    // σημείωση γράφει μόνο τι είναι η γραμμή, όπως του dei_f1g.
    { id:'dei_f500',   name: 'ΔΕΗ Fiber 500',              speed: '500 Mbps',  price: 17.90, hasPhone: false, note: 'Οπτική ίνα. Χωρίς τηλεφωνία.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'dei_f1g',    name: 'ΔΕΗ Fiber 1 Gbps',           speed: '1 Gbps',    price: 24.90, hasPhone: false, note: 'Οπτική ίνα. Χωρίς τηλεφωνία.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'dei_f25g',   name: 'ΔΕΗ Fiber 2.5 Gbps',         speed: '2.5 Gbps',  price: 52.90, hasPhone: false, note: 'Ultra broadband. Χωρίς τηλεφωνία.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'dei_f500_v', name: 'ΔΕΗ Fiber 500 + Φωνή',       speed: '500 Mbps',  price: 21.90, hasPhone: true,  note: 'Fiber + τηλεφωνία (+4€). Απεριόριστα λεπτά σταθερά.', networkType: 'Fiber', contract: '24 μήνες' },
  ],
  inalan: [
    // ═══ ΑΠΟ ΤΗ ΣΕΛΙΔΑ ΤΗΣ INALAN (12/10/2026) ══════════════════════════════
    // Πηγή: https://www.inalan.gr/internet/, ανάγνωση 12/10/2026 (χάρτης
    // αγοράς της ομάδας). ΤΡΙΑ ΠΟΣΑ ΔΕΝ ΣΥΜΦΩΝΟΥΣΑΝ ΜΕ ΤΗ ΣΕΛΙΔΑ. Το 1 Gbps με
    // τηλεφωνία έγραφε 38€ και η σελίδα γράφει 34€. Τα δύο αδέσμευτα έγραφαν
    // 22,90 και 27,90€ ενώ η σελίδα τα έχει ως «Fiber Prepaid 300» και «Fiber
    // Prepaid 1G», χωρίς δέσμευση, στα 28 και 34€ τον μήνα. Τα `id` μένουν
    // (αποθηκεύονται)· το «Δωρεάν εξοπλισμός και εγκατάσταση» των παλιών
    // αδέσμευτων δεν το επιβεβαιώνει η ανάγνωση και δεν μεταφέρεται. Τα δύο
    // σκέτα 24μηνα, χωρίς τηλεφωνία, δεν εμφανίζονται στη σελίδα και το λέει η
    // σημείωσή τους. Η «Επετειακή» των 12€ ίσχυε έως 10/10/2026 και το «Πρώτος
    // στο κτίριο −50%» έχει όρους ανά κτίριο: κανένα δεν μπαίνει ως πρόγραμμα.
    // ── Οικιακά (με σύμβαση 24 μηνών) ────────────────────────────────────
    { id:'i_300_24',   name: 'Fiber 300 (24 μήνες)',        speed: '300/300 Mbps συμμετρικό', price: 28.00, hasPhone: false, note: 'Χωρίς τηλεφωνία. Δωρεάν εξοπλισμός. Η σελίδα της Inalan δεν δείχνει αυτό το πρόγραμμα (12/10/2026): τιμή μη επαληθευμένη.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'i_300_ph',   name: 'Fiber 300 + Τηλεφωνία',      speed: '300/300 Mbps + τηλεφωνία', price: 28.00, hasPhone: true,  note: 'Απεριόριστα λεπτά εντός Ευρωπαϊκής Ένωσης.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'i_1g_24',    name: 'Fiber 1 Gbps (24 μήνες)',     speed: '1 Gbps/1 Gbps συμμετρικό', price: 38.00, hasPhone: false, note: 'Οπτική ίνα ως το σπίτι (FTTH). Δωρεάν εξοπλισμός. Η σελίδα της Inalan δεν δείχνει αυτό το πρόγραμμα (12/10/2026): τιμή μη επαληθευμένη.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'i_1g_ph',    name: 'Fiber 1 Gbps + Τηλεφωνία',   speed: '1 Gbps + τηλεφωνία', price: 34.00, hasPhone: true, note: 'Απεριόριστα λεπτά + 300 λεπτά σε ΕΕ/ΗΠΑ/Καναδά.', networkType: 'Fiber', contract: '24 μήνες' },
    // ── Αδέσμευτα, προπληρωμένα ──────────────────────────────────────────
    { id:'i_300_free', name: 'Fiber Prepaid 300',           speed: '300/300 Mbps', price: 28.00, hasPhone: false, note: 'Προπληρωμένο, χωρίς δέσμευση.', networkType: 'Fiber' },
    { id:'i_1g_free',  name: 'Fiber Prepaid 1G',            speed: '1 Gbps/1 Gbps', price: 34.00, hasPhone: false, note: 'Προπληρωμένο, χωρίς δέσμευση.', networkType: 'Fiber' },
    // ── Φοιτητικά ────────────────────────────────────────────────────────
    { id:'i_300_st',   name: 'Φοιτητικό 300 Mbps',         speed: '300/300 Mbps συμμετρικό', price: 14.00, hasPhone: false, note: 'Φοιτητικό, χωρίς δέσμευση. Απαιτείται φοιτητική ταυτότητα ή ΑΜΚΑ. Δωρεάν εγκατάσταση.', networkType: 'Fiber', student: true },
    { id:'i_1g_st',    name: 'Φοιτητικό 1 Gbps',           speed: '1 Gbps/1 Gbps συμμετρικό', price: 28.00, hasPhone: false, note: 'Φοιτητικό, χωρίς δέσμευση. Απαιτείται φοιτητική ταυτότητα ή ΑΜΚΑ.', networkType: 'Fiber', student: true },
  ],
  hol: [
    { id:'h_100',      name: 'HOL Fiber 100',               speed: '100/50 Mbps', price: 19.90, hasPhone: true, note: 'Δέσμευση 24 μηνών.', networkType: 'Fiber', contract: '24 μήνες' },
    { id:'h_500',      name: 'HOL Fiber 500',               speed: '500/200 Mbps',price: 24.90, hasPhone: true, note: 'Δέσμευση 24 μηνών.', networkType: 'Fiber', contract: '24 μήνες' },
  ],

};

/**
 * Η ΕΝΔΕΙΞΗ ΚΑΤΩ ΑΠΟ ΤΟ ΟΝΟΜΑ, ΑΠΟ ΤΗ ΣΗΜΕΙΩΣΗ ΤΗΣ ΓΡΑΜΜΗΣ.
 *
 * ΤΕΣΣΕΡΙΣ ΦΡΑΣΕΙΣ, ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ (12/10/2026). Οι σημειώσεις λένε ότι μια
 * γραμμή δεν καλύπτεται από τον έλεγχο του παρόχου με τέσσερις τρόπους: «μη
 * επαληθευμένη» (π.χ. c_5g50, v_24, i_300_24)· «διάθεση … δεν επιβεβαιώθηκε»
 * μέσα στην ίδια πρόταση (c_f100_tv, c_f300_tv)· «χωρίς ημερομηνία
 * ανάγνωσης» (v_f100_tv, v_ff300p_tv)· «ανάγνωση ηη/μμ/εεεε» με ημερομηνία
 * άλλη από του παρόχου (c_sat25, c_sat50, v_f100). Οτιδήποτε άλλο δεν
 * σημαδεύεται, οπότε νέα επιφύλαξη σε σημείωση γράφεται με μία από τις
 * τέσσερις φράσεις· αλλιώς δεν παίρνει ένδειξη.
 *
 * ΚΑΙ Η ΕΝΔΕΙΞΗ ΖΕΙ ΣΤΟΝ ΠΙΝΑΚΑ, ΟΧΙ ΜΟΝΟ ΣΤΗ ΣΗΜΕΙΩΣΗ. Η σημείωση φαίνεται
 * μόνο αφού διαλέξεις το πρόγραμμα· η επιλογή όμως γράφει πάνω στο
 * αποθηκευμένο πρόγραμμα και ποσό. Για να μάθει κανείς ποια δεν ελέγχθηκαν
 * έπρεπε να αλλάξει το δικό του.
 */
const PLAN_UNVERIFIED  = /μη επαληθευμένη/;
const PLAN_NOT_OFFERED = /διάθεση[^.]*δεν επιβεβαιώθηκε/;
const PLAN_UNDATED     = /χωρίς ημερομηνία ανάγνωσης/;
const PLAN_READ_ON     = /ανάγνωση (\d{2}\/\d{2}\/\d{4})/;
export function planCaveat(note: string, providerDate: string): string | null {
  if (PLAN_UNVERIFIED.test(note))  return 'τιμή μη επαληθευμένη';
  if (PLAN_NOT_OFFERED.test(note)) return 'διάθεση μη επιβεβαιωμένη';
  if (PLAN_UNDATED.test(note))     return 'χωρίς ημερομηνία ελέγχου';
  const readOn = PLAN_READ_ON.exec(note)?.[1];
  return readOn && readOn !== providerDate ? `ανάγνωση ${readOn}` : null;
}

/**
 * ΠΟΣΑ ΠΡΟΓΡΑΜΜΑΤΑ ΚΑΛΥΠΤΕΙ Η ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ ΠΑΡΟΧΟΥ, ΜΕΤΡΗΜΕΝΑ ΑΝΑ ΠΑΡΟΧΟ.
 *
 * Η πρόταση κάτω από τη γραμμή «Τελευταία ενημέρωση» λέει πόσα από τα
 * προγράμματα του παρόχου καλύπτει η ημερομηνία του: όσα δεν έχουν ένδειξη.
 * Το πλήθος βγαίνει από τις σημειώσεις, όχι από κείμενο. Της Vodafone, για
 * παράδειγμα, η ημερομηνία είναι μόνο της σελίδας fiber-to-the-home και
 * καλύπτει μόνο τα τρία Full Fiber Plus χωρίς τηλεόραση. `null` όταν τα
 * καλύπτει όλα.
 */
export function planDateScope(plans: readonly { note: string }[], providerDate: string): string | null {
  const total = plans.length;
  const covered = plans.filter(p => !planCaveat(p.note, providerDate)).length;
  const why = 'η ένδειξη γράφει αν δεν επιβεβαιώθηκαν, πότε διαβάστηκαν ή ότι δεν έχουν ημερομηνία ελέγχου.';
  if (covered === total) return null;
  if (covered === 0) return `Η ημερομηνία αυτή δεν καλύπτει κανένα από τα ${total} προγράμματα· ${why}`;
  if (covered === 1) return `Η ημερομηνία αυτή καλύπτει μόνο ένα από τα ${total} προγράμματα, αυτό χωρίς ένδειξη κάτω από το όνομα· ${why}`;
  return `Η ημερομηνία αυτή καλύπτει μόνο τα ${covered} από τα ${total} προγράμματα, όσα δεν έχουν ένδειξη κάτω από το όνομα· ${why}`;
}

/**
 * ΤΑ ΠΡΟΓΡΑΜΜΑΤΑ ΤΟΥ ΠΑΡΟΧΟΥ ΑΠΟ ΤΟ ΦΘΗΝΟΤΕΡΟ, ΣΕ ΑΝΤΙΓΡΑΦΟ.
 *
 * ΤΟ `.sort()` ΑΛΛΑΖΕ ΤΗ ΣΤΑΘΕΡΑ ΤΗΣ ΕΝΟΤΗΤΑΣ ΜΕΣΑ ΣΤΗΝ ΑΠΟΔΟΣΗ (12/10/2026).
 * Το `planOptions` ταξινομούσε τον ίδιο τον πίνακα του `INTERNET_PLANS`, με τη
 * σειρά της δήλωσης χαμένη από την πρώτη απόδοση και για όποιον άλλο τον
 * διάβαζε. Ο πίνακας της οθόνης έβγαινε σε σειρά τιμής μόνο επειδή η
 * ταξινόμηση έτρεχε πρώτη. Τώρα η λίστα και ο πίνακας διαβάζουν από εδώ: ίδια
 * σειρά με πριν, χωρίς να αγγίζεται η σταθερά.
 */
export const plansByPrice = (provider: string) =>
  [...(INTERNET_PLANS[provider] || [])].sort((a, b) => a.price - b.price);

const WATER_PROVIDERS = [
  { value: 'eydap', label: 'ΕΥΔΑΠ (Αττική)',         url: 'https://www.eydap.gr',  color: '#06b6d4' },
  { value: 'eyath', label: 'ΕΥΑΘ (Θεσσαλονίκη)',     url: 'https://www.eyath.gr',  color: '#0ea5e9' },
  { value: 'local', label: 'Τοπική ΔΕΥΑ',             url: '',                       color: '#38bdf8' },
];

const SECURITY_COMPANIES = [
  { value: 'eltrak',    label: 'Eltrak',    url: 'https://www.eltrak.gr',        color: '#dc2626' },
  { value: 'g4s',       label: 'G4S',       url: 'https://www.g4s.com/gr-gr',    color: '#166534' },
  { value: 'vaninfo',   label: 'Vaninfo',   url: 'https://www.vaninfo.gr',       color: '#1d4ed8' },
  { value: 'dsp',       label: 'DSP',       url: 'https://www.dsp.gr',           color: '#0f172a' },
  { value: 'securitas', label: 'Securitas', url: 'https://www.securitas.com/gr', color: '#b91c1c' },
  { value: 'other',     label: 'Άλλη',      url: '',                              color: '#64748b' },
];

// ΟΙ ΜΕΣΟΙ ΟΡΟΙ ΔΕΝ ΕΧΟΥΝ ΔΗΜΟΣΙΕΥΜΕΝΗ ΠΗΓΗ ΚΑΙ ΤΟ ΛΕΝΕ. Έγραφαν «Μέσος Όρος
// Ελλάδας» σαν στατιστική υπηρεσίας· είναι εκτίμηση της εφαρμογής, χωρίς
// ημερομηνία ελέγχου στον κατάλογο τιμών (lib/facts/prices). Η λέξη «εκτίμηση»
// μένει μέχρι να μπει πηγή με ημερομηνία.
const BENCHMARKS = {
  internet: { avg: 22.50, label: 'Μέσος όρος Ελλάδας, εκτίμηση'              },
  water:    { avg: 12.00, label: 'Μέσος όρος Αττικής, ~24€ / 2 μήνες, εκτίμηση' },
  heating:  { avg: 70.00, label: 'Μέσος όρος χειμώνα, εκτίμηση'               },
  security: { avg: 18.00, label: 'Μέσος όρος αγοράς, εκτίμηση'                },
};

const DEFAULTS = {
  internetProvider: 'cosmote', internetPlanId: '', internetPlan: '',
  internetSpeed: '', internetPrice: '', internetPhone: false,
  internetContractEnd: '', internetSpeedReal: '',
  phoneLocal: true, phoneMobile: false, phoneIntl: false, phoneVoip: false, phoneNotes: '',
  // FIX: "Συνδρομητική τηλεόραση" label
  hasTV: false, tvProvider: 'cosmote', tvPlanId: '', tvPlan: '', tvPrice: '',
  waterProvider: 'eydap', waterBiMonthly: '', waterMonthly: '', waterPersons: '2', waterPeriodMonths: '2',
  heatingMonthly: '',
  heatingLitersPerYear: '', heatingOilPricePerLiter: '1.20',
  heatingKgPellet: '', heatingPelletPrice: '0.38',
  heatingCentralShare: '',
  securityCompany: 'other', securityPlan: '', securityMonthly: '',
  securityHasRemote: false, securityHasCamera: false, securityHasDoor: false,
  dimotika: '4.8', dimotikaCalcCons: '', dimotikaCalcAmount: '',
};

/**
 * ΜΙΑ ΚΑΡΤΑ, ΜΙΑ ΕΝΟΤΗΤΑ. Το πάνελ κρατούσε πέντε άσχετα θέματα μαζί (internet,
 * τηλεόραση, νερό, θέρμανση, συναγερμό) και άνοιγε ολόκληρο όποια κάρτα κι αν
 * πατούσες. Το `only` λέει ποιο θέμα ζήτησε ο χρήστης· τα υπόλοιπα δεν
 * αποδίδονται καθόλου.
 */
export type ProviderScope = 'internet' | 'water' | 'heating' | 'security';

interface Props { propertyId: string; userId?: string; only?: ProviderScope; }

export default function BillsProviders({ propertyId, userId = '', only }: Props) {
  const show = (k: ProviderScope) => !only || only === k;
  const [s, upd, loading] = useBillsSettings(propertyId, userId, 'providers', DEFAULTS);
  // Ο τύπος θέρμανσης είναι ιδιότητα του κτιρίου, όχι ρύθμιση αυτής της καρτέλας.
  const [heatingType, setHeatingType] = usePropertyHeating(propertyId, userId);

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 20, marginBottom: 16 };
  // ΤΡΕΙΣ ΡΥΘΜΙΣΕΙΣ ΠΛΕΓΜΑΤΟΣ ΣΤΟΝ ΙΔΙΟ ΚΑΤΑΛΟΓΟ ΕΔΙΝΑΝ ΤΡΕΙΣ ΔΕΞΙΕΣ ΑΚΡΕΣ.
  // Το Internet σταματούσε στα 1.290, το Νερό στα 890, η Θέρμανση στα 590 — και
  // καμία από τις τρεις δεν έφτανε στην άκρη της κάρτας. Το μάτι δεν διαβάζει
  // «τρεις ενότητες», διαβάζει σκάλα. Τώρα κάθε σειρά πιάνει ΟΛΟ το πλάτος και
  // μοιράζεται ίσα: μία αριστερή άκρη, μία δεξιά, όσες στήλες χρειάζεται η κάθε
  // ενότητα. Το ελάχιστο κρατά τα στενά πεδία αναγνώσιμα.
  const g2 = fieldRow(200, 14, { marginBottom: 14 });
  const g3 = fieldRow(190, 14, { marginBottom: 14 });

  const internetCost = parseFloat(s.internetPrice) || 0;
  const waterM       = waterMonthly(s);
  const heatingM     = (() => {
    if (heatingType === 'autonomous_oil' && s.heatingLitersPerYear)
      return (parseFloat(s.heatingLitersPerYear) * parseFloat(s.heatingOilPricePerLiter)) / 12;
    if (heatingType === 'pellet' && s.heatingKgPellet)
      return (parseFloat(s.heatingKgPellet) * parseFloat(s.heatingPelletPrice)) / 12;
    return parseFloat(s.heatingMonthly) || 0;
  })();
  const securityM = parseFloat(s.securityMonthly) || 0;

  const provData     = INTERNET_PROVIDERS.find(p => p.value === s.internetProvider);
  // ΣΚΕΤΟ ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΑΚΕΤΟΥ. Η τιμή γραφόταν και εδώ και στο διπλανό πεδίο
  // «Μηνιαίο κόστος», που ΑΥΤΟ το ίδιο κλικ συμπληρώνει: δύο φορές το ίδιο ποσό,
  // σε απόσταση δέκα εικονοστοιχείων.
  const tvPackOptions = (TV_PACKS[s.tvProvider] || []).map(p => ({ value: p.id, label: p.name }));
  const plans        = plansByPrice(s.internetProvider);
  const planOptions  = plans.map(p => ({
    value: p.id,
    label: [
      p.name,
      p.speed,
      p.price > 0 ? `${fe(p.price)}/μήνα` : '',
      p.student ? '(Φοιτητικό)' : '',
      p.backup ? '(Backup 5G)' : '',
      p.hasTV ? '+ TV' : '',
    ].filter(Boolean).join(', ')
  }));
  const selectedPlan = plans.find(p => p.id === s.internetPlanId);
  const planAsOf          = telecomAsOf(s.internetProvider, provData?.label);
  const planAsOfDate      = asOfDate(planAsOf.checkedAt);
  const planScope         = planDateScope(plans, planAsOfDate);
  const secData      = SECURITY_COMPANIES.find(c => c.value === s.securityCompany);
  const waterData    = WATER_PROVIDERS.find(p => p.value === s.waterProvider);

  // ── ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΕΔΙΟΥ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ ΚΑΙ ΕΛΕΓΧΕΤΑΙ ──────────────────
  // Οι διακόπτες του σταθερού τηλεφώνου ενημερώνονταν με υπολογισμένο κλειδί,
  // `upd({ [f.key]: !f.val })`. Εκεί ο TypeScript βλέπει σκέτο `string`, άρα το
  // αντικείμενο δεν ταιριάζει στο `Partial` των ρυθμίσεων — και το `as any` το
  // σιώπησε. Τίμημα: ένα ορθογραφικό λάθος στο κλειδί («phoneVoIP» αντί
  // «phoneVoip») θα έγραφε ΝΕΟ πεδίο στο jsonb της βάσης, ο διακόπτης δεν θα
  // άναβε ποτέ και κανένα σφάλμα δεν θα εμφανιζόταν. Τώρα κάθε γραμμή κρατά τη
  // δική της ενημέρωση με ρητό όνομα πεδίου, οπότε το λάθος σκάει στη μεταγλώττιση.
  //
  // Το `tip` υπάρχει μόνο σε μία γραμμή· δηλώνεται προαιρετικό στον τύπο, αντί
  // να διαβάζεται με `(f as any).tip`.
  const phoneFeatures: { key: string; label: string; val: boolean; toggle: () => void; tip?: string }[] = [
    { key: 'phoneLocal',  label: 'Απεριόριστες κλήσεις εντός', val: s.phoneLocal,  toggle: () => upd({ phoneLocal:  !s.phoneLocal  }) },
    { key: 'phoneMobile', label: 'Κλήσεις σε κινητά',          val: s.phoneMobile, toggle: () => upd({ phoneMobile: !s.phoneMobile }) },
    { key: 'phoneIntl',   label: 'Διεθνείς κλήσεις',           val: s.phoneIntl,   toggle: () => upd({ phoneIntl:   !s.phoneIntl   }) },
    { key: 'phoneVoip',   label: 'VoIP / App',                 val: s.phoneVoip,   toggle: () => upd({ phoneVoip:   !s.phoneVoip   }), tip: 'Κλήσεις μέσω διαδικτύου ή εφαρμογής (VoIP), π.χ. Viber, WhatsApp, Skype' },
  ];

  const secHdr = (label: string, link?: { url: string; text: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: T.font.sans, flex: 1 }}>{label}</span>
      {link?.url && (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="tap-link"
          style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontFamily: T.font.sans, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.pill, padding: '3px 10px', whiteSpace: 'nowrap' as const }}>
          {link.text}
        </a>
      )}
    </div>
  );

  const benchmarkBar = (current: number, avg: number, label: string) => {
    if (!current || !avg) return null;
    const pct   = Math.min((current / (avg * 2)) * 100, 100);
    const isHigh = current > avg * 1.15;
    const isLow  = current < avg * 0.85;
    return (
      <div style={{ marginTop: 10, background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans }}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontWeight: 700, fontFamily: T.font.mono, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {isHigh ? `+${fp(((current / avg - 1) * 100))} πάνω από τον μέσο όρο` : isLow ? `-${fp(((1 - current / avg) * 100))} κάτω από τον μέσο όρο` : 'Στο μέσο όρο'}
          </span>
        </div>
        <div style={{ position: 'relative', height: 6, background: 'var(--bg-overlay)', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: -3, width: 2, height: 12, background: 'var(--text-tertiary)', borderRadius: 3 }}/>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--series-in)', borderRadius: 3 }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
          {/* ΤΡΙΑ ΠΟΣΑ ΣΤΗΝ ΙΔΙΑ ΓΡΑΜΜΗ, ΜΕ ΤΡΕΙΣ ΓΡΑΦΕΣ. Τα δύο άκρα περνούσαν από
              μορφοποιητή («0€», «45,00€») και ο μέσος όρος γραφόταν ωμός: το
              22,50 έβγαινε με αγγλική υποδιαστολή, ένα δεκαδικό και κενό πριν
              το σύμβολο, ανάμεσα σε δύο σωστά. */}
          <span>{fe(0)}</span><span style={{ color: 'var(--text-secondary)' }}>μέσος όρος {fe(avg)}</span><span>{fe((avg * 2))}</span>
        </div>
      </div>
    );
  };

  if (loading) return <Spinner label="Φόρτωση…" />;

  return (
    <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>

      {/* ΤΕΣΣΕΡΑ ΤΜΗΜΑΤΑ ΕΦΥΓΑΝ ΑΠΟ ΑΥΤΗ ΤΗΝ ΟΘΟΝΗ.

          Η σειρά τεσσάρων μεγάλων αριθμών στην κορυφή («Internet & TV», «Νερό
          και Θέρμανση», «Security», «Σύνολο παρόχων») έλεγε αθροίσματα
          κατηγοριών που ο χρήστης δεν άνοιξε: μπαίνεις για το νερό και το πρώτο
          που διαβάζεις είναι πόσο πληρώνεις internet. Με μία κατηγορία ανά
          πάνελ, το άθροισμα κατηγοριών το λέει ήδη η ίδια η σειρά καρτών.

          Η «Σύνοψη Παρόχων» στο τέλος επαναλάμβανε τα ίδια πέντε νούμερα μια
          τρίτη φορά, μετά τα πλακίδια και μετά τις ενότητες.

          Η κάρτα «Το φυσικό αέριο έχει τη δική του καρτέλα» ήταν διαφήμιση
          άλλης οθόνης μέσα σε αυτήν, τη στιγμή που η καρτέλα του αερίου στέκει
          δίπλα, στην ίδια σειρά καρτών.

          Ο «Υπολογισμός Ποσοστού» δημοτικών τελών ήταν ΔΕΥΤΕΡΟ αντίγραφο: η
          πραγματική δουλειά (δωδεκάμηνο ιστορικό, μέσος όρος, ποσοστό από τον
          τελευταίο λογαριασμό) ζει στους «Φόρους και υπηρεσίες». Και έγραφε σε
          πεδίο που δεν διάβαζε κανείς — ούτε ο προϋπολογισμός, ούτε η ίδια η
          οθόνη των τελών, που έψαχνε το ποσοστό σε άλλο σημείο των ρυθμίσεων. */}

      {show('internet') && (<>
        {/* ── Internet & Σταθερό Τηλέφωνο ──────────────────────────────────── */}
        <div style={card}>
          {secHdr('Internet και σταθερό τηλέφωνο', { url: 'https://www.eett.gr/opencms/opencms/EETT/Electronic_Communications/Market360/', text: 'ΕΕΤΤ 360° Σύγκριση' })}
          <div {...g2}>
            <CustomSelect label="Πάροχος" value={s.internetProvider}
              onChange={v => upd({ internetProvider: v, internetPlanId: '', internetPrice: '', internetSpeed: '' })}
              options={INTERNET_PROVIDERS.map(p => ({ value: p.value, label: p.label }))}/>
            {/* ΤΟ «(ΕΠΙΣΗΜΕΣ ΤΙΜΕΣ)» ΔΕΝ ΙΣΧΥΕ ΓΙΑ ΚΑΘΕ ΕΠΙΛΟΓΗ (12/10/2026). Ο
                τίτλος το έλεγε για όλο τον κατάλογο, μαζί με γραμμές που η
                σημείωσή τους γράφει «Τιμή μη επαληθευμένη». Τι ελέγχθηκε και
                πότε το λένε ο πίνακας και η γραμμή κάτω από αυτόν· ο τίτλος
                λέει μόνο τι διαλέγεις. */}
            {planOptions.length > 0 ? (
              <CustomSelect label="Πρόγραμμα" value={s.internetPlanId}
                onChange={v => {
                  const plan = plans.find(p => p.id === v);
                  upd({ internetPlanId: v, internetPlan: plan?.name || '', internetSpeed: plan?.speed || '', internetPrice: plan ? String(plan.price) : '', internetPhone: plan ? (plan.hasPhone ?? s.internetPhone) : false });
                }}
                options={[{ value: '', label: 'Διάλεξε πρόγραμμα' }, ...planOptions]}/>
            ) : (
              <TextInput label="Ονομασία προγράμματος" value={s.internetPlan} onChange={v => upd({ internetPlan: v })} placeholder="Fiber 500"/>
            )}
            <NumberInput label="Μηνιαίο κόστος"  value={s.internetPrice} onChange={v => upd({ internetPrice: v })} suffix="€"/>
          </div>

          {selectedPlan && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '11px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-default)', flexShrink: 0 }}/>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{selectedPlan.note} · {selectedPlan.hasPhone === null ? 'Σταθερό τηλέφωνο: δεν επιβεβαιώθηκε' : selectedPlan.hasPhone ? 'Περιλαμβάνει σταθερό τηλέφωνο' : 'Χωρίς σταθερό τηλέφωνο'}</span>
              {provData?.url && (
                <a href={provData.url} target="_blank" rel="noopener noreferrer" className="tap-link"
                  style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontFamily: T.font.sans, whiteSpace: 'nowrap' as const }}>
                  Επίσημη σελίδα {provData.label}
                </a>
              )}
            </div>
          )}

          {/* ΔΥΟ ΣΕΙΡΕΣ ΤΩΝ ΤΡΙΩΝ, ΧΩΡΙΣΜΕΝΕΣ ΜΕ ΝΟΗΜΑ. Πάνω: ποιος, τι, πόσο.
              Κάτω: η ταχύτητα που ΥΠΟΣΧΕΤΑΙ το συμβόλαιο, ακριβώς δίπλα σε αυτήν
              που ΠΑΙΡΝΕΙΣ και μέχρι πότε δεσμεύεσαι. Η σύγκριση των δύο
              ταχυτήτων είναι όλο το νόημα του πεδίου — και ήταν σε άλλη σειρά
              από το νούμερο με το οποίο συγκρίνεται. */}
          <div {...g3}>
            <TextInput   label="Ταχύτητα συμβολαίου" value={s.internetSpeed} onChange={v => upd({ internetSpeed: v })} placeholder="500 Mbps"/>
            <NumberInput label="Πραγματική ταχύτητα λήψης" value={s.internetSpeedReal || ''}  onChange={v => upd({ internetSpeedReal: v })} suffix="Mbps"/>
            <DatePicker  label="Λήξη συμβολαίου"                      value={s.internetContractEnd || ''} onChange={v => upd({ internetContractEnd: v })}/>
          </div>
          <div style={{ marginBottom: 14 }}>
              {s.internetSpeedReal && s.internetSpeed && (() => {
                const pct = parseFloat(s.internetSpeed) > 0 ? Math.round((parseFloat(s.internetSpeedReal) / parseFloat(s.internetSpeed)) * 100) : 0;
                const good = pct >= 80;
                return (
                  <div style={{ background: good ? 'color-mix(in srgb, var(--positive) 7%, transparent)' : 'color-mix(in srgb, var(--warning) 7%, transparent)', border: `1px solid ${good ? 'color-mix(in srgb, var(--positive) 25%, transparent)' : 'color-mix(in srgb, var(--warning) 25%, transparent)'}`, borderRadius: T.radius.inner, padding: '10px 14px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: good ? 'var(--positive)' : 'var(--warning)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: T.font.sans }}>{good ? 'Καλή απόδοση' : 'Μειωμένη ταχύτητα'}</div>
                  </div>
                );
              })()}
              {(!s.internetSpeedReal || !s.internetSpeed) && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                  Μέτρησε στο{' '}<a href="https://www.speedtest.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>speedtest.net</a>
                </div>
              )}
          </div>

          {/* Ειδοποίηση ανανέωσης συμβολαίου */}
          {s.internetContractEnd && (() => {
            const days = daysUntil(s.internetContractEnd) ?? 0;
            if (days > 90 || days < 0) return null;
            return (
              <div style={{ background: days <= 14 ? 'color-mix(in srgb, var(--negative) 7%, transparent)' : 'color-mix(in srgb, var(--warning) 7%, transparent)', border: `1px solid ${days <= 14 ? 'color-mix(in srgb, var(--negative) 25%, transparent)' : 'color-mix(in srgb, var(--warning) 25%, transparent)'}`, borderRadius: T.radius.inner, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontFamily: T.font.sans }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: days <= 14 ? 'var(--negative)' : 'var(--warning)', flexShrink: 0 }}/>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Λήξη συμβολαίου Internet σε{' '}
                  <strong style={{ color: days <= 14 ? 'var(--negative)' : 'var(--warning)' }}>{days} ημέρες</strong>
                  {'. '}Σύγκρινε στο ΕΕΤΤ 360° για καλύτερη τιμή.
                </span>
              </div>
            );
          })()}

          <div style={{ marginBottom: 12 }}>
            <Toggle on={s.internetPhone} onChange={v => upd({ internetPhone: v })} label="Σταθερό τηλέφωνο"/>
          </div>

          {s.internetPhone && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: 14, marginBottom: 12, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10, fontFamily: T.font.sans }}>Τι περιλαμβάνει το σταθερό τηλέφωνο</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                {phoneFeatures.map(f => (
                  <div key={f.key} {...pressable(f.toggle)} title={f.tip}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: f.val ? 'var(--accent-soft)' : 'var(--bg-base)', border: `1px solid ${f.val ? 'var(--accent)' : 'var(--border-subtle)'}`, borderRadius: T.radius.btn, padding: '7px 14px', cursor: 'pointer', transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.val ? 'var(--accent)' : 'var(--border-default)', flexShrink: 0 }}/>
                    <span style={{ fontSize: 'var(--fs-xs)', color: f.val ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: f.val ? 600 : 400, fontFamily: T.font.sans }}>{f.label}</span>
                  </div>
                ))}
              </div>
              <TextInput label="Σημειώσεις πακέτου" value={s.phoneNotes} onChange={v => upd({ phoneNotes: v })} placeholder="100 λεπτά διεθνή, αποκλείονται premium…"/>
            </div>
          )}

          {plans.length > 0 && (
            <div>
              {/* ΤΟ «ΔΙΑΘΕΣΙΜΑ» ΔΕΝ ΙΣΧΥΕ ΓΙΑ ΚΑΘΕ ΓΡΑΜΜΗ (12/10/2026). Η σημείωση
                  του c_dp_24 γράφει «Δεν προσφέρεται πλέον σε νέες συνδέσεις»,
                  των c_f100_tv και c_f300_tv «η διάθεση σήμερα δεν
                  επιβεβαιώθηκε» και του i_300_24 «Η σελίδα της Inalan δεν δείχνει
                  αυτό το πρόγραμμα». Ίδιος λόγος με το «(επίσημες τιμές)» του
                  πεδίου πιο πάνω: ο τίτλος λέει τι είναι ο πίνακας. */}
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10, fontFamily: T.font.sans }}>Προγράμματα {provData?.label}</div>
              {/* Η πρώτη στήλη μένει όσο ο πίνακας κυλά: ο λόγος είναι γραμμένος
                  στην `.pin-1` του globals.css. Χωρίς αυτό, μόλις ο χρήστης
                  σύρει για να δει τιμή, το όνομα του προγράμματος φεύγει.

                  ΚΑΙ ΤΟ ΚΕΛΙ ΤΟ ΓΡΑΦΕΙ Η `.po-table`, ΟΧΙ Η ΚΑΘΕ ΓΡΑΜΜΗ. Εξι
                  στήλες με έξι αντίγραφα του ίδιου `padding: 7px 10px`: το ίδιο
                  στυλ, γραμμένο έξι φορές, που αποκλίνει με την πρώτη αλλαγή. */}
              <div className="po-table-box">
               <div className="po-scroll-x">
                <table className="po-table pin-1" style={{ '--tbl-fs': 'var(--fs-xs)', '--tbl-min': '560px', '--row-bg': 'var(--bg-surface)' }}>
                  <thead>
                    <tr>{['Πρόγραμμα','Ταχύτητα','Σταθερό Τηλέφωνο','Δέσμευση','Μηνιαίο','Ετήσιο'].map((h, i) => (
                      <th key={i} scope="col" style={{ background: 'var(--bg-elevated)', whiteSpace: 'nowrap' as const, textAlign: i === 2 ? ('center' as const) : i >= 4 ? ('right' as const) : undefined }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {plans.map(plan => {
                      const isCur = plan.id === s.internetPlanId;
                      const caveat = planCaveat(plan.note, planAsOfDate);
                      return (
                        <tr key={plan.id}
                          onClick={() => upd({ internetPlanId: plan.id, internetPlan: plan.name, internetSpeed: plan.speed, internetPrice: String(plan.price), internetPhone: plan.hasPhone ?? s.internetPhone })}
                          className={isCur ? 'is-on' : undefined}
                          // Το καρφωμένο κελί διαβάζει από εδώ το φόντο της γραμμής του.
                          style={{ cursor: 'pointer', transition: 'background 0.15s',
                            '--row-bg': isCur ? 'var(--accent-soft)' : 'var(--bg-surface)' }}>
                          <td style={{ fontWeight: isCur ? 700 : 400, color: isCur ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {plan.name}{isCur ? ' ✓' : ''}
                            {caveat && <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-tertiary)' }}>{caveat}</span>}
                          </td>
                          <td className="num" style={{ textAlign: 'left' as const }}>{plan.speed}</td>
                          <td style={{ color: plan.hasPhone ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 700, textAlign: 'center' as const }}>{plan.hasPhone === null ? 'Δεν επιβεβαιώθηκε' : plan.hasPhone ? 'Ναι' : 'Όχι'}</td>
                          <td style={{ color: 'var(--text-tertiary)' }}>{plan.contract === null ? 'Δεν επιβεβαιώθηκε' : plan.contract || 'Χωρίς δέσμευση'}</td>
                          <td className="num" style={{ fontWeight: 600, color: isCur ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap' as const }}>{fe(plan.price)}</td>
                          <td className="num" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' as const }}>{fe(plan.price * 12)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
               </div>
              </div>
              {/* ΠΟΤΕ ΚΑΙ ΑΠΟ ΠΟΥ, ΑΝΑ ΠΑΡΟΧΟ (lib/facts/prices). Οι τιμές του πίνακα
                  δεν είχαν ούτε ημερομηνία ούτε πηγή στην οθόνη. Ο πάροχος που δεν
                  έχει ελεγχθεί με ημερομηνία το λέει, δεν δανείζεται άλλου.

                  Η ΓΡΑΜΜΗ ΜΕΝΕΙ ΓΡΑΜΜΑ ΠΡΟΣ ΓΡΑΜΜΑ ΟΠΩΣ ΕΙΝΑΙ (12/10/2026). Την
                  ψάχνει αυτούσια η μετάλλαξη `price-asof` (scripts/lib/mutations.mjs).
                  Αν αλλάξει μόνο εδώ, η μετάλλαξη δεν εφαρμόζεται και το
                  `guards:verify` του CI κοκκινίζει· αλλάζει και στα δύο. */}
              <AsOfNote fact={telecomAsOf(s.internetProvider, provData?.label)} />
              {/* Η ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ ΠΑΡΟΧΟΥ ΔΕΝ ΚΑΛΥΠΤΕΙ ΚΑΘΕ ΓΡΑΜΜΗ (12/10/2026). Η
                  γραμμή από πάνω γράφει «Τελευταία ενημέρωση 12/10/2026» για
                  Telekom, Nova και Inalan, ενώ γραμμές τους γράφουν στη σημείωση
                  «Τιμή μη επαληθευμένη στον έλεγχο της 12/10/2026». Της Vodafone
                  γράφει 04/10/2026, που είναι μόνο της σελίδας fiber-to-the-home:
                  τα τρία Full Fiber Plus χωρίς τηλεόραση. Η επιφύλαξη βγαίνει από
                  τις ίδιες τις σημειώσεις (`planCaveat`), όχι από λίστα παρόχων:
                  όποιος πάροχος αποκτήσει τέτοια γραμμή την παίρνει μόνος του.
                  Χωρίς ημερομηνία ελέγχου δεν μπαίνει, γιατί δεν υπάρχει
                  ημερομηνία να αναιρέσει.

                  ΠΟΣΑ ΚΑΛΥΠΤΕΙ, ΑΝΑ ΠΑΡΟΧΟ. Η πρόταση λέει πόσα από τα
                  προγράμματα του παρόχου καλύπτει η ημερομηνία (`planDateScope`).
                  Για να είναι ακριβές, κάθε γραμμή που δεν διαβάστηκε τη μέρα
                  του παρόχου έχει ένδειξη· οι δύο της σελίδας τηλεόρασης της
                  Vodafone γράφουν «χωρίς ημερομηνία ελέγχου».

                  Η ΓΡΑΜΜΗ ΔΕΝ ΓΡΑΦΕΙ ΗΜΕΡΟΜΗΝΙΑ, ΕΠΙΤΗΔΕΣ. Η ημερομηνία του
                  παρόχου δεν είναι πάντα η μέρα που μια γραμμή δεν επαληθεύτηκε:
                  οι σημειώσεις των v_24, v_50 και v_ff1g_tv χρονολογούν τον δικό
                  τους έλεγχο 05/10/2026. Την ημερομηνία του καθενός τη λέει η
                  ένδειξη ή η σημείωσή του. */}
              {planAsOf.checkedAt && planScope && (
                <p className="po-asof" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '2px 0 0' }}>
                  {planScope}
                </p>
              )}
            </div>
          )}
          {benchmarkBar(internetCost, BENCHMARKS.internet.avg, BENCHMARKS.internet.label)}

          {/* FIX: "Συνδρομητική τηλεόραση" (was "PAY TV") */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-secondary)', fontFamily: T.font.sans, flex: 1 }}>Συνδρομητική τηλεόραση</span>
              <Toggle on={s.hasTV} onChange={v => upd({ hasTV: v })} ariaLabel="Συνδρομητική τηλεόραση"/>
            </div>
            {/* ΤΑ ΑΘΛΗΤΙΚΑ ΕΙΝΑΙ ΙΔΙΟΤΗΤΑ ΤΟΥ ΠΑΚΕΤΟΥ, ΟΧΙ ΞΕΧΩΡΙΣΤΗ ΕΡΩΤΗΣΗ.
                Ο διακόπτης κρεμόταν κάτω από τη σειρά, σαν να είναι άλλο θέμα.
                Είναι η τέταρτη στήλη της ίδιας σειράς — και όταν το πακέτο που
                διάλεξες ΠΕΡΙΕΧΕΙ αθλητικά, ανάβει μόνος του: το ξέρει ήδη ο
                κατάλογος, δεν χρειάζεται να το ξαναπεί ο χρήστης. */}
            {s.hasTV && (
              <div {...fieldRow(170)}>
                <CustomSelect label="Πάροχος" value={s.tvProvider}
                  onChange={v => upd({ tvProvider: v, tvPlanId: '', tvPlan: '' })}
                  options={TV_PROVIDERS.map(p => ({ value: p.value, label: p.label }))}/>
                {tvPackOptions.length > 0 ? (
                  <CustomSelect label="Πακέτο" value={s.tvPlanId || ''}
                    onChange={v => {
                      const pack = (TV_PACKS[s.tvProvider] || []).find(x => x.id === v);
                      upd({
                        tvPlanId: v, tvPlan: pack?.name || '',
                        ...(pack?.price ? { tvPrice: pack.price.toFixed(2) } : {}),
                        // Ανάβει, δεν σβήνει: ένα πακέτο χωρίς αθλητικά δεν
                        // σημαίνει ότι ο χρήστης δεν έχει ξεχωριστή συνδρομή.
                      });
                    }}
                    options={[{ value: '', label: 'Διάλεξε πακέτο' }, ...tvPackOptions]}/>
                ) : (
                  <TextInput label="Πακέτο" value={s.tvPlan} onChange={v => upd({ tvPlan: v })} placeholder="Ονομασία πακέτου"/>
                )}
                <NumberInput label="Μηνιαίο κόστος" value={s.tvPrice} onChange={v => upd({ tvPrice: v })} suffix="€"/>
                {/* Ο ΔΙΑΚΟΠΤΗΣ «ΑΘΛΗΤΙΚΑ» ΕΦΥΓΕ, ΓΙΑΤΙ ΔΕΝ ΕΚΑΝΕ ΤΙΠΟΤΑ. Το
                    `tvHasSports` γραφόταν σε τρία σημεία και ΔΕΝ διαβαζόταν σε
                    κανένα: ούτε σε υπολογισμό κόστους, ούτε σε σύγκριση
                    πακέτων, ούτε σε καμία οθόνη. Ο χρήστης γύριζε έναν
                    διακόπτη και δεν άλλαζε ούτε ένα νούμερο πουθενά.

                    Ενα χειριστήριο που δεν κάνει τίποτα είναι χειρότερο από
                    απόν: ζητά απόφαση και υπόσχεται αποτέλεσμα που δεν έρχεται.
                    Το μηνιαίο κόστος του πακέτου, που είναι το μόνο που μετρά,
                    το δίνει ήδη το πεδίο από πάνω. */}
              </div>
            )}
          </div>
        </div>

      </>)}

      {show('water') && (<>
        {/* ── Νερό ─────────────────────────────────────────────────────────── */}
        <div style={card}>
          {secHdr('Νερό')}
          {/* ΤΕΣΣΕΡΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΙΔΙΑΣ ΠΑΡΟΧΗΣ, ΣΕ ΜΙΑ ΣΕΙΡΑ ΙΣΑ ΜΟΙΡΑΣΜΕΝΗ.
              Ήταν πέντε και το πέμπτο έπεφτε μόνο του σε δεύτερη γραμμή. */}
          <div {...fixedCols(4, 14)} style={{ ...fixedCols(4, 14).style, marginBottom: 14 }}>
            <CustomSelect label="Πάροχος" value={s.waterProvider}  onChange={v => upd({ waterProvider: v })}  options={WATER_PROVIDERS.map(p => ({ value: p.value, label: p.label }))}/>
            {/* Η παρένθεση έλεγε ό,τι λέει ήδη η λέξη: «Διμηνιαίος (κάθε 2
                μήνες)». Ίδιο πράγμα δύο φορές και αρκετά μακρύ ώστε να κόβεται
                με αποσιωπητικά — δηλαδή το διπλό έδιωχνε το μισό. */}
            <CustomSelect
              label="Συχνότητα χρέωσης"
              value={s.waterPeriodMonths || '2'}
              onChange={v => upd({ waterPeriodMonths: v, waterMonthly: waterMonthlyText(s.waterBiMonthly, v) })}
              options={[
                { value: '1', label: 'Μηνιαίος' },
                { value: '2', label: 'Διμηνιαίος' },
                { value: '3', label: 'Τριμηνιαίος' },
                { value: '4', label: 'Τετραμηνιαίος' },
                { value: '6', label: 'Εξαμηνιαίος' },
              ]}
            />
            <NumberInput  label="Λογαριασμός νερού" value={s.waterBiMonthly}
              onChange={v => upd({ waterBiMonthly: v, waterMonthly: waterMonthlyText(v, s.waterPeriodMonths) })}
              suffix="€"/>
            {/* ΤΟ ΠΕΔΙΟ «ΜΗΝΙΑΙΑ ΑΝΑΓΩΓΗ» ΗΤΑΝ ΝΕΚΡΟ ΚΟΥΤΙ. Ήταν ο λογαριασμός
                διά τους μήνες, δηλαδή τιμή που την ξέρει ήδη η οθόνη — και μόλις
                υπήρχε λογαριασμός ΚΑΙ ΟΙ ΔΥΟ αναγνώστες (η σύνοψη εδώ και ο
                προϋπολογισμός) αγνοούσαν ό,τι πληκτρολογούσε ο χρήστης μέσα του.
                Έγραφε άλλο νούμερο και δεν άλλαζε τίποτα πουθενά. Ο μηνιαίος
                φαίνεται από κάτω, υπολογισμένος. */}
            <NumberInput  label="Άτομα στο ακίνητο"      value={s.waterPersons}  onChange={v => upd({ waterPersons: v })}  suffix="άτομα"/>
          </div>
          {waterM > 0 && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: '10px 14px', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans, border: '1px solid var(--border-subtle)' }}>
              Μηνιαίο: <strong style={{ color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{fe(waterM)}</strong>
              {s.waterPersons && parseInt(s.waterPersons) > 0 && (
                <span style={{ marginLeft: 14 }}>Ανά άτομο: <strong style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{fe(waterM / parseInt(s.waterPersons))}</strong> / μήνα</span>
              )}
              {waterData?.url && <a href={waterData.url} target="_blank" rel="noopener noreferrer" className="tap-link" style={{ marginLeft: 14, fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Επίσημη σελίδα {waterData.label}</a>}
            </div>
          )}
          {benchmarkBar(waterM * 2, 24, BENCHMARKS.water.label)}
        </div>

      </>)}

      {show('heating') && (<>
        {/* ── Θέρμανση ─────────────────────────────────────────────────────── */}
        <div style={card}>
          {secHdr('Θέρμανση')}
          <div {...g3}>
            {/* ΤΟ ΜΕΝΟΥ ΓΡΑΦΕΙ ΣΤΟ ΑΚΙΝΗΤΟ. Πριν έγραφε στις ρυθμίσεις ΑΥΤΗΣ της
                καρτέλας, ενώ η καρτέλα του αερίου είχε δικό της μενού με δικό
                του λεξιλόγιο: δύο απαντήσεις για ένα κτίριο. */}
            <CustomSelect label="Τύπος θέρμανσης" value={heatingType} onChange={setHeatingType} options={[...HEATING_TYPES]}/>
            {/* Το μηνιαίο κόστος δεν έχει νόημα όπου το κόστος βγαίνει από
                λίτρα ή κιλά, ούτε όπου δεν υπάρχει θέρμανση. */}
            {!['autonomous_oil', 'pellet', 'none', ''].includes(heatingType) && (
              <NumberInput label="Μέσο μηνιαίο κόστος" value={s.heatingMonthly} onChange={v => upd({ heatingMonthly: v })} suffix="€"/>
            )}
            {heatingType === 'autonomous_oil' && (
              <><NumberInput label="Λίτρα τον χρόνο"     value={s.heatingLitersPerYear}    onChange={v => upd({ heatingLitersPerYear: v })}    suffix="L"/><NumberInput label="Τιμή ανά λίτρο" value={s.heatingOilPricePerLiter} onChange={v => upd({ heatingOilPricePerLiter: v })} suffix="€"/></>
            )}
            {heatingType === 'pellet' && (
              <><NumberInput label="Kg / έτος"     value={s.heatingKgPellet}    onChange={v => upd({ heatingKgPellet: v })}    suffix="kg"/><NumberInput label="Τιμή ανά κιλό" value={s.heatingPelletPrice} onChange={v => upd({ heatingPelletPrice: v })} suffix="€"/></>
            )}
            {isCentralHeating(heatingType) && (
              <NumberInput label="Μερίδιο ιδιοκτησίας" value={s.heatingCentralShare} onChange={v => upd({ heatingCentralShare: v })} suffix="%"/>
            )}
          </div>
          {heatingM > 0 && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: '12px 16px', border: '1px solid var(--border-subtle)', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                {[{ label: 'Μέσο Μηνιαίο', value: fe(heatingM) },{ label: 'Εκτιμώμενο Ετήσιο', value: fe(heatingM * 12) }].map((k, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, marginBottom: 4, fontFamily: T.font.sans }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                Τυπικό κόστος ενέργειας 2026, ανά <span title="Κιλοβατώρα, μονάδα ενέργειας">κιλοβατώρα</span>: φυσικό αέριο περίπου {feRate(0.08)} · πετρέλαιο περίπου {feRate(0.10)} · αντλία θερμότητας περίπου {feRate(0.06)}
              </div>
            </div>
          )}
          {benchmarkBar(heatingM, BENCHMARKS.heating.avg, BENCHMARKS.heating.label)}
        </div>

      </>)}

      {show('security') && (<>
        {/* ── Security & Συναγερμός ─────────────────────────────────────────── */}
        <div style={card}>
          {secHdr('Συναγερμός και ασφάλεια χώρου')}
          <div {...g3}>
            <CustomSelect label="Εταιρεία"            value={s.securityCompany}  onChange={v => upd({ securityCompany: v })}  options={SECURITY_COMPANIES.map(c => ({ value: c.value, label: c.label }))}/>
            <TextInput    label="Πρόγραμμα ή πακέτο" value={s.securityPlan}    onChange={v => upd({ securityPlan: v })}    placeholder="Basic"/>
            <NumberInput  label="Μηνιαίο κόστος" value={s.securityMonthly} onChange={v => upd({ securityMonthly: v })} suffix="€"/>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 12 }}>
            <Toggle on={s.securityHasRemote} onChange={v => upd({ securityHasRemote: v })} label="Τηλεχειρισμός από εφαρμογή"/>
            <Toggle on={s.securityHasCamera} onChange={v => upd({ securityHasCamera: v })} label="Κάμερες"/>
            <Toggle on={s.securityHasDoor}   onChange={v => upd({ securityHasDoor: v })}   label="Αυτόματη πόρτα"/>
          </div>
          {securityM > 0 && secData?.url && (
            <a href={secData.url} target="_blank" rel="noopener noreferrer" className="tap-link" style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontFamily: T.font.sans }}>
              Επίσημη σελίδα {secData.label}
            </a>
          )}
          {benchmarkBar(securityM, BENCHMARKS.security.avg, BENCHMARKS.security.label)}
        </div>

      </>)}

    </div>
  );
}