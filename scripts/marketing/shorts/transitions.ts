// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · ΤΑ ΠΕΡΑΣΜΑΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Εννέα περάσματα, όλα πάνω στον χτύπο: το κόψιμο (B) πέφτει ΑΚΡΙΒΩΣ στην αρχή
// της επόμενης σκηνής, που είναι πάντα σε χτύπο της μουσικής. Κάθε πέρασμα
// ορίζει πόσο ξεκινά πριν (pre) και πόσο κρατά μετά (post), τι κάνει στις δύο
// σκηνές ανά καρέ και τι ακούγεται.
//
// ΟΙ ΚΑΝΟΝΕΣ ΠΟΥ ΦΥΛΑΕΙ Ο ΕΛΕΓΧΟΣ `gateLegibility` (qa.ts):
//   · Κανένα καρέ χωρίς ευανάγνωστο κείμενο για περισσότερα από ΔΥΟ καρέ στη
//     σειρά. Η μηχανή γράφει σε κάθε καρέ αν κάποιο στρώμα είναι ευανάγνωστο
//     (αδιαφάνεια, θόλωμα, μετατόπιση, κλίμακα, γωνία, κάλυψη) και ο έλεγχος
//     μετρά τα καρέ ανάμεσα.
//   · Κανένα φτηνό εφέ: ούτε ουράνιο τόξο, ούτε θόρυβος glitch, ούτε σκόνη.
//     Μόνο φως στο χρώμα της σειράς και της μάρκας.
//   · Θόλωμα κίνησης ΚΑΤΕΥΘΥΝΣΗΣ (φίλτρο SVG ανά σκηνή), ανάλογο της ταχύτητας,
//     όπως το αφήνει το κλείστρο της κάμερας, όχι γενικό θόλωμα.
// ═══════════════════════════════════════════════════════════════════════════
import type { Mix } from '../synth';
import { n } from '../synth';
import { K } from './kit';

export type TransitionName =
  | 'whip' | 'zoomThrough' | 'maskWipe' | 'matchCut' | 'typeSlam'
  | 'splitSwap' | 'lightLeak' | 'rackFocus' | 'cardFlip';

export interface TransitionDef {
  name: TransitionName;
  label: string;
  /** Πόσο ξεκινά πριν από το κόψιμο και πόσο κρατά μετά, σε δευτερόλεπτα. */
  pre: number;
  post: number;
  /** Ρυθμίσεις που χρειάζεται (έλεγχος πριν από την παραγωγή). */
  needs?: string[];
  sfx: (m: Mix, B: number, accentMidi: number) => void;
}

const riser = (m: Mix, B: number, len = 1.1, g = .018) => { m.sweep(B - len, len, 260, 1500, g); m.whoosh(B - len * .8, len * .8, .05, true); };

