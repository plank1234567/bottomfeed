/**
 * Database adapter for verification state (write-through cache).
 * Provides persistence layer so verification state survives serverless cold starts.
 */
import { supabase } from './client';
import { logger } from '@/lib/logger';
import type { TrustTier } from '@/types';

// Types matching the in-memory structures in autonomous-verification.ts

interface SpotCheckResult {
  timestamp: number;
  passed: boolean;
}

export interface VerifiedAgentRow {
  agent_id: string;
  verified_at: number;
  webhook_url: string;
  last_spot_check: number | null;
  spot_check_history: SpotCheckResult[];
  trust_tier: TrustTier;
  consecutive_days_online: number;
  last_consecutive_check: number;
  tier_history: { tier: TrustTier; achievedAt: number }[];
  current_day_skips: number;
  current_day_start: number;
}

// Camel-case version matching in-memory Maps in autonomous-verification.ts
export interface VerifiedAgentData {
  verifiedAt: number;
  webhookUrl: string;
  lastSpotCheck?: number;
  spotCheckHistory: SpotCheckResult[];
  trustTier: TrustTier;
  consecutiveDaysOnline: number;
  lastConsecutiveCheck: number;
  tierHistory: { tier: TrustTier; achievedAt: number }[];
  currentDaySkips: number;
  currentDayStart: number;
}

export interface VerificationSessionRow {
  id: string;
  agent_id: string;
  webhook_url: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  current_day: number;
  daily_challenges: unknown;
  started_at: number;
  completed_at: number | null;
  failure_reason: string | null;
}

export interface SpotCheckRow {
  id: string;
  agent_id: string;
  challenge: unknown;
  scheduled_for: number;
  completed_at: number | null;
  passed: boolean | null;
}

// --- Load all state on init ---

export async function loadVerificationSessions(): Promise<VerificationSessionRow[]> {
  const { data, error } = await supabase
    .from('verification_sessions')
    .select('*')
    .in('status', ['pending', 'in_progress']);

  if (error) {
    logger.error('Failed to load verification sessions from DB', error);
    return [];
  }
  return (data || []) as VerificationSessionRow[];
}

export async function loadVerifiedAgents(): Promise<VerifiedAgentRow[]> {
  const { data, error } = await supabase.from('verified_agents').select('*');

  if (error) {
    logger.error('Failed to load verified agents from DB', error);
    return [];
  }
  return (data || []) as VerifiedAgentRow[];
}

export async function loadPendingSpotChecks(): Promise<SpotCheckRow[]> {
  const { data, error } = await supabase.from('spot_checks').select('*').is('completed_at', null);

  if (error) {
    logger.error('Failed to load spot checks from DB', error);
    return [];
  }
  return (data || []) as SpotCheckRow[];
}

// --- Write-through for verification sessions ---

export async function saveSession(session: VerificationSessionRow): Promise<void> {
  const { error } = await supabase.from('verification_sessions').upsert({
    id: session.id,
    agent_id: session.agent_id,
    webhook_url: session.webhook_url,
    status: session.status,
    current_day: session.current_day,
    daily_challenges: session.daily_challenges,
    started_at: session.started_at,
    completed_at: session.completed_at,
    failure_reason: session.failure_reason,
  });

  if (error) {
    logger.error('Failed to save verification session to DB', error);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('verification_sessions').delete().eq('id', sessionId);

  if (error) {
    logger.error('Failed to delete verification session from DB', error);
  }
}

// --- Write-through for verified agents ---

export async function saveVerifiedAgent(agentId: string, data: VerifiedAgentData): Promise<void> {
  const { error } = await supabase.from('verified_agents').upsert({
    agent_id: agentId,
    verified_at: data.verifiedAt,
    webhook_url: data.webhookUrl,
    last_spot_check: data.lastSpotCheck ?? null,
    spot_check_history: data.spotCheckHistory,
    trust_tier: data.trustTier,
    consecutive_days_online: data.consecutiveDaysOnline,
    last_consecutive_check: data.lastConsecutiveCheck,
    tier_history: data.tierHistory,
    current_day_skips: data.currentDaySkips,
    current_day_start: data.currentDayStart,
  });

  if (error) {
    logger.error('Failed to save verified agent to DB', error);
  }
}

export async function deleteVerifiedAgent(agentId: string): Promise<void> {
  const { error } = await supabase.from('verified_agents').delete().eq('agent_id', agentId);

  if (error) {
    logger.error('Failed to delete verified agent from DB', error);
  }
}

// --- Write-through for spot checks ---

export async function saveSpotCheck(spotCheck: SpotCheckRow): Promise<void> {
  const { error } = await supabase.from('spot_checks').upsert({
    id: spotCheck.id,
    agent_id: spotCheck.agent_id,
    challenge: spotCheck.challenge,
    scheduled_for: spotCheck.scheduled_for,
    completed_at: spotCheck.completed_at,
    passed: spotCheck.passed,
  });

  if (error) {
    logger.error('Failed to save spot check to DB', error);
  }
}

export async function deleteSpotCheck(spotCheckId: string): Promise<void> {
  const { error } = await supabase.from('spot_checks').delete().eq('id', spotCheckId);

  if (error) {
    logger.error('Failed to delete spot check from DB', error);
  }
}
