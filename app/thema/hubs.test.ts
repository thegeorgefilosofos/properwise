// npx tsx app/thema/hubs.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΟΜΒΟΙ ΘΕΜΑΤΟΣ ΚΑΙ Η ΜΕΘΟΔΟΛΟΓΙΑ: ΜΕΛΗ, ΣΧΗΜΑ, ΔΙΑΔΡΟΜΗ ΚΑΙ ΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
//   1. Κάθε μέλος κόμβου υπάρχει: οδηγός του καταλόγου, δημόσιος υπολογιστής,
//      κανόνας του μητρώου ισχύος. Το ίδιο για τους κανόνες κάθε οδηγού.
//   2. Η σελίδα δείχνει κάθε μέλος, τη διαδρομή, τη νομική βάση και τις
//      ερωτήσεις· το `FAQPage` έχει ακριβώς τις ορατές ερωτήσεις.
//   3. Η ημερομηνία ελέγχου στη σελίδα είναι το `checkedAt` του μητρώου (άνθρωπος).
//   4. Ελληνικό κείμενο: χωρίς κόμμα πριν από «και», χωρίς μακριά παύλα, χωρίς
//      «δωρεάν», ποσά κολλητά στο €, ημερομηνίες ηη/μμ/εεεε.
//   5. Η επανεγγραφή και η πόρτα του διαμεσολαβητή υπάρχουν.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { grDate } from '@/lib/core/format';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import { REGULATED } from '@/lib/legal/validity';
import { IDENTITY } from '@/lib/legal/identity';
import { GUIDES, LISTED_GUIDES } from '../odigos/guides';
import { GuideUpdated } from '../odigos/GuideParts';
import { HUBS, hubPath, hubsOfGuide, METHOD_PATH, HUB_INTERNAL, METHOD_INTERNAL } from './hubs';
import { HubPage, hubJsonLd, hubCopy } from './HubPage';
import { ruleRows, oldestCheck } from './rules';
import Methodology from '../methodologia/view';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const RULE_IDS = new Set(REGULATED.map(r => r.id));
const text = (html: string) => html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ').split(/<[^>]+>/).join(' ').replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Οι κανόνες του ιδιοκτήτη για το ελληνικό κείμενο, στο ορατό κείμενο μιας σελίδας. */
function greek(name: string, t: string) {
  ok(`${name}: χωρίς κόμμα πριν από «και»`, !/,\s*(και|κι)(?!\p{L})/u.test(t));
  ok(`${name}: χωρίς μακριά παύλα`, !t.includes(String.fromCharCode(0x2014)));
  ok(`${name}: χωρίς «δωρεάν»`, !/δωρεάν/i.test(t));
  ok(`${name}: ποσά κολλητά στο € (${(/\d[\s ]+€/.exec(t) ?? [''])[0]})`, !/\d[\s ]+€/.test(t));
  ok(`${name}: καμία ημερομηνία ISO στο ορατό κείμενο`, !/\b\d{4}-\d{2}-\d{2}\b/.test(t));
  ok(`${name}: η Νόα δεν λέγεται «βοηθός»`, !/Νόα[^.]{0,40}βοηθ|βοηθ[^.]{0,40}Νόα/u.test(t));
}

