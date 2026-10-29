// npx tsx lib/tools/e2Odigos.test.ts
// Ο δημόσιος οδηγός του Ε2 λέει ό,τι η μηχανή Ε2 του λογιστή, για το ίδιο ακίνητο.
import { e2Guide } from './e2Odigos';
import { E2_COLUMNS, E2_USE } from '@/lib/billing/e2';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const col = (g: ReturnType<typeof e2Guide>, no: number) => g.cells.find(c => c.no === no)?.value;

// ── Κατοικία, από τον Μάρτιο, μισή ─────────────────────────────────────────
const home = e2Guide({ year: 2025, propType: 'apartment', use: 'lease', leaseCategory: 'residential', monthly: 600, from: '2025-03-01', ownershipPct: 50, sqm: 70 });
eq(home.cells.map(c => c.no), E2_COLUMNS.map(c => c.no), 'όλες οι στήλες, με τη σειρά του εντύπου');
eq(col(home, 17), E2_USE.homeLease, 'στ. 17: μακροχρόνια μίσθωση κατοικίας');
eq(col(home, 8), '01/03/2025', 'στ. 8: από');
eq(col(home, 9), '31/12/2025', 'στ. 9: έως');
eq(col(home, 10), '10', 'στ. 10: δέκα μήνες');
eq(col(home, 11), '600', 'στ. 11: το μηνιαίο μίσθωμα');
eq(col(home, 12), '50', 'στ. 12: το ποσοστό');
eq(home.gross, 3000, 'ακαθάριστο: 600 × 10 × 50%');
eq(col(home, 13), '3000', 'στ. 13: το ακαθάριστο του μεριδίου');
eq(home.e1.lines.map(l => [l.code, l.spouseCode]), [['103', '104']], 'Ε1: κατοικία στον 103/104');

// ── Κατάστημα, όλο τον χρόνο ────────────────────────────────────────────────
const shop = e2Guide({ year: 2025, propType: 'shop', use: 'lease', leaseCategory: 'commercial', monthly: 1000 });
eq(col(shop, 17), E2_USE.businessLease, 'στ. 17: επαγγελματικός χώρος');
eq(shop.gross, 12000, 'δώδεκα μήνες');
eq(shop.e1.lines.map(l => l.code), ['105'], 'Ε1: κατάστημα στον 105');

// ── Κενό και ιδιοχρησιμοποίηση: χωρίς ποσό, χωρίς κωδικό ───────────────────
const vac = e2Guide({ year: 2025, propType: 'apartment', use: 'vacant' });
eq(col(vac, 17), E2_USE.vacant, 'κενό: «ΚΕΝΟ»');
eq([vac.gross, vac.e1.lines.length], [0, 0], 'κενό: μηδέν, κανένας κωδικός');
const own = e2Guide({ year: 2025, propType: 'apartment', use: 'own_use' });
eq(col(own, 17), E2_USE.ownUse, 'ιδιοχρησιμοποίηση');
eq(own.e1.lines.length, 0, 'ιδιοχρησιμοποίηση: κανένας κωδικός');

// ── Διάστημα έξω από το έτος ──────────────────────────────────────────────
const later = e2Guide({ year: 2025, propType: 'apartment', use: 'lease', monthly: 500, from: '2026-02-01' });
eq(later.gross, 0, 'μίσθωση που αρχίζει μετά το έτος: μηδέν ακαθάριστο');

console.log(`e2Odigos: ${p} ✓ · ${f} ✗`);
if (f) process.exit(1);
