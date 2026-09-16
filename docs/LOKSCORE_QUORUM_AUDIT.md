# LokScore → Adaptive Quorum Audit (read-only)

Owner of this note: Jordan (Blockchain & Approval Platform).
Owner of the scoring code: Prerna. **Nothing in `src/lib/lokScore.ts` or
`src/lib/config.ts` was changed to produce this document.**

Sources audited: `src/lib/lokScore.ts`, `src/lib/config.ts`,
`src/lib/finance.ts`, `src/lib/mandi.ts`, `src/lib/resolveLocation.ts`,
`src/lib/geo.ts`, `src/data/villages.ts`, `src/data/festivals.ts`.

Verification: the formulas below were replayed by hand against a live scan of
the running app (Dinka / dairy / ₹1,00,000 margin, live weather with
`precipProb = 100`, mandi trend `down`). The hand calculation reproduces the
rendered breakdown exactly — demand 60, competition gap 56, weather 50,
finance 29, eligibility 100, total 56 — so the model in this note matches
shipped behaviour.

---

## 1. Inputs used by the current calculation

`computeLokScore({ profile, location, weather, mandi, plan })`

**From `EntrepreneurProfile`:** `category`, `availableMargin`, `community`,
`annualIncome`, `gender`, `age`.
Not used by the score: `name`, `experienceYears`, `phone`, `radiusKm`,
`locationMode`, `demoMode`, `liveQuery/liveLat/liveLng`, `villageId`
(the resolved location is used instead).

**From `ResolvedLocation`:** `purchasingPowerIndex`, `competitorDensity[category]`,
`milkCoopPresence`, `competitorQueryOk`, `provenance`, `hasCuratedSignals`, `id`.

**From `WeatherSignal`:** `source`, `tempMax`, `precipProb`.

**From `MandiSignal | null`:** `source`, `trend`.

**From `SchemePlan` (finance, not recomputed here):** `quarterlyEmi`,
`opsCostMonthly`, `schemeId`.

**From `src/data/festivals.ts`:** `getUpcomingEvents(location.id)` →
`demandLift[category]`, only when `location.hasCuratedSignals` is true.

## 2. Component weights (`LOKSCORE_WEIGHTS`)

| Component | Weight |
|---|---|
| demand | 0.25 |
| competitionGap | 0.20 |
| weather | 0.15 |
| finance | 0.25 |
| eligibility | 0.15 |

`total = clamp(round(Σ component × weight), 0, 100)`. Every component is
individually clamped to 0–100 first.

## 3. Normalization, thresholds, bonuses, penalties

**demand**
- base `35 + purchasingPowerIndex × 25`; if PPI is `null`, base is a flat `45`
- `+ min(30, Σ demandLift[category] × 50)` over upcoming curated events
- `+8` if mandi `source === 'seeded'` and `trend === 'up'`
- `−6` if mandi `source === 'seeded'` and `trend === 'down'`
- `+5` if `category === 'dairy'` and `milkCoopPresence`
- clamped 0–100

**competitionGap**
- if `!competitorQueryOk && provenance !== 'curated_seed'` → flat `40`
- else `(1 − competitorDensity[category]) × 100`
- `+18` if `category === 'dairy'` and `milkCoopPresence` and `density > 0.55`
- clamped 0–100

**weather**
- `source === 'unavailable'` → `45`
- dairy or poultry → `tempMax > 38 ? 35 : precipProb > 70 ? 50 : 78`
- food → `precipProb > 60 ? 45 : 75`
- agri_processing → `precipProb > 50 ? 70 : 60`
- retail or textiles → `precipProb > 75 ? 48 : 72`

**finance**
- `monthlyRevenueProxy = availableMargin × 0.12 × (0.7 + ppi × 0.5)`, `ppi = purchasingPowerIndex ?? 0.55`
- `monthlyEmi = quarterlyEmi / 3`
- `coverage = monthlyRevenueProxy / (monthlyEmi + opsCostMonthly)`
- `financialFit = clamp(coverage × 55)`, then `+15` if scheme is `micro_finance` or `term_loan`
- `= 25` (overwrite) if scheme is `over_limit`; clamped 0–100

**eligibility** (`scoreEligibility`)
- base `40`
- `+35` if `community === 'sc'`
- `+15` if `annualIncome ≤ 500000`, else `−20`
- `+10` if `gender === 'female'`
- `+5` if `18 ≤ age ≤ 45`
- clamped 0–100 (max reachable input sum is 105 → clamps to 100)

## 4. Existing quorum thresholds and outputs

`QUORUM_THRESHOLDS = { high: 80, mid: 60 }`

| Condition | quorumRequired | quorumPool | mentorRequired |
|---|---|---|---|
| `total ≥ 80` | 2 | 3 | false |
| `60 ≤ total < 80` | 3 | 5 | false |
| `total < 60` | 4 | 5 | true |

Grade (separate from quorum): `≥80 A`, `≥65 B`, `≥50 C`, else `D`.

## 5. Exact conditions per band

Because weights sum to 1 and each component is 0–100, the band is decided
purely by the weighted sum:

