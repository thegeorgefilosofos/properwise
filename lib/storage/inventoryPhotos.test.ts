// npx tsx lib/storage/inventoryPhotos.test.ts
//
// ΟΙ ΦΩΤΟΓΡΑΦΙΕΣ ΑΠΟΓΡΑΦΗΣ ΚΑΙ ΠΑΡΑΔΟΣΗΣ ΕΦΥΓΑΝ ΑΠΟ ΤΟ ΔΗΜΟΣΙΟ URL
// ─────────────────────────────────────────────────────────────────────────
// Ως τις 10/11/2026 στη βάση γραφόταν το μόνιμο δημόσιο URL κάθε φωτογραφίας.
// Τώρα γράφεται η διαδρομή και η προβολή υπογράφεται. Εδώ κλειδώνονται τρία:
// η διαδρομή από παλιό URL, η μία κλήση υπογραφής για όλες και η δήλωση της
// αποτυχίας, ώστε «δεν φορτώθηκε» να μη διαβάζεται ως «δεν υπάρχει φωτογραφία».
import { readFileSync } from 'node:fs';
import { inventoryPhotoPath, signInventoryPhotos, INVENTORY_PHOTOS_BUCKET } from './inventoryPhotos';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ── Η ΔΙΑΔΡΟΜΗ ────────────────────────────────────────────────────────────
ok('διαδρομή μένει διαδρομή', inventoryPhotoPath('uid-1/abc.jpg') === 'uid-1/abc.jpg');
ok('παλιό δημόσιο URL γίνεται διαδρομή',
  inventoryPhotoPath('https://x.supabase.co/storage/v1/object/public/inventory-photos/uid-1/handover/a.jpg') === 'uid-1/handover/a.jpg');
ok('χωρίς query string', inventoryPhotoPath('https://x.supabase.co/storage/v1/object/public/inventory-photos/uid-1/a.jpg?t=1') === 'uid-1/a.jpg');

// ── ΜΙΑ ΚΛΗΣΗ, ΜΕ ΤΙΣ ΔΙΑΔΡΟΜΕΣ, ΣΤΟ ΣΩΣΤΟ BUCKET ──────────────────────────
type Call = { bucket: string; paths: string[]; secs: number };
const fake = (calls: Call[], fail = false) => ({
  storage: {
    from: (bucket: string) => ({
      createSignedUrls: async (paths: string[], secs: number) => {
        calls.push({ bucket, paths, secs });
        return fail ? { data: null, error: { message: 'boom' } } : { data: paths.map(p => ({ signedUrl: `signed:${p}` })), error: null };
      },
    }),
  },
}) as never;

async function main() {
  {
    const calls: Call[] = [];
    const r = await signInventoryPhotos(fake(calls), ['uid-1/a.jpg', 'uid-1/a.jpg', '', 'https://x/storage/v1/object/public/inventory-photos/uid-1/b.jpg', 'https://example.com/c.jpg']);
    ok('μία κλήση για όλες', calls.length === 1);
    ok('στο ιδιωτικό bucket', calls[0]?.bucket === INVENTORY_PHOTOS_BUCKET);
    ok('διπλότυπα και κενά δεν υπογράφονται', calls[0]?.paths.join(',') === 'uid-1/a.jpg,uid-1/b.jpg');
    ok('λήξη μίας ώρας', calls[0]?.secs === 3600);
    ok('ο σύνδεσμος ανά αποθηκευμένη τιμή', r.urls['uid-1/a.jpg'] === 'signed:uid-1/a.jpg');
    ok('το παλιό URL βρίσκει τον υπογεγραμμένο του', r.urls['https://x/storage/v1/object/public/inventory-photos/uid-1/b.jpg'] === 'signed:uid-1/b.jpg');
    ok('ξένη διεύθυνση περνά όπως είναι', r.urls['https://example.com/c.jpg'] === 'https://example.com/c.jpg');
    ok('χωρίς σφάλμα', r.error === '');
  }
  {
    const calls: Call[] = [];
    const r = await signInventoryPhotos(fake(calls), []);
    ok('καμία φωτογραφία: καμία κλήση', calls.length === 0 && r.error === '');
  }
  {
    const calls: Call[] = [];
    const orig = console.error; console.error = () => {};
    const r = await signInventoryPhotos(fake(calls, true), ['uid-1/a.jpg']);
    console.error = orig;
    ok('αποτυχία υπογραφής δηλώνεται', r.error.length > 0 && !r.urls['uid-1/a.jpg']);
  }

  // ── ΚΑΝΕΝΑ ΣΗΜΕΙΟ ΔΕΝ ΓΡΑΦΕΙ ΠΙΑ ΔΗΜΟΣΙΟ URL ─────────────────────────────
  for (const f of ['app/dashboard/components/inventory/HandoverTab.tsx', 'app/dashboard/components/inventory/ItemFormModal.tsx']) {
    const src = readFileSync(f, 'utf8');
    ok(`${f}: χωρίς getPublicUrl`, !src.includes('getPublicUrl'));
    ok(`${f}: προβολή με υπογραφή`, src.includes('useInventoryPhotoUrls'));
  }
  ok('η έκθεση ασφαλιστή παίρνει υπογεγραμμένους', readFileSync('app/dashboard/components/inventory/exports.tsx', 'utf8').includes('photoUrls['));
  ok('ο φάκελος ακινήτου υπογράφει', readFileSync('app/dashboard/components/TabDocuments.tsx', 'utf8').includes('signInventoryPhotos('));
}

main().then(() => {
  console.log(`inventoryPhotos — ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
  console.log('✓ όλα πέρασαν');
}).catch(e => { console.error(e); process.exit(1); });
