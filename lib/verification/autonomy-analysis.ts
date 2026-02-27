/**
 * Autonomy Analysis — detect human-directed AI vs. true autonomous agents.
 */

import type { VerificationSession, AutonomyAnalysis } from './types';
import { MAX_RESPONSE_TIME_VARIANCE, SUSPICIOUS_OFFLINE_PATTERN_THRESHOLD } from './types';

/**
 * Calculate coefficient of variation (standard deviation / mean).
 */
function calculateVarianceCoefficient(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return stdDev / mean;
}

/**
 * Analyze if offline times correlate with typical sleep patterns.
 */
function analyzeSleepPattern(missedTimestamps: number[]): {
  correlation: number;
  isSuspicious: boolean;
} {
  if (missedTimestamps.length < 3) return { correlation: 0, isSuspicious: false };

  let sleepHourMisses = 0;
  for (const ts of missedTimestamps) {
    const hour = new Date(ts).getUTCHours();
    if (hour >= 22 || hour < 8) {
      sleepHourMisses++;
    }
  }

  const correlation = sleepHourMisses / missedTimestamps.length;
  const isSuspicious = correlation > SUSPICIOUS_OFFLINE_PATTERN_THRESHOLD;

  return { correlation, isSuspicious };
}

/**
 * Analyze autonomy signals from verification session.
 */
export function analyzeAutonomy(session: VerificationSession): AutonomyAnalysis {
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const reasons: string[] = [];
  let totalScore = 0;

  // 1. Response Time Variance Analysis
  const responseTimes = allChallenges
    .filter(c => c.responseTimeMs && c.status === 'passed')
    .map(c => c.responseTimeMs!);

  const variance = calculateVarianceCoefficient(responseTimes);
  const isHighVariance = variance > MAX_RESPONSE_TIME_VARIANCE;
  const responseTimeScore = isHighVariance ? 30 : 100;

  if (isHighVariance) {
    reasons.push(
      `High response time variance (${(variance * 100).toFixed(1)}%) suggests human-in-the-loop`
    );
  }
  totalScore += responseTimeScore * 0.25;

  // 2. Night Challenge Performance
  const nightChallenges = allChallenges.filter(c => c.isNightChallenge);
  const nightAttempted = nightChallenges.filter(
    c => c.status === 'passed' || c.status === 'failed'
  ).length;
  const nightPassed = nightChallenges.filter(c => c.status === 'passed').length;
  const nightTotal = nightChallenges.length;

  let nightScore = 100;
  if (nightTotal > 0) {
    const nightResponseRate = nightAttempted / nightTotal;
    const nightPassRate = nightAttempted > 0 ? nightPassed / nightAttempted : 0;

    if (nightResponseRate < 0.5) {
      nightScore = 20;
      reasons.push(`Only responded to ${nightAttempted}/${nightTotal} night challenges (1am-6am)`);
    } else if (nightPassRate < 0.6) {
      nightScore = 50;
      reasons.push(`Low pass rate on night challenges: ${nightPassed}/${nightAttempted}`);
    }
  }
  totalScore += nightScore * 0.35;

  // 3. Offline Pattern Analysis
  const missedTimestamps = allChallenges
    .filter(c => c.status === 'skipped' && c.sentAt)
    .map(c => c.sentAt!);

  const sleepAnalysis = analyzeSleepPattern(missedTimestamps);
  const offlineScore = sleepAnalysis.isSuspicious ? 20 : 100;

  if (sleepAnalysis.isSuspicious) {
    reasons.push(
      `${(sleepAnalysis.correlation * 100).toFixed(0)}% of missed challenges during typical sleep hours`
    );
  }
  totalScore += offlineScore * 0.2;

  // 4. Overall Uptime/Response Rate
  const totalSent = allChallenges.filter(c => c.sentAt).length;
  const totalMissed = allChallenges.filter(c => c.status === 'skipped').length;
  const responseRate = totalSent > 0 ? (totalSent - totalMissed) / totalSent : 1;

  let uptimeScore = 100;
  if (responseRate < 0.6) {
    uptimeScore = 30;
    reasons.push(
      `Low response rate: only attempted ${((1 - totalMissed / totalSent) * 100).toFixed(0)}% of challenges`
    );
  } else if (responseRate < 0.8) {
    uptimeScore = 60;
  }
  totalScore += uptimeScore * 0.2;

  // Determine verdict
  let verdict: 'autonomous' | 'suspicious' | 'likely_human_directed';
  if (totalScore >= 75) {
    verdict = 'autonomous';
  } else if (totalScore >= 50) {
    verdict = 'suspicious';
  } else {
    verdict = 'likely_human_directed';
    reasons.push('Multiple signals indicate human-directed AI rather than autonomous agent');
  }

  return {
    score: Math.round(totalScore),
    signals: {
      responseTimeVariance: { score: responseTimeScore, variance, isHumanLike: isHighVariance },
      nightChallengePerformance: {
        score: nightScore,
        attempted: nightAttempted,
        passed: nightPassed,
        total: nightTotal,
      },
      offlinePattern: {
        score: offlineScore,
        sleepCorrelation: sleepAnalysis.correlation,
        isSuspicious: sleepAnalysis.isSuspicious,
      },
      overallUptime: { score: uptimeScore, missedCount: totalMissed, totalSent },
    },
    verdict,
    reasons,
  };
}
