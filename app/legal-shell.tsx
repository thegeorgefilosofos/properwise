import Link from 'next/link';
import { type ReactNode } from 'react';
import { hy } from '@/components/Hyphen';
import { T } from '@/components/tokens';
import { PublicHeader, PublicFooter, WRAP, WRAP_PAD } from './PublicChrome';
import { BackLink } from './BackLink';
import { transliterate } from '@/lib/core/uploadPath';
import { LegalForm } from './LegalForm';
import { TocSpy } from './TocSpy';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΛΥΦΟΣ ΤΩΝ ΤΡΙΩΝ ΣΕΛΙΔΩΝ ΕΜΠΙΣΤΟΣΥΝΗΣ
// (Ποιοι είμαστε · Πολιτική απορρήτου · Όροι χρήσης)
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ
//
// 1) ΤΟ ΕΥΡΕΤΗΡΙΟ ΗΤΑΝ ΚΟΥΤΙ ΠΟΥ ΚΥΛΟΥΣΕ ΚΑΙ ΧΑΝΟΤΑΝ. Δεκατέσσερις ενότητες σε
//    δύο στήλες μέσα σε πλαίσιο, στην κορυφή: ο αναγνώστης το διάβαζε μία φορά,
//    κατέβαινε και από εκεί και πέρα δεν είχε ιδέα πού βρίσκεται ούτε πώς να
//    πάει αλλού. Νομικό κείμενο δεν διαβάζεται από την αρχή ως το τέλος·
//    διαβάζεται στοχευμένα. Το ευρετήριο μένει ΚΑΡΦΩΜΕΝΟ στο πλάι όσο κυλάς.
//
// 2) ΤΟ ΚΕΙΜΕΝΟ ΗΤΑΝ 14 ΕΙΚΟΝΟΣΤΟΙΧΕΙΑ, ΜΙΚΡΟΤΕΡΟ ΑΠΟ ΚΑΘΕ ΑΛΛΗ ΣΕΛΙΔΑ. Οι
//    δεσμευτικοί όροι τυπώνονταν σε μέγεθος ψιλών γραμμάτων, ενώ η αρχική
//    διαβάζει στα 15. Ό,τι δεσμεύει τον χρήστη δεν επιτρέπεται να είναι το πιο
//    δυσανάγνωστο κείμενο του προϊόντος.
//
// 3) Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΣΤΟ ΤΕΛΟΣ ΗΤΑΝ ΠΟΡΤΟΚΑΛΙ. Φορούσε τα χρώματα που η
//    εφαρμογή κρατά για εκκρεμότητες, δηλαδή το σήμα «κάτι πάει στραβά» — και
//    προσπερνιόταν όπως προσπερνιέται κάθε κίτρινο πλαίσιο.
//
// 4) ΤΟ «ΠΟΙΟΙ ΕΙΜΑΣΤΕ» ΕΣΤΗΝΕ ΔΙΚΟ ΤΟΥ ΚΟΣΜΟ. Δική του κεφαλίδα, δικό του
//    μέτρο (780 αντί 720), δικά του μεγέθη τίτλων, κανένα ευρετήριο και κανένα
//    υποσέλιδο. Οι τρεις σελίδες που ζητούν εμπιστοσύνη διάβαζαν σαν να τις
//    έγραψαν τρεις διαφορετικοί άνθρωποι. Τώρα μοιράζονται το ίδιο `LegalLayout`
//    και διαφέρουν μόνο στο περιεχόμενο — που είναι και το μόνο που πρέπει.
//
// Η ΚΕΦΑΛΙΔΑ ΚΑΙ ΤΟ ΥΠΟΣΕΛΙΔΟ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟ PublicChrome, όπως και στον
// υπολογιστή φόρου: ένα μέτρο, ένα κουμπί, ένα υποσέλιδο παντού.
// ═══════════════════════════════════════════════════════════════════════════


/** Οι τρεις σελίδες εμπιστοσύνης, για τους συνδέσμους στο τέλος καθεμιάς. */
const TRUST_PAGES: [string, string][] = [
  ['/trust', 'Ποιοι είμαστε'],
  ['/privacy', 'Πολιτική απορρήτου'],
  ['/terms', 'Όροι χρήσης'],
];

