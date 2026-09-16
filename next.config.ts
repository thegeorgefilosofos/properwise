import type { NextConfig } from "next";

// ── Security headers ─────────────────────────────────────────────────────────
// Το Content-Security-Policy ορίζεται πλέον στο proxy.ts (middleware) με
// per-request nonce, ώστε να φύγει το 'unsafe-inline' από το script-src. Εδώ
// μένουν οι υπόλοιπες κεφαλίδες. Σε development παραλείπουμε το HSTS (σπάει το
// http://localhost)· η CSP ούτως ή άλλως δεν στέλνεται σε dev από το middleware.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  ...(isDev ? [] : [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // ── ΤΟ ΠΑΡΑΘΥΡΟ ΔΕΝ ΔΙΝΕΙ ΛΑΒΗ ΣΕ ΞΕΝΟ ORIGIN ─────────────────────────────
  // Cross-Origin-Opener-Policy απομονώνει το browsing context: ένα ξένο
  // αναδυόμενο παράθυρο δεν αποκτά αναφορά `window.opener` στη σελίδα μας, που
  // κλείνει μια οικογένεια διαρροών μεταξύ origin (XS-Leaks, tabnabbing).
  //
  // ΓΙΑΤΙ `same-origin-allow-popups` ΚΑΙ ΟΧΙ `same-origin`. Η σύνδεση με Google
  // (Supabase signInWithOAuth) είναι ροή ΑΝΑΚΑΤΕΥΘΥΝΣΗΣ, όχι popup — το
  // `same-origin` δεν θα την έσπαγε. Αλλά το `allow-popups` είναι το ασφαλές
  // ενδιάμεσο: κρατά την απομόνωση για ό,τι ΜΑΣ ανοίγει ξένο, χωρίς να κόψει
  // κανένα παράθυρο που ανοίγουμε ΕΜΕΙΣ. Η τιμή που συνιστά η ίδια η Google για
  // ιστότοπους με OAuth.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Κάμερα (σάρωση) & μικρόφωνο (φωνή) επιτρέπονται μόνο στο ίδιο origin· τα άλλα κλειστά.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // ── ΠΟΙΑ ΕΚΔΟΣΗ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ ───────────────────────────────────────────
  // Χωρίς αυτό, μια αναφορά σφάλματος δεν λέει ΠΟΤΕ αν το πρόβλημα υπάρχει
  // ακόμη ή αν ο χρήστης κοιτά παλιά έκδοση. Χάθηκαν δύο γύροι διόρθωσης
  // ακριβώς εκεί: το σφάλμα είχε ήδη λυθεί και το preview σέρβιρε το προηγούμενο
  // build. Επτά χαρακτήρες commit στην οθόνη σφάλματος κλείνουν το ερώτημα.
  env: {
    NEXT_PUBLIC_BUILD_SHA:
      (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev",
  },
  // ══ ΤΟ 83% ΚΑΘΕ ΣΥΝΑΡΤΗΣΗΣ ΗΤΑΝ ΜΙΑ ΒΙΒΛΙΟΘΗΚΗ ΠΟΥ ΔΕΝ ΚΑΛΕΙΤΑΙ ΠΟΤΕ ═══════
  //
  // ΜΕΤΡΗΜΕΝΟ, ΑΝΑ ΑΡΧΕΙΟ. Το ίχνος της `/privacy` —σελίδα νομικού κειμένου—
  // ζύγιζε 34,4 MB σε 239 αρχεία:
  //
  //     18,63 MB  @img/sharp-libvips-linux-x64   54%
  //      9,15 MB  @img/sharp-wasm32              27%
  //      4,52 MB  ο χρόνος εκτέλεσης του Next    13%
  //      0,78 MB  Ο ΔΙΚΟΣ ΜΑΣ ΚΩΔΙΚΑΣ             2%
  //
  // Το `sharp` είναι ο βελτιστοποιητής εικόνας του `next/image`. Το Next το
  // ιχνηλατεί σε ΚΑΘΕ συνάρτηση, γιατί το API βελτιστοποίησης ζει στον ίδιο
  // χρόνο εκτέλεσης — ανεξάρτητα από το αν το καλεί κανείς.
  //
  // ΔΕΝ ΤΟ ΚΑΛΕΙ ΚΑΝΕΙΣ. Το `next/image` δεν χρησιμοποιείται πουθενά στην
  // εφαρμογή — κι αυτό είναι ΑΠΟΦΑΣΗ, γραμμένη σε δύο σημεία: στο
  // `components/Theme.tsx` (εικόνες χρόνου εκτέλεσης από `data:` κι από το
  // Storage, που το `next/image` δεν μπορεί να επεξεργαστεί) κι στο
  // `app/PwaProvider.tsx` (ο χρόνος εκτέλεσής του έμπαινε στο κρίσιμο μονοπάτι
  // κάθε σελίδας). Οι δεκαπέντε εικόνες του `public/` σερβίρονται ως στατικά
  // αρχεία από το CDN, χωρίς να περάσουν ποτέ από βελτιστοποιητή.
  //
  // ΤΙ ΑΛΛΑΖΕΙ ΓΙΑ ΤΟΝ ΧΡΗΣΤΗ: τίποτα. Καμία εικόνα δεν περνά σήμερα από το
  // `/_next/image`, άρα καμία δεν αλλάζει διαδρομή, μέγεθος ή ποιότητα.
  //
  // ΤΟ `unoptimized` ΜΟΝΟ ΤΟΥ ΔΕΝ ΑΡΚΕΙ — ΜΕΤΡΗΘΗΚΕ. Δηλώνει ότι δεν υπάρχει
  // βελτιστοποίηση εικόνας, αλλά ο ιχνηλάτης του Next συμπεριλαμβάνει το
  // `sharp` ούτως ή άλλως: 910 → 870 MB, μείωση 4%. Ο αποκλεισμός πρέπει να
  // γραφτεί ρητά, από κάτω. Η δήλωση μένει γιατί είναι ΑΛΗΘΗΣ κι είναι αυτή
  // που κάνει τον αποκλεισμό ασφαλή: χωρίς αυτήν, ένα μελλοντικό `next/image`
  // θα ζητούσε βιβλιοθήκη που δεν θα υπήρχε στο πακέτο.
  images: { unoptimized: true },
  // Ο,τι δεν καλείται, δεν ταξιδεύει. Το `@img/**` είναι οι δυαδικοί του sharp
  // (libvips, wasm, ο εγγενής x64) κι το `sharp/**` ο περιτυλιγμένος κώδικας.
  outputFileTracingExcludes: {
    '**/*': ['node_modules/@img/**', 'node_modules/sharp/**'],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Ο service worker ΔΕΝ επιτρέπεται να αποθηκευτεί. Αν ο browser κρατήσει
      // παλιό sw.js, κρατά και τη στρατηγική cache που μπορεί να σερβίρει
      // ασύμβατα αρχεία build. Είναι το μοναδικό αρχείο όπου η μηδενική
      // αποθήκευση είναι απαίτηση ορθότητας και όχι προτίμηση.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