export const TRANSITIONS: Record<TransitionName, TransitionDef> = {
  whip: {
    name: 'whip', label: 'Whip pan με θόλωμα κίνησης', pre: .1, post: .32,
    sfx: (m, B) => { m.whoosh(B - .28, .42, .13, true); m.click(B, 1900, .07); m.click(B + .02, 900, .05); },
  },
  zoomThrough: {
    name: 'zoomThrough', label: 'Ζουμ μέσα από ψηφίο ή αντικείμενο', pre: .5, post: .42, needs: ['target'],
    sfx: (m, B) => { riser(m, B, 1.3, .022); m.boom(B, .3); m.kick(B, .9); m.click(B, 2400, .06); },
  },
  maskWipe: {
    name: 'maskWipe', label: 'Σκούπισμα με μάσκα σχήματος', pre: .04, post: .62,
    sfx: (m, B, a) => { m.whoosh(B - .12, .7, .08, true); m.pluck(B + .05, a + 12, .045, .3, .5); },
  },
  matchCut: {
    name: 'matchCut', label: 'Match cut: στοιχείο που γίνεται το επόμενο', pre: .3, post: .46, needs: ['from', 'to'],
    sfx: (m, B, a) => { m.whoosh(B - .25, .5, .06, true); m.click(B, 1500, .08); m.bell(B + .02, a + 19, .035, .2); },
  },
  typeSlam: {
    name: 'typeSlam', label: 'Kinetic type slam', pre: .3, post: .5, needs: ['word'],
    sfx: (m, B) => { riser(m, B - .2, .9, .016); m.boom(B - .12, .4); m.kick(B - .12, 1); m.clap(B - .12, .1); m.whoosh(B + .1, .4, .07, false); },
  },
  splitSwap: {
    name: 'splitSwap', label: 'Split-screen swap', pre: .04, post: .55,
    sfx: (m, B) => { m.whoosh(B - .05, .6, .1, false); m.boom(B, .16); m.click(B, 700, .08); },
  },
  lightLeak: {
    name: 'lightLeak', label: 'Light leak και flash cut', pre: .4, post: .45,
    sfx: (m, B, a) => { m.sweep(B - .9, .9, 400, 2400, .014); m.whoosh(B - .6, .6, .06, true); [0, 4, 7, 12].forEach((d, i) => m.bell(B + i * .045, a + 12 + d, .03, (i - 1.5) * .25)); },
  },
  rackFocus: {
    name: 'rackFocus', label: 'Rack focus, καθαρό', pre: .22, post: .4,
    sfx: (m, B) => { m.sweep(B - .4, .7, 1800, 500, .012); m.whoosh(B - .3, .6, .05, false); },
  },
  cardFlip: {
    name: 'cardFlip', label: 'Στοίβα καρτών που γυρίζει', pre: .24, post: .4,
    sfx: (m, B) => { m.whoosh(B - .22, .4, .08, true); m.click(B - .02, 3000, .06, -.3); m.click(B + .05, 2200, .05, .3); m.boom(B + .1, .12); },
  },
};

/** Ποιο ύψος έχει η νότα του χρώματος της σειράς (για τις καμπάνες των περασμάτων). */
export const accentMidi = (root: string) => n(`${root}4`);

/**
 * Τα περάσματα μέσα στη σελίδα. Κάθε συνάρτηση παίρνει τη στιγμή `t`, το
 * πέρασμα `tr` (B, pre, post, opts) και τις καταστάσεις της σκηνής που φεύγει
 * (O) και αυτής που έρχεται (I). Η μηχανή εφαρμόζει τις καταστάσεις και κρίνει
 * την αναγνωσιμότητα. Το `X` κρατά τα στρώματα από πάνω (φως, λέξη, σχήμα).
 */
