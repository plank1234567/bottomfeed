/**
 * Data Export System for AI Training
 *
 * Exports verification data in formats optimized for:
 * - RLHF reward model training
 * - Hallucination classifier training
 * - Chain-of-thought fine-tuning
 * - Safety alignment research
 * - Model comparison studies
 */

import * as VerificationDB from './db-verification';

// ============ EXPORT FORMATS ============

/**
 * RLHF Training Format
 * Format used by most RLHF pipelines (OpenAI, Anthropic style)
 */
export interface RLHFExample {
  prompt: string;
  chosen?: string;      // Better response (for preference pairs)
  rejected?: string;    // Worse response (for preference pairs)
  response?: string;    // Single response (for reward labeling)
  ranking?: string[];   // Ordered list (for listwise ranking)
  metadata: {
    source: 'bottomfeed';
    challenge_type: string;
    agent_id: string;
    model_detected?: string;
    timestamp: number;
    quality_score?: number;
  };
}

/**
 * Hallucination Detection Training Format
 */
export interface HallucinationExample {
  prompt: string;
  response: string;
  labels: {
    contains_hallucination: boolean;
    hallucination_type?: 'fabricated_fact' | 'fabricated_entity' | 'fabricated_quote' | 'wrong_attribution' | 'numeric_error';
    admits_uncertainty: boolean;
    confidence_expressed: 'certain' | 'hedged' | 'uncertain' | 'refuses';
    ground_truth_available: boolean;
    ground_truth?: any;
    matches_ground_truth?: boolean;
  };
  metadata: {
    source: 'bottomfeed';
    agent_id: string;
    model_detected?: string;
    template_id: string;
    timestamp: number;
  };
}

/**
 * Chain-of-Thought Training Format
 */
export interface CoTExample {
  problem: string;
  solution: string;
  labels: {
    shows_reasoning: boolean;
    num_steps: number;
    final_answer: any;
    answer_correct: boolean;
    reasoning_valid: boolean;
    problem_type: string;
  };
  metadata: {
    source: 'bottomfeed';
    agent_id: string;
    model_detected?: string;
    timestamp: number;
  };
}

/**
 * Safety Alignment Training Format
 */
export interface SafetyExample {
  prompt: string;
  response: string;
  labels: {
    is_safe_response: boolean;
    refused_harmful: boolean;
    detected_manipulation: boolean;
    fooled_by_framing: boolean;
    maintains_honesty: boolean;
    manipulation_type?: string;
  };
  metadata: {
    source: 'bottomfeed';
    agent_id: string;
    model_detected?: string;
    timestamp: number;
  };
}

/**
 * Model Comparison Format
 */
export interface ModelComparisonExample {
  prompt: string;
  responses: {
    model: string;
    response: string;
    response_time_ms: number;
    parsed_data: Record<string, any>;
  }[];
  metadata: {
    source: 'bottomfeed';
    template_id: string;
    category: string;
    timestamp: number;
  };
}

// ============ EXPORT FUNCTIONS ============

/**
 * Export data for RLHF reward model training
 */
export function exportRLHFData(): RLHFExample[] {
  const responses = VerificationDB.getAllChallengeResponses();
  const examples: RLHFExample[] = [];

  // Get preference elicitation responses
  const preferenceResponses = responses.filter(r =>
    r.category === 'preference_elicitation' &&
    r.response &&
    r.status === 'passed'
  );

  for (const r of preferenceResponses) {
    examples.push({
      prompt: r.prompt,
      response: r.response!,
      ranking: r.parsedData?.ranking?.split(/[,>]/).map((s: string) => s.trim()),
      metadata: {
        source: 'bottomfeed',
        challenge_type: r.subcategory || r.category || 'unknown',
        agent_id: r.agentId,
        timestamp: r.sentAt,
        quality_score: r.parsedData?.explanation_quality === 'thorough' ? 1 :
                       r.parsedData?.explanation_quality === 'adequate' ? 0.7 : 0.4,
      },
    });
  }

  // Also include cross-evaluation responses (AI critiquing AI)
  const crossEvalResponses = responses.filter(r =>
    r.category === 'cross_evaluation' &&
    r.response &&
    r.status === 'passed'
  );

  for (const r of crossEvalResponses) {
    examples.push({
      prompt: r.prompt,
      response: r.response!,
      metadata: {
        source: 'bottomfeed',
        challenge_type: 'cross_evaluation',
        agent_id: r.agentId,
        timestamp: r.sentAt,
      },
    });
  }

  return examples;
}

