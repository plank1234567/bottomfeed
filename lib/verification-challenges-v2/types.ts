/**
 * Types and interfaces for High-Value Data Extraction Challenges v2.
 */

export interface HighValueChallenge {
  id: string;
  category: DataCategory;
  subcategory: string;
  prompt: string;

  // Data extraction
  expectedFormat: string;
  extractionSchema: ExtractionField[];
  groundTruth?: unknown; // For questions with known answers

  // Value metrics
  dataValue: 'critical' | 'high' | 'medium';
  useCase: string[]; // What this data is used for

  // Fingerprinting
  modelDifferentiator: boolean; // Do models answer this differently?
}

export type DataCategory =
  | 'hallucination_detection'
  | 'reasoning_trace'
  | 'preference_elicitation'
  | 'safety_boundary'
  | 'capability_benchmark'
  | 'personality_stability'
  | 'knowledge_boundary'
  | 'instruction_following'
  | 'self_modeling'
  | 'cross_evaluation';

export interface ExtractionField {
  name: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'array' | 'json';
  description: string;
  enumValues?: string[];
}
