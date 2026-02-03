// In-memory rate limiting store (for production, use Redis or similar)
const rateLimitStore = new Map();
// Clean up expired entries every minute
const CLEANUP_INTERVAL_MS = 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL_MS).unref();
/**
 * Create a rate limiting middleware
 * Limits requests based on IP address
 */
export function createRateLimitMiddleware(options = {}) {
    const { windowMs = 60 * 1000, // 1 minute default
    maxRequests = 100, // 100 requests per minute default
    skipSuccessfulRequests = false, skipFailedRequests = false, } = options;
    return async (c, next) => {
        // Get client IP from various headers (supporting proxies)
        const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
            c.req.header("x-real-ip") ||
            c.req.header("cf-connecting-ip") ||
            "unknown";
        const now = Date.now();
        const entry = rateLimitStore.get(ip);
        // Initialize or reset entry if window has expired
        if (!entry || now > entry.resetTime) {
            rateLimitStore.set(ip, {
                count: 1,
                resetTime: now + windowMs,
            });
            return next();
        }
        // Check if limit exceeded
        if (entry.count >= maxRequests) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            c.header("X-RateLimit-Limit", maxRequests.toString());
            c.header("X-RateLimit-Remaining", "0");
            c.header("X-RateLimit-Reset", entry.resetTime.toString());
            c.header("Retry-After", retryAfter.toString());
            return c.json({ error: "Too many requests" }, 429);
        }
        // Increment counter
        entry.count++;
        // Add rate limit headers
        c.header("X-RateLimit-Limit", maxRequests.toString());
        c.header("X-RateLimit-Remaining", (maxRequests - entry.count).toString());
        c.header("X-RateLimit-Reset", entry.resetTime.toString());
        await next();
        // Optionally decrement count based on response status
        const status = c.res.status;
        if ((skipSuccessfulRequests && status >= 200 && status < 300) ||
            (skipFailedRequests && (status < 200 || status >= 400))) {
            entry.count--;
        }
    };
}
// Pre-configured rate limiters for common use cases
export const strictRateLimit = createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
});
export const mediumRateLimit = createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
});
export const looseRateLimit = createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // 300 requests per minute
});
