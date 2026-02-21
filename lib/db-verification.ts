/**
 * Verification Database
 *
 * Stores all verification-related data for research and analysis:
 * - Verification sessions and outcomes
 * - Individual challenge responses (actual AI outputs)
 * - Model detection results and accuracy
 * - Spot check history
 * - Aggregate statistics
 *
 * Uses write-through cache pattern: Maps for fast reads, Supabase for persistence.
 */

import { logger } from '@/lib/logger';
import { MS_PER_DAY } from '@/lib/constants';

// Lazy import to avoid circular dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;

async function getSupabase() {
  if (!_supabase) {
    const { supabase } = await import('@/lib/db-supabase/client');
    _supabase = supabase;
  }
  return _supabase;
}

// Write-through helper: persist to DB. Errors are logged but not rethrown
// to avoid breaking the hot path — the in-memory cache remains authoritative.
async function persistToDb(table: string, data: Record<string, unknown>): Promise<void> {
  try {
    const sb = await getSupabase();
    const { error } = await sb.from(table).upsert(data);
    if (error) {
      logger.error(`VerificationDB failed to persist to ${table}`, error);
    }
  } catch (e) {
    logger.error(
      `VerificationDB persistence error for ${table}`,
      e instanceof Error ? e : new Error(String(e))
    );
  }
}

// Types
export type ModelVerificationStatus =
  | 'pending'
  | 'verified_match'
  | 'verified_mismatch'
  | 'undetectable';

export interface StoredVerificationSession {
  id: string;
  agentId: string;
  agentUsername: string;
  claimedModel: string | null;
  webhookUrl: string;
  status: 'in_progress' | 'passed' | 'failed';
  startedAt: number;
  completedAt: number | null;
  failureReason: string | null;

  // Challenge statistics
  totalChallenges: number;
  attemptedChallenges: number;
  passedChallenges: number;
  failedChallenges: number;
  skippedChallenges: number;

  // Model detection results
  modelVerificationStatus: ModelVerificationStatus;
  detectedModel: string | null;
  detectionConfidence: number | null;
  detectionScores: { model: string; score: number }[];
}

export interface StoredChallengeResponse {
  id: string;
  sessionId: string;
  agentId: string;
  challengeType: string;
  prompt: string;
  response: string | null;
  responseTimeMs: number | null;
  status: 'passed' | 'failed' | 'skipped';
  failureReason: string | null;
  sentAt: number;
  respondedAt: number | null;

  isSpotCheck: boolean;

  templateId?: string;
  category?: string;
  subcategory?: string;
  expectedFormat?: string;
  dataValue?: 'critical' | 'high' | 'medium';
  useCase?: string[];
  groundTruth?: unknown;
  parsedData?: {
    // Common fields
    challenge_id?: string;
    category?: string;
    subcategory?: string;
    data_value?: string;
    use_cases?: string[];
    response_length?: number;
    word_count?: number;
    raw_response?: string;
    timestamp?: number;

    // Hallucination detection
    admits_unknown?: boolean;
    fabricates_explanation?: boolean;
    fabricates_details?: boolean;
    confabulates?: boolean;
    detects_fake?: boolean;
    num_fake_details?: number;

    // Reasoning
    shows_steps?: boolean;
    num_steps?: number;
    final_answer?: unknown;
    answer_correct?: boolean;
    reasoning_valid?: boolean;
    fell_for_trap?: boolean;

    // Preferences/RLHF
    ranking?: string;
    first_choice?: string;
    last_choice?: string;
    explanation_quality?: string;

    // Safety
    refuses?: boolean;
    detects_manipulation?: boolean;
    fooled_by_framing?: boolean;
    caves_to_pressure?: boolean;

    // Self-modeling
    mentions_tokens?: boolean;
    mentions_attention?: boolean;
    technically_accurate?: boolean;

    // Ground truth match
    ground_truth?: unknown;
    matches_ground_truth?: boolean;

    // Confidence
    confidence_expressed?: string;

    // Any other extracted fields
    [key: string]: unknown;
  };
}

export interface StoredModelDetection {
  id: string;
  agentId: string;
  sessionId: string | null;
  timestamp: number;

  claimedModel: string | null;
  detectedModel: string | null;
  confidence: number;
  match: boolean;

  allScores: { model: string; score: number }[];
  indicators: string[];
  responsesAnalyzed: number;
}

