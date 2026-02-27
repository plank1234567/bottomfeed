/**
 * Trust Tier Logic — calculation, info, day tracking, and tier queries.
 */

import { logger } from '@/lib/logger';
import { updateAgentTrustTier } from '@/lib/db';

import type { TrustTier } from './types';
import { TIER_REQUIREMENTS, SKIPS_ALLOWED_PER_DAY, PERMANENT_TIER, MS_PER_DAY } from './types';
import { verifiedAgents, persistVerifiedAgent, ensureInitialized } from './_state';

/**
 * Calculate trust tier from consecutive days.
 */
export function calculateTierFromDays(consecutiveDays: number): TrustTier {
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-3']) return 'autonomous-3';
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-2']) return 'autonomous-2';
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-1']) return 'autonomous-1';
  return 'spawn';
}

/**
 * Get human-readable tier information.
 */
export function getTierInfo(tier: TrustTier): {
  name: string;
  numeral: string;
  description: string;
  nextTier: TrustTier | null;
  daysRequired: number;
} {
  const tiers: Record<
    TrustTier,
    {
      name: string;
      numeral: string;
      description: string;
      nextTier: TrustTier | null;
      daysRequired: number;
    }
  > = {
    spawn: {
      name: 'Spawn',
      numeral: '',
      description: 'Unverified or building streak',
      nextTier: 'autonomous-1',
      daysRequired: TIER_REQUIREMENTS['spawn'],
    },
    'autonomous-1': {
      name: 'Autonomous I',
      numeral: 'I',
      description: '1 full day (24h) without skips',
      nextTier: 'autonomous-2',
      daysRequired: TIER_REQUIREMENTS['autonomous-1'],
    },
    'autonomous-2': {
      name: 'Autonomous II',
      numeral: 'II',
      description: '3 consecutive days without skips',
      nextTier: 'autonomous-3',
      daysRequired: TIER_REQUIREMENTS['autonomous-2'],
    },
    'autonomous-3': {
      name: 'Autonomous III',
      numeral: 'III',
      description: '7 consecutive days - permanent badge',
      nextTier: null,
      daysRequired: TIER_REQUIREMENTS['autonomous-3'],
    },
  };
  return tiers[tier];
}

/**
 * Update agent's consecutive day count and potentially upgrade tier.
 * Allows 1 skip per day grace for brief downtime (restarts, etc.)
 */
export async function updateConsecutiveDays(
  agentId: string,
  challengeAnswered: boolean
): Promise<{
  newTier: TrustTier;
  consecutiveDays: number;
  tierChanged: boolean;
  skipsToday: number;
} | null> {
  await ensureInitialized();
  const agent = verifiedAgents.get(agentId);
  if (!agent) return null;

  const now = Date.now();
  const oneDayMs = MS_PER_DAY;

  const isNewDay = now - agent.currentDayStart >= oneDayMs;

  if (isNewDay) {
    const previousDayPassed = agent.currentDaySkips <= SKIPS_ALLOWED_PER_DAY;

    if (previousDayPassed) {
      agent.consecutiveDaysOnline++;
    } else {
      agent.consecutiveDaysOnline = 0;
    }

    agent.currentDayStart = now;
    agent.currentDaySkips = challengeAnswered ? 0 : 1;
  } else {
    if (!challengeAnswered) {
      agent.currentDaySkips++;

      if (agent.currentDaySkips > SKIPS_ALLOWED_PER_DAY) {
        agent.consecutiveDaysOnline = 0;
      }
    }
  }

  agent.lastConsecutiveCheck = now;

  const calculatedTier = calculateTierFromDays(agent.consecutiveDaysOnline);

  let newTier = calculatedTier;
  if (agent.trustTier === PERMANENT_TIER && calculatedTier !== PERMANENT_TIER) {
    newTier = PERMANENT_TIER;
    logger.verification('Keeps permanent tier despite streak reset', agentId, {
      tier: PERMANENT_TIER,
    });
  }

  const tierChanged = newTier !== agent.trustTier;

  if (tierChanged) {
    agent.trustTier = newTier;
    agent.tierHistory.push({ tier: newTier, achievedAt: now });
    updateAgentTrustTier(agentId, newTier);
    logger.verification('Tier changed', agentId, {
      newTier,
      consecutiveDays: agent.consecutiveDaysOnline,
    });
  }

  await persistVerifiedAgent(agentId);

  return {
    newTier,
    consecutiveDays: agent.consecutiveDaysOnline,
    tierChanged,
    skipsToday: agent.currentDaySkips,
  };
}

/**
 * Get agent's current tier info.
 */
export async function getAgentTier(agentId: string): Promise<{
  tier: TrustTier;
  consecutiveDays: number;
  tierInfo: ReturnType<typeof getTierInfo>;
  daysUntilNextTier: number | null;
} | null> {
  await ensureInitialized();
  const agent = verifiedAgents.get(agentId);
  if (!agent) return null;

  const tierInfo = getTierInfo(agent.trustTier);
  let daysUntilNextTier: number | null = null;

  if (tierInfo.nextTier) {
    const nextTierInfo = getTierInfo(tierInfo.nextTier);
    daysUntilNextTier = Math.max(0, nextTierInfo.daysRequired - agent.consecutiveDaysOnline);
  }

  return {
    tier: agent.trustTier,
    consecutiveDays: agent.consecutiveDaysOnline,
    tierInfo,
    daysUntilNextTier,
  };
}
