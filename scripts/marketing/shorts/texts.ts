// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · ΤΑ ΚΕΙΜΕΝΑ ΚΑΘΕ ΠΛΑΤΦΟΡΜΑΣ (texts.md)
// ─────────────────────────────────────────────────────────────────────────
// Από τα ΙΔΙΑ γεγονότα με το βίντεο: τίτλος, περιγραφή και ετικέτες για το
// YouTube, λεζάντα και εναλλακτικό κείμενο για Instagram και Facebook, λεζάντα
// και hashtags για το TikTok, καρφιτσωμένο σχόλιο. Μπαίνει πρώτα το «Σενάριο»
// (τα αγκίστρια, η απόφαση και οι γραμμές του storyboard) και στο τέλος ο
// πίνακας των γεγονότων με την πηγή και την ημερομηνία λήξης του καθενός.
// ═══════════════════════════════════════════════════════════════════════════
import { fact, plain, SERIES, type Facts } from './kit';
import { ARC_LABEL, SIGNAL_LABEL, type Built } from './spec';
import { TRANSITIONS } from './transitions';
import { validTo } from './facts';
import { fn, fpRate } from '../../../lib/core/format';
import type { Page } from './engine';

export type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';
export const utmUrl = (path: string, campaign: string, src: Platform) =>
  `https://properwise.gr${path}?utm_source=${src}&utm_medium=short&utm_campaign=${campaign}`;

