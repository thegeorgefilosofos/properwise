// ═══════════════════════════════════════════════════════════════════════════
// ΚΟΜΒΟΣ ΕΡΓΑΛΕΙΩΝ — /ergaleia — όλοι οι δωρεάν υπολογισμοί σε μία σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ (27.10.2026). Οι υπολογιστές ζούσαν μόνο στη στήλη του
// υποσέλιδου και στο μενού. Δεν υπήρχε σελίδα που να τους μαζεύει, οπότε η
// διαδρομή (BreadcrumbList) κάθε υπολογιστή είχε δύο κρίκους αντί για τρεις
// και η μηχανή αναζήτησης δεν έβλεπε τους υπολογιστές ως οικογένεια, όπως
// βλέπει τους οδηγούς στο /odigos.
//
// ΚΑΝΕΝΑΣ ΚΑΤΑΛΟΓΟΣ ΓΡΑΜΜΕΝΟΣ ΕΔΩ. Οι κάρτες, το πλήθος και το ItemList
// βγαίνουν από το PUBLIC_TOOLS (lib/core/publicTools.ts), τον ίδιο κατάλογο με
// το υποσέλιδο και το /llms.txt. Νέος υπολογιστής που μπαίνει εκεί εμφανίζεται
// εδώ μόνος του: στο θέμα του αν δηλώνει `topic`, αλλιώς στους «Άλλους
// υπολογισμούς». Τα θέματα και η σειρά τους είναι κοινά με τον κόμβο των
// οδηγών (lib/core/topics.ts) και η σύνθεση κοινή (app/HubParts.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { PUBLIC_TOOLS, TOOLS_HUB, type PublicTool } from '@/lib/core/publicTools';
import { TOPICS, topicAnchor, type TopicId } from '@/lib/core/topics';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { HubSection, HubLink, type HubItem } from '../HubParts';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';

const TITLE = 'Εργαλεία για ιδιοκτήτες ακινήτων: φόρος, ΕΝΦΙΑ, δόση';
// Το πλήθος από τον κατάλογο· τα θέματα ως οικογένειες, όχι ως λίστα ονομάτων
// που θα έμενε πίσω με τον επόμενο υπολογιστή.
const DESC =
  `${PUBLIC_TOOLS.length} δωρεάν υπολογισμοί χωρίς εγγραφή για ιδιοκτήτες: φόρος ενοικίων, ΕΝΦΙΑ, `
  + 'βραχυχρόνια μίσθωση, στεγαστικό δάνειο, απόδοση και ρεύμα.';
const URL = siteUrl(TOOLS_HUB.href);

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('ergaleia') });

/** Ο σύνδεσμος στο ίδιο θέμα του κόμβου των οδηγών. */
const guides = (id: TopicId, text: string) => <HubLink href={`/odigos#${topicAnchor(id)}`}>{text}</HubLink>;

// Η εισαγωγή κάθε θέματος για τα εργαλεία· οι οδηγοί του ίδιου θέματος εξηγούν
// τους κανόνες πίσω από τα ποσά.
const LEDES: Record<TopicId, ReactNode> = {
  enoikia: <>
    Ο φόρος του ενοικίου με την κλίμακα του έτους και τα καθαρά της βραχυχρόνιας δίπλα στη μακροχρόνια
    μίσθωση. Τους κανόνες πίσω από τα ποσά τους εξηγούν οι {guides('enoikia', 'οδηγοί για τα ενοίκια')}.
  </>,
  enfia: <>
    Ο ΕΝΦΙΑ του δικού σου ακινήτου, ως ενδεικτικό ποσό. Τον τύπο, τις δόσεις και τις προθεσμίες της
    χρονιάς τα εξηγούν οι {guides('enfia', 'οδηγοί για τον ΕΝΦΙΑ')}.
  </>,
  agora: <>
    Η δόση και πόσο δάνειο επιτρέπει το εισόδημα, τι μένει καθαρό από το ενοίκιο και τι θα πλήρωνες για
    ρεύμα με κάθε τιμολόγιο. Τα προγράμματα «Σπίτι μου» και την απόδοση τα αναλύουν οι{' '}
    {guides('agora', 'οδηγοί για την αγορά')}.
  </>,
};

const item = (t: PublicTool): HubItem => ({ href: t.href, kicker: 'Υπολογισμός', title: t.label, desc: t.desc });

/** «1 υπολογισμός», «3 υπολογισμοί»: το πλήθος από τον κατάλογο. */
const countLabel = (n: number) => `${n} ${n === 1 ? 'υπολογισμός' : 'υπολογισμοί'}`;

// Τα θέματα με τη σειρά τους και στο τέλος όσοι υπολογιστές δεν δηλώνουν θέμα.
// Ομάδα χωρίς υπολογιστή δεν εμφανίζεται.
const GROUPS = [
  ...TOPICS.map(t => ({ id: topicAnchor(t.id), title: t.title as string, lede: LEDES[t.id] as ReactNode,
    tools: PUBLIC_TOOLS.filter(x => x.topic === t.id) })),
  { id: 'thema-alla', title: 'Άλλοι υπολογισμοί', lede: undefined, tools: PUBLIC_TOOLS.filter(x => !x.topic) },
].filter(g => g.tools.length > 0);

// Η σειρά του ItemList είναι η σειρά της σελίδας.
const ORDERED = GROUPS.flatMap(g => g.tools);

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESC,
      url: URL,
      inLanguage: 'el',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: ORDERED.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: siteUrl(t.href),
          name: t.label,
        })),
      },
    },
    breadcrumbJsonLd([{ name: TOOLS_HUB.label, path: TOOLS_HUB.href }]),
  ],
};

export default function Page() {
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />

      {/* `data-nohy`: χωρίς μαλακά ενωτικά, όπως ο κόμβος των οδηγών. */}
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {TITLE}
        </h1>
        <p className="po-just" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
          Ο υπολογισμός γίνεται στη συσκευή σου, με τα δικά σου δεδομένα, δωρεάν και χωρίς εγγραφή. Οι ίδιοι
          υπολογισμοί με την εφαρμογή, ενδεικτικοί και όχι επίσημο έγγραφο, με τις πηγές τους. Το γιατί
          πίσω από κάθε ποσό το εξηγούν οι <HubLink href="/odigos">οδηγοί</HubLink>, με τα ίδια θέματα.
        </p>

        {GROUPS.map(g => (
          <HubSection key={g.id} id={g.id} over={countLabel(g.tools.length)} title={g.title} lede={g.lede}
            items={g.tools.map(item)} cta="Άνοιξε τον υπολογισμό" />
        ))}
      </main>

      <PublicFooter />
    </div>
  );
}
