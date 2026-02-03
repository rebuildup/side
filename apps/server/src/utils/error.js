import { createHttpError as sharedCreateHttpError, getErrorMessage as sharedGetErrorMessage, } from "@side-ide/shared/utils-node";
import { NODE_ENV } from "../config.js";
export function createHttpError(message, status) {
    return sharedCreateHttpError(message, status);
}
export function getErrorMessage(error) {
    return sharedGetErrorMessage(error);
}
export function handleError(c, error) {
    const status = (error?.status ?? 500);
    const message = getErrorMessage(error) || "Unexpected error";
    if (NODE_ENV === "production" && status === 500) {
        return c.json({ error: "Internal server error" }, status);
    }
    return c.json({ error: message }, status);
}
export async function readJson(c) {
    try {
        return await c.req.json();
    }
    catch (error) {
        // Log parse errors in development for debugging
        if (NODE_ENV === "development") {
            console.warn("JSON parse error:", getErrorMessage(error));
        }
        return null;
    }
}
