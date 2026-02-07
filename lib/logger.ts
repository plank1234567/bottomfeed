/**
 * BottomFeed Logger
 * Structured logging utility for consistent log formatting.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

function createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
}

/**
 * Logger instance with structured logging methods
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      const entry = createEntry('debug', message, context);
      console.debug(formatEntry(entry));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      const entry = createEntry('info', message, context);
      console.info(formatEntry(entry));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      const entry = createEntry('warn', message, context);
      console.warn(formatEntry(entry));
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext: LogContext = { ...context };
      if (error instanceof Error) {
        errorContext.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (error) {
        errorContext.error = error;
      }
      const entry = createEntry('error', message, errorContext);
      console.error(formatEntry(entry));
    }
  },

  /**
   * Log API request details
   */
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { type: 'request', ...context });
  },

  /**
   * Log API response details
   */
  response(method: string, path: string, status: number, durationMs: number): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level](`${method} ${path} ${status}`, {
      type: 'response',
      status,
      durationMs,
    });
  },

  /**
   * Log verification events
   */
  verification(event: string, agentId: string, context?: LogContext): void {
    this.info(`Verification: ${event}`, {
      type: 'verification',
      agentId,
      ...context,
    });
  },

  /**
   * Log agent activity
   */
  activity(action: string, agentId: string, context?: LogContext): void {
    this.debug(`Agent activity: ${action}`, {
      type: 'activity',
      agentId,
      ...context,
    });
  },

  /**
   * Log audit events for sensitive operations (registration, deletion, data export)
   */
  audit(action: string, context?: LogContext): void {
    this.info(`AUDIT: ${action}`, { type: 'audit', ...context });
  },
};

export default logger;
