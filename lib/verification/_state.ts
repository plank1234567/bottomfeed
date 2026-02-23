/**
 * Verification System - Shared Mutable State (Internal)
 *
 * In-memory Maps backed by write-through persistence to Supabase.
 * This module is internal to lib/verification/ and should not be
 * imported from outside the verification package.
 */

import { logger } from '@/lib/logger';
import * as VerificationPersistence from '@/lib/db-supabase/verification';
import type {
  VerificationSession,
  Challenge,
  SpotCheck,
  VerifiedAgentState,
  SpotCheckResult,
} from './types';
import type { TrustTier } from '@/types';
import {
  MS_PER_DAY,
  SPOT_CHECK_WINDOW_DAYS,
  MAX_FAILURES_IN_WINDOW,
  MAX_FAILURE_RATE,
  MIN_CHECKS_FOR_RATE,
} from './types';
import type { DailyChallenge } from './types';

// ---- In-memory caches (Maps) ----

export const verificationSessions = new Map<string, VerificationSession>();

export const verifiedAgents = new Map<string, VerifiedAgentState>();

export const pendingSpotChecks = new Map<string, SpotCheck>();

// ---- Write-through persistence helpers ----

export async function persistSession(sessionId: string): Promise<void> {
  const session = verificationSessions.get(sessionId);
  if (!session) return;
  try {
    await VerificationPersistence.saveSession({
      id: session.id,
      agent_id: session.agentId,
      webhook_url: session.webhookUrl,
      status: session.status,
      current_day: session.currentDay,
      daily_challenges: session.dailyChallenges,
      started_at: session.startedAt,
      completed_at: session.completedAt ?? null,
      failure_reason: session.failureReason ?? null,
    });
  } catch (e) {
    logger.error(
      'Failed to persist verification session',
      e instanceof Error ? e : new Error(String(e))
    );
  }
}

export async function persistVerifiedAgent(agentId: string): Promise<void> {
  const agent = verifiedAgents.get(agentId);
  if (!agent) return;
  try {
    await VerificationPersistence.saveVerifiedAgent(agentId, agent);
  } catch (e) {
    logger.error('Failed to persist verified agent', e instanceof Error ? e : new Error(String(e)));
  }
}

export async function persistSpotCheck(spotCheckId: string): Promise<void> {
  const sc = pendingSpotChecks.get(spotCheckId);
  if (!sc) return;
  try {
    await VerificationPersistence.saveSpotCheck({
      id: sc.id,
      agent_id: sc.agentId,
      challenge: sc.challenge,
      scheduled_for: sc.scheduledFor,
      completed_at: sc.completedAt ?? null,
      passed: sc.passed ?? null,
    });
  } catch (e) {
    logger.error('Failed to persist spot check', e instanceof Error ? e : new Error(String(e)));
  }
}

// ---- Database initialization ----

const _initPromise = Promise.all([
  VerificationPersistence.loadVerificationSessions(),
  VerificationPersistence.loadVerifiedAgents(),
  VerificationPersistence.loadPendingSpotChecks(),
])
  .then(([sessions, agents, spotChecks]) => {
    for (const row of sessions) {
      verificationSessions.set(row.id, {
        id: row.id,
        agentId: row.agent_id,
        webhookUrl: row.webhook_url,
        status: row.status,
        currentDay: row.current_day,
        dailyChallenges: row.daily_challenges as DailyChallenge[],
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        failureReason: row.failure_reason ?? undefined,
      });
    }
    for (const row of agents) {
      verifiedAgents.set(row.agent_id, {
        verifiedAt: row.verified_at,
        webhookUrl: row.webhook_url,
        lastSpotCheck: row.last_spot_check ?? undefined,
        spotCheckHistory: row.spot_check_history || [],
        trustTier: (row.trust_tier as TrustTier) || 'spawn',
        consecutiveDaysOnline: row.consecutive_days_online || 0,
        lastConsecutiveCheck: row.last_consecutive_check || row.verified_at,
        tierHistory: row.tier_history || [
          { tier: 'spawn' as TrustTier, achievedAt: row.verified_at },
        ],
        currentDaySkips: row.current_day_skips || 0,
        currentDayStart: row.current_day_start || Date.now(),
      });
    }
    for (const row of spotChecks) {
      pendingSpotChecks.set(row.id, {
        id: row.id,
        agentId: row.agent_id,
        challenge: row.challenge as Challenge,
        scheduledFor: row.scheduled_for,
        completedAt: row.completed_at ?? undefined,
        passed: row.passed ?? undefined,
      });
    }
    logger.debug('Loaded verification state from database', {
      sessions: verificationSessions.size,
      verifiedAgents: verifiedAgents.size,
      spotChecks: pendingSpotChecks.size,
    });
  })
  .catch(e => {
    logger.error(
      'Failed to load verification state from database',
      e instanceof Error ? e : new Error(String(e))
    );
  });

/**
 * Guard: ensures database state is loaded before accessing Maps.
 * Awaiting a resolved promise is essentially free (~microtask).
 */
export async function ensureInitialized(): Promise<void> {
  await _initPromise;
}

// ---- Spot check stats helper ----

export function getSpotCheckStats(agentId: string): {
  passed: number;
  failed: number;
  total: number;
  failureRate: number;
  shouldRevoke: boolean;
} {
  const agent = verifiedAgents.get(agentId);
  if (!agent) return { passed: 0, failed: 0, total: 0, failureRate: 0, shouldRevoke: false };

  const windowStart = Date.now() - SPOT_CHECK_WINDOW_DAYS * MS_PER_DAY;

  // Filter to only checks within the 30-day window
  const recentChecks = agent.spotCheckHistory.filter(
    (sc: SpotCheckResult) => sc.timestamp >= windowStart
  );

  const passed = recentChecks.filter((sc: SpotCheckResult) => sc.passed).length;
  const failed = recentChecks.filter((sc: SpotCheckResult) => !sc.passed).length;
  const total = recentChecks.length;
  const failureRate = total > 0 ? failed / total : 0;

  // Determine if should revoke
  const shouldRevoke =
    failed >= MAX_FAILURES_IN_WINDOW ||
    (total >= MIN_CHECKS_FOR_RATE && failureRate > MAX_FAILURE_RATE);

  return { passed, failed, total, failureRate, shouldRevoke };
}

// Re-export VerificationPersistence for modules that need deleteVerifiedAgent
export { VerificationPersistence };
