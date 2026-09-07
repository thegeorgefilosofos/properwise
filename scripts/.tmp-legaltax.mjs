import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.mjs';

const URL='file:///home/user/property/.perf-bench/mobile.html?c=tenant';
const W=[430,768,834,1024,1280];

const b=await chromium.launch({ executablePath:chromePath(), args:['--no-sandbox'] });
for(const w of W){
  const p=await b.newPage({ viewport:{ width:w, height:1000 }, deviceScaleFactor:1 });
  await p.goto(URL,{ waitUntil:'load' });
  await p.waitForTimeout(1200);
  // κλικ στην καρτέλα «Νομικά και Φόρος»
  try{
    const t=p.getByText('Νομικά και Φόρος',{ exact:false }).first();
    await t.click({ timeout:5000 });
  }catch(e){ console.log(w,'ΔΕΝ ΒΡΕΘΗΚΕ Η ΚΑΡΤΕΛΑ', e.message.split('\n')[0]); }
  await p.waitForTimeout(800);
  const r=await p.evaluate(()=>{
    const out={};
    const heads=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/Φόρος εισοδήματος από ενοίκια/.test(e.textContent||''));
    if(!heads.length) return { err:'δεν βρέθηκε ο τίτλος του πίνακα κλιμακίων' };
    let card=heads[0];
    while(card&&!(card.parentElement&&getComputedStyle(card.parentElement).display==='grid'&&/280px|1fr/.test(getComputedStyle(card.parentElement).gridTemplateColumns+''))) card=card.parentElement;
    // εναλλακτικά: ανέβα μέχρι ο γονιός να είναι grid
    let c=heads[0];
    while(c&&c.parentElement&&getComputedStyle(c.parentElement).display!=='grid') c=c.parentElement;
    const grid=c&&c.parentElement;
    if(!grid) return { err:'δεν βρέθηκε το πλέγμα' };
    const cs=getComputedStyle(grid);
    const kids=[...grid.children];
    out.gridTemplateColumns=cs.gridTemplateColumns;
    out.gap=cs.gap;
    out.gridWidth=grid.getBoundingClientRect().width;
    out.children=kids.length;
    out.kids=kids.map(k=>{const r=k.getBoundingClientRect();return {w:Math.round(r.width*10)/10,h:Math.round(r.height),top:Math.round(r.top)};});
    // πλάτος του .app-content
    const ac=document.querySelector('.app-content');
    out.appContent=ac?Math.round(ac.getBoundingClientRect().width):null;
    // οριζόντια υπερχείλιση μέσα στον πίνακα
    const tw=grid.querySelector('.table-wrap');
    if(tw) out.tableWrap={ client:tw.clientWidth, scroll:tw.scrollWidth };
    const tbl=grid.querySelector('table');
    if(tbl){
      const tds=[...tbl.querySelectorAll('td')].map(td=>({t:(td.textContent||'').trim().slice(0,30), w:Math.round(td.getBoundingClientRect().width), sw:td.scrollWidth, cw:td.clientWidth, h:Math.round(td.getBoundingClientRect().height)}));
      out.cells=tds.slice(0,10);
    }
    return out;
  });
  console.log('=== '+w+' ===', JSON.stringify(r,null,1));
  await p.close();
}
await b.close();