export interface SpotCheckRecord {
  id: string;
  agentId: string;
  timestamp: number;
  passed: boolean;
  skipped: boolean;
  responseTimeMs: number | null;
  error: string | null;
  response: string | null;
}

export interface AgentVerificationStats {
  agentId: string;

  verificationPassed: boolean;
  verifiedAt: number | null;

  claimedModel: string | null;
  detectedModel: string | null;
  modelVerificationStatus: ModelVerificationStatus;
  modelConfidence: number | null;

  spotChecksPassed: number;
  spotChecksFailed: number;
  spotChecksSkipped: number;
  spotCheckFailureRate: number;
  lastSpotCheck: number | null;

  avgResponseTimeMs: number;
  totalResponsesCollected: number;
}

export interface GlobalStats {
  totalAgents: number;
  verifiedAgents: number;
  spawnAgents: number;
  claimedModelDistribution: Record<string, number>;
  detectedModelDistribution: Record<string, number>;
  modelMatchRate: number;
  modelMismatchCount: number;
  undetectableCount: number;
  verificationPassRate: number;
  avgVerificationDuration: number;
  avgResponseTime: number;
  avgChallengesAttempted: number;
}

// Max entries for high-volume caches. Sessions and stats are low-volume
// (bounded by agent count), but responses/detections/checks grow unboundedly.
const MAX_RESPONSES_CACHE = 5000;
const MAX_SPOT_CHECKS_CACHE = 2000;
const MAX_DETECTIONS_CACHE = 2000;

// In-memory cache (Maps) — database is source of truth
const verificationSessions = new Map<string, StoredVerificationSession>();
const challengeResponses = new Map<string, StoredChallengeResponse>();
const modelDetections = new Map<string, StoredModelDetection>();
const spotChecks = new Map<string, SpotCheckRecord>();
const agentStats = new Map<string, AgentVerificationStats>();

/**
 * Evict oldest entries from a Map when it exceeds maxSize.
 * Uses a timestamp field for ordering.
 */
function evictIfNeeded<V>(
  map: Map<string, V>,
  maxSize: number,
  getTimestamp: (v: V) => number
): void {
  if (map.size <= maxSize) return;
  const entries = Array.from(map.entries()).sort((a, b) => getTimestamp(a[1]) - getTimestamp(b[1]));
  const evictCount = map.size - maxSize;
  for (let i = 0; i < evictCount; i++) {
    map.delete(entries[i]![0]);
  }
}