// ── 1. ΤΑ ΜΕΛΗ ──────────────────────────────────────────────────────────────
ok('τουλάχιστον ένας κόμβος', HUBS.length > 0);
ok('μοναδικά slug', new Set(HUBS.map(h => h.slug)).size === HUBS.length);
for (const h of HUBS) {
  ok(`${hubPath(h)}: έχει οδηγό και υπολογιστή`, h.guides.length > 0 && h.tools.length > 0);
  for (const g of h.guides) ok(`${hubPath(h)}: ο ${g} είναι οδηγός του καταλόγου`, LISTED_GUIDES.some(x => x.href === g));
  for (const t of h.tools) ok(`${hubPath(h)}: ο ${t} είναι δημόσιος υπολογιστής`, PUBLIC_TOOLS.some(x => x.href === t));
  for (const r of h.rules) ok(`${hubPath(h)}: ο κανόνας ${r} είναι στο μητρώο ισχύος`, RULE_IDS.has(r));
  ok(`${hubPath(h)}: τίτλος έως 60 χαρακτήρες (${[...h.title].length})`, [...h.title].length <= 60);
  ok(`${hubPath(h)}: περιγραφή 70–160 χαρακτήρες (${[...h.desc].length})`, [...h.desc].length >= 70 && [...h.desc].length <= 160);
  ok(`${hubPath(h)}: έχει κείμενο`, !!hubCopy(h));
}
for (const g of GUIDES) {
  ok(`${g.href}: δηλώνει κανόνες του μητρώου`, g.rules.length > 0);
  for (const r of g.rules) ok(`${g.href}: ο κανόνας ${r} είναι στο μητρώο ισχύος`, RULE_IDS.has(r));
}
// Κάθε οδηγός του καταλόγου με θέμα ενοίκια ή ΕΝΦΙΑ ανήκει σε κόμβο θέματος.
for (const g of LISTED_GUIDES.filter(x => x.topic !== 'agora')) ok(`${g.href}: ανήκει σε κόμβο θέματος`, hubsOfGuide(g.href).length > 0);

// ── 2–4. Η ΣΕΛΙΔΑ ───────────────────────────────────────────────────────────
for (const h of HUBS) {
  const html = renderToStaticMarkup(createElement(HubPage, { hub: h }));
  const t = text(html);
  const name = hubPath(h);
  for (const href of [...h.guides, ...h.tools]) ok(`${name}: σύνδεσμος προς ${href}`, html.includes(`href="${href}"`));
  ok(`${name}: ένα H1, ο τίτλος`, (html.match(/<h1\b/g) ?? []).length === 1 && t.includes(h.title));
  ok(`${name}: ορατή διαδρομή Αρχική › Οδηγοί › ${h.label}`, /aria-label="Διαδρομή"/.test(html) && html.includes('href="/odigos"') && /aria-current="page"[^>]*>[^<]*/.test(html));
  const ld = hubJsonLd(h);
  const graph = ld['@graph'] as { '@type'?: string; mainEntity?: unknown; itemListElement?: { item: string }[] }[];
  const types = graph.map(n => n['@type']);
  ok(`${name}: σχήμα Organization, CollectionPage, BreadcrumbList, FAQPage`, ['Organization', 'CollectionPage', 'BreadcrumbList', 'FAQPage'].every(x => types.includes(x)));
  const crumbs = graph.find(n => n['@type'] === 'BreadcrumbList')!.itemListElement!.map(i => i.item);
  ok(`${name}: η διαδρομή του σχήματος τελειώνει στη σελίδα`, crumbs.at(-1)!.endsWith(name) && crumbs.length === 3);
  const faq = hubCopy(h).faq;
  const faqLd = (graph.find(n => n['@type'] === 'FAQPage')!.mainEntity as { name: string; acceptedAnswer: { text: string } }[]);
  ok(`${name}: το FAQPage έχει τις ορατές ερωτήσεις`, faqLd.length === faq.length && faqLd.every((q, i) => q.name === faq[i].q && q.acceptedAnswer.text === faq[i].a));
  for (const f of faq) ok(`${name}: η ερώτηση «${f.q}» φαίνεται`, t.includes(f.q));
  // Η νομική βάση: κάθε κανόνας με την πηγή και την ημέρα του ανθρώπινου ελέγχου.
  for (const r of ruleRows(h.rules)) {
    ok(`${name}: ο κανόνας «${r.label}» με σύνδεσμο στην πηγή`, html.includes(`href="${r.href.replace(/&/g, '&amp;')}"`));
    if (r.checkedAt) ok(`${name}: ο έλεγχος του ${r.id} είναι ${grDate(r.checkedAt)}`, html.includes(`dateTime="${r.checkedAt}"`));
  }
  ok(`${name}: σύνδεσμος στη μεθοδολογία`, html.includes(`href="${METHOD_PATH}"`));
  greek(name, t);
}

