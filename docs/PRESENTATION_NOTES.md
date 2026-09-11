# Presentation Notes — for whoever presents this

One honest page. Say these things plainly if asked — don't let a judge discover the gap between "live" and "simulated" themselves.

## Genuinely live (real network calls, real crypto, no mocking)

- **Weather** — `Open-Meteo` API (`src/lib/weather.ts`), called with the actual resolved lat/lng for either a seeded village or a live-searched location. On failure, the app shows an explicit "unavailable" state (`source: 'unavailable'`, no number rendered) — it never fabricates a plausible-looking temperature.
- **Geocoding** — `Nominatim` (OpenStreetMap) for free-text place search and reverse-geocoding from GPS coordinates (`src/lib/geo.ts`). No API key, real HTTP calls.
- **Competitor / business density lookup** — the `Overpass API` (OpenStreetMap), queried for nearby businesses matching the selected category within the reach radius. Feeds both the map markers and the competition-gap LokScore component. On failure, density is marked unavailable rather than guessed.
- **Digital signatures** — `ethers.js` real secp256k1 ECDSA (`src/lib/multisig.ts`). Five demo verifier wallets each hold a real private key; signing produces a real signature that is cryptographically verified before being accepted, and a wrong-key or tampered-attestation signature is provably rejected (see the negative tests in `multisig.test.ts`). This is not a checkbox standing in for "signed."
- **NSFDC financial math** — the reducing-balance quarterly annuity EMI, integer-paise arithmetic, and the ₹1.40L / 90% / ₹1.25L / ₹45L / 6.5% / 8% / 3yr / 7yr / 3mo / 6mo scheme constants are all real, computed values — not a lookup table of pre-baked answers.

## Clearly labeled as simulated (present these as prototypes, not production features)

- **Escrow release** (`/sanction`) — once quorum is met, the "release" button records a simulated release in local state only. The UI says outright: *"Simulated release — no blockchain transaction."* Nothing moves on-chain or to a bank. `contracts/AdaptiveSanction.sol` exists as a Solidity sketch for what a real on-chain sanction + DBT rail would look like, but it is not deployed anywhere or wired into the app.
- **Verifier identities** — the five signing wallets on `/sanction` are demo/fixture keys generated at build time, explicitly labeled on-screen as *"Demo / fixture identities — not real government officer accounts."* In a real deployment these would map to actual SCA officer / bank channel partner / mentor accounts with real authentication.
- **Document checklist** (`/export`) — the list of documents shown per scheme (Aadhaar, caste certificate, project report, etc.) is an indicative list of commonly-required categories for this kind of scheme, not sourced from an official NSFDC circular. The export page says so explicitly and tells the applicant to confirm exact requirements with their local NSFDC/SCA channel partner.

## Deliberately deferred (and why)

- **Hindi.** Only English and Kannada are implemented, key-parity-tested against each other. Hindi was explicitly out of scope for this build pass due to time — not a technical blocker, just not done yet.
- **Post-disbursement monitoring** (a "digital twin" of the funded business, an officer dashboard for tracking repayment/performance after the loan is sanctioned, etc.) — this is a different product-roadmap phase. This build stops at sanction; what happens after money moves is a separate decision the team hasn't made yet, and building it now would have meant guessing at requirements nobody has confirmed.
- **Native Kannada review.** The Kannada strings in this app were written and verified for parity (same key structure as English, no missing/leaking-English keys — checked as part of this build's verification pass) but have not been reviewed by a native Kannada speaker for phrasing, register, or naturalness. Treat the Kannada as functionally complete but not yet polished by a native reviewer.
- **Backend / persistence / real auth.** Everything lives in-browser, in memory, for the duration of one session. There is no server, no database, no login. This was a deliberate scope boundary for this phase, not an oversight.

## TODO — team fills in

**Why does this prototype's real-signature / adaptive-quorum multi-sig approach differ from the original idea-round pitch?**

This needs an answer from whoever was in the room for the idea round — what the original pitch proposed for the sanction/approval mechanism, and why the team moved to real ECDSA signatures with an adaptive quorum tied to LokScore instead. Don't present a guess here; if asked and this section is still blank, say "that's a good question for [team member]" rather than improvising a rationale that wasn't actually the team's reasoning.
