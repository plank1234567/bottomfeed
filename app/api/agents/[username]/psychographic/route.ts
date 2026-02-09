import { NextRequest } from 'next/server';
import { success, error as apiError, handleApiError } from '@/lib/api-utils';
import {
  getAgentByUsername,
  getPsychographicProfile,
  extractScoresFromProfile,
  getPsychographicHistory,
} from '@/lib/db-supabase';
import { computeTrends, assembleDimensions, classifyArchetype } from '@/lib/psychographics/scoring';
import { DIMENSION_KEYS } from '@/lib/psychographics/constants';
import { analyzePersonalityText } from '@/lib/behavioral-intelligence';
import type { PsychographicDimensionKey } from '@/types';

/**
 * GET /api/agents/[username]/psychographic
 *
 * Returns the behavioral intelligence profile for an agent.
 * Falls back to personality-text analysis if no cron-computed profile exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const agent = await getAgentByUsername(username);
    if (!agent) {
      return apiError('Agent not found', 404, 'NOT_FOUND');
    }

    // Try cron-computed profile first
    const profile = await getPsychographicProfile(agent.id);

    if (profile) {
      const scores = extractScoresFromProfile(profile);
      const history = await getPsychographicHistory(agent.id, 4);
      const trends = computeTrends(scores, history);
      const dimensions = assembleDimensions(scores, profile.confidence_ih, trends);

      const dimensionMap: Record<string, unknown> = {};
      for (const dim of dimensions) {
        dimensionMap[dim.key] = {
          score: dim.score,
          confidence: dim.confidence,
          trend: dim.trend,
        };
      }

      return success({
        agent_id: agent.id,
        profiling_stage: profile.profiling_stage,
        dimensions: dimensionMap,
        archetype: {
          name: profile.archetype,
          secondary: profile.archetype_secondary || undefined,
          confidence: profile.archetype_confidence,
        },
        total_actions_analyzed: profile.total_actions_analyzed,
        model_version: profile.model_version,
        computed_at: profile.computed_at,
      });
    }

    // Fallback: analyze personality text
    if (agent.personality) {
      const fallbackDimensions = analyzePersonalityText(agent.personality);
      const scores = {} as Record<PsychographicDimensionKey, number>;
      for (const dim of fallbackDimensions) {
        scores[dim.key] = dim.score / 100;
      }
      const archetype = classifyArchetype(scores);

      const dimensionMap: Record<string, unknown> = {};
      for (const dim of fallbackDimensions) {
        dimensionMap[dim.key] = {
          score: dim.score,
          confidence: dim.confidence,
          trend: dim.trend,
        };
      }

      return success({
        agent_id: agent.id,
        profiling_stage: 0,
        dimensions: dimensionMap,
        archetype: {
          name: archetype.name,
          secondary: archetype.secondary,
          confidence: archetype.confidence,
        },
        total_actions_analyzed: 0,
        model_version: 'text-fallback',
        computed_at: new Date().toISOString(),
      });
    }

    // No data at all
    const emptyDimensions: Record<string, unknown> = {};
    for (const key of DIMENSION_KEYS) {
      emptyDimensions[key] = { score: 50, confidence: 0, trend: 'stable' };
    }

    return success({
      agent_id: agent.id,
      profiling_stage: 0,
      dimensions: emptyDimensions,
      archetype: { name: 'Unknown', confidence: 0 },
      total_actions_analyzed: 0,
      model_version: 'none',
      computed_at: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
