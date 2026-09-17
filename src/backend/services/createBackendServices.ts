/**
 * Backend runtime factory.
 * - memory: always in-process (default when Supabase unset — prototype safe)
 * - supabase: wired clients; scheme reads resiliently fall back to fixture
 * - browser auto: schemes may use anon+resilient; writes stay memory until a
 *   service/session client is injected (avoids breaking the SPA on outages)
 */

import type {
  ApplicationPersistenceService,
  ApplicationStatusService,
  ProfileService,
  RecommendationService,
  SchemeRegistry,
} from './types'
import { createMemoryProfileService } from './memoryProfileService'
import { createMemoryApplicationServices } from './memoryApplicationServices'
import { createRecommendationService } from './recommendationService'
import { createFixtureSchemeRegistry } from '../registry/fixtureSchemeRegistry'
import {
  createResilientSchemeRetrievalService,
  createSupabaseSchemeRetrievalService,
} from './supabaseSchemeRetrievalService'
import { createSupabaseProfileService } from './supabaseProfileService'
import { createSupabaseApplicationServices } from './supabaseApplicationServices'
import {
  tryCreateAnonClient,
  tryCreateServiceRoleClient,
  type LokPulseSupabaseClient,
} from '../supabase/client'
import { getSupabasePublicConfig, getSupabaseServerConfig } from '../supabase/config'
import { createDataGovInAdapter } from './officialSource/dataGovInAdapter'
import { createOfficialSchemeDiscoveryService } from './officialSource/officialSchemeDiscoveryService'
import { createRetrievalOrchestrator } from './officialSource/orchestrator'
import { createSupabaseRetrievalAuditLogger } from './officialSource/supabaseRetrievalAuditLogger'
import type { OfficialSchemeDiscoveryService } from './officialSource/officialSchemeDiscoveryService'

export type BackendMode = 'auto' | 'memory' | 'supabase'

export interface BackendServices {
  mode: 'memory' | 'supabase' | 'hybrid'
  profiles: ProfileService
  schemes: SchemeRegistry
  recommendations: RecommendationService
  applications: ApplicationPersistenceService
  applicationStatus: ApplicationStatusService
  /** True when supabase URL/anon present (may still be using memory for writes). */
  supabaseConfigured: boolean
  /**
   * Phase 3 — official government-source discovery (data.gov.in etc.),
   * additive to `schemes`. Optional so existing callers/mocks of
   * BackendServices built before Phase 3 keep typechecking unchanged.
   */
  discovery?: OfficialSchemeDiscoveryService
}

/**
 * One process-wide orchestrator so source health/cache survive across
 * createBackendServices() calls. The audit sink (when a Supabase client is
 * available on first construction) is fixed for the process lifetime —
 * acceptable for a prototype; revisit if callers need it swapped at runtime.
 */
let sharedDiscovery: OfficialSchemeDiscoveryService | null = null

function getSharedDiscovery(fixture: SchemeRegistry, client?: LokPulseSupabaseClient | null): OfficialSchemeDiscoveryService {
  if (!sharedDiscovery) {
    const onAttempt = client ? createSupabaseRetrievalAuditLogger(client) : undefined
    const orchestrator = createRetrievalOrchestrator([createDataGovInAdapter()], { onAttempt })
    sharedDiscovery = createOfficialSchemeDiscoveryService(orchestrator, fixture)
  }
  return sharedDiscovery
}

export interface CreateBackendServicesOptions {
  mode?: BackendMode
  /**
   * Injected client (tests). When provided with mode supabase/auto, used for all Supabase I/O.
   * Prefer service-role in Node integration tests.
   */
  client?: LokPulseSupabaseClient
  /**
   * When true (default in browser auto), keep profile/application writes in memory
   * even if anon Supabase is configured — prevents SPA breakage without auth.
   */
  browserWriteMemory?: boolean
}

function memoryBundle(supabaseConfigured: boolean): BackendServices {
  const memory = createMemoryApplicationServices()
  const schemes = createFixtureSchemeRegistry()
  return {
    mode: 'memory',
    profiles: createMemoryProfileService(),
    schemes,
    recommendations: createRecommendationService(schemes),
    applications: memory.persistence,
    applicationStatus: memory.status,
    supabaseConfigured,
    discovery: getSharedDiscovery(schemes),
  }
}

function resolveClient(opts?: CreateBackendServicesOptions): LokPulseSupabaseClient | null {
  if (opts?.client) return opts.client
  return tryCreateServiceRoleClient() ?? tryCreateAnonClient()
}

export function createBackendServices(opts: CreateBackendServicesOptions = {}): BackendServices {
  const mode: BackendMode = opts.mode ?? 'auto'
  const publicCfg = getSupabasePublicConfig()
  const serverCfg = getSupabaseServerConfig()

  if (mode === 'memory') {
    return memoryBundle(publicCfg.configured)
  }

  const wantSupabase =
    mode === 'supabase' || publicCfg.configured || serverCfg.serviceConfigured

  if (!wantSupabase) {
    return memoryBundle(publicCfg.configured)
  }

  const client = resolveClient(opts)
  if (!client) {
    return memoryBundle(false)
  }

  const fixture = createFixtureSchemeRegistry()
  const remote = createSupabaseSchemeRetrievalService(client)
  const schemes = createResilientSchemeRetrievalService(remote, fixture)

  const inBrowser = typeof window !== 'undefined'
  const forceMemoryWrites =
    opts.browserWriteMemory ?? (inBrowser && !opts.client && !serverCfg.serviceConfigured)

  if (forceMemoryWrites) {
    const memory = createMemoryApplicationServices()
    return {
      mode: 'hybrid',
      profiles: createMemoryProfileService(),
      schemes,
      recommendations: createRecommendationService(schemes),
      applications: memory.persistence,
      applicationStatus: memory.status,
      supabaseConfigured: true,
      discovery: getSharedDiscovery(fixture, client),
    }
  }

  const apps = createSupabaseApplicationServices(client)
  return {
    mode: 'supabase',
    profiles: createSupabaseProfileService(client),
    schemes,
    recommendations: createRecommendationService(schemes),
    applications: apps.persistence,
    applicationStatus: apps.status,
    discovery: getSharedDiscovery(fixture, client),
    supabaseConfigured: true,
  }
}