// Initialize from database
const _initPromise = (async () => {
  try {
    const sb = await getSupabase();

    const [sessionsRes, responsesRes, detectionsRes, checksRes, statsRes] = await Promise.all([
      sb.from('verification_db_sessions').select('*'),
      sb
        .from('verification_db_challenge_responses')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(1000),
      sb.from('verification_db_model_detections').select('*'),
      sb
        .from('verification_db_spot_checks')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000),
      sb.from('verification_db_agent_stats').select('*'),
    ]);

    for (const row of (sessionsRes.data || []) as Record<string, unknown>[]) {
      const session: StoredVerificationSession = {
        id: row.id as string,
        agentId: row.agent_id as string,
        agentUsername: row.agent_username as string,
        claimedModel: row.claimed_model as string | null,
        webhookUrl: row.webhook_url as string,
        status: row.status as 'in_progress' | 'passed' | 'failed',
        startedAt: row.started_at as number,
        completedAt: row.completed_at as number | null,
        failureReason: row.failure_reason as string | null,
        totalChallenges: row.total_challenges as number,
        attemptedChallenges: row.attempted_challenges as number,
        passedChallenges: row.passed_challenges as number,
        failedChallenges: row.failed_challenges as number,
        skippedChallenges: row.skipped_challenges as number,
        modelVerificationStatus: row.model_verification_status as ModelVerificationStatus,
        detectedModel: row.detected_model as string | null,
        detectionConfidence: row.detection_confidence as number | null,
        detectionScores: (row.detection_scores || []) as { model: string; score: number }[],
      };
      verificationSessions.set(session.id, session);
    }

    for (const row of (responsesRes.data || []) as Record<string, unknown>[]) {
      const response: StoredChallengeResponse = {
        id: row.id as string,
        sessionId: row.session_id as string,
        agentId: row.agent_id as string,
        challengeType: row.challenge_type as string,
        prompt: row.prompt as string,
        response: row.response as string | null,
        responseTimeMs: row.response_time_ms as number | null,
        status: row.status as 'passed' | 'failed' | 'skipped',
        failureReason: row.failure_reason as string | null,
        sentAt: row.sent_at as number,
        respondedAt: row.responded_at as number | null,
        isSpotCheck: row.is_spot_check as boolean,
        templateId: row.template_id as string | undefined,
        category: row.category as string | undefined,
        subcategory: row.subcategory as string | undefined,
        expectedFormat: row.expected_format as string | undefined,
        dataValue: row.data_value as 'critical' | 'high' | 'medium' | undefined,
        useCase: row.use_case as string[] | undefined,
        groundTruth: row.ground_truth as unknown,
        parsedData: row.parsed_data as Record<string, unknown> | undefined,
      };
      challengeResponses.set(response.id, response);
    }

    for (const row of (detectionsRes.data || []) as Record<string, unknown>[]) {
      const detection: StoredModelDetection = {
        id: row.id as string,
        agentId: row.agent_id as string,
        sessionId: row.session_id as string | null,
        timestamp: row.timestamp as number,
        claimedModel: row.claimed_model as string | null,
        detectedModel: row.detected_model as string | null,
        confidence: row.confidence as number,
        match: row.match as boolean,
        allScores: (row.all_scores || []) as { model: string; score: number }[],
        indicators: (row.indicators || []) as string[],
        responsesAnalyzed: row.responses_analyzed as number,
      };
      modelDetections.set(detection.id, detection);
    }

    for (const row of (checksRes.data || []) as Record<string, unknown>[]) {
      const check: SpotCheckRecord = {
        id: row.id as string,
        agentId: row.agent_id as string,
        timestamp: row.timestamp as number,
        passed: row.passed as boolean,
        skipped: row.skipped as boolean,
        responseTimeMs: row.response_time_ms as number | null,
        error: row.error as string | null,
        response: row.response as string | null,
      };
      spotChecks.set(check.id, check);
    }

    for (const row of (statsRes.data || []) as Record<string, unknown>[]) {
      const stat: AgentVerificationStats = {
        agentId: row.agent_id as string,
        verificationPassed: row.verification_passed as boolean,
        verifiedAt: row.verified_at as number | null,
        claimedModel: row.claimed_model as string | null,
        detectedModel: row.detected_model as string | null,
        modelVerificationStatus: row.model_verification_status as ModelVerificationStatus,
        modelConfidence: row.model_confidence as number | null,
        spotChecksPassed: row.spot_checks_passed as number,
        spotChecksFailed: row.spot_checks_failed as number,
        spotChecksSkipped: row.spot_checks_skipped as number,
        spotCheckFailureRate: row.spot_check_failure_rate as number,
        lastSpotCheck: row.last_spot_check as number | null,
        avgResponseTimeMs: row.avg_response_time_ms as number,
        totalResponsesCollected: row.total_responses_collected as number,
      };
      agentStats.set(stat.agentId, stat);
    }

    logger.debug('VerificationDB loaded from database', {
      sessions: verificationSessions.size,
      responses: challengeResponses.size,
      detections: modelDetections.size,
    });
  } catch (e) {
    logger.error(
      'VerificationDB failed to load from database',
      e instanceof Error ? e : new Error(String(e))
    );
  }
})();

// Guard: ensures database state is loaded before accessing Maps.
async function ensureInitialized(): Promise<void> {
  await _initPromise;
}

// Helper to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function storeVerificationSession(
  session: Omit<StoredVerificationSession, 'id'>
): Promise<StoredVerificationSession> {
  await ensureInitialized();
  const stored: StoredVerificationSession = {
    id: generateId(),
    ...session,
  };
  verificationSessions.set(stored.id, stored);
  logger.debug('VerificationDB stored session', { sessionId: stored.id, agentId: stored.agentId });
  await persistToDb('verification_db_sessions', {
    id: stored.id,
    agent_id: stored.agentId,
    agent_username: stored.agentUsername,
    claimed_model: stored.claimedModel,
    webhook_url: stored.webhookUrl,
    status: stored.status,
    started_at: stored.startedAt,
    completed_at: stored.completedAt,
    failure_reason: stored.failureReason,
    total_challenges: stored.totalChallenges,
    attempted_challenges: stored.attemptedChallenges,
    passed_challenges: stored.passedChallenges,
    failed_challenges: stored.failedChallenges,
    skipped_challenges: stored.skippedChallenges,
    model_verification_status: stored.modelVerificationStatus,
    detected_model: stored.detectedModel,
    detection_confidence: stored.detectionConfidence,
    detection_scores: stored.detectionScores,
  });
  return stored;
}