// Ο οδηγός γράφει στην κεφαλίδα την πηγή, τον έλεγχο του μητρώου, το θέμα του και τη μεθοδολογία.
for (const g of LISTED_GUIDES) {
  const html = renderToStaticMarkup(createElement(GuideUpdated, { guide: g }));
  const rows = ruleRows(g.rules);
  const checked = oldestCheck(rows);
  ok(`${g.href}: «Νομική βάση» στην κεφαλίδα`, html.includes('Νομική βάση: ') && rows.every(r => html.includes(r.source)));
  if (checked) ok(`${g.href}: «Έλεγχος κανόνων» ${grDate(checked)}`, html.includes(`dateTime="${checked}"`) && html.includes(grDate(checked)));
  for (const hub of hubsOfGuide(g.href).slice(0, 1)) ok(`${g.href}: σύνδεσμος στο θέμα του`, html.includes(`href="${hubPath(hub)}"`));
  ok(`${g.href}: σύνδεσμος στη μεθοδολογία`, html.includes(`href="${METHOD_PATH}"`));
}

// ── Η ΜΕΘΟΔΟΛΟΓΙΑ ───────────────────────────────────────────────────────────
{
  const html = renderToStaticMarkup(createElement(Methodology));
  const t = text(html);
  ok('/methodologia: κάθε κανόνας του μητρώου στον πίνακα', REGULATED.every(r => t.includes(r.label)));
  ok('/methodologia: κάθε ανθρώπινος έλεγχος με την ημερομηνία του', REGULATED.filter(r => r.checkedAt).every(r => html.includes(`dateTime="${r.checkedAt}"`)));
  ok('/methodologia: ό,τι διάβασε μόνο εργαλείο δεν λέγεται ελεγμένο', REGULATED.some(r => !r.checkedAt) ? t.includes('Χωρίς ανθρώπινο έλεγχο') : true);
  ok('/methodologia: σύνδεσμος σε κάθε κόμβο θέματος', HUBS.every(h => html.includes(`href="${hubPath(h)}"`)));
  ok('/methodologia: μόνο η διεύθυνση υποστήριξης, καμία προσωπική', [...t.matchAll(/[\w.+-]+@[\w.-]+/g)].every(m => m[0] === IDENTITY.supportEmail));
  ok('/methodologia: Article με εκδότη τον οργανισμό', html.includes('"Article"') && html.includes('"publisher"'));
  greek('/methodologia', t);
}

// ── 5. Η ΔΙΑΔΡΟΜΗ ΧΩΡΙΣ ΝΕΑ ΣΥΝΑΡΤΗΣΗ ─────────────────────────────────────────
const config = readFileSync('next.config.ts', 'utf8');
const proxy = readFileSync('proxy.ts', 'utf8');
ok('next.config.ts: επανεγγραφή /thema/:slug', config.includes(`source: "/thema/:slug", destination: "${HUB_INTERNAL}/:slug"`));
ok('next.config.ts: επανεγγραφή /methodologia', config.includes(`source: "${METHOD_PATH}", destination: "${METHOD_INTERNAL}"`));
ok('proxy.ts: το /thema/ είναι δημόσιο', proxy.includes('pathname.startsWith("/thema/")'));
ok('proxy.ts: το /methodologia είναι δημόσιο', proxy.includes(`"${METHOD_PATH}",`));

if (fail) { console.error(`✗ hubs: ${fail} απέτυχαν από ${pass + fail}`); process.exit(1); }
console.log(`✓ hubs: ${pass} έλεγχοι πέρασαν`);
