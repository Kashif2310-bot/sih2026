/**
 * Probes whether Option A hosted tables exist (no secrets printed).
 * Usage: node scripts/probe-hosted-schema.mjs
 * Reads .env.local if present.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return process.env
  const raw = readFileSync(path, 'utf8')
  const out = { ...process.env }
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i)] = line.slice(i + 1)
  }
  return out
}

const env = loadEnv()
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL / key in env or .env.local')
  process.exit(1)
}

const tables = [
  'schemes',
  'scheme_retrievals',
  'ministries',
  'departments',
  'applicant_profiles',
  'applications',
  'approval_cases',
  'approval_signatures',
  'approval_audit_events',
  'chain_anchors',
  'official_discovery_retrievals',
]

let missing = 0
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const ok = r.status === 200
  if (!ok) missing++
  console.log(`${ok ? 'OK ' : 'MISS'} ${t}  HTTP ${r.status}`)
}

if (missing) {
  console.log(`\n${missing} table(s) missing. Apply supabase/bundles/option_a_hosted_apply.sql in the SQL Editor.`)
  console.log('See docs/BACKEND_SETUP.md')
  process.exit(2)
}
console.log('\nAll Option A tables reachable.')