export async function updateVerificationSession(
  sessionId: string,
  updates: Partial<StoredVerificationSession>
): Promise<StoredVerificationSession | null> {
  await ensureInitialized();
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  Object.assign(session, updates);
  await persistToDb('verification_db_sessions', {
    id: session.id,
    agent_id: session.agentId,
    agent_username: session.agentUsername,
    claimed_model: session.claimedModel,
    webhook_url: session.webhookUrl,
    status: session.status,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    failure_reason: session.failureReason,
    total_challenges: session.totalChallenges,
    attempted_challenges: session.attemptedChallenges,
    passed_challenges: session.passedChallenges,
    failed_challenges: session.failedChallenges,
    skipped_challenges: session.skippedChallenges,
    model_verification_status: session.modelVerificationStatus,
    detected_model: session.detectedModel,
    detection_confidence: session.detectionConfidence,
    detection_scores: session.detectionScores,
  });
  return session;
}

export async function getVerificationSession(
  sessionId: string
): Promise<StoredVerificationSession | null> {
  await ensureInitialized();
  return verificationSessions.get(sessionId) || null;
}

export async function getAgentVerificationSessions(
  agentId: string
): Promise<StoredVerificationSession[]> {
  await ensureInitialized();
  return Array.from(verificationSessions.values())
    .filter(s => s.agentId === agentId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function getAllVerificationSessions(): Promise<StoredVerificationSession[]> {
  await ensureInitialized();
  return Array.from(verificationSessions.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export async function storeChallengeResponse(
  response: Omit<StoredChallengeResponse, 'id'>
): Promise<StoredChallengeResponse> {
  await ensureInitialized();
  const stored: StoredChallengeResponse = {
    id: generateId(),
    ...response,
  };
  challengeResponses.set(stored.id, stored);
  await persistToDb('verification_db_challenge_responses', {
    id: stored.id,
    session_id: stored.sessionId,
    agent_id: stored.agentId,
    challenge_type: stored.challengeType,
    prompt: stored.prompt,
    response: stored.response,
    response_time_ms: stored.responseTimeMs,
    status: stored.status,
    failure_reason: stored.failureReason,
    sent_at: stored.sentAt,
    responded_at: stored.respondedAt,
    is_spot_check: stored.isSpotCheck,
    template_id: stored.templateId,
    category: stored.category,
    subcategory: stored.subcategory,
    expected_format: stored.expectedFormat,
    data_value: stored.dataValue,
    use_case: stored.useCase,
    ground_truth: stored.groundTruth,
    parsed_data: stored.parsedData,
  });
  evictIfNeeded(challengeResponses, MAX_RESPONSES_CACHE, r => r.sentAt);
  return stored;
}

export async function getSessionChallengeResponses(
  sessionId: string
): Promise<StoredChallengeResponse[]> {
  await ensureInitialized();
  return Array.from(challengeResponses.values())
    .filter(r => r.sessionId === sessionId)
    .sort((a, b) => a.sentAt - b.sentAt);
}

export async function getAgentChallengeResponses(
  agentId: string
): Promise<StoredChallengeResponse[]> {
  await ensureInitialized();
  return Array.from(challengeResponses.values())
    .filter(r => r.agentId === agentId)
    .sort((a, b) => b.sentAt - a.sentAt);
}

export async function getAllChallengeResponses(): Promise<StoredChallengeResponse[]> {
  await ensureInitialized();
  return Array.from(challengeResponses.values()).sort((a, b) => b.sentAt - a.sentAt);
}

export async function storeModelDetection(
  detection: Omit<StoredModelDetection, 'id'>
): Promise<StoredModelDetection> {
  await ensureInitialized();
  const stored: StoredModelDetection = {
    id: generateId(),
    ...detection,
  };
  modelDetections.set(stored.id, stored);
  logger.debug('VerificationDB stored model detection', {
    agentId: stored.agentId,
    claimedModel: stored.claimedModel,
    detectedModel: stored.detectedModel,
    match: stored.match,
  });
  await persistToDb('verification_db_model_detections', {
    id: stored.id,
    agent_id: stored.agentId,
    session_id: stored.sessionId,
    timestamp: stored.timestamp,
    claimed_model: stored.claimedModel,
    detected_model: stored.detectedModel,
    confidence: stored.confidence,
    match: stored.match,
    all_scores: stored.allScores,
    indicators: stored.indicators,
    responses_analyzed: stored.responsesAnalyzed,
  });
  evictIfNeeded(modelDetections, MAX_DETECTIONS_CACHE, d => d.timestamp);
  return stored;
}

export async function getAgentModelDetections(agentId: string): Promise<StoredModelDetection[]> {
  await ensureInitialized();
  return Array.from(modelDetections.values())
    .filter(d => d.agentId === agentId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getLatestModelDetection(
  agentId: string
): Promise<StoredModelDetection | null> {
  const detections = await getAgentModelDetections(agentId);
  return detections[0] || null;
}

export async function getAllModelDetections(): Promise<StoredModelDetection[]> {
  await ensureInitialized();
  return Array.from(modelDetections.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function storeSpotCheck(
  record: Omit<SpotCheckRecord, 'id'>
): Promise<SpotCheckRecord> {
  await ensureInitialized();
  const stored: SpotCheckRecord = {
    id: generateId(),
    ...record,
  };
  spotChecks.set(stored.id, stored);
  await persistToDb('verification_db_spot_checks', {
    id: stored.id,
    agent_id: stored.agentId,
    timestamp: stored.timestamp,
    passed: stored.passed,
    skipped: stored.skipped,
    response_time_ms: stored.responseTimeMs,
    error: stored.error,
    response: stored.response,
  });
  evictIfNeeded(spotChecks, MAX_SPOT_CHECKS_CACHE, s => s.timestamp);
  return stored;
}

export async function getAgentSpotChecks(
  agentId: string,
  days: number = 30
): Promise<SpotCheckRecord[]> {
  await ensureInitialized();
  const cutoff = Date.now() - days * MS_PER_DAY;
  return Array.from(spotChecks.values())
    .filter(s => s.agentId === agentId && s.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getAllSpotChecks(): Promise<SpotCheckRecord[]> {
  await ensureInitialized();
  return Array.from(spotChecks.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateAgentStats(
  agentId: string,
  updates: Partial<AgentVerificationStats>
): Promise<AgentVerificationStats> {
  await ensureInitialized();
  const existing = agentStats.get(agentId) || {
    agentId,
    verificationPassed: false,
    verifiedAt: null,
    claimedModel: null,
    detectedModel: null,
    modelVerificationStatus: 'pending' as ModelVerificationStatus,
    modelConfidence: null,
    spotChecksPassed: 0,
    spotChecksFailed: 0,
    spotChecksSkipped: 0,
    spotCheckFailureRate: 0,
    lastSpotCheck: null,
    avgResponseTimeMs: 0,
    totalResponsesCollected: 0,
  };

  const updated = { ...existing, ...updates };

  // Recalculate failure rate
  const totalChecks = updated.spotChecksPassed + updated.spotChecksFailed;
  updated.spotCheckFailureRate = totalChecks > 0 ? updated.spotChecksFailed / totalChecks : 0;

  agentStats.set(agentId, updated);
  await persistToDb('verification_db_agent_stats', {
    agent_id: updated.agentId,
    verification_passed: updated.verificationPassed,
    verified_at: updated.verifiedAt,
    claimed_model: updated.claimedModel,
    detected_model: updated.detectedModel,
    model_verification_status: updated.modelVerificationStatus,
    model_confidence: updated.modelConfidence,
    spot_checks_passed: updated.spotChecksPassed,
    spot_checks_failed: updated.spotChecksFailed,
    spot_checks_skipped: updated.spotChecksSkipped,
    spot_check_failure_rate: updated.spotCheckFailureRate,
    last_spot_check: updated.lastSpotCheck,
    avg_response_time_ms: updated.avgResponseTimeMs,
    total_responses_collected: updated.totalResponsesCollected,
  });
  return updated;
}

export async function getAgentStats(agentId: string): Promise<AgentVerificationStats | null> {
  await ensureInitialized();
  return agentStats.get(agentId) || null;
}

export async function getAllAgentStats(): Promise<AgentVerificationStats[]> {
  await ensureInitialized();
  return Array.from(agentStats.values());
}

export async function getGlobalStats(): Promise<GlobalStats> {
  await ensureInitialized();
  const sessions = Array.from(verificationSessions.values());
  const stats = Array.from(agentStats.values());

  const verifiedAgents = stats.filter(s => s.verificationPassed).length;
  const spawnAgents = stats.filter(s => !s.verificationPassed).length;

  const claimedModelDistribution: Record<string, number> = {};
  stats.forEach(s => {
    if (s.claimedModel) {
      claimedModelDistribution[s.claimedModel] =
        (claimedModelDistribution[s.claimedModel] || 0) + 1;
    }
  });

  const detectedModelDistribution: Record<string, number> = {};
  stats.forEach(s => {
    if (s.detectedModel) {
      detectedModelDistribution[s.detectedModel] =
        (detectedModelDistribution[s.detectedModel] || 0) + 1;
    }
  });

  const withDetection = stats.filter(s => s.modelVerificationStatus !== 'pending');
  const matches = withDetection.filter(s => s.modelVerificationStatus === 'verified_match').length;
  const mismatches = withDetection.filter(
    s => s.modelVerificationStatus === 'verified_mismatch'
  ).length;
  const undetectable = withDetection.filter(
    s => s.modelVerificationStatus === 'undetectable'
  ).length;

  const completedSessions = sessions.filter(s => s.status !== 'in_progress');
  const passedSessions = completedSessions.filter(s => s.status === 'passed');

  const completedWithDuration = completedSessions.filter(s => s.completedAt);
  const avgDuration =
    completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, s) => sum + (s.completedAt! - s.startedAt), 0) /
        completedWithDuration.length
      : 0;

  const responseTimes = Array.from(challengeResponses.values())
    .filter(r => r.responseTimeMs !== null)
    .map(r => r.responseTimeMs!);
  const avgResponseTime =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

  const avgAttempted =
    completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.attemptedChallenges, 0) /
        completedSessions.length
      : 0;

  return {
    totalAgents: stats.length,
    verifiedAgents,
    spawnAgents,
    claimedModelDistribution,
    detectedModelDistribution,
    modelMatchRate: withDetection.length > 0 ? matches / withDetection.length : 0,
    modelMismatchCount: mismatches,
    undetectableCount: undetectable,
    verificationPassRate:
      completedSessions.length > 0 ? passedSessions.length / completedSessions.length : 0,
    avgVerificationDuration: avgDuration,
    avgResponseTime,
    avgChallengesAttempted: avgAttempted,
  };
}

export async function exportAllData(): Promise<{
  sessions: StoredVerificationSession[];
  responses: StoredChallengeResponse[];
  detections: StoredModelDetection[];
  spotChecks: SpotCheckRecord[];
  agentStats: AgentVerificationStats[];
  globalStats: GlobalStats;
}> {
  await ensureInitialized();
  return {
    sessions: await getAllVerificationSessions(),
    responses: await getAllChallengeResponses(),
    detections: await getAllModelDetections(),
    spotChecks: await getAllSpotChecks(),
    agentStats: await getAllAgentStats(),
    globalStats: await getGlobalStats(),
  };
}

export async function getModelMismatches(): Promise<StoredModelDetection[]> {
  await ensureInitialized();
  return Array.from(modelDetections.values())
    .filter(d => !d.match && d.detectedModel !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getAgentsByDetectedModel(model: string): Promise<AgentVerificationStats[]> {
  await ensureInitialized();
  return Array.from(agentStats.values()).filter(
    s => s.detectedModel?.toLowerCase() === model.toLowerCase()
  );
}

export async function getResponsesByModel(model: string): Promise<StoredChallengeResponse[]> {
  await ensureInitialized();
  const agentIds = new Set(
    Array.from(agentStats.values())
      .filter(s => s.detectedModel?.toLowerCase() === model.toLowerCase())
      .map(s => s.agentId)
  );

  return Array.from(challengeResponses.values())
    .filter(r => agentIds.has(r.agentId) && r.response !== null)
    .sort((a, b) => b.sentAt - a.sentAt);
}

export async function searchResponses(query: string): Promise<StoredChallengeResponse[]> {
  await ensureInitialized();
  const lowerQuery = query.toLowerCase();
  return Array.from(challengeResponses.values())
    .filter(r => r.response?.toLowerCase().includes(lowerQuery))
    .sort((a, b) => b.sentAt - a.sentAt);
}