- **≥80** requires `0.25·demand + 0.20·gap + 0.15·weather + 0.25·finance + 0.15·elig ≥ 79.5` (rounding).
- **60–79** requires that sum in `[59.5, 79.5)`.
- **<60 / mentor-required** requires the sum `< 59.5`.

The binding constraint is `finance`. Since `opsCostMonthly` is
`0.035 × projectCost` (term) or `0.04 × projectCost` (micro) and
`projectCost = 10 × availableMargin`, and the annuity EMI is also linear in
the margin, `coverage` is **margin-invariant**:

- Term loan: `monthlyEmi ≈ 0.1551 × margin`, `opsCostMonthly = 0.35 × margin`
  → `coverage = 0.12 × (0.7 + 0.5·ppi) / 0.5051`
- At the highest seeded PPI (0.74, Kunigal): `coverage ≈ 0.2542` →
  `finance ≈ 0.2542 × 55 + 15 ≈ 28.98`

So `finance ≤ ~29` for every applicant, contributing at most
`0.25 × 28.98 ≈ 7.25` of its available 25 points. That single component
forfeits ≈17.75 points before any other input is considered.

## 6–7. Best legitimate curated profile (worked transparently)

The highest-scoring coupled profile reachable through `/scan` today:

| Field | Value |
|---|---|
| Village | Dinka, Mandya (`dinka-mandya`) |
| Category | Textiles |
| Gender | Female |
| Community | SC |
| Annual income | ₹1,80,000 |
| Age | 29 |
| Available margin | ₹1,00,000 (→ ₹10,00,000 project, NSFDC Term Loan) |
| Weather | live, `tempMax 31`, `precipProb ≤ 75` |
| Mandi | seeded, trend `up` (date-seeded, not selectable) |

Component by component, using only existing rules:

- **demand** = `35 + 0.68×25` = 52; Ugadi market week lifts textiles by 0.50 →
  `min(30, 25)` = +25 → 77; mandi up → +8 → **85** (flat mandi → 77, down → 71)
- **competitionGap** = `(1 − 0.28) × 100` = **72** (no dairy bonus)
- **weather** (textiles branch, `precipProb ≤ 75`) = **72**
- **finance**, PPI 0.68 → `coverage = 0.1248 / 0.5051 = 0.2471` →
  `0.2471 × 55 = 13.59`, `+15` = **28.59**
- **eligibility** = `40 + 35 + 15 + 10 + 5` = 105 → clamp **100**

Weighted total:

```
0.25 × 85    = 21.25
0.20 × 72    = 14.40
0.15 × 72    = 10.80
0.25 × 28.59 =  7.15
0.15 × 100   = 15.00
              ------
total        = 68.60  → 69   (grade B, 3-of-5, mentorRequired = false)
```

With a flat mandi trend the same profile scores 67. Either way it lands in the
**60–79 band**, not ≥80.

## 8. Why ≥80 is unreachable under the current rules

Upper bounds are proved separately for the two location modes, because they
are mutually exclusive.

**Curated mode** (one of the 5 seeded villages):
- `demand ≤ 88.5` — max is `35 + 0.72×25` (Sulebhavi PPI) `+ 0.55×50` (the
  largest `demandLift` anywhere: food at Sulebhavi) `+ 8` (mandi up)
- `competitionGap ≤ 78` — lowest seeded density is textiles 0.22 at Sakleshpur
- `weather ≤ 78` — dairy/poultry, mild temperature and low rain
- `finance ≤ 28.98` — shown above
- `eligibility ≤ 100`

Even mixing these best-of-each values across different villages and
categories (impossible in one real profile):

```
0.25 × 88.5  = 22.125
0.20 × 78    = 15.600
0.15 × 78    = 11.700
0.25 × 28.98 =  7.245
0.15 × 100   = 15.000
                ------
                71.67  → 72
```

**Live-lookup mode** (any Indian place): `purchasingPowerIndex` is `null`,
`hasCuratedSignals` is false, and `fetchMandiSignal` returns `null`. So demand
is fixed at exactly **45** (no PPI term, no event lift, no mandi bonus, and
`milkCoopPresence` is false). `competitionGap` can reach 100 when Overpass
returns zero matching POIs, and `finance` uses the `0.55` PPI fallback → 27.74:

```
0.25 × 45    = 11.250
0.20 × 100   = 20.000
0.15 × 78    = 11.700
0.25 × 27.74 =  6.935
0.15 × 100   = 15.000
                ------
                64.885 → 65
```

**Therefore the global ceiling of the current LokScore is 72**, and the best
genuinely reachable profile scores **69**. `total ≥ 80` is unreachable for
every possible applicant, location, category, weather state, and margin.

The dominant cause is structural, not a tuning accident: `finance` carries 25%
of the weight but is capped near 29/100 because operating cost and EMI both
scale linearly with the same margin that drives the revenue proxy.

Consequently the **3-of-5 band (60–79) is the correct live demo**, per
Kashif's approved fallback. The 2-of-3 path remains implemented and unit-tested
in the approval layer (`src/lib/approval/*`), just not reachable from `/scan`.

## Tests run (unchanged)

`npx vitest run src/lib/lokScore.test.ts src/lib/multisig.test.ts src/lib/approval src/lib/finance.test.ts`
→ 8 files, 54 tests, all passing. No test file was modified.
