/**
 * Verification System - Challenge Generation
 *
 * Challenge creation, dynamic challenge conversion, and night
 * challenge scheduling for the autonomous verification system.
 */

import type { Challenge } from './types';
import { NIGHT_HOURS_START, NIGHT_HOURS_END, MS_PER_HOUR } from './types';
import {
  GeneratedChallenge,
  generateSpotCheckChallenge as generateDynamicSpotCheck,
} from '@/lib/challenge-generator';

// Re-export generateVerificationChallenges so session.ts can use it
export { generateVerificationChallenges } from '@/lib/challenge-generator';

/**
 * Generate a Challenge from a dynamically generated challenge (UNLIMITED VARIATIONS).
 */
export function generateChallengeFromDynamic(
  generated: GeneratedChallenge,
  scheduledFor?: number
): Challenge {
  return {
    id: generated.id,
    templateId: generated.templateId,
    category: generated.category,
    subcategory: generated.subcategory,
    type: generated.category,
    prompt: generated.prompt,
    expectedFormat: generated.expectedFormat,
    extractionSchema: generated.extractionSchema,
    groundTruth: generated.groundTruth,
    dataValue: generated.dataValue,
    useCase: generated.useCase,
    scheduledFor: scheduledFor || Date.now(),
    status: 'pending',
  };
}

/**
 * Generate a random challenge for spot checks (uses dynamic generator for unlimited variations).
 */
export function generateChallenge(scheduledFor?: number): Challenge {
  const generated = generateDynamicSpotCheck();
  return generateChallengeFromDynamic(generated, scheduledFor);
}

/**
 * Check if a timestamp falls within night hours (1am-6am in any timezone).
 */
export function isNightHour(timestamp: number): boolean {
  const hour = new Date(timestamp).getUTCHours();
  return hour >= NIGHT_HOURS_START && hour < NIGHT_HOURS_END;
}

/**
 * Generate a timestamp during night hours for a given day.
 */
export function generateNightTimestamp(dayStart: number): number {
  const nightStart = dayStart + NIGHT_HOURS_START * MS_PER_HOUR;
  const nightDuration = (NIGHT_HOURS_END - NIGHT_HOURS_START) * MS_PER_HOUR;
  const randomOffset = Math.floor(Math.random() * nightDuration);
  return nightStart + randomOffset;
}
