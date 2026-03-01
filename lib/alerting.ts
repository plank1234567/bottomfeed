/**
 * Alert Webhook System
 * Fire-and-forget alerts to Slack/Discord/generic webhook endpoints.
 * Rate-limited per dedup key to prevent alert storms.
 */

import { createHmac } from 'crypto';
import { logger } from './logger';

export type AlertLevel = 'info' | 'warn' | 'critical';

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  details?: string;
  source?: string;
}

// Rate limiter: max 1 alert per dedup key per 5 minutes
const DEDUP_TTL_MS = 5 * 60 * 1000;
const recentAlerts = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const lastSent = recentAlerts.get(key);
  if (lastSent && Date.now() - lastSent < DEDUP_TTL_MS) {
    return true;
  }
  return false;
}

function recordAlert(key: string): void {
  recentAlerts.set(key, Date.now());

  // Prune stale entries to prevent memory leak
  if (recentAlerts.size > 100) {
    const now = Date.now();
    for (const [k, t] of recentAlerts) {
      if (now - t > DEDUP_TTL_MS) {
        recentAlerts.delete(k);
      }
    }
  }
}

/** Exported for testing. */
export function _resetAlertState(): void {
  recentAlerts.clear();
}

/**
 * Send an alert to the configured webhook URL.
 * Fire-and-forget — never throws, never blocks callers.
 */
export function sendAlert(payload: AlertPayload): void {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const debugMode = process.env.DEBUG_ALERTS === 'true';

  if (!webhookUrl && !debugMode) return;

  // Dedup key: level + title + source
  const dedupKey = `${payload.level}:${payload.title}:${payload.source ?? ''}`;
  if (isDuplicate(dedupKey)) return;
  recordAlert(dedupKey);

  const body = JSON.stringify({
    text: `[${payload.level.toUpperCase()}] ${payload.title}`,
    timestamp: new Date().toISOString(),
    source: payload.source ?? 'bottomfeed',
    details: payload.details,
  });

  // In debug mode, log instead of POSTing
  if (debugMode) {
    logger.info(`[ALERT] ${JSON.parse(body).text}`, {
      source: payload.source,
      details: payload.details,
    });
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // HMAC signature if key is available
  const hmacKey = process.env.HMAC_KEY;
  if (hmacKey) {
    const signature = createHmac('sha256', hmacKey).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  // Fire-and-forget
  fetch(webhookUrl!, {
    method: 'POST',
    headers,
    body,
  }).catch(() => {
    // Silently swallow — alerting must never cascade failures
    logger.debug('Alert webhook delivery failed');
  });
}
