// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΟ ΣΩΣΤΑ ΑΠΑΝΤΑ Η ΝΟΑ · npm run noa:eval
// ─────────────────────────────────────────────────────────────────────────
// Στέλνει τις ερωτήσεις του lib/assistant/evalSuite.ts στο μοντέλο ΜΕ ΤΗΝ
// ΙΔΙΑ ΔΙΑΔΡΟΜΗ ΠΟΥ ΑΚΟΛΟΥΘΕΙ Η ΕΡΩΤΗΣΗ ΤΟΥ ΧΡΗΣΤΗ:
//   · το προσωπικό μπλοκ από το buildPersonalPrompt, όπως ο πελάτης
//     (useAssistantChat.ts), με ώρα Ελλάδας·
//   · η γνώση από το noaSystemBlocks, όπως ο διακομιστής (/api/anthropic)·
//   · μοντέλο από το modelFor, max_tokens 1800, cache_control στο πρώτο μπλοκ
//     (evalRequestBody)·
//   · η απάντηση περνά από το parseAction, όπως πριν φτάσει στην οθόνη·
//     βαθμολογείται ΑΥΤΟ που θα διάβαζε ο χρήστης.
// Παρακάμπτει μόνο το όριο ερωτήσεων και τη σύνδεση της διαδρομής.
//
// ΧΡΗΣΗ:  npm run noa:eval -- --dry                     (η λίστα, χωρίς κλήσεις)
//         ANTHROPIC_API_KEY=… npm run noa:eval [-- --limit 5] [--only id,id]
//                                [--category enfia] [--model ID] [--out-dir φάκελος]
// ΕΞΟΔΟΣ: 0 έλεγξε · 2 ΔΕΝ ΕΛΕΓΧΘΗΚΕ (λείπει κλειδί) · 1 σφάλμα ή αποτυχημένη κλήση.
//         Το --dry βγαίνει με 2: δεν ελέγχει τίποτα.
// Το κλειδί διαβάζεται μόνο από το περιβάλλον και δεν τυπώνεται ποτέ. Οι
// αναφορές (JSON και Markdown) γράφονται στον προσωρινό κατάλογο του συστήματος,
// εκτός αν δοθεί --out-dir.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EVAL_CONTEXT, evalRequestBody } from '../lib/assistant/evalSet';
import { NOA_SUITE, SUITE_CATEGORIES, type SuiteCase } from '../lib/assistant/evalSuite';
import {
  runSuite, summarize, suiteMarkdown, notCheckedMarkdown, exitCodeFor, NOT_CHECKED, type SuiteRow,
} from '../lib/assistant/evalReport';
import { MODEL_DEEP, MODEL_FAST, modelFor } from '../lib/assistant/model';
import { athensNowLabel, athensToday } from '../lib/core/time';
import { fn } from '../lib/core/format';
import { noaSystemBlocks, buildPersonalPrompt, parseAction, DEFAULT_PREFS } from '../app/dashboard/components/assistantPersona';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const dry = flag('--dry');
const model = opt('--model');
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const category = opt('--category');
const limit = Number(opt('--limit')) || 0;
const outDir = resolve(opt('--out-dir') ?? join(tmpdir(), 'noa-eval'));

if (category && !(SUITE_CATEGORIES as readonly string[]).includes(category)) {
  console.error(`Άγνωστη κατηγορία «${category}». Υπάρχουν: ${SUITE_CATEGORIES.join(', ')}`);
  process.exit(1);
}
let cases: SuiteCase[] = NOA_SUITE.filter(c => (!only || only.includes(c.id)) && (!category || c.category === category));
if (limit > 0) cases = cases.slice(0, limit);

const date = athensToday();
const today = `${athensNowLabel()} (ISO: ${date}, ώρα Ελλάδας)`;
const personal = buildPersonalPrompt(DEFAULT_PREFS, EVAL_CONTEXT, undefined, { today });
const modelLabel = model ?? 'modelFor(ερώτηση)';

