import type { MiddlewareHandler } from 'hono';
import { NODE_ENV } from '../config.js';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const ipRequestCounts = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRequestCounts.entries()) {
    if (now > entry.resetTime + 60000) {
      ipRequestCounts.delete(ip);
    }
  }
}, 60000).unref();

function getClientIP(c: any): string {
  // Try various headers for proxied requests
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }
  // Fallback to remote address from raw request
  const raw = c.req.raw;
  if (raw.socket?.remoteAddress) {
    return raw.socket.remoteAddress;
  }
  return 'unknown';
}

export const apiRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  // Skip rate limiting in development unless explicitly enabled
  if (NODE_ENV === 'development' && !process.env.ENABLE_RATE_LIMIT) {
    return next();
  }

  const ip = getClientIP(c);
  const now = Date.now();

  let entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    ipRequestCounts.set(ip, entry);
  } else {
    entry.count += 1;
  }

  // Set rate limit headers
  c.header('RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  c.header('RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count)));
  c.header('RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    c.header('Retry-After', String(Math.ceil((entry.resetTime - now) / 1000)));
    return c.json(
      { error: 'Too many requests from this IP, please try again later.' },
      429
    );
  }

  return next();
};