/** Τα γεγονότα συν τον σύνδεσμο της πλατφόρμας, για να γεμίσει το `{ctaUrl}`. */
const withUrl = (b: Built, src: Platform): Facts => ({ ...b.f, ctaUrl: fact('ctaUrl', src, utmUrl(b.spec.cta.path, b.spec.utm.campaign, src), 'spec.cta + spec.utm', { kind: 'text' }) });
const tagOf = (s: string) => `#${s.replace(/\s+/g, '')}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export interface Rendered {
  ytTitle: string; ytDesc: string; ytTags: string[];
  igCaption: string; igTags: string[]; alt: string; fbCaption: string;
  ttCaption: string; ttTags: string[]; pinned: string;
}
export function renderTexts(b: Built): Rendered {
  const T = b.spec.texts;
  const yt = withUrl(b, 'youtube'), ig = withUrl(b, 'instagram'), fb = withUrl(b, 'facebook'), tt = withUrl(b, 'tiktok');
  const igTags = T.instagram.hashtags.map(x => tagOf(plain(x, ig)));
  const ttTags = T.tiktok.hashtags.map(x => tagOf(plain(x, tt)));
  return {
    ytTitle: plain(T.youtube.title, yt),
    ytDesc: plain(T.youtube.description, yt),
    ytTags: T.youtube.tags.map(x => plain(x, yt)),
    igCaption: `${plain(T.instagram.caption, ig)}\n\n${igTags.join(' ')}`,
    igTags,
    alt: plain(T.instagram.alt, ig),
    fbCaption: plain(T.facebook?.caption ?? T.instagram.caption, fb).replace(/σύνδεσμος στο bio\.?/, utmUrl(b.spec.cta.path, b.spec.utm.campaign, 'facebook')),
    ttCaption: `${plain(T.tiktok.caption, tt)} ${ttTags.join(' ')}`,
    ttTags,
    pinned: plain(T.pinned, yt),
  };
}

/** Οι γραμμές του σεναρίου: χρόνος, ρόλος, τι βλέπεις, το πέρασμα που φέρνει τη σκηνή, ο ήχος. */
export function storyboard(b: Built, pg: Page): string[] {
  return b.scenes.map((s, k) => {
    const a = b.at[k], z = k + 1 < b.at.length ? b.at[k + 1] : b.dur, tr = pg.trs.find(x => x.k === k);
    return `${k + 1}. **${mmss(a)}–${mmss(z)} · ${s.arc ? ARC_LABEL[s.arc] : s.kind}** · ${plain(s.story, b.f)}${tr ? ` Πέρασμα: ${TRANSITIONS[tr.name as keyof typeof TRANSITIONS].label.toLocaleLowerCase('el')}.` : ' Χωρίς πέρασμα: κινείται από το πρώτο καρέ.'} Ήχος: ${plain(s.cue, b.f).replace(/\.$/, '')}.`;
  });
}

export function textsMd(b: Built, pg: Page, r: Rendered, extra: { files?: string[]; gates?: string[] } = {}): string {
  const { spec, f } = b;
  const used = new Set<string>();
  const scan = (s: string) => { for (const m of s.matchAll(/\{([a-zA-Z0-9_.]+)\}/g)) used.add(m[1]); };
  scan(JSON.stringify({ t: spec.texts, s: b.scenes.map(x => ({ p: x.params, st: x.story, o: x.inOpts })), h: spec.hooks.map(h => h.scene.params), ti: spec.title, ho: spec.hook, pr: spec.protagonist }));
  for (const sc of b.scenes) for (const [k, v] of Object.entries(sc.params as Record<string, unknown>)) if (/Fact$/.test(k) && typeof v === 'string') used.add(v);
  for (const sc of b.scenes) { const p = sc.params as Record<string, unknown>; for (const k of ['before', 'after', 'total', 'sum', 'wrong']) if (typeof p[k] === 'string') used.add(p[k] as string);
    for (const arr of Object.values(p)) if (Array.isArray(arr)) for (const x of arr) if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if ((/Fact$/.test(k) || ['before', 'after', 'total'].includes(k)) && typeof v === 'string') used.add(v); }
  const rows = Object.values(f).filter(x => used.has(x.id));
  const deaths = [...new Set(rows.map(x => x.validity).filter((x): x is string => !!x))].map(id => ({ id, to: validTo(id) }));
  const death = deaths.map(d => d.to).filter((x): x is string => !!x).sort()[0];
  const s = SERIES[spec.series];
  return [
    `# Short ${spec.date} ${spec.slot} · «${plain(spec.title, f)}»`,
    '',
    `Σειρά: **${s.name}** · ${fn(b.dur, 1)}″ · ${b.scenes.length} σκηνές · ${s.bpm} χτύποι το λεπτό · 1080×1920, 30 fps.`,
    `Σύνδεσμος: \`${spec.cta.path}\` · καμπάνια \`${spec.utm.campaign}\`.`,
    death ? `**Ημερομηνία λήξης: ${death.split('-').reverse().join('/')}** (${deaths.map(d => `\`${d.id}\` ως ${d.to ?? 'ανοιχτό'}`).join(', ')}, lib/legal/validity.ts). Μετά από αυτήν το βίντεο αποσύρεται ή ξαναβγαίνει.` : 'Ημερομηνία λήξης: ανοιχτή.',
    '',
    '## Σενάριο',
    '',
    `**Πρωταγωνιστής** (παράδειγμα, όχι υπαρκτό πρόσωπο): ${plain(spec.protagonist, f)}`,
    '',
    '**Αγκίστρια.** Δύο εκδοχές, ως στιγμιότυπα στα 0, 0,4 και 0,8″. Το κριτήριο: σταματά ο αντίχειρας σε 0,8″;',
    '',
    ...spec.hooks.map((h, i) => `- ${i === spec.pick ? '**Νικητής:**' : 'Εναλλακτικό:'} ${h.name}. ${plain(h.scene.story, f)} ${plain(h.why, f)}`),
    '',
    '**Storyboard** (χρόνος · ρόλος · εικόνα · πέρασμα · ήχος):',
    '',
    ...storyboard(b, pg),
    '',
    `Ο αριθμός-απάντηση έρχεται στο ${(() => { const k = b.scenes.findIndex(x => x.arc === 'payoff'); const t = Math.min(...(pg.outs[k].hits ?? [b.at[k]])); return `${fn(t, 1)}″ (${fpRate(Math.round(100 * t / b.dur))})`; })()}. Βρόχος: το τελευταίο μισό δευτερόλεπτο ξαναστήνει το πρώτο καρέ.`,
    '',
    '## Ρουμπρίκα viral',
    '',
    '_Αυτοαξιολόγηση για την επιμέλεια, όχι μέτρηση ούτε πρόβλεψη. Ο βαθμός είναι εκτίμηση του γράφοντος και θέλει έλεγχο από άνθρωπο._',
    '',
    `**Αγκίστρι (η πρώτη φράση):** ${plain(spec.hook, f)}`,
    '',
    `**Βαθμός: ${spec.rubric.score}/100.** Γιατί θα δουλέψει: ${plain(spec.rubric.why, f)}`,
    '',
    '| Σήμα | Σκηνή | Χρόνος | Τι το κάνει |',
    '|---|---|---|---|',
    ...spec.rubric.signals.map(x => { const k = x.scene, h = (pg.outs[k]?.hits ?? []).filter(t => t >= b.at[k] - 0.5); const t = h.length ? Math.max(b.at[k], Math.min(...h)) : b.at[k];
      return `| ${SIGNAL_LABEL[x.signal]} | ${k + 1} | ${mmss(t)} | ${plain(x.note, f).replace(/\|/g, '/')} |`; }),
    '',
    '## YouTube Shorts',
    '',
    `**Τίτλος:** ${r.ytTitle}`,
    '',
    '**Περιγραφή:**',
    '',
    r.ytDesc,
    '',
    `**Ετικέτες:** ${r.ytTags.join(', ')}`,
    '',
    '## Instagram Reels',
    '',
    '**Λεζάντα:**',
    '',
    r.igCaption,
    '',
    `**Εναλλακτικό κείμενο:** ${r.alt}`,
    '',
    `Σύνδεσμος για το bio ή το αυτοκόλλητο: ${utmUrl(spec.cta.path, spec.utm.campaign, 'instagram')}`,
    '',
    '## Facebook Reels',
    '',
    r.fbCaption,
    '',
    `**Εναλλακτικό κείμενο:** ${r.alt}`,
    '',
    '## TikTok',
    '',
    `**Λεζάντα:** ${r.ttCaption}`,
    '',
    `Σύνδεσμος για το bio: ${utmUrl(spec.cta.path, spec.utm.campaign, 'tiktok')}`,
    '',
    '## Καρφιτσωμένο σχόλιο',
    '',
    r.pinned,
    '',
    '## Από πού έρχεται κάθε αριθμός',
    '',
    '| Γεγονός | Κείμενο | Πηγή | Ισχύει ως |',
    '|---|---|---|---|',
    ...rows.map(x => `| \`${x.id}\` | ${x.text.replace(/\|/g, '/')} | ${x.source.replace(/\|/g, '/')} | ${x.validity ? `${validTo(x.validity) ?? 'ανοιχτό'} (\`${x.validity}\`)` : '·'} |`),
    '',
    ...(extra.files?.length ? ['## Αρχεία', '', ...extra.files.map(x => `- ${x}`), ''] : []),
    ...(extra.gates?.length ? ['## Έλεγχοι', '', '```', ...extra.gates, '```', ''] : []),
    `Παράγεται από \`npx tsx scripts/marketing/shorts/render.ts ${spec.id}\`. Μην το διορθώνεις με το χέρι: άλλαξε την προδιαγραφή (\`scripts/marketing/shorts/specs/\`).`,
  ].join('\n') + '\n';
}
