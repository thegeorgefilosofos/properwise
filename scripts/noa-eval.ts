// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΕΣ ΕΡΩΤΗΣΕΙΣ ΦΟΡΟΥ ΑΠΑΝΤΑ ΣΩΣΤΑ Η ΝΟΑ
// ─────────────────────────────────────────────────────────────────────────
// Στέλνει τις ερωτήσεις του lib/assistant/evalSet.ts στο μοντέλο με το ίδιο
// system που φτιάχνει ο διακομιστής για τη Νόα και βαθμολογεί τα ποσά της
// απάντησης απέναντι στους υπολογιστές της εφαρμογής.
//
// ΤΙ ΣΗΜΑΙΝΕΙ ΤΟ ΝΟΥΜΕΡΟ. Συμφωνία με τις μηχανές της εφαρμογής, όχι νομική
// αλήθεια. Ερώτηση χωρίς δεδομένα ακινήτου: κάτω όριο για ό,τι βλέπει ο
// χρήστης. Το μοντέλο δεν απαντά ίδια κάθε φορά, οπότε το ποσοστό είναι ρυθμός
// και ΔΕΝ μπαίνει σε CI. Το ποσοστό μετρά μόνο τις ερωτήσεις με μέθοδο μέσα
// στο prompt. Όσες θέλουν γνώση που δεν έχει γράφονται χωριστά· οι
// διφορούμενες τυπώνονται ολόκληρες για ανάγνωση από άνθρωπο.
//
// Παρακάμπτει το /api/anthropic (όριο ερωτήσεων, λίστα μοντέλων): γι' αυτό
// προειδοποιεί όταν το `--model` δεν είναι μοντέλο που θα δεχόταν η διαδρομή.
//
// ΧΡΗΣΗ:  npx tsx scripts/noa-eval.ts --dry
//         ANTHROPIC_API_KEY=… npx tsx scripts/noa-eval.ts [--model ID] [--only ID] [--out αρχείο.json]
// ΕΞΟΔΟΣ: 0 όταν τελείωσε, 2 χωρίς κλειδί (εκτός από --dry), 1 σε σφάλμα.
// Το κλειδί διαβάζεται μόνο από το περιβάλλον και δεν τυπώνεται ποτέ. Το
// --out γράφεται πάντα στον προσωρινό κατάλογο του συστήματος.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  NOA_EVAL_CASES, EVAL_CONTEXT, scoreAnswer, extractAmounts, evalRequestBody,
} from '../lib/assistant/evalSet';
import { MODEL_DEEP, MODEL_FAST } from '../lib/assistant/model';
import { athensNowLabel, athensToday } from '../lib/core/time';
import { fn } from '../lib/core/format';
import { noaSystemBlocks, buildPersonalPrompt, DEFAULT_PREFS } from '../app/dashboard/components/assistantPersona';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const dry = flag('--dry');
const model = opt('--model');
const only = opt('--only');
const out = opt('--out');

// Η ΜΕΡΑ ΟΠΩΣ ΤΗ ΣΤΕΛΝΕΙ Ο ΠΕΛΑΤΗΣ (useAssistantChat.ts): ώρα Ελλάδας και ISO.
const today = `${athensNowLabel()} (ISO: ${athensToday()}, ώρα Ελλάδας)`;
const personal = buildPersonalPrompt(DEFAULT_PREFS, EVAL_CONTEXT, undefined, { today });
const cases = NOA_EVAL_CASES.filter(c => !only || c.id === only);
const money = (n: number) => `${fn(n, 2)}€`;

if (model && model !== MODEL_DEEP && model !== MODEL_FAST) {
  console.error(`! Το μοντέλο ${model} δεν είναι στη λίστα του /api/anthropic: στην παραγωγή θα αντικαθίστατο.`);
}

if (dry) {
  for (const c of cases) {
    const wrong = c.wrong?.length ? `  λάθος: ${c.wrong.map(money).join(', ')}` : '';
    console.log(`${c.id} [${c.category}]\n  ${c.question}\n  σωστό: ${money(c.expected)}${wrong}\n  πηγή: ${c.source}`);
  }
  console.log(`\n${cases.length} ερωτήσεις, καμία κλήση στο δίκτυο.`);
  process.exit(0);
}

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('Λείπει το ANTHROPIC_API_KEY. Για τη λίστα χωρίς κλήσεις: --dry');
  process.exit(2);
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
  const rows: { id: string; category: string; verdict: string; expected: number; found: number[]; identity: string[]; answer: string }[] = [];
  for (const c of cases) {
    const system = noaSystemBlocks([{ role: 'user', content: c.question }], personal);
    if (!system) throw new Error(`${c.id}: δεν φτιάχτηκε system`);
    const answer = await ask(evalRequestBody(c, system, model));
    const s = scoreAnswer(c, answer);
    rows.push({ id: c.id, category: c.category, verdict: s.verdict, expected: c.expected, found: s.found, identity: s.identity, answer });
    console.log(`${s.verdict.padEnd(9)} ${c.id}  σωστό ${money(c.expected)}  βρέθηκαν ${extractAmounts(answer).map(money).join(', ') || 'κανένα'}`);
  }
  const head = rows.filter(r => r.category === 'in-prompt-method');
  const passed = head.filter(r => r.verdict === 'pass').length;
  console.log(`\nΜΕ ΜΕΘΟΔΟ ΣΤΟ PROMPT: ${passed}/${head.length} σωστά (${fn(head.length ? (passed / head.length) * 100 : 0, 1)}%)`);
  const extra = rows.filter(r => r.category !== 'in-prompt-method');
  if (extra.length) console.log(`ΕΚΤΟΣ PROMPT (δεν μετρά): ${extra.filter(r => r.verdict === 'pass').length}/${extra.length} σωστά`);
  const ident = rows.filter(r => r.identity.length);
  if (ident.length) console.log(`ΤΑΥΤΟΤΗΤΑ: ${ident.map(r => `${r.id} (${r.identity.join(', ')})`).join(' · ')}`);
  for (const r of rows.filter(x => x.verdict === 'ambiguous')) {
    console.log(`\n── ΔΙΦΟΡΟΥΜΕΝΟ, ΘΕΛΕΙ ΑΝΑΓΝΩΣΗ: ${r.id} (σωστό ${money(r.expected)})\n${r.answer}`);
  }
  if (out) {
    const file = join(tmpdir(), basename(out));
    writeFileSync(file, JSON.stringify({ today, model: model ?? 'modelFor', rows }, null, 2));
    console.log(`\nΑποτελέσματα: ${file}`);
  }
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