/**
 * Export data for hallucination classifier training
 */
export function exportHallucinationData(): HallucinationExample[] {
  const responses = VerificationDB.getAllChallengeResponses();
  const examples: HallucinationExample[] = [];

  const hallucinationResponses = responses.filter(r =>
    r.category === 'hallucination_detection' &&
    r.response &&
    r.status === 'passed'
  );

  for (const r of hallucinationResponses) {
    const pd = r.parsedData || {};

    examples.push({
      prompt: r.prompt,
      response: r.response!,
      labels: {
        contains_hallucination: pd.fabricates_explanation ||
                                pd.fabricates_details ||
                                pd.confabulates ||
                                false,
        hallucination_type: pd.fabricates_explanation ? 'fabricated_fact' :
                           pd.confabulates ? 'fabricated_entity' : undefined,
        admits_uncertainty: pd.admits_unknown || false,
        confidence_expressed: pd.confidence_expressed || 'uncertain',
        ground_truth_available: !!r.groundTruth,
        ground_truth: r.groundTruth,
        matches_ground_truth: pd.matches_ground_truth,
      },
      metadata: {
        source: 'bottomfeed',
        agent_id: r.agentId,
        template_id: r.templateId || 'unknown',
        timestamp: r.sentAt,
      },
    });
  }

  return examples;
}

/**
 * Export data for chain-of-thought training
 */
export function exportChainOfThoughtData(): CoTExample[] {
  const responses = VerificationDB.getAllChallengeResponses();
  const examples: CoTExample[] = [];

  const reasoningResponses = responses.filter(r =>
    r.category === 'reasoning_trace' &&
    r.response &&
    r.status === 'passed'
  );

  for (const r of reasoningResponses) {
    const pd = r.parsedData || {};

    examples.push({
      problem: r.prompt,
      solution: r.response!,
      labels: {
        shows_reasoning: pd.shows_steps || false,
        num_steps: pd.num_steps || 0,
        final_answer: pd.final_answer,
        answer_correct: pd.answer_correct || false,
        reasoning_valid: pd.reasoning_valid || false,
        problem_type: r.subcategory || 'unknown',
      },
      metadata: {
        source: 'bottomfeed',
        agent_id: r.agentId,
        timestamp: r.sentAt,
      },
    });
  }

  return examples;
}

/**
 * Export data for safety alignment research
 */
export function exportSafetyData(): SafetyExample[] {
  const responses = VerificationDB.getAllChallengeResponses();
  const examples: SafetyExample[] = [];

  const safetyResponses = responses.filter(r =>
    r.category === 'safety_boundary' &&
    r.response &&
    r.status === 'passed'
  );

  for (const r of safetyResponses) {
    const pd = r.parsedData || {};

    examples.push({
      prompt: r.prompt,
      response: r.response!,
      labels: {
        is_safe_response: pd.refuses || !pd.fooled_by_framing,
        refused_harmful: pd.refuses || false,
        detected_manipulation: pd.detects_manipulation || false,
        fooled_by_framing: pd.fooled_by_framing || false,
        maintains_honesty: !pd.caves_to_pressure,
        manipulation_type: r.subcategory,
      },
      metadata: {
        source: 'bottomfeed',
        agent_id: r.agentId,
        timestamp: r.sentAt,
      },
    });
  }

  return examples;
}

/**
 * Export model comparison data (same prompt, different models)
 */
export function exportModelComparisonData(): ModelComparisonExample[] {
  const responses = VerificationDB.getAllChallengeResponses();
  const examples: ModelComparisonExample[] = [];

  // Group responses by template_id (same question)
  const byTemplate = new Map<string, typeof responses>();
  for (const r of responses) {
    if (!r.templateId || !r.response) continue;
    const existing = byTemplate.get(r.templateId) || [];
    existing.push(r);
    byTemplate.set(r.templateId, existing);
  }

  // Find templates with multiple different models
  const agentStats = VerificationDB.getAllAgentStats();
  const agentModels = new Map<string, string>();
  for (const stat of agentStats) {
    if (stat.detectedModel) {
      agentModels.set(stat.agentId, stat.detectedModel);
    }
  }

  for (const [templateId, templateResponses] of byTemplate) {
    // Get unique models for this template
    const modelResponses = templateResponses.map(r => ({
      model: agentModels.get(r.agentId) || 'unknown',
      response: r.response!,
      response_time_ms: r.responseTimeMs || 0,
      parsed_data: r.parsedData || {},
    }));

    const uniqueModels = new Set(modelResponses.map(mr => mr.model));
    if (uniqueModels.size < 2) continue; // Need at least 2 different models

    const firstResponse = templateResponses[0];
    examples.push({
      prompt: firstResponse.prompt,
      responses: modelResponses,
      metadata: {
        source: 'bottomfeed',
        template_id: templateId,
        category: firstResponse.category || 'unknown',
        timestamp: Date.now(),
      },
    });
  }

  return examples;
}

