# Reel: «Πώς ξεκίνησε το PROPERWISE»

Το δεύτερο ποστ του LinkedIn (`scripts/marketing/linkedin-origin.mjs`) σε βίντεο 9:16,
σκηνή προς διαφάνεια. Για LinkedIn, Instagram, Facebook και YouTube Shorts.
Παράγεται σε δύο βήματα (θέλει ffmpeg με libx264):

    npx tsx scripts/marketing/reelOrigin.ts        # η εικόνα
    npx tsx scripts/marketing/reelOriginSound.ts   # η μουσική και το τελικό αρχείο

Το βίντεο γράφεται στο `docs/marketing/reels/reel-origin/PROPERWISE-pos-xekinise.mp4`, έξω από το git.
Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).

Τα νούμερα της έκπτωσης ανακαίνισης έρχονται από το `lib/accounting/renovation39b.ts`.
