// Fills the Garcia vs Benn arena map: 18,600 chairs plus its sold and blocked seats.
// Run AFTER `npm run db:seed garcia-vs-benn`. The work lives in seed-event-seats.mjs.
//
//   node scripts/seed-garcia-benn-seats.mjs

import { seedEventSeats } from "./seed-event-seats.mjs";

await seedEventSeats("9a4c2026-0912-4b12-9e00-000000000001").catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
