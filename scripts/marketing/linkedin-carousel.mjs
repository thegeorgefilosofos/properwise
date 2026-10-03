// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ CAROUSEL ΤΗΣ ΠΡΩΤΗΣ ΑΝΑΡΤΗΣΗΣ ΣΤΟ LINKEDIN, ΣΤΑ ΕΛΛΗΝΙΚΑ (28.09.2026)
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις κάθετες διαφάνειες 4:5 και ένα PDF που τις ενώνει: το LinkedIn
// δείχνει το PDF ως carousel που σύρεται, ενώ πολλές εικόνες τις δείχνει ως
// πλέγμα. Η ιστορία ακολουθεί την ανάρτηση «Τα ’χω όλα σε ένα Excel»:
//   1. Το προϊόν σε μία εικόνα.   2. Το Excel που σταματά τον Μάρτιο.
//   3. Μία φωτογραφία, στη θέση της.   4. Φάκελος για τον λογιστή, όχι άγχος.
// Κεφαλαία χωρίς τόνους (lang="el" και text-transform). Κανένα ποσό.
//
// Τρέξε: npx tsx scripts/marketing/linkedin-carousel.mjs
// (με tsx, γιατί η δοκιμή και το δωρεάν πακέτο διαβάζονται από το lib/billing/plans.ts)
//
// ΔΙΟΡΘΩΣΕΙΣ ΠΡΙΝ ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΑΝΑΡΤΗΣΗ ΣΤΟ INSTAGRAM (03.10.2026):
//   · Η κάρτα του εξωφύλλου έγραφε «Σε τάξη» και «Δήλωση Ε2 έτοιμη» ενώ η Νόα
//     δίπλα έλεγε «λείπει το ΑΦΜ»: η ίδια εικόνα αντέλεγε στον εαυτό της.
//   · Το «Δωρεάν για ένα ακίνητο» στεκόταν κάτω από τη Νόα, που το δωρεάν
//     πακέτο δεν έχει. Η Νόα λέγεται με τη δοκιμή της.
//   · «Σας συστήνουμε» στον πληθυντικό, ενώ όλο το υπόλοιπο μιλά στον ενικό.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { PLANS } from '../../lib/billing/plans.ts';
// «ΞΕΚΙΝΑΣ ΔΩΡΕΑΝ, ΧΩΡΙΣ ΚΡΥΦΕΣ ΧΡΕΩΣΕΙΣ» (03.10.2026, απόφαση ιδιοκτήτη).
// Μία γραμμή αντί για δύο προσφορές. Στέκει όσο ισχύουν δύο πράγματα: το
// δωρεάν πακέτο δεν ζητά ποτέ μέσο πληρωμής και οι τιμές των συνδρομών
// περιλαμβάνουν ΦΠΑ και φαίνονται στο ταμείο πριν από την επιβεβαίωση
// (app/terms, app/paketa). Αν αλλάξει το πρώτο, η μηχανή σταματά εδώ.
if (PLANS.free.priceMonthly !== 0) throw new Error('Το «Ξεκινάς δωρεάν» θέλει δωρεάν πακέτο.');
const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = join(ROOT, 'docs/marketing/profil/carousel');
fs.mkdirSync(OUT, { recursive: true });
const f = n => 'data:font/woff2;base64,' + fs.readFileSync(`${R}/fonts/${n}`).toString('base64');
const img = n => 'data:image/png;base64,' + fs.readFileSync(`${R}/brand/${n}`).toString('base64');
const LOGO = img('properwise-logotypo-lefko.png');
// Τσεκ σε CSS: ο φύλακας brand-mark δεν δέχεται χειροποίητο SVG εκτός BrandMark.
const tick = (c = '#52c79e', s = 1) => `<i style="display:inline-block;width:${9*s}px;height:${17*s}px;margin:0 ${14*s}px ${5*s}px ${4*s}px;border:solid ${c};border-width:0 ${4*s}px ${4*s}px 0;transform:rotate(45deg);flex:none"></i>`;

