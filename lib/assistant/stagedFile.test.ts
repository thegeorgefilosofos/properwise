// Το μεγάλο PDF περνά από τον χώρο αρχείων: μόνο του ίδιου χρήστη, μόνο PDF,
// σβήνεται μόλις διαβαστεί και γίνεται base64 πριν από τον μετρητή.
import { stagedPathOk, stagePathFor, resolveStaged, STAGE_MAX_BYTES } from './stagedFile';
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

  console.log(`stagedFile: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
