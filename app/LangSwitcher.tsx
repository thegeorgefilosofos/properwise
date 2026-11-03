'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΠΙΛΟΓΕΑΣ ΓΛΩΣΣΑΣ: ΗΣΥΧΟΣ, ΜΙΚΡΟΣ, ΕΚΕΙ ΠΟΥ ΤΟΝ ΨΑΧΝΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Ενα λεπτό σύμβολο υδρογείου και «EN»/«ΕΛ» στο δευτερεύον χρώμα, χωρίς
// πλαίσιο, όπως στις κεφαλίδες και στα υποσέλιδα της Apple και της Google.
// Ανοίγει μικρό αναδυόμενο με «Ελληνικά» και «English», το καθένα ΣΤΗ ΔΙΚΗ
// ΤΟΥ ΓΛΩΣΣΑ και με `lang`, ώστε ο αναγνώστης οθόνης να το προφέρει σωστά.
//
// ΤΡΕΙΣ ΘΕΣΕΙΣ, ΕΝΑ ΣΥΣΤΑΤΙΚΟ:
//   · «head»: στην κεφαλίδα, από τα 768 και πάνω·
//   · «foot»: στο υποσέλιδο, σε κάθε πλάτος· το αναδυόμενο ανοίγει προς τα πάνω·
//   · «list»: μέσα στο μενού του κινητού, ως δύο γραμμές με σημάδι·
//   · «bar»: στη μπάρα των σελίδων παραλήπτη (πύλη ενοικιαστή, επαλήθευση…),
//     σε κάθε πλάτος, με `here`: η γλώσσα αλλάζει στην ΙΔΙΑ διεύθυνση.
//
// Η ΑΛΛΑΓΗ ΚΡΑΤΑ ΤΗ ΣΕΛΙΔΑ (lib/i18n/paths.ts) ΚΑΙ ΘΥΜΑΤΑΙ ΤΗΝ ΕΠΙΛΟΓΗ στο
// cookie `pw_lang`, που διαβάζει το proxy.ts. Η πλοήγηση είναι ΠΛΗΡΗΣ (σκέτο
// <a>, όχι <Link>): το `<html lang>` το γράφει η ρίζα στον διακομιστή και μια
// πλοήγηση πελάτη θα κρατούσε τη γλώσσα της προηγούμενης σελίδας.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAME, LOCALE_SHORT, localeOfPath, type Locale,
} from '@/lib/i18n/locale';
import { pathIn } from '@/lib/i18n/paths';

const ORDER: Locale[] = ['el', 'en'];

/** Η επιλογή μένει: το proxy.ts κρατά τον επισκέπτη στη γλώσσα του. */
export function rememberLocale(locale: Locale) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch { /* χωρίς cookies η αλλαγή ισχύει για αυτή τη σελίδα */ }
}

// Η ετικέτα του κουμπιού στη γλώσσα της σελίδας: ο αναγνώστης οθόνης ακούει
// τι κάνει το κουμπί, όχι δύο γράμματα.
const BUTTON_LABEL: Record<Locale, string> = { el: 'Γλώσσα: Ελληνικά', en: 'Language: English' };
const LIST_LABEL: Record<Locale, string> = { el: 'Γλώσσα', en: 'Language' };

function Globe() {
  return (
    <svg aria-hidden="true" focusable="false" width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" focusable="false" width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function LangSwitcher({ place, here }: {
  place: 'head' | 'foot' | 'list' | 'bar';
  /**
   * Η γλώσσα μιας σελίδας παραλήπτη, που δεν βγαίνει από τη διαδρομή
   * (lib/i18n/locale.ts, isRecipientPath). Με αυτήν η επιλογή μένει στην ίδια
   * διεύθυνση: γράφεται το cookie και η σελίδα ξαναφορτώνει στη νέα γλώσσα.
   */
  here?: Locale;
}) {
  const pathname = usePathname() ?? '/';
  const current = here ?? localeOfPath(pathname);
  // Κενό href: ο ίδιος ο σύνδεσμος της σελίδας, με το ερώτημά του.
  const hrefOf = (to: Locale) => (here ? '' : pathIn(pathname, to));

  if (place === 'list') {
    return (
      <div className="pub-menu-group">
        <p id="pub-menu-lang" className="pub-menu-label">{LIST_LABEL[current]}</p>
        <ul aria-labelledby="pub-menu-lang">
          {ORDER.map(l => (
            <li key={l}>
              <a href={hrefOf(l)} lang={l} hrefLang={l} className="lp-link pub-menu-link pw-lang-row"
                aria-current={l === current ? 'true' : undefined}
                onClick={() => rememberLocale(l)}>
                <span>{LOCALE_NAME[l]}</span>
                {l === current && <Check />}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <LangPopover place={place} current={current} hrefOf={hrefOf} />;
}

function LangPopover({ place, current, hrefOf }: {
  place: 'head' | 'foot' | 'bar'; current: Locale; hrefOf: (l: Locale) => string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  // Κλείνει με κλικ έξω και όταν η εστίαση φύγει από το συστατικό.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, close]);

  // Με το άνοιγμα, η εστίαση πάει στην τρέχουσα γλώσσα.
  useEffect(() => {
    if (open) items.current[ORDER.indexOf(current)]?.focus();
  }, [open, current]);

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
  };
  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const at = items.current.findIndex(el => el === document.activeElement);
    const move = (i: number) => { e.preventDefault(); items.current[(i + ORDER.length) % ORDER.length]?.focus(); };
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') move(at + 1);
    else if (e.key === 'ArrowUp') move(at - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(ORDER.length - 1);
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={box} className={`pw-lang pw-lang-${place}`}>
      <button ref={button} type="button" className="pw-lang-btn"
        aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        aria-label={BUTTON_LABEL[current]}
        onClick={() => setOpen(o => !o)} onKeyDown={onButtonKey}>
        <Globe />
        <span aria-hidden="true" className="pw-lang-short">{LOCALE_SHORT[current]}</span>
      </button>
      <ul id={menuId} role="menu" aria-label={LIST_LABEL[current]} className="pw-lang-menu"
        hidden={!open} onKeyDown={onMenuKey}>
        {ORDER.map((l, i) => (
          <li key={l} role="none">
            <a ref={el => { items.current[i] = el; }} role="menuitemradio" aria-checked={l === current}
              href={hrefOf(l)} lang={l} hrefLang={l} tabIndex={-1} className="pw-lang-item"
              onClick={() => rememberLocale(l)}>
              <span>{LOCALE_NAME[l]}</span>
              <span className="pw-lang-check">{l === current && <Check />}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Σύνδεσμος προς την ίδια σελίδα στην άλλη γλώσσα, με μνήμη της επιλογής. Τον
 * χρησιμοποιεί η σημείωση της μετάφρασης στις αγγλικές νομικές σελίδες
 * («Read the Greek version»): χωρίς το cookie, το proxy.ts θα γύριζε τον
 * επισκέπτη που έχει διαλέξει αγγλικά πίσω στην αγγλική σελίδα.
 */
export function LocaleLink({ to, href, className, children }: {
  to: Locale; href: string; className?: string; children: ReactNode;
}) {
  return <a href={href} lang={to} hrefLang={to} className={className} onClick={() => rememberLocale(to)}>{children}</a>;
}