function writeReports(stem: string, json: unknown, md: string) {
  mkdirSync(outDir, { recursive: true });
  const j = join(outDir, `${stem}.json`), m = join(outDir, `${stem}.md`);
  writeFileSync(j, JSON.stringify(json, null, 2));
  writeFileSync(m, md);
  console.log(`\nΑναφορές:\n  ${j}\n  ${m}`);
}

if (model && model !== MODEL_DEEP && model !== MODEL_FAST) {
  console.error(`! Το μοντέλο ${model} δεν είναι στη λίστα του /api/anthropic: στην παραγωγή θα αντικαθίστατο.`);
}

if (dry) {
  for (const c of cases) {
    const want = [
      ...(c.expect.amounts ?? []).map(a => `${a.label} ${fn(a.value, 2)} (±${fn(a.tolerance, 2)})`),
      ...(c.expect.dates ?? []).map(d => `ημερομηνία ${d}`),
      ...(c.expect.required ?? []).map(p => `λέει: ${p.label}`),
      ...(c.expect.forbidden ?? []).map(p => `δεν λέει: ${p.label}`),
    ].join(' · ');
    console.log(`${c.id} [${c.category} · ${c.knowledge}]\n  ${c.question}\n  ζητά: ${want || 'μόνο τους κανόνες ταυτότητας'}\n  πηγή: ${c.source}`);
  }
  console.log(`\n${cases.length} ερωτήσεις, καμία κλήση στο δίκτυο. ${NOT_CHECKED}: η λίστα δεν είναι έλεγχος.`);
  process.exit(exitCodeFor({ checked: false, errors: 0 }));
}

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  const reason = 'Λείπει το ANTHROPIC_API_KEY από το περιβάλλον, οπότε καμία ερώτηση δεν στάλθηκε. Για τη λίστα χωρίς κλήσεις: --dry.';
  console.error(`${NOT_CHECKED}. ${reason}`);
  writeReports(`noa-eval-${date}`, { status: 'not-checked', date, reason, cases: cases.length },
    notCheckedMarkdown(reason, { date, model: modelLabel, cases: cases.length }));
  process.exit(exitCodeFor({ checked: false, errors: 0 }));
}

async function ask(body: ReturnType<typeof evalRequestBody>): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ο πάροχος απάντησε ${res.status}`);
  const data = JSON.parse(text) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('');
}

async function main() {
  const rows: SuiteRow[] = await runSuite(cases, async c => {
    const system = noaSystemBlocks([{ role: 'user', content: c.question }], personal);
    if (!system) throw new Error(`${c.id}: δεν φτιάχτηκε system`);
    const body = evalRequestBody(c, system, model ?? modelFor(c.question));
    // Ό,τι θα έβλεπε ο χρήστης: χωρίς ετικέτες ενεργειών, πριν από το πρώτο ακίνητο.
    return parseAction(await ask(body), null).clean;
  }, r => {
    const bad = r.checks.filter(c => !c.ok).map(c => c.name).join(' · ');
    console.log(`${r.verdict.padEnd(9)} ${r.id}${r.verdict === 'error' ? `  ${r.answer}` : bad ? `  ✗ ${bad}` : ''}`);
  });
  const s = summarize(rows);
  console.log(`\nΜΕ ΓΝΩΣΗ ΣΤΟ PROMPT: ${s.headline.passed}/${s.headline.answered} σωστά (${s.headline.pct == null ? '—' : `${fn(s.headline.pct, 1)}%`})`);
  for (const c of s.categories) console.log(`  ${c.label}: ${c.passed}/${c.answered}${c.errors ? ` · σφάλματα ${c.errors}` : ''}`);
  if (s.errors) console.log(`ΣΦΑΛΜΑΤΑ ΚΛΗΣΗΣ (δεν μετρούν): ${s.errors}. Ξανατρέξε τες με --only.`);
  const meta = { date, model: modelLabel, cases: cases.length };
  writeReports(`noa-eval-${date}`, { status: 'checked', ...meta, summary: s, rows }, suiteMarkdown(rows, meta));
  process.exitCode = exitCodeFor({ checked: true, errors: s.errors });
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
