// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΔΙΑΔΡΟΜΗ ΜΕ ΣΥΝΕΔΡΙΑ ΖΗΤΑ ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΜΕΝΕ ΑΝΟΙΧΤΟ. Ο διαμεσολαβητής (proxy.ts) γυρίζει στη σύνδεση τη «μισή»
// συνεδρία, δηλαδή επαληθευμένη συσκευή TOTP με διακριτικό «aal1». Το κάνει
// όμως μόνο για ΣΕΛΙΔΕΣ: το /api/** είναι εξαιρεμένο από εκεί, γιατί κάθε
// διαδρομή απαντά μόνη της (scripts/guard-api-auth.mjs). Η μόνη που ρωτούσε
// το δεύτερο βήμα ήταν η διαγραφή λογαριασμού. Οι υπόλοιπες έλεγχαν μόνο ότι
// υπάρχει χρήστης, οπότε ένας κωδικός που διέρρευσε έφτανε για να ανοίξει
// ταμείο, να αλλάξει πακέτο ή να ρωτήσει τη Νόα με τα δεδομένα του θύματος.
// Και δύο από αυτές γράφουν με τον ρόλο υπηρεσίας, όπου η RLS δεν φυλάει τίποτα.
//
// ΙΔΙΑ ΚΡΙΣΗ ΜΕ ΤΟΝ ΔΙΑΜΕΣΟΛΑΒΗΤΗ. Οι παράγοντες έρχονται από το `getUser()`
// (ο διακομιστής ταυτότητας), το επίπεδο από το υπογεγραμμένο διακριτικό. Η
// ετυμηγορία είναι η `sessionNeedsSecondStep` του lib/auth/mfa.ts, όχι
// δεύτερο αντίγραφο της.
//
// ΚΑΝΕΝΑ ΚΟΣΤΟΣ ΓΙΑ ΟΠΟΙΟΝ ΔΕΝ ΕΧΕΙ 2FA. Χωρίς επαληθευμένο παράγοντα η
// απάντηση είναι «περνά» πριν διαβαστεί οτιδήποτε. Με παράγοντα, το
// `getSession()` διαβάζει το cookie: καμία κλήση δικτύου.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MFA_REQUIRED, MFA_SAY, hasVerifiedFactor, sessionNeedsSecondStep,
  type FactorLike,
} from './mfa';

/** Όσο χρειάζεται από τον πελάτη: μόνο η συνεδρία του cookie. */
type SessionReader = { auth: Pick<SupabaseClient['auth'], 'getSession'> };
/** Ο χρήστης όπως τον επιστρέφει το `auth.getUser()`, όσο μας αφορά. */
type FactorHolder = { factors?: readonly FactorLike[] | null };

/**
 * Χρωστά η συνεδρία αυτού του αιτήματος το δεύτερο βήμα;
 *
 * ΚΛΕΙΝΕΙ ΟΤΑΝ ΔΕΝ ΞΕΡΕΙ, όπως ο διαμεσολαβητής: συνεδρία που δεν διαβάστηκε
 * σημαίνει διακριτικό που λείπει και ο χρήστης με συσκευή «χρωστά» το βήμα.
 */
export async function secondStepMissing(supabase: SessionReader, user: FactorHolder): Promise<boolean> {
  if (!hasVerifiedFactor(user.factors)) return false;
  const { data, error } = await supabase.auth.getSession();
  const accessToken = error ? undefined : data.session?.access_token;
  return sessionNeedsSecondStep(accessToken, user.factors);
}

/**
 * Η πύλη της διαδρομής: `null` όταν το αίτημα περνά, αλλιώς έτοιμη απάντηση
 * 403 με `{ error: 'mfa_required' }`.
 *
 *     const denied = await requireSecondStep(supabase, user);
 *     if (denied) return denied;
 *
 * 403 και όχι 401: ο χρήστης ΕΙΝΑΙ συνδεδεμένος· του λείπει βεβαίωση, όχι
 * ταυτότητα. Το `message` είναι η φράση της οθόνης σύνδεσης, για όποιον
 * θέλει να τη δείξει αυτούσια.
 */
export async function requireSecondStep(supabase: SessionReader, user: FactorHolder): Promise<NextResponse | null> {
  if (!(await secondStepMissing(supabase, user))) return null;
  return NextResponse.json({ error: MFA_REQUIRED, message: MFA_SAY.ask }, { status: 403 });
}
