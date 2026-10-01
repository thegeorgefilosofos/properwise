// Το pdfmake δεν συνοδεύεται από τύπους για τα browser builds (build/pdfmake,
// build/vfs_fonts). Τα φορτώνουμε δυναμικά στον client· εδώ δηλώνονται ως any.
declare module 'pdfmake/build/pdfmake';
declare module 'pdfmake/build/vfs_fonts';
// Η μηχανή του pdfmake. Τη φορτώνουν ΜΟΝΟ οι δοκιμές του lib/pdf/pdfText.ts
// και του lib/tax/aadeE2.ts, για να φτιάξουν πραγματικό PDF με ελληνικά και να
// το ξαναδιαβάσουν. Καμία οθόνη δεν την εισάγει.
declare module 'pdfkit';
