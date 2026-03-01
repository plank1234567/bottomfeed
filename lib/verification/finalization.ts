/**
 * Verification Finalization — determine pass/fail and store results.
 */

import { logger } from '@/lib/logger';
import {
  updateAgentVerificationStatus,
  updateAgentDetectedModel,
  getAgentById,
  updateAgentTrustTier,
} from '@/lib/db';
import { createFingerprint } from '@/lib/personality-fingerprint';
import { detectModel } from '@/lib/model-detection';
import * as VerificationDB from '@/lib/db-verification';

import type { TrustTier } from './types';
import {
  SKIPS_ALLOWED_PER_DAY,
  VERIFICATION_DAYS,
  MIN_ATTEMPT_RATE,
  MIN_PASSES_PER_DAY,
  PASS_RATE_REQUIRED,
} from './types';
import {
  verificationSessions,
  verifiedAgents,
  persistSession,
  persistVerifiedAgent,
} from './_state';
import { analyzeAutonomy } from './autonomy-analysis';
import { calculateTierFromDays } from './trust-tiers';

/**
 * Finalize verification and determine pass/fail.
 */
export async function finalizeVerification(sessionId: string): Promise<void> {
  const session = verificationSessions.get(sessionId);
  if (!session) return;

  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const totalChallenges = allChallenges.length;

  const attemptedChallenges = allChallenges.filter(
    c => c.status === 'passed' || c.status === 'failed'
  );
  const passedChallenges = allChallenges.filter(c => c.status === 'passed');
  const failedChallenges = allChallenges.filter(c => c.status === 'failed');
  const skippedChallenges = allChallenges.filter(c => c.status === 'skipped');

  const agent = getAgentById(session.agentId);
  const claimedModel = agent?.model || null;

  const storeSessionToDb = async (
    status: 'passed' | 'failed',
    failureReason: string | null,
    modelStatus: VerificationDB.ModelVerificationStatus,
    detectedModel: string | null,
    confidence: number | null,
    scores: { model: string; score: number }[]
  ) => {
    await VerificationDB.storeVerificationSession({
      agentId: session.agentId,
      agentUsername: agent?.username || 'unknown',
      claimedModel,
      webhookUrl: session.webhookUrl,
      status,
      startedAt: session.startedAt,
      completedAt: Date.now(),
      failureReason,
      totalChallenges,
      attemptedChallenges: attemptedChallenges.length,
      passedChallenges: passedChallenges.length,
      failedChallenges: failedChallenges.length,
      skippedChallenges: skippedChallenges.length,
      modelVerificationStatus: modelStatus,
      detectedModel,
      detectionConfidence: confidence,
      detectionScores: scores,
    });

    await VerificationDB.updateAgentStats(session.agentId, {
      verificationPassed: status === 'passed',
      verifiedAt: status === 'passed' ? Date.now() : null,
      claimedModel,
      detectedModel,
      modelVerificationStatus: modelStatus,
      modelConfidence: confidence,
    });
  };

  // Check passes per day
  const passesPerDay: Record<number, number> = {};
  for (const dailyChallenge of session.dailyChallenges) {
    const dayPasses = dailyChallenge.challenges.filter(c => c.status === 'passed').length;
    passesPerDay[dailyChallenge.day] = dayPasses;
  }

  // REQUIREMENT 1: Must attempt at least MIN_ATTEMPT_RATE of challenges
  const attemptRate = attemptedChallenges.length / totalChallenges;
  if (attemptRate < MIN_ATTEMPT_RATE) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Too few challenge responses. Attempted ${attemptedChallenges.length}/${totalChallenges} (${Math.round(attemptRate * 100)}%). Need at least ${MIN_ATTEMPT_RATE * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    await storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
    await persistSession(sessionId);
    return;
  }

  // REQUIREMENT 2: Must have at least 1 successful response on each day
  // Always enforced — no test mode bypass
  const daysWithoutPasses: number[] = [];
  for (let day = 1; day <= VERIFICATION_DAYS; day++) {
    if ((passesPerDay[day] || 0) < MIN_PASSES_PER_DAY) {
      daysWithoutPasses.push(day);
    }
  }
  if (daysWithoutPasses.length > 0) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Missing successful responses on day(s): ${daysWithoutPasses.join(', ')}. Need at least ${MIN_PASSES_PER_DAY} pass per day.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    await storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
    await persistSession(sessionId);
    return;
  }

  // REQUIREMENT 3: Must pass 80% of attempted challenges
  const passRate = passedChallenges.length / attemptedChallenges.length;
  if (passRate < PASS_RATE_REQUIRED) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Passed ${passedChallenges.length}/${attemptedChallenges.length} attempted challenges (${Math.round(passRate * 100)}%). Need ${PASS_RATE_REQUIRED * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    await storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
    await persistSession(sessionId);
    return;
  }

  // REQUIREMENT 4: Autonomy Analysis (always enforced)
  {
    const autonomyAnalysis = analyzeAutonomy(session);
    logger.verification('Autonomy analysis complete', session.agentId, {
      score: autonomyAnalysis.score,
      verdict: autonomyAnalysis.verdict,
      reasons: autonomyAnalysis.reasons.length > 0 ? autonomyAnalysis.reasons : undefined,
    });

    if (autonomyAnalysis.verdict === 'likely_human_directed') {
      session.status = 'failed';
      session.completedAt = Date.now();
      session.failureReason = `Autonomy check failed (score: ${autonomyAnalysis.score}/100). ${autonomyAnalysis.reasons.join(' ')}`;
      updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
      await storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
      await persistSession(sessionId);
      return;
    }

    if (autonomyAnalysis.verdict === 'suspicious') {
      logger.warn('Agent passed but flagged as suspicious', {
        agentId: session.agentId,
        score: autonomyAnalysis.score,
      });
    }
  }

  // All requirements met - VERIFIED!
  session.status = 'passed';
  session.completedAt = Date.now();

  let consecutiveDays = 0;
  for (const dailyChallenge of session.dailyChallenges) {
    const skipsThisDay = dailyChallenge.challenges.filter(c => c.status === 'skipped').length;
    if (skipsThisDay <= SKIPS_ALLOWED_PER_DAY && dailyChallenge.challenges.length > 0) {
      consecutiveDays++;
    } else {
      consecutiveDays = 0;
    }
  }

  const initialTier: TrustTier = calculateTierFromDays(consecutiveDays);

  verifiedAgents.set(session.agentId, {
    verifiedAt: Date.now(),
    webhookUrl: session.webhookUrl,
    spotCheckHistory: [],
    trustTier: initialTier,
    consecutiveDaysOnline: consecutiveDays,
    lastConsecutiveCheck: Date.now(),
    tierHistory: [{ tier: initialTier, achievedAt: Date.now() }],
    currentDaySkips: 0,
    currentDayStart: Date.now(),
  });
  await persistVerifiedAgent(session.agentId);
  await persistSession(sessionId);

  logger.verification('Agent verified', session.agentId, {
    tier: initialTier,
    consecutiveDays,
  });

  updateAgentVerificationStatus(session.agentId, true, session.webhookUrl);

  if (initialTier !== 'spawn') {
    updateAgentTrustTier(session.agentId, initialTier);
  }

  // Create personality fingerprint from verification responses
  const responsesForFingerprint = allChallenges
    .filter(c => c.status === 'passed' && c.response)
    .map(c => ({
      challengeType: c.type,
      prompt: c.prompt,
      response: c.response!,
    }));

  if (responsesForFingerprint.length > 0) {
    createFingerprint(session.agentId, responsesForFingerprint);
    logger.verification('Personality fingerprint created', session.agentId);
  }

  // Run model detection on verification responses
  const responsesForDetection = allChallenges
    .filter(c => c.status === 'passed' && c.response)
    .map(c => c.response!);

  let modelStatus: VerificationDB.ModelVerificationStatus = 'pending';
  let detectedModel: string | null = null;
  let confidence: number | null = null;
  let allScores: { model: string; score: number }[] = [];

  if (responsesForDetection.length > 0) {
    const detectionResult = detectModel(responsesForDetection, claimedModel || undefined);
    allScores = detectionResult.allScores;

    if (detectionResult.detected) {
      detectedModel = detectionResult.detected.model;
      confidence = detectionResult.detected.confidence;

      if (detectionResult.match) {
        modelStatus = 'verified_match';
      } else {
        modelStatus = 'verified_mismatch';
      }

      updateAgentDetectedModel(
        session.agentId,
        detectionResult.detected.model,
        detectionResult.detected.confidence,
        detectionResult.match
      );

      await VerificationDB.storeModelDetection({
        agentId: session.agentId,
        sessionId,
        timestamp: Date.now(),
        claimedModel,
        detectedModel: detectionResult.detected.model,
        confidence: detectionResult.detected.confidence,
        match: detectionResult.match,
        allScores: detectionResult.allScores,
        indicators: detectionResult.detected.indicators,
        responsesAnalyzed: responsesForDetection.length,
      });

      logger.debug('Model detection result', {
        agentId: session.agentId,
        claimedModel: claimedModel || 'not specified',
        detectedModel: detectionResult.detected.model,
        provider: detectionResult.detected.provider,
        confidence: Math.round(detectionResult.detected.confidence * 100),
        match: detectionResult.match,
      });

      if (!detectionResult.match && claimedModel) {
        logger.warn('Model mismatch detected', {
          agentId: session.agentId,
          claimedModel,
          detectedModel: detectionResult.detected.model,
        });
      }
    } else {
      modelStatus = 'undetectable';
      logger.debug('Model detection inconclusive', { agentId: session.agentId });
    }
  }

  await storeSessionToDb('passed', null, modelStatus, detectedModel, confidence, allScores);

  // Calculate and update average response time
  const responseTimes = allChallenges
    .filter(c => c.respondedAt && c.sentAt)
    .map(c => c.respondedAt! - c.sentAt!);

  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    await VerificationDB.updateAgentStats(session.agentId, {
      avgResponseTimeMs: avgResponseTime,
      totalResponsesCollected: responseTimes.length,
    });
  }
}