/**
 * ΤΟ ΑΓΚΙΣΤΡΟ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟΝ ΤΙΤΛΟ, ΟΧΙ ΑΠΟ ΤΗ ΘΕΣΗ. Ηταν «#s14»: αρκούσε μία
 * ενότητα παραπάνω για να δείχνει κάθε παλιός σύνδεσμος σε άλλο κείμενο.
 * «Χρόνος διατήρησης» γίνεται «#chronos-diatirisis» και μένει όπου κι αν πάει.
 */
export const anchorOf = (h: string): string =>
  // Το «ου» ως «ou», όπως το διαβάζει ο Έλληνας: «syllegoume», όχι «syllegoyme».
  transliterate(h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ου/gi, 'ou'))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Ενα email μέσα σε κείμενο, με το @ αλλά χωρίς την τελεία που κλείνει την πρόταση. */
const MAIL_IN_TEXT = /[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}/gi;

/**
 * ΜΙΑ ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΔΕΝ ΠΑΤΙΕΤΑΙ ΔΕΝ ΕΙΝΑΙ ΕΠΙΚΟΙΝΩΝΙΑ. Ο σύνδεσμος ανοίγει νέο
 * μήνυμα· το `<wbr>` μετά το @ δίνει το φυσικό σημείο αλλαγής γραμμής, ώστε το
 * «support@properwise.gr» να μη σπάει στη μέση του τομέα σε στενή οθόνη.
 * `po-tap-inline`: ο στόχος μεγαλώνει χωρίς να φουσκώνει τη γραμμή.
 */
export function MailLink({ to }: { to: string }) {
  const at = to.indexOf('@') + 1;
  return (
    <a href={`mailto:${to}`} className="lp-link po-tap-inline" style={{ color: 'var(--accent)', textDecoration: 'none', overflowWrap: 'break-word', wordBreak: 'normal' }}>
      {to.slice(0, at)}<wbr />{to.slice(at)}
    </a>
  );
}

/** Οι τρεις σελίδες με το όνομα που τις λέει το κείμενο, μέσα σε εισαγωγικά. */
const PAGE_BY_NAME: Record<string, string> = Object.fromEntries(TRUST_PAGES.map(([href, label]) => [label, href]));

/**
 * ΚΑΘΕ ΠΑΡΑΠΟΜΠΗ ΠΑΤΙΕΤΑΙ. Τα κείμενα έγραφαν «βλ. ενότητα «Δεδομένα τρίτων
 * που καταχωρείς»» και «στη σελίδα «Ποιοι είμαστε»» ως σκέτο κείμενο: ο
 * αναγνώστης έπρεπε να κυλήσει και να ψάξει τον τίτλο μόνος του. Πιάνονται
 * τρία είδη: email, ενότητα της ίδιας σελίδας (με τον τίτλο της ακριβώς) και
 * μία από τις τρεις σελίδες, όταν το όνομά της είναι σε εισαγωγικά.
 *
 * Ενότητα που δεν υπάρχει μένει κείμενο: ένας σύνδεσμος στο κενό είναι
 * χειρότερος από κανέναν. Το `legal-shell.test.ts` αποδίδει τις δύο σελίδες
 * και κοκκινίζει αν κάποια παραπομπή σε ενότητα έμεινε χωρίς σύνδεσμο.
 */
const REF_IN_TEXT = new RegExp(
  `(${MAIL_IN_TEXT.source})|(ενότητα «)([^«»]+)(»)|«(${Object.keys(PAGE_BY_NAME).join('|')})»`,
  'giu',
);

/** Τα στοιχεία που χρειάζεται η `withRefs` για να ξέρει πού δείχνει κάθε παραπομπή. */
interface RefContext {
  /** Η διαδρομή της σελίδας: σύνδεσμος στον εαυτό της δεν μπαίνει. */
  self: string;
  /** Τίτλος ενότητας → άγκιστρο. */
  anchors: ReadonlyMap<string, string>;
}

const REF_STYLE = { color: 'var(--accent)', textDecoration: 'none' } as const;

