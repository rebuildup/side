import crypto from "node:crypto";
import { basicAuth } from "hono/basic-auth";
import { BASIC_AUTH_PASSWORD, BASIC_AUTH_USER } from "../config.js";
export const basicAuthMiddleware = BASIC_AUTH_USER && BASIC_AUTH_PASSWORD
    ? basicAuth({ username: BASIC_AUTH_USER, password: BASIC_AUTH_PASSWORD })
    : undefined;
// WebSocket token management
const WS_TOKEN_TTL_MS = 30 * 1000; // 30 seconds
const wsTokens = new Map(); // token -> { expiry, ipAddress }
// Cleanup expired tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of wsTokens.entries()) {
        if (now > entry.expiry) {
            wsTokens.delete(token);
        }
    }
}, 10000).unref();
/**
 * Generate a one-time WebSocket token bound to an IP address
 */
export function generateWsToken(ipAddress) {
    const token = crypto.randomBytes(32).toString("hex");
    wsTokens.set(token, {
        expiry: Date.now() + WS_TOKEN_TTL_MS,
        ipAddress,
    });
    return token;
}
/**
 * Validate and consume a WebSocket token
 * Verifies the token exists, has not expired, and matches the IP address
 */
export function validateWsToken(token, ipAddress) {
    const entry = wsTokens.get(token);
    if (!entry) {
        return false;
    }
    // Check IP binding to prevent token theft
    if (entry.ipAddress !== ipAddress) {
        console.warn(`WebSocket token IP mismatch: expected ${entry.ipAddress}, got ${ipAddress}`);
        wsTokens.delete(token); // Delete invalid token
        return false;
    }
    wsTokens.delete(token); // One-time use
    return Date.now() <= entry.expiry;
}
/**
 * Check if Basic Auth is enabled
 */
export function isBasicAuthEnabled() {
    return Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASSWORD);
}
export function verifyWebSocketAuth(req) {
    if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
        return true;
    }
    // Extract IP address from various headers (supporting proxies)
    const forwardedFor = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const cfConnectingIp = req.headers["cf-connecting-ip"];
    const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
        (Array.isArray(realIp) ? realIp[0] : realIp) ||
        (Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp) ||
        "unknown";
    // Check for token in query string first (with IP binding)
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token");
    if (token && validateWsToken(token, clientIp)) {
        return true;
    }
    // Fall back to Basic Auth header with timing-safe comparison
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return false;
    }
    const base64Credentials = authHeader.slice("Basic ".length);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
        return false;
    }
    const username = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);
    // Use timing-safe comparison for passwords to prevent timing attacks
    if (username.length !== BASIC_AUTH_USER.length ||
        password.length !== BASIC_AUTH_PASSWORD.length) {
        return false;
    }
    const usernameBuffer = Buffer.from(username, "utf8");
    const expectedUsernameBuffer = Buffer.from(BASIC_AUTH_USER, "utf8");
    const passwordBuffer = Buffer.from(password, "utf8");
    const expectedPasswordBuffer = Buffer.from(BASIC_AUTH_PASSWORD, "utf8");
    if (!crypto.timingSafeEqual(usernameBuffer, expectedUsernameBuffer)) {
        return false;
    }
    return crypto.timingSafeEqual(passwordBuffer, expectedPasswordBuffer);
}
