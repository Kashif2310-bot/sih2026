# Autonomous Overnight Build Log

Branch: `autonomous/overnight-build`. Working top-to-bottom through the task list without stopping for input. Entries appended chronologically below; a final summary will be added at the top of this file when the run ends.

---

## 2026-09-12 03:18 — Item 1: finish Phase 1 (finance/honesty/working-capital/LokScore config)

**What I found:** almost all of item 1 was already done in the working tree from a prior session (uncommitted, carried onto this new branch): `finance.ts` has real BigInt-exact reducing-balance quarterly annuity EMI, integer-paise math throughout, final-installment residue closes the schedule to exactly ₹0.00 (asserted in tests), the `capitalize_into_principal` moratorium convention is named in `config.ts` and displayed on `/finance`, and boundary rejections (₹0/empty margin, >₹50L project) are handled with clear copy. The three honesty fixes were done: `AppContext` sets an explicit `unavailable` weather state instead of fabricating one, `/sanction` labels verifier wallets as demo/fixture identities, escrow copy says "Simulated release — no blockchain transaction." `workingCapital.ts` (itemised raw material/labour/utilities/rent-transport × cycle-months) replaces the flat-% hint on `/finance`. `LOKSCORE_WEIGHTS` is already a named config object in `config.ts`, values unchanged (0.25/0.2/0.15/0.25/0.15), with a locking test.

**What I did:** `npm run build` failed on two pre-existing TypeScript errors unrelated to the task list (`feasibility.ts` unused `meta` variable; `resolveLocation.ts`'s `resolveCuratedVillage` had its `radiusKm` parameter inferred as the literal type `7` from `REACH_KM.default` via `as const`, rejecting any other number such as the live-mode radius). Fixed both: removed the dead variable, added an explicit `radiusKm: number` annotation. Also found `mandi.test.ts` was stale against `mandi.ts`'s current signature (expects `ResolvedLocation`, returns `null` for non-curated locations) — updated it and added a null-path test.

**Verified:** `npm run build` succeeds (tsc + vite build). `npm test` (vitest run) — 6 files, 26 tests, all pass, including the finance.ts boundary cases (₹1.40L flip, ₹1,38,888.89 90%-vs-cap crossover, both rejections, ₹0.00 schedule closure) and the LOKSCORE_WEIGHTS lock test. Ran the Playwright demo-path spec against a real dev server (not the stale one squatting on the configured port 5173 — see decision note below) — full Scan→Pulse→Report→Finance→Sanction flow passes with ₹10,00,000 project / ₹9,00,000 loan / Term Loan Scheme / quorum signing / simulated escrow release all correct.

**Decision:** `playwright.config.ts`'s `webServer.reuseExistingServer` was picking up an unrelated process already bound to port 5173 on this machine (Docker Desktop / WSL relay), serving stale built assets instead of the dev app — this caused `getByLabel('Full name')` to time out. This is a pre-existing environment quirk, not a bug in the app. I did not change `playwright.config.ts` (out of scope, and it's correct in CI/clean-machine conditions); I only used a local override config to verify manually. Leaving this note here so a future run doesn't waste time on it.

Commit: (see below)

