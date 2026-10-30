// ΑΤΑΚ των δοκιμών και των ροών της βάσης (scripts/db/write-flows.ts): πάντα με
// το πρόθεμα 999, που δεν το φοράει κανένας πραγματικός ΑΤΑΚ των fixtures. Το
// φυλάει ο scripts/guard-fixture-identities.mjs. Οι υπόλοιπες γεννήτριες ζουν
// μέσα στο lib/myaade/myaade.test.ts, όπου είναι και ο μόνος καταναλωτής τους.
export const fakeAtak = (n: number): string => `999${String(n).padStart(8, '0')}`;