const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 78%, rgba(21,96,212,.42), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(720px 600px at 62% 72%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.pad{position:absolute;inset:0;padding:76px 80px 70px;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:center}
.head img{height:30px;display:block}
.prog{display:flex;gap:8px}.prog b{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}
.eyebrow{margin-top:78px;font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:26px;font-size:100px;line-height:.98;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:30px;font-size:31px;line-height:1.38;color:#aebbd0;max-width:880px;letter-spacing:-.012em;text-wrap:pretty}
.sub b{color:#f1f5fc;font-weight:650}
.stage{flex:1;position:relative;margin:44px 0 34px}
.card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.92),rgba(14,24,42,.94));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12);padding:34px 36px}
.lbl{font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:18px}
.pill{font-size:20px;font-weight:650;padding:8px 18px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
.pill:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.ok{color:#5fd4a8;background:rgba(82,199,158,.14)} .bl{color:#9ec0ff;background:rgba(138,180,248,.15)} .wa{color:#f0c97d;background:rgba(229,192,123,.15)}
.t{font-size:29px;font-weight:700;letter-spacing:-.018em}
.li{display:flex;align-items:center;font-size:25px;color:#d6dfec;letter-spacing:-.01em}
.noa{flex:none;width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#9ec0ff,#1560d4);display:grid;place-items:center;font-size:26px;font-weight:800;box-shadow:0 8px 24px rgba(21,96,212,.5)}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid rgba(255,255,255,.1)}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
`;
const frame = (n, eyebrow, h1, sub, stage, foot) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${[1,2,3,4].map(i=>`<b class="${i===n?'on':''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><div class="sub">${sub}</div>
<div class="stage">${stage}</div>
<div class="foot">${foot ?? `<div class="url">properwise.gr</div>`}</div></div></body></html>`;

const slides = [
// 1 · Το εξώφυλλο: το ακίνητο, τακτοποιημένο
frame(1, 'Γνωρισε το PROPERWISE',
 'Βάλε το ακίνητό σου<br><span class="a">σε τάξη.</span>',
 'Φόροι, έξοδα και έγγραφα σε ένα σημείο. <b>Έτοιμα όταν τα ζητήσει ο λογιστής σου.</b>', `
 <div class="card" style="left:70px;right:0;top:0;padding:34px 40px 36px">
  <div class="row"><div><div class="lbl">Το ακίνητό σου</div><div class="t" style="margin-top:10px;font-size:34px">Διαμέρισμα · Κέντρο</div></div><span class="pill ok">Σε τάξη</span></div>
  <div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
   ${[['Έξοδα','Ταξινομημένα','ok'],['Δήλωση Ε2','Έτοιμη','ok'],['ΕΝΦΙΑ','Ελέγχθηκε','bl']].map(([l,v,c])=>`
   <div style="border-radius:20px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);padding:22px 22px 24px">
    <div class="lbl" style="font-size:15px">${l}</div>
    <div style="margin-top:14px;display:flex;align-items:center;font-size:24px;font-weight:650">${tick(c==='ok'?'#5fd4a8':'#9ec0ff',.9)}${v}</div></div>`).join('')}
  </div>
 </div>
 <div class="card" style="left:0;top:262px;width:470px;transform:rotate(-2.5deg);padding:28px 30px">
  <div class="lbl">Σαρώθηκε τώρα</div>
  <div class="t" style="margin-top:10px">Λογαριασμός ρεύματος</div>
  <div style="margin-top:16px"><span class="pill ok">Στη θέση του</span></div>
 </div>
 <div class="card" style="right:0;top:292px;width:480px;display:flex;gap:18px;align-items:flex-start;padding:28px 30px">
  <div class="noa">Ν</div>
  <div style="font-size:23px;line-height:1.42;color:#e3eaf5"><div style="color:#9ec0ff;font-weight:700;margin-bottom:4px">Νόα</div>Η επόμενη δόση του ΕΝΦΙΑ λήγει στο τέλος του μήνα. Θα σου το θυμίσω πριν.</div>
 </div>`),

// 2 · Το Excel που σταματά τον Μάρτιο
frame(2, 'Το ακουμε συνεχεια',
 '«Τα ’χω όλα<br>σε ένα <span class="a">Excel</span>.»',
 'Και σχεδόν πάντα, το Excel έχει σταματήσει τον Μάρτιο.', `
 <div class="card" style="left:0;right:0;top:10px;padding:0;overflow:hidden;background:linear-gradient(180deg,rgba(22,34,56,.96),rgba(12,20,36,.97))">
  <div style="display:flex;align-items:center;gap:18px;padding:18px 24px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)">
   <div style="display:flex;gap:9px">${['#ff5f57','#febc2e','#28c840'].map(c=>`<i style="width:14px;height:14px;border-radius:50%;background:${c};opacity:.85"></i>`).join('')}</div>
   <div style="font-family:Mono,monospace;font-size:18px;color:#7d8da6">ακίνητο_ΤΕΛΙΚΟ_v3.xlsx</div>
  </div>
  <div style="display:flex;align-items:center;gap:16px;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,.08);font-family:Mono,monospace;font-size:18px">
   <span style="color:#7d8da6;font-style:italic">fx</span><span style="color:#aebbd0">=ΑΘΡΟΙΣΜΑ(B2:B4)</span></div>
  <div style="display:grid;grid-template-columns:56px 210px 1fr 1fr 1fr;font-size:23px">
   ${['','A','B','C','D'].map(h=>`<div style="padding:10px 0;text-align:center;font-family:Mono,monospace;font-size:16px;color:#6a7a92;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.08);border-right:1px solid rgba(255,255,255,.05)">${h}</div>`).join('')}
   ${[['Μήνας','Ρεύμα','Νερό','Κοινόχρηστα']].concat(['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος'].map(m=>[m])).map((r,i)=>{
     const hdr=i===0, done=i>0&&i<4, fade=i>=4?Math.max(.18,.62-(i-4)*.14):1;
     const num=`<div style="padding:17px 0;text-align:center;font-family:Mono,monospace;font-size:16px;color:#6a7a92;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.05);border-right:1px solid rgba(255,255,255,.05)">${i+1}</div>`;
     const cellStyle='padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.05);border-right:1px solid rgba(255,255,255,.05)';
     if(hdr) return num+r.map(x=>`<div style="${cellStyle};font-weight:700;color:#d6dfec">${x}</div>`).join('');
     const cells=[0,1,2].map(k=>done?`<div style="${cellStyle};display:flex;align-items:center;color:#5fd4a8;font-size:21px">${tick('#5fd4a8',.7)}Πληρώθηκε</div>`
       :(i===4&&k===0)?`<div style="${cellStyle};box-shadow:inset 0 0 0 3px #3d7ef0;background:rgba(61,126,240,.1)"><i style="display:inline-block;width:2px;height:26px;background:#9ec0ff;vertical-align:middle"></i></div>`
       :`<div style="${cellStyle};opacity:${fade}"></div>`).join('');
     return num+`<div style="${cellStyle};color:${done?'#f1f5fc':'#6a7a92'};opacity:${done?1:fade}">${r[0]}</div>`+cells;
   }).join('')}
  </div>
 </div>
 <div style="position:absolute;right:26px;bottom:24px;width:330px;padding:26px 28px 30px;background:#f3d77e;color:#3b2f0a;transform:rotate(3.5deg);box-shadow:0 30px 60px rgba(0,0,0,.55);border-radius:4px 4px 18px 4px;font-size:27px;line-height:1.3;font-weight:650;letter-spacing:-.01em">
  «Θα τα περάσω<br>το βράδυ.»<div style="margin-top:12px;font-size:19px;font-weight:500;opacity:.7">Σημείωση από τον Απρίλιο</div></div>`),

// 3 · Μία φωτογραφία
frame(3, 'Πως δουλευει',
 'Μία φωτογραφία.<br><span class="a">Στη θέση της.</span>',
 'Φωτογραφίζεις τον λογαριασμό, τον ελέγχεις με μια ματιά και μπαίνει εκεί που πρέπει. <b>Δεν χρειάζεται πειθαρχία.</b>', `
 <div style="position:absolute;left:10px;top:0;width:350px;height:640px;border-radius:56px;background:#0a1222;border:2px solid rgba(255,255,255,.16);box-shadow:0 50px 100px rgba(0,0,0,.65),inset 0 0 0 8px #111b2e;transform:rotate(-4deg);padding:26px 22px">
  <div style="width:110px;height:30px;border-radius:20px;background:#050910;margin:0 auto"></div>
  <div style="position:relative;margin:30px 10px 0;height:430px;border-radius:14px;background:linear-gradient(180deg,#f4f6fa,#e4e9f1);padding:28px 24px;color:#1a2332">
   <div style="font-size:17px;font-weight:800;letter-spacing:.06em">ΛΟΓΑΡΙΑΣΜΟΣ</div>
   <div style="font-size:15px;color:#5a6679;margin-top:4px">Ηλεκτρικό ρεύμα</div>
   ${[80,64,72,50,68,58].map(w=>`<div style="margin-top:18px;height:10px;width:${w}%;border-radius:5px;background:#c9d1dd"></div>`).join('')}
   <div style="margin-top:30px;height:22px;width:46%;border-radius:6px;background:#1a2332;opacity:.85"></div>
   ${[['top:-10px;left:-10px','border-width:5px 0 0 5px'],['top:-10px;right:-10px','border-width:5px 5px 0 0'],['bottom:-10px;left:-10px','border-width:0 0 5px 5px'],['bottom:-10px;right:-10px','border-width:0 5px 5px 0']].map(([pos,bw])=>`<i style="position:absolute;${pos};width:44px;height:44px;border:solid #5f9bff;${bw};border-radius:6px"></i>`).join('')}
   <i style="position:absolute;left:-6px;right:-6px;top:58%;height:3px;background:#5f9bff;box-shadow:0 0 22px 6px rgba(95,155,255,.6)"></i>
  </div>
  <div style="margin:34px auto 0;width:78px;height:78px;border-radius:50%;border:5px solid rgba(255,255,255,.85);display:grid;place-items:center"><i style="width:56px;height:56px;border-radius:50%;background:#fff"></i></div>
 </div>
 <div style="position:absolute;left:372px;top:300px;font-size:44px;color:#5f9bff;text-shadow:0 0 20px rgba(95,155,255,.8)">→</div>
 <div class="card" style="right:0;top:26px;width:500px;padding:14px 34px">
  ${[['Διαβάστηκε','Λογαριασμός ρεύματος','ok'],['Ακίνητο','Διαμέρισμα · Κέντρο','ok'],['Κατηγορία','Έξοδα · Λογαριασμοί','ok'],['Φάκελος λογιστή','Φορολογική χρονιά','bl']].map(([l,t,c],i)=>`
  <div style="padding:26px 0;${i?'border-top:1px solid rgba(255,255,255,.08)':''};display:flex;align-items:center;gap:22px">
   <div style="flex:none;width:48px;height:48px;border-radius:50%;background:${c==='bl'?'rgba(138,180,248,.16)':'rgba(82,199,158,.16)'};display:grid;place-items:center">${tick(c==='bl'?'#9ec0ff':'#5fd4a8',.75).replace('margin:0 10.5px 3.75px 3px','margin:0 0 5px 0')}</div>
   <div><div class="lbl" style="font-size:15px">${l}</div><div style="margin-top:8px;font-size:26px;font-weight:700;letter-spacing:-.015em">${t}</div></div></div>`).join('')}
 </div>
 <div style="position:absolute;right:0;bottom:24px;width:500px;text-align:center;font-family:Mono,monospace;font-size:19px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase">Χωρις πληκτρολογηση</div>`),

// 4 · Φάκελος, όχι άγχος
frame(4, 'Για τον λογιστη σου',
 'Φάκελος,<br><span class="a">όχι άγχος.</span>',
 'Φτάνεις στο ραντεβού με τα χαρτιά σου οργανωμένα. <b>Το τελικό ποσό μένει δουλειά του λογιστή.</b>', `
 <div style="position:absolute;left:0;top:30px;width:560px;height:520px;transform:rotate(-2deg)">
  <div style="position:absolute;left:0;top:0;width:220px;height:60px;border-radius:22px 22px 0 0;background:linear-gradient(180deg,#2a62c9,#1d4fae)"></div>
  <div style="position:absolute;left:44px;right:44px;top:22px;height:120px;border-radius:14px;background:#e9eef6;transform:rotate(2.5deg);box-shadow:0 10px 30px rgba(0,0,0,.35)"></div>
  <div style="position:absolute;left:28px;right:60px;top:34px;height:120px;border-radius:14px;background:#f7f9fc;transform:rotate(-1.5deg);box-shadow:0 10px 30px rgba(0,0,0,.35)"></div>
  <div style="position:absolute;left:0;right:0;top:52px;bottom:0;border-radius:0 26px 26px 26px;background:linear-gradient(180deg,#2f6fe0 0%,#1a4aa6 100%);box-shadow:0 50px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.3);padding:44px 40px">
   <div class="row"><div style="font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:rgba(255,255,255,.72);text-transform:uppercase">Φάκελος λογιστή</div><span class="pill" style="background:rgba(255,255,255,.18);color:#fff">Έτοιμος</span></div>
   <div style="margin-top:14px;font-size:34px;font-weight:800;letter-spacing:-.02em">Φορολογική χρονιά</div>
   <div style="margin-top:28px;display:flex;flex-direction:column;gap:18px">
    ${['Ενοίκια και έξοδα','Παραστατικά ανά κατηγορία','Ίδια δομή κάθε χρονιά'].map(x=>`<div class="li" style="color:#fff">${tick('#bff0dc')}${x}</div>`).join('')}
   </div>
  </div>
 </div>
 <div class="card" style="right:0;top:250px;width:470px;display:flex;flex-direction:column;gap:18px;padding:30px">
  <div class="lbl">Ρώτα τη Νόα</div>
  <div style="align-self:flex-end;background:#1560d4;border-radius:22px 22px 6px 22px;padding:16px 22px;font-size:23px;font-weight:550">Τι λείπει για το Ε2;</div>
  <div style="display:flex;gap:14px;align-items:flex-start"><div class="noa" style="width:46px;height:46px;font-size:20px">Ν</div>
   <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:6px 22px 22px 22px;padding:16px 20px;font-size:23px;line-height:1.4;color:#e3eaf5">Μόνο το ΑΦΜ του ενοικιαστή. Τα υπόλοιπα είναι στον φάκελο.</div></div>
 </div>`,
 `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Βάλε το ακίνητό σου σε τάξη.</div><div style="font-size:22px;line-height:1.35;color:#aebbd0">Ξεκινάς δωρεάν, χωρίς κρυφές χρεώσεις.</div></div>
  <div style="padding:20px 30px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:24px;font-weight:700;display:flex;align-items:center;gap:14px">properwise.gr <span>→</span></div>`),
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
