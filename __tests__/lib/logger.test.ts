/**
 * Tests for lib/logger.ts
 * Verifies the pino-backed logger facade routes methods correctly,
 * serializes errors, and supports request-scoped child loggers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting — safe to reference in mock factory
const mockPinoInstance = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('pino', () => {
  const pinoFn = vi.fn(() => mockPinoInstance);
  pinoFn.stdTimeFunctions = { isoTime: () => ',"time":"2024-01-15T10:30:00.000Z"' };
  return { default: pinoFn };
});

import { logger, withRequestId, withRequest } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic level methods', () => {
    it('routes debug() to pino.debug', () => {
      logger.debug('test message');
      expect(mockPinoInstance.debug).toHaveBeenCalledWith('test message');
    });

    it('routes info() to pino.info', () => {
      logger.info('hello');
      expect(mockPinoInstance.info).toHaveBeenCalledWith('hello');
    });

    it('routes warn() to pino.warn', () => {
      logger.warn('warning');
      expect(mockPinoInstance.warn).toHaveBeenCalledWith('warning');
    });

    it('passes context as first arg (pino mergingObject)', () => {
      logger.info('test', { foo: 'bar' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith({ foo: 'bar' }, 'test');
    });
  });

  describe('error()', () => {
    it('serializes Error objects under err key', () => {
      const err = new Error('boom');
      logger.error('something failed', err);
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            name: 'Error',
            message: 'boom',
          }),
        }),
        'something failed'
      );
    });

    it('handles context object as second argument', () => {
      logger.error('API Error', { statusCode: 500 });
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 }),
        'API Error'
      );
    });

    it('handles Error + context together', () => {
      const err = new Error('fail');
      logger.error('oops', err, { requestId: 'abc' });
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({ message: 'fail' }),
          requestId: 'abc',
        }),
        'oops'
      );
    });

    it('handles message-only call', () => {
      logger.error('simple error');
      expect(mockPinoInstance.error).toHaveBeenCalledWith('simple error');
    });
  });

  describe('domain-specific methods', () => {
    it('audit() logs with type: audit', () => {
      logger.audit('agent_deleted', { agentId: '123' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'audit', agentId: '123' }),
        'AUDIT: agent_deleted'
      );
    });

    it('verification() logs with type: verification', () => {
      logger.verification('challenge_sent', 'agent-1', { round: 2 });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'verification', agentId: 'agent-1', round: 2 }),
        'Verification: challenge_sent'
      );
    });

    it('activity() logs with type: activity at debug level', () => {
      logger.activity('post_created', 'agent-2');
      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'activity', agentId: 'agent-2' }),
        'Agent activity: post_created'
      );
    });

    it('request() logs with type: request', () => {
      logger.request('POST', '/api/posts', { agentId: 'a1' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'request', agentId: 'a1' }),
        'POST /api/posts'
      );
    });

    it('response() uses error level for 5xx', () => {
      logger.response('GET', '/api/feed', 500, 120);
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'response', status: 500, durationMs: 120 }),
        'GET /api/feed 500'
      );
    });

    it('response() uses warn level for 4xx', () => {
      logger.response('GET', '/api/feed', 404, 50);
      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'response', status: 404 }),
        'GET /api/feed 404'
      );
    });
  });

  describe('withRequestId()', () => {
    it('returns logger with requestId bound to all calls', () => {
      const log = withRequestId('req-123');
      log.info('hello', { extra: true });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-123', extra: true }),
        'hello'
      );
    });

    it('scoped error() includes requestId in context', () => {
      const log = withRequestId('req-456');
      const err = new Error('oops');
      log.error('fail', err);
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-456',
          err: expect.objectContaining({ message: 'oops' }),
        }),
        'fail'
      );
    });
  });

  describe('withRequest()', () => {
    it('extracts x-request-id from headers', () => {
      const mockReq = {
        headers: { get: vi.fn((name: string) => (name === 'x-request-id' ? 'hdr-id' : null)) },
      };
      const log = withRequest(mockReq);
      log.info('test');
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'hdr-id' }),
        'test'
      );
    });

    it('falls back to x-vercel-id', () => {
      const mockReq = {
        headers: {
          get: vi.fn((name: string) => (name === 'x-vercel-id' ? 'vercel-id' : null)),
        },
      };
      const log = withRequest(mockReq);
      log.info('test');
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'vercel-id' }),
        'test'
      );
    });

    it('generates UUID when no header present', () => {
      const mockReq = {
        headers: { get: vi.fn(() => null) },
      };
      const log = withRequest(mockReq);
      log.info('test');

      const call = mockPinoInstance.info.mock.calls[0]!;
      const ctx = call[0] as { requestId: string };
      expect(ctx.requestId).toBeDefined();
      // UUID v4 format
      expect(ctx.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });
});
