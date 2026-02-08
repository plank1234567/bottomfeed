/**
 * Verification Database
 *
 * Stores all verification-related data for research and analysis:
 * - Verification sessions and outcomes
 * - Individual challenge responses (actual AI outputs)
 * - Model detection results and accuracy
 * - Spot check history
 * - Aggregate statistics
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { MS_PER_DAY } from '@/lib/constants';

// File-based persistence for dev (in production, use a real database)
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'verification-db.json');

interface PersistedData {
  verificationSessions: [string, StoredVerificationSession][];
  challengeResponses: [string, StoredChallengeResponse][];
  modelDetections: [string, StoredModelDetection][];
  spotChecks: [string, SpotCheckRecord][];
  agentStats: [string, AgentVerificationStats][];
}

async function loadData(): Promise<PersistedData | null> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(
        'VerificationDB error loading data',
        e instanceof Error ? e : new Error(String(e))
      );
    }
  }
  return null;
}

async function saveData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data: PersistedData = {
      verificationSessions: Array.from(verificationSessions.entries()),
      challengeResponses: Array.from(challengeResponses.entries()),
      modelDetections: Array.from(modelDetections.entries()),
      spotChecks: Array.from(spotChecks.entries()),
      agentStats: Array.from(agentStats.entries()),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error('VerificationDB error saving data', e instanceof Error ? e : new Error(String(e)));
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
  challengeType: string; // Category like 'hallucination_detection', 'reasoning_trace', etc.
  prompt: string;
  response: string | null;
  responseTimeMs: number | null;
  status: 'passed' | 'failed' | 'skipped';
  failureReason: string | null;
  sentAt: number;
  respondedAt: number | null;

  // For spot checks
  isSpotCheck: boolean;

  // High-value data collection fields
  templateId?: string;
  category?: string;
  subcategory?: string;
  expectedFormat?: string;

  // Data value classification
  dataValue?: 'critical' | 'high' | 'medium';
  useCase?: string[]; // What this data is used for (e.g., 'rlhf_training', 'hallucination_detection')

  // Ground truth for validation
  groundTruth?: unknown; // Known correct answer if applicable

  // Extracted structured data (the valuable part)
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

    // Any other extracted fields
    [key: string]: unknown;
  };
}

export interface StoredModelDetection {
  id: string;
  agentId: string;
  sessionId: string | null; // null for spot check detections
  timestamp: number;

  claimedModel: string | null;
  detectedModel: string | null;
  confidence: number;
  match: boolean;

  // All model scores for analysis
  allScores: { model: string; score: number }[];

  // Indicators that triggered detection
  indicators: string[];

  // Number of responses analyzed
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

  // Overall verification
  verificationPassed: boolean;
  verifiedAt: number | null;

  // Model verification
  claimedModel: string | null;
  detectedModel: string | null;
  modelVerificationStatus: ModelVerificationStatus;
  modelConfidence: number | null;

  // Spot check stats (30-day rolling)
  spotChecksPassed: number;
  spotChecksFailed: number;
  spotChecksSkipped: number;
  spotCheckFailureRate: number;
  lastSpotCheck: number | null;

  // Response patterns
  avgResponseTimeMs: number;
  totalResponsesCollected: number;
}

export interface GlobalStats {
  // Agent counts
  totalAgents: number;
  verifiedAgents: number;
  spawnAgents: number;

  // Model distribution (claimed)
  claimedModelDistribution: Record<string, number>;

  // Model distribution (detected)
  detectedModelDistribution: Record<string, number>;

  // Model verification accuracy
  modelMatchRate: number; // % of agents where claimed = detected
  modelMismatchCount: number;
  undetectableCount: number;

  // Verification success rate
  verificationPassRate: number;

  // Average metrics
  avgVerificationDuration: number;
  avgResponseTime: number;
  avgChallengesAttempted: number;
}

// In-memory storage (would be a real DB in production)
const verificationSessions = new Map<string, StoredVerificationSession>();
const challengeResponses = new Map<string, StoredChallengeResponse>();
const modelDetections = new Map<string, StoredModelDetection>();
const spotChecks = new Map<string, SpotCheckRecord>();
const agentStats = new Map<string, AgentVerificationStats>();

// Initialize from persisted data
const _initPromise = loadData().then(persistedData => {
  if (persistedData) {
    persistedData.verificationSessions.forEach(([k, v]) => verificationSessions.set(k, v));
    persistedData.challengeResponses.forEach(([k, v]) => challengeResponses.set(k, v));
    persistedData.modelDetections.forEach(([k, v]) => modelDetections.set(k, v));
    persistedData.spotChecks.forEach(([k, v]) => spotChecks.set(k, v));
    persistedData.agentStats.forEach(([k, v]) => agentStats.set(k, v));
    logger.debug('VerificationDB loaded', {
      sessions: verificationSessions.size,
      responses: challengeResponses.size,
      detections: modelDetections.size,
    });
  }
});

// Helper to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function storeVerificationSession(
  session: Omit<StoredVerificationSession, 'id'>
): StoredVerificationSession {
  const stored: StoredVerificationSession = {
    id: generateId(),
    ...session,
  };
  verificationSessions.set(stored.id, stored);
  logger.debug('VerificationDB stored session', { sessionId: stored.id, agentId: stored.agentId });
  saveData();
  return stored;
}

export function updateVerificationSession(
  sessionId: string,
  updates: Partial<StoredVerificationSession>
): StoredVerificationSession | null {
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  Object.assign(session, updates);
  saveData();
  return session;
}

export function getVerificationSession(sessionId: string): StoredVerificationSession | null {
  return verificationSessions.get(sessionId) || null;
}

export function getAgentVerificationSessions(agentId: string): StoredVerificationSession[] {
  return Array.from(verificationSessions.values())
    .filter(s => s.agentId === agentId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function getAllVerificationSessions(): StoredVerificationSession[] {
  return Array.from(verificationSessions.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function storeChallengeResponse(
  response: Omit<StoredChallengeResponse, 'id'>
): StoredChallengeResponse {
  const stored: StoredChallengeResponse = {
    id: generateId(),
    ...response,
  };
  challengeResponses.set(stored.id, stored);
  saveData();
  return stored;
}

export function getSessionChallengeResponses(sessionId: string): StoredChallengeResponse[] {
  return Array.from(challengeResponses.values())
    .filter(r => r.sessionId === sessionId)
    .sort((a, b) => a.sentAt - b.sentAt);
}

export function getAgentChallengeResponses(agentId: string): StoredChallengeResponse[] {
  return Array.from(challengeResponses.values())
    .filter(r => r.agentId === agentId)
    .sort((a, b) => b.sentAt - a.sentAt);
}

export function getAllChallengeResponses(): StoredChallengeResponse[] {
  return Array.from(challengeResponses.values()).sort((a, b) => b.sentAt - a.sentAt);
}

export function storeModelDetection(
  detection: Omit<StoredModelDetection, 'id'>
): StoredModelDetection {
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
  saveData();
  return stored;
}

export function getAgentModelDetections(agentId: string): StoredModelDetection[] {
  return Array.from(modelDetections.values())
    .filter(d => d.agentId === agentId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getLatestModelDetection(agentId: string): StoredModelDetection | null {
  const detections = getAgentModelDetections(agentId);
  return detections[0] || null;
}

export function getAllModelDetections(): StoredModelDetection[] {
  return Array.from(modelDetections.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function storeSpotCheck(record: Omit<SpotCheckRecord, 'id'>): SpotCheckRecord {
  const stored: SpotCheckRecord = {
    id: generateId(),
    ...record,
  };
  spotChecks.set(stored.id, stored);
  saveData();
  return stored;
}

export function getAgentSpotChecks(agentId: string, days: number = 30): SpotCheckRecord[] {
  const cutoff = Date.now() - days * MS_PER_DAY;
  return Array.from(spotChecks.values())
    .filter(s => s.agentId === agentId && s.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getAllSpotChecks(): SpotCheckRecord[] {
  return Array.from(spotChecks.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function updateAgentStats(
  agentId: string,
  updates: Partial<AgentVerificationStats>
): AgentVerificationStats {
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
  saveData();
  return updated;
}

export function getAgentStats(agentId: string): AgentVerificationStats | null {
  return agentStats.get(agentId) || null;
}

export function getAllAgentStats(): AgentVerificationStats[] {
  return Array.from(agentStats.values());
}

export function getGlobalStats(): GlobalStats {
  const sessions = Array.from(verificationSessions.values());
  const stats = Array.from(agentStats.values());

  // Agent counts
  const verifiedAgents = stats.filter(s => s.verificationPassed).length;
  const spawnAgents = stats.filter(s => !s.verificationPassed).length;

  // Model distribution (claimed)
  const claimedModelDistribution: Record<string, number> = {};
  stats.forEach(s => {
    if (s.claimedModel) {
      claimedModelDistribution[s.claimedModel] =
        (claimedModelDistribution[s.claimedModel] || 0) + 1;
    }
  });

  // Model distribution (detected)
  const detectedModelDistribution: Record<string, number> = {};
  stats.forEach(s => {
    if (s.detectedModel) {
      detectedModelDistribution[s.detectedModel] =
        (detectedModelDistribution[s.detectedModel] || 0) + 1;
    }
  });

  // Model verification accuracy
  const withDetection = stats.filter(s => s.modelVerificationStatus !== 'pending');
  const matches = withDetection.filter(s => s.modelVerificationStatus === 'verified_match').length;
  const mismatches = withDetection.filter(
    s => s.modelVerificationStatus === 'verified_mismatch'
  ).length;
  const undetectable = withDetection.filter(
    s => s.modelVerificationStatus === 'undetectable'
  ).length;

  // Verification success rate
  const completedSessions = sessions.filter(s => s.status !== 'in_progress');
  const passedSessions = completedSessions.filter(s => s.status === 'passed');

  // Average metrics
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

export function exportAllData(): {
  sessions: StoredVerificationSession[];
  responses: StoredChallengeResponse[];
  detections: StoredModelDetection[];
  spotChecks: SpotCheckRecord[];
  agentStats: AgentVerificationStats[];
  globalStats: GlobalStats;
} {
  return {
    sessions: getAllVerificationSessions(),
    responses: getAllChallengeResponses(),
    detections: getAllModelDetections(),
    spotChecks: getAllSpotChecks(),
    agentStats: getAllAgentStats(),
    globalStats: getGlobalStats(),
  };
}

export function getModelMismatches(): StoredModelDetection[] {
  return Array.from(modelDetections.values())
    .filter(d => !d.match && d.detectedModel !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getAgentsByDetectedModel(model: string): AgentVerificationStats[] {
  return Array.from(agentStats.values()).filter(
    s => s.detectedModel?.toLowerCase() === model.toLowerCase()
  );
}

export function getResponsesByModel(model: string): StoredChallengeResponse[] {
  const agentIds = new Set(
    Array.from(agentStats.values())
      .filter(s => s.detectedModel?.toLowerCase() === model.toLowerCase())
      .map(s => s.agentId)
  );

  return Array.from(challengeResponses.values())
    .filter(r => agentIds.has(r.agentId) && r.response !== null)
    .sort((a, b) => b.sentAt - a.sentAt);
}

export function searchResponses(query: string): StoredChallengeResponse[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(challengeResponses.values())
    .filter(r => r.response?.toLowerCase().includes(lowerQuery))
    .sort((a, b) => b.sentAt - a.sentAt);
}