/** Κείμενο με κάθε email και κάθε παραπομπή του σε σύνδεσμο. */
function withRefs(text: string, ctx: RefContext): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF_IN_TEXT)) {
    const [whole, mail, secOpen, secTitle, secClose, page] = m;
    const at = m.index;
    const anchor = secTitle ? ctx.anchors.get(secTitle) : undefined;
    const href = page ? PAGE_BY_NAME[page] : undefined;
    let node: ReactNode = null;
    if (mail) node = <MailLink key={at} to={mail} />;
    else if (anchor) node = <span key={at}>{secOpen}<a href={`#${anchor}`} className="lp-link po-tap-inline" style={REF_STYLE}>{secTitle}</a>{secClose}</span>;
    else if (href && href !== ctx.self) node = <span key={at}>«<Link href={href} className="lp-link po-tap-inline" style={REF_STYLE}>{page}</Link>»</span>;
    if (!node) continue;
    parts.push(text.slice(last, at), node);
    last = at + whole.length;
  }
  return last === 0 ? text : [...parts, text.slice(last)];
}

/**
 * Το άγκιστρο κάθε ενότητας, με τον ίδιο κανόνα που τα γράφει το `LegalLayout`:
 * το ρητό `id`, αλλιώς ο τίτλος· αν δύο τίτλοι δώσουν το ίδιο, ο δεύτερος παίρνει
 * αριθμό. Μία συνάρτηση για τα δύο, ώστε η παραπομπή να μη δείχνει αλλού.
 */
function sectionAnchors(blocks: readonly { h: string; id?: string }[]): string[] {
  const seen = new Set<string>();
  return blocks.map((b, i) => {
    const base = b.id || anchorOf(b.h) || `s${i + 1}`;
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    return id;
  });
}

/**
 * Η ΑΡΧΗ ΤΗΣ ΓΡΑΜΜΗΣ ΩΣ ΕΤΙΚΕΤΑ. Οι λίστες των νομικών κειμένων γράφονται
 * «Στοιχεία λογαριασμού: διεύθυνση email…», «Φορητότητα: κατεβάζεις…». Το μάτι
 * που ψάχνει «πόσο κρατάτε τα αρχεία» διαβάζει μόνο τις ετικέτες· χωρίς βάρος
 * έπρεπε να διαβάσει κάθε γραμμή ολόκληρη. Ετικέτα είναι ό,τι προηγείται της
 * πρώτης άνω και κάτω τελείας, μόνο αν είναι σύντομο και δεν κλείνει πρόταση.
 * Ισχύει μόνο σε λίστα που το δηλώνει (`labelled`): σε άλλες, η πρώτη άνω και
 * κάτω τελεία είναι μέση πρότασης και η έντονη γραφή θα έκοβε τη φράση στα δύο.
 */
const LEAD = /^([^:.;·]{2,72}):\s/u;

function withLead(text: string, ctx: RefContext): ReactNode {
  const m = LEAD.exec(text);
  if (!m) return withRefs(text, ctx);
  return <><strong>{m[1]}</strong>: {withRefs(text.slice(m[0].length), ctx)}</>;
}

/** Μία ενότητα με ελεύθερο περιεχόμενο, όπως τη θέλει το «Ποιοι είμαστε». */
export interface LegalBlock {
  /**
   * Το ΜΕΡΟΣ στο οποίο ανήκει η ενότητα. Γράφεται μόνο στην ΠΡΩΤΗ ενότητα κάθε
   * μέρους· οι επόμενες το κληρονομούν.
   *
   * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: είκοσι τέσσερις ενότητες στη σειρά δεν είναι ιεραρχία, είναι
   * λίστα. Ο αναγνώστης που ψάχνει «τι γίνεται αν ακυρώσω» δεν ξέρει αν θα το
   * βρει στη 8 ή στη 19 και τις διαβάζει όλες ή καμία. Τα μέρη του λένε από
   * πού να ξεκινήσει. Η ΑΡΙΘΜΗΣΗ ΜΕΝΕΙ ΣΥΝΕΧΟΜΕΝΗ (1 ως N) και όχι ανά μέρος:
   * αλλιώς κάθε παραπομπή «βλ. ενότητα 12» θα άλλαζε νόημα με το που μπει ένα
   * μέρος παραπάνω.
   */
  part?: string;
  /**
   * Σταθερό αναγνωριστικό για σύνδεσμο απ' έξω. Χωρίς αυτό, το άγκιστρο βγαίνει
   * από τον τίτλο (`anchorOf`), οπότε αλλάζει μόνο αν αλλάξει ο τίτλος. Όποια
   * ενότητα τη δείχνει κουμπί μέσα στην εφαρμογή, παίρνει `id`, ώστε ούτε μια
   * διόρθωση τίτλου να μη σπάσει τον σύνδεσμο.
   */
  id?: string;
  h: string;
  body: ReactNode;
}