export const TRANSITIONS_JS = `
  const TRF = {
    // ── 1 · Whip pan: τρία καρέ επιτάχυνση, ένα θολό πέρασμα, μαλακή προσγείωση.
    whip(t, tr, O, I, X) {
      const sg = tr.opts.dir === 'right' ? -1 : 1, vert = tr.opts.axis === 'y';
      if (t < tr.B) {
        const q = p(t, tr.B - tr.pre, tr.B), e = Math.pow(q, 3);
        if (vert) { O.y = -sg * 1500 * e; O.by = 70 * Math.pow(q, 4); } else { O.x = -sg * 1250 * e; O.bx = 70 * Math.pow(q, 4); }
        O.s = 1 + .03 * e; I.o = 0;
      } else {
        const q = p(t, tr.B, tr.B + tr.post), e = 1 - Math.pow(1 - q, 6);
        if (vert) { I.y = sg * 1500 * (1 - e); I.by = 70 * Math.pow(1 - e, 1.4); } else { I.x = sg * 1250 * (1 - e); I.bx = 70 * Math.pow(1 - e, 1.4); }
        I.s = 1.03 - .03 * e; O.o = 0;
      }
      // Μια λωρίδα φωτός περνά μαζί με την κάμερα: το μάτι ακολουθεί την κίνηση.
      const w = p(t, tr.B - tr.pre, tr.B + .12);
      op(X.streak, Math.sin(Math.PI * w) * .5);
      tf(X.streak, 'translateX(' + (sg > 0 ? 1300 - 1900 * eio(w) : -600 + 1900 * eio(w)) + 'px) rotate(12deg)');
    },

    // ── 2 · Ζουμ μέσα από το ψηφίο: αργή ώθηση, έκρηξη δύο καρέ, η νέα σκηνή βγαίνει από το χρώμα του.
    zoomThrough(t, tr, O, I, X) {
      const g = G[tr.opts.target]; if (!g) return;
      const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
      if (t < tr.B) {
        const q = p(t, tr.B - tr.pre, tr.B), slow = .55 * eio(cl(q / .9)), burst = cl((q - .9) / .1);
        O.s = (1 + slow) * Math.exp(Math.log(26) * burst * burst); O.ox = cx; O.oy = cy;
        O.blur = 6 * burst; I.o = 0;
        const fq = p(t, tr.B - .05, tr.B); X.zfill.style.background = tr.opts.color || D.accent; op(X.zfill, fq);
        if (fq > 0) X.cover = Math.max(X.cover, fq);
      } else {
        const q = p(t, tr.B, tr.B + tr.post), e = eo(q);
        I.s = 1.22 - .22 * e; I.blur = 8 * Math.pow(1 - e, 3); O.o = 0;
        const fq = 1 - p(t, tr.B, tr.B + .05); X.zfill.style.background = tr.opts.color || D.accent; op(X.zfill, fq); X.cover = Math.max(X.cover, fq);
      }
    },

    // ── 3 · Μάσκα σχήματος: η νέα σκηνή ανοίγει από ένα σημείο, με ένα δαχτυλίδι φωτός στην άκρη.
    maskWipe(t, tr, O, I, X) {
      const q = p(t, tr.B - tr.pre, tr.B + tr.post), e = eio(q);
      const g = tr.opts.at && G[tr.opts.at], ax = g ? g.x + g.w / 2 : 540, ay = g ? g.y + g.h / 2 : 960;
      const R = 2300 * e;
      if (tr.opts.shape === 'diag') {
        const k = -300 + 2000 * e;
        I.clip = 'polygon(0 0,' + k + 'px 0,' + (k - 640) + 'px 1920px,0 1920px)';
        X.ring.style.cssText = 'left:' + (k - 640) + 'px;top:0;width:6px;height:2200px;border-radius:3px;transform-origin:0 0;transform:rotate(' + (Math.atan2(640, 1920) * 180 / Math.PI) + 'deg);border:0;background:' + D.accent + ';box-shadow:0 0 40px ' + D.accent;
      } else {
        I.clip = 'circle(' + R + 'px at ' + ax + 'px ' + ay + 'px)';
        X.ring.style.cssText = 'left:' + (ax - R) + 'px;top:' + (ay - R) + 'px;width:' + (2 * R) + 'px;height:' + (2 * R) + 'px';
      }
      op(X.ring, q > 0 && q < 1 ? Math.sin(Math.PI * q) * .9 : 0);
      I.z = 3; I.bg = 1; O.s = 1 - .05 * e; O.bright = 1 - .45 * e; I.s = 1.06 - .06 * e;
      O.vis = 1 - e; I.vis = e;
    },

    // ── 4 · Match cut: το σχήμα της μίας σκηνής ταξιδεύει και γίνεται το στοιχείο της επόμενης.
    matchCut(t, tr, O, I, X) {
      const A = G[tr.opts.from], Z = G[tr.opts.to]; if (!A || !Z) return;
      const q = eio(p(t, tr.B - .16, tr.B + .3)), m = X.morph;
      if (tr.opts.rect) {
        // ΟΡΘΟΓΩΝΙΟ ΠΟΥ ΓΙΝΕΤΑΙ ΚΟΜΒΟΣ: το κουτί του αριθμού (γωνίες 0) πηγαίνει ευθεία στο
        // ορθογώνιο του κόμβου (γωνίες του κόμβου), χωρίς τόξο και λάμψη. Τα ψηφία σβήνουν
        // στο πρώτο 40% της διαδρομής ενώ το κουτί ανάβει (08/10: η «κάψουλα με ουρά»).
        const k = p(t, tr.B - tr.pre, tr.B + .3), r = eio(cl(k));
        m.style.left = lerp(A.x, Z.x, r) + 'px'; m.style.top = lerp(A.y, Z.y, r) + 'px'; m.style.width = lerp(A.w, Z.w, r) + 'px'; m.style.height = lerp(A.h, Z.h, r) + 'px';
        m.style.borderRadius = lerp(0, Z.r, r) + 'px'; m.style.background = tr.opts.color || D.accent; m.style.boxShadow = 'none';
        op(m, cl(k / .4) * (1 - eio(cl((k - .8) / .2))));
        // Η επόμενη σκηνή ανάβει πριν σβήσει τελείως η προηγούμενη: το πολύ δύο καρέ χωρίς ευανάγνωστο κείμενο.
        if (t < tr.B) { O.o = 1 - cl((k - .15) / .3); I.o = cl((k - .3) / .15); } else { O.o = 0; I.o = 1; }
        return;
      }
      const x = lerp(A.x, Z.x, q), y = lerp(A.y, Z.y, q) - 140 * Math.sin(Math.PI * q), w = lerp(A.w, Z.w, q), h = lerp(A.h, Z.h, q);
      m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.width = w + 'px'; m.style.height = h + 'px';
      m.style.borderRadius = lerp(A.r, Z.r, q) + 'px'; m.style.background = tr.opts.color || D.accent;
      m.style.boxShadow = '0 0 ' + (60 * Math.sin(Math.PI * q)) + 'px ' + (tr.opts.color || D.accent);
      // Ταξιδεύει γεμάτο. Στο τελευταίο τρίτο διαλύεται μέσα στο στοιχείο που γίνεται.
      op(m, p(t, tr.B - tr.pre, tr.B - tr.pre + .08) * (1 - eio(cl((q - .55) / .45))));
      if (t < tr.B) { I.o = 0; O.s = 1 + .02 * p(t, tr.B - tr.pre, tr.B); O.o = 1 - .5 * p(t, tr.B - .1, tr.B); }
      else { O.o = 0; I.o = .5 + .5 * p(t, tr.B, tr.B + .1); I.s = 1.02 - .02 * eo(p(t, tr.B, tr.B + tr.post)); }
    },

    // ── 5 · Kinetic type slam: μία λέξη πέφτει πάνω στην οθόνη και τη σπάει προς την επόμενη.
    typeSlam(t, tr, O, I, X) {
      const a = tr.B - tr.pre, k = p(t, a, tr.B - .06);
      const panel = p(t, a, a + .09) * (1 - eio(p(t, tr.B + .14, tr.B + tr.post)));
      op(X.slamBg, panel); X.cover = Math.max(X.cover, panel);
      X.slamW.textContent = tr.opts.word; X.slamS.textContent = tr.opts.sub || '';
      if (tr.opts.size) X.slamW.style.fontSize = tr.opts.size + 'px';
      const punch = ei(p(t, tr.B + .12, tr.B + tr.post));
      const s = (2.3 - 1.3 * spring(k * 1.05)) * (1 + 5 * punch), bl = 14 * Math.pow(1 - cl(k * 1.6), 2);
      tf(X.slam, 'scale(' + s + ')'); X.slam.style.filter = bl > .3 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none';
      const o = cl(k * 4) * (1 - punch); op(X.slam, o);
      if (o > .55 && s < 1.6 && bl <= 4) X.leg = true;
      if (t < tr.B) { I.o = 0; O.s = 1 - .06 * k; O.blur = 6 * k; }
      else { O.o = 0; I.s = .9 + .1 * eo(p(t, tr.B + .1, tr.B + tr.post)); }
    },

    // ── 6 · Split-screen swap: η οθόνη σκίζεται στα δύο, τα μισά φεύγουν αντίθετα, από κάτω η επόμενη.
    splitSwap(t, tr, O, I, X) {
      const q = p(t, tr.B - tr.pre, tr.B + tr.post), e = eio(q), v = Math.sin(Math.PI * q);
      const cln = X.clone[tr.k]; const vert = tr.opts.axis !== 'x';
      const d = 1100 * e;
      if (vert) { O.clip = 'inset(0 0 50% 0)'; O.y = -d; O.by = 10 * v; } else { O.clip = 'inset(0 50% 0 0)'; O.x = -d; O.bx = 10 * v; }
      O.z = 3; O.bg = 1; I.z = 1; I.s = 1.12 - .12 * eo(q); I.bright = .35 + .65 * e;
      if (cln) {
        cln.style.display = q > 0 && q < 1 ? '' : 'none';
        cln.style.clipPath = vert ? 'inset(50% 0 0 0)' : 'inset(0 0 0 50%)';
        cln.style.transform = vert ? 'translateY(' + d + 'px)' : 'translateX(' + d + 'px)';
        cln.style.filter = 'url(#mbc' + tr.k + ')'; $('mbc' + tr.k + 'f').setAttribute('stdDeviation', vert ? '0 ' + (10 * v) : (10 * v) + ' 0');
        cln.style.opacity = O.o; cln.style.zIndex = 3;
      }
      // Η ραφή: μια λεπτή γραμμή φωτός εκεί που σκίστηκε η οθόνη.
      op(X.seam, v * .9); tf(X.seam, vert ? 'translateY(' + (960 - 3) + 'px) scaleX(' + (.2 + .8 * e) + ')' : 'translateX(' + (540 - 3) + 'px) rotate(90deg) scaleX(' + (.2 + .8 * e) + ')');
      O.vis = 1 - e; I.vis = e;
    },

    // ── 7 · Light leak και flash cut: ζεστό φως περνά, κόψιμο κάτω από τη λάμψη.
    lightLeak(t, tr, O, I, X) {
      const q = p(t, tr.B - tr.pre, tr.B + tr.post), b = Math.pow(Math.sin(Math.PI * q), 1.6);
      op(X.leak, b * .6); tf(X.leak, 'translate(' + (-500 + 900 * q) + 'px,' + (300 - 500 * q) + 'px) rotate(' + (-18 + 30 * q) + 'deg)');
      const dt = Math.abs(t - tr.B), fl = .42 * Math.exp(-dt * 55);
      op(X.flash, fl);
      X.cover = Math.max(X.cover, b * .35 + fl);
      if (t < tr.B) { I.o = 0; O.bright = 1 + .5 * b; O.s = 1 + .03 * q; } else { O.o = 0; I.bright = 1 + .5 * b; I.s = 1.04 - .04 * eo(p(t, tr.B, tr.B + tr.post)); }
    },

    // ── 8 · Rack focus: η εστίαση φεύγει από τη μία σκηνή και πιάνει την άλλη. Καθαρό, χωρίς θόρυβο.
    rackFocus(t, tr, O, I, X) {
      if (t < tr.B) {
        const q = p(t, tr.B - tr.pre, tr.B);
        O.blur = 16 * Math.pow(q, 6); O.s = 1 + .05 * eio(q); I.o = 0;
      } else {
        const q = p(t, tr.B, tr.B + tr.post), e = eo(q);
        I.blur = 12 * Math.pow(1 - e, 3); I.s = .965 + .035 * e; O.o = 0;
      }
    },

    // ── 9 · Στοίβα καρτών: η σκηνή γυρίζει σαν κάρτα, από πίσω περιμένει η επόμενη.
    cardFlip(t, tr, O, I, X) {
      const st = X.stack;
      if (t < tr.B) {
        const q = p(t, tr.B - tr.pre, tr.B), e = q * q * q;
        O.ry = -95 * e; O.s = 1 - .1 * eio(q); O.bright = 1 - .4 * e; I.o = 0; O.bg = cl(q * 4); O.card = true;
        op(st, cl(q * 3)); tf(st, 'scale(' + (.9 + .02 * q) + ')');
      } else {
        const q = p(t, tr.B, tr.B + tr.post), e = eo(q);
        I.ry = 95 * (1 - e); I.s = .9 + .1 * e; O.o = 0; I.bg = 1 - cl((q - .6) * 2.5); I.card = q < .8;
        op(st, 1 - cl(q * 2)); tf(st, 'scale(' + (.92 + .08 * e) + ')');
      }
    },
  };`;

