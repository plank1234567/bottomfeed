/**
 * BottomFeed Logger
 * Structured logging powered by pino with a facade that preserves the original API surface.
 */

import pino from 'pino';

export interface LogContext {
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';
const level = (process.env.LOG_LEVEL as string) || (isProduction ? 'info' : 'debug');

function createPinoInstance(): pino.Logger {
  const options: pino.LoggerOptions = {
    level,
    base: {
      service: 'bottomfeed',
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  // Use pino-pretty in development for human-readable output.
  // In production, pino defaults to JSON on stdout.
  if (!isProduction) {
    try {
      // pino-pretty is a devDependency — require conditionally so builds
      // don't break if it's pruned in production node_modules.
      options.transport = {
        target: 'pino-pretty',
        options: { colorize: true },
      };
    } catch {
      // pino-pretty not available — fall through to JSON output
    }
  }

  return pino(options);
}

const pinoLogger = createPinoInstance();

/**
 * Logger instance with structured logging methods.
 * Drop-in replacement for the previous custom logger — same method signatures.
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (context) {
      pinoLogger.debug(context, message);
    } else {
      pinoLogger.debug(message);
    }
  },

  info(message: string, context?: LogContext): void {
    if (context) {
      pinoLogger.info(context, message);
    } else {
      pinoLogger.info(message);
    }
  },

  warn(message: string, context?: LogContext): void {
    if (context) {
      pinoLogger.warn(context, message);
    } else {
      pinoLogger.warn(message);
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const merged: LogContext = { ...context };

    if (error instanceof Error) {
      merged.err = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error && typeof error === 'object' && !Array.isArray(error)) {
      // Caller passed a context object as the second arg (e.g. logger.error('msg', { foo }))
      Object.assign(merged, error);
    } else if (error !== undefined && error !== null) {
      merged.err = error;
    }

    if (Object.keys(merged).length > 0) {
      pinoLogger.error(merged, message);
    } else {
      pinoLogger.error(message);
    }
  },

  /** Log API request details */
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { type: 'request', ...context });
  },

  /** Log API response details */
  response(method: string, path: string, status: number, durationMs: number): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level](`${method} ${path} ${status}`, {
      type: 'response',
      status,
      durationMs,
    });
  },

  /** Log verification events */
  verification(event: string, agentId: string, context?: LogContext): void {
    this.info(`Verification: ${event}`, {
      type: 'verification',
      agentId,
      ...context,
    });
  },

  /** Log agent activity */
  activity(action: string, agentId: string, context?: LogContext): void {
    this.debug(`Agent activity: ${action}`, {
      type: 'activity',
      agentId,
      ...context,
    });
  },

  /** Log audit events for sensitive operations */
  audit(action: string, context?: LogContext): void {
    this.info(`AUDIT: ${action}`, { type: 'audit', ...context });
  },
};

/**
 * Create a request-scoped logger that auto-injects requestId into all log context.
 */
export function withRequestId(requestId: string) {
  return {
    debug(message: string, context?: LogContext) {
      logger.debug(message, { requestId, ...context });
    },
    info(message: string, context?: LogContext) {
      logger.info(message, { requestId, ...context });
    },
    warn(message: string, context?: LogContext) {
      logger.warn(message, { requestId, ...context });
    },
    error(message: string, error?: Error | unknown, context?: LogContext) {
      logger.error(message, error, { requestId, ...context });
    },
  };
}

/**
 * Create a request-scoped logger from a NextRequest, extracting x-request-id
 * from headers. Returns a child logger with requestId bound to all entries.
 */
export function withRequest(request: { headers: { get(name: string): string | null } }) {
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-vercel-id') ||
    crypto.randomUUID();
  return withRequestId(requestId);
}

export default logger;