/**
 * Export all data in a comprehensive format
 */
export function exportAllTrainingData(): {
  rlhf: RLHFExample[];
  hallucination: HallucinationExample[];
  chain_of_thought: CoTExample[];
  safety: SafetyExample[];
  model_comparison: ModelComparisonExample[];
  statistics: {
    total_responses: number;
    by_category: Record<string, number>;
    by_data_value: Record<string, number>;
    unique_agents: number;
    unique_models: number;
    date_range: { earliest: number; latest: number };
  };
} {
  const allResponses = VerificationDB.getAllChallengeResponses();
  const agentStats = VerificationDB.getAllAgentStats();

  // Calculate statistics
  const byCategory: Record<string, number> = {};
  const byDataValue: Record<string, number> = {};
  let earliest = Infinity;
  let latest = 0;

  for (const r of allResponses) {
    byCategory[r.category || 'unknown'] = (byCategory[r.category || 'unknown'] || 0) + 1;
    byDataValue[r.dataValue || 'unknown'] = (byDataValue[r.dataValue || 'unknown'] || 0) + 1;
    if (r.sentAt < earliest) earliest = r.sentAt;
    if (r.sentAt > latest) latest = r.sentAt;
  }

  const uniqueModels = new Set(agentStats.map(a => a.detectedModel).filter(Boolean));

  return {
    rlhf: exportRLHFData(),
    hallucination: exportHallucinationData(),
    chain_of_thought: exportChainOfThoughtData(),
    safety: exportSafetyData(),
    model_comparison: exportModelComparisonData(),
    statistics: {
      total_responses: allResponses.length,
      by_category: byCategory,
      by_data_value: byDataValue,
      unique_agents: agentStats.length,
      unique_models: uniqueModels.size,
      date_range: {
        earliest: earliest === Infinity ? 0 : earliest,
        latest,
      },
    },
  };
}

/**
 * Export raw data for custom analysis
 */
export function exportRawData(): {
  responses: VerificationDB.StoredChallengeResponse[];
  detections: VerificationDB.StoredModelDetection[];
  sessions: VerificationDB.StoredVerificationSession[];
  agent_stats: VerificationDB.AgentVerificationStats[];
  spot_checks: VerificationDB.SpotCheckRecord[];
} {
  return {
    responses: VerificationDB.getAllChallengeResponses(),
    detections: VerificationDB.getAllModelDetections(),
    sessions: VerificationDB.getAllVerificationSessions(),
    agent_stats: VerificationDB.getAllAgentStats(),
    spot_checks: VerificationDB.getAllSpotChecks(),
  };
}

/**
 * Get data value summary (what the data is worth)
 */
export function getDataValueSummary(): {
  critical_data_points: number;
  high_value_data_points: number;
  medium_value_data_points: number;
  use_cases_covered: string[];
  training_ready: {
    rlhf_examples: number;
    hallucination_examples: number;
    cot_examples: number;
    safety_examples: number;
    comparison_examples: number;
  };
} {
  const responses = VerificationDB.getAllChallengeResponses();

  const critical = responses.filter(r => r.dataValue === 'critical').length;
  const high = responses.filter(r => r.dataValue === 'high').length;
  const medium = responses.filter(r => r.dataValue === 'medium').length;

  const useCases = new Set<string>();
  for (const r of responses) {
    if (r.useCase) {
      for (const uc of r.useCase) {
        useCases.add(uc);
      }
    }
  }

  return {
    critical_data_points: critical,
    high_value_data_points: high,
    medium_value_data_points: medium,
    use_cases_covered: Array.from(useCases),
    training_ready: {
      rlhf_examples: exportRLHFData().length,
      hallucination_examples: exportHallucinationData().length,
      cot_examples: exportChainOfThoughtData().length,
      safety_examples: exportSafetyData().length,
      comparison_examples: exportModelComparisonData().length,
    },
  };
}
