// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ CAROUSEL ΤΗΣ ΠΡΩΤΗΣ ΑΝΑΡΤΗΣΗΣ ΣΤΟ LINKEDIN, ΣΤΑ ΕΛΛΗΝΙΚΑ (28.09.2026)
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις κάθετες διαφάνειες 4:5 και ένα PDF που τις ενώνει: το LinkedIn
// δείχνει το PDF ως carousel που σύρεται, ενώ πολλές εικόνες τις δείχνει ως
// πλέγμα. Η ιστορία ακολουθεί την ανάρτηση «Το έχω όλο σε ένα Excel»:
//   1. Το προϊόν σε μία εικόνα.   2. Το Excel που σταματά τον Μάρτιο.
//   3. Μία φωτογραφία, στη θέση της.   4. Φάκελος για τον λογιστή, όχι άγχος.
// Κεφαλαία χωρίς τόνους (lang="el" και text-transform). Κανένα ποσό.
//
// Τρέξε: node scripts/marketing/linkedin-carousel.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = join(ROOT, 'docs/marketing/profil/carousel');
fs.mkdirSync(OUT, { recursive: true });
const f = n => 'data:font/woff2;base64,' + fs.readFileSync(`${R}/fonts/${n}`).toString('base64');
const tick = `<i style="display:inline-block;width:7px;height:13px;margin:0 8px 4px 2px;border:solid #52c79e;border-width:0 3px 3px 0;transform:rotate(45deg);flex:none"></i>`;