/**
 * Ο σκελετός: τίτλος, εισαγωγή, καρφωμένο ευρετήριο, αριθμημένες ενότητες.
 *
 * Ο αριθμός της ενότητας βγαίνει από τη σειρά και τυπώνεται ΕΞΩ από τον τίτλο.
 * Ήταν «1. Ορισμοί» μέσα στο ίδιο κείμενο, οπότε ένας τίτλος δύο γραμμών
 * τύλιγε κάτω από τον αριθμό και η δεύτερη σειρά ξεκινούσε από άλλο σημείο.
 */
export function LegalLayout({ eyebrow, title, intro, meta, version, blocks, closing, self }: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /** Δεξιά της εισαγωγής, στην ίδια γραμμή βάσης: ημερομηνία ή πεδίο ισχύος. */
  meta?: string;
  /** Η έκδοση του κειμένου, κάτω από την εισαγωγή: αυτή γράφεται στην απόδειξη συγκατάθεσης. */
  version?: string;
  blocks: LegalBlock[];
  /** Τελευταία σημείωση, κάτω από την τελευταία ενότητα. */
  closing?: ReactNode;
  /**
   * Η ΔΙΑΔΡΟΜΗ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΣΕΛΙΔΑΣ, ΓΙΑ ΝΑ ΒΓΕΙ ΑΠΟ ΤΗ ΣΕΙΡΑ ΣΤΟ ΤΕΛΟΣ.
   *
   * Και οι τρεις σελίδες τύπωναν και τους τρεις συνδέσμους, δηλαδή ΚΑΘΕ μία
   * έδειχνε και στον εαυτό της: στο «Ποιοι είμαστε» το πρώτο πράγμα κάτω από
   * το κείμενο ήταν ένα «Ποιοι είμαστε» που ξαναφόρτωνε την ίδια σελίδα.
   * Νεκρό χειριστήριο — και χειρότερα: η σειρά διαβαζόταν ως μπάρα πλοήγησης
   * αντί για «οι άλλες δύο». Με τη διαδρομή δηλωμένη, μένουν οι δύο που
   * πραγματικά πάνε κάπου.
   *
   * ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ ΕΠΙΤΗΔΕΣ: με προαιρετική, η επόμενη σελίδα εμπιστοσύνης
   * θα ξαναγεννούσε το ίδιο σφάλμα σιωπηλά. Ετσι το ζητά ο μεταγλωττιστής.
   */
  self: string;
}) {
  // Ενα άγκιστρο ανά ενότητα· αν δύο τίτλοι δώσουν το ίδιο, ο δεύτερος παίρνει αριθμό.
  const ids = sectionAnchors(blocks);
  // ΤΑ ΑΛΜΑΤΑ ΣΕ ΕΝΟΤΗΤΑ ΞΑΝΑΜΠΑΙΝΟΥΝ, ΜΕΣΑ ΣΤΗ ΣΤΗΛΗ ΚΑΙ ΟΧΙ ΣΤΟ ΠΛΑΙ. Χωρίς
  // αυτά, είκοσι οκτώ ενότητες σε δεκαπέντε χιλιάδες εικονοστοιχεία κινητού
  // διαβάζονταν μόνο με κύλιση. Ο ίδιος κατάλογος δύο φορές: ανοιχτός στον
  // υπολογιστή, πτυσσόμενος στο κινητό· το CSS κρύβει τον έναν και από τους
  // αναγνώστες οθόνης.
  const toc = (
    <ol className="lg-toc-list">
      {blocks.map((b, i) => (
        <li key={ids[i]}>
          <a href={`#${ids[i]}`} className="lp-link po-tap-inline">
            <span className="lg-toc-n">{i + 1}<span className="sr-only">. </span></span>{b.h}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    // `pub-root`: η παλέτα της αρχικής και εδώ (globals.css), ώστε το «Ποιοι
    // είμαστε», οι Όροι και το Απόρρητο να μην αλλάζουν χρώμα από την αρχική.
    <div className="pub-root min-h-dvh" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: T.font.sans }}>
      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(48px,6vw,80px)` }}>
        <div className="lg-head">
        <BackLink />
        <div className="lp-eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {title}
        </h1>

        {/* Η ΕΙΣΑΓΩΓΗ ΣΤΟ ΜΕΤΡΟ ΤΗΣ, ΜΟΝΗ. Η «Τελευταία ενημέρωση» ήταν εδώ
            δεξιά της, να γεμίζει το λευκό· κατέβηκε στη σειρά των αδελφών
            σελίδων, στο κενό δεξιά της (πιο κάτω, `lg-siblings`), ώστε η πρώτη
            πρόταση που διαβάζει ο επισκέπτης να μην κουβαλά ημερομηνία. */}
        <div className="lg-lede">
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{hy(intro)}</p>
        </div>
        {/* Η ΕΚΔΟΣΗ ΚΑΙ ΣΤΗΝ ΚΟΡΥΦΗ. Ζούσε μόνο κάτω από την τελευταία ενότητα,
            δεκαεπτά χιλιάδες εικονοστοιχεία κάτω στο κινητό: όποιος ήθελε να
            δει αν διαβάζει το κείμενο που αποδέχτηκε δεν την έβρισκε ποτέ. */}
        {version && <p className="lg-version">{version}</p>}
        </div>

        {/* ΜΙΑ ΚΕΝΤΡΑΡΙΣΜΕΝΗ ΣΤΗΛΗ. Το πλαϊνό ευρετήριο αφαιρέθηκε: σε στήλη
            260 εικονοστοιχείων κάθε γραμμή είχε τρία με τέσσερα κενά για να
            μοιράσει το υπόλοιπο της στοίχισης, οπότε είτε τέντωνε ορατά είτε
            έσπαγε λέξεις που δεν έπρεπε. Το πρόβλημα ήταν το ΜΕΤΡΟ, όχι η
            ρύθμιση. Η δομή δεν χάθηκε: τα ΜΕΡΗ μένουν μέσα στο κείμενο και
            χωρίζουν τις ενότητες σε ομάδες, με γραμμή από πάνω τους. */}
        <div className="lg-grid">

          {/* Η ΣΤΗΛΗ ΕΙΝΑΙ ΤΟ ΜΕΤΡΟ. Καμία παράγραφος από μέσα δεν βάζει δικό
              της πλάτος: 712 εικονοστοιχεία στα 15 βγάζουν γραμμές ογδόντα
              εννέα χαρακτήρων και κάθε γραμμή τελειώνει εκεί που τελειώνει
              και η προηγούμενη. */}
          {/* ΣΤΗΝ ΜΕΓΑΛΗ ΟΘΟΝΗ ΤΟ ΕΥΡΕΤΗΡΙΟ ΓΙΝΕΤΑΙ ΔΕΞΙΑ ΣΤΗΛΗ. Βγήκε από το
              `lg-body` ώστε το πλέγμα να το στείλει στο πλάι· στο DOM μένει
              πρώτο, για το πληκτρολόγιο και το κινητό (globals.css, `.lg-grid`). */}
          <nav aria-label="Περιεχόμενα" className="lg-toc">
            <details className="lg-toc-m"><summary>Περιεχόμενα ({blocks.length})</summary>{toc}</details>
            <div className="lg-toc-d"><div className="lg-toc-h">Περιεχόμενα</div>{toc}</div>
            <TocSpy />
          </nav>
          <div className="lg-body">
            {blocks.map((b, i) => (
              <section key={i} id={ids[i]} style={{ scrollMarginTop: 24, marginTop: i === 0 ? 0 : 'clamp(30px,4vw,46px)' }}>
                {/* ΤΑ ΜΕΡΗ ΕΙΝΑΙ ΕΠΙΚΕΦΑΛΙΔΕΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ. Ηταν `<div>`: ο
                    αναγνώστης οθόνης που πλοηγείται με επικεφαλίδες πηδούσε τις
                    πέντε με έξι ομάδες πάνω στις οποίες στηρίζεται η δομή. Μέρος
                    h2, ενότητα h3· η όψη μένει ίδια. Και ο αριθμός παίρνει τελεία
                    για τον αναγνώστη, αλλιώς το όνομα της ενότητας ακουγόταν
                    «1Υπεύθυνος επεξεργασίας». */}
                {b.part && <h2 className={i === 0 ? 'lg-part lg-part-first' : 'lg-part'}>{b.part}</h2>}
                <h3 style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 'clamp(18px,2.2vw,21px)', fontWeight: 680, letterSpacing: '-0.02em', lineHeight: 1.3, margin: '0 0 12px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 18 }}>{i + 1}<span className="sr-only">. </span></span>
                  <span style={{ textWrap: 'balance' }}>{b.h}</span>
                </h3>
                {hy(b.body)}
              </section>
            ))}

            {hy(closing)}

            {/* Η ΣΕΙΡΑ ΕΧΕΙ ΟΝΟΜΑ, ΓΙΑΤΙ ΤΗΝ ΚΡΙΝΕΙ ΕΛΕΓΧΟΣ. Χωρίς κλάση, ο
                έλεγχος «καμία σελίδα δεν δείχνει στον εαυτό της» έψαχνε τη
                διαδρομή σε ΟΛΟΚΛΗΡΟ το HTML — και την έβρισκε στο υποσέλιδο,
                που δείχνει και στις τρεις. Περνούσε ή έπεφτε για λάθος λόγο. */}
            <div className="lg-siblings" style={{ marginTop: 'clamp(32px,4vw,48px)', paddingTop: 20, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
              {TRUST_PAGES.filter(([href]) => href !== self).map(([href, label]) => (
                <Link key={href} href={href} className="lp-link po-tap" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>{label}</Link>
              ))}
              {/* Η ΗΜΕΡΟΜΗΝΙΑ ΣΤΟ ΚΕΝΟ ΔΕΞΙΑ ΤΗΣ ΣΕΙΡΑΣ. Οι δύο αδελφοί σύνδεσμοι
                  αφήνουν λευκό το δεξί μισό· το `margin-left:auto` σπρώχνει εκεί την
                  «Τελευταία ενημέρωση», ώστε να μη μένει κενό και να μη φορτώνει την
                  εισαγωγή. Σε στενή οθόνη τυλίγεται στη δική της γραμμή, δεξιά. */}
              {meta && <span className="lg-updated" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 13, whiteSpace: 'nowrap' }}>{meta}</span>}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

/** Κάθε ενότητα καθαρού κειμένου: παράγραφοι, προαιρετική λίστα, σημείωση. */
export interface LegalSection {
  h: string; p?: string[]; list?: string[]; note?: string; id?: string; part?: string;
  /** Κάθε στοιχείο της λίστας είναι «Ετικέτα: κείμενο» και η ετικέτα γράφεται έντονα. */
  labelled?: boolean;
  /** Παράγραφοι ΜΕΤΑ τη λίστα: η λίστα δεν είναι πάντα το τέλος της ενότητας. */
  after?: string[];
  /** Έντυπο προς αντιγραφή (π.χ. το υπόδειγμα υπαναχώρησης), μετά τα υπόλοιπα. */
  form?: { label: string; lines: readonly string[] };
}

/** Απόρρητο και Όροι: μόνο κείμενο, άρα δηλώνονται ως δεδομένα, όχι ως JSX. */
export function LegalShell({ title, updated, version, intro, sections, disclaimer, self }: {
  title: string; updated: string; intro: string; sections: LegalSection[]; disclaimer?: string;
  /** Η έκδοση που γράφεται στην απόδειξη συγκατάθεσης (`POLICY_VERSION`). */
  version?: string;
  /** Η διαδρομή της σελίδας· βλ. `LegalLayout.self`. */
  self: string;
}) {
  const ids = sectionAnchors(sections);
  const ctx: RefContext = { self, anchors: new Map(sections.map((s, i) => [s.h, ids[i]])) };
  const refs = (t: string) => withRefs(t, ctx);
  return (
    <LegalLayout
      self={self}
      eyebrow="Νομικά"
      title={title}
      intro={intro}
      meta={`Τελευταία ενημέρωση: ${updated}`}
      version={version ? `Έκδοση ${version} · Τελευταία ενημέρωση: ${updated}` : undefined}
      blocks={sections.map(s => ({
        id: s.id,
        h: s.h,
        part: s.part,
        body: (
          <>
            {(s.p || []).map((para, j) => <p key={j} className="lg-p">{refs(para)}</p>)}
            {s.list && <ul className="lg-ul">{s.list.map((li, j) => <li key={j}>{s.labelled ? withLead(li, ctx) : refs(li)}</li>)}</ul>}
            {(s.after || []).map((para, j) => <p key={`a${j}`} className="lg-p">{refs(para)}</p>)}
            {s.note && <p className="lg-note">{refs(s.note)}</p>}
            {s.form && <LegalForm label={s.form.label} lines={s.form.lines} />}
          </>
        ),
      }))}
      closing={disclaimer ? <p className="lg-note lg-closing">{refs(disclaimer)}</p> : undefined}
    />
  );
}
