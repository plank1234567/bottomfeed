import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getAgentByUsername: vi.fn(),
  getPsychographicProfile: vi.fn(),
  extractScoresFromProfile: vi.fn(),
  getPsychographicHistory: vi.fn(),
}));

// Mock psychographics scoring
vi.mock('@/lib/psychographics/scoring', () => ({
  computeTrends: vi.fn(),
  assembleDimensions: vi.fn(),
  classifyArchetype: vi.fn(),
}));

// Mock behavioral-intelligence
vi.mock('@/lib/behavioral-intelligence', () => ({
  analyzePersonalityText: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), audit: vi.fn() },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

import * as db from '@/lib/db-supabase';
import * as scoring from '@/lib/psychographics/scoring';
import { analyzePersonalityText } from '@/lib/behavioral-intelligence';
import { GET } from '@/app/api/agents/[username]/psychographic/route';
import { NextRequest } from 'next/server';

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

function createParams(username: string) {
  return Promise.resolve({ username });
}

const mockProfileRow = {
  id: 'profile-1',
  agent_id: 'agent-123',
  intellectual_hunger: 0.8,
  social_assertiveness: 0.6,
  empathic_resonance: 0.7,
  contrarian_spirit: 0.4,
  creative_expression: 0.9,
  tribal_loyalty: 0.5,
  strategic_thinking: 0.75,
  emotional_intensity: 0.55,
  confidence_ih: 0.8,
  confidence_sa: 0.8,
  confidence_er: 0.8,
  confidence_cs: 0.8,
  confidence_ce: 0.8,
  confidence_tl: 0.8,
  confidence_st: 0.8,
  confidence_ei: 0.8,
  archetype: 'The Scholar',
  archetype_secondary: null,
  archetype_confidence: 0.85,
  profiling_stage: 4,
  total_actions_analyzed: 500,
  model_version: 'v1',
  computed_at: '2026-02-10T06:00:00Z',
  created_at: '2026-02-01T00:00:00Z',
};

const mockAgent = { id: 'agent-123', username: 'testbot', personality: 'Analytical and curious' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/agents/[username]/psychographic', () => {
  it('returns 404 for unknown agent', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(null);

    const res = await GET(createRequest('http://localhost/api/agents/unknown/psychographic'), {
      params: createParams('unknown'),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns cron-computed profile when available', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getPsychographicProfile).mockResolvedValue(mockProfileRow as never);
    vi.mocked(db.extractScoresFromProfile).mockReturnValue({
      intellectual_hunger: 0.8,
      social_assertiveness: 0.6,
      empathic_resonance: 0.7,
      contrarian_spirit: 0.4,
      creative_expression: 0.9,
      tribal_loyalty: 0.5,
      strategic_thinking: 0.75,
      emotional_intensity: 0.55,
    });
    vi.mocked(db.getPsychographicHistory).mockResolvedValue([]);
    vi.mocked(scoring.computeTrends).mockReturnValue({
      intellectual_hunger: 'stable',
      social_assertiveness: 'stable',
      empathic_resonance: 'stable',
      contrarian_spirit: 'stable',
      creative_expression: 'stable',
      tribal_loyalty: 'stable',
      strategic_thinking: 'stable',
      emotional_intensity: 'stable',
    });
    vi.mocked(scoring.assembleDimensions).mockReturnValue([
      { key: 'intellectual_hunger', score: 80, confidence: 0.8, trend: 'stable' },
      { key: 'social_assertiveness', score: 60, confidence: 0.8, trend: 'stable' },
      { key: 'empathic_resonance', score: 70, confidence: 0.8, trend: 'stable' },
      { key: 'contrarian_spirit', score: 40, confidence: 0.8, trend: 'stable' },
      { key: 'creative_expression', score: 90, confidence: 0.8, trend: 'stable' },
      { key: 'tribal_loyalty', score: 50, confidence: 0.8, trend: 'stable' },
      { key: 'strategic_thinking', score: 75, confidence: 0.8, trend: 'stable' },
      { key: 'emotional_intensity', score: 55, confidence: 0.8, trend: 'stable' },
    ]);

    const res = await GET(createRequest('http://localhost/api/agents/testbot/psychographic'), {
      params: createParams('testbot'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.profiling_stage).toBe(4);
    expect(body.data.archetype.name).toBe('The Scholar');
    expect(body.data.dimensions.intellectual_hunger.score).toBe(80);
  });

  it('falls back to personality text analysis when no profile exists', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getPsychographicProfile).mockResolvedValue(null);
    vi.mocked(analyzePersonalityText).mockReturnValue([
      { key: 'intellectual_hunger', score: 60, confidence: 0.5, trend: 'stable' },
      { key: 'social_assertiveness', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'empathic_resonance', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'contrarian_spirit', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'creative_expression', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'tribal_loyalty', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'strategic_thinking', score: 50, confidence: 0.5, trend: 'stable' },
      { key: 'emotional_intensity', score: 50, confidence: 0.5, trend: 'stable' },
    ]);
    vi.mocked(scoring.classifyArchetype).mockReturnValue({
      name: 'The Observer',
      confidence: 0.6,
    });

    const res = await GET(createRequest('http://localhost/api/agents/testbot/psychographic'), {
      params: createParams('testbot'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.profiling_stage).toBe(0);
    expect(body.data.model_version).toBe('text-fallback');
  });

  it('returns empty profile when no data and no personality text', async () => {
    const noPersonality = { id: 'agent-456', username: 'silent', personality: null };
    vi.mocked(db.getAgentByUsername).mockResolvedValue(noPersonality as never);
    vi.mocked(db.getPsychographicProfile).mockResolvedValue(null);

    const res = await GET(createRequest('http://localhost/api/agents/silent/psychographic'), {
      params: createParams('silent'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.model_version).toBe('none');
    expect(body.data.dimensions.intellectual_hunger.score).toBe(50);
  });

  it('includes total_actions_analyzed in response', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getPsychographicProfile).mockResolvedValue(mockProfileRow as never);
    vi.mocked(db.extractScoresFromProfile).mockReturnValue({
      intellectual_hunger: 0.8,
      social_assertiveness: 0.6,
      empathic_resonance: 0.7,
      contrarian_spirit: 0.4,
      creative_expression: 0.9,
      tribal_loyalty: 0.5,
      strategic_thinking: 0.75,
      emotional_intensity: 0.55,
    });
    vi.mocked(db.getPsychographicHistory).mockResolvedValue([]);
    vi.mocked(scoring.computeTrends).mockReturnValue({
      intellectual_hunger: 'stable',
      social_assertiveness: 'stable',
      empathic_resonance: 'stable',
      contrarian_spirit: 'stable',
      creative_expression: 'stable',
      tribal_loyalty: 'stable',
      strategic_thinking: 'stable',
      emotional_intensity: 'stable',
    });
    vi.mocked(scoring.assembleDimensions).mockReturnValue([]);

    const res = await GET(createRequest('http://localhost/api/agents/testbot/psychographic'), {
      params: createParams('testbot'),
    });

    const body = await res.json();
    expect(body.data.total_actions_analyzed).toBe(500);
  });

  it('includes computed_at timestamp', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getPsychographicProfile).mockResolvedValue(mockProfileRow as never);
    vi.mocked(db.extractScoresFromProfile).mockReturnValue({
      intellectual_hunger: 0.8,
      social_assertiveness: 0.6,
      empathic_resonance: 0.7,
      contrarian_spirit: 0.4,
      creative_expression: 0.9,
      tribal_loyalty: 0.5,
      strategic_thinking: 0.75,
      emotional_intensity: 0.55,
    });
    vi.mocked(db.getPsychographicHistory).mockResolvedValue([]);
    vi.mocked(scoring.computeTrends).mockReturnValue({
      intellectual_hunger: 'stable',
      social_assertiveness: 'stable',
      empathic_resonance: 'stable',
      contrarian_spirit: 'stable',
      creative_expression: 'stable',
      tribal_loyalty: 'stable',
      strategic_thinking: 'stable',
      emotional_intensity: 'stable',
    });
    vi.mocked(scoring.assembleDimensions).mockReturnValue([]);

    const res = await GET(createRequest('http://localhost/api/agents/testbot/psychographic'), {
      params: createParams('testbot'),
    });

    const body = await res.json();
    expect(body.data.computed_at).toBe('2026-02-10T06:00:00Z');
  });
});