const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#eef3fb;-webkit-font-smoothing:antialiased;position:relative;
 background:radial-gradient(700px 520px at 80% 60%, rgba(21,96,212,.32), transparent 70%),
  radial-gradient(620px 420px at 0% 0%, rgba(138,180,248,.14), transparent 70%),
  linear-gradient(170deg,#0c1526 0%,#080d16 65%,#070b12 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px;
 mask-image:radial-gradient(640px 520px at 60% 64%,#000 15%,transparent 78%)}
.pad{position:absolute;inset:0;padding:84px 84px 76px;display:flex;flex-direction:column}
.brand{display:flex;justify-content:space-between;align-items:center}
.word{font-size:24px;font-weight:800;letter-spacing:.02em}
.eyebrow{font-family:Mono,monospace;font-size:17px;letter-spacing:.22em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:12px}
.eyebrow i{width:9px;height:9px;border-radius:50%;background:#8ab4f8;box-shadow:0 0 14px #8ab4f8}
h1{margin-top:56px;font-size:76px;line-height:1.04;font-weight:800;letter-spacing:-.04em;text-wrap:balance}
h1 .a{color:#8ab4f8}
.sub{margin-top:26px;font-size:28px;line-height:1.42;color:#a9b7cc;max-width:860px;letter-spacing:-.01em;text-wrap:pretty}
.stage{flex:1;margin-top:36px;display:flex;flex-direction:column;justify-content:center}
.card{position:relative;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.13);
 box-shadow:0 30px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.09);padding:32px 30px}
.lbl{font-family:Mono,monospace;font-size:14px;letter-spacing:.14em;color:#6f7f96;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.pill{font-size:16px;font-weight:650;padding:6px 14px;border-radius:99px;white-space:nowrap}
.ok{color:#52c79e;background:rgba(82,199,158,.14)} .bl{color:#8ab4f8;background:rgba(138,180,248,.14)} .wa{color:#e5c07b;background:rgba(229,192,123,.14)}
.t{font-size:24px;font-weight:650;letter-spacing:-.01em}
.li{display:flex;align-items:center;font-size:20px;color:#cfd9e8}
.foot{display:flex;justify-content:space-between;align-items:flex-end;padding-top:26px;border-top:1px solid rgba(255,255,255,.09)}
.promise{font-size:24px;font-weight:650} .promise span{color:#a9b7cc;font-weight:500}
.url{font-family:Mono,monospace;font-size:20px;letter-spacing:.06em;color:#8ab4f8}
.page{font-family:Mono,monospace;font-size:17px;letter-spacing:.14em;color:#6f7f96}
.noa{flex:none;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#8ab4f8,#1560d4);display:grid;place-items:center;font-size:24px;font-weight:800}
`;
const frame = (n, eyebrow, body, foot) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="grid"></div>
<div class="pad"><div class="brand"><div class="eyebrow"><i></i>${eyebrow}</div><div class="word">PROPERWISE</div></div>
${body}
<div class="foot">${foot ?? `<div class="page">${n} / 4</div><div class="url">properwise.gr</div>`}</div></div></body></html>`;

const slides = [
// 1 · Το προϊόν σε μία εικόνα
frame(1, 'Σας συστηνουμε', `
 <h1>Βάλε το ακίνητό σου<br><span class="a">σε τάξη.</span></h1>
 <div class="sub">Φόροι, έξοδα και έγγραφα σε ένα σημείο, έτοιμα όταν τα ζητήσει ο λογιστής σου.</div>
 <div class="stage"><div style="display:grid;grid-template-columns:1fr 1fr;gap:46px 30px">
  <div class="card" style="transform:rotate(-1.6deg) translateY(10px)">
   <div class="lbl">Σαρωμένο</div>
   <div class="row" style="margin-top:12px"><span class="t">Λογαριασμός ρεύματος</span></div>
   <div style="margin-top:16px;height:8px;border-radius:6px;background:rgba(255,255,255,.08)"><div style="width:100%;height:100%;border-radius:6px;background:linear-gradient(90deg,#1560d4,#8ab4f8)"></div></div>
   <div class="row" style="margin-top:14px;font-size:17px;color:#a9b7cc"><span>Έξοδα · Λογαριασμοί</span><span class="pill ok">Στη θέση του</span></div>
  </div>
  <div class="card">
   <div class="row"><span class="lbl">Δήλωση · Ε2</span><span class="pill ok">Έτοιμο</span></div>
   <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
    <div class="li">${tick}Ενοίκια</div><div class="li">${tick}Εκπιπτόμενα έξοδα</div><div class="li">${tick}Δήλωση μίσθωσης</div>
   </div>
  </div>
  <div class="card" style="transform:rotate(1deg)">
   <div class="row"><span class="lbl">ΕΝΦΙΑ</span><span class="pill bl">Ελέγχθηκε</span></div>
   <div style="margin-top:14px;font-size:19px;line-height:1.45;color:#cfd9e8">Από τα δικά σου στοιχεία, με τις εκπτώσεις που δικαιούσαι.</div>
  </div>
  <div class="card" style="display:flex;gap:18px;align-items:flex-start;transform:translateY(14px)">
   <div class="noa">Ν</div>
   <div style="font-size:19px;line-height:1.45;color:#dfe7f3"><span style="color:#8ab4f8;font-weight:650">Νόα</span> · Λείπει μόνο το ΑΦΜ του ενοικιαστή. Τα υπόλοιπα για το Ε2 είναι στη θέση τους.</div>
  </div>
 </div></div>`),

// 2 · Το Excel που σταματά τον Μάρτιο
frame(2, 'Το ακουμε συνεχεια', `
 <h1>«Το έχω όλο<br>σε ένα <span class="a">Excel</span>.»</h1>
 <div class="sub">Και σχεδόν πάντα, το Excel έχει σταματήσει τον Μάρτιο. Ένας λογαριασμός στο συρτάρι, μια απόδειξη σε φωτογραφία, ένα «θα το περάσω το βράδυ».</div>
 <div class="stage"><div class="card" style="padding:0;overflow:hidden">
  <div style="display:grid;grid-template-columns:170px 1fr 1fr 1fr;font-size:18px">
   ${['Μήνας','Ρεύμα','Νερό','Κοινόχρηστα'].map(h=>`<div style="padding:18px 22px;background:rgba(255,255,255,.05);font-family:Mono,monospace;font-size:14px;letter-spacing:.14em;color:#6f7f96;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.08)">${h}</div>`).join('')}
   ${['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος'].map((m,i)=>{
      const done=i<3;
      const cell=(x)=>`<div style="padding:17px 22px;border-bottom:1px solid rgba(255,255,255,.06);${done?'':'opacity:'+(0.5-i*0.07)}">${done?`<span style="display:inline-block;width:${x}%;height:10px;border-radius:5px;background:linear-gradient(90deg,#1560d4,#8ab4f8)"></span>`:`<span style="display:inline-block;width:70%;height:10px;border-radius:5px;border:1px dashed rgba(169,183,204,.35)"></span>`}</div>`;
      return `<div style="padding:17px 22px;border-bottom:1px solid rgba(255,255,255,.06);color:${done?'#eef3fb':'#6f7f96'}">${m}</div>`+cell(78)+cell(54)+cell(66);
   }).join('')}
  </div>
  <div class="row" style="padding:20px 22px;background:rgba(229,192,123,.07)"><span style="font-size:19px;color:#e5c07b">Από τον Απρίλιο, κενό.</span><span class="pill wa">Μάιος: ψάχνεις το Ε9</span></div>
 </div></div>`),

// 3 · Μία φωτογραφία
frame(3, 'Πως δουλευει', `
 <h1>Μία φωτογραφία.<br><span class="a">Στη θέση της.</span></h1>
 <div class="sub">Φωτογραφίζεις τον λογαριασμό, ελέγχεις με μια ματιά και μπαίνει εκεί που πρέπει. Δεν χρειάζεται πειθαρχία.</div>
 <div class="stage"><div class="card" style="padding:34px 36px">
  ${[
    ['Φωτογραφία','Λογαριασμός ρεύματος','Διαβάστηκε','ok'],
    ['Ακίνητο','Διαμέρισμα, Κέντρο','Αναγνωρίστηκε','ok'],
    ['Κατηγορία','Έξοδα · Λογαριασμοί','Ταξινομήθηκε','ok'],
    ['Φάκελος λογιστή','Φορολογική χρονιά','Έτοιμο','bl'],
  ].map(([l,t,p,c],i)=>`<div class="row" style="padding:22px 0;${i?'border-top:1px solid rgba(255,255,255,.08)':''}">
     <div style="display:flex;align-items:center;gap:22px"><div style="width:40px;height:40px;border-radius:50%;border:2px solid ${c==='bl'?'#8ab4f8':'#52c79e'};display:grid;place-items:center;font-family:Mono,monospace;font-size:16px;color:${c==='bl'?'#8ab4f8':'#52c79e'}">${i+1}</div>
     <div><div class="lbl">${l}</div><div class="t" style="margin-top:6px">${t}</div></div></div>
     <span class="pill ${c}">${p}</span></div>`).join('')}
 </div></div>`),

// 4 · Φάκελος, όχι άγχος
frame(4, 'Για τον λογιστη σου', `
 <h1>Φάκελος,<br><span class="a">όχι άγχος.</span></h1>
 <div class="sub">Φτάνεις στο ραντεβού με τα χαρτιά σου στη σειρά. Το τελικό νούμερο μένει δουλειά του λογιστή. Το χάος, όχι.</div>
 <div class="stage"><div style="display:grid;grid-template-columns:1.1fr 1fr;gap:30px;align-items:start">
  <div class="card" style="transform:rotate(-1.2deg)">
   <div class="row"><span class="lbl">Φάκελος λογιστή</span><span class="pill ok">Έτοιμος</span></div>
   <div style="margin-top:18px;display:flex;flex-direction:column;gap:13px">
    <div class="li">${tick}Ενοίκια και έξοδα</div><div class="li">${tick}Παραστατικά ανά κατηγορία</div><div class="li">${tick}Ίδια δομή κάθε χρονιά</div>
   </div>
   <div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)" class="row"><span style="font-size:18px;color:#e5c07b">Τι λείπει: ΑΦΜ ενοικιαστή</span></div>
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:16px;transform:translateY(40px)">
   <div class="lbl">Ρώτα τη Νόα</div>
   <div style="align-self:flex-end;background:#1560d4;border-radius:18px 18px 6px 18px;padding:14px 18px;font-size:18px">Πόσο ΕΝΦΙΑ θα πληρώσω φέτος;</div>
   <div style="display:flex;gap:12px;align-items:flex-start"><div class="noa" style="width:40px;height:40px;font-size:18px">Ν</div>
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:6px 18px 18px 18px;padding:14px 18px;font-size:18px;line-height:1.4;color:#dfe7f3">Βλέπεις την τάξη μεγέθους από τα δικά σου στοιχεία. Το τελικό, με τον λογιστή σου.</div></div>
  </div>
 </div></div>`,
 `<div class="promise">Βάλε το ακίνητό σου σε τάξη. <span>Δωρεάν για ένα ακίνητο.</span></div><div class="url">properwise.gr</div>`),
];

const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
const files = [];
for (const [i, html] of slides.entries()) {
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const file = join(OUT, `properwise-carousel-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await b.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, 'properwise-carousel.pdf'), width: '1080px', height: '1350px', printBackground: true });
await b.close();
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
