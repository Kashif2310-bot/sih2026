/**
 * Best-effort persistence of Phase 3 discovery attempts into
 * public.official_discovery_retrievals
 * (see supabase/migrations/202609170002_official_discovery_retrievals.sql).
 *
 * Does NOT write to Kashif's public.scheme_retrievals — that table is owned by
 * live-scheme-retrieval (source/query/status shape). Fire-and-forget: a logging
 * failure must never affect retrieval or discovery results.
 */

import type { LokPulseSupabaseClient } from '../../supabase/client'
import { cacheKeyFor } from './cache'
import type { RetrievalAttemptLogEntry } from './types'

export function createSupabaseRetrievalAuditLogger(
  client: LokPulseSupabaseClient,
): (entry: RetrievalAttemptLogEntry) => void {
  return (entry: RetrievalAttemptLogEntry) => {
    void client
      .from('official_discovery_retrievals')
      .insert({
        source_adapter_id: entry.sourceAdapterId,
        pass_type: entry.pass,
        query_signature: cacheKeyFor({ pass: entry.pass }),
        ok: entry.ok,
        record_count: entry.recordCount,
        latency_ms: entry.latencyMs,
        error_message: entry.errorMessage ?? null,
        attempted_at: entry.at,
      })
      .then(
        () => {},
        () => {
          // Best-effort audit log — swallow failures (e.g. table not migrated yet, RLS, offline).
        },
      )
  }
}
