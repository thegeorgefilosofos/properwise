// Το μεγάλο PDF περνά από τον χώρο αρχείων: μόνο του ίδιου χρήστη, μόνο PDF,
// σβήνεται μόλις διαβαστεί και γίνεται base64 πριν από τον μετρητή.
import { stagedPathOk, stagePathFor, resolveStaged, firstPages, STAGE_MAX_BYTES, SCAN_MAX_PAGES } from './stagedFile';
import { PDFDocument } from 'pdf-lib';
import { meterKind, fileHash } from '@/lib/billing/aiUnits';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const UID = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';
const FID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const good = stagePathFor(UID, FID);

ok('η διαδρομή του χρήστη περνά', stagedPathOk(good, UID));
ok('ξένος φάκελος απορρίπτεται', !stagedPathOk(stagePathFor(OTHER, FID), UID));
ok('άλλος υποφάκελος απορρίπτεται', !stagedPathOk(`${UID}/prop/${FID}.pdf`, UID));
ok('ανάβαση φακέλου απορρίπτεται', !stagedPathOk(`${UID}/scan-tmp/../x/${FID}.pdf`, UID));
ok('μη PDF απορρίπτεται', !stagedPathOk(`${UID}/scan-tmp/${FID}.png`, UID));
ok('URL απορρίπτεται', !stagedPathOk(`https://x.y/${good}`, UID));
ok('μη συμβολοσειρά απορρίπτεται', !stagedPathOk(42, UID));

const pdf = new Blob([Buffer.from('%PDF-1.7\nτεστ')]);
const fake = (files: Record<string, Blob>, removed: string[]) => ({
  from: () => ({
    download: async (p: string) => (files[p] ? { data: files[p], error: null } : { data: null, error: { message: 'not found' } }),
    remove: async (ps: string[]) => { removed.push(...ps); return {}; },
  }),
});
const bodyWith = (path: string) => ({
  system: 'σύστημα',
  messages: [{ role: 'user', content: [
    { type: 'document', source: { type: 'staged', path } },
    { type: 'text', text: 'Αναγνώρισε.' },
  ] }],
});

(async () => {
  {
    const removed: string[] = [];
    const body = bodyWith(good);
    ok('το δικό του PDF διαβάζεται', await resolveStaged(body, UID, fake({ [good]: pdf }, removed)));
    const src = (body.messages[0].content[0] as { source: { type: string; media_type?: string; data?: string } }).source;
    ok('γίνεται base64 PDF', src.type === 'base64' && src.media_type === 'application/pdf' && Buffer.from(src.data || '', 'base64').toString('latin1').startsWith('%PDF-'));
    ok('σβήνεται μόλις διαβαστεί', removed.includes(good));
    ok('μετρά ως σάρωση, όπως πριν', meterKind(body) === 'scan');
    ok('με αποτύπωμα για τις διπλές σαρώσεις', typeof fileHash(body) === 'string');
  }
  {
    const removed: string[] = [];
    const path = stagePathFor(OTHER, FID);
    ok('ξένο αρχείο: άρνηση, χωρίς ανάγνωση', !(await resolveStaged(bodyWith(path), UID, fake({ [path]: pdf }, removed))) && removed.length === 0);
  }
  {
    const notPdf = new Blob([Buffer.from('<html>')]);
    ok('αρχείο που δεν είναι PDF: άρνηση', !(await resolveStaged(bodyWith(good), UID, fake({ [good]: notPdf }, []))));
    ok('αρχείο που λείπει: άρνηση', !(await resolveStaged(bodyWith(good), UID, fake({}, []))));
    const huge = { size: STAGE_MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Blob;
    ok('πάνω από το όριο: άρνηση', !(await resolveStaged(bodyWith(good), UID, fake({ [good]: huge }, []))));
  }
  {
    const plain = { messages: [{ role: 'user', content: [{ type: 'text', text: 'γεια' }] }] };
    ok('αίτημα χωρίς προσωρινό αρχείο μένει ίδιο', await resolveStaged(plain, UID, fake({}, [])) && JSON.stringify(plain).includes('γεια'));
  }

  {
    // Το όριο του bucket είναι 50 MB: τόσο φτάνει και ο διακομιστής.
    ok('ο διακομιστής δέχεται έως 50 MB', STAGE_MAX_BYTES === 50 * 1024 * 1024);
    // ΤΡΙΑ ΣΗΜΕΙΑ, ΕΝΑ ΟΡΙΟ: ο κάδος (τελευταίο migration που τον αγγίζει), η
    // οθόνη και ο διακομιστής. Ηταν 8, 10 και 20 σε διαφορετικές οθόνες.
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = 'supabase/migrations';
    const last = readdirSync(dir).sort().reverse()
      .map(f => readFileSync(`${dir}/${f}`, 'utf8'))
      .find(t => /property-files/.test(t) && /file_size_limit\s*=\s*\d+/.test(t)) || '';
    const bucket = Number(last.match(/file_size_limit\s*=\s*(\d+)/)?.[1]);
    const scan = readFileSync('app/dashboard/components/scanDoc.ts', 'utf8');
    const mb = Number(scan.match(/export const MAX_SCAN_MB = (\d+)/)?.[1]);
    ok(`κάδος, οθόνη και διακομιστής λένε το ίδιο όριο (${bucket} · ${mb} MB · ${STAGE_MAX_BYTES})`,
      bucket === STAGE_MAX_BYTES && mb * 1024 * 1024 === STAGE_MAX_BYTES);
    // Πολυσέλιδο PDF: κρατά τις πρώτες SCAN_MAX_PAGES, χωρίς σφάλμα.
    const make = async (n: number) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([200, 200]); return d.save(); };
    const long = await firstPages(await make(SCAN_MAX_PAGES + 12));
    const kept = (await PDFDocument.load(long.bytes)).getPageCount();
    ok(`το πολυσέλιδο κρατά ${SCAN_MAX_PAGES} σελίδες (κράτησε ${kept})`, long.trimmed && kept === SCAN_MAX_PAGES && long.pages === SCAN_MAX_PAGES + 12);
    const short = await firstPages(await make(3));
    ok('το σύντομο μένει όπως είναι', !short.trimmed && short.pages === 3);
    const broken = await firstPages(new Uint8Array(Buffer.from('%PDF-1.7 χαλασμένο')));
    ok('το χαλασμένο περνά όπως είναι, χωρίς σφάλμα', !broken.trimmed && broken.pages === null);
    // Και ολόκληρη η διαδρομή: το staged πολυσέλιδο φτάνει στο αίτημα κομμένο.
    const removed: string[] = [];
    const body = bodyWith(good);
    const blob = new Blob([Buffer.from(await make(SCAN_MAX_PAGES + 5))]);
    ok('το πολυσέλιδο διαβάζεται', await resolveStaged(body, UID, fake({ [good]: blob }, removed)));
    const src = (body.messages[0].content[0] as { source: { data?: string } }).source;
    const sent = (await PDFDocument.load(Buffer.from(src.data || '', 'base64'))).getPageCount();
    ok(`και στέλνεται με ${SCAN_MAX_PAGES} σελίδες (${sent})`, sent === SCAN_MAX_PAGES);
  }

  console.log(`stagedFile: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
