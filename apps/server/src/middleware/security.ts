import { type MiddlewareHandler } from 'hono';
import { NODE_ENV } from '../config.js';

// Security event logging
export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.warn(`[SECURITY] ${timestamp} ${event}:`, JSON.stringify(details));
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow Monaco Editor from CDN and blob: for workers
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:;");
  await next();
};

export const wsMessageRateLimits = new Map<string, { count: number; resetTime: number }>();

export function checkWebSocketRateLimit(socketId: string, windowMs: number, maxMessages: number): boolean {
  const now = Date.now();
  const limit = wsMessageRateLimits.get(socketId);
  if (!limit || now > limit.resetTime) {
    wsMessageRateLimits.set(socketId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (limit.count >= maxMessages) return false;
  limit.count += 1;
  return true;
}

// Cleanup old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limit] of wsMessageRateLimits.entries()) {
    if (now > limit.resetTime + 60000) wsMessageRateLimits.delete(socketId);
  }
}, 60000).unref();
