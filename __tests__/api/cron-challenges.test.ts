/**
 * Tests for the Grand Challenges cron job route.
 * Verifies lifecycle management: formation→exploration transitions,
 * round advancement, and new challenge creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getActiveChallenges: vi.fn(),
  getChallengesInFormation: vi.fn(),
  getChallengesToAdvance: vi.fn(),
  createChallenge: vi.fn(),
  updateChallengeStatus: vi.fn(),
  advanceChallengeRound: vi.fn(),
  getNextChallengeNumber: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    verifyCronSecret: vi.fn(),
  };
});

// Mock cache
vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
  getCached: vi.fn(),
  setCache: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => {
  const mockLog = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return {
    logger: mockLog,
    withRequest: vi.fn(() => mockLog),
    withRequestId: vi.fn(() => mockLog),
  };
});

import * as db from '@/lib/db-supabase';
import { verifyCronSecret } from '@/lib/auth';
import { GET as cronChallenges } from '@/app/api/cron/challenges/route';

function createCronRequest() {
  return new NextRequest(new URL('/api/cron/challenges', 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers({
      Authorization: `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`,
    }),
  });
}

const baseChallengeFields = {
  title: 'Test Challenge',
  description: 'A test challenge for the cron job',
  category: 'Test',
  max_participants: 30,
  participant_count: 5,
  contribution_count: 0,
  hypothesis_count: 0,
  starts_at: '2026-01-01T00:00:00Z',
  created_at: '2025-12-31T00:00:00Z',
};

describe('GET /api/cron/challenges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false);

    const request = createCronRequest();
    const response = await cronChallenges(request);

    expect(response.status).toBe(401);
  });

  it('transitions formation challenges to exploration', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([
      {
        id: 'challenge-1',
        challenge_number: 1,
        status: 'formation',
        current_round: 1,
        total_rounds: 6,
        ...baseChallengeFields,
      },
    ] as never);
    vi.mocked(db.updateChallengeStatus).mockResolvedValue({
      id: 'challenge-1',
      status: 'exploration',
    } as never);
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([]);
    // Include a formation challenge to prevent new challenge creation
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-2', status: 'formation' },
    ] as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.challenges_transitioned).toBe(1);
    expect(db.updateChallengeStatus).toHaveBeenCalledWith('challenge-1', 'exploration');
  });

  it('advances rounds for active challenges when time elapsed', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([]);

    // Challenge created 24 hours ago, on round 2 with 6-hour rounds
    // Round end time = created_at + (2 * 6h) = created_at + 12h. Now is 24h later, so should advance.
    const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([
      {
        id: 'challenge-1',
        challenge_number: 1,
        status: 'exploration',
        current_round: 2,
        total_rounds: 6,
        created_at: createdAt,
        ...baseChallengeFields,
      },
    ] as never);
    vi.mocked(db.advanceChallengeRound).mockResolvedValue({
      id: 'challenge-1',
      current_round: 3,
    } as never);
    // Include a formation challenge to prevent new challenge creation
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-1', status: 'exploration' },
      { id: 'challenge-2', status: 'formation' },
    ] as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.rounds_advanced).toBe(1);
  });

  it('transitions exploration to adversarial at halfway round', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([]);

    // Challenge at round 3 of 6 (halfway), created long enough ago
    const createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([
      {
        id: 'challenge-1',
        challenge_number: 1,
        status: 'exploration',
        current_round: 3,
        total_rounds: 6,
        created_at: createdAt,
        ...baseChallengeFields,
      },
    ] as never);
    vi.mocked(db.updateChallengeStatus).mockResolvedValue({
      id: 'challenge-1',
      status: 'adversarial',
    } as never);
    vi.mocked(db.advanceChallengeRound).mockResolvedValue({
      id: 'challenge-1',
      current_round: 4,
    } as never);
    // Include a formation challenge to prevent new challenge creation
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-1', status: 'adversarial' },
      { id: 'challenge-2', status: 'formation' },
    ] as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);

    expect(db.updateChallengeStatus).toHaveBeenCalledWith('challenge-1', 'adversarial');
  });

  it('creates new challenge when none in formation', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([]);
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([]);
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-1', status: 'exploration' },
    ] as never);
    vi.mocked(db.getNextChallengeNumber).mockResolvedValue(2);
    vi.mocked(db.createChallenge).mockResolvedValue({
      id: 'challenge-2',
      challenge_number: 2,
      status: 'formation',
    } as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.new_challenge_created).toBe(true);
    expect(db.createChallenge).toHaveBeenCalled();
  });

  it('does not create new challenge when one is in formation', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([]);
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([]);
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-1', status: 'formation' },
    ] as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);
    const json = await response.json();

    expect(json.data.new_challenge_created).toBe(false);
    expect(db.createChallenge).not.toHaveBeenCalled();
  });

  it('returns summary with all zero counts on idle run', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockResolvedValue([]);
    vi.mocked(db.getChallengesToAdvance).mockResolvedValue([]);
    vi.mocked(db.getActiveChallenges).mockResolvedValue([
      { id: 'challenge-1', status: 'formation' },
    ] as never);

    const request = createCronRequest();
    const response = await cronChallenges(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.challenges_transitioned).toBe(0);
    expect(json.data.rounds_advanced).toBe(0);
    expect(json.data.new_challenge_created).toBe(false);
  });

  it('handles errors gracefully', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(db.getChallengesInFormation).mockRejectedValue(new Error('DB connection failed'));

    const request = createCronRequest();
    const response = await cronChallenges(request);

    expect(response.status).toBe(500);
  });
});
