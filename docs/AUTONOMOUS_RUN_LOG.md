# Autonomous Overnight Build Log

## END-OF-RUN SUMMARY (2026-09-12 03:50)

**Branch:** `autonomous/overnight-build` (created from `main` at `14d59fe`). **7 commits**, all with passing build+tests at each step. `npm run build` passes as of the last commit (`e377c56`); `npm test` is 37/37 passing (up from 26 at the start of this run). The exact demo path (Scan: SC woman, dairy, Dinka, ₹1L margin → project cost ₹10,00,000 → loan ₹9,00,000 → Term Loan Scheme) was re-verified after every single commit via the Playwright demo-path spec and never regressed. This branch has not been merged — that's for the user to do after review.

**Fully done — all 8 task-list items:**
1. **Phase 1 finish** (`5368b4a`): almost entirely already done by a prior session's uncommitted work — real reducing-balance BigInt-exact quarterly annuity EMI, integer-paise math, schedule closes to exactly ₹0.00, `capitalize_into_principal` moratorium convention named and displayed, boundary rejections for ₹0/empty and >₹50L margin, honesty fixes (weather-unavailable state, verifier fixture-identity labels, "simulated release" escrow copy), itemised working-capital module, `LOKSCORE_WEIGHTS` config extraction. I fixed two build-breaking TypeScript errors and a stale test file to get it to a green build.
2. **Reach-radius slider on /report** (`e4f9de5`): new 5–10km slider drives a live map + an area-scaled reach estimate + haversine-refiltered competitor markers (no new network calls), with an honest caveat when widening past the original scan radius.
3. **Location beyond the 5 seed villages** (`bae85ff`): the Nominatim/Overpass/free-text/GPS plumbing was already built (pre-existing in the initial commit); found and fixed 7 missing i18n keys that were making the live-location UI render raw key strings. Verified end-to-end against real Nominatim/Overpass, including both failure-fallback paths.
4. **LokScore radar chart** (`187c0d3`): added a recharts radar chart on /pulse; restructured the reasons list to only surface a component's one-line explanation when it's below a near-max threshold (85), reusing existing rule-based sentences.
5. **Multi-sig hardening** (audited in `be1ba23`'s log entry, no code changes): already correctly implemented — attestation hash + signed message commit to every material fact, and wrong-key/tampered-data negative tests already existed and pass.
6. **Consolidated report export** (`be1ba23`): new `/export` route + print stylesheet (no new dependency, per MASTER_SPEC's own recommendation) combining location, feasibility, finance, LokScore, and a document checklist, with a generation timestamp and provenance note.
7. **Polish pass** (`1cccd66`): reduced-motion support for the landing page's framer-motion animations, distinguishing ARIA labels on /sanction's sign buttons, confirmed zero horizontal overflow at 360px across all 7 routes, and fixed a radar-chart label-clipping bug found while screenshotting.
8. **Extended test coverage + boundary E2E** (`e377c56`): 11 new unit tests across feasibility/lokScore/multisig, plus a new permanent `e2e/boundary-path.spec.ts`. Found and fixed a real bug while writing it: native HTML `min`/`max` on the margin input was silently blocking form submission before the app's own bilingual rejection messages could ever run — added `noValidate` so the app's own validation is authoritative.

**Partially done / not done:** nothing outstanding from the 8-item list — all items were addressed to a verified, tested state. Two things worth the user's attention rather than mine to decide:
- The finance repayment-schedule table and the map on `/report`/`/pulse`/`/export` have their own internal horizontal/vertical scroll on narrow screens (by design, not a bug) — a future pass could redesign the schedule table for mobile (e.g., a card list instead of a 5-column table) if that's wanted.
- The production bundle is ~1.26MB (recharts + leaflet + ethers are the main weight) and Vite flags it; no code-splitting was attempted since it wasn't in scope and carries its own risk.

**Blocked:** nothing was blocked for more than a few minutes in this run.

**Environment note for whoever reviews this:** `playwright.config.ts`'s default webServer target (port 5173) collides with an unrelated process already bound to that port on this dev machine (Docker Desktop/WSL relay serving stale content) — every manual verification in this run used a scratch `playwright.local.config.ts` pointed at a dev server on port 5183 instead (always deleted before committing, never part of the diff). Running `npm run test:e2e` normally on a clean machine should work fine; on this machine specifically, start `npm run dev -- --port <free-port>` and point a local Playwright config at it if verifying manually.

---

Branch: `autonomous/overnight-build`. Working top-to-bottom through the task list without stopping for input. Entries appended chronologically below; this final summary was added at the top when the run ended — see below for the full chronological log.

---

## 2026-09-12 03:18 — Item 1: finish Phase 1 (finance/honesty/working-capital/LokScore config)

**What I found:** almost all of item 1 was already done in the working tree from a prior session (uncommitted, carried onto this new branch): `finance.ts` has real BigInt-exact reducing-balance quarterly annuity EMI, integer-paise math throughout, final-installment residue closes the schedule to exactly ₹0.00 (asserted in tests), the `capitalize_into_principal` moratorium convention is named in `config.ts` and displayed on `/finance`, and boundary rejections (₹0/empty margin, >₹50L project) are handled with clear copy. The three honesty fixes were done: `AppContext` sets an explicit `unavailable` weather state instead of fabricating one, `/sanction` labels verifier wallets as demo/fixture identities, escrow copy says "Simulated release — no blockchain transaction." `workingCapital.ts` (itemised raw material/labour/utilities/rent-transport × cycle-months) replaces the flat-% hint on `/finance`. `LOKSCORE_WEIGHTS` is already a named config object in `config.ts`, values unchanged (0.25/0.2/0.15/0.25/0.15), with a locking test.

**What I did:** `npm run build` failed on two pre-existing TypeScript errors unrelated to the task list (`feasibility.ts` unused `meta` variable; `resolveLocation.ts`'s `resolveCuratedVillage` had its `radiusKm` parameter inferred as the literal type `7` from `REACH_KM.default` via `as const`, rejecting any other number such as the live-mode radius). Fixed both: removed the dead variable, added an explicit `radiusKm: number` annotation. Also found `mandi.test.ts` was stale against `mandi.ts`'s current signature (expects `ResolvedLocation`, returns `null` for non-curated locations) — updated it and added a null-path test.

**Verified:** `npm run build` succeeds (tsc + vite build). `npm test` (vitest run) — 6 files, 26 tests, all pass, including the finance.ts boundary cases (₹1.40L flip, ₹1,38,888.89 90%-vs-cap crossover, both rejections, ₹0.00 schedule closure) and the LOKSCORE_WEIGHTS lock test. Ran the Playwright demo-path spec against a real dev server (not the stale one squatting on the configured port 5173 — see decision note below) — full Scan→Pulse→Report→Finance→Sanction flow passes with ₹10,00,000 project / ₹9,00,000 loan / Term Loan Scheme / quorum signing / simulated escrow release all correct.

**Decision:** `playwright.config.ts`'s `webServer.reuseExistingServer` was picking up an unrelated process already bound to port 5173 on this machine (Docker Desktop / WSL relay), serving stale built assets instead of the dev app — this caused `getByLabel('Full name')` to time out. This is a pre-existing environment quirk, not a bug in the app. I did not change `playwright.config.ts` (out of scope, and it's correct in CI/clean-machine conditions); I only used a local override config to verify manually. Leaving this note here so a future run doesn't waste time on it.

Commit: `5368b4a`

---

## 2026-09-12 03:25 — Item 2: adjustable reach-radius slider on /report

**What I did:** added a `<input type="range">` slider (5–10 km, step 0.5, default = the radius used at scan time) to a new "Consumer reach map" block at the top of `/report`. It drives three things live: (a) the displayed reach estimate, scaled by area ratio `(radiusKm/scanRadiusKm)²` against the original population-derived reach number — returns "population data unavailable" text instead of a fabricated number for live (non-curated) locations where population is null; (b) a `VillageMap` (not previously rendered on `/report`) whose circle radius tracks the slider; (c) competitor markers, filtered from the already-fetched competitor list by real haversine distance (`distanceKm`, added to `geo.ts`) rather than a new network call — exact when narrowing the radius, and honestly caveated ("beyond the original scan radius — actual competitor count may be higher than shown") when widening past the original scan radius, since we only know about POIs actually returned by the one Overpass query already made.

**Decision:** left the existing "Competitor density" card (the seeded/scored value used by LokScore) untouched and radius-independent — it's the number that actually drove the quorum math on `/sanction`, and I didn't want the slider to make that card appear to disagree with itself. The new live map + filtered competitor count is presented as a separate, clearly-labeled exploration tool.

**Verified:** `npm run build` clean, `npm test` 26/26. Manual Playwright check against a real dev server: moving the slider from 7km→10km changed the reach estimate from 3,234 → 6,600 and the Leaflet map rendered; re-ran the full demo-path spec afterward — still passes with correct ₹10,00,000/₹9,00,000/Term Loan numbers.

Commit: `e4f9de5`

---

## 2026-09-12 03:30 — Item 3: location beyond the 5 seed villages

**What I found:** this was already almost entirely built (pre-existing in the initial commit, not something the original audit anticipated): `src/lib/geo.ts` has real Nominatim geocode/reverse-geocode and a best-effort Overpass POI query with category-specific filters and a two-endpoint fallback; `resolveLocation.ts`'s `resolveLiveLocation` wires them together with honest `not fabricated` messaging when population/mandi/competitor data isn't available; `ScanPage.tsx` already has a curated/live radio toggle, a free-text place field, and a "use my location" GPS button.

**What I actually found broken and fixed:** the live-mode UI was calling `t('wizard.locationMode')`, `t('wizard.curated')`, `t('wizard.live')`, `t('wizard.livePlace')`, `t('wizard.useGps')`, `t('wizard.radius')`, and `t('wizard.demoHint')` — none of these keys existed in `i18n/index.ts` for *either* language, so the UI was rendering raw dotted key strings instead of labels (the EN/KN parity test didn't catch this because it only checks that both languages define the same *set* of keys, not that every `t()` call in the app resolves to a defined key). Added all 7 keys in both EN and KN.

**Verified live end-to-end against real Nominatim/Overpass** (network confirmed reachable from this environment) via a throwaway Playwright script, then deleted it:
- Happy path: "Hassan, Karnataka" free-text → geocoded correctly, Overpass returned 5 real dairy POIs within 7km, `/pulse` rendered with "Population/PPI not available — not fabricated" and "Mandi signal unavailable for this location (not fabricated)" — no invented numbers.
- Nominatim unreachable (routed to abort): scan blocked with a clear alert, never silently proceeds with a fake location.
- Overpass unreachable but geocode succeeds: proceeds to `/pulse` with "competitor Overpass failed... Density not fabricated" and the competition-gap component correctly shows "live competitor data unavailable" instead of a number.
- Re-ran the 5-seed-village demo-path spec afterward — still passes unchanged, confirming this was additive.

Commit: `bae85ff`

---

## 2026-09-12 03:33 — Item 4: LokScore radar chart + filtered plain-language reasons

**What I found:** `/pulse` already had a "LokScore breakdown" section with 5 numeric tiles and a full rationale list (`score.rationale`/`rationaleKn` from `lokScore.ts`, one sentence per component, always shown regardless of score) — but no chart, as the task explicitly asked for.

**What I did:** added a recharts `RadarChart` (5 axes: Demand/Comp. gap/Weather/Finance/Eligibility, 0-100 scale) next to the numeric tiles. Restructured the reason list to only show a component's one-line reason when its score is below a `NEAR_MAX_THRESHOLD = 85`, reusing the existing rule-based sentences already generated in `computeLokScore` (positionally mapped: rationale[0..3] = demand/competitionGap/weatherFit/financialFit, rationale[4] = the first eligibility note) rather than inventing new copy. Checked the eligibility reason text for both branches (SC-match / income-ceiling) — neither frames a shortfall as "how to change who you are to qualify," both just state the NSFDC rule and, where relevant, point to an alternate channel.

**Verified:** manual Playwright check shows the radar renders (1 polygon, correct 5 axis labels) and, on a case where eligibility scored 100, the eligibility line is correctly omitted from the reasons list while the other 4 (all below 85 in that run) show their reasons — confirming the "near max" filter works both ways. `npm run build` clean, `npm test` 26/26, demo-path spec still passes with correct numbers.

Commit: `187c0d3`

---

## 2026-09-12 03:36 — Item 5: multi-sig hardening (audit only, no code changes needed)

**Audited `multisig.ts` and `multisig.test.ts` against the task's requirements and found both already satisfied:**

- The attestation hash (`buildAttestation`'s `reportHash`, a `solidityPackedKeccak256` over `entrepreneurName, villageId, lokScore, schemeId, projectCost, loanAmount, timestamp`) already commits to every material fact the task lists: applicant, project cost, scheme, loan amount, and LokScore at signing time. The actual signed payload (`attestationMessage`) goes further and includes the hash plus every field again in human-readable form, plus quorum — so the ECDSA signature binds to the full attestation content, not just the hash.
- `AppContext.signAs` already calls `verifySignature` at sign time and throws if it fails (`multisig.ts` isn't just producing signatures that are trusted blindly elsewhere) — real enforcement, not a checkbox.
- Negative tests already exist and pass: `rejects signature from wrong key` (takes a valid signature, relabels its claimed address to a different verifier, confirms `verifySignature` returns false because the recovered signer no longer matches the claimed address) and `rejects signature over tampered attestation data` (takes a valid signature, mutates `loanAmount` on the attestation object it's checked against, confirms `verifySignature` returns false because the signed message text no longer matches). Both prove the ECDSA check is load-bearing, not decorative.

**No code changes made** — this item was already done correctly by the prior session. Re-ran `npm test` to confirm these 5 multisig tests still pass (they're part of the existing 26/26).

Commit: (log-only, folded into next commit)

---

## 2026-09-12 03:40 — Item 6: consolidated report export (print stylesheet, no new dependency)

**Decision:** MASTER_SPEC.md (line 191) explicitly recommends the print-stylesheet approach over a PDF library ("the latter is simpler and has no new heavy dependency"), matching the task's own suggestion — went with `window.print()` rather than adding jsPDF/html2canvas, especially since the production bundle is already flagged by Vite as oversized (1.2MB).

**What I built:**
- New `/export` route (`ExportPage.tsx`) reusing `buildFeasibility()` and the existing `plan`/`score`/`workingCapital`/`location` state — no duplicated business logic. Sections: applicant + location (with data-provenance line), feasibility (reach, SWOT, competitor density, pricing), finance (project cost/loan/scheme/EMI/full schedule table/working-capital breakdown), LokScore component breakdown + quorum, and a document checklist.
- New `src/lib/documentChecklist.ts`: a scheme-keyed (`micro_finance`/`term_loan`) list of generically-known NSFDC/lending KYC document categories (Aadhaar, caste certificate, income certificate, project report, etc.), explicitly labeled "Indicative list... confirm the exact requirements with your local NSFDC/SCA channel partner" since I have no authoritative source for the exact per-scheme document list and didn't want to overclaim.
- Header shows a real generation timestamp (`toLocaleString`) and a visible disclaimer: "Demo output for planning purposes only — not an official NSFDC sanction document" — same honesty posture as the rest of the app.
- Print stylesheet (`@media print` in `index.css`): hides everything marked `.no-print` (the Shell header/nav, the on-screen print button), removes the decorative background/blur, and adds `page-break-inside: avoid` on sections/table rows so the schedule table doesn't split badly.
- Linked from `/sanction` (end of the flow) and added to the main nav.

**Verified:** `npm run build` clean, `npm test` 26/26. Manual Playwright walkthrough of the full Scan→Pulse→Report→Finance→Sanction→Export flow dumped the rendered `/export` page text — confirmed every section present with correct numbers (₹10,00,000 project / ₹9,00,000 loan, full 28-quarter schedule closing to ₹0.00, LokScore breakdown, 10-item document checklist). Caught and fixed one bug during this check: the working-capital total field was mislabeled with the "Hyperlocal Feasibility Report" page title (copy-paste error) — added a proper `finance.wcTotal` key in EN/KN and fixed it. Re-ran the demo-path spec afterward — still passes.

Commit: `be1ba23`

---

## 2026-09-12 03:44 — Item 7: polish pass (reduced motion, ARIA, 360px mobile)

**What I checked and found already fine (no changes made):**
- Loading/error/empty states for network calls: weather-unavailable, mandi-unavailable, and competitor/Overpass-unavailable states were all already handled honestly (from Phase 1 / item 3 work) — verified again here rather than re-doing.
- Keyboard navigation: all interactive elements are native `<button>`/`<input>`/`<select>`/`<a>` — keyboard-reachable by default. Checked every `outline-none` usage in the codebase pairs with a `focus:ring-*` replacement (grepped for `outline-none` not followed by a focus ring — zero matches), so keyboard focus is never silently removed.
- 360px viewport: wrote a throwaway Playwright check that walks all 7 routes (/, /scan, /pulse, /report, /finance, /sanction, /export) at a 360×800 viewport and compares `document.documentElement.scrollWidth` to `clientWidth` — zero horizontal page overflow on any route. Manually screenshotted /scan, /pulse, /report, /finance at 360px: the finance repayment-schedule table and the map extend past their card edges, but both are inside their own `overflow-auto`/map containers (intentional internal scroll, not page-level overflow) — left as-is, this is a reasonable mobile pattern for a 5-column data table and didn't want to redesign a working table under time pressure. (The vertically-duplicated header seen partway down the report/finance full-page screenshots is a known Playwright/Chromium artifact of capturing `position: sticky` elements during full-page scroll-stitching, not a real rendering bug — confirmed the live page only ever shows one header at a time.)

**What I fixed:**
- `LandingPage.tsx` was the only file using framer-motion (fade/slide/scale-in on page load) and didn't respect `prefers-reduced-motion`. Wrapped it in `<MotionConfig reducedMotion="user">`, framer-motion's built-in switch that disables transform/scale animations (keeping simple opacity fades) for users with the OS-level reduced-motion preference set.
- `/sanction`'s five verifier "Sign as verifier" buttons all had the identical accessible name, so a screen-reader user tabbing through them couldn't tell which verifier a given button was for. Added `aria-label` combining the action with the verifier's name (e.g. "Sign as verifier — Priya Hegde").
- Found and fixed a real mobile bug while screenshotting: the new LokScore radar chart (item 4) clipped its "Comp. gap" axis label against the card edge at 360px width (`outerRadius="75%"` left no margin). Reduced to `62%` and added explicit chart margins.

**Verified:** `npm run build` clean, `npm test` 26/26, demo-path spec still passes (the new aria-label on sign buttons is a superset match so Playwright's substring name matching still finds "Sign as verifier"). Re-screenshotted /pulse after the radar fix — label no longer clipped.

Commit: `1cccd66`

---

## 2026-09-12 03:49 — Item 8: extended test coverage + boundary-value E2E pass

**Extended Vitest coverage** (26 → 37 tests):
- `feasibility.test.ts`: added cases for reach being `null` (never fabricated) when population data is unavailable on a live location, the mandi-unavailable threat message, the weather-unavailable threat message, and `priceCoversEmi`'s unit-count math.
- `lokScore.test.ts`: added `scoreEligibility` cases for income-above-ceiling penalty, a check that the non-SC/general rationale text never suggests changing identity (only states the NSFDC rule + points to an alternate channel), and score clamping for a maximally unfavourable profile; added `computeLokScore` cases confirming the fixed neutral fallback values (`weatherFit=45`, `competitionGap=40`) used when weather/competitor data is unavailable, rather than a fabricated number.
- `multisig.test.ts`: added a test that `reportHash` changes for every material fact independently (name/cost/scheme/loan/score — 6 distinct hashes from 6 inputs varying one field each), and a test that tampering only the quorum fields (which sit outside `reportHash`'s packed fields but inside the signed message text) still invalidates the signature — closes the gap between "what's hashed" and "what's actually signed."

**New Playwright E2E file** (`e2e/boundary-path.spec.ts`, kept in the repo, not a throwaway): drives the boundary-value inputs from item 1 through the real `/scan` UI rather than only unit-testing `buildSchemePlan` directly — zero margin, margin above the Rs 50L project cap, the exact Rs 1,40,000 Micro-Finance flip, and exactly Rs 50L still structuring a Term Loan.

**Bug found and fixed while writing this:** the two rejection tests initially failed — not a test bug. The margin input has HTML `min={1000}`/`max={NSFDC.maxMarginRupees}`, so the browser's native constraint validation silently blocked form submission (with an unstyled, English-only tooltip) before the app's own `onSubmit` handler — which has correct, bilingual, `role=alert` rejection messages already — ever ran. The app's carefully-written honesty messaging for margin=0 and margin>cap was unreachable dead code for the most common invalid inputs. Fixed by adding `noValidate` to the `<form>` so the app's own validation is authoritative.

**Verified:** `npm run build` clean, `npm test` 37/37, all 4 new boundary-path tests pass, demo-path spec still passes.

Commit: `e377c56`

---

# FINISH-LINE PASS — 2026-09-12 (continuing on autonomous/overnight-build)

New session, building on the completed 8-commit branch above. Re-verifying skeptically rather than trusting the prior "done" claims, per instructions.

## Step 0 — starting state confirmed

`git status`: clean tree. `git log --oneline -10`: 8 commits (`28bf536` down to `14d59fe`), matches the prior end-of-run summary exactly.

## Step 1 — independent re-verification

**Clean rebuild from scratch:** `rm -rf node_modules dist`, then `npm install` (207 packages; reverted an incidental `package-lock.json` diff npm produced, same harmless normalization noise as last time), `npm run build` (clean, same 500kB chunk-size warning as before — that's step 2's job), `npx vitest run` — **37/37 pass** from a genuinely clean install, not incremental. Ran the full Playwright suite (`demo-path` + 4 `boundary-path` specs) against a real dev server — **5/5 pass**.

**Read the actual code, not just the log's claims:**
- `finance.ts`: confirmed for real — `annuityEmiPaise` does exact BigInt rational arithmetic for `EMI = P·r·(1+r)^n / ((1+r)^n − 1)` with `r` as an exact `tenths/4000` fraction (no floating-point drift in the compounding), `quarterlyInterestPaise` and `ninetyPercentPaise` are pure integer math, the final repayment quarter is set to `remaining + interest` and `remaining` is zeroed explicitly (not just close-to-zero) — so `closingPrincipalPaise` is exactly 0, matching the test assertion. This holds up.
- `weather.ts`: `unavailableWeather()` returns explicit sentinel values (`tempMax/tempMin: 0`, `code: -1`, `source: 'unavailable'`) rather than any invented plausible-looking temperature, and both `/pulse` and `/report` gate their display on `weather.source === 'unavailable'` before ever showing a number. Holds up.
- `SanctionPage.tsx`: escrow release button and post-release panel both read from `t('sanction.release')`/`t('sanction.simulatedRelease')`/`t('sanction.escrowSketch')`, which resolve to "Simulate escrow release" / "Simulated release — no blockchain transaction" / "UI sketch only... nothing moves on-chain or to a bank." Holds up.

**Manually exercised the live-location feature with Shivamogga, Karnataka** — a real town, not one of the 5 seed villages (Dinka/Kabbenur/Sulebhavi/Kunigal/Sakleshpur) — via a throwaway Playwright script (written, run, and deleted; not part of the diff). Result: genuinely geocoded to "Shivamogga · Shivamogga taluk" via Nominatim, a real Overpass query returned "1 similar POIs within 7 km," real Open-Meteo weather (31°/22°, Overcast), and the page correctly said "Population/PPI not available — not fabricated" and "Mandi signal unavailable for this location (not fabricated)" rather than silently reusing any seed village's numbers — confirmed none of the 5 seed village names appeared anywhere on the page. This claim holds up under a fresh, adversarial check with a town the prior session never tried.

**Conclusion: all of the prior session's "done" claims for item 1 hold up under skeptical re-verification. No fixes needed here.** Proceeding to step 2.

## Step 2 — code-splitting to fix the 500kB chunk warning

Two changes:
1. **Route-level splitting** (`App.tsx`): every page except `LandingPage` (kept eager for a fast first paint) is now `React.lazy(() => import(...))`, wrapped in a `<Suspense>` with a minimal "Loading…" fallback. This pulled `PulsePage` (recharts) and `VillageMap` (react-leaflet, shared by `/pulse` and `/report`) out into their own on-demand chunks (410kB and 155kB respectively) instead of the main bundle.
2. **Deferred ethers** (`AppContext.tsx`): `multisig.ts` (ethers) was previously a static top-level import in `AppContext`, which wraps the entire app — meaning ethers loaded on the landing page even though nothing there ever signs anything. Replaced the static import with a cached dynamic `import('../lib/multisig')`, loaded on first `setProfileAndScan` call (i.e., when the user actually submits the scan form) rather than at app mount. The resolved module is cached in a promise (module-level) and a ref (per-provider-instance) so `signAs`/`releaseEscrow` use the already-loaded functions synchronously rather than re-importing. `verifiers` moved from an eager `useMemo(() => createVerifierPool())` to `useState<Verifier[]>([])`, populated from the same dynamic-import call. This put ethers into its own 158kB chunk, loaded only when a scan actually runs.
3. **Bonus cleanup:** `mandi.ts` had a `const { BUSINESS_META } = await import('../data/villages')` that Vite flagged as `INEFFECTIVE_DYNAMIC_IMPORT` (villages.ts is already statically imported by half a dozen other modules loaded alongside it, so the dynamic import bought nothing but a build warning). Converted to a plain static import.

**Result:** main entry chunk dropped from 589.58 kB to 431.16 kB minified; the "chunks larger than 500 kB" warning is gone entirely from `npm run build` output, as is the `INEFFECTIVE_DYNAMIC_IMPORT` warning. No page now exceeds ~410kB (PulsePage/recharts, loaded only when visiting `/pulse`).

**Verified this didn't break real signing:** re-ran the full test suite (`npm test` 37/37) and the full Playwright suite (5/5, including the demo-path spec which signs with 5 real ECDSA verifier wallets and releases the simulated escrow) after both changes. The deferred-import refactor is a loading-time change only — `signAttestation`/`verifySignature` still do real secp256k1 ECDSA via the same `ethers.Wallet`/`verifyMessage` calls as before, just imported lazily.

## Step 3 — sweep every form field for the same "native validation defeats custom UI" bug class

**Scope check first:** `grep -rn "<form" src` — `ScanPage.tsx` is the *only* `<form>` element in the entire app (every other route is read-only display/sign/print, no inputs to validate). So the sweep is scoped to that one form's fields.

**What I found:** the `noValidate` fix from the prior round's item 8 (added to stop the margin field's native `min`/`max` from silently blocking the app's own rejection message) disables *all* native HTML validation on the form — not just margin's. That silently created a **new** gap for three other fields that used to be enforced by native attributes with no custom JS backing them: `name` (`required`), `age` (`min={18} max={70}`), and `experienceYears` (`min={0}`) could now be submitted empty/out-of-range/negative with **zero** validation, native or custom — a regression I introduced myself last round and had not re-checked until this explicit sweep.

**Fix:** added three checks to `ScanPage.tsx`'s `onSubmit`, in the same style as the existing margin checks (bilingual, sets `localErr` which renders as the existing `role=alert` element): empty/whitespace-only name, age outside 18–70, negative experience years. The `min`/`max`/`required` JSX attributes are left in place as semantic hints (screen readers still announce "required"; number-input spinner arrows still respect min/max) but `noValidate` means they can never again silently block submission without the app's own message showing.

**Regression tests added** (`e2e/boundary-path.spec.ts`, new `describe` block): empty name, age=15, experience=-3 — each asserts a visible `role=alert` containing the relevant word and that the page stays on `/scan`. Caught one test-authoring bug while writing these: Playwright's `getByLabel('Age')` substring-matched "Choose a seeded **vill*age***" (the word "village" literally contains "age") — fixed with `{ exact: true }`, not an app bug.

**Verified:** all 7 `boundary-path.spec.ts` tests pass (4 from before + 3 new), full `npm test` 37/37, demo-path spec still passes, `npm run build` still clean with no new warnings.

## Step 4 — full i18n re-check

**Automated check first:** the existing `src/i18n/parity.test.ts` only proves the EN and KN key *trees* are identical — it doesn't prove every `t('...')` call in the app actually resolves to a defined key (that exact gap caused the missing-`wizard.*`-keys bug found and fixed two rounds ago). So I extracted every static `t('...')` call across `src/pages` and `src/components` (113 unique keys) with a throwaway script and confirmed all 113 resolve in both `en` and `kn` — clean.

**Manual click-through in Kannada** (throwaway Playwright script, written/run/deleted): toggled to Kannada on `/`, then navigated via real client-side link clicks (not `page.goto`, which triggers a hard reload — this app's `i18n.init` has no persistence/`LanguageDetector`, so a hard reload always resets to English; that's a pre-existing characteristic unrelated to this step, not something to fix here) through `/scan` → `/pulse` → `/report` → `/finance` → `/sanction` → `/export`, and separately the live-location free-text UI. Dumped full page text at each stop.

**Found and fixed two genuine leaks, both introduced by this branch's own work:**
1. **The Suspense loading fallback added in step 2** (`App.tsx`'s `RouteFallback`) was hardcoded `"Loading…"` with no Kannada string at all — a real, reachable English string for a Kannada-mode user on first load of any lazy route chunk. Added a `common.loading` i18n key in both languages and wired the fallback through `useTranslation()`.
2. **FinancePage.tsx and ExportPage.tsx** (both substantially rewritten by this branch in earlier rounds) hardcoded `"${rate}% p.a."`, `"${years} yrs"`, `"${months} mo"` for the Interest/Tenure/Moratorium tiles regardless of language, even though the *labels* right next to them were already correctly bilingual (`kn ? 'ಬಡ್ಡಿ' : 'Interest'`) — an inconsistency where half of each tile localized and half didn't. Fixed both files identically: `kn ? 'ವಾರ್ಷಿಕ 8%' : '8% p.a.'`-style values, using the same terms (ವರ್ಷ/ತಿಂಗಳು) already used elsewhere in the same file's "Routing logic" section for consistency.

**Found and deliberately left alone (pre-existing, out of this step's scope, disclosed rather than silently ignored):**
- Mandi commodity/market names (e.g. "Milk · 39 ₹/litre", "Mandya APMC") come from `villages.ts`/`mandi.ts` seed data that has never had Kannada fields — this is pre-existing data-modeling scope (seed data, not new UI copy this branch added) and a much bigger lift (would need a `commodityKn`/`marketKn` field on every seed record) than a 2-string label fix. Flagging for a future pass, not fixing under this step.
- The weather chart's weekday abbreviations ("Sun Mon Tue…") come from `date-fns`'s `format(date, 'EEE')` with no locale argument, so they're always English regardless of app language. `date-fns` does not ship an official Kannada locale, so fixing this properly would mean hand-rolling a weekday abbreviation map rather than a one-line locale swap — judged out of proportion for this step given it's a pre-existing chart, not new work.
- Financial schedule due-date labels (e.g. "Dec 2026") use `toLocaleDateString('en-IN', ...)` regardless of language, same as `formatINR`'s Indian-numeral grouping — left alone deliberately since numerals/date-grouping conventions commonly stay in a consistent format across languages in Indian financial documents, and changing it risks inconsistent `Intl` locale support across browsers for a `kn-IN` locale that wasn't part of any explicit requirement.

**Verified:** `npm run build` clean, `npm test` 37/37, full Playwright suite (demo-path + 7 boundary-path tests) 8/8 pass after the i18n fixes.

