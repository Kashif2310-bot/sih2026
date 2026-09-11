# LokPulse — SIH26091

**AI-Driven Hyper-Local Business Advisory & Financial Structuring for Rural Micro-Entrepreneurs**  
Ministry of Social Justice & Empowerment · NSFDC schemes · English + Kannada

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. Demo path: **Start Opportunity Scan** → use defaults (SC woman, Dinka dairy, ₹1L margin) → walk Pulse → Report → Finance → Sanction (sign 2–3 verifiers).

## What makes this not “another chatbot”

| Typical SIH build | LokPulse |
| --- | --- |
| NLP Q&A chatbot | **Temporal Opportunity Graph** — jatra × weather × mandi × competition |
| Generic SWOT text | Village-level feasibility with live map reach rings |
| Rough EMI math | **Exact NSFDC router** (10% margin, Micro ≤1.40L / Term ≤50L, moratorium schedules) |
| Scheme dump | Eligibility-aware **LokScore** → **adaptive multi-sig quorum** + escrow release |

## Working pieces (not whiteboard)

1. **Live weather** from Open-Meteo for the selected Karnataka village lat/lng  
2. **NSFDC financial engine** matching SIH26091 / NSFDC Micro Finance & Term Loan rules  
3. **Real ECDSA multi-sig attestations** (ethers.js secp256k1) — verifiable signatures, not checkboxes  
4. **EN / KN** toggle across the full flow  
5. Solidity sketch in `contracts/AdaptiveSanction.sol` for on-chain sanction + DBT event rail  

## Product thesis (judges)

Rural failure is rarely “no loan”. It is **wrong activity, wrong timing, wrong structure**. LokPulse answers: *what should this person start, in this gram panchayat, in the next 14 days, with this margin — and who must co-sign before money moves.*