/** Τα στρώματα που χρειάζονται τα περάσματα, πάνω από τις σκηνές και κάτω από την κεφαλίδα. */
export const TRANSITION_LAYERS = `
  <div id="streak" class="deco"></div>
  <div id="zfill" class="deco"></div>
  <div id="ring" class="deco"></div>
  <div id="morph" class="deco"></div>
  <div id="seam" class="deco"></div>
  <div id="stack" class="deco"><i></i><i></i></div>
  <div id="leak" class="deco"><i></i><i></i></div>
  <div id="flash" class="deco"></div>
  <div id="slamBg" class="deco"></div>
  <div id="slam" class="deco"><b id="slamW"></b><span id="slamS"></span></div>`;

export const transitionCss = (accent: string) => `
  #streak{position:absolute;top:-300px;left:0;width:170px;height:2600px;opacity:0;mix-blend-mode:screen;z-index:20;
    background:linear-gradient(90deg,transparent,${accent}66 42%,${K.ink}cc 50%,${accent}66 58%,transparent)}
  #zfill{position:absolute;inset:0;opacity:0;z-index:21}
  #ring{position:absolute;border-radius:50%;border:6px solid ${accent};box-shadow:0 0 40px ${accent},inset 0 0 40px ${accent}66;opacity:0;z-index:22;pointer-events:none}
  #morph{position:absolute;opacity:0;z-index:23}
  #seam{position:absolute;left:0;top:0;width:1080px;height:6px;border-radius:3px;opacity:0;z-index:22;
    background:linear-gradient(90deg,transparent,${accent} 20%,${K.ink} 50%,${accent} 80%,transparent);box-shadow:0 0 30px ${accent}}
  #stack{position:absolute;inset:0;opacity:0;z-index:0}
  #stack i{position:absolute;left:70px;right:70px;top:250px;bottom:330px;border-radius:56px;background:linear-gradient(180deg,${K.lift},${K.panel});border:1.5px solid ${K.ink}14;box-shadow:0 60px 120px ${K.ground}aa}
  #stack i:nth-child(2){left:110px;right:110px;top:220px;bottom:360px;background:linear-gradient(180deg,${K.panel},${K.ground});opacity:.8}
  #leak{position:absolute;left:-200px;top:200px;width:1500px;height:1500px;opacity:0;z-index:24;mix-blend-mode:screen;pointer-events:none}
  #leak i{position:absolute;border-radius:50%;filter:blur(90px)}
  #leak i:first-child{left:0;top:0;width:1100px;height:900px;background:radial-gradient(closest-side,${accent}cc,${accent}44 55%,transparent)}
  #leak i:last-child{left:450px;top:350px;width:600px;height:600px;background:radial-gradient(closest-side,${K.ink}cc,${accent}44 60%,transparent)}
  #flash{position:absolute;inset:0;opacity:0;z-index:25;background:radial-gradient(900px 1100px at 50% 45%,${K.ink},${accent}88 45%,transparent 80%)}
  #slamBg{position:absolute;inset:0;opacity:0;z-index:26;background:radial-gradient(900px 900px at 50% 46%,${accent}33,transparent 70%),${K.ground}}
  #slam{position:absolute;left:0;right:0;top:0;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;opacity:0;z-index:27;transform-origin:540px 900px;padding-bottom:120px}
  #slamW{font-size:210px;font-weight:900;letter-spacing:-.05em;line-height:.9;color:${accent};text-shadow:0 30px 120px ${accent}66;white-space:nowrap}
  #slamS{font-family:'Roboto Mono',monospace;font-size:30px;letter-spacing:.16em;color:${K.ink};font-weight:500}`;
